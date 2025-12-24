export const OVERLAY_CORNERS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export type OverlayCorner = (typeof OVERLAY_CORNERS)[number];

export type OverlayConfig = {
  corner: OverlayCorner;
  keybinds: {
    toggle_overlay: string;
    focus_overlay: string;
  };
  appearance: {
    panel_opacity: number;
    show_thinking: boolean;
  };
  tools: {
    capture_screen_text_enabled: boolean;
  };
};

// To add a new config field, keep these in sync with `src-tauri/src/config.rs`:
// 1) Update OverlayConfig + DEFAULT_OVERLAY_CONFIG here.
// 2) Add UI wiring in `src/preferences/Preferences.tsx` if editable.
// 3) Add serde defaults + Default impls in Rust.

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  corner: "top-right",
  keybinds: {
    toggle_overlay: "Ctrl+Space",
    focus_overlay: "Ctrl+Shift+Space",
  },
  appearance: {
    panel_opacity: 0.85,
    show_thinking: true,
  },
  tools: {
    capture_screen_text_enabled: true,
  },
};
