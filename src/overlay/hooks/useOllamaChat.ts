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

    setMessages(nextMessages);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const response = await ollama.chat({
        model,
        messages: nextMessages,
      });

      const reply = response?.message?.content?.trim();
      if (!reply) throw new Error("No response from Ollama.");

      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ollama unreachable.");
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
