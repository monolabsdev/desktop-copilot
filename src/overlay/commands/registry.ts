import type { CommandHandler } from "./types";
import { cornerCommand } from "./commands/corner";

export const commandHandlers: CommandHandler[] = [cornerCommand];
