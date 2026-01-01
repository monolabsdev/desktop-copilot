import type { DocPage } from "../lib/docs-types"

export const quickStartPage: DocPage = {
  slug: "quick-start",
  title: "Quick Start",
  summary: "Run the program in your IDE and validate the overlay.",
  sections: [
    {
      id: "run-dev",
      title: "Run in dev mode",
      blocks: [
        {
          type: "paragraph",
          content:
            "Use the Tauri dev script to launch the UI and Rust backend together.",
        },
        {
          type: "code",
          language: "bash",
          content: "npm run tauri dev",
        },
      ],
    },
    {
      id: "ollama-running",
      title: "Confirm Ollama is running",
      blocks: [
        {
          type: "paragraph",
          content:
            "The backend checks http://localhost:11434/api/tags on startup. If Ollama is down, the overlay will prompt for retry.",
        },
      ],
    },
    {
      id: "view-routing",
      title: "Overlay vs. Preferences",
      blocks: [
        {
          type: "paragraph",
          content:
            "The renderer switches views based on the query param. Preferences renders when ?view=preferences is present.",
        },
        {
          type: "code",
          language: "tsx",
          content:
            "// src/app/App.tsx\nconst view = new URLSearchParams(window.location.search).get(\"view\");\nconst isPreferencesView = view === \"preferences\";",
        },
      ],
    },
  ],
}
