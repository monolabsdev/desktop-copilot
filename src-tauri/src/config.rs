use crate::{
    overlay::{snap_overlay_to_corner, OverlayCorner, OverlayState},
    shortcuts,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};

const CONFIG_FILE: &str = "config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeybindConfig {
    pub toggle_overlay: String,
    pub focus_overlay: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolConfig {
    #[serde(default = "default_capture_tool_enabled")]
    pub capture_screen_text_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceConfig {
    #[serde(default = "default_panel_opacity")]
    pub panel_opacity: f32,
    #[serde(default = "default_show_thinking")]
    pub show_thinking: bool,
}

fn default_capture_tool_enabled() -> bool {
    true
}

fn default_panel_opacity() -> f32 {
    0.85
}

fn default_show_thinking() -> bool {
    true
}

impl Default for ToolConfig {
    fn default() -> Self {
        Self {
            capture_screen_text_enabled: true,
        }
    }
}

impl Default for KeybindConfig {
    fn default() -> Self {
        Self {
            toggle_overlay: "Ctrl+Space".into(),
            focus_overlay: "Ctrl+Shift+Space".into(),
        }
    }
}

impl Default for AppearanceConfig {
    fn default() -> Self {
        Self {
            panel_opacity: default_panel_opacity(),
            show_thinking: default_show_thinking(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayConfig {
    pub corner: OverlayCorner,
    #[serde(default)]
    pub keybinds: KeybindConfig,
    #[serde(default)]
    pub appearance: AppearanceConfig,
    #[serde(default)]
    pub tools: ToolConfig,
}
// Adding a new config setting:
// - Add the field + serde default here (or in the nested config struct).
// - Update the Default impls below.
// - Mirror the shape in `src/shared/config.ts` (type + defaults).
// - Expose UI in Preferences if user-editable.

impl Default for OverlayConfig {
    fn default() -> Self {
        Self {
            corner: OverlayCorner::TopRight,
            keybinds: KeybindConfig::default(),
            appearance: AppearanceConfig::default(),
            tools: ToolConfig::default(),
        }
    }
}

fn config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(CONFIG_FILE))
}

pub fn load_overlay_config(app: &AppHandle) -> OverlayConfig {
    let Some(path) = config_path(app) else {
        return OverlayConfig::default();
    };

    let contents = fs::read_to_string(path).ok();
    if let Some(contents) = contents {
        if let Ok(config) = serde_json::from_str::<OverlayConfig>(&contents) {
            return config;
        }
    }

    OverlayConfig::default()
}

pub fn save_overlay_config(app: &AppHandle, config: &OverlayConfig) {
    let Some(path) = config_path(app) else {
        return;
    };

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(payload) = serde_json::to_string_pretty(config) {
        let _ = fs::write(path, payload);
    }
}

pub fn capture_tool_enabled(app: &AppHandle) -> bool {
    load_overlay_config(app).tools.capture_screen_text_enabled
}

pub fn set_capture_tool_enabled_value(app: &AppHandle, enabled: bool) {
    let mut config = load_overlay_config(app);
    config.tools.capture_screen_text_enabled = enabled;
    save_overlay_config(app, &config);
}

#[tauri::command]
pub fn get_capture_tool_enabled(app: AppHandle) -> bool {
    capture_tool_enabled(&app)
}

#[tauri::command]
pub fn set_capture_tool_enabled(app: AppHandle, enabled: bool) {
    set_capture_tool_enabled_value(&app, enabled);
}

#[tauri::command]
pub fn get_overlay_config(app: AppHandle) -> OverlayConfig {
    load_overlay_config(&app)
}

#[tauri::command]
pub fn set_overlay_config(
    app: AppHandle,
    state: State<OverlayState>,
    config: OverlayConfig,
) -> Result<(), String> {
    save_overlay_config(&app, &config);
    state.set_corner(config.corner);
    if let Some(window) = app.webview_windows().get("overlay") {
        snap_overlay_to_corner(window, config.corner);
    }
    shortcuts::register_overlay_shortcut(&app, &config);
    let _ = app.emit("config:updated", config.clone());
    Ok(())
}
