import type { Tool } from "ollama";

export const CLIPBOARD_CONTEXT_TOOL_NAME = "clipboard_context";

export const CLIPBOARD_CONTEXT_TOOL: Tool = {
  type: "function",
  function: {
    name: CLIPBOARD_CONTEXT_TOOL_NAME,
    description:
      "Read the user's clipboard text to provide extra context when it helps. " +
      "Use only when the clipboard likely contains relevant info the user expects.",
    parameters: {
      type: "object",
      properties: {
        max_chars: {
          type: "number",
          description:
            "Maximum number of characters to read from the clipboard.",
        },
      },
      required: [],
    },
  },
};
