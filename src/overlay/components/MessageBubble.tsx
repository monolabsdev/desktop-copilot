// import { Chip } from "@heroui/react";
import type { Message } from "ollama";

interface Props {
  message: Message;
  model: string;
}
// add model back in here for the chip:
export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className="max-w-[85%] space-y-1">
        {/* todo: make this look better. */}
        {/*<Chip size="sm" className="bg-white/10 text-white/80">
          {isUser ? "You" : model}
        </Chip>*/}
        <div
          className={
            isUser
              ? "rounded-lg bg-white/15 text-white px-3 py-2 text-sm"
              : "rounded-lg bg-black/40 text-white px-3 py-2 text-sm"
          }
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
