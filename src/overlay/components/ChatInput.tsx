import {
  PromptInput,
  PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInputHistory } from "../hooks/useInputHistory";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { ArrowUp } from "lucide-react";

interface Props {
  input: string;
  setInput: (value: string) => void;
  isSending: boolean;
  onSend: () => void;
  onCancel: () => void;
  history: string[];
  inputRef?: RefObject<HTMLTextAreaElement | null>;
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
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const resolvedRef = inputRef ?? localRef;
  const [isMultiline, setIsMultiline] = useState(false);

  const { handleHistoryKeyDown, resetHistory, isNavigating } = useInputHistory({
    history,
    value: input,
    setValue: setInput,
  });

  useEffect(() => {
    resolvedRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = resolvedRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(style.lineHeight) || 0;
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
    const contentHeight = el.scrollHeight - paddingTop - paddingBottom;
    if (!lineHeight) {
      setIsMultiline(contentHeight > 48);
      return;
    }
    setIsMultiline(contentHeight > lineHeight * 1.4);
  }, [input, resolvedRef]);

  const handleSubmit = () => {
    if (isSending) {
      onCancel();
      return;
    }
    if (!input.trim()) return;
    onSend();
  };

  return (
    <div className="overlay-chat-input px-4 pt-4 pb-4">
      <PromptInput
        isLoading={isSending}
        value={input}
        onValueChange={(value) => {
          if (isNavigating) resetHistory();
          setInput(value);
        }}
        onSubmit={handleSubmit}
        textareaRef={resolvedRef}
        className="chat-input-shell relative w-full"
      >
        <div className="chat-input-inner relative">
          <PromptInputTextarea
            aria-label="Chat message"
            placeholder="Ask anything"
            className="chat-input-textarea"
            onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
              handleHistoryKeyDown(event);
            }}
          />

          <Button
            size="icon"
            disabled={!isSending && !input.trim()}
            onClick={handleSubmit}
            aria-label={isSending ? "Cancel response" : "Send message"}
            data-sending={isSending ? "true" : "false"}
            className={cn(
              "absolute right-2 size-9 rounded-full chat-input-send",
              isMultiline ? "bottom-2" : "top-1/2 -translate-y-1/2",
            )}
          >
            {!isSending ? (
              <ArrowUp size={18} />
            ) : (
              <span className="size-3 rounded-xs bg-white" />
            )}
          </Button>
        </div>
      </PromptInput>
    </div>
  );
}
