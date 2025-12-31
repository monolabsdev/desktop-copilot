# Desktop Copilot (Tauri + React + TypeScript)

An always-on-top AI overlay for your desktop. The UI is React/Vite, the backend
is Tauri (Rust), and all AI requests are routed through the backend to a local
Ollama server.

**Important: Ollama is not bundled. You must install and run it yourself.**

**Supported Operating Systems:**
- [x] Windows
- [x] MacOS (dev)
- [ ] Linux

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

## Overlay shortcuts

- Toggle overlay: `Ctrl+Space`
- Focus overlay: `Ctrl+Shift+Space`
- Stop generation: `Ctrl+.`
- Regenerate last response: `Ctrl+Shift+R`
- Input history: `Up / Down` (when the input caret is at the start/end)

## Chat commands

- `/clear` clears chat history
- `/corner <top-left|top-right|bottom-left|bottom-right>` moves the overlay

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

### Ollama web search (optional)

For release builds, enter your API key in Preferences. The key is stored in the
system keychain and never written to `config.json`.

For local dev, you can still set `OLLAMA_WEB_SEARCH_API_KEY` in `.env.local`.

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
  "appearance": {
    "panel_opacity": 0.85,
    "show_thinking": true
  },
  "tools": {
    "capture_screen_text_enabled": true,
    "web_search_enabled": false
  }
}
```

Notes:
- `corner` accepts `top-left`, `top-right`, `bottom-left`, `bottom-right`.      
- `keybinds` lets you customize global shortcuts. Restart the app after editing.

### Adding custom config settings

Use the `show_thinking` toggle (added in this repo) as a reference:

1. Add the field in `src-tauri/src/config.rs` with `#[serde(default = "...")]`,
   plus a default helper and `Default` impl update.
2. Mirror the field in `src/shared/config.ts` (type + `DEFAULT_OVERLAY_CONFIG`).
3. Wire the UI in `src/preferences/Preferences.tsx` if it should be editable.
4. Consume the setting where it matters (example: `src/overlay/Overlay.tsx`
   passes `showThinking` down to `src/overlay/components/MessageBubble.tsx`).

## Adding tools (modular registry)

Tools are registered in one place and are automatically available to the UI and
tool routing.

Steps:
1. Add a tool schema in `src/overlay/tools/` (see `webSearch.ts` or
   `captureScreenImage.ts`).
2. Register it in `src/overlay/tools/registry.ts` with:
   - `name` (tool call name)
   - `tool` (schema)
   - `handler` (exec logic + followup)
   - `displayName`/`activityLabel` (UI labels)
   - `isEnabled` (gate via config flags)
3. Expose a config flag if you want a toggle:
   - `src-tauri/src/config.rs`
   - `src/shared/config.ts`
   - `src/preferences/Preferences.tsx`
   - `src/overlay/Overlay.tsx` (pass the flag into tool options)

Notes:
- The registry drives the tool list sent to the model and the local handlers.
- Tool activity uses your Disclosure UI automatically.

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
- You can close the app by right-clicking the tray icon and selecting "Quit".


## Disclaimer (read this if you plan to hack on it)

This project is intentionally minimal and leans on some lazy programming
practices that will make your eyes water. Expect rough edges, shortcuts, and
few guardrails. Use at your own risk.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
