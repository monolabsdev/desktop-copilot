import type { DocPage } from "../lib/docs-types"

export const toolsAiPage: DocPage = {
  slug: "tools-ai",
  title: "Tools & AI Integration",
  summary:
    "Tool scaffolding, registry wiring, and runtime plumbing for Ollama + Agents SDK.",
  sections: [
    {
      id: "tool-template",
      title: "Create a Tool Schema",
      blocks: [
        {
          type: "paragraph",
          content:
            "Copy the tool template, rename the constants, and define the schema the model can call.",
        },
        {
          type: "code",
          language: "ts",
          content:
            "// src/overlay/tools/toolTemplate.ts\nexport const EXAMPLE_TOOL_NAME = \"example_tool\";\n\nexport const EXAMPLE_TOOL_SCHEMA = {\n  type: \"function\",\n  function: {\n    name: EXAMPLE_TOOL_NAME,\n    description: \"Describe the tool and when the model should call it.\",\n    parameters: {\n      type: \"object\",\n      properties: {},\n      required: [],\n    },\n  },\n};",
        },
      ],
    },
    {
      id: "tool-registry",
      title: "Register the Tool",
      blocks: [
        {
          type: "paragraph",
          content:
            "Add a RegisteredTool entry with labels, preferences metadata, and handler. Use isEnabled to gate it via config.",
        },
        {
          type: "code",
          language: "ts",
          content:
            "const exampleTool = {\n  name: EXAMPLE_TOOL_NAME,\n  tool: EXAMPLE_TOOL_SCHEMA,\n  displayName: \"example tool\",\n  activityLabel: \"Running example tool...\",\n  completedLabel: \"Example tool done.\",\n  preferences: {\n    label: \"Example tool\",\n    description: \"Describe what this tool does.\",\n    defaultEnabled: true,\n    showInPreferences: true,\n  },\n  isEnabled: (options) => isToolEnabled(EXAMPLE_TOOL_NAME, options),\n  handler: async ({ toolCalls, toolCall, buildToolMessage, streamFollowup }) => {\n    const result = { ok: true };\n    const toolMessage = buildToolMessage(EXAMPLE_TOOL_NAME, result);\n    await streamFollowup([], toolCalls, toolMessage, []);\n    return true;\n  },\n};",
        },
      ],
    },
    {
      id: "tool-preferences",
      title: "Expose in Preferences",
      blocks: [
        {
          type: "paragraph",
          content:
            "Preferences build their tool list from TOOL_REGISTRY, filtering for preferences.showInPreferences. Keep setToolToggle and toolPreferences in sync in Preferences.tsx.",
        },
        {
          type: "code",
          language: "ts",
          content:
            "// src/preferences/Preferences.tsx\nconst toolPreferences = useMemo(\n  () => TOOL_REGISTRY.filter((tool) => tool.preferences?.showInPreferences),\n  [],\n);",
        },
      ],
    },
    {
      id: "tool-plumbing",
      title: "Tool Execution Path",
      blocks: [
        {
          type: "list",
          content: [
            "useOllamaChat -> createToolHandler -> tools.ts",
            "tool registry handler -> buildToolMessage -> streamFollowup",
            "screenshot queueing in src/overlay/hooks/ollama/screenshot.ts",
            "Agents SDK tools defined inside useAgentsSdkChat",
          ],
        },
      ],
    },
  ],
}
