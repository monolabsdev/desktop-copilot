import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeybindInput } from "@/components/ui/keybind-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { StatusChip } from "@/components/ui/status-chip";
import {
  PanelBody,
  PanelEyebrow,
  PanelFieldLabel,
  PanelFooter,
  PanelFrame,
  PanelRoot,
  PanelRow,
  PanelSectionTitle,
  PanelStack,
  PanelStage,
  PanelSubtitle,
  PanelTitle,
} from "@/components/layout/panel";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  DEFAULT_OVERLAY_CONFIG,
  OVERLAY_CORNERS,
  type OverlayConfig,
  type OverlayCorner,
} from "../shared/config";
import { TOOL_REGISTRY } from "../overlay/tools/registry";
import { useTauriEvent } from "../shared/hooks/useTauriEvent";

type WebSearchKeyStatus = {
  has_key: boolean;
  source?: string | null;
};

export function Preferences() {
  const [config, setConfig] = useState<OverlayConfig>(DEFAULT_OVERLAY_CONFIG);
  const [initialConfig, setInitialConfig] = useState<OverlayConfig>(
    DEFAULT_OVERLAY_CONFIG,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);
  const [webSearchKey, setWebSearchKey] = useState("");
  const [webSearchKeyStatus, setWebSearchKeyStatus] =
    useState<WebSearchKeyStatus | null>(null);
  const [webSearchKeyStatusText, setWebSearchKeyStatusText] = useState<
    string | null
  >(null);
  const [isSavingWebSearchKey, setIsSavingWebSearchKey] = useState(false);
  const [keybindErrors, setKeybindErrors] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    const clamped = Math.min(1, Math.max(0.6, config.appearance.panel_opacity));
    document.documentElement.style.setProperty(
      "--overlay-panel-opacity",
      clamped.toString(),
    );
  }, [config.appearance.panel_opacity]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        window.clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    invoke<OverlayConfig>("get_overlay_config")
      .then((loaded) => {
        if (active) {
          setConfig(loaded);
          setInitialConfig(loaded);
        }
      })
      .catch(() => {
        if (active) {
          setConfig(DEFAULT_OVERLAY_CONFIG);
          setInitialConfig(DEFAULT_OVERLAY_CONFIG);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    invoke<WebSearchKeyStatus>("get_ollama_web_search_key_status")
      .then((payload) => {
        setWebSearchKeyStatus(payload);
      })
      .catch(() => {
        setWebSearchKeyStatus({ has_key: false });
      });
  }, []);

  useTauriEvent<{ key: string; error: string }>(
    "shortcuts:registration_failed",
    (event) => {
      const key = event.payload.key;
      setKeybindErrors((prev) => {
        const next = { ...prev };
        if (config.keybinds.toggle_overlay === key) {
          next.toggle_overlay = event.payload.error;
        }
        if (config.keybinds.focus_overlay === key) {
          next.focus_overlay = event.payload.error;
        }
        return next;
      });
    },
  );

  const setCorner = (corner: OverlayCorner) =>
    setConfig((prev) => ({ ...prev, corner }));
  const setKeybind = (
    key:
      | "toggle_overlay"
      | "focus_overlay"
      | "stop_generation"
      | "regenerate_last_response",
    value: string,
  ) =>
    setConfig((prev) => ({
      ...prev,
      keybinds: { ...prev.keybinds, [key]: value },
    }));

  const clearKeybindError = (key: keyof OverlayConfig["keybinds"]) => {
    setKeybindErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const resetKeybindsToDefaults = () => {
    setConfig((prev) => ({ ...prev, keybinds: DEFAULT_OVERLAY_CONFIG.keybinds }));
    setKeybindErrors({});
  };
  // When adding a new config field, add a setter and UI control here so it
  // stays in sync with DEFAULT_OVERLAY_CONFIG and the Rust config structs.
  const setPanelOpacity = (value: number) =>
    setConfig((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, panel_opacity: value },
    }));
  const setShowThinking = (value: boolean) =>
    setConfig((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, show_thinking: value },
    }));
  const setAgentsSdkEnabled = (value: boolean) =>
    setConfig((prev) => ({
      ...prev,
      tools: { ...prev.tools, agents_sdk_enabled: value },
    }));
  const setToolToggle = (toolName: string, enabled: boolean) =>
    setConfig((prev) => {
      const toolToggles = {
        ...(prev.tools.tool_toggles ?? {}),
        [toolName]: enabled,
      };
      const tools = { ...prev.tools, tool_toggles: toolToggles };
      if (toolName === "capture_screen_image") {
        tools.capture_screen_text_enabled = enabled;
      }
      if (toolName === "web_search") {
        tools.web_search_enabled = enabled;
      }
      return {
        ...prev,
        tools,
      };
    });

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(initialConfig),
    [config, initialConfig],
  );
  const canSave = useMemo(
    () => !isLoading && !isSaving && isDirty,
    [isLoading, isSaving, isDirty],
  );

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      await invoke("set_overlay_config", { config });
      setInitialConfig(config);
      setStatus("Saved.");
      if (statusTimeoutRef.current) {
        window.clearTimeout(statusTimeoutRef.current);
      }
      statusTimeoutRef.current = window.setTimeout(() => setStatus(null), 2000);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWebSearchKey = async () => {
    if (!webSearchKey.trim()) {
      setWebSearchKeyStatusText("Enter a key first.");
      return;
    }
    setIsSavingWebSearchKey(true);
    setWebSearchKeyStatusText(null);
    try {
      await invoke("set_ollama_web_search_api_key", { key: webSearchKey });
      setWebSearchKey("");
      const status = await invoke<WebSearchKeyStatus>(
        "get_ollama_web_search_key_status",
      );
      setWebSearchKeyStatus(status);
      setWebSearchKeyStatusText("Web search key saved.");
    } catch (err) {
      setWebSearchKeyStatusText(
        err instanceof Error ? err.message : "Failed to save key.",
      );
    } finally {
      setIsSavingWebSearchKey(false);
    }
  };

  const handleClearWebSearchKey = async () => {
    setIsSavingWebSearchKey(true);
    setWebSearchKeyStatusText(null);
    try {
      await invoke("clear_ollama_web_search_api_key");
      const status = await invoke<WebSearchKeyStatus>(
        "get_ollama_web_search_key_status",
      );
      setWebSearchKeyStatus(status);
      setWebSearchKeyStatusText("Web search key cleared.");
    } catch (err) {
      setWebSearchKeyStatusText(
        err instanceof Error ? err.message : "Failed to clear key.",
      );
    } finally {
      setIsSavingWebSearchKey(false);
    }
  };

  const toolPreferences = useMemo(
    () =>
      TOOL_REGISTRY.filter((tool) => tool.preferences?.showInPreferences).map(
        (tool) => ({
          name: tool.name,
          label:
            tool.preferences?.label ??
            tool.displayName ??
            tool.name.replace(/_/g, " "),
          description: tool.preferences?.description,
          defaultEnabled: tool.preferences?.defaultEnabled ?? true,
          requiresWebSearchKey: tool.preferences?.requiresWebSearchKey ?? false,
          statuses: tool.preferences?.statuses ?? [],
        }),
      ),
    [],
  );

  const resolveToolToggle = (toolName: string, fallback: boolean) => {
    const toggles = config.tools.tool_toggles ?? {};
    if (toolName in toggles) return toggles[toolName];
    if (toolName === "capture_screen_image") {
      return config.tools.capture_screen_text_enabled;
    }
    if (toolName === "web_search") {
      return config.tools.web_search_enabled;
    }
    return fallback;
  };


  return (
    <PanelRoot variant="preferences">
      <PanelStage>
        <PanelFrame
          variant="preferences"
          className="overlay-panel preferences-panel"
        >
          <PanelBody>
            <div>
              <PanelEyebrow>Preferences</PanelEyebrow>
              <PanelTitle>Desktop Copilot</PanelTitle>
              <PanelSubtitle>
                Changes apply immediately where possible.
              </PanelSubtitle>
            </div>

            <PanelStack gap="lg">
              <PanelSectionTitle>Overlay position</PanelSectionTitle>
              <Select
                value={config.corner}
                onValueChange={(value: string) =>
                  setCorner(value as OverlayCorner)
                }
              >
                <SelectTrigger className="overlay-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OVERLAY_CORNERS.map((corner) => (
                    <SelectItem key={corner} value={corner}>
                      {corner.replace("-", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PanelStack>

            <PanelStack gap="md">
              <PanelSectionTitle>Appearance</PanelSectionTitle>
              <PanelStack gap="sm">
                <PanelRow className="items-center justify-between">
                  <PanelFieldLabel>Show reasoning boxes</PanelFieldLabel>
                  <Switch
                    checked={config.appearance.show_thinking}
                    onCheckedChange={(value: boolean) =>
                      setShowThinking(value)
                    }
                  />
                </PanelRow>
              </PanelStack>
              <PanelStack gap="sm">
                <PanelFieldLabel>Panel opacity</PanelFieldLabel>
                <PanelRow>
                  <Slider
                    min={0.6}
                    max={1}
                    step={0.05}
                    value={[config.appearance.panel_opacity]}
                    onValueChange={(value: number[]) => {
                      const next = value[0];
                      if (typeof next === "number") {
                        setPanelOpacity(next);
                      }
                    }}
                    className="overlay-range"
                  />
                  <div className="panel-value">
                    {Math.round(config.appearance.panel_opacity * 100)}%
                  </div>
                </PanelRow>
              </PanelStack>
            </PanelStack>

            <PanelStack gap="md">
              <PanelSectionTitle>Tools</PanelSectionTitle>
              <PanelStack gap="sm">
                {toolPreferences.map((tool) => (
                  <PanelRow
                    key={tool.name}
                    className="items-start justify-between gap-3"
                  >
                    <div className="panel-stack panel-stack--sm">
                      <div className="panel-row panel-row--sm items-center">
                        <PanelFieldLabel>{tool.label}</PanelFieldLabel>
                        {tool.statuses.map((status) => (
                          <StatusChip
                            key={`${tool.name}-${status}`}
                            variant={status}
                            casing="normal"
                          />
                        ))}
                      </div>
                      {tool.description && (
                        <div className="panel-subtle">
                          {tool.description}
                        </div>
                      )}
                    </div>
                    <Switch
                      checked={resolveToolToggle(
                        tool.name,
                        tool.defaultEnabled,
                      )}
                      onCheckedChange={(value: boolean) =>
                        setToolToggle(tool.name, value)
                      }
                    />
                  </PanelRow>
                ))}
                <PanelRow className="items-start justify-between gap-3">
                  <div className="panel-stack panel-stack--sm">
                    <div className="panel-row panel-row--sm items-center">
                      <PanelFieldLabel>Agents SDK</PanelFieldLabel>
                      <StatusChip variant="experimental" casing="normal" />
                    </div>
                    <div className="panel-subtle">
                      Enable the multi-agent runtime for advanced workflows.
                    </div>
                  </div>
                  <Switch
                    checked={config.tools.agents_sdk_enabled}
                    onCheckedChange={(value: boolean) =>
                      setAgentsSdkEnabled(value)
                    }
                  />
                </PanelRow>
              </PanelStack>
              {toolPreferences.some((tool) => tool.requiresWebSearchKey) && (
                <PanelStack gap="sm">
                  <PanelFieldLabel>Web search API key</PanelFieldLabel>
                  <Input
                    type="password"
                    aria-label="Web search API key"
                    value={webSearchKey}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setWebSearchKey(e.target.value)
                    }
                    className="overlay-input"
                    placeholder="Enter OLLAMA_WEB_SEARCH_API_KEY"
                  />
                  <PanelRow className="items-center justify-between gap-2">
                    <div className="panel-subtle">
                      {webSearchKeyStatus?.has_key
                        ? `Key stored (${webSearchKeyStatus.source ?? "saved"}).`
                        : "No key saved."}
                    </div>
                    <div className="panel-row panel-row--sm">
                      <Button
                        size="sm"
                        disabled={isSavingWebSearchKey}
                        onClick={handleSaveWebSearchKey}
                        className="overlay-button"
                      >
                        Save key
                      </Button>
                      <Button
                        size="sm"
                        disabled={isSavingWebSearchKey}
                        onClick={handleClearWebSearchKey}
                        className="overlay-button overlay-button--ghost"
                      >
                        Clear key
                      </Button>
                    </div>
                  </PanelRow>
                  <div className="panel-status">
                    {webSearchKeyStatusText ?? " "}
                  </div>
                </PanelStack>
              )}
            </PanelStack>

            <PanelStack gap="lg">
              <PanelSectionTitle>Shortcuts</PanelSectionTitle>
              <div className="panel-subtle">
                Click a field and press keys to set a shortcut. Backspace clears
                it. Empty shortcuts are disabled. Some macOS combinations are
                reserved by the system (Cmd+Space, Ctrl+Space) and cannot be
                registered.
              </div>
              <PanelStack gap="sm">
                <PanelFieldLabel>Toggle overlay</PanelFieldLabel>
                <KeybindInput
                  aria-label="Toggle overlay shortcut"
                  value={config.keybinds.toggle_overlay}
                  onChange={(value: string) => {
                    clearKeybindError("toggle_overlay");
                    setKeybind("toggle_overlay", value);
                  }}
                  className="overlay-input"
                />
                {keybindErrors.toggle_overlay && (
                  <div className="panel-status">
                    {keybindErrors.toggle_overlay}
                  </div>
                )}
              </PanelStack>
              <PanelStack gap="sm">
                <PanelFieldLabel>Focus overlay</PanelFieldLabel>
                <KeybindInput
                  aria-label="Focus overlay shortcut"
                  value={config.keybinds.focus_overlay}
                  onChange={(value: string) => {
                    clearKeybindError("focus_overlay");
                    setKeybind("focus_overlay", value);
                  }}
                  className="overlay-input"
                />
                {keybindErrors.focus_overlay && (
                  <div className="panel-status">
                    {keybindErrors.focus_overlay}
                  </div>
                )}
              </PanelStack>
              <PanelStack gap="sm">
                <PanelFieldLabel>Stop generation</PanelFieldLabel>
                <KeybindInput
                  aria-label="Stop generation shortcut"
                  value={config.keybinds.stop_generation}
                  onChange={(value: string) =>
                    setKeybind("stop_generation", value)
                  }
                  className="overlay-input"
                />
              </PanelStack>
              <PanelStack gap="sm">
                <PanelFieldLabel>Regenerate last response</PanelFieldLabel>
                <KeybindInput
                  aria-label="Regenerate last response shortcut"
                  value={config.keybinds.regenerate_last_response}
                  onChange={(value: string) =>
                    setKeybind("regenerate_last_response", value)
                  }
                  className="overlay-input"
                />
              </PanelStack>
              <div>
                <Button
                  size="sm"
                  type="button"
                  onClick={resetKeybindsToDefaults}
                  className="overlay-button overlay-button--ghost"
                >
                  Reset shortcuts to defaults
                </Button>
              </div>
            </PanelStack>

          </PanelBody>

          <PanelFooter>
            <div className="panel-status">{status ?? " "}</div>
            <Button
              size="sm"
              disabled={!canSave}
              onClick={handleSave}
              className="bg-white/10 text-white/80 hover:bg-white/20"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </PanelFooter>
        </PanelFrame>
      </PanelStage>
    </PanelRoot>
  );
}
