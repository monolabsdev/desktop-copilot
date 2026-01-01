import type { DocPage } from "../lib/docs-types"

export const backendApiPage: DocPage = {
  slug: "backend-api",
  title: "Backend APIs",
  summary: "Tauri commands, events, and Ollama proxy behavior used by the UI.",
  sections: [
    {
      id: "tauri-commands",
      title: "Tauri Commands",
      blocks: [
        {
          type: "paragraph",
          content:
            "Commands are registered in src-tauri/src/main.rs and invoked from the UI via @tauri-apps/api/core.",
        },
        {
          type: "code",
          language: "ts",
          content:
            "import { invoke } from \"@tauri-apps/api/core\";\n\nawait invoke(\"set_overlay_visibility\", { visible: true });\nawait invoke(\"capture_screen_image\");\nawait invoke(\"ollama_chat_stream\", { request, streamId });",
        },
      ],
    },
    {
      id: "tauri-events",
      title: "Event Channel",
      blocks: [
        {
          type: "paragraph",
          content:
            "Events surface backend state like config updates and shortcut errors. Subscribe with @tauri-apps/api/event.",
        },
        {
          type: "code",
          language: "ts",
          content:
            "import { listen } from \"@tauri-apps/api/event\";\n\nlisten(\"config:updated\", (event) => {\n  console.log(event.payload);\n});\n\nlisten(\"shortcuts:registration_failed\", (event) => {\n  console.error(event.payload);\n});",
        },
      ],
    },
    {
      id: "ollama-proxy",
      title: "Ollama Proxy",
      blocks: [
        {
          type: "paragraph",
          content:
            "The backend proxies Ollama chat requests and normalizes image paths into base64. Streaming uses ollama:chunk events from src-tauri/src/ollama.rs.",
        },
      ],
    },
    {
      id: "secrets",
      title: "Secrets and Web Search",
      blocks: [
        {
          type: "paragraph",
          content:
            "The web search API key is stored in the OS keychain via src-tauri/src/secrets.rs and updated from Preferences.",
        },
        {
          type: "code",
          language: "ts",
          content:
            "await invoke(\"set_ollama_web_search_api_key\", { key });\nawait invoke(\"clear_ollama_web_search_api_key\");",
        },
      ],
    },
  ],
}
