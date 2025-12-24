import { Button, Input, Label, Switch } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_OVERLAY_CONFIG,
  OVERLAY_CORNERS,
  type OverlayConfig,
  type OverlayCorner,
} from "../shared/config";

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="text-xs uppercase tracking-[0.2em] text-white/40">
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <div className="text-xs text-white/60">{children}</div>;
}

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
  const setPanelOpacity = (value: number) =>
    setConfig((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, panel_opacity: value },
    }));
  const setCaptureEnabled = (enabled: boolean) =>
    setConfig((prev) => ({
      ...prev,
      tools: { ...prev.tools, capture_screen_text_enabled: enabled },
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
    <div className="w-screen h-screen m-0 p-0 overflow-hidden bg-linear-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="overlay-root fixed inset-0">
        <div className="absolute inset-0 flex justify-center">
          <div className="w-full max-w-xl h-full flex flex-col overlay-panel">
            <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Preferences
                </div>
                <div className="text-lg text-white/90 mt-2">
                  Desktop Copilot
                </div>
                <div className="text-xs text-white/50 mt-1">
                  Changes apply immediately where possible.
                </div>
              </div>

              <div className="space-y-4">
                <SectionTitle>Overlay position</SectionTitle>
                <select
                  value={config.corner}
                  onChange={(e) => setCorner(e.target.value as OverlayCorner)}
                  className="overlay-select w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
                >
                  {OVERLAY_CORNERS.map((corner) => (
                    <option key={corner} value={corner}>
                      {corner.replace("-", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <SectionTitle>Appearance</SectionTitle>
                <div className="space-y-2">
                  <FieldLabel>Panel opacity</FieldLabel>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0.6"
                      max="1"
                      step="0.05"
                      value={config.appearance.panel_opacity}
                      onChange={(e) => setPanelOpacity(Number(e.target.value))}
                      className="overlay-range"
                    />
                    <div className="text-xs text-white/60 tabular-nums w-12 text-right">
                      {Math.round(config.appearance.panel_opacity * 100)}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <SectionTitle>Shortcuts</SectionTitle>
                <div className="space-y-2">
                  <FieldLabel>Toggle overlay</FieldLabel>
                  <Input
                    aria-label="Toggle overlay shortcut"
                    value={config.keybinds.toggle_overlay}
                    onChange={(e) =>
                      setKeybind("toggle_overlay", e.target.value)
                    }
                    className="overlay-input"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Focus overlay</FieldLabel>
                  <Input
                    aria-label="Focus overlay shortcut"
                    value={config.keybinds.focus_overlay}
                    onChange={(e) =>
                      setKeybind("focus_overlay", e.target.value)
                    }
                    className="overlay-input"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <SectionTitle>Tools</SectionTitle>
                <Switch
                  isSelected={config.tools.capture_screen_text_enabled}
                  onChange={setCaptureEnabled}
                  className="items-center gap-3"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Label className="text-sm text-white/80">
                    Capture active window text
                  </Label>
                </Switch>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 pb-6 pt-2">
              <div className="text-xs text-white/50">{status ?? " "}</div>
              <Button
                size="sm"
                isDisabled={!canSave}
                onPress={handleSave}
                className="bg-white/10 text-white/80 hover:bg-white/20"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
