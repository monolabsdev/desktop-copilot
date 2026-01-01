import type { DocPage } from "../lib/docs-types"

export const installationPage: DocPage = {
  slug: "installation",
  title: "Installation",
  summary: "Install dependencies and prerequisites for local development.",
  sections: [
    {
      id: "requirements",
      title: "Requirements",
      blocks: [
        {
          type: "list",
          content: [
            "Node.js + npm",
            "Rust toolchain (Tauri)",
            "Ollama installed and running locally",
          ],
        },
      ],
    },
    {
      id: "install-deps",
      title: "Install dependencies",
      blocks: [
        {
          type: "code",
          language: "bash",
          content: "npm install",
        },
      ],
    },
    {
      id: "ollama-helper",
      title: "Windows Ollama helper",
      blocks: [
        {
          type: "paragraph",
          content:
            "For Windows debugging, use the helper to run Ollama with permissive origins.",
        },
        {
          type: "code",
          language: "powershell",
          content: "scripts\\start-ollama.ps1",
        },
      ],
    },
  ],
}
