import type { DocPage } from "../lib/docs-types"

export const introductionPage: DocPage = {
  slug: "introduction",
  title: "Introduction",
  summary:
    "Desktop Copilot is an always-on-top AI overlay built with Tauri, React, and TypeScript.",
  sections: [
    {
      id: "overview",
      title: "Overview",
      blocks: [
        {
          type: "paragraph",
          content:
            "Desktop Copilot is an always-on-top AI overlay for your desktop. The UI is React/Vite, the backend is Tauri (Rust), and all AI requests are routed through the backend to a local Ollama server.",
        },
        {
          type: "paragraph",
          content:
            "This documentation is intended for engineers contributing to the UI shell, tool runtime, and native Tauri bridge.",
        },
      ],
    },
    {
      id: "architecture",
      title: "High-level architecture",
      blocks: [
        {
          type: "list",
          content: [
            "React UI in the overlay and preferences window",
            "Tauri backend for system access and config persistence",
            "Ollama proxy for local AI inference and streaming",
          ],
        },
      ],
    },
  ],
}
