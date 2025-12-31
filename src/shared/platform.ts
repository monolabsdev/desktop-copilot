export type PanelOpacityRange = {
  min: number;
  max: number;
};

const MAC_PANEL_OPACITY_RANGE: PanelOpacityRange = { min: 0.3, max: 0.6 };
const DEFAULT_PANEL_OPACITY_RANGE: PanelOpacityRange = { min: 0.6, max: 1 };

function navigatorInfo() {
  if (typeof navigator === "undefined") {
    return { platform: "", userAgent: "" };
  }
  return {
    platform: navigator.platform ?? "",
    userAgent: navigator.userAgent ?? "",
  };
}

export function isMacPlatform(): boolean {
  const { platform, userAgent } = navigatorInfo();
  const normalizedPlatform = platform.toLowerCase();
  const normalizedUserAgent = userAgent.toLowerCase();
  return (
    normalizedPlatform.includes("mac") ||
    normalizedUserAgent.includes("mac os x") ||
    normalizedUserAgent.includes("macintosh")
  );
}

export function getPanelOpacityRange(): PanelOpacityRange {
  return isMacPlatform()
    ? MAC_PANEL_OPACITY_RANGE
    : DEFAULT_PANEL_OPACITY_RANGE;
}

export function clampPanelOpacity(
  value: number,
  range?: PanelOpacityRange,
): number {
  const { min, max } = range ?? getPanelOpacityRange();
  return Math.min(max, Math.max(min, value));
}
