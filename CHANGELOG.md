# Changelog

All notable changes to this project will be documented in this file.
This project follows Semantic Versioning while in pre-1.0 development.
Versions marked `dev` indicate unstable development builds.

---

## [0.2.0-dev.2] â€“ Release Candidate
This development release focuses on overlay UX upgrades, chat controls, and tool feedback.

### Added
- Chat commands: `/clear` to wipe history and `/corner` to move the overlay
- Input history navigation with Up/Down in the chat input
- Regenerate last response shortcut (`Ctrl+Shift+R`)
- Tool usage indicator (active + last used tool)
- Ollama health chip in the empty state
- Markdown rendering improvements for tables, code, lists, and blockquotes

### Changed
- Overlay drag behavior now ignores scrollbar interactions
- UI polish across chat panels and scrollbars
- Action bar focuses on regenerate + tool status (stop is hotkey-only)
- Converted to shadcn/ui
- Overhauled reasoning indicator: Now shows how long it reasoned for.

### Fixed
- Scrollbar drag conflicts with window dragging
- Build errors from unused imports and type mismatches
- Input history restores the draft when returning to the latest entry

### Notes
- Stop-generation shortcut is available at `Ctrl+.`
- This is a development build
- Features marked experimental may change or be removed
- Backward compatibility is not guaranteed

---

## [0.2.0-dev.1] â€“ Release Candidate
This development release consolidates multiple feature additions and UI changes that significantly expand the application beyond the initial `0.1.x` scope.

### Added
- Finished System tray icon with application menu
- Preferences panel for user-configurable settings
- Opacity slider for UI customization
- Thinking/processing indicator to reflect application state
- Experimental window dragging functionality
- Experimental drag handle for window movement

### Changed
- Timeout behavior made configurable
- Default timeout increased from 8 seconds to 12 seconds
- General UI refinements and behavior improvements
- Internal refactoring and codebase cleanup

### Fixed
- Reliability issues related to request timeouts
- Minor bugs in preferences handling and UI behavior

### Notes
- This is a development build
- Features marked experimental may change or be removed
- Backward compatibility is not guaranteed

---

## [0.1.3] â€“ Experimental

### Added
- Experimental window dragging functionality
- fix: #2 request for screenshot + ocr tool time out

---

## [0.1.2] â€“ Experimental

### Added
- Experimental drag handle for window movement

---

## [0.1.1] â€“ Early Development

### Added
- Initial preferences support
- Thinking indicator
- Early UI and behavior improvements

---

## [0.1.0] â€“ Initial Development Release

### Added
- Core application functionality
- Basic user interface
- Project documentation and license
