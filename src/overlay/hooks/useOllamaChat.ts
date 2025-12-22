import { useState } from "react";
import ollama from "ollama/browser";
import type { Message } from "ollama";

export function useOllamaChat(model: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];

    setInput("");
    setIsSending(true);
    setError(null);
    setMessages([...nextMessages, { role: "assistant", content: "" }]);

    try {
      const response = await ollama.chat({
        model,
        messages: nextMessages,
        stream: true,
      });

      let streamed = "";
      for await (const part of response) {
        const chunk = part?.message?.content ?? "";
        if (!chunk) continue;
        streamed += chunk;
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          const lastIndex = next.length - 1;
          const last = next[lastIndex];
          if (last.role !== "assistant") {
            next.push({ role: "assistant", content: streamed });
          } else {
            next[lastIndex] = { ...last, content: streamed };
          }
          return next;
        });
      }

      if (!streamed.trim()) throw new Error("No response from Ollama.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ollama unreachable.");
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const last = next[next.length - 1];
        if (last.role === "assistant" && !last.content.trim()) {
          next.pop();
        }
        return next;
      });
    } finally {
      setIsSending(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
  };

  return {
    messages,
    input,
    setInput,
    isSending,
    error,
    sendMessage,
    clearHistory,
  };
}
