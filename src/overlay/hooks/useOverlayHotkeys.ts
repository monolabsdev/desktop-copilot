import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { matchesKeybinding } from "@/shared/keybindings";

type OverlayHotkeysOptions = {
  keybinds?: {
    stop_generation?: string;
    regenerate_last_response?: string;
  };
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

      if (matchesKeybinding(e, options.keybinds?.stop_generation)) {
        e.preventDefault();
        options.onStop?.();
        return;
      }

      if (matchesKeybinding(e, options.keybinds?.regenerate_last_response)) {
        e.preventDefault();
        options.onRegenerate?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [options.keybinds?.regenerate_last_response, options.keybinds?.stop_generation, options.onRegenerate, options.onStop]);
}
