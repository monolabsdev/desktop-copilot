import { Button, Input } from "@heroui/react";
import { useEffect, useRef } from "react";

interface Props {
  input: string;
  setInput: (value: string) => void;
  isSending: boolean;
  onSend: () => void;
}

export function ChatInput({ input, setInput, isSending, onSend }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="px-4 pb-4 flex w-full gap-2">
      <Input
        aria-label="Chat message"
        placeholder="Type and press Enter"
        value={input}
        autoFocus
        ref={inputRef}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        className="flex-1 rounded-3xl"
      />

      <Button isDisabled={!input.trim() || isSending} onPress={onSend}>
        {isSending ? "Streaming..." : "Send"}
      </Button>
    </div>
  );
}
