export const DEFAULT_MODEL = "gpt-oss:20b-cloud";
export const OVERLAY_CORNERS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
export type OverlayCorner = (typeof OVERLAY_CORNERS)[number];
