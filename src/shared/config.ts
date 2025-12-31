// Allowed overlay anchor points; must match Rust's OverlayCorner enum.
export const OVERLAY_CORNERS = [
  "bottom-left",
  "bottom-middle",
  "bottom-right",
] as const;

export type OverlayCorner = (typeof OVERLAY_CORNERS)[number];

// Persisted overlay settings shared between the UI and Tauri backend.
export type OverlayConfig = {
  corner: OverlayCorner;
  keybinds: {
    toggle_overlay: string;
    focus_overlay: string;
    stop_generation: string;
    regenerate_last_response: string;
  };
  appearance: {
    panel_opacity: number;
    show_thinking: boolean;
  };
  tools: {
    capture_screen_text_enabled: boolean;
    web_search_enabled: boolean;
    agents_sdk_enabled: boolean;
    tool_toggles: Record<string, boolean>;
  };
};

// To add a new config field, keep these in sync with `src-tauri/src/config.rs`:
// 1) Update OverlayConfig + DEFAULT_OVERLAY_CONFIG here.
// 2) Add UI wiring in `src/preferences/Preferences.tsx` if editable.
// 3) Add serde defaults + Default impls in Rust.

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  corner: "bottom-middle",
  keybinds: {
    toggle_overlay: "Ctrl+Space",
    focus_overlay: "Ctrl+Shift+Space",
    stop_generation: "Ctrl+.",
    regenerate_last_response: "Ctrl+Shift+R",
  },
  appearance: {
    panel_opacity: 0.85,
    show_thinking: true,
  },
  tools: {
    capture_screen_text_enabled: true,
    web_search_enabled: false,
    agents_sdk_enabled: false,
    tool_toggles: {},
  },
};
