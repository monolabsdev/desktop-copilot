import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BaseMessage } from "@langchain/core/messages";
import type { Message } from "ollama";
import { handleChatCommand } from "../commands";
import { CAPTURE_SCREEN_TEXT_TOOL } from "../tools/captureScreenText";
import {
  createFileAgent,
  getLatestAssistantMessage,
  toLangChainHistory,
  toOllamaMessages,
} from "../ollama/agent";
import {
  createStreamChat,
  createToolHandler,
  normalizeAssistantMessage,
  toErrorMessage,
  type ChatMessage,
  type StreamResult,
  type ToolOptions,
  type ToolUsage,
} from "./ollama";

export function useOllamaChat(model: string, options?: ToolOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolUsage, setToolUsage] = useState<ToolUsage>({
    inProgress: false,
  });
  // Used to cancel late responses when a new request is fired.
  const requestIdRef = useRef(0);
  const streamMessageIdRef = useRef(0);
  const historyRef = useRef<Message[]>([]);
  const agentRef = useRef<Awaited<ReturnType<typeof createFileAgent>> | null>(
    null,
  );
  const agentModelRef = useRef<string | null>(null);
  const toolConfig = options?.toolsEnabled
    ? options?.agentEnabled
      ? undefined
      : [CAPTURE_SCREEN_TEXT_TOOL]
    : undefined;
  const streamChat = createStreamChat({
    model,
    toolConfig,
    requestIdRef,
    streamMessageIdRef,
    setMessages,
  });

  const appendHistory = (entries: Message[]) => {
    historyRef.current = [...historyRef.current, ...entries];
  };
  const applyAssistantMessage = (result: StreamResult) => {
    if (!result.assistantMessage) return;
    const normalized = normalizeAssistantMessage(
      result.assistantMessage,
      result.thinkingDurationMs,
    );
    appendHistory([normalized.historyMessage]);
    setMessages((prev) =>
      prev.map((message) =>
        message.streamId === result.streamMessageId
          ? { ...normalized.displayMessage }
          : message,
      ),
    );
  };
  const toolHandlerOptions: ToolOptions = {
    toolsEnabled: options?.toolsEnabled ?? false,
    agentEnabled: options?.agentEnabled,
    requestScreenCapture: options?.requestScreenCapture,
    setCaptureInProgress: options?.setCaptureInProgress,
    beforeCapture: options?.beforeCapture,
    afterCapture: options?.afterCapture,
    setToolUsage,
  };

  const { handleToolCalls } = createToolHandler({
    options: toolHandlerOptions,
    invoke,
    appendHistory,
    streamChat,
    requestIdRef,
    applyAssistantMessage,
  });

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    // Slash commands are handled locally and bypass the model.
    const commandResult = await handleChatCommand(trimmed, { invoke });
    if (commandResult.handled) {
      if (commandResult.error) {
        setError(commandResult.error);
        return;
      }
      if (commandResult.clearHistory) {
        clearHistory();
      }
      if (commandResult.clearInput) setInput("");
      const newMessages = commandResult.messages;
      if (!commandResult.clearHistory && newMessages && newMessages.length) {
        setMessages((prev) => [...prev, ...newMessages]);
      }
      setError(null);
      return;
    }

    setInput("");
    await runChat(trimmed, { appendUserMessage: true });
  };

  const cancelSend = () => {
    if (!isSending) return;
    requestIdRef.current += 1;
    setIsSending(false);
    setError(null);
    setToolUsage((prev) => ({ ...prev, inProgress: false }));
  };

  const clearHistory = () => {
    setMessages([]);
    historyRef.current = [];
  };

  const regenerateLastResponse = async () => {
    if (isSending) return;
    const { messageIndex, historyIndex, content } = findLastUserMessage();
    if (messageIndex === null || historyIndex === null || !content) return;
    setMessages((prev) => prev.slice(0, messageIndex + 1));
    historyRef.current = historyRef.current.slice(0, historyIndex + 1);
    await runChat(content, { appendUserMessage: false });
  };

  const canRegenerate = messages.some((message) => message.role === "user");

  return {
    messages,
    input,
    setInput,
    isSending,
    error,
    toolUsage,
    sendMessage,
    cancelSend,
    clearHistory,
    regenerateLastResponse,
    canRegenerate,
  };

  async function getAgent() {
    if (agentRef.current && agentModelRef.current === model) {
      return agentRef.current;
    }
    const agent = await createFileAgent(model);
    agentRef.current = agent;
    agentModelRef.current = model;
    return agent;
  }

  async function runChat(
    content: string,
    runOptions: { appendUserMessage: boolean },
  ) {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;
    const requestStartedAt = Date.now();

    setToolUsage((prev: ToolUsage) => ({
      ...prev,
      name: undefined,
      lastUsedAt: undefined,
    }));
    if (runOptions.appendUserMessage) {
      const userMessage: Message = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      appendHistory([userMessage]);
    }

    setIsSending(true);
    setError(null);

    // Bump request id to ignore late responses after cancel/replace.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const baseMessages = historyRef.current;
      if (options?.agentEnabled) {
        const agent = await getAgent();
        const historyMessages = toLangChainHistory(baseMessages);
        const result = (await agent.invoke({
          messages: historyMessages,
        })) as {
          messages?: BaseMessage[];
        };
        if (requestId !== requestIdRef.current) return;
        const resultMessages = Array.isArray(result?.messages)
          ? result.messages
          : [];
        const assistantMessage = getLatestAssistantMessage(resultMessages);
        if (!assistantMessage) {
          throw new Error("No response from agent.");
        }
        const newHistory =
          resultMessages.length >= historyMessages.length
            ? resultMessages.slice(historyMessages.length)
            : resultMessages;
        if (newHistory.length) {
          appendHistory(toOllamaMessages(newHistory));
        } else {
          appendHistory([assistantMessage]);
        }
        setMessages((prev) => [...prev, assistantMessage]);
        return;
      }

      const result = await streamChat(baseMessages, requestId, requestStartedAt);
      if (!result || requestId !== requestIdRef.current) return;

      if (result.toolCalls && result.toolCalls.length > 0) {
        // Tool calls are executed locally, then we send a follow-up chat.
        const toolReply = await handleToolCalls(result.toolCalls, baseMessages);
        if (!toolReply) return;
        return;
      }

      if (result.assistantMessage) {
        applyAssistantMessage(result);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(toErrorMessage(err, "Ollama unreachable."));
    } finally {
      if (requestId === requestIdRef.current) {
        setIsSending(false);
      }
    }
  }

  function findLastUserMessage() {
    let messageIndex: number | null = null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        messageIndex = i;
        break;
      }
    }
    let historyIndex: number | null = null;
    for (let i = historyRef.current.length - 1; i >= 0; i -= 1) {
      if (historyRef.current[i].role === "user") {
        historyIndex = i;
        break;
      }
    }
    if (messageIndex === null || historyIndex === null) {
      return { messageIndex: null, historyIndex: null, content: "" };
    }
    const content = historyRef.current[historyIndex]?.content ?? "";
    return { messageIndex, historyIndex, content };
  }
}
