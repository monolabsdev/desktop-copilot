use arboard::Clipboard;
use serde::Serialize;
use tauri::AppHandle;

const DEFAULT_MAX_CHARS: usize = 4000;
const MAX_MAX_CHARS: usize = 20000;

#[derive(Debug, Serialize)]
pub struct ClipboardText {
    pub text: String,
    pub truncated: bool,
    pub length: usize,
}

#[tauri::command]
pub fn read_clipboard_text(
    app: AppHandle,
    max_chars: Option<usize>,
) -> Result<ClipboardText, String> {
    let config = crate::config::load_overlay_config(&app);
    if let Some(enabled) = config.tools.tool_toggles.get("clipboard_context") {
        if !*enabled {
            return Err("Clipboard tool disabled in settings.".into());
        }
    }

    let limit = max_chars
        .unwrap_or(DEFAULT_MAX_CHARS)
        .clamp(1, MAX_MAX_CHARS);

    let mut clipboard = Clipboard::new().map_err(|err| format!("Clipboard unavailable: {err}"))?;
    let text = clipboard
        .get_text()
        .map_err(|err| format!("Clipboard read failed: {err}"))?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("Clipboard is empty or not text.".into());
    }

    let length = trimmed.chars().count();
    let truncated = length > limit;
    let clipped = if truncated {
        trimmed.chars().take(limit).collect::<String>()
    } else {
        trimmed.to_string()
    };

    Ok(ClipboardText {
        text: clipped,
        truncated,
        length,
    })
}
