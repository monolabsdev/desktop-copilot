import type { Tool } from "ollama";

export const CAPTURE_SCREEN_TEXT_TOOL: Tool = {
  type: "function",
  function: {
    name: "capture_screen_text",
    description:
      "Capture on-screen text via OCR. Requires explicit user approval and returns text + metadata only.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};
