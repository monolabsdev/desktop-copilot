import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../hooks/ollama/types";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: ChatMessage[];
  isSending: boolean;
  showThinking: boolean;
  ollamaConnected: boolean;
}

export function MessageList({
  messages,
  isSending,
  showThinking,
  ollamaConnected,
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const ignoreScrollRef = useRef(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    ignoreScrollRef.current = true;
    endRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  useEffect(() => {
    if (!autoScrollEnabled) return;
    scrollToBottom("auto");
  }, [messages, isSending, autoScrollEnabled]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    if (ignoreScrollRef.current) {
      ignoreScrollRef.current = false;
      return;
    }

    const distanceFromBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;
    const isAtBottom = distanceFromBottom <= 4;

    if (!isAtBottom) {
      if (autoScrollEnabled) {
        setAutoScrollEnabled(false);
      }
      setShowScrollToBottom(true);
      return;
    }

    if (!autoScrollEnabled) {
      setAutoScrollEnabled(true);
    }
    setShowScrollToBottom(false);
  };

  const handleScrollToBottom = () => {
    setAutoScrollEnabled(true);
    setShowScrollToBottom(false);
    scrollToBottom("auto");
  };

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={listRef}
        onScroll={handleScroll}
        data-scroll-container
        className="overlay-message-list h-full overflow-y-auto px-5 py-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="rounded-md border border-white/5 bg-white/5 px-4 py-3 text-xs text-white/55">
            {ollamaConnected
              ? "Ask a quick question. Press Enter to send."
              : "Ollama is offline. Start it to chat."}
          </div>
        ) : (
          messages.map((message, index) => (
            <MessageBubble
              key={`${message.role}-${index}`}
              message={message}
              showThinking={showThinking}
            />
          ))
        )}
        {isSending && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
              AI
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {showScrollToBottom && messages.length > 0 && (
        <Button
          type="button"
          size="sm"
          data-no-drag
          onClick={handleScrollToBottom}
          className="absolute bottom-4 right-5 bg-white/10 text-white/70 hover:bg-white/15"
        >
          <ArrowDown className="h-4 w-4" />
          Back to bottom
        </Button>
      )}
    </div>
  );
}
