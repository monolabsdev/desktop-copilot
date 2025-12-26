import { Button } from "@/components/ui/button";

interface Props {
  isBusy: boolean;
  hasMessages: boolean;
  onClearHistory: () => void;
}

export function OverlayHeader({ isBusy, hasMessages, onClearHistory }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2">
      <div className="text-[11px] tracking-[0.18em] text-white/50">
        Desktop Copilot
      </div>
      <Button
        size="sm"
        onClick={onClearHistory}
        disabled={!hasMessages || isBusy}
        className="bg-white/5 text-white/70 hover:bg-white/10"
      >
        Clear history
      </Button>
    </div>
  );
}
