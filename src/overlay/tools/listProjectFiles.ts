import type { Tool } from "ollama";

export const LIST_PROJECT_FILES_TOOL_NAME = "list_project_files";

export const LIST_PROJECT_FILES_TOOL: Tool = {
  type: "function",
  function: {
    name: LIST_PROJECT_FILES_TOOL_NAME,
    description:
      "List files under a project root so the assistant can choose where to read/write.",
    parameters: {
      type: "object",
      properties: {
        root: {
          type: "string",
          description: "Project root path. Defaults to the app working directory.",
        },
        max_files: {
          type: "number",
          description: "Max number of files to return.",
        },
      },
    },
  },
};
