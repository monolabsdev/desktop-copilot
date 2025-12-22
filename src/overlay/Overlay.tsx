import { Button } from "@heroui/react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";
import { useOllamaChat } from "./hooks/useOllamaChat";
import { useOverlayHotkeys } from "./hooks/useOverlayHotkeys";
import { DEFAULT_MODEL } from "./constants";

export function Overlay() {
  useOverlayHotkeys();

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen("overlay:shown", () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }).then((handler) => {
      unlisten = handler;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const {
    messages,
    input,
    setInput,
    isSending,
    error,
    sendMessage,
    cancelSend,
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
          <MessageList messages={messages} />

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
            onCancel={cancelSend}
            inputRef={inputRef}
          />
        </div>
      </div>
    </div>
  );
}
