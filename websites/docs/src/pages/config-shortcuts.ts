import type { DocPage } from "../lib/docs-types"

export const configShortcutsPage: DocPage = {
  slug: "config-shortcuts",
  title: "Config & Shortcuts",
  summary: "Persisted settings and shortcut flows across UI and native layers.",
  sections: [
    {
      id: "config-shape",
      title: "Config Schema",
      blocks: [
        {
          type: "paragraph",
          content:
            "OverlayConfig is shared between the UI and Rust backend. Defaults must match in src/shared/config.ts and src-tauri/src/config.rs.",
        },
        {
          type: "code",
          language: "json",
          content:
            "{\n  \"corner\": \"bottom-middle\",\n  \"keybinds\": {\n    \"toggle_overlay\": \"Ctrl+Space\",\n    \"focus_overlay\": \"Ctrl+Shift+Space\",\n    \"stop_generation\": \"Ctrl+.\",\n    \"regenerate_last_response\": \"Ctrl+Shift+R\"\n  },\n  \"appearance\": {\n    \"panel_opacity\": 0.85,\n    \"show_thinking\": true\n  },\n  \"tools\": {\n    \"capture_screen_text_enabled\": true,\n    \"web_search_enabled\": false,\n    \"agents_sdk_enabled\": false,\n    \"tool_toggles\": {}\n  }\n}",
        },
      ],
    },
    {
      id: "config-add",
      title: "Add a Persisted Setting",
      blocks: [
        {
          type: "list",
          content: [
            "Add fields + serde defaults in src-tauri/src/config.rs",
            "Mirror types + defaults in src/shared/config.ts",
            "Wire UI in src/preferences/Preferences.tsx if user-editable",
            "Consume the setting in overlay/runtime code",
          ],
        },
      ],
    },
    {
      id: "shortcuts-flow",
      title: "Shortcut Registration Flow",
      blocks: [
        {
          type: "paragraph",
          content:
            "Global shortcuts are registered in src-tauri/src/shortcuts.rs, and errors are emitted as the shortcuts:registration_failed event.",
        },
        {
          type: "code",
          language: "rust",
          content:
            "// src-tauri/src/shortcuts.rs\napp.global_shortcut().on_shortcut(key, move |app, _, event| {\n  if event.state != ShortcutState::Pressed {\n    return;\n  }\n  // toggle overlay window\n});",
        },
      ],
    },
    {
      id: "keybinding-matching",
      title: "Keybinding Matching",
      blocks: [
        {
          type: "paragraph",
          content:
            "The overlay listens for Escape, stop, and regenerate in useOverlayHotkeys. Matching uses src/shared/keybindings.ts; keep modifiers in sync if you change formats.",
        },
        {
          type: "code",
          language: "ts",
          content:
            "// src/shared/keybindings.ts\nexport const matchesKeybinding = (event, binding) => {\n  const parsed = parseKeybinding(binding);\n  if (!parsed.key) return false;\n  // modifier checks...\n  return normalizeEventKey(event.key) === parsed.key;\n};",
        },
      ],
    },
  ],
}
