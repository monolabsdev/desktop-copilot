use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::{config::OverlayConfig, overlay::{snap_overlay_to_corner, toggle_overlay_window, OverlayState}};

pub fn register_overlay_shortcut(app: &tauri::AppHandle, config: &OverlayConfig) {
    // Cleanup from previous runs
    let _ = app
        .global_shortcut()
        .unregister(config.keybinds.toggle_overlay.as_str());
    let _ = app
        .global_shortcut()
        .unregister(config.keybinds.focus_overlay.as_str());

    // Debounce state to avoid repeat key events.
    let last_trigger = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1)));
    let debounce = Duration::from_millis(200);
    let last_trigger_clone = last_trigger.clone();

    let toggle_keybind = config.keybinds.toggle_overlay.clone();
    let focus_keybind = config.keybinds.focus_overlay.clone();

    app.global_shortcut()
        .on_shortcut(toggle_keybind.as_str(), move |app, _, event| {
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
        .expect("Failed to register toggle overlay shortcut");

    app.global_shortcut()
        .on_shortcut(focus_keybind.as_str(), move |app, _, event| {
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
        .expect("Failed to register focus overlay shortcut");

    println!("{} hotkey registered", toggle_keybind);
    println!("{} hotkey registered", focus_keybind);
}
