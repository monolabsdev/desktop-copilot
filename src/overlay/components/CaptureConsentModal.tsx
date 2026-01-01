import { Button } from "@/components/ui/button";
import { ModalShell } from "@/shared/ui/ModalShell";
interface Props {
  isOpen: boolean;
  onApprove: () => void;
  onCancel: () => void;
  portal?: boolean;
}

export function CaptureConsentModal({
  isOpen,
  onApprove,
  onCancel,
  portal,
}: Props) {
  return (
    <ModalShell
      isOpen={isOpen}
      portal={portal}
      title="Allow screen text capture?"
      description="The assistant is requesting a one-time OCR capture of the active window. No image data is stored or sent."
      footer={
        <>
          <Button
            size="sm"
            className="bg-white/10 text-white/80"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-white text-black hover:bg-white/90"
            onClick={onApprove}
          >
            Capture
          </Button>
        </>
      }
    />
  );
}
