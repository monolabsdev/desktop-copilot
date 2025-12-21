// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[tauri::command]
fn toggle_overlay(app: tauri::AppHandle) {
    if let Some(window) = app.webview_windows().get("overlay") {
        let is_visible = window.is_visible().unwrap_or(false);

        if is_visible {
            println!("Hiding overlay (command)");
            let _ = window.hide();
        } else {
            println!("Showing overlay (command)");
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.set_always_on_top(true);
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let handle = app.handle();

            // Cleanup from previous runs
            let _ = handle.global_shortcut().unregister("Ctrl+Space");

            // Shared debounce timestamp
            let last_trigger = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1)));

            let last_trigger_clone = last_trigger.clone();

            handle
                .global_shortcut()
                .on_shortcut("Ctrl+Space", move |app, _shortcut, event| {
                    // 🚨 THIS is the important part
                    // Ignore Released / Repeated events completely
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }

                    let mut last = last_trigger_clone.lock().unwrap();
                    let now = Instant::now();

                    if now.duration_since(*last) < Duration::from_millis(300) {
                        println!("Ignoring duplicate trigger");
                        return;
                    }

                    *last = now;
                    drop(last);

                    if let Some(window) = app.webview_windows().get("overlay") {
                        let is_visible = window.is_visible().unwrap_or(false);

                        if is_visible {
                            println!("Hiding overlay");
                            let _ = window.hide();
                        } else {
                            println!("Showing overlay");
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.set_always_on_top(true);
                        }
                    }
                })
                .expect("Failed to register Ctrl+Space global shortcut");

            println!("Ctrl+Space registered successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![toggle_overlay])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
