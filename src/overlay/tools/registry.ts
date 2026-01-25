import type { Message, Tool } from "ollama";
import type { LucideIcon } from "lucide-react";
import type { ToolOptions } from "../hooks/ollama/types";
import { toErrorMessage } from "../hooks/ollama/utils";
import { ollamaChat } from "../ollama/client";
import { CAPTURE_SCREEN_IMAGE_TOOL } from "./captureScreenImage";
import {
  CLIPBOARD_CONTEXT_TOOL,
  CLIPBOARD_CONTEXT_TOOL_NAME,
} from "./clipboardContext";
import { LIST_PROJECT_FILES_TOOL, LIST_PROJECT_FILES_TOOL_NAME } from "./listProjectFiles";
import { READ_FILE_TOOL, READ_FILE_TOOL_NAME } from "./readFile";
import { SEARCH_IN_FILES_TOOL, SEARCH_IN_FILES_TOOL_NAME } from "./searchInFiles";
import { WRITE_FILE_TOOL, WRITE_FILE_TOOL_NAME } from "./writeFile";
import { WEB_SEARCH_TOOL } from "./webSearch";
import {
  ClipboardIcon,
  FilePenLineIcon,
  GlobeIcon,
  MonitorIcon,
} from "lucide-react";

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
// 1) Copy src/overlay/tools/toolTemplate.ts and define your schema + name.
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
  icon?: LucideIcon;
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

// Example handler skeleton:
// const exampleTool: RegisteredTool = {
//   name: EXAMPLE_TOOL_NAME,
//   tool: EXAMPLE_TOOL_SCHEMA,
//   displayName: "example tool",
//   activityLabel: "Running example tool...",
//   completedLabel: "Example tool done.",
//   preferences: {
//     label: "Example tool",
//     description: "Describe what this tool does.",
//     defaultEnabled: true,
//     showInPreferences: true,
//   },
//   isEnabled: (options) => isToolEnabled(EXAMPLE_TOOL_NAME, options),
//   handler: async ({ toolCalls, toolCall, buildToolMessage, streamFollowup }) => {
//     const args = toolCall?.function?.arguments ?? {};
//     const result = { ok: true, args };
//     const toolMessage = buildToolMessage(EXAMPLE_TOOL_NAME, result);
//     await streamFollowup([], toolCalls, toolMessage, []);
//     return true;
//   },
// };

const CAPTURE_TOOL_NAME = "capture_screen_image";
const CLIPBOARD_TOOL_NAME = CLIPBOARD_CONTEXT_TOOL_NAME;
const WEB_SEARCH_TOOL_NAME = "web_search";
const WRITE_TOOL_NAME = WRITE_FILE_TOOL_NAME;
const READ_TOOL_NAME = READ_FILE_TOOL_NAME;
const LIST_FILES_TOOL_NAME = LIST_PROJECT_FILES_TOOL_NAME;
const SEARCH_TOOL_NAME = SEARCH_IN_FILES_TOOL_NAME;
const DEFAULT_CLIPBOARD_MAX_CHARS = 4000;
const MAX_CLIPBOARD_MAX_CHARS = 20000;

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
  const tool = getToolDefinition(name);
  if (tool?.preferences && "defaultEnabled" in tool.preferences) {
    return tool.preferences.defaultEnabled ?? true;
  }
  return true;
};

const captureTool: RegisteredTool = {
  name: CAPTURE_TOOL_NAME,
  tool: CAPTURE_SCREEN_IMAGE_TOOL,
  displayName: "screen capture",
  icon: MonitorIcon,
  preferences: {
    label: "Screen capture",
    description: "Allow the assistant to request a screenshot with consent.",
    defaultEnabled: true,
    showInPreferences: true,
  },
  activityLabel: "Capturing screen...",
  completedLabel: "Captured screen.",
  activityShimmer: true,
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

const getMaxClipboardChars = (args: unknown) => {
  if (!args || typeof args !== "object") return DEFAULT_CLIPBOARD_MAX_CHARS;
  const raw =
    "max_chars" in args
      ? (args as { max_chars?: unknown }).max_chars
      : undefined;
  if (typeof raw !== "number" || Number.isNaN(raw)) {
    return DEFAULT_CLIPBOARD_MAX_CHARS;
  }
  return Math.min(MAX_CLIPBOARD_MAX_CHARS, Math.max(1, Math.floor(raw)));
};

const clipboardTool: RegisteredTool = {
  name: CLIPBOARD_TOOL_NAME,
  tool: CLIPBOARD_CONTEXT_TOOL,
  displayName: "clipboard context",
  icon: ClipboardIcon,
  preferences: {
    label: "Clipboard context",
    description: "Let the assistant read clipboard text when relevant.",
    defaultEnabled: true,
    showInPreferences: true,
    statuses: ["preview"],
  },
  activityLabel: "Reading clipboard...",
  completedLabel: "Read clipboard.",
  isEnabled: (options) => isToolEnabled(CLIPBOARD_TOOL_NAME, options),
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
    if (!isToolEnabled(CLIPBOARD_TOOL_NAME, options)) {
      const toolMessage = buildToolMessage(CLIPBOARD_TOOL_NAME, {
        error: "Clipboard tool is disabled.",
      });
      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);
      await streamFollowup(baseMessages, toolCalls, toolMessage, []);
      return true;
    }

    const args = toolCall?.function?.arguments ?? {};
    const maxChars = getMaxClipboardChars(args);
    let clipboardResponse: unknown = null;
    try {
      clipboardResponse = await invoke("read_clipboard_text", {
        max_chars: maxChars,
      });
    } catch (err) {
      throw new Error(toErrorMessage(err, "Clipboard read failed."));
    }

    const payload =
      clipboardResponse && typeof clipboardResponse === "object"
        ? clipboardResponse
        : { text: "", truncated: false };
    const toolMessage = buildToolMessage(CLIPBOARD_TOOL_NAME, payload);

    appendHistory([
      { role: "assistant", content: "", tool_calls: toolCalls },
      toolMessage,
    ]);

    await streamFollowup(baseMessages, toolCalls, toolMessage, []);
    return true;
  },
};

void clipboardTool; // keep defined so it can be re-enabled without redefining the handler.

const listProjectFilesTool: RegisteredTool = {
  name: LIST_FILES_TOOL_NAME,
  tool: LIST_PROJECT_FILES_TOOL,
  displayName: "list project files",
  preferences: {
    label: "Project file listing",
    description: "Let the assistant list files to locate where to edit.",
    defaultEnabled: true,
    showInPreferences: true,
    statuses: ["preview"],
  },
  activityLabel: "Listing project files...",
  completedLabel: "Listed project files.",
  activityShimmer: true,
  isEnabled: (options) => isToolEnabled(LIST_FILES_TOOL_NAME, options),
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
    if (!isToolEnabled(LIST_FILES_TOOL_NAME, options)) {
      const toolMessage = buildToolMessage(LIST_FILES_TOOL_NAME, {
        error: "Project file listing is disabled.",
      });
      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);
      await streamFollowup(baseMessages, toolCalls, toolMessage, []);
      return true;
    }

    const args = toolCall?.function?.arguments ?? {};
    const root = typeof args.root === "string" ? args.root.trim() : undefined;
    const maxFiles =
      typeof args.max_files === "number"
        ? args.max_files
        : typeof args.maxFiles === "number"
          ? args.maxFiles
          : undefined;

    let listResponse: unknown = null;
    try {
      listResponse = await invoke("list_project_files", {
        root,
        max_files: maxFiles,
      });
    } catch (err) {
      throw new Error(toErrorMessage(err, "Project file listing failed."));
    }

    const toolPayload =
      listResponse && typeof listResponse === "object"
        ? listResponse
        : { root, files: [] };
    const toolMessage = buildToolMessage(LIST_FILES_TOOL_NAME, toolPayload);

    appendHistory([
      { role: "assistant", content: "", tool_calls: toolCalls },
      toolMessage,
    ]);

    await streamFollowup(baseMessages, toolCalls, toolMessage, []);
    return true;
  },
};

const readFileTool: RegisteredTool = {
  name: READ_TOOL_NAME,
  tool: READ_FILE_TOOL,
  displayName: "read file",
  preferences: {
    label: "Read file",
    description: "Let the assistant read small text files for context.",
    defaultEnabled: true,
    showInPreferences: true,
  },
  activityLabel: "Reading file...",
  completedLabel: "Read file.",
  activityShimmer: true,
  isEnabled: (options) => isToolEnabled(READ_TOOL_NAME, options),
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
    if (!isToolEnabled(READ_TOOL_NAME, options)) {
      const toolMessage = buildToolMessage(READ_TOOL_NAME, {
        error: "Read file tool is disabled.",
      });
      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);
      await streamFollowup(baseMessages, toolCalls, toolMessage, []);
      return true;
    }

    const args = toolCall?.function?.arguments ?? {};
    const path = typeof args.path === "string" ? args.path.trim() : "";
    if (!path) {
      const toolMessage = buildToolMessage(READ_TOOL_NAME, {
        error: "Path is required.",
      });
      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);
      await streamFollowup(baseMessages, toolCalls, toolMessage, []);
      return true;
    }

    let readResponse: unknown = null;
    try {
      readResponse = await invoke("read_file", { path });
    } catch (err) {
      throw new Error(toErrorMessage(err, "Read file failed."));
    }

    const toolPayload =
      readResponse && typeof readResponse === "object"
        ? readResponse
        : { path, content: "" };
    const toolMessage = buildToolMessage(READ_TOOL_NAME, toolPayload);

    appendHistory([
      { role: "assistant", content: "", tool_calls: toolCalls },
      toolMessage,
    ]);

    await streamFollowup(baseMessages, toolCalls, toolMessage, []);
    return true;
  },
};

const searchInFilesTool: RegisteredTool = {
  name: SEARCH_TOOL_NAME,
  tool: SEARCH_IN_FILES_TOOL,
  displayName: "search in files",
  preferences: {
    label: "Search in files",
    description: "Let the assistant search across files to find relevant code.",
    defaultEnabled: true,
    showInPreferences: true,
    statuses: ["preview"],
  },
  activityLabel: "Searching files...",
  completedLabel: "Searched files.",
  activityShimmer: true,
  isEnabled: (options) => isToolEnabled(SEARCH_TOOL_NAME, options),
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
    if (!isToolEnabled(SEARCH_TOOL_NAME, options)) {
      const toolMessage = buildToolMessage(SEARCH_TOOL_NAME, {
        error: "Search tool is disabled.",
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
    const root = typeof args.root === "string" ? args.root.trim() : undefined;
    const maxResults =
      typeof args.max_results === "number"
        ? args.max_results
        : typeof args.maxResults === "number"
          ? args.maxResults
          : undefined;
    const caseInsensitive =
      typeof args.case_insensitive === "boolean"
        ? args.case_insensitive
        : typeof args.caseInsensitive === "boolean"
          ? args.caseInsensitive
          : false;

    if (!query) {
      const toolMessage = buildToolMessage(SEARCH_TOOL_NAME, {
        error: "Query is required.",
      });
      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);
      await streamFollowup(baseMessages, toolCalls, toolMessage, []);
      return true;
    }

    let searchResponse: unknown = null;
    try {
      searchResponse = await invoke("search_in_files", {
        query,
        root,
        max_results: maxResults,
        case_insensitive: caseInsensitive,
      });
    } catch (err) {
      throw new Error(toErrorMessage(err, "Search failed."));
    }

    const toolPayload =
      searchResponse && typeof searchResponse === "object"
        ? searchResponse
        : { query, matches: [] };
    const toolMessage = buildToolMessage(SEARCH_TOOL_NAME, toolPayload);

    appendHistory([
      { role: "assistant", content: "", tool_calls: toolCalls },
      toolMessage,
    ]);

    await streamFollowup(baseMessages, toolCalls, toolMessage, []);
    return true;
  },
};

const writeFileTool: RegisteredTool = {
  name: WRITE_TOOL_NAME,
  tool: WRITE_FILE_TOOL,
  displayName: "write file",
  icon: FilePenLineIcon,
  preferences: {
    label: "Write file",
    description: "Allow the assistant to write files on disk.",
    defaultEnabled: false,
    showInPreferences: true,
    statuses: ["experimental"],
  },
  activityLabel: "Writing file...",
  completedLabel: "Wrote file.",
  activityShimmer: true,
  isEnabled: (options) => isToolEnabled(WRITE_TOOL_NAME, options),
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
    if (!isToolEnabled(WRITE_TOOL_NAME, options)) {
      const toolMessage = buildToolMessage(WRITE_TOOL_NAME, {
        error: "Write file tool is disabled.",
      });
      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);
      await streamFollowup(baseMessages, toolCalls, toolMessage, []);
      return true;
    }

    const args = toolCall?.function?.arguments ?? {};
    const path = typeof args.path === "string" ? args.path.trim() : "";
    const content = typeof args.content === "string" ? args.content : "";
    const append = typeof args.append === "boolean" ? args.append : false;
    const createDirs =
      typeof args.create_dirs === "boolean" ? args.create_dirs : true;

    if (!path) {
      const toolMessage = buildToolMessage(WRITE_TOOL_NAME, {
        error: "Path is required.",
      });
      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);
      await streamFollowup(baseMessages, toolCalls, toolMessage, []);
      return true;
    }

    let writeResponse: unknown = null;
    try {
      writeResponse = await invoke("write_file", {
        path,
        content,
        append,
        create_dirs: createDirs,
      });
    } catch (err) {
      throw new Error(toErrorMessage(err, "Write file failed."));
    }

    const toolPayload =
      writeResponse && typeof writeResponse === "object"
        ? writeResponse
        : { path, bytes: content.length, appended: append };
    const toolMessage = buildToolMessage(WRITE_TOOL_NAME, toolPayload);

    appendHistory([
      { role: "assistant", content: "", tool_calls: toolCalls },
      toolMessage,
    ]);

    await streamFollowup(baseMessages, toolCalls, toolMessage, []);
    return true;
  },
};

const webSearchTool: RegisteredTool = {
  name: WEB_SEARCH_TOOL_NAME,
  tool: WEB_SEARCH_TOOL,
  displayName: "web search",
  icon: GlobeIcon,
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

export const TOOL_REGISTRY: RegisteredTool[] = [
  captureTool,
  listProjectFilesTool,
  readFileTool,
  searchInFilesTool,
  writeFileTool,
  // Clipboard tool intentionally not registered; uncomment to enable.
  // clipboardTool,
  webSearchTool,
];

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

export function getToolIconByActivity(activity?: string | null) {
  if (!activity) return undefined;
  return TOOL_REGISTRY.find((tool) => {
    const activityLabel = tool.activityLabel ?? getToolActivityLabel(tool.name);
    const completedLabel =
      tool.completedLabel ?? getToolCompletedLabel(tool.name);
    return activity === activityLabel || activity === completedLabel;
  })?.icon;
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

export function getToolCompletionForActivity(activity: string) {
  const tool = TOOL_REGISTRY.find(
    (entry) => (entry.activityLabel ?? getToolActivityLabel(entry.name)) === activity,
  );
  if (!tool) return activity;
  return tool.completedLabel ?? getToolCompletedLabel(tool.name);
}
