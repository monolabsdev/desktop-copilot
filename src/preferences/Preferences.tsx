import { Button, Input, Label, Switch } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";

type OverlayCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type OverlayConfig = {
  corner: OverlayCorner;
  keybinds: {
    toggle_overlay: string;
    focus_overlay: string;
  };
  tools: {
    capture_screen_text_enabled: boolean;
  };
};

const DEFAULT_CONFIG: OverlayConfig = {
  corner: "top-right",
  keybinds: {
    toggle_overlay: "Ctrl+Space",
    focus_overlay: "Ctrl+Shift+Space",
  },
  tools: {
    capture_screen_text_enabled: true,
  },
};

export function Preferences() {
  const [config, setConfig] = useState<OverlayConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    invoke<OverlayConfig>("get_overlay_config")
      .then((loaded) => {
        if (active) {
          setConfig(loaded);
        }
      })
      .catch(() => {
        if (active) {
          setConfig(DEFAULT_CONFIG);
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
  const setCaptureEnabled = (enabled: boolean) =>
    setConfig((prev) => ({
      ...prev,
      tools: { ...prev.tools, capture_screen_text_enabled: enabled },
    }));

  const canSave = useMemo(() => !isLoading && !isSaving, [isLoading, isSaving]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      await invoke("set_overlay_config", { config });
      setStatus("Saved.");
      setTimeout(() => setStatus(null), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save.";
      setStatus(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-screen h-screen m-0 p-0 overflow-hidden bg-black">
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
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Overlay position
                </div>
                <select
                  value={config.corner}
                  onChange={(e) => setCorner(e.target.value as OverlayCorner)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
                >
                  <option value="top-left">Top left</option>
                  <option value="top-right">Top right</option>
                  <option value="bottom-left">Bottom left</option>
                  <option value="bottom-right">Bottom right</option>
                </select>
              </div>

              <div className="space-y-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Shortcuts
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-white/60">Toggle overlay</div>
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
                  <div className="text-xs text-white/60">Focus overlay</div>
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
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Tools
                </div>
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
