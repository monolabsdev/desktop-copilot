import { Button } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";
import { useOllamaChat } from "./hooks/useOllamaChat";
import { useOverlayHotkeys } from "./hooks/useOverlayHotkeys";
import { DEFAULT_MODEL } from "./constants";
import { CaptureConsentModal } from "./components/CaptureConsentModal";
import { OllamaRequiredModal } from "./components/OllamaRequiredModal";
import { useOllamaHealth } from "./hooks/useOllamaHealth";

export function Overlay() {
  useOverlayHotkeys();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [captureToolEnabled, setCaptureToolEnabled] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const consentResolver = useRef<
    ((value: { approved: boolean }) => void) | null
  >(null);
  const { isOpen, error: ollamaError, handleDownload, handleRetry } =
    useOllamaHealth();

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen("overlay:shown", () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }).then((handler) => {
      unlisten = handler;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    invoke<boolean>("get_capture_tool_enabled")
      .then((enabled) => setCaptureToolEnabled(enabled))
      .catch(() => null);
  }, []);

  const requestCaptureConsent = useCallback(
    () =>
      new Promise<{ approved: boolean }>((resolve) => {
        setConsentOpen(true);
        consentResolver.current = resolve;
      }),
    [],
  );

  const handleApprove = useCallback(async () => {
    setConsentOpen(false);
    consentResolver.current?.({ approved: true });
    consentResolver.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setConsentOpen(false);
    consentResolver.current?.({ approved: false });
    consentResolver.current = null;
  }, []);

  const {
    messages,
    input,
    setInput,
    isSending,
    error,
    sendMessage,
    cancelSend,
    clearHistory,
  } = useOllamaChat(DEFAULT_MODEL, {
    toolsEnabled: captureToolEnabled,
    requestScreenCapture: requestCaptureConsent,
    setCaptureInProgress: setIsCapturing,
    beforeCapture: async () => {
      // Hide the overlay so the OCR doesn't capture itself.
      const window = getCurrentWindow();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await window.hide();
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
    afterCapture: async () => {
      const window = getCurrentWindow();
      await window.show();
      await window.setFocus();
    },
  });
  return (
    <>
      <div className="overlay-root fixed inset-0 pointer-events-none">
        {isCapturing && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-4 py-1 text-xs font-semibold text-black">
            Capturing active window...
          </div>
        )}
        <div className="absolute inset-0 flex justify-center">
          <div className="w-full max-w-2xl h-full flex flex-col pointer-events-auto overlay-panel">
            {/* Header */}
            <div className="flex justify-end gap-2 px-4 pt-4">
              <Button
                size="sm"
                onPress={clearHistory}
                isDisabled={messages.length === 0 || isSending}
                className="bg-white/5 text-white/60 hover:bg-white/10"
              >
                Clear history
              </Button>
            </div>

            {/* Messages */}
            <MessageList messages={messages} />

            {/* Error */}
            {error && (
              <div className="px-4 pb-2 text-sm text-red-400">{error}</div>
            )}

            {/* Input */}
            <ChatInput
              input={input}
              setInput={setInput}
              isSending={isSending}
              onSend={sendMessage}
              onCancel={cancelSend}
              inputRef={inputRef}
            />
          </div>
        </div>
      </div>
      <CaptureConsentModal
        isOpen={consentOpen}
        onApprove={handleApprove}
        onCancel={handleCancel}
      />
      <OllamaRequiredModal
        isOpen={isOpen}
        error={ollamaError}
        onDownload={handleDownload}
        onRetry={handleRetry}
      />
    </>
  );
}
