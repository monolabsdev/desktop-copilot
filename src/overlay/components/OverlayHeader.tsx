import { Button } from "@/components/ui/button";

interface Props {
  isBusy: boolean;
  hasMessages: boolean;
  onClearHistory: () => void;
}

export function OverlayHeader({ isBusy, hasMessages, onClearHistory }: Props) {
  return (
    <div className="overlay-header flex items-center justify-between gap-3 px-5 pt-4 pb-2">
      <div className="overlay-header-title text-[11px] tracking-[0.16em] text-white/40">
        Copilot
      </div>
      <Button
        size="sm"
        onClick={onClearHistory}
        disabled={!hasMessages || isBusy}
        className="h-7 px-2 text-[11px] tracking-[0.12em] bg-white/5 text-white/55 hover:bg-white/10"
      >
        Clear
      </Button>
    </div>
  );
}
