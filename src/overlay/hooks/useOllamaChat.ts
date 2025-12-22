import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ollama from "ollama/browser";
import type { Message } from "ollama";
import { handleChatCommand } from "../commands";
import { CAPTURE_SCREEN_TEXT_TOOL } from "../tools/captureScreenText";

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

export function useOllamaChat(model: string, options?: ToolOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const historyRef = useRef<Message[]>([]);
  const toolConfig = options?.toolsEnabled ? [CAPTURE_SCREEN_TEXT_TOOL] : undefined;

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

    try {
      const baseMessages = historyRef.current;
      const firstResponse = await ollama.chat({
        model,
        messages: baseMessages,
        stream: true,
        tools: toolConfig,
      });
      abortRef.current = firstResponse;

      let streamed = "";
      let toolCalls: Message["tool_calls"] = [];
      let assistantAdded = false;

      for await (const part of firstResponse) {
        const newToolCalls = part?.message?.tool_calls;
        if (newToolCalls?.length) {
          toolCalls = newToolCalls;
        }

        const chunk = part?.message?.content ?? "";
        if (!chunk) continue;
        streamed += chunk;
        setMessages((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          const last = next[lastIndex];
          if (!assistantAdded || last?.role !== "assistant") {
            next.push({ role: "assistant", content: streamed });
            assistantAdded = true;
          } else {
            next[lastIndex] = { ...last, content: streamed };
          }
          return next;
        });
      }

      if (toolCalls && toolCalls.length > 0) {
        if (assistantAdded) {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            const last = next[next.length - 1];
            if (last.role === "assistant") {
              next.pop();
            }
            return next;
          });
        }
        const toolReply = await handleToolCalls(toolCalls, baseMessages);
        if (!toolReply) return;
        return;
      }

      if (!streamed.trim()) throw new Error("No response from Ollama.");
      appendHistory([{ role: "assistant", content: streamed }]);
    } catch (err) {
      if (!abortRef.current) {
        setError(null);
        return;
      }
      setError(err instanceof Error ? err.message : "Ollama unreachable.");
    } finally {
      abortRef.current = null;
      setIsSending(false);
    }
  };

  const cancelSend = () => {
    if (!isSending) return;
    abortRef.current?.abort();
    abortRef.current = null;
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
    const captureCall = toolCalls.find(
      (call) => call.function?.name === "capture_screen_text",
    );
    if (!captureCall) {
      throw new Error("Unsupported tool call.");
    }

    if (!options?.toolsEnabled || !options.requestScreenCapture) {
      const toolMessage = {
        role: "tool",
        content: JSON.stringify({ error: "Screen capture tool is disabled." }),
        tool_name: "capture_screen_text",
      } satisfies Message;

      appendHistory([
        { role: "assistant", content: "", tool_calls: toolCalls },
        toolMessage,
      ]);

      await streamFollowup(baseMessages, toolCalls, toolMessage);
      return true;
    }

    const consent = await options.requestScreenCapture();
    if (!consent.approved) {
      const toolMessage = {
        role: "tool",
        content: JSON.stringify({ error: "User declined screen capture." }),
        tool_name: "capture_screen_text",
      } satisfies Message;

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
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message);
    } finally {
      await options.afterCapture?.();
      options.setCaptureInProgress?.(false);
    }

    const toolMessage = {
      role: "tool",
      content: JSON.stringify(toolResponse),
      tool_name: "capture_screen_text",
    } satisfies Message;

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

    const response = await ollama.chat({
      model,
      messages: followupMessages,
      stream: true,
      tools: toolConfig,
    });
    abortRef.current = response;

    let streamed = "";
    let assistantAdded = false;
    for await (const part of response) {
      const chunk = part?.message?.content ?? "";
      if (!chunk) continue;
      streamed += chunk;
      setMessages((prev) => {
        const next = [...prev];
        const lastIndex = next.length - 1;
        const last = next[lastIndex];
        if (!assistantAdded || last?.role !== "assistant") {
          next.push({ role: "assistant", content: streamed });
          assistantAdded = true;
        } else {
          next[lastIndex] = { ...last, content: streamed };
        }
        return next;
      });
    }

    if (!streamed.trim()) throw new Error("No response from Ollama.");
    appendHistory([{ role: "assistant", content: streamed }]);
  }
}
