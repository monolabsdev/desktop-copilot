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
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();
            let config = config::load_overlay_config(&handle);
            app.manage(overlay::OverlayState::new(config.corner));
            config::save_overlay_config(&handle, &config);

            shortcuts::register_overlay_shortcut(&handle, &config);
            if let Some(window) = app.webview_windows().get("overlay") {
                let state = app.state::<overlay::OverlayState>();
                overlay::snap_overlay_to_corner(window, state.current_corner());
            }
            // Run a background health check so the UI can prompt if Ollama is missing.
            tauri::async_runtime::spawn(ollama::emit_health_if_needed(app.handle().clone()));

            // create a tray icon, menu, menuitems  and menu events
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_i])?;
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
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
            capture::capture_screen_text,
            ollama::ollama_health_check,
            ollama::ollama_chat
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
