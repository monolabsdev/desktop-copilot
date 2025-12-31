import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Message } from "ollama";
import { handleChatCommand } from "../commands";
import {
  getToolCompletedLabel,
  getToolActivityReplacement,
  getToolConfig,
  isToolEnabled,
} from "../tools/registry";
import { CLIPBOARD_CONTEXT_TOOL_NAME } from "../tools/clipboardContext";
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
import { appendScreenshotMessage } from "./ollama/screenshot";

const OLLAMA_INSTRUCTIONS =
  "You are a fast, minimal desktop assistant. " +
  "Keep answers concise, structured, and actionable. " +
  "Use the screenshot tool only when it helps answer the user's request or they explicitly ask for it. " +
  "Never send the screenshot back to the user; they already have it.";

const DEFAULT_CLIPBOARD_MAX_CHARS = 4000;
const MIN_CLIPBOARD_CHARS = 24;
const CLIPBOARD_CONTEXT_LABEL = "Clipboard context";

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
  const toolActivityRef = useRef<string[] | null>(null);
  const pendingToolMessageIdRef = useRef<number | null>(null);
  const toolConfig = getToolConfig(options);
  const streamChat = createStreamChat({
    model,
    toolConfig,
    requestIdRef,
    streamMessageIdRef,
    toolActivityRef,
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
    if (toolActivityRef.current) {
      normalized.displayMessage.toolActivity = toolActivityRef.current;
      toolActivityRef.current = null;
    }
    if (pendingToolMessageIdRef.current !== null) {
      const pendingId = pendingToolMessageIdRef.current;
      if (pendingId !== result.streamMessageId) {
        setMessages((prev) =>
          prev.filter((message) => message.streamId !== pendingId),
        );
      }
      pendingToolMessageIdRef.current = null;
    }
    appendHistory([normalized.historyMessage]);
    setMessages((prev) =>
      prev.map((message) =>
        message.streamId === result.streamMessageId
          ? { ...normalized.displayMessage }
          : message,
      ),
    );
  };
  const clearPendingToolMessage = () => {
    if (pendingToolMessageIdRef.current === null) return;
    const pendingId = pendingToolMessageIdRef.current;
    pendingToolMessageIdRef.current = null;
    setMessages((prev) =>
      prev.filter((message) => message.streamId !== pendingId),
    );
  };
  const toolHandlerOptions: ToolOptions = {
    toolsEnabled: options?.toolsEnabled ?? false,
    captureToolEnabled: options?.captureToolEnabled ?? false,
    webSearchEnabled: options?.webSearchEnabled ?? false,
    toolToggles: options?.toolToggles,
    requestScreenCapture: options?.requestScreenCapture,
    setCaptureInProgress: options?.setCaptureInProgress,
    beforeCapture: options?.beforeCapture,
    afterCapture: options?.afterCapture,
    setToolUsage,
    visionModel: options?.visionModel,
    onLocalMessage: (message) => {
      setMessages((prev) => appendScreenshotMessage(prev, message));
      toolActivityRef.current = null;
    },
    onToolActivity: (activity) => {
      if (!activity) {
        toolActivityRef.current = null;
        return;
      }
      const replacement = getToolActivityReplacement(activity);
      const current = toolActivityRef.current ?? [];
      if (replacement && current.length > 0) {
        const next = current.map((entry) =>
          entry === replacement.from ? replacement.to : entry,
        );
        toolActivityRef.current = next;
        if (pendingToolMessageIdRef.current !== null) {
          const pendingId = pendingToolMessageIdRef.current;
          setMessages((prev) =>
            prev.map((message) =>
              message.streamId === pendingId
                ? { ...message, toolActivity: next }
                : message,
            ),
          );
        }
        return;
      }
      if (current.length > 0 && current[current.length - 1] === activity) {
        return;
      }
      const next = current.length ? [...current, activity] : [activity];
      toolActivityRef.current = next;
      if (pendingToolMessageIdRef.current !== null) {
        const pendingId = pendingToolMessageIdRef.current;
        setMessages((prev) =>
          prev.map((message) =>
            message.streamId === pendingId
              ? { ...message, toolActivity: next }
              : message,
          ),
        );
      }
    },
  };

  const { handleToolCalls } = createToolHandler({
    options: toolHandlerOptions,
    invoke,
    appendHistory,
    streamChat,
    requestIdRef,
    applyAssistantMessage,
    getPendingToolMessageId: () => pendingToolMessageIdRef.current,
  });

  const shouldForceCapture = (message: string) => {
    if (!isToolEnabled("capture_screen_image", toolHandlerOptions)) {
      return false;
    }
    const normalized = message.toLowerCase();
    return (
      normalized.includes("screenshot") ||
      normalized.includes("screen shot") ||
      normalized.includes("screen capture") ||
      normalized.includes("see my screen") ||
      normalized.includes("what's on my screen") ||
      normalized.includes("what is on my screen")
    );
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

  const addToolActivity = (label: string) => {
    const current = toolActivityRef.current ?? [];
    if (current.includes(label)) return;
    toolActivityRef.current = current.length ? [...current, label] : [label];
  };

  const buildClipboardMessage = (
    text: string,
    truncated: boolean,
    isCode: boolean,
  ): Message => {
    const header = truncated
      ? `${CLIPBOARD_CONTEXT_LABEL} (truncated):`
      : `${CLIPBOARD_CONTEXT_LABEL}:`;
    const body = isCode ? `\`\`\`\n${text}\n\`\`\`` : text;
    return {
      role: "user",
      content: `${header}\n\n${body}\n\nUse this only if it helps answer the user's request.`,
    };
  };

  const buildBaseMessages = (allowImages: boolean) => {
    const base: Message[] = [
      { role: "system", content: OLLAMA_INSTRUCTIONS },
      ...historyRef.current,
    ];
    if (allowImages) return base;
    return base.map((message) => {
      const withImages = message as Message & { images?: string[] };
      const nextContent =
        typeof withImages.content === "string"
          ? withImages.content
              .replace(
                /!\[[^\]]*]\(data:image\/[a-zA-Z0-9.+-]+;base64,[^)]+\)/g,
                "",
              )
              .trim()
          : withImages.content;
      if (!withImages.images || withImages.images.length === 0) {
        return nextContent === withImages.content
          ? message
          : ({ ...withImages, content: nextContent } as Message);
      }
      const { images: _images, ...rest } = withImages;
      return {
        ...rest,
        content: nextContent ?? "",
      } as Message;
    });
  };

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
    toolActivityRef.current = null;
    clearPendingToolMessage();
  };

  const clearHistory = () => {
    setMessages([]);
    historyRef.current = [];
    toolActivityRef.current = null;
    pendingToolMessageIdRef.current = null;
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
      if (shouldForceCapture(trimmed)) {
        const baseMessages = buildBaseMessages(false);
        const toolCalls = [
          {
            function: {
              name: "capture_screen_image",
              arguments: {},
            },
          },
        ];
        await handleToolCalls(toolCalls, baseMessages);
        return;
      }
      const baseMessages = buildBaseMessages(false);
      let requestMessages = baseMessages;
      if (isToolEnabled(CLIPBOARD_CONTEXT_TOOL_NAME, toolHandlerOptions)) {
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
            const clipboardMessage = buildClipboardMessage(
              clipboardText,
              !!clipboardResponse?.truncated,
              looksLikeCode(clipboardText),
            );
            requestMessages = [...baseMessages, clipboardMessage];
            addToolActivity(getToolCompletedLabel(CLIPBOARD_CONTEXT_TOOL_NAME));
          }
        } catch {
          // Ignore clipboard errors and continue without it.
        }
      }
      const result = await streamChat(requestMessages, requestId);
      if (!result || requestId !== requestIdRef.current) return;

      if (result.toolCalls && result.toolCalls.length > 0) {
        if (result.streamMessageId !== undefined) {
          pendingToolMessageIdRef.current = result.streamMessageId;
        }
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
      clearPendingToolMessage();
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
