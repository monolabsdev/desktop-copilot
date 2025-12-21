import { Button, Input } from "@heroui/react";

interface Props {
  input: string;
  setInput: (value: string) => void;
  isSending: boolean;
  onSend: () => void;
}

export function ChatInput({ input, setInput, isSending, onSend }: Props) {
  return (
    <div className="px-4 pb-4 flex w-full gap-2">
      <Input
        aria-label="Chat message"
        placeholder="Type and press Enter"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        disabled={isSending}
        className="flex-1 rounded-3xl"
      />

      <Button isDisabled={isSending} onPress={onSend}>
        {isSending ? "…" : "Send"}
      </Button>
    </div>
  );
}
