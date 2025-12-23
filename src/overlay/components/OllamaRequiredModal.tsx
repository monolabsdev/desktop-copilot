import { Button } from "@heroui/react";
import { ModalShell } from "../../shared/ui/ModalShell";

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
  return (
    <ModalShell
      isOpen={isOpen}
      title="Ollama is required"
      description="To use AI, install and run Ollama on this machine."
      footer={
        <>
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
        </>
      }
    >
      {error && (
        <p className="mt-2 text-xs text-red-400">Error: {error}</p>
      )}
    </ModalShell>
  );
}
