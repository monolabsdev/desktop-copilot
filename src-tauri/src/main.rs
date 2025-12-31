// Prevents additional console window on Windows in release DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture;
mod clipboard;
mod config;
mod files;
mod ollama;
mod overlay;
mod secrets;
mod shortcuts;
use tauri::Manager;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    WebviewUrl, WebviewWindowBuilder,
};
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[cfg(target_os = "macos")]
const MACOS_VIBRANCY_RADIUS: f64 = 18.0;

fn load_env() {
    // Best-effort: load developer keys from repo root for local runs.
    for filename in [".env.local", ".env"] {
        let _ = dotenvy::from_filename(filename);
        let _ = dotenvy::from_path(std::path::Path::new("..").join(filename));
    }
}

#[cfg(target_os = "macos")]
fn apply_macos_vibrancy(window: &tauri::WebviewWindow) {
    if let Err(error) = apply_vibrancy(
        window,
        NSVisualEffectMaterial::HudWindow,
        Some(NSVisualEffectState::Active),
        Some(MACOS_VIBRANCY_RADIUS),
    ) {
        eprintln!("Failed to apply macOS vibrancy: {error}");
    }
}

fn main() {
    load_env();
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let config = config::load_overlay_config(&handle);
            // Keep overlay state in memory for snapping and restoring position.
            app.manage(overlay::OverlayState::new(config.corner));
            config::save_overlay_config(&handle, &config);

            shortcuts::register_overlay_shortcut(&handle, &config);
            if let Some(window) = app.webview_windows().get("overlay") {
                #[cfg(target_os = "macos")]
                apply_macos_vibrancy(window);
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

            // Create the tray icon and menu shortcuts.
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

                        let builder = WebviewWindowBuilder::new(
                            app,
                            "preferences",
                            WebviewUrl::App("index.html?view=preferences".into()),
                        )
                        .title("Preferences")
                        .inner_size(420.0, 520.0)
                        .resizable(false)
                        .decorations(true);
                        #[cfg(any(target_os = "windows", target_os = "macos"))]
                        let builder = builder.transparent(true);
                        let preferences_window = builder.build();
                        #[cfg(target_os = "macos")]
                        if let Ok(window) = preferences_window.as_ref() {
                            apply_macos_vibrancy(window);
                        }
                        #[cfg(not(target_os = "macos"))]
                        let _ = preferences_window;
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
            overlay::set_overlay_visibility,
            overlay::set_overlay_corner,
            overlay::get_overlay_corner,
            config::get_capture_tool_enabled,
            config::set_capture_tool_enabled,
            config::get_overlay_config,
            config::set_overlay_config,
            capture::capture_screen_image,
            clipboard::read_clipboard_text,
            files::read_file,
            ollama::ollama_health_check,
            ollama::ollama_chat,
            ollama::ollama_web_search,
            ollama::ollama_chat_stream,
            secrets::get_ollama_web_search_key_status,
            secrets::set_ollama_web_search_api_key,
            secrets::clear_ollama_web_search_api_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
