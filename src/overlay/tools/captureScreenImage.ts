import type { Tool } from "ollama";

export const CAPTURE_SCREEN_IMAGE_TOOL: Tool = {
  type: "function",
  function: {
    name: "capture_screen_image",
    description:
      "Capture a screenshot of the current screen. Requires explicit user approval and returns image + metadata.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};
