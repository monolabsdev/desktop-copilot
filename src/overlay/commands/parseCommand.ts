import type { ParsedCommand } from "./types";

export function parseCommand(input: string): ParsedCommand | null {
  if (!input.startsWith("/")) return null;
  const parts = input.trim().split(/\s+/);
  const name = parts[0];
  const args = parts.slice(1);
  return { name, args, raw: input };
}
