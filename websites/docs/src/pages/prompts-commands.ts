import type { DocPage } from "../lib/docs-types"

export const promptsCommandsPage: DocPage = {
  slug: "prompts-commands",
  title: "Prompts & Commands",
  summary: "System prompts, clipboard auto-injection, and slash command routing.",
  sections: [
    {
      id: "system-prompt",
      title: "System Prompts",
      blocks: [
        {
          type: "paragraph",
          content:
            "The Ollama chat hook defines OLLAMA_INSTRUCTIONS, and the Agents SDK hook defines AGENT_INSTRUCTIONS. Keep them aligned to avoid divergent behavior.",
        },
        {
          type: "code",
          language: "ts",
          content:
            "const OLLAMA_INSTRUCTIONS = \"You are a fast, minimal desktop assistant...\";\nconst AGENT_INSTRUCTIONS = \"You are a fast, minimal desktop assistant...\";",
        },
      ],
    },
    {
      id: "clipboard-injection",
      title: "Clipboard Auto-Injection",
      blocks: [
        {
          type: "paragraph",
          content:
            "Clipboard context is injected when prompts look like reviews, bugfixes, or debugging requests and the clipboard looks code-like.",
        },
        {
          type: "code",
          language: "ts",
          content:
            "const requestSignals = /review|fix|debug|error|exception|stack trace|log/;\nconst mentionsCode = /code|script|function|class|module|component|file/;\nconst refersToContext = /this|that|these|it/;",
        },
      ],
    },
    {
      id: "slash-commands",
      title: "Slash Command Routing",
      blocks: [
        {
          type: "paragraph",
          content:
            "Commands are parsed in parseCommand, routed via handleChatCommand, and implemented in the registry (clear, corner).",
        },
        {
          type: "code",
          language: "ts",
          content:
            "// src/overlay/commands/registry.ts\nexport const commandHandlers = [clearCommand, cornerCommand];",
        },
      ],
    },
  ],
}
