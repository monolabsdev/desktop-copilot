use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::{
    config::OverlayConfig,
    overlay::{snap_overlay_to_corner, toggle_overlay_window, OverlayState},
};

#[derive(Clone, serde::Serialize)]
struct ShortcutRegistrationError {
    key: String,
    error: String,
}

static LAST_REGISTERED: OnceLock<Mutex<Option<crate::config::KeybindConfig>>> = OnceLock::new();

fn store_last_keybinds(config: &OverlayConfig) {
    let state = LAST_REGISTERED.get_or_init(|| Mutex::new(None));
    if let Ok(mut stored) = state.lock() {
        *stored = Some(config.keybinds.clone());
    }
}

fn take_last_keybinds() -> Option<crate::config::KeybindConfig> {
    let state = LAST_REGISTERED.get_or_init(|| Mutex::new(None));
    state.lock().ok().and_then(|mut stored| stored.take())
}

fn normalized_keybind(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn emit_shortcut_error(app: &tauri::AppHandle, key: &str, error: &str) {
    let payload = ShortcutRegistrationError {
        key: key.to_string(),
        error: error.to_string(),
    };
    let _ = app.emit("shortcuts:registration_failed", payload);
}

pub fn register_overlay_shortcut(app: &tauri::AppHandle, config: &OverlayConfig) {
    // Cleanup from previous runs.
    if let Some(previous) = take_last_keybinds() {
        if let Some(key) = normalized_keybind(previous.toggle_overlay.as_str()) {
            let _ = app.global_shortcut().unregister(key);
        }
        if let Some(key) = normalized_keybind(previous.focus_overlay.as_str()) {
            let _ = app.global_shortcut().unregister(key);
        }
    }

    // Debounce state to avoid repeat key events.
    let last_trigger = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1)));
    let debounce = Duration::from_millis(200);
    let last_trigger_clone = last_trigger.clone();

    let toggle_keybind = config.keybinds.toggle_overlay.clone();
    let focus_keybind = config.keybinds.focus_overlay.clone();

    if let Some(key) = normalized_keybind(toggle_keybind.as_str()) {
        if let Err(error) = app
            .global_shortcut()
            .on_shortcut(key, move |app, _, event| {
                if event.state != ShortcutState::Pressed {
                    return;
                }
                let mut last = last_trigger_clone.lock().unwrap();
                let now = Instant::now();

                if now.duration_since(*last) < debounce {
                    println!("Ignoring duplicate trigger");
                    return;
                }

                *last = now;

                if let Some(window) = app.webview_windows().get("overlay") {
                    let state = app.state::<OverlayState>();
                    toggle_overlay_window(window, &state);
                }
            })
        {
            eprintln!("Failed to register toggle overlay shortcut: {error}");
            emit_shortcut_error(app, key, &error.to_string());
        } else {
            println!("{} hotkey registered", key);
        }
    }

    if let Some(key) = normalized_keybind(focus_keybind.as_str()) {
        if let Err(error) = app
            .global_shortcut()
            .on_shortcut(key, move |app, _, event| {
                if event.state != ShortcutState::Pressed {
                    return;
                }
                if let Some(window) = app.webview_windows().get("overlay") {
                    let state = app.state::<OverlayState>();
                    // Show and focus without toggling visibility off if already open.
                    if !state.is_visible() {
                        let _ = window.show();
                        if let Some(position) = state.last_position() {
                            let _ = window.set_position(tauri::Position::Physical(position));
                        } else {
                            snap_overlay_to_corner(window, state.current_corner());
                        }
                        state.set_visible(true);
                    }
                    let _ = window.set_focus();
                    let _ = window.set_always_on_top(true);
                    let _ = window.emit("overlay:shown", ());
                }
            })
        {
            eprintln!("Failed to register focus overlay shortcut: {error}");
            emit_shortcut_error(app, key, &error.to_string());
        } else {
            println!("{} hotkey registered", key);
        }
    }

    store_last_keybinds(config);
}
