import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInputHistory } from "../hooks/useInputHistory";
import {
  useEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { ArrowUp } from "lucide-react";
import { Square } from "lucide-react";

interface Props {
  input: string;
  setInput: (value: string) => void;
  isSending: boolean;
  onSend: () => void;
  onCancel: () => void;
  history: string[];
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function ChatInput({
  input,
  setInput,
  isSending,
  onSend,
  onCancel,
  history,
  inputRef,
}: Props) {
  const localRef = useRef<HTMLInputElement | null>(null);
  const resolvedRef = inputRef ?? localRef;
  const { handleHistoryKeyDown, resetHistory, isNavigating } = useInputHistory({
    history,
    value: input,
    setValue: setInput,
  });

  useEffect(() => {
    resolvedRef.current?.focus();
  }, [resolvedRef]);

  return (
    <div className="overlay-chat-input px-5 pt-4 flex w-full gap-2">
      <Input
        aria-label="Chat message"
        placeholder="Type and press Enter"
        value={input}
        autoFocus
        ref={resolvedRef}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (isNavigating) resetHistory();
          setInput(e.target.value);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (handleHistoryKeyDown(e)) return;
          // Enter sends; Shift+Enter is allowed for multiline input.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        className="overlay-input flex-1"
      />

      <Button
        aria-label={isSending ? "Cancel response" : "Send message"}
        disabled={!isSending && !input.trim()}
        onClick={isSending ? onCancel : onSend}
        className="h-9 w-9 min-w-9 rounded-full bg-white/5 text-white/70 hover:bg-white/10"
      >
        {isSending ? <Square /> : <ArrowUp />}
      </Button>
    </div>
  );
}
