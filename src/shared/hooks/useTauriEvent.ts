import { useEffect } from "react";
import { listen, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event";

export function useTauriEvent<T>(eventName: string, handler: EventCallback<T>) {
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen<T>(eventName, handler).then((unsubscribe) => {
      unlisten = unsubscribe;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [eventName, handler]);
}
