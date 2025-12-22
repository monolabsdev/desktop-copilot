import type { Message } from "ollama";
import type { CommandContext, CommandHandlingResult } from "./types";
import { parseCommand } from "./parseCommand";
import { commandHandlers } from "./registry";

export async function handleChatCommand(
  input: string,
  context: CommandContext,
): Promise<CommandHandlingResult> {
  const parsed = parseCommand(input);
  if (!parsed) return { handled: false };

  const handler = commandHandlers.find((entry) => entry.name === parsed.name);
  if (!handler) {
    return {
      handled: true,
      error: "Unknown command. Try /corner top-left.",
    };
  }

  try {
    const result = await handler.execute(parsed.args, context);
    if (result.status === "error") {
      return { handled: true, error: result.error };
    }

    const messages: Message[] = [
      { role: "user", content: parsed.raw },
      { role: "assistant", content: result.reply },
    ];

    return {
      handled: true,
      messages,
      clearInput: result.clearInput ?? true,
    };
  } catch (err) {
    return {
      handled: true,
      error: err instanceof Error ? err.message : "Command failed.",
    };
  }
}
