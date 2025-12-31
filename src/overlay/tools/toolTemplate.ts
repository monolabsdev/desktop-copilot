import type { Tool } from "ollama";

// Copy this file, rename the constants, and implement your tool schema.
// The handler lives in src/overlay/tools/registry.ts.

export const EXAMPLE_TOOL_NAME = "example_tool";

export const EXAMPLE_TOOL_SCHEMA: Tool = {
  type: "function",
  function: {
    name: EXAMPLE_TOOL_NAME,
    description:
      "Describe the tool and when the model should call it. Mention limits.",
    parameters: {
      type: "object",
      properties: {
        // Example:
        // query: { type: "string", description: "What to look up." },
      },
      required: [],
    },
  },
};
