// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{Manager, PhysicalPosition, Position};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use window_vibrancy::*;

fn snap_overlay_to_corner(window: &tauri::WebviewWindow) {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        return;
    };

    let monitor_pos = monitor.position();
    let monitor_size = monitor.size();
    let window_size = window.outer_size().unwrap_or(*monitor_size);

    let cursor_left = window
        .cursor_position()
        .ok()
        .map(|cursor| cursor.x < (monitor_pos.x as f64 + (monitor_size.width as f64 / 2.0)))
        .unwrap_or(true);

    let x = if cursor_left {
        monitor_pos.x
    } else {
        monitor_pos.x + monitor_size.width as i32 - window_size.width as i32
    };

    let y = monitor_pos.y;

    let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
}

#[tauri::command]
fn toggle_overlay(app: tauri::AppHandle) {
    if let Some(window) = app.webview_windows().get("overlay") {
        let visible = window.is_visible().unwrap_or(false);

        if visible {
            println!("Hiding overlay (command)");
            let _ = window.hide();
        } else {
            println!("Showing overlay (command)");
            let _ = window.show();
            snap_overlay_to_corner(window);
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

            // Debounce state
            let last_trigger = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1)));

            let debounce = Duration::from_millis(200);
            let last_trigger_clone = last_trigger.clone();

            handle
                .global_shortcut()
                .on_shortcut("Ctrl+Space", move |app, _, _| {
                    let mut last = last_trigger_clone.lock().unwrap();
                    let now = Instant::now();

                    if now.duration_since(*last) < debounce {
                        println!("Ignoring duplicate trigger");
                        return;
                    }

                    *last = now;

                    if let Some(window) = app.webview_windows().get("overlay") {
                        let visible = window.is_visible().unwrap_or(false);

                        if visible {
                            println!("Hiding overlay");
                            let _ = window.hide();
                        } else {
                            println!("Showing overlay");
                            let _ = window.show();
                            snap_overlay_to_corner(window);
                            let _ = window.set_focus();
                            let _ = window.set_always_on_top(true);
                        }
                    }
                })
                .expect("Failed to register Ctrl+Space shortcut");

            println!("Ctrl+Space hotkey registered");

            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("overlay") {
                    window.hide().ok();
                    apply_acrylic(&window, Some((0, 0, 0, 25))).unwrap();

                    window.show().ok();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![toggle_overlay])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
