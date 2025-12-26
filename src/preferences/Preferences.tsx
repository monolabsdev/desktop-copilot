import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function Preferences() {
  const [config, setConfig] = useState<OverlayConfig>(DEFAULT_OVERLAY_CONFIG);
  const [initialConfig, setInitialConfig] = useState<OverlayConfig>(
    DEFAULT_OVERLAY_CONFIG,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);

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

  const setCorner = (corner: OverlayCorner) =>
    setConfig((prev) => ({ ...prev, corner }));
  const setKeybind = (key: "toggle_overlay" | "focus_overlay", value: string) =>
    setConfig((prev) => ({
      ...prev,
      keybinds: { ...prev.keybinds, [key]: value },
    }));
  // When adding a new config field, add a setter and UI control here so it
  // stays in sync with DEFAULT_OVERLAY_CONFIG and the Rust config structs.
  const setPanelOpacity = (value: number) =>
    setConfig((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, panel_opacity: value },
    }));
  const setShowThinking = (enabled: boolean) =>
    setConfig((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, show_thinking: enabled },
    }));
  const setCaptureEnabled = (enabled: boolean) =>
    setConfig((prev) => ({
      ...prev,
      tools: { ...prev.tools, capture_screen_text_enabled: enabled },
    }));
  const setAgentEnabled = (enabled: boolean) =>
    setConfig((prev) => ({
      ...prev,
      tools: { ...prev.tools, agent_enabled: enabled },
    }));

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
              <PanelRow>
                <Switch
                  id="show-thinking"
                  checked={config.appearance.show_thinking}
                  onCheckedChange={setShowThinking}
                />
                <Label htmlFor="show-thinking" className="panel-label">
                  Show reasoning blocks
                </Label>
              </PanelRow>
            </PanelStack>

            <PanelStack gap="lg">
              <PanelSectionTitle>Shortcuts</PanelSectionTitle>
              <PanelStack gap="sm">
                <PanelFieldLabel>Toggle overlay</PanelFieldLabel>
                <Input
                  aria-label="Toggle overlay shortcut"
                  value={config.keybinds.toggle_overlay}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setKeybind("toggle_overlay", e.target.value)
                  }
                  className="overlay-input"
                />
              </PanelStack>
              <PanelStack gap="sm">
                <PanelFieldLabel>Focus overlay</PanelFieldLabel>
                <Input
                  aria-label="Focus overlay shortcut"
                  value={config.keybinds.focus_overlay}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setKeybind("focus_overlay", e.target.value)
                  }
                  className="overlay-input"
                />
              </PanelStack>
            </PanelStack>

            <PanelStack gap="md">
              <PanelSectionTitle>Tools</PanelSectionTitle>
              <PanelRow>
                <Switch
                  id="capture-screen-text"
                  checked={config.tools.capture_screen_text_enabled}
                  onCheckedChange={setCaptureEnabled}
                />
                <Label htmlFor="capture-screen-text" className="panel-label">
                  Capture active window text
                </Label>
                <StatusChip variant="beta" />
              </PanelRow>
              <PanelRow>
                <Switch
                  id="agent-enabled"
                  checked={config.tools.agent_enabled}
                  onCheckedChange={setAgentEnabled}
                />
                <Label htmlFor="agent-enabled" className="panel-label">
                  Enable agent mode (file access)
                </Label>
                <StatusChip variant="experimental" />
              </PanelRow>
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
