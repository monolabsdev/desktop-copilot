// Prevents additional console window on Windows in release DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture;
mod config;
mod ollama;
mod overlay;
mod shortcuts;
use tauri::Manager;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    WebviewUrl, WebviewWindowBuilder,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let config = config::load_overlay_config(&handle);
            app.manage(overlay::OverlayState::new(config.corner));
            config::save_overlay_config(&handle, &config);

            shortcuts::register_overlay_shortcut(&handle, &config);
            if let Some(window) = app.webview_windows().get("overlay") {
                let state = app.state::<overlay::OverlayState>();
                overlay::snap_overlay_to_corner(window, state.current_corner());
                let handle_for_events = handle.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Moved(position) = event {
                        let state = handle_for_events.state::<overlay::OverlayState>();
                        state.set_last_position(*position);
                    }
                });
            }
            // Run a background health check so the UI can prompt if Ollama is missing.
            tauri::async_runtime::spawn(ollama::emit_health_if_needed(app.handle().clone()));

            // create a tray icon.
            let preferences_i =
                MenuItem::with_id(app, "preferences", "Preferences", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&preferences_i, &quit_i])?;
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    // opens preferences
                    "preferences" => {
                        if let Some(window) = app.webview_windows().get("preferences") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            return;
                        }

                        let mut builder = WebviewWindowBuilder::new(
                            app,
                            "preferences",
                            WebviewUrl::App("index.html?view=preferences".into()),
                        )
                        .title("Preferences")
                        .inner_size(420.0, 520.0)
                        .resizable(false)
                        .decorations(true);
                        #[cfg(target_os = "windows")]
                        {
                            builder = builder.transparent(true);
                        }
                        let _ = builder.build();
                    }
                    // adds the event for the quit menu uitem
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            overlay::toggle_overlay,
            overlay::set_overlay_corner,
            overlay::get_overlay_corner,
            config::get_capture_tool_enabled,
            config::set_capture_tool_enabled,
            config::get_overlay_config,
            config::set_overlay_config,
            capture::capture_screen_text,
            ollama::ollama_health_check,
            ollama::ollama_chat,
            ollama::ollama_chat_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
