import { useEffect, useRef } from "react";
import type { Message } from "ollama";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: Array<Message & { thinking?: string }>;
  isSending: boolean;
}

export function MessageList({ messages, isSending }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages, isSending]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-white/5 p-4 text-center text-xs text-white/60">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            Overlay ready
          </div>
          <div className="mt-2">
            Type a question, or try{" "}
            <span className="text-white/80">/corner</span> to move the panel.
          </div>
        </div>
      ) : (
        messages.map((message, index) => (
          <MessageBubble key={`${message.role}-${index}`} message={message} />
        ))
      )}
      {isSending && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            AI
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <span className="inline-flex h-2 w-2 rounded-full bg-white/60 animate-pulse" />
            <span>Thinking...</span>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
