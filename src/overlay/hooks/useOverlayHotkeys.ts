import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

type OverlayHotkeysOptions = {
  onStop?: () => void;
  onRegenerate?: () => void;
};

export function useOverlayHotkeys(options: OverlayHotkeysOptions = {}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape closes the overlay without the global shortcut.
      if (e.key === "Escape") {
        invoke("toggle_overlay").catch(() => null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === ".") {
        e.preventDefault();
        options.onStop?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        options.onRegenerate?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [options.onRegenerate, options.onStop]);
}
