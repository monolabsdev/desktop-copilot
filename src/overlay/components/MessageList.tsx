import { ScrollShadow } from "@heroui/react";
import type { Message } from "ollama";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: Message[];
  model: string;
}

export function MessageList({ messages, model }: Props) {
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
            model={model}
          />
        ))
      )}
    </ScrollShadow>
  );
}
