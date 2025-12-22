use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, PhysicalPosition, Position, State};

use crate::config;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OverlayCorner {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

pub struct OverlayState {
    corner: Mutex<OverlayCorner>,
}

impl OverlayState {
    pub fn new(initial_corner: OverlayCorner) -> Self {
        Self {
            corner: Mutex::new(initial_corner),
        }
    }

    pub fn current_corner(&self) -> OverlayCorner {
        *self.corner.lock().unwrap_or_else(|err| err.into_inner())
    }

    pub fn set_corner(&self, corner: OverlayCorner) {
        if let Ok(mut stored) = self.corner.lock() {
            *stored = corner;
        }
    }
}

pub fn snap_overlay_to_corner(window: &tauri::WebviewWindow, corner: OverlayCorner) {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        return;
    };

    let work_area = monitor.work_area();
    let area_pos = work_area.position;
    let area_size = work_area.size;
    let window_size = window.outer_size().unwrap_or(area_size);

    let (x, y) = match corner {
        OverlayCorner::TopLeft => (area_pos.x, area_pos.y),
        OverlayCorner::TopRight => (
            area_pos.x + area_size.width as i32 - window_size.width as i32,
            area_pos.y,
        ),
        OverlayCorner::BottomLeft => (
            area_pos.x,
            area_pos.y + area_size.height as i32 - window_size.height as i32,
        ),
        OverlayCorner::BottomRight => (
            area_pos.x + area_size.width as i32 - window_size.width as i32,
            area_pos.y + area_size.height as i32 - window_size.height as i32,
        ),
    };

    let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
}

pub fn toggle_overlay_window(window: &tauri::WebviewWindow, corner: OverlayCorner) {
    let visible = window.is_visible().unwrap_or(false);

    if visible {
        println!("Hiding overlay");
        let _ = window.hide();
    } else {
        println!("Showing overlay");
        let _ = window.show();
        snap_overlay_to_corner(window, corner);
        let _ = window.set_focus();
        let _ = window.set_always_on_top(true);
        let _ = window.emit("overlay:shown", ());
    }
}

#[tauri::command]
pub fn toggle_overlay(app: tauri::AppHandle, state: State<OverlayState>) {
    if let Some(window) = app.webview_windows().get("overlay") {
        println!("Toggling overlay (command)");
        toggle_overlay_window(window, state.current_corner());
    }
}

#[tauri::command]
pub fn set_overlay_corner(
    app: tauri::AppHandle,
    state: State<OverlayState>,
    corner: OverlayCorner,
) {
    state.set_corner(corner);
    let mut current = config::load_overlay_config(&app);
    current.corner = corner;
    config::save_overlay_config(&app, &current);
    if let Some(window) = app.webview_windows().get("overlay") {
        snap_overlay_to_corner(window, corner);
    }
}

#[tauri::command]
pub fn get_overlay_corner(state: State<OverlayState>) -> OverlayCorner {
    state.current_corner()
}


