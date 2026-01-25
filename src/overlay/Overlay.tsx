import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";
import { useOllamaChat } from "./hooks/useOllamaChat";
import { useAgentsSdkChat } from "./hooks/useAgentsSdkChat";
import { useOverlayHotkeys } from "./hooks/useOverlayHotkeys";
import { DEFAULT_MODEL, VISION_MODEL } from "./constants";
import { CaptureConsentModal } from "./components/CaptureConsentModal";
import { OllamaRequiredModal } from "./components/OllamaRequiredModal";
import { useOllamaHealth } from "./hooks/useOllamaHealth";
import { OverlayHeader } from "./components/OverlayHeader";
import { DEFAULT_OVERLAY_CONFIG, type OverlayConfig } from "../shared/config";
import { useTauriEvent } from "../shared/hooks/useTauriEvent";
import {
  clampPanelOpacity,
  getPanelOpacityRange,
} from "../shared/platform";
import { PanelFrame, PanelRoot, PanelStage } from "@/components/layout/panel";
import { OverlayCaptureNotice } from "./components/OverlayCaptureNotice";
import { CLIPBOARD_CONTEXT_TOOL_NAME } from "./tools/clipboardContext";
import { isToolEnabled, TOOL_REGISTRY } from "./tools/registry";

const MIN_OVERLAY_HEIGHT = 320;

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, duration);
  });

export function Overlay() {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [panelOpacity, setPanelOpacity] = useState(
    DEFAULT_OVERLAY_CONFIG.appearance.panel_opacity,
  );
  const [showThinking, setShowThinking] = useState(
    DEFAULT_OVERLAY_CONFIG.appearance.show_thinking,
  );
  const [captureToolEnabled, setCaptureToolEnabled] = useState(
    DEFAULT_OVERLAY_CONFIG.tools.capture_screen_text_enabled,
  );
  const [webSearchEnabled, setWebSearchEnabled] = useState(
    DEFAULT_OVERLAY_CONFIG.tools.web_search_enabled,
  );
  const [agentsSdkEnabled, setAgentsSdkEnabled] = useState(
    DEFAULT_OVERLAY_CONFIG.tools.agents_sdk_enabled,
  );
  const [toolToggles, setToolToggles] = useState<Record<string, boolean>>(
    DEFAULT_OVERLAY_CONFIG.tools.tool_toggles,
  );
  const [keybinds, setKeybinds] = useState(
    DEFAULT_OVERLAY_CONFIG.keybinds,
  );
  const panelFrameRef = useRef<HTMLDivElement | null>(null);
  const panelOpacityRange = useMemo(() => getPanelOpacityRange(), []);
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
    setPanelOpacity(config.appearance.panel_opacity);
    setShowThinking(config.appearance.show_thinking);
    setCaptureToolEnabled(config.tools.capture_screen_text_enabled);
    setWebSearchEnabled(config.tools.web_search_enabled);
    setAgentsSdkEnabled(config.tools.agents_sdk_enabled);
    setToolToggles(config.tools.tool_toggles ?? {});
    setKeybinds(config.keybinds);
  }, []);

  useTauriEvent("overlay:shown", () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  useTauriEvent<OverlayConfig>("config:updated", (event) => {
    applyConfig(event.payload);
  });

  const applyPanelOpacity = useCallback(
    (value: number) => {
      const clamped = clampPanelOpacity(value, panelOpacityRange);
      document.documentElement.style.setProperty(
        "--overlay-panel-opacity",
        clamped.toString(),
      );
    },
    [panelOpacityRange],
  );

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

  const adjustOverlayWindowSize = useCallback(async () => {
    const element = panelFrameRef.current;
    if (!element) {
      return;
    }
    const devicePixelRatio =
      typeof window === "undefined" ? 1 : window.devicePixelRatio ?? 1;
    const rect = element.getBoundingClientRect();
    const targetWidth = Math.ceil(rect.width * devicePixelRatio);
    const targetHeight = Math.max(
      MIN_OVERLAY_HEIGHT,
      Math.ceil(rect.height * devicePixelRatio),
    );

    try {
      const currentWindow = await getCurrentWindow();
      const currentSize = await currentWindow.outerSize();
      if (
        currentSize.width === targetWidth &&
        currentSize.height === targetHeight
      ) {
        return;
      }
      await currentWindow.setSize(new PhysicalSize(targetWidth, targetHeight));
    } catch (err) {
      console.debug("Failed to resize overlay window", err);
    }
  }, [panelFrameRef]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const element = panelFrameRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => {
      void adjustOverlayWindowSize();
    });
    observer.observe(element);
    void adjustOverlayWindowSize();
    return () => observer.disconnect();
  }, [adjustOverlayWindowSize]);

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
      if (target?.closest("[data-scroll-container]")) {
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

  const hideOverlayDuringCapture = useCallback(async () => {
    await wait(150);
    await invoke("set_overlay_visibility", { visible: false });
    await wait(150);
  }, []);

  const restoreOverlayAfterCapture = useCallback(async () => {
    const window = getCurrentWindow();
    await invoke("set_overlay_visibility", { visible: true });
    await window.setFocus();
  }, []);

  const captureLifecycle = useMemo(
    () => ({
      requestScreenCapture: requestCaptureConsent,
      setCaptureInProgress: setIsCapturing,
      beforeCapture: hideOverlayDuringCapture,
      afterCapture: restoreOverlayAfterCapture,
    }),
    [
      requestCaptureConsent,
      hideOverlayDuringCapture,
      restoreOverlayAfterCapture,
      setIsCapturing,
    ],
  );

  const mergedToolToggles = {
    ...toolToggles,
    capture_screen_image: captureToolEnabled,
    web_search: webSearchEnabled,
    // Keep clipboard context disabled unless explicitly re-enabled elsewhere.
    [CLIPBOARD_CONTEXT_TOOL_NAME]: false,
  };
  const toolsEnabled = TOOL_REGISTRY.some((tool) =>
    isToolEnabled(tool.name, {
      toolsEnabled: true,
      captureToolEnabled,
      webSearchEnabled,
      toolToggles: mergedToolToggles,
    }),
  );
  const ollamaChat = useOllamaChat(DEFAULT_MODEL, {
    toolsEnabled,
    captureToolEnabled,
    webSearchEnabled,
    toolToggles: mergedToolToggles,
    visionModel: VISION_MODEL,
    ...captureLifecycle,
  });
  const agentsChat = useAgentsSdkChat({
    toolsEnabled,
    captureToolEnabled,
    toolToggles: mergedToolToggles,
    visionModel: VISION_MODEL,
    ...captureLifecycle,
  });
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
  } = agentsSdkEnabled ? agentsChat : ollamaChat;
  const hasMessages = messages.length > 0;
  const inputHistory = useMemo(
    () =>
      messages
        .filter((message) => message.role === "user")
        .map((message) => message.content ?? ""),
    [messages],
  );


  useOverlayHotkeys({
    keybinds,
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
            ref={panelFrameRef}
            className="overlay-panel"
            onPointerDown={handlePanelPointerDown}
          >
            {(hasMessages || error) && (
              <div className="overlay-panel-body">
                {hasMessages && (
                  <OverlayHeader
                    isBusy={isSending}
                    hasMessages
                    onClearHistory={clearHistory}
                  />
                )}
                <div
                  className="overlay-panel-body-scroll"
                  data-scroll-container
                >
                  {hasMessages && (
                    <MessageList
                      messages={messages}
                      isSending={isSending}
                      showThinking={showThinking}
                      ollamaConnected={ollamaConnected}
                      canRegenerate={canRegenerate}
                      onRegenerate={regenerateLastResponse}
                    />
                  )}
                  {error && (
                    <div className="overlay-panel-error px-4 pb-2 text-sm text-red-400">
                      {error}
                    </div>
                  )}
                </div>
              </div>
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
