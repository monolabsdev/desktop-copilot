import { Button } from "@/components/ui/button";
import type { ToolUsage } from "../hooks/ollama/types";

interface Props {
  isSending: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
  toolUsage: ToolUsage;
}

function formatToolName(name?: string) {
  if (!name) return "tool";
  return name.replace(/_/g, " ");
}

export function ChatControls({
  isSending,
  canRegenerate,
  onRegenerate,
  toolUsage,
}: Props) {
  return (
    <div className="px-5 pb-5 pt-2 flex items-center justify-between text-[11px] text-white/50">
      <div className="flex items-center gap-2">
        <span>History</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/60">
          Up / Down
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-2 text-white/60">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              toolUsage.inProgress ? "bg-emerald-300 animate-pulse" : "bg-white/30"
            }`}
          />
          {toolUsage.inProgress
            ? `Using ${formatToolName(toolUsage.name)}`
            : toolUsage.name
              ? `Used ${formatToolName(toolUsage.name)}`
              : "No tools"}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onRegenerate}
          disabled={isSending || !canRegenerate}
          className="text-white/70 hover:text-white"
          title="Regenerate (Ctrl+Shift+R)"
        >
          Regenerate
        </Button>
      </div>
    </div>
  );
}
