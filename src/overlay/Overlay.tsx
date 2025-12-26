import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { MessageList } from "./components/MessageList";
import { ChatControls } from "./components/ChatControls";
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
import {
  PanelFrame,
  PanelRoot,
  PanelStage,
} from "@/components/layout/panel";
import { OverlayCaptureNotice } from "./components/OverlayCaptureNotice";

export function Overlay() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [captureToolEnabled, setCaptureToolEnabled] = useState(true);
  const [agentEnabled, setAgentEnabled] = useState(false);
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
    isChecking,
    handleDownload,
    handleRetry,
  } = useOllamaHealth();
  const ollamaConnected = !ollamaError && !isChecking;

  // Keep React state aligned with the persisted config payload.
  const applyConfig = useCallback((config: OverlayConfig) => {
    setCaptureToolEnabled(config.tools.capture_screen_text_enabled);
    setAgentEnabled(config.tools.agent_enabled);
    setPanelOpacity(config.appearance.panel_opacity);
    setShowThinking(config.appearance.show_thinking);
  }, []);

  useTauriEvent("overlay:shown", () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  useTauriEvent<OverlayConfig>("config:updated", (event) => {
    applyConfig(event.payload);
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
        applyConfig(loaded);
      })
      .catch(() => {
        if (!active) return;
        applyConfig(DEFAULT_OVERLAY_CONFIG);
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

  const isScrollbarInteraction = useCallback(
    (target: HTMLElement | null, clientX: number) => {
      if (!target) return false;
      const scrollContainer = target.closest(
        "[data-scroll-container]",
      ) as HTMLElement | null;
      if (!scrollContainer) return false;
      const scrollbarWidth =
        scrollContainer.offsetWidth - scrollContainer.clientWidth;
      if (scrollbarWidth <= 0) return false;
      const rect = scrollContainer.getBoundingClientRect();
      return clientX >= rect.right - scrollbarWidth;
    },
    [],
  );

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
      if (isScrollbarInteraction(target, event.clientX)) {
        return;
      }
      event.preventDefault();
      startDragging();
    },
    [isScrollbarInteraction, startDragging],
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
    regenerateLastResponse,
    canRegenerate,
    toolUsage,
  } = useOllamaChat(DEFAULT_MODEL, {
    toolsEnabled: captureToolEnabled,
    agentEnabled,
    requestScreenCapture: requestCaptureConsent,
    setCaptureInProgress: setIsCapturing,
    beforeCapture: async () => {
      // Hide the overlay so the OCR doesn't capture itself.
      await new Promise((resolve) => setTimeout(resolve, 150));
      await invoke("set_overlay_visibility", { visible: false });
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
    afterCapture: async () => {
      const window = getCurrentWindow();
      await invoke("set_overlay_visibility", { visible: true });
      await window.setFocus();
    },
  });
  const inputHistory = useMemo(
    () =>
      messages
        .filter((message) => message.role === "user")
        .map((message) => message.content ?? ""),
    [messages],
  );

  useOverlayHotkeys({
    onStop: cancelSend,
    onRegenerate: regenerateLastResponse,
  });
  return (
    <>
      <PanelRoot variant="overlay">
        {isCapturing && <OverlayCaptureNotice />}
        <PanelStage>
          <PanelFrame
            variant="overlay"
            className="overlay-panel"
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
              ollamaConnected={ollamaConnected}
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
              history={inputHistory}
            />
            <ChatControls
              isSending={isSending}
              canRegenerate={canRegenerate}
              onRegenerate={regenerateLastResponse}
              toolUsage={toolUsage}
            />
          </PanelFrame>
        </PanelStage>
      </PanelRoot>
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
