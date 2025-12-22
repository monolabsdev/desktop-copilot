import { Button } from "@heroui/react";

interface Props {
  isOpen: boolean;
  error: string | null;
  onDownload: () => void;
  onRetry: () => void;
}

export function OllamaRequiredModal({
  isOpen,
  error,
  onDownload,
  onRetry,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 pointer-events-auto">
      <div className="w-full max-w-md rounded-lg bg-neutral-900 text-white shadow-xl">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-base font-semibold">Ollama is required</h2>
          <p className="mt-1 text-sm text-white/70">
            To use AI, install and run Ollama on this machine.
          </p>
          {error && (
            <p className="mt-2 text-xs text-red-400">Error: {error}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
          <Button
            size="sm"
            className="bg-white/10 text-white/80"
            onPress={onRetry}
          >
            Retry
          </Button>
          <Button
            size="sm"
            className="bg-white text-black hover:bg-white/90"
            onPress={onDownload}
          >
            Download Ollama
          </Button>
        </div>
      </div>
    </div>
  );
}
