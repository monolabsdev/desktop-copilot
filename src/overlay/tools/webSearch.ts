import type { Tool } from "ollama";

export const WEB_SEARCH_TOOL: Tool = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for fresh information and return concise, relevant results.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to run.",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return.",
        },
      },
      required: ["query"],
    },
  },
};
