import type { CommandExecution, CommandHandler } from "../types";

export const clearCommand: CommandHandler = {
  name: "/clear",
  usage: "/clear",
  async execute(): Promise<CommandExecution> {
    return {
      status: "success",
      clearHistory: true,
    };
  },
};
