import type { MutableRefObject } from "react";
import type { Message } from "ollama";

import type { StreamResult, ToolOptions } from "./types";
import { toErrorMessage } from "./utils";

type InvokeFn = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

type StreamChat = (
  baseMessages: Message[],
  requestId: number,
  requestStartedAt: number,
) => Promise<StreamResult | null>;

type ApplyAssistantMessage = (result: StreamResult) => void;

type ToolHandlerDeps = {
  options?: ToolOptions;
  invoke: InvokeFn;
  appendHistory: (entries: Message[]) => void;
  streamChat: StreamChat;
  requestIdRef: MutableRefObject<number>;
  applyAssistantMessage: ApplyAssistantMessage;
};

function buildToolMessage(payload: unknown): Message {
  return {
    role: "tool",
    content: JSON.stringify(payload),
    tool_name: "capture_screen_text",
  } satisfies Message;
}

export function createToolHandler({
  options,
  invoke,
  appendHistory,
  streamChat,
  requestIdRef,
  applyAssistantMessage,
}: ToolHandlerDeps) {
  const streamFollowup = async (
    baseMessages: Message[],
    toolCalls: NonNullable<Message["tool_calls"]>,
    toolMessage: Message,
    requestStartedAt: number,
  ) => {
    const followupMessages: Message[] = [
      ...baseMessages,
      { role: "assistant", content: "", tool_calls: toolCalls },
      toolMessage,
    ];

    const requestId = requestIdRef.current;
    const result = await streamChat(
      followupMessages,
      requestId,
      requestStartedAt,
    );
    if (!result || requestId !== requestIdRef.current) return;

    if (result.toolCalls && result.toolCalls.length > 0) {
      await handleToolCalls(result.toolCalls, followupMessages);
      return;
    }

    if (result.assistantMessage) {
      applyAssistantMessage(result);
    }
  };

  const handleToolCalls = async (
    toolCalls: NonNullable<Message["tool_calls"]>,
    baseMessages: Message[],
  ) => {
    const toolName =
      toolCalls.find((call) => call.function?.name)?.function?.name ?? "tool";
    const setToolUsage = options?.setToolUsage;
    setToolUsage?.({ inProgress: true, name: toolName });
    try {
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

      await streamFollowup(baseMessages, toolCalls, toolMessage, Date.now());
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

      await streamFollowup(baseMessages, toolCalls, toolMessage, Date.now());
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

    await streamFollowup(baseMessages, toolCalls, toolMessage, Date.now());
    return true;
    } finally {
      setToolUsage?.({
        inProgress: false,
        name: toolName,
        lastUsedAt: Date.now(),
      });
    }
  };

  return { handleToolCalls };
}
