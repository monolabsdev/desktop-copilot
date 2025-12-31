import type { MutableRefObject } from "react";
import type { Message } from "ollama";
import type { StreamResult, ToolOptions } from "./types";
import {
  getToolActivityLabel,
  getToolCompletedLabel,
  getToolDefinition,
} from "../../tools/registry";

type InvokeFn = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

type StreamChat = (
  baseMessages: Message[],
  requestId: number,
  modelOverride?: string,
  reuseStreamId?: number,
) => Promise<StreamResult | null>;

type ApplyAssistantMessage = (result: StreamResult) => void;

type ToolHandlerDeps = {
  options?: ToolOptions;
  invoke: InvokeFn;
  appendHistory: (entries: Message[]) => void;
  streamChat: StreamChat;
  requestIdRef: MutableRefObject<number>;
  applyAssistantMessage: ApplyAssistantMessage;
  getPendingToolMessageId?: () => number | null;
};

function buildToolMessage(toolName: string, payload: unknown): Message {
  return {
    role: "tool",
    content: JSON.stringify(payload),
    tool_name: toolName,
  } satisfies Message;
}

export function createToolHandler({
  options,
  invoke,
  appendHistory,
  streamChat,
  requestIdRef,
  applyAssistantMessage,
  getPendingToolMessageId,
}: ToolHandlerDeps) {
  const streamFollowup = async (
    baseMessages: Message[],
    toolCalls: NonNullable<Message["tool_calls"]>,
    toolMessage: Message,
    extraMessages: Message[] = [],
  ) => {
    const followupMessages: Message[] = [
      ...baseMessages,
      { role: "assistant", content: "", tool_calls: toolCalls },
      toolMessage,
      ...extraMessages,
    ];

    const requestId = requestIdRef.current;
    const hasImages = extraMessages.some((message) => {
      const withImages = message as Message & { images?: string[] };
      return !!withImages.images?.length;
    });
    const modelOverride = hasImages ? options?.visionModel : undefined;
    const normalizedMessages = followupMessages.map((message, index) => {       
      const withImages = message as Message & { images?: string[] };
      if (!withImages.images || withImages.images.length === 0) {
        return message;
      }
      const isLatest = index === followupMessages.length - 1;
      if (isLatest) return message;
      const { images: _images, ...rest } = withImages;
      return {
        ...rest,
        content: rest.content ?? "",
      } as Message;
    });
    const reuseStreamId = getPendingToolMessageId?.() ?? undefined;
    const result = await streamChat(
      normalizedMessages,
      requestId,
      modelOverride,
      reuseStreamId,
    );
    if (!result || requestId !== requestIdRef.current) return;

    if (result.toolCalls && result.toolCalls.length > 0) {
      await handleToolCalls(result.toolCalls, normalizedMessages);
      return;
    }

    if (result.assistantMessage) {
      const completedTool = toolCalls.find((call) => call.function?.name);
      const completedToolName = completedTool?.function?.name ?? "tool";
      options?.onToolActivity?.(getToolCompletedLabel(completedToolName));
      applyAssistantMessage(result);
    }
  };

  const handleToolCalls = async (
    toolCalls: NonNullable<Message["tool_calls"]>,
    baseMessages: Message[],
  ) => {
    const toolCall = toolCalls.find((call) => call.function?.name);
    const toolName = toolCall?.function?.name ?? "tool";
    const toolDefinition = getToolDefinition(toolName);
    const setToolUsage = options?.setToolUsage;
    setToolUsage?.({ inProgress: true, name: toolName });
    options?.onToolActivity?.(getToolActivityLabel(toolName));
    try {
      if (!toolDefinition) {
        throw new Error("Unsupported tool call.");
      }

      const handled = await toolDefinition.handler({
        toolCall,
        toolCalls,
        baseMessages,
        options,
        invoke,
        appendHistory,
        streamFollowup,
        buildToolMessage,
      });
      return handled;
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
