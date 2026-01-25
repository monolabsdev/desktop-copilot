import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Agent,
  Runner,
  tool,
  user,
  assistant,
} from "@openai/agents";
import { OpenAIProvider } from "@openai/agents";
import OpenAI from "openai";
import type { Message } from "ollama";

import { DEFAULT_MODEL, VISION_MODEL } from "../constants";
import { ollamaChat } from "../ollama/client";
import type { ChatMessage, ToolOptions, ToolUsage } from "./ollama/types";
import { toErrorMessage } from "./ollama/utils";
import { appendScreenshotMessage } from "./ollama/screenshot";
import {
  getToolActivityLabel,
  getToolActivityReplacement,
  getToolCompletedLabel,
  isToolEnabled,
  TOOL_REGISTRY,
} from "../tools/registry";
import { CLIPBOARD_CONTEXT_TOOL_NAME } from "../tools/clipboardContext";
import { LIST_PROJECT_FILES_TOOL_NAME } from "../tools/listProjectFiles";
import { READ_FILE_TOOL_NAME } from "../tools/readFile";
import { SEARCH_IN_FILES_TOOL_NAME } from "../tools/searchInFiles";
import { WRITE_FILE_TOOL_NAME } from "../tools/writeFile";

type UseAgentsSdkOptions = ToolOptions & {
  model?: string;
};

type AgentInputItem = ReturnType<typeof user>;
type AgentsRunner = {
  run: (
    agent: unknown,
    inputItems: AgentInputItem[],
    options: { stream: boolean; signal?: AbortSignal },
  ) => Promise<{
    toTextStream: () => ReadableStream<string>;
    completed: Promise<unknown>;
  }>;
};

const AGENT_INSTRUCTIONS =
  "You are a fast, minimal desktop assistant. " +
  "Keep answers concise, structured, and actionable. " +
  "When editing code, locate relevant files with list/search/read tools before writing. " +
  "Use the screenshot tool only when it helps answer the user's request. " +
  "Never send the screenshot back to the user; they already have it.";

const OLLAMA_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_CLIPBOARD_MAX_CHARS = 4000;
const MIN_CLIPBOARD_CHARS = 24;
const CLIPBOARD_CONTEXT_LABEL = "Clipboard context";

export function useAgentsSdkChat(options?: UseAgentsSdkOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolUsage, setToolUsage] = useState<ToolUsage>({
    inProgress: false,
  });
  const toolsEnabled = options?.toolsEnabled ?? false;
  const requestIdRef = useRef(0);
  const streamMessageIdRef = useRef(0);
  const activeStreamIdRef = useRef<number | null>(null);
  const pendingToolMessageIdRef = useRef<number | null>(null);
  const historyRef = useRef<AgentInputItem[]>([]);
  const toolActivityRef = useRef<string[] | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const runnerRef = useRef<AgentsRunner | null>(null);
  const agentRef = useRef<unknown | null>(null);
  const agentConfigRef = useRef({
    model: options?.model ?? DEFAULT_MODEL,
    toolsEnabled,
    visionModel: options?.visionModel ?? VISION_MODEL,
  });
  const maxTurns = 25;

  const appendLocalScreenshot = (
    filePath: string,
    mimeType?: string,
    previewBase64?: string,
    previewMime?: string,
  ) => {
    const message: ChatMessage = {
      role: "assistant",
      content: "",
      imagePath: filePath,
      imageMime: mimeType,
      imagePreviewBase64: previewBase64,
      imagePreviewMime: previewMime,
    };
    setMessages((prev) => appendScreenshotMessage(prev, message));
    toolActivityRef.current = undefined;
  };
  const setToolActivities = (next: string[]) => {
    const unique = Array.from(new Set(next));
    toolActivityRef.current = unique;
    setMessages((prev) => {
      const targetId =
        activeStreamIdRef.current ?? pendingToolMessageIdRef.current;
      if (targetId !== null) {
        return prev.map((message) =>
          message.streamId === targetId
            ? { ...message, toolActivity: unique }
            : message,
        );
      }
      const nextId = streamMessageIdRef.current + 1;
      pendingToolMessageIdRef.current = nextId;
      return [
        ...prev,
        {
          role: "assistant",
          content: "",
          streamId: nextId,
          toolActivity: unique,
        },
      ];
    });
  };

  const pushToolActivity = (activity: string) => {
    const current = toolActivityRef.current ?? [];
    const replacement = getToolActivityReplacement(activity);
    let next: string[] = current;
    if (replacement && current.length > 0) {
      next = current.map((entry) =>
        entry === replacement.from ? replacement.to : entry,
      );
    } else if (!current.includes(activity)) {
      next = [...current, activity];
    }
    if (next === current) return;
    setToolActivities(next);
  };

  const completeToolActivity = (toolName: string) => {
    const current = toolActivityRef.current ?? [];
    const activity = getToolActivityLabel(toolName);
    const completed = getToolCompletedLabel(toolName);
    const withoutActivity = current.filter((entry) => entry !== activity);
    const next = withoutActivity.includes(completed)
      ? withoutActivity
      : [...withoutActivity, completed];
    setToolActivities(next);
  };

  const finalizeToolActivities = (activities?: string[]) => {
    if (!activities || activities.length === 0) return activities;
    const next = activities.map((entry) => {
      const tool = TOOL_REGISTRY.find((item) => {
        const label = item.activityLabel ?? getToolActivityLabel(item.name);
        return label === entry;
      });
      if (!tool) return entry;
      return tool.completedLabel ?? getToolCompletedLabel(tool.name);
    });
    return Array.from(new Set(next));
  };

  const ensureAgent = () => {
    const nextConfig = {
      model: options?.model ?? DEFAULT_MODEL,
      toolsEnabled,
      visionModel: options?.visionModel ?? VISION_MODEL,
    };
    const configChanged =
      agentConfigRef.current.model !== nextConfig.model ||
      agentConfigRef.current.toolsEnabled !== nextConfig.toolsEnabled ||
      agentConfigRef.current.visionModel !== nextConfig.visionModel;
    if (agentRef.current && runnerRef.current && !configChanged) return;
    const client = new OpenAI({
      apiKey: "ollama",
      baseURL: OLLAMA_BASE_URL,
      dangerouslyAllowBrowser: true,
    });
    const provider = new OpenAIProvider({
      openAIClient: client,
      useResponses: false,
    });
    runnerRef.current = new Runner({ modelProvider: provider });
    const captureTool = tool({
      name: "capture_screen_image",
      description: "Capture a screenshot for visual analysis when needed.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      strict: false,
      execute: async () => {
        const captureEnabled =
          isToolEnabled("capture_screen_image", options) &&
          !!options?.requestScreenCapture;
        const requestScreenCapture = options?.requestScreenCapture;
        if (!captureEnabled || !requestScreenCapture) {
          return "Screen capture tool is disabled.";
        }
        const activity = getToolActivityLabel("capture_screen_image");
        toolActivityRef.current = toolActivityRef.current
          ? [...toolActivityRef.current, activity]
          : [activity];
        setToolUsage({ inProgress: true, name: "capture_screen_image" });
        try {
          const consent = await requestScreenCapture();
          if (!consent.approved) {
            return "User declined screen capture.";
          }
          options.setCaptureInProgress?.(true);
          let toolResponse: unknown = null;
          try {
            await options.beforeCapture?.();
            toolResponse = await invoke("capture_screen_image");
          } finally {
            await options.afterCapture?.();
            options.setCaptureInProgress?.(false);
          }
          const response =
            toolResponse &&
            typeof toolResponse === "object" &&
            "file_path" in toolResponse
              ? (toolResponse as {
                  file_path?: string;
                  mime_type?: string;
                  preview_base64?: string;
                  preview_mime?: string;
                  app_name?: string | null;
                })
              : null;
          if (response?.file_path) {
            appendLocalScreenshot(
              response.file_path,
              response.mime_type,
              response.preview_base64,
              response.preview_mime,
            );
            const visionResponse = await ollamaChat({
              model: nextConfig.visionModel,
              messages: [
                {
                  role: "user",
                  content:
                    "Summarize the screenshot with details relevant to the user's request.",
                  images: [response.file_path],
                } as Message,
              ],
            });
            return (
              visionResponse?.message?.content ??
              "Unable to read the screenshot."
            );
          }
          return "Screenshot capture failed.";
        } finally {
          completeToolActivity("capture_screen_image");
          setToolUsage({
            inProgress: false,
            name: "capture_screen_image",
            lastUsedAt: Date.now(),
          });
        }
      },
    });
    const clipboardTool = tool({
      name: CLIPBOARD_CONTEXT_TOOL_NAME,
      description:
        "Read the user's clipboard text to provide extra context when relevant.",
      parameters: {
        type: "object",
        properties: {
          max_chars: {
            type: "number",
            description: "Maximum number of characters to read.",
          },
        },
        additionalProperties: false,
      },
      strict: false,
      execute: async (args?: { max_chars?: number }) => {
        if (!isToolEnabled(CLIPBOARD_CONTEXT_TOOL_NAME, options)) {
          return "Clipboard tool is disabled.";
        }
        const activity = getToolActivityLabel(CLIPBOARD_CONTEXT_TOOL_NAME);
        pushToolActivity(activity);
        setToolUsage({ inProgress: true, name: CLIPBOARD_CONTEXT_TOOL_NAME });
        try {
          const maxChars =
            typeof args?.max_chars === "number" ? args.max_chars : undefined;
          const response = await invoke<{
            text?: string;
            truncated?: boolean;
            length?: number;
          }>("read_clipboard_text", { max_chars: maxChars });
          if (!response?.text) {
            return "Clipboard is empty or not text.";
          }
          return response.text;
        } finally {
          completeToolActivity(CLIPBOARD_CONTEXT_TOOL_NAME);
          setToolUsage({
            inProgress: false,
            name: CLIPBOARD_CONTEXT_TOOL_NAME,
            lastUsedAt: Date.now(),
          });
        }
      },
    });
    const writeFileTool = tool({
      name: WRITE_FILE_TOOL_NAME,
      description:
        "Write text to a file on disk. Overwrites by default; set append=true to append.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute or project-relative file path to write.",
          },
          content: {
            type: "string",
            description: "Text content to write.",
          },
          append: {
            type: "boolean",
            description: "Append to the file instead of overwriting.",
          },
          create_dirs: {
            type: "boolean",
            description: "Create parent directories if needed.",
          },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
      strict: false,
      execute: async (args?: {
        path?: string;
        content?: string;
        append?: boolean;
        create_dirs?: boolean;
      }) => {
        if (!isToolEnabled(WRITE_FILE_TOOL_NAME, options)) {
          return "Write file tool is disabled.";
        }
        const path = typeof args?.path === "string" ? args.path.trim() : "";
        const content = typeof args?.content === "string" ? args.content : "";
        const append = typeof args?.append === "boolean" ? args.append : false;
        const createDirs =
          typeof args?.create_dirs === "boolean" ? args.create_dirs : true;
        if (!path) return "Path is required.";

        const activity = getToolActivityLabel(WRITE_FILE_TOOL_NAME);
        pushToolActivity(activity);
        setToolUsage({ inProgress: true, name: WRITE_FILE_TOOL_NAME });
        try {
          const response = await invoke("write_file", {
            path,
            content,
            append,
            create_dirs: createDirs,
          });
          return response ?? "Write complete.";
        } catch (err) {
          return toErrorMessage(err, "Write file failed.");
        } finally {
          completeToolActivity(WRITE_FILE_TOOL_NAME);
          setToolUsage({
            inProgress: false,
            name: WRITE_FILE_TOOL_NAME,
            lastUsedAt: Date.now(),
          });
        }
      },
    });
    const listProjectFilesTool = tool({
      name: LIST_PROJECT_FILES_TOOL_NAME,
      description:
        "List files under a project root so the assistant can choose where to read/write.",
      parameters: {
        type: "object",
        properties: {
          root: {
            type: "string",
            description:
              "Project root path. Defaults to the app working directory.",
          },
          max_files: {
            type: "number",
            description: "Max number of files to return.",
          },
        },
        additionalProperties: false,
      },
      strict: false,
      execute: async (args?: { root?: string; max_files?: number }) => {
        if (!isToolEnabled(LIST_PROJECT_FILES_TOOL_NAME, options)) {
          return "Project file listing is disabled.";
        }
        const root = typeof args?.root === "string" ? args.root.trim() : undefined;
        const maxFiles =
          typeof args?.max_files === "number" ? args.max_files : undefined;
        const activity = getToolActivityLabel(LIST_PROJECT_FILES_TOOL_NAME);
        pushToolActivity(activity);
        setToolUsage({ inProgress: true, name: LIST_PROJECT_FILES_TOOL_NAME });
        try {
          const response = await invoke("list_project_files", {
            root,
            max_files: maxFiles,
          });
          return response ?? "List complete.";
        } catch (err) {
          return toErrorMessage(err, "Project file listing failed.");
        } finally {
          completeToolActivity(LIST_PROJECT_FILES_TOOL_NAME);
          setToolUsage({
            inProgress: false,
            name: LIST_PROJECT_FILES_TOOL_NAME,
            lastUsedAt: Date.now(),
          });
        }
      },
    });
    const readFileTool = tool({
      name: READ_FILE_TOOL_NAME,
      description: "Read a small text file from disk for context.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute or project-relative file path to read.",
          },
        },
        required: ["path"],
        additionalProperties: false,
      },
      strict: false,
      execute: async (args?: { path?: string }) => {
        if (!isToolEnabled(READ_FILE_TOOL_NAME, options)) {
          return "Read file tool is disabled.";
        }
        const path = typeof args?.path === "string" ? args.path.trim() : "";
        if (!path) return "Path is required.";
        const activity = getToolActivityLabel(READ_FILE_TOOL_NAME);
        pushToolActivity(activity);
        setToolUsage({ inProgress: true, name: READ_FILE_TOOL_NAME });
        try {
          const response = await invoke("read_file", { path });
          return response ?? "Read complete.";
        } catch (err) {
          return toErrorMessage(err, "Read file failed.");
        } finally {
          completeToolActivity(READ_FILE_TOOL_NAME);
          setToolUsage({
            inProgress: false,
            name: READ_FILE_TOOL_NAME,
            lastUsedAt: Date.now(),
          });
        }
      },
    });
    const searchInFilesTool = tool({
      name: SEARCH_IN_FILES_TOOL_NAME,
      description: "Search for a string across project files.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Text to search for.",
          },
          root: {
            type: "string",
            description:
              "Project root path. Defaults to the app working directory.",
          },
          max_results: {
            type: "number",
            description: "Max number of matches to return.",
          },
          case_insensitive: {
            type: "boolean",
            description: "Use case-insensitive matching.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      strict: false,
      execute: async (args?: {
        query?: string;
        root?: string;
        max_results?: number;
        case_insensitive?: boolean;
      }) => {
        if (!isToolEnabled(SEARCH_IN_FILES_TOOL_NAME, options)) {
          return "Search tool is disabled.";
        }
        const query = typeof args?.query === "string" ? args.query.trim() : "";
        if (!query) return "Query is required.";
        const root = typeof args?.root === "string" ? args.root.trim() : undefined;
        const maxResults =
          typeof args?.max_results === "number" ? args.max_results : undefined;
        const caseInsensitive =
          typeof args?.case_insensitive === "boolean"
            ? args.case_insensitive
            : false;
        const activity = getToolActivityLabel(SEARCH_IN_FILES_TOOL_NAME);
        pushToolActivity(activity);
        setToolUsage({ inProgress: true, name: SEARCH_IN_FILES_TOOL_NAME });
        try {
          const response = await invoke("search_in_files", {
            query,
            root,
            max_results: maxResults,
            case_insensitive: caseInsensitive,
          });
          return response ?? "Search complete.";
        } catch (err) {
          return toErrorMessage(err, "Search failed.");
        } finally {
          completeToolActivity(SEARCH_IN_FILES_TOOL_NAME);
          setToolUsage({
            inProgress: false,
            name: SEARCH_IN_FILES_TOOL_NAME,
            lastUsedAt: Date.now(),
          });
        }
      },
    });
    const toolEntries = [
      { name: "capture_screen_image", tool: captureTool },
      { name: WRITE_FILE_TOOL_NAME, tool: writeFileTool },
      { name: LIST_PROJECT_FILES_TOOL_NAME, tool: listProjectFilesTool },
      { name: READ_FILE_TOOL_NAME, tool: readFileTool },
      { name: SEARCH_IN_FILES_TOOL_NAME, tool: searchInFilesTool },
      { name: CLIPBOARD_CONTEXT_TOOL_NAME, tool: clipboardTool },
    ];
    const agentTools = toolEntries
      .filter((entry) => isToolEnabled(entry.name, options))
      .map((entry) => entry.tool);
    agentRef.current = new Agent({
      name: "Overlay Assistant",
      instructions: AGENT_INSTRUCTIONS,
      model: nextConfig.model,
      tools: agentTools,
    });
    agentConfigRef.current = nextConfig;
  };

  const promptHasInlineContent = (message: string) => {
    if (message.includes("```")) return true;
    const lines = message.split("\n");
    if (lines.length > 3) return true;
    return message.length > 500;
  };

  const looksLikeCode = (text: string) => {
    const codeHints = [
      "function ",
      "class ",
      "const ",
      "let ",
      "var ",
      "import ",
      "export ",
      "#include",
      "=>",
      ";",
      "{",
      "}",
    ];
    if (text.includes("\n") && text.includes(";")) return true;
    return codeHints.some((hint) => text.includes(hint));
  };

  const shouldAutoUseClipboard = (prompt: string, clipboard: string) => {
    if (promptHasInlineContent(prompt)) return false;
    const normalized = prompt.toLowerCase();
    const explicitClipboard = /\bclipboard\b|\bpaste\b/.test(normalized);
    const requestSignals =
      /look at|review|check|analyz|explain|summariz|rewrite|refactor|optimi|fix|debug|error|exception|stack trace|traceback|log|bug|issue|problem/.test(
        normalized,
      );
    const mentionsCode =
      /\bcode\b|\bscript\b|\bfunction\b|\bclass\b|\bmodule\b|\bcomponent\b|\bfile\b/.test(
        normalized,
      );
    const refersToContext = /\bthis\b|\bthat\b|\bthese\b|\bit\b/.test(
        normalized,
      );
    const clipboardLooksLikeCode = looksLikeCode(clipboard);
    if (explicitClipboard) return true;
    if (!requestSignals && !(mentionsCode && refersToContext)) return false;
    return mentionsCode || clipboardLooksLikeCode;
  };

  const buildClipboardMessage = (
    text: string,
    truncated: boolean,
    isCode: boolean,
  ) => {
    const header = truncated
      ? `${CLIPBOARD_CONTEXT_LABEL} (truncated):`
      : `${CLIPBOARD_CONTEXT_LABEL}:`;
    const body = isCode ? `\`\`\`\n${text}\n\`\`\`` : text;
    return `${header}\n\n${body}\n\nUse this only if it helps answer the user's request.`;
  };

  const appendHistory = (items: AgentInputItem[]) => {
    historyRef.current = [...historyRef.current, ...items];
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput("");
    await runChat(trimmed, { appendUserMessage: true });
  };

  const cancelSend = () => {
    if (!isSending) return;
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSending(false);
    setError(null);
    toolActivityRef.current = undefined;
    pendingToolMessageIdRef.current = null;
    activeStreamIdRef.current = null;
  };

  const clearHistory = () => {
    setMessages([]);
    historyRef.current = [];
    toolActivityRef.current = undefined;
    pendingToolMessageIdRef.current = null;
    activeStreamIdRef.current = null;
  };

  const regenerateLastResponse = async () => {
    if (isSending) return;
    const { messageIndex, content } = findLastUserMessage();
    if (messageIndex === null || !content) return;
    setMessages((prev) => prev.slice(0, messageIndex + 1));
    if (historyRef.current.length > 0) {
      historyRef.current = historyRef.current.slice(0, -1);
    }
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

  async function runChat(
    content: string,
    runOptions: { appendUserMessage: boolean },
  ) {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;
    setToolUsage((prev: ToolUsage) => ({
      ...prev,
      name: undefined,
      lastUsedAt: undefined,
    }));
    if (runOptions.appendUserMessage) {
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      appendHistory([user(trimmed)]);
    }

    setIsSending(true);
    setError(null);

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortControllerRef.current = new AbortController();

    try {
      if (isToolEnabled(CLIPBOARD_CONTEXT_TOOL_NAME, options)) {
        try {
          const clipboardResponse = await invoke<{
            text?: string;
            truncated?: boolean;
            length?: number;
          }>("read_clipboard_text", { max_chars: DEFAULT_CLIPBOARD_MAX_CHARS });
          const clipboardText = clipboardResponse?.text?.trim() ?? "";
          if (
            clipboardText.length >= MIN_CLIPBOARD_CHARS &&
            clipboardText !== trimmed &&
            shouldAutoUseClipboard(trimmed, clipboardText)
          ) {
            appendHistory([
              user(
                buildClipboardMessage(
                  clipboardText,
                  !!clipboardResponse?.truncated,
                  looksLikeCode(clipboardText),
                ),
              ),
            ]);
            pushToolActivity(getToolCompletedLabel(CLIPBOARD_CONTEXT_TOOL_NAME));
          }
        } catch {
          // Ignore clipboard errors and continue without it.
        }
      }
      ensureAgent();
      const agent = agentRef.current;
      const runner = runnerRef.current;
      if (!agent || !runner) {
        throw new Error("Agents SDK unavailable.");
      }

      const inputItems = historyRef.current;
      const result = await runner.run(agent, inputItems, {
        stream: true,
        signal: abortControllerRef.current.signal,
        maxTurns,
      });

      const pendingStreamId = pendingToolMessageIdRef.current;
      const streamId =
        pendingStreamId ?? streamMessageIdRef.current + 1;
      streamMessageIdRef.current = streamId;
      activeStreamIdRef.current = streamId;
      pendingToolMessageIdRef.current = null;
      setMessages((prev) => {
        if (pendingStreamId !== null) {
          return prev.map((message) =>
            message.streamId === streamId
              ? { ...message, content: "", streamId }
              : message,
          );
        }
        return [...prev, { role: "assistant", content: "", streamId }];
      });

      const stream = result.toTextStream();
      const reader = stream.getReader();
      let contentSoFar = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (requestId !== requestIdRef.current) return;
        contentSoFar += value ?? "";
        setMessages((prev) =>
          prev.map((message) =>
            message.streamId === streamId
              ? { ...message, content: contentSoFar }
              : message,
          ),
        );
      }

      await result.completed;
      if (requestId !== requestIdRef.current) return;
      const toolActivity = finalizeToolActivities(toolActivityRef.current);
      toolActivityRef.current = undefined;
      setMessages((prev) =>
        prev.map((message) =>
          message.streamId === streamId
            ? { role: "assistant", content: contentSoFar, toolActivity }
            : message,
        ),
      );
      appendHistory([assistant(contentSoFar)]);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(toErrorMessage(err, "Ollama unreachable."));
    } finally {
      if (requestId === requestIdRef.current) {
        setIsSending(false);
      }
      abortControllerRef.current = null;
      activeStreamIdRef.current = null;
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
    if (messageIndex === null) {
      return { messageIndex: null, content: "" };
    }
    const content = messages[messageIndex]?.content ?? "";
    return { messageIndex, content };
  }
}
