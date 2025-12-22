// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod overlay;
mod shortcuts;
mod config;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            overlay::toggle_overlay,
            overlay::set_overlay_corner,
            overlay::get_overlay_corner
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

