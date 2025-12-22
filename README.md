# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

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

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
