import { Button, Input } from "@heroui/react";
import { useEffect, useRef, type RefObject } from "react";

interface Props {
  input: string;
  setInput: (value: string) => void;
  isSending: boolean;
  onSend: () => void;
  onCancel: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 16.5a.75.75 0 0 0 .75-.75V6.56l2.47 2.47a.75.75 0 0 0 1.06-1.06l-3.75-3.75a.75.75 0 0 0-1.06 0L5.72 7.97a.75.75 0 1 0 1.06 1.06l2.47-2.47v9.19a.75.75 0 0 0 .75.75Z"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <rect x="5.25" y="5.25" width="9.5" height="9.5" fill="currentColor" />
    </svg>
  );
}

export function ChatInput({
  input,
  setInput,
  isSending,
  onSend,
  onCancel,
  inputRef,
}: Props) {
  const localRef = useRef<HTMLInputElement | null>(null);
  const resolvedRef = inputRef ?? localRef;

  useEffect(() => {
    resolvedRef.current?.focus();
  }, [resolvedRef]);

  return (
    <div className="px-4 pb-4 flex w-full gap-2">
      <Input
        aria-label="Chat message"
        placeholder="Type and press Enter"
        value={input}
        autoFocus
        ref={resolvedRef}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        className="overlay-input flex-1"
      />

      <Button
        isIconOnly
        aria-label={isSending ? "Cancel response" : "Send message"}
        isDisabled={!isSending && !input.trim()}
        onPress={isSending ? onCancel : onSend}
        className="h-10 w-10 min-w-10 rounded-md bg-white/10 text-white/80"
      >
        {isSending ? <StopIcon /> : <SendIcon />}
      </Button>
    </div>
  );
}
