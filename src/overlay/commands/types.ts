import type { Message } from "ollama";

export type CommandContext = {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
};

export type CommandExecution =
  | {
      status: "success";
      reply?: string;
      clearInput?: boolean;
      clearHistory?: boolean;
    }
  | { status: "error"; error: string };

export type CommandHandler = {
  name: string;
  usage: string;
  execute: (args: string[], context: CommandContext) => Promise<CommandExecution>;
};

export type ParsedCommand = {
  name: string;
  args: string[];
  raw: string;
};

export type CommandHandlingResult =
  | { handled: false }
  | {
      handled: true;
      error?: string;
      messages?: Message[];
      clearInput?: boolean;
      clearHistory?: boolean;
    };
