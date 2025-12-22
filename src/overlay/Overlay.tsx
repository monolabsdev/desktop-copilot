import { Button } from "@heroui/react";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";
import { useOllamaChat } from "./hooks/useOllamaChat";
import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

const DEFAULT_MODEL = "gpt-oss:20b-cloud";

export function Overlay() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        invoke("toggle_overlay");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const {
    messages,
    input,
    setInput,
    isSending,
    error,
    sendMessage,
    clearHistory,
  } = useOllamaChat(DEFAULT_MODEL);
  return (
    <div className="overlay-root fixed inset-0 pointer-events-none backdrop-blur-2xl">
      <div className="absolute inset-0 flex justify-center">
        <div className="w-full max-w-2xl h-full flex flex-col pointer-events-auto">
          {/* Header */}
          <div className="flex justify-end px-4 pt-4">
            <Button
              size="sm"
              onPress={clearHistory}
              isDisabled={messages.length === 0 || isSending}
              className="bg-white/10 text-white/70"
            >
              Clear history
            </Button>
          </div>

          {/* Messages */}
          <MessageList messages={messages} model={DEFAULT_MODEL} />

          {/* Error */}
          {error && (
            <div className="px-4 pb-2 text-sm text-red-400">{error}</div>
          )}

          {/* Input */}
          <ChatInput
            input={input}
            setInput={setInput}
            isSending={isSending}
            onSend={sendMessage}
          />
        </div>
      </div>
    </div>
  );
}
