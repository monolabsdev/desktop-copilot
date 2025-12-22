import { ScrollShadow } from "@heroui/react";
import { useEffect, useRef } from "react";
import type { Message } from "ollama";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: Message[];
}

export function MessageList({ messages }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <ScrollShadow hideScrollBar className="flex-1 px-4 py-6 space-y-4">
      {messages.length === 0 ? (
        <div className="text-sm text-white/40">
          {/* removed for now. */}
          {/*Overlay active. Ollama at localhost:11434.*/}
        </div>
      ) : (
        messages.map((message, index) => (
          <MessageBubble
            key={`${message.role}-${index}`}
            message={message}
          />
        ))
      )}
      <div ref={endRef} />
    </ScrollShadow>
  );
}
