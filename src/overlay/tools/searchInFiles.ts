import type { Tool } from "ollama";

export const SEARCH_IN_FILES_TOOL_NAME = "search_in_files";

export const SEARCH_IN_FILES_TOOL: Tool = {
  type: "function",
  function: {
    name: SEARCH_IN_FILES_TOOL_NAME,
    description:
      "Search for a string across project files to locate relevant code.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Text to search for.",
        },
        root: {
          type: "string",
          description: "Project root path. Defaults to the app working directory.",
        },
        max_results: {
          type: "number",
          description: "Max number of matches to return.",
        },
        case_insensitive: {
          type: "boolean",
          description: "Use case-insensitive matching.",
        },
      },
      required: ["query"],
    },
  },
};
