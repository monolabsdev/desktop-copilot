import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";
import { useOllamaChat } from "./hooks/useOllamaChat";
import { useOverlayHotkeys } from "./hooks/useOverlayHotkeys";
import { DEFAULT_MODEL } from "./constants";
import { CaptureConsentModal } from "./components/CaptureConsentModal";
import { OllamaRequiredModal } from "./components/OllamaRequiredModal";
import { useOllamaHealth } from "./hooks/useOllamaHealth";
import { OverlayHeader } from "./components/OverlayHeader";
import { DEFAULT_OVERLAY_CONFIG, type OverlayConfig } from "../shared/config";
import { useTauriEvent } from "../shared/hooks/useTauriEvent";

export function Overlay() {
  useOverlayHotkeys();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [captureToolEnabled, setCaptureToolEnabled] = useState(true);
  const [panelOpacity, setPanelOpacity] = useState(
    DEFAULT_OVERLAY_CONFIG.appearance.panel_opacity,
  );
  const [showThinking, setShowThinking] = useState(
    DEFAULT_OVERLAY_CONFIG.appearance.show_thinking,
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const consentResolver = useRef<
    ((value: { approved: boolean }) => void) | null
  >(null);
  const {
    isOpen,
    error: ollamaError,
    handleDownload,
    handleRetry,
  } = useOllamaHealth();

  useTauriEvent("overlay:shown", () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  useTauriEvent<OverlayConfig>("config:updated", (event) => {
    setCaptureToolEnabled(event.payload.tools.capture_screen_text_enabled);
    setPanelOpacity(event.payload.appearance.panel_opacity);
    setShowThinking(event.payload.appearance.show_thinking);
  });

  const applyPanelOpacity = useCallback((value: number) => {
    const clamped = Math.min(1, Math.max(0.6, value));
    document.documentElement.style.setProperty(
      "--overlay-panel-opacity",
      clamped.toString(),
    );
  }, []);

  useEffect(() => {
    let active = true;
    invoke<OverlayConfig>("get_overlay_config")
      .then((loaded) => {
        if (!active) return;
        setCaptureToolEnabled(loaded.tools.capture_screen_text_enabled);
        setPanelOpacity(loaded.appearance.panel_opacity);
        setShowThinking(loaded.appearance.show_thinking);
      })
      .catch(() => {
        if (!active) return;
        setCaptureToolEnabled(
          DEFAULT_OVERLAY_CONFIG.tools.capture_screen_text_enabled,
        );
        setPanelOpacity(DEFAULT_OVERLAY_CONFIG.appearance.panel_opacity);
        setShowThinking(DEFAULT_OVERLAY_CONFIG.appearance.show_thinking);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    applyPanelOpacity(panelOpacity);
  }, [applyPanelOpacity, panelOpacity]);

  const startDragging = useCallback(() => {
    getCurrentWindow()
      .startDragging()
      .catch(() => null);
  }, []);

  const handlePanelPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, button, select, a, [contenteditable=\"true\"], [data-no-drag]",
        )
      ) {
        return;
      }
      event.preventDefault();
      startDragging();
    },
    [startDragging],
  );

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
          <div
            className="w-full max-w-2xl h-full flex flex-col pointer-events-auto overlay-panel"
            onPointerDown={handlePanelPointerDown}
          >
            <OverlayHeader
              isBusy={isSending}
              hasMessages={messages.length > 0}
              onClearHistory={clearHistory}
            />

            {/* Messages */}
            <MessageList
              messages={messages}
              isSending={isSending}
              showThinking={showThinking}
            />

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
