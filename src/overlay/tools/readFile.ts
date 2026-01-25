import type { Tool } from "ollama";

export const READ_FILE_TOOL_NAME = "read_file";

export const READ_FILE_TOOL: Tool = {
  type: "function",
  function: {
    name: READ_FILE_TOOL_NAME,
    description: "Read a small text file from disk for context.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute or project-relative file path to read.",
        },
      },
      required: ["path"],
    },
  },
};
