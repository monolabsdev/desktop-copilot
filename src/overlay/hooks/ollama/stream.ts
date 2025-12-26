import { listen, type Event } from "@tauri-apps/api/event";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Message } from "ollama";

import { ollamaChatStream } from "../../ollama/client";
import type {
  AssistantPayload,
  ChatMessage,
  StreamPayload,
  StreamResult,
} from "./types";
import {
  // extractThinking,
  mergeStreamText,
  normalizeThinkingValue,
} from "./thinking";

type StreamBindings = {
  model: string;
  toolConfig?: unknown;
  requestIdRef: MutableRefObject<number>;
  streamMessageIdRef: MutableRefObject<number>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

type StreamArgs = StreamBindings & {
  baseMessages: Message[];
  requestId: number;
  requestStartedAt: number;
};

export function createStreamChat(bindings: StreamBindings) {
  return (
    baseMessages: Message[],
    requestId: number,
    requestStartedAt: number,
  ) =>
    streamOllamaChat({
      ...bindings,
      baseMessages,
      requestId,
      requestStartedAt,
    });
}

async function streamOllamaChat({
  baseMessages,
  requestId,
  requestStartedAt,
  model,
  toolConfig,
  requestIdRef,
  streamMessageIdRef,
  setMessages,
}: StreamArgs): Promise<StreamResult | null> {
  const streamId = `stream-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;

  let streamedMessageId: number | null = null;
  let content = "";
  let finished = false;
  let latestMessage: AssistantPayload | null = null;

  // === Thinking latency (THIS is the number you want) ===
  let thinkingLatencyMs: number | undefined;

  // === Optional streamed thinking text ===
  let streamedReasoning: string | undefined;
  let streamedThinking: string | undefined;
  let streamedThoughts: string | undefined;

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

  const updateStreamingMessage = () => {
    if (streamedMessageId === null) return;
    const streamingThinking = normalizeThinkingValue(
      streamedReasoning ?? streamedThinking ?? streamedThoughts,
    );
    setMessages((prev) =>
      prev.map((message) =>
        message.streamId === streamedMessageId
          ? { ...message, content, thinking: streamingThinking }
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

      // 🔒 LOCK THINKING TIME ON FIRST ASSISTANT SIGNAL
      if (thinkingLatencyMs === undefined) {
        thinkingLatencyMs = Date.now() - requestStartedAt;
      }

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

        if (typeof message.reasoning === "string" && message.reasoning) {
          streamedReasoning = mergeStreamText(
            streamedReasoning,
            message.reasoning,
          );
        }

        if (typeof message.thinking === "string" && message.thinking) {
          streamedThinking = mergeStreamText(
            streamedThinking,
            message.thinking,
          );
        }

        if (typeof message.thoughts === "string" && message.thoughts) {
          streamedThoughts = mergeStreamText(
            streamedThoughts,
            message.thoughts,
          );
        }
      }

      if (message?.tool_calls?.length) {
        finished = true;
        cleanup();
        removeStreamingMessage();
        resolve({ toolCalls: message.tool_calls });
        return;
      }

      const delta = typeof message?.content === "string" ? message.content : "";

      if (delta) {
        content += delta;
        ensureStreamingMessage();
        updateStreamingMessage();
      } else if (streamedReasoning || streamedThinking || streamedThoughts) {
        ensureStreamingMessage();
        updateStreamingMessage();
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

        const normalizedReasoning = normalizeThinkingValue(streamedReasoning);
        if (normalizedReasoning && !assistantMessage.reasoning) {
          assistantMessage.reasoning = normalizedReasoning;
        }

        const normalizedThinking = normalizeThinkingValue(streamedThinking);
        if (normalizedThinking && !assistantMessage.thinking) {
          assistantMessage.thinking = normalizedThinking;
        }

        const normalizedThoughts = normalizeThinkingValue(streamedThoughts);
        if (normalizedThoughts && !assistantMessage.thoughts) {
          assistantMessage.thoughts = normalizedThoughts;
        }

        resolve({
          assistantMessage,
          streamMessageId: streamedMessageId ?? undefined,
          thinkingDurationMs: thinkingLatencyMs,
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
