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
  modelOverride?: string,
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
    tool_name: "capture_screen_image",
  } satisfies Message;
}

function formatToolName(name?: string) {
  if (!name) return "tool";
  return name.replace(/_/g, " ");
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
    extraMessages: Message[] = [],
  ) => {
    const followupMessages: Message[] = [
      ...baseMessages,
      { role: "assistant", content: "", tool_calls: toolCalls },
      toolMessage,
      ...extraMessages,
    ];

    const requestId = requestIdRef.current;
    const modelOverride =
      toolCalls.some((call) => call.function?.name === "capture_screen_image")
        ? options?.visionModel
        : undefined;
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
    const result = await streamChat(
      normalizedMessages,
      requestId,
      modelOverride,
    );
    if (!result || requestId !== requestIdRef.current) return;

    if (result.toolCalls && result.toolCalls.length > 0) {
      await handleToolCalls(result.toolCalls, normalizedMessages);
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
    options?.onToolActivity?.(`Using ${formatToolName(toolName)}.`);
    try {
      if (
        !toolCalls.some((call) => call.function?.name === "capture_screen_image")
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

        await streamFollowup(
          baseMessages,
          toolCalls,
          toolMessage,
          [],
        );
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

        await streamFollowup(
          baseMessages,
          toolCalls,
          toolMessage,
          [],
        );
        return true;
      }

      options.setCaptureInProgress?.(true);
      let toolResponse: unknown = null;
      try {
        await options.beforeCapture?.();
        toolResponse = await invoke("capture_screen_image");
      } catch (err) {
        throw new Error(toErrorMessage(err, "Screen capture failed."));
      } finally {
        await options.afterCapture?.();
        options.setCaptureInProgress?.(false);
      }

      const response =
        toolResponse &&
        typeof toolResponse === "object" &&
        "file_path" in toolResponse
          ? (toolResponse as {
              mime_type?: string;
              file_path?: string;
              source?: string;
              app_name?: string | null;
              resolution?: {
                width: number;
                height: number;
                scale_factor: number;
              };
            })
          : null;

      const toolMessage = buildToolMessage({
        source: response?.source,
        app_name: response?.app_name,
        resolution: response?.resolution,
        mime_type: response?.mime_type,
      });

      const extraMessages: Message[] = [];
      if (response?.file_path) {
        const label = response.app_name
          ? `Screenshot from ${response.app_name}.`
          : "Screenshot attached.";
        extraMessages.push({
          role: "user",
          content:
            `${label} Use the image to answer the user's last request. ` +
            "Respond in markdown. Do not include the screenshot in the response.",
          images: [response.file_path],
        } as Message);
      }

      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
        ...extraMessages,
      ]);

      await streamFollowup(
        baseMessages,
        toolCalls,
        toolMessage,
        extraMessages,
      );
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
