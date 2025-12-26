import type { CommandHandler } from "./types";
import { clearCommand } from "./commands/clear";
import { cornerCommand } from "./commands/corner";

export const commandHandlers: CommandHandler[] = [clearCommand, cornerCommand];
