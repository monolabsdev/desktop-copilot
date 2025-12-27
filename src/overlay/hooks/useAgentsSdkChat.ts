import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Agent,
  Runner,
  tool,
  type AgentInputItem,
  user,
  assistant,
} from "@openai/agents";
import { OpenAIProvider } from "@openai/agents";
import OpenAI from "openai";
import type { Message } from "ollama";

import { DEFAULT_MODEL, VISION_MODEL } from "../constants";
import { ollamaChat } from "../ollama/client";
import type { ChatMessage, ToolOptions, ToolUsage } from "./ollama/types";

type UseAgentsSdkOptions = ToolOptions & {
  model?: string;
};

const AGENT_INSTRUCTIONS =
  "You are a fast, minimal desktop assistant. " +
  "Keep answers concise, structured, and actionable. " +
  "Use the screenshot tool only when it helps answer the user's request.";

const OLLAMA_BASE_URL = "http://localhost:11434/v1";

function formatToolName(name?: string) {
  if (!name) return "tool";
  return name.replace(/_/g, " ");
}

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
  const historyRef = useRef<AgentInputItem[]>([]);
  const toolActivityRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const runnerRef = useRef<Runner | null>(null);
  const agentRef = useRef<Agent | null>(null);
  const agentConfigRef = useRef({
    model: options?.model ?? DEFAULT_MODEL,
    toolsEnabled,
    visionModel: options?.visionModel ?? VISION_MODEL,
  });

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
        if (!toolsEnabled || !options?.requestScreenCapture) {
          return "Screen capture tool is disabled.";
        }
        toolActivityRef.current = `Using ${formatToolName("capture_screen_image")}.`;
        setToolUsage({ inProgress: true, name: "capture_screen_image" });
        try {
          const consent = await options.requestScreenCapture();
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
            "image_base64" in toolResponse
              ? (toolResponse as {
                  image_base64?: string;
                  preview_base64?: string;
                  preview_mime?: string;
                  file_path?: string;
                  app_name?: string | null;
                })
              : null;
          if (response?.image_base64) {
            const label = response.app_name
              ? `Screenshot from ${response.app_name}.`
              : "Screenshot attached.";
            setMessages((prev) => [
              ...prev,
              {
                role: "user",
                content: label,
                imagePath: response.file_path,
                imagePreviewBase64: response.preview_base64,
                imagePreviewMime: response.preview_mime ?? "image/png",
              },
            ]);
            const visionResponse = await ollamaChat({
              model: nextConfig.visionModel,
              messages: [
                {
                  role: "user",
                  content:
                    "Summarize the screenshot with details relevant to the user's request.",
                  images: [response.image_base64],
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
          setToolUsage({
            inProgress: false,
            name: "capture_screen_image",
            lastUsedAt: Date.now(),
          });
        }
      },
    });
    agentRef.current = new Agent({
      name: "Overlay Assistant",
      instructions: AGENT_INSTRUCTIONS,
      model: nextConfig.model,
      tools: [captureTool],
    });
    agentConfigRef.current = nextConfig;
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
    toolActivityRef.current = null;
  };

  const clearHistory = () => {
    setMessages([]);
    historyRef.current = [];
    toolActivityRef.current = null;
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
      });

      const streamId = streamMessageIdRef.current + 1;
      streamMessageIdRef.current = streamId;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", streamId },
      ]);

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
      const toolActivity = toolActivityRef.current;
      toolActivityRef.current = null;
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
      setError(err instanceof Error ? err.message : "Ollama unreachable.");
    } finally {
      if (requestId === requestIdRef.current) {
        setIsSending(false);
      }
      abortControllerRef.current = null;
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
