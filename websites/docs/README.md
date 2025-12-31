# Desktop Copilot Hacker Notes

## Dev loop
- Install dependencies normally (`npm install`) and lean on the `tauri` npm scripts for the overlay: `npm run tauri dev` spins up the UI+Rust toolchain and `npm run tauri build` drops a release bundle (`package.json:7`).
- Ollama must be running locally; for Windows debugging there is a helper that sets `OLLAMA_ORIGINS="*"` before `ollama serve` (`scripts/start-ollama.ps1:1`).
- The renderer picks overlay vs. preferences via the `?view=preferences` query param, so changes to either screen land in the same tree rooted at `src/app/App.tsx:1`.

## Tools & AI integration
- Build new tools by copying `src/overlay/tools/toolTemplate.ts:3`, filling in the schema/parameters, and naming the function the model should call.
- Register the tool inside `TOOL_REGISTRY` so the UI and routing know about it; the registration block around `src/overlay/tools/registry.ts:81` also shows how to describe the tool, expose UI labels, and gate it with `isEnabled` logic (`src/overlay/tools/registry.ts:141`).
- Toggle visibility and defaults through preferences: keep `setToolToggle` and its helpers aligned with the config setters at `src/preferences/Preferences.tsx:174`, and add the entry to the `toolPreferences` map at `src/preferences/Preferences.tsx:280` so the “Tools” tab shows the switch.
- Both chat hooks receive the normalized toolkit options (`toolsEnabled`, per-tool toggles, screen capture callbacks) so any new toggle is automatically respected when `useOllamaChat` wires the `toolConfig` at `src/overlay/hooks/useOllamaChat.ts:97` and `useAgentsSdkChat` builds agents at `src/overlay/hooks/useAgentsSdkChat.ts:38`.
- The plumbing that executes tool calls lives in `src/overlay/hooks/ollama/tools.ts:1` and the screenshot-friendly queue is driven by `src/overlay/hooks/ollama/screenshot.ts:1`, so augment those helpers when your tool needs to append extra history, stream follow-ups, or local previews.

## Config & shortcuts
- To add a persisted option, update the Rust struct defaults (`src-tauri/src/config.rs:122`), mirror the shape/colors in `src/shared/config.ts:31`, and wire the setter in the preferences panel to keep `DEFAULT_OVERLAY_CONFIG` consistent.
- `Preferences.tsx` already outlines the pattern: helper setters such as `setPanelOpacity`/`setShowThinking` sit near `src/preferences/Preferences.tsx:174` and new tool toggles should hook into the `toolPreferences` + `toolToggles` logic at `src/preferences/Preferences.tsx:280`.
- Global keyboard shortcuts load via `src-tauri/src/shortcuts.rs:1`; errors bubble back to the UI through `src/shared/hooks/useTauriEvent.ts:1`, and `src/shared/keybindings.ts:1` contains the event-matching logic that must stay in sync if you change modifiers.
- The overlay also listens for Escape/stop/regenerate via `src/overlay/hooks/useOverlayHotkeys.ts:1` and keeps a `OverlayState` in Tauri that defines visibility/corner behavior (`src-tauri/src/overlay.rs:18` with snapping at `src-tauri/src/overlay.rs:73`).

## Prompts & commands
- The system prompt is declared in `src/overlay/hooks/useOllamaChat.ts:24` and a matching agent prompt lives at `src/overlay/hooks/useAgentsSdkChat.ts:38`; tweak those strings (and the TODO heuristics below) to steer tone, brevity, or tool usage.
- Clipboard auto-injection fires from `shouldAutoUseClipboard` in `src/overlay/hooks/useOllamaChat.ts:205`, so adjust the regexes there if you want to change when context is shared.
- Slash commands are parsed in `src/overlay/commands/parseCommand.ts:1`, routed through `src/overlay/commands/handleChatCommand.ts:1`, and registered inside `src/overlay/commands/registry.ts:1`; add new `CommandHandler` entries when you need a built-in directive (clear history, move corners, etc.).
- Streaming + tool follow-ups are orchestrated by `src/overlay/hooks/ollama/stream.ts:1`, which calls the helper in `src/overlay/hooks/ollama/tools.ts:1` and appends screenshot messages via `src/overlay/hooks/ollama/screenshot.ts:1`.

## Custom UI shell
- The overlay frame and message stream live in `src/overlay/Overlay.tsx:1`, `src/overlay/components/MessageList.tsx:1`, and `src/overlay/components/MessageBubble.tsx:1`, so adjust layout, auto-scroll, or markdown skin there when you change the UX.
- Input entry is a combination of `src/overlay/components/ChatInput.tsx:1`, the prompt kit at `src/components/prompt-kit/prompt-input.tsx:1`, and the history helper (`src/overlay/hooks/useInputHistory.ts:1`); drag those parts anytime you want to add new actions/shortcuts.
- All bespoke primitives (Panel/rows, keybind inputs, buttons, chain-of-thought boxes, shimmering text, etc.) live under `src/components/layout/panel.tsx:1`, `src/components/ui/button.tsx:1`, `src/components/ui/keybind-input.tsx:1`, and `src/components/ui/chain-of-thought.tsx:1`.
- Modals reuse `src/shared/ui/ModalShell.tsx:1`; consent and Ollama-not-running states come from `src/overlay/components/CaptureConsentModal.tsx:1`, `src/overlay/components/OllamaRequiredModal.tsx:1`, and the tiny banner `src/overlay/components/OverlayCaptureNotice.tsx:1`.
- Preferences and theming are driven by `src/preferences/Preferences.tsx:1` plus `src/app/App.css:1`, while the root view selector is `src/app/App.tsx:1`. Utility helpers such as `cn` live at `src/lib/utils.ts:1`.
- The health modal hooks into `src/overlay/hooks/useOllamaHealth.ts:1` so the UI can show errors/prioritize retries.

## Native backend & bridging
- New native RPCs must be exported in `src-tauri/src/main.rs:118`, which is also where the overlay + preference windows are constructed and the tray menu lives.
- Capture permissions and portability live in `src-tauri/src/capture.rs:1`, clipboard context in `src-tauri/src/clipboard.rs:1`, file reading in `src-tauri/src/files.rs:1`, Ollama proxying in `src-tauri/src/ollama.rs:1`, and secret storage for the web search key in `src-tauri/src/secrets.rs:1`.
- When you add a new native dependency, keep the Ollama key persist/reload flow in sync with the preferences buttons that call `set_ollama_web_search_api_key` / `clear_ollama_web_search_api_key`.
- Use `scripts/start-ollama.ps1:1` to give the backend CORS-free access while you iterate, and rely on `src/shared/hooks/useTauriEvent.ts:1` to surface errors emitted from Rust.
