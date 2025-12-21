// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[tauri::command]
fn toggle_overlay(app: tauri::AppHandle) {
    if let Some(window) = app.webview_windows().get("overlay") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
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

            // Try to unregister first (cleanup from previous runs)
            let _ = handle.global_shortcut().unregister("Ctrl+Space");

            // Debounce mechanism - prevent multiple triggers within 200ms
            let last_trigger = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1)));

            // on_shortcut handles both registration AND the callback
            match handle
                .global_shortcut()
                .on_shortcut("Ctrl+Space", move |_app, _shortcut, _event| {
                    let mut last = last_trigger.lock().unwrap();
                    let now = Instant::now();

                    // Only process if it's been more than 200ms since last trigger
                    if now.duration_since(*last) < Duration::from_millis(200) {
                        println!("Ignoring duplicate trigger");
                        return;
                    }

                    *last = now;
                    drop(last); // Release the lock

                    if let Some(window) = _app.webview_windows().get("overlay") {
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
                }) {
                Ok(_) => println!("Successfully registered Ctrl+Space hotkey"),
                Err(e) => {
                    eprintln!("Warning: Could not register Ctrl+Space hotkey: {}", e);
                    eprintln!("The app will still work, but you'll need to use other methods to toggle the overlay.");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![toggle_overlay])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
