import { useEffect, useRef } from "react";
import type { Message } from "ollama";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: Message[];
}

export function MessageList({ messages }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.length === 0 ? (
        <div className="text-xs text-white/40">Overlay active.</div>
      ) : (
        messages.map((message, index) => (
          <MessageBubble
            key={`${message.role}-${index}`}
            message={message}
          />
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}
