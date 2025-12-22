use crate::overlay::OverlayCorner;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const CONFIG_FILE: &str = "config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeybindConfig {
    pub toggle_overlay: String,
    pub focus_overlay: String,
}

impl Default for KeybindConfig {
    fn default() -> Self {
        Self {
            toggle_overlay: "Ctrl+Space".into(),
            focus_overlay: "Ctrl+Shift+Space".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayConfig {
    pub corner: OverlayCorner,
    #[serde(default)]
    pub keybinds: KeybindConfig,
}

impl Default for OverlayConfig {
    fn default() -> Self {
        Self {
            corner: OverlayCorner::TopRight,
            keybinds: KeybindConfig::default(),
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
