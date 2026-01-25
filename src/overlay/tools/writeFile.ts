import type { Tool } from "ollama";

export const WRITE_FILE_TOOL_NAME = "write_file";

export const WRITE_FILE_TOOL: Tool = {
  type: "function",
  function: {
    name: WRITE_FILE_TOOL_NAME,
    description:
      "Write text to a file. Overwrites by default; set append=true to append. " +
      "Create parent directories when needed. Use for making code changes.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute or project-relative file path to write.",
        },
        content: {
          type: "string",
          description: "Text content to write to the file.",
        },
        append: {
          type: "boolean",
          description: "Append to the file instead of overwriting.",
        },
        create_dirs: {
          type: "boolean",
          description: "Create parent directories if they do not exist.",
        },
      },
      required: ["path", "content"],
    },
  },
};
