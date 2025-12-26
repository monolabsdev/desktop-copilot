import type { ParsedCommand } from "./types";

export function parseCommand(input: string): ParsedCommand | null {
  // Commands are prefixed with "/" to avoid colliding with natural chat text.
  if (!input.startsWith("/")) return null;
  const parts = input.trim().split(/\s+/);
  const name = parts[0];
  const args = parts.slice(1);
  return { name, args, raw: input };
}
