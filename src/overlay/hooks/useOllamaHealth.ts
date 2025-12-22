import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { ollamaHealthCheck } from "../ollama/client";

export function useOllamaHealth() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    // Backend emits this event when startup health check fails.
    listen<{ ok: boolean; error?: string }>("ollama:health", (event) => {
      if (event.payload?.ok) return;
      setError(event.payload?.error ?? "Ollama unreachable.");
      setIsOpen(true);
    }).then((handler) => {
      unlisten = handler;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    // Kick an explicit check on mount in case the event fires before the UI is ready.
    setIsChecking(true);
    ollamaHealthCheck()
      .then(() => {
        setError(null);
        setIsOpen(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Ollama unreachable.");
        setIsOpen(true);
      })
      .finally(() => {
        setIsChecking(false);
      });
  }, []);

  const handleRetry = useCallback(async () => {
    setIsChecking(true);
    try {
      await ollamaHealthCheck();
      setError(null);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ollama unreachable.");
      setIsOpen(true);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    await openUrl("https://ollama.com/download");
  }, []);

  return {
    isOpen,
    error,
    isChecking,
    handleRetry,
    handleDownload,
  };
}
