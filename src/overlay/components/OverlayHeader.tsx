import { Button } from "@heroui/react";

interface Props {
  isBusy: boolean;
  hasMessages: boolean;
  onClearHistory: () => void;
}

export function OverlayHeader({ isBusy, hasMessages, onClearHistory }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
          Desktop Copilot
        </div>
        {/*<div className="text-xs text-white/60 mt-1">
          Ask anything or run a quick command.
        </div>*/}
      </div>
      <Button
        size="sm"
        onPress={onClearHistory}
        isDisabled={!hasMessages || isBusy}
        className="bg-white/5 text-white/70 hover:bg-white/10"
      >
        Clear history
      </Button>
    </div>
  );
}
