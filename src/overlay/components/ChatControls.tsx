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
  const showToolStatus = toolUsage.inProgress || !!toolUsage.name;
  return (
    <div className="overlay-chat-controls px-5 pb-4 pt-2 flex items-center justify-between text-[11px] text-white/45">
      {showToolStatus ? (
        <span className="inline-flex items-center gap-2 text-white/55">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              toolUsage.inProgress
                ? "bg-emerald-300 animate-pulse"
                : "bg-white/30"
            }`}
          />
          {toolUsage.inProgress
            ? `Using ${formatToolName(toolUsage.name)}`
            : `Used ${formatToolName(toolUsage.name)}`}
        </span>
      ) : (
        <span />
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onRegenerate}
        disabled={isSending || !canRegenerate}
        className="text-white/60 hover:text-white"
        title="Regenerate (Ctrl+Shift+R)"
      >
        Regenerate
      </Button>
    </div>
  );
}
