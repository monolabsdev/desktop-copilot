import { Button } from "@/components/ui/button";

interface Props {
  isSending: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
}

export function ChatControls({
  isSending,
  canRegenerate,
  onRegenerate,
}: Props) {
  return (
    <div className="overlay-chat-controls px-5 pb-4 pt-2 flex items-center justify-between text-[11px] text-white/45">
      <span />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onRegenerate}
        disabled={isSending || !canRegenerate}
        className="overlay-button overlay-button--ghost"
        title="Regenerate (Ctrl+Shift+R)"
      >
        Regenerate
      </Button>
    </div>
  );
}
