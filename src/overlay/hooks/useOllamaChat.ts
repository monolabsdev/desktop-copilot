import { useRef, useState } from "react";
import { listen, type Event } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { Message } from "ollama";
import { handleChatCommand } from "../commands";
import { CAPTURE_SCREEN_TEXT_TOOL } from "../tools/captureScreenText";
import { ollamaChatStream } from "../ollama/client";

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
  streamId?: number;
};

type AssistantPayload = Message & {
  reasoning?: string;
  thinking?: string;
  thoughts?: string;
};

const THINKING_TAGS = [
  /<think>([\s\S]*?)<\/think>/gi,
  /<thinking>([\s\S]*?)<\/thinking>/gi,
];

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
    thinking: thinkingParts.length
      ? thinkingParts.join("\n\n").trim()
      : undefined,
  };
}

function normalizeThinkingValue(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^[\.\?\!]+$/.test(trimmed)) return undefined;
  return trimmed;
}

function normalizeAssistantMessage(
  assistantMessage: AssistantPayload | undefined,
) {
  if (!assistantMessage) throw new Error("Invalid response from Ollama.");

  const responseContent = assistantMessage.content ?? "";
  const responseThinking = normalizeThinkingValue(
    assistantMessage.reasoning ??
      assistantMessage.thinking ??
      assistantMessage.thoughts,
  );

  const extracted = extractThinking(responseContent);
  const extractedThinking = normalizeThinkingValue(extracted.thinking);
  const thinking = responseThinking ?? extractedThinking;

  const content = extracted.content;
  const historyMessage: Message = { role: "assistant", content };
  if (!content.trim() && !thinking) throw new Error("No response from Ollama.");

  return {
    historyMessage,
    displayMessage: { ...historyMessage, thinking },
  };
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function buildToolMessage(payload: unknown): Message {
  return {
    role: "tool",
    content: JSON.stringify(payload),
    tool_name: "capture_screen_text",
  } satisfies Message;
}

export function useOllamaChat(model: string, options?: ToolOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const streamMessageIdRef = useRef(0);
  const historyRef = useRef<Message[]>([]);
  const toolConfig = options?.toolsEnabled
    ? [CAPTURE_SCREEN_TEXT_TOOL]
    : undefined;

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
      const result = await streamOllamaChat(baseMessages, requestId);
      if (!result || requestId !== requestIdRef.current) return;

      if (result.toolCalls && result.toolCalls.length > 0) {
        // Tool calls are executed locally, then we send a follow-up chat.
        const toolReply = await handleToolCalls(result.toolCalls, baseMessages);
        if (!toolReply) return;
        return;
      }

      if (result.assistantMessage) {
        const normalized = normalizeAssistantMessage(result.assistantMessage);
        appendHistory([normalized.historyMessage]);
        setMessages((prev) =>
          prev.map((message) =>
            message.streamId === result.streamMessageId
              ? { ...normalized.displayMessage }
              : message,
          ),
        );
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(toErrorMessage(err, "Ollama unreachable."));
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
    if (
      !toolCalls.some((call) => call.function?.name === "capture_screen_text")
    ) {
      throw new Error("Unsupported tool call.");
    }

    if (!options?.toolsEnabled || !options.requestScreenCapture) {
      const toolMessage = buildToolMessage({
        error: "Screen capture tool is disabled.",
      });

      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);

      await streamFollowup(baseMessages, toolCalls, toolMessage);
      return true;
    }

    const consent = await options.requestScreenCapture();
    if (!consent.approved) {
      const toolMessage = buildToolMessage({
        error: "User declined screen capture.",
      });

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
      throw new Error(toErrorMessage(err, "Screen capture failed."));
    } finally {
      await options.afterCapture?.();
      options.setCaptureInProgress?.(false);
    }

    const toolMessage = buildToolMessage(toolResponse);

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

    const requestId = requestIdRef.current;
    const result = await streamOllamaChat(followupMessages, requestId);
    if (!result || requestId !== requestIdRef.current) return;

    if (result.toolCalls && result.toolCalls.length > 0) {
      await handleToolCalls(result.toolCalls, followupMessages);
      return;
    }

    if (result.assistantMessage) {
      const normalized = normalizeAssistantMessage(result.assistantMessage);
      appendHistory([normalized.historyMessage]);
      setMessages((prev) =>
        prev.map((message) =>
          message.streamId === result.streamMessageId
            ? { ...normalized.displayMessage }
            : message,
        ),
      );
    }
  }

  type StreamPayload = {
    stream_id: string;
    chunk?: {
      done?: boolean;
      message?: AssistantPayload;
    };
    error?: string;
  };

  type StreamResult = {
    assistantMessage?: AssistantPayload;
    toolCalls?: NonNullable<Message["tool_calls"]>;
    streamMessageId?: number;
  };

  async function streamOllamaChat(
    baseMessages: Message[],
    requestId: number,
  ): Promise<StreamResult | null> {
    const streamId = `stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let streamedMessageId: number | null = null;
    let content = "";
    let finished = false;
    let latestMessage: AssistantPayload | null = null;
    let latestReasoning: string | undefined;
    let latestThinking: string | undefined;
    let latestThoughts: string | undefined;

    const ensureStreamingMessage = () => {
      if (streamedMessageId !== null) return;
      const nextId = streamMessageIdRef.current + 1;
      streamedMessageId = nextId;
      streamMessageIdRef.current = nextId;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", streamId: nextId },
      ]);
    };

    const updateStreamingContent = () => {
      if (streamedMessageId === null) return;
      setMessages((prev) =>
        prev.map((message) =>
          message.streamId === streamedMessageId
            ? { ...message, content }
            : message,
        ),
      );
    };

    const removeStreamingMessage = () => {
      if (streamedMessageId === null) return;
      setMessages((prev) =>
        prev.filter((message) => message.streamId !== streamedMessageId),
      );
    };

    const result = await new Promise<StreamResult | null>((resolve, reject) => {
      let unlisten: (() => void) | null = null;

      const cleanup = () => {
        if (unlisten) unlisten();
      };

      const handler = (event: Event<StreamPayload>) => {
        if (finished) return;
        if (requestId !== requestIdRef.current) {
          finished = true;
          cleanup();
          removeStreamingMessage();
          resolve(null);
          return;
        }

        const payload = event.payload;
        if (payload.stream_id !== streamId) return;

        if (payload.error) {
          finished = true;
          cleanup();
          removeStreamingMessage();
          reject(new Error(payload.error));
          return;
        }

        const chunk = payload.chunk;
        if (!chunk) return;
        const message = chunk.message;
        if (message) {
          latestMessage = message;
          const normalizedReasoning = normalizeThinkingValue(message.reasoning);
          if (normalizedReasoning) {
            latestReasoning = normalizedReasoning;
          }
          const normalizedThinking = normalizeThinkingValue(message.thinking);
          if (normalizedThinking) {
            latestThinking = normalizedThinking;
          }
          const normalizedThoughts = normalizeThinkingValue(message.thoughts);
          if (normalizedThoughts) {
            latestThoughts = normalizedThoughts;
          }
        }

        if (message?.tool_calls?.length) {
          finished = true;
          cleanup();
          removeStreamingMessage();
          resolve({ toolCalls: message.tool_calls });
          return;
        }

        const delta =
          typeof message?.content === "string" ? message.content : "";
        if (delta) {
          content += delta;
          ensureStreamingMessage();
          updateStreamingContent();
        }

        if (chunk.done) {
          finished = true;
          cleanup();
          ensureStreamingMessage();
          const assistantMessage: AssistantPayload = {
            role: "assistant",
            ...(latestMessage ?? {}),
            content,
          };
          if (latestReasoning && !assistantMessage.reasoning) {
            assistantMessage.reasoning = latestReasoning;
          }
          if (latestThinking && !assistantMessage.thinking) {
            assistantMessage.thinking = latestThinking;
          }
          if (latestThoughts && !assistantMessage.thoughts) {
            assistantMessage.thoughts = latestThoughts;
          }
          resolve({
            assistantMessage,
            streamMessageId: streamedMessageId ?? undefined,
          });
        }
      };

      listen<StreamPayload>("ollama:chunk", handler)
        .then((unsubscribe) => {
          unlisten = unsubscribe;
          return ollamaChatStream(
            {
              model,
              messages: baseMessages,
              tools: toolConfig,
            },
            streamId,
          );
        })
        .catch((err) => {
          finished = true;
          cleanup();
          reject(err);
        });
    });

    return result;
  }
}
