import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Message } from "ollama";
import { handleChatCommand } from "../commands";
import { CAPTURE_SCREEN_TEXT_TOOL } from "../tools/captureScreenText";
import { ollamaChat } from "../ollama/client";

type CaptureConsent = {
  approved: boolean;
};

type ToolOptions = {
  toolsEnabled: boolean;
  requestScreenCapture?: () => Promise<CaptureConsent>;
  setCaptureInProgress?: (inProgress: boolean) => void;
  beforeCapture?: () => Promise<void> | void;
  afterCapture?: () => Promise<void> | void;
};

type ChatMessage = Message & {
  thinking?: string;
};

const REASONING_MODEL_PATTERN = /(deepseek|reason|think|r1|o1)/i;
const THINKING_TAGS = [
  /<think>([\s\S]*?)<\/think>/gi,
  /<thinking>([\s\S]*?)<\/thinking>/gi,
];

function isReasoningModel(model: string) {
  return REASONING_MODEL_PATTERN.test(model);
}

function extractThinking(content: string) {
  let cleaned = content;
  const thinkingParts: string[] = [];

  THINKING_TAGS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, (_match, inner) => {
      if (typeof inner === "string") {
        const trimmed = inner.trim();
        if (trimmed) thinkingParts.push(trimmed);
      }
      return "";
    });
  });

  return {
    content: cleaned.trim(),
    thinking: thinkingParts.length ? thinkingParts.join("\n\n").trim() : undefined,
  };
}

export function useOllamaChat(model: string, options?: ToolOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const historyRef = useRef<Message[]>([]);
  const toolConfig = options?.toolsEnabled ? [CAPTURE_SCREEN_TEXT_TOOL] : undefined;

  const appendHistory = (entries: Message[]) => {
    historyRef.current = [...historyRef.current, ...entries];
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const commandResult = await handleChatCommand(trimmed, { invoke });
    if (commandResult.handled) {
      if (commandResult.error) {
        setError(commandResult.error);
        return;
      }
      if (commandResult.clearInput) setInput("");
      const newMessages = commandResult.messages;
      if (newMessages && newMessages.length) {
        setMessages((prev) => [...prev, ...newMessages]);
      }
      setError(null);
      return;
    }

    const userMessage: Message = { role: "user", content: trimmed };
    setInput("");
    setIsSending(true);
    setError(null);
    setMessages((prev) => [...prev, userMessage]);
    appendHistory([userMessage]);

    // Bump request id to ignore late responses after cancel/replace.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const baseMessages = historyRef.current;
      const response = await ollamaChat({
        model,
        messages: baseMessages,
        tools: toolConfig,
      });

      if (requestId !== requestIdRef.current) return;

      const payload = response as { message?: Message };
      const assistantMessage = payload?.message as
        | (Message & { reasoning?: string; thinking?: string; thoughts?: string })
        | undefined;
      if (!assistantMessage) throw new Error("Invalid response from Ollama.");
      const toolCalls = assistantMessage?.tool_calls ?? [];

      if (toolCalls.length > 0) {
        // Tool calls are executed locally, then we send a follow-up chat.
        const toolReply = await handleToolCalls(toolCalls, baseMessages);
        if (!toolReply) return;
        return;
      }

      const responseContent = assistantMessage?.content ?? "";
      const reasoningEnabled = isReasoningModel(model);
      const responseThinking =
        assistantMessage?.reasoning ??
        assistantMessage?.thinking ??
        assistantMessage?.thoughts;
      const extracted = reasoningEnabled
        ? extractThinking(responseContent)
        : { content: responseContent.trim(), thinking: undefined };
      const thinking =
        reasoningEnabled && typeof responseThinking === "string"
          ? responseThinking.trim() || extracted.thinking
          : extracted.thinking;
      const content = extracted.content;
      const assistantHistoryMessage = { role: "assistant", content };
      if (!content.trim() && !thinking) throw new Error("No response from Ollama.");
      appendHistory([assistantHistoryMessage]);
      setMessages((prev) => [
        ...prev,
        { ...assistantHistoryMessage, thinking },
      ]);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Ollama unreachable.");
    } finally {
      if (requestId === requestIdRef.current) {
        setIsSending(false);
      }
    }
  };

  const cancelSend = () => {
    if (!isSending) return;
    requestIdRef.current += 1;
    setIsSending(false);
    setError(null);
  };

  const clearHistory = () => {
    setMessages([]);
    historyRef.current = [];
  };

  return {
    messages,
    input,
    setInput,
    isSending,
    error,
    sendMessage,
    cancelSend,
    clearHistory,
  };

  async function handleToolCalls(
    toolCalls: NonNullable<Message["tool_calls"]>,
    baseMessages: Message[],
  ) {
    if (!toolCalls.some((call) => call.function?.name === "capture_screen_text")) {
      throw new Error("Unsupported tool call.");
    }

    if (!options?.toolsEnabled || !options.requestScreenCapture) {
      const toolMessage = {
        role: "tool",
        content: JSON.stringify({ error: "Screen capture tool is disabled." }),
        tool_name: "capture_screen_text",
      } satisfies Message;

      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);

      await streamFollowup(baseMessages, toolCalls, toolMessage);
      return true;
    }

    const consent = await options.requestScreenCapture();
    if (!consent.approved) {
      const toolMessage = {
        role: "tool",
        content: JSON.stringify({ error: "User declined screen capture." }),
        tool_name: "capture_screen_text",
      } satisfies Message;

      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);

      await streamFollowup(baseMessages, toolCalls, toolMessage);
      return true;
    }

    options.setCaptureInProgress?.(true);
    let toolResponse: unknown = null;
    try {
      await options.beforeCapture?.();
      toolResponse = await invoke("capture_screen_text");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message);
    } finally {
      await options.afterCapture?.();
      options.setCaptureInProgress?.(false);
    }

    const toolMessage = {
      role: "tool",
      content: JSON.stringify(toolResponse),
      tool_name: "capture_screen_text",
    } satisfies Message;

    appendHistory([
      { role: "assistant", content: "", tool_calls: toolCalls },
      toolMessage,
    ]);

    await streamFollowup(baseMessages, toolCalls, toolMessage);
    return true;
  }

  async function streamFollowup(
    baseMessages: Message[],
    toolCalls: NonNullable<Message["tool_calls"]>,
    toolMessage: Message,
  ) {
    const followupMessages: Message[] = [
      ...baseMessages,
      { role: "assistant", content: "", tool_calls: toolCalls },
      toolMessage,
    ];

    const response = await ollamaChat({
      model,
      messages: followupMessages,
      tools: toolConfig,
    });

    const payload = response as { message?: Message };
    const assistantMessage = payload?.message as
      | (Message & { reasoning?: string; thinking?: string; thoughts?: string })
      | undefined;
    if (!assistantMessage) throw new Error("Invalid response from Ollama.");
    const toolCallsFollowup = assistantMessage?.tool_calls ?? [];
    if (toolCallsFollowup.length > 0) {
      await handleToolCalls(toolCallsFollowup, followupMessages);
      return;
    }

    const responseContent = assistantMessage?.content ?? "";
    const reasoningEnabled = isReasoningModel(model);
    const responseThinking =
      assistantMessage?.reasoning ??
      assistantMessage?.thinking ??
      assistantMessage?.thoughts;
    const extracted = reasoningEnabled
      ? extractThinking(responseContent)
      : { content: responseContent.trim(), thinking: undefined };
    const thinking =
      reasoningEnabled && typeof responseThinking === "string"
        ? responseThinking.trim() || extracted.thinking
        : extracted.thinking;
    const content = extracted.content;
    const assistantHistoryMessage = { role: "assistant", content };
    if (!content.trim() && !thinking) throw new Error("No response from Ollama.");
    appendHistory([assistantHistoryMessage]);
    setMessages((prev) => [
      ...prev,
      { ...assistantHistoryMessage, thinking },
    ]);
  }
}
