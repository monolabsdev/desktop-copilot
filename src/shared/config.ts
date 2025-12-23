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
  };
  tools: {
    capture_screen_text_enabled: boolean;
  };
};

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  corner: "top-right",
  keybinds: {
    toggle_overlay: "Ctrl+Space",
    focus_overlay: "Ctrl+Shift+Space",
  },
  appearance: {
    panel_opacity: 0.85,
  },
  tools: {
    capture_screen_text_enabled: true,
  },
};
