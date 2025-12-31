import { useEffect } from "react";
import { listen, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event";

export function useTauriEvent<T>(eventName: string, handler: EventCallback<T>) {
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let active = true;

    listen<T>(eventName, handler)
      .then((unsubscribe) => {
        if (!active) {
          unsubscribe();
          return;
        }
        unlisten = unsubscribe;
      })
      .catch(() => {
        // Ignore failed registration; caller can still rely on direct invoke.
      });

    return () => {
      active = false;
      if (unlisten) unlisten();
    };
  }, [eventName, handler]);
}
