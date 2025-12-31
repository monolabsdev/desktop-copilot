import type { Message, Tool } from "ollama";
import type { ToolOptions } from "../hooks/ollama/types";
import { toErrorMessage } from "../hooks/ollama/utils";
import { ollamaChat } from "../ollama/client";
import { CAPTURE_SCREEN_IMAGE_TOOL } from "./captureScreenImage";
import { WEB_SEARCH_TOOL } from "./webSearch";

type InvokeFn = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

type CaptureResponse = {
  mime_type?: string;
  file_path?: string;
  source?: string;
  app_name?: string | null;
  resolution?: {
    width: number;
    height: number;
    scale_factor: number;
  };
  preview_base64?: string;
  preview_mime?: string;
};

const getLastUserMessage = (messages: Message[]) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") {
      const content = messages[i].content ?? "";
      return typeof content === "string" ? content.trim() : "";
    }
  }
  return "";
};

const toCaptureResponse = (payload: unknown): CaptureResponse | null => {
  if (!payload || typeof payload !== "object" || !("file_path" in payload)) {
    return null;
  }
  return payload as CaptureResponse;
};

const pushLocalScreenshot = (
  options: ToolOptions | undefined,
  response: CaptureResponse,
) => {
  if (!response.file_path || !options?.onLocalMessage) return;
  options.onLocalMessage({
    role: "assistant",
    content: "",
    imagePath: response.file_path,
    imageMime: response.mime_type,
    imagePreviewBase64: response.preview_base64,
    imagePreviewMime: response.preview_mime,
  });
};

export type ToolHandlerContext = {
  toolCall?: NonNullable<Message["tool_calls"]>[number];
  toolCalls: NonNullable<Message["tool_calls"]>;
  baseMessages: Message[];
  options?: ToolOptions;
  invoke: InvokeFn;
  appendHistory: (entries: Message[]) => void;
  streamFollowup: (
    baseMessages: Message[],
    toolCalls: NonNullable<Message["tool_calls"]>,
    toolMessage: Message,
    extraMessages?: Message[],
  ) => Promise<void>;
  buildToolMessage: (toolName: string, payload: unknown) => Message;
};

// Register tools here so they automatically appear in the UI and tool routing.
// Add a tool by:
// 1) Create a Tool schema in src/overlay/tools/...
// 2) Add a RegisteredTool entry below with handler + labels.
// 3) Gate it with config via isEnabled (e.g. options.webSearchEnabled).
// No other UI wiring is needed.
export type RegisteredTool = {
  name: string;
  tool: Tool;
  displayName?: string;
  activityLabel?: string;
  activityShimmer?: boolean;
  completedLabel?: string;
  preferences?: {
    label?: string;
    description?: string;
    defaultEnabled?: boolean;
    showInPreferences?: boolean;
    requiresWebSearchKey?: boolean;
    statuses?: Array<"experimental" | "beta" | "preview" | "limited">;
  };
  isEnabled?: (options?: ToolOptions) => boolean;
  handler: (context: ToolHandlerContext) => Promise<boolean>;
};

const CAPTURE_TOOL_NAME = "capture_screen_image";
const WEB_SEARCH_TOOL_NAME = "web_search";

const getToolToggle = (name: string, options?: ToolOptions) => {
  if (!options?.toolToggles) return undefined;
  return options.toolToggles[name];
};

export const isToolEnabled = (name: string, options?: ToolOptions) => {
  if (!options?.toolsEnabled) return false;
  const toggleValue = getToolToggle(name, options);
  if (typeof toggleValue === "boolean") return toggleValue;
  if (name === CAPTURE_TOOL_NAME) return !!options?.captureToolEnabled;
  if (name === WEB_SEARCH_TOOL_NAME) return !!options?.webSearchEnabled;
  return true;
};

const captureTool: RegisteredTool = {
  name: CAPTURE_TOOL_NAME,
  tool: CAPTURE_SCREEN_IMAGE_TOOL,
  displayName: "screen capture",
  preferences: {
    label: "Screen capture",
    description: "Allow the assistant to request a screenshot with consent.",
    defaultEnabled: true,
    showInPreferences: true,
  },
  activityLabel: "Capturing screen...",
  completedLabel: "Captured screen.",
  isEnabled: (options) =>
    isToolEnabled(CAPTURE_TOOL_NAME, options) &&
    typeof options?.requestScreenCapture === "function",
  handler: async ({
    toolCalls,
    baseMessages,
    options,
    invoke,
    appendHistory,
    streamFollowup,
    buildToolMessage,
  }) => {
    if (
      !isToolEnabled(CAPTURE_TOOL_NAME, options) ||
      !options?.requestScreenCapture
    ) {
      const toolMessage = buildToolMessage(CAPTURE_TOOL_NAME, {
        error: "Screen capture tool is disabled.",
      });
      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);
      await streamFollowup(baseMessages, toolCalls, toolMessage, []);
      return true;
    }

    const consent = await options.requestScreenCapture();
    if (!consent.approved) {
      const toolMessage = buildToolMessage(CAPTURE_TOOL_NAME, {
        error: "User declined screen capture.",
      });
      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);
      await streamFollowup(baseMessages, toolCalls, toolMessage, []);
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

    const response = toCaptureResponse(toolResponse);

    const toolPayload: Record<string, unknown> = {
      source: response?.source,
      app_name: response?.app_name,
      resolution: response?.resolution,
      mime_type: response?.mime_type,
    };

    if (response) {
      pushLocalScreenshot(options, response);
    }

    const extraMessages: Message[] = [];
    if (response?.file_path) {
      const lastUserMessage = getLastUserMessage(baseMessages);
      let summary = "";
      if (options?.visionModel) {
        const prompt = lastUserMessage
          ? `Summarize the screenshot with details relevant to the user's request: "${lastUserMessage}".`
          : "Summarize the screenshot with details relevant to the user's request.";
        try {
          const visionResponse = await ollamaChat({
            model: options.visionModel,
            messages: [
              {
                role: "user",
                content: prompt,
                images: [response.file_path],
              } as Message,
            ],
          });
          summary =
            typeof visionResponse?.message?.content === "string"
              ? visionResponse.message.content.trim()
              : "";
        } catch {
          summary = "";
        }
      }

      if (summary) {
        toolPayload.summary = summary;
      } else {
        const label = response.app_name
          ? `Screenshot from ${response.app_name}.`
          : "Screenshot attached.";
        extraMessages.push({
          role: "user",
          content:
            `${label} Use the image to answer the user's last request. ` +
            "Respond in markdown. Do not include the screenshot in the response. " +
            "The user already has the screenshot.",
          images: [response.file_path],
        } as Message);
      }
    }

    const toolMessage = buildToolMessage(CAPTURE_TOOL_NAME, toolPayload);

    appendHistory([
      { role: "assistant", content: "", tool_calls: toolCalls },
      toolMessage,
      ...extraMessages,
    ]);

    await streamFollowup(baseMessages, toolCalls, toolMessage, extraMessages);
    return true;
  },
};

const webSearchTool: RegisteredTool = {
  name: WEB_SEARCH_TOOL_NAME,
  tool: WEB_SEARCH_TOOL,
  displayName: "web search",
  preferences: {
    label: "Web search",
    description: "Let the assistant search the web for fresh information.",
    defaultEnabled: false,
    showInPreferences: true,
    requiresWebSearchKey: true,
    statuses: ["beta"],
  },
  activityLabel: "Searching the web...",
  completedLabel: "Searched the web.",
  activityShimmer: true,
  isEnabled: (options) => isToolEnabled(WEB_SEARCH_TOOL_NAME, options),
  handler: async ({
    toolCall,
    toolCalls,
    baseMessages,
    options,
    invoke,
    appendHistory,
    streamFollowup,
    buildToolMessage,
  }) => {
    if (!isToolEnabled(WEB_SEARCH_TOOL_NAME, options)) {
      const toolMessage = buildToolMessage(WEB_SEARCH_TOOL_NAME, {
        error: "Web search tool is disabled.",
      });
      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);
      await streamFollowup(baseMessages, toolCalls, toolMessage, []);
      return true;
    }

    const args = toolCall?.function?.arguments ?? {};
    const query = typeof args.query === "string" ? args.query.trim() : "";
    const maxResults =
      typeof args.max_results === "number"
        ? args.max_results
        : typeof args.maxResults === "number"
          ? args.maxResults
          : undefined;

    if (!query) {
      const toolMessage = buildToolMessage(WEB_SEARCH_TOOL_NAME, {
        error: "Query is required for web search.",
      });
      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);
      await streamFollowup(baseMessages, toolCalls, toolMessage, []);
      return true;
    }

    let webResponse: unknown = null;
    try {
      webResponse = await invoke("ollama_web_search", {
        query,
        max_results: maxResults,
      });
    } catch (err) {
      throw new Error(toErrorMessage(err, "Web search failed."));
    }

    const results =
      webResponse && typeof webResponse === "object" && "results" in webResponse
        ? (webResponse as { results: unknown }).results
        : webResponse;
    const toolMessage = buildToolMessage(WEB_SEARCH_TOOL_NAME, {
      query,
      results,
    });

    appendHistory([
      { role: "assistant", content: "", tool_calls: toolCalls },
      toolMessage,
    ]);

    await streamFollowup(baseMessages, toolCalls, toolMessage, []);
    return true;
  },
};

export const TOOL_REGISTRY: RegisteredTool[] = [captureTool, webSearchTool];

export function getToolDefinition(name?: string) {
  if (!name) return undefined;
  return TOOL_REGISTRY.find((tool) => tool.name === name);
}

export function getToolConfig(options?: ToolOptions) {
  if (!options?.toolsEnabled) return undefined;
  const tools = TOOL_REGISTRY.filter(
    (tool) =>
      isToolEnabled(tool.name, options) &&
      (tool.isEnabled ? tool.isEnabled(options) : true),
  ).map((tool) => tool.tool);
  return tools.length ? tools : undefined;
}

export function getToolDisplayName(name?: string) {
  const tool = getToolDefinition(name);
  if (tool?.displayName) return tool.displayName;
  if (!name) return "tool";
  return name.replace(/_/g, " ");
}

export function getToolActivityLabel(name?: string) {
  const tool = getToolDefinition(name);
  if (tool?.activityLabel) return tool.activityLabel;
  if (!name) return "Using tool.";
  return `Using ${name.replace(/_/g, " ")}.`;
}

export function getToolCompletedLabel(name?: string) {
  const tool = getToolDefinition(name);
  if (tool?.completedLabel) return tool.completedLabel;
  if (!name) return "Tool complete.";
  return `Used ${name.replace(/_/g, " ")}.`;
}

export function getToolActivityShimmer(name?: string) {
  return !!getToolDefinition(name)?.activityShimmer;
}

export function isToolActivityShimmer(activity?: string | null) {
  if (!activity) return false;
  return TOOL_REGISTRY.some(
    (tool) => tool.activityShimmer && tool.activityLabel === activity,
  );
}

export function getToolActivityReplacement(activity: string) {
  const tool = TOOL_REGISTRY.find(
    (entry) =>
      entry.completedLabel === activity && entry.activityLabel !== undefined,
  );
  if (!tool || !tool.activityLabel) return null;
  return { from: tool.activityLabel, to: activity };
}
