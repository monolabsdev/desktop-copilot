# Desktop Copilot (Tauri + React + TypeScript)

An always-on-top AI overlay for your desktop. The UI is React/Vite, the backend
is Tauri (Rust), and all AI requests are routed through the backend to a local
Ollama server.

Important: Ollama is not bundled. You must install and run it yourself.

## Quick start

Requirements:
- Node.js + npm
- Rust toolchain (for Tauri)
- Ollama installed and running locally

Install:
```bash
npm install
```

Development:
```bash
npm run tauri dev
```

Build:
```bash
npm run tauri build
```

## Ollama integration (required)

This app does not call Ollama from the frontend. All requests are proxied through
the Tauri backend. On startup, the backend checks `http://localhost:11434/api/tags`.

If Ollama is not reachable, you will see a modal with:
- Download Ollama
- Retry

Helper script (Windows) to start Ollama with permissive origins:
```powershell
scripts\start-ollama.ps1
```

Notes:
- The backend logs real connection errors (refused, timeout, non-200).
- If you use a different host/port, update `src-tauri/src/ollama.rs`.

## Config

The app reads and writes a JSON config file at the Tauri app config dir:

- Windows: `%APPDATA%\ai-copilot\config.json`

Example:

```json
{
  "corner": "top-right",
  "keybinds": {
    "toggle_overlay": "Ctrl+Space",
    "focus_overlay": "Ctrl+Shift+Space"
  },
  "tools": {
    "capture_screen_text_enabled": true
  }
}
```

Notes:
- `corner` accepts `top-left`, `top-right`, `bottom-left`, `bottom-right`.
- `keybinds` lets you customize global shortcuts. Restart the app after editing.

## OCR support

The `capture_screen_text` tool captures the active window only. Windows uses
Windows Media OCR and may prompt for a language pack if one is missing.

## Troubleshooting

- Ollama unreachable:
  - Make sure `ollama serve` is running on `http://localhost:11434`.
  - Use the in-app Retry button to re-check availability.
- Model missing:
  - Pull the model you want in Ollama or change `src/overlay/constants.ts`.
- No AI responses in release builds:
  - Check the app logs; the backend reports real connection errors.

## Warnings

- This app captures text from the active window when you approve it. Treat it
  like a screen recorder: only use it where you have permission.
- The AI runs locally via Ollama. Large models are slow and memory-heavy.
- Global hotkeys can conflict with other apps. Adjust them in the config.

## Disclaimer (read this if you plan to hack on it)

This project is intentionally minimal and leans on some lazy programming
practices that will make your eyes water. Expect rough edges, shortcuts, and
few guardrails. Use at your own risk.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
