import { OVERLAY_CORNERS, type OverlayCorner } from "../../constants";
import type { CommandContext, CommandExecution, CommandHandler } from "../types";

export const cornerCommand: CommandHandler = {
  name: "/corner",
  usage: "/corner top-left",
  async execute(
    args: string[],
    context: CommandContext,
  ): Promise<CommandExecution> {
    const [arg] = args;

    if (!arg) {
      return { status: "error", error: "Usage: /corner top-left" };
    }

    const normalized = arg.toLowerCase() as OverlayCorner;
    if (!OVERLAY_CORNERS.includes(normalized)) {
      return {
        status: "error",
        error: `Unknown corner "${arg}". Use: ${OVERLAY_CORNERS.join(", ")}.`,
      };
    }

    await context.invoke("set_overlay_corner", { corner: normalized });

    return {
      status: "success",
      reply: `Overlay moved to ${normalized}.`,
    };
  },
};
