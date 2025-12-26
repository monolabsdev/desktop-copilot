import { invoke } from "@tauri-apps/api/core";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

type ReadFileResponse = {
  path: string;
  bytes: number;
  content: string;
};

const readFileSchema = z.object({
  path: z.string().describe("Absolute path to a local text file."),
});

export function createReadFileTool() {
  return new DynamicStructuredTool({
    name: "read_file",
    description:
      "Read a local text file from disk. Use when the user asks to inspect a file.",
    schema: readFileSchema,
    func: async ({ path }) => {
      const response = await invoke<ReadFileResponse>("read_file", { path });
      // LangChain tools return strings to the model.
      return JSON.stringify(response);
    },
  });
}
