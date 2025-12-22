import { Button } from "@heroui/react";
interface Props {
  isOpen: boolean;
  onApprove: () => void;
  onCancel: () => void;
}

export function CaptureConsentModal({
  isOpen,
  onApprove,
  onCancel,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 pointer-events-auto">
      <div className="w-full max-w-md rounded-lg bg-neutral-900 text-white shadow-xl">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-base font-semibold">
            Allow screen text capture?
          </h2>
          <p className="mt-1 text-sm text-white/70">
            The assistant is requesting a one-time OCR capture of the active
            window. No image data is stored or sent.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
          <Button
            size="sm"
            className="bg-white/10 text-white/80"
            onPress={onCancel}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-white text-black hover:bg-white/90"
            onPress={onApprove}
          >
            Capture
          </Button>
        </div>
      </div>
    </div>
  );
}
