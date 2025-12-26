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
    last_position: Mutex<Option<PhysicalPosition<i32>>>,
    is_visible: Mutex<bool>,
}

impl OverlayState {
    pub fn new(initial_corner: OverlayCorner) -> Self {
        Self {
            corner: Mutex::new(initial_corner),
            last_position: Mutex::new(None),
            is_visible: Mutex::new(false),
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

    pub fn last_position(&self) -> Option<PhysicalPosition<i32>> {
        self.last_position.lock().ok().and_then(|stored| *stored)
    }

    pub fn set_last_position(&self, position: PhysicalPosition<i32>) {
        if let Ok(mut stored) = self.last_position.lock() {
            *stored = Some(position);
        }
    }

    pub fn clear_last_position(&self) {
        if let Ok(mut stored) = self.last_position.lock() {
            *stored = None;
        }
    }

    pub fn is_visible(&self) -> bool {
        *self
            .is_visible
            .lock()
            .unwrap_or_else(|err| err.into_inner())
    }

    pub fn set_visible(&self, visible: bool) {
        if let Ok(mut stored) = self.is_visible.lock() {
            *stored = visible;
        }
    }
}

pub fn snap_overlay_to_corner(window: &tauri::WebviewWindow, corner: OverlayCorner) {
    // Snap to the monitor work area so we stay clear of the taskbar/dock.
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

fn position_overlay_window(window: &tauri::WebviewWindow, state: &OverlayState) {
    if let Some(position) = state.last_position() {
        let _ = window.set_position(Position::Physical(position));
    } else {
        snap_overlay_to_corner(window, state.current_corner());
    }
}

pub fn toggle_overlay_window(window: &tauri::WebviewWindow, state: &OverlayState) {
    let visible = state.is_visible();

    if visible {
        println!("Hiding overlay");
        let _ = window.hide();
        state.set_visible(false);
    } else {
        println!("Showing overlay");
        let _ = window.show();
        // Restore the last dragged position, otherwise snap to the corner.
        position_overlay_window(window, state);
        let _ = window.set_focus();
        let _ = window.set_always_on_top(true);
        state.set_visible(true);
        let _ = window.emit("overlay:shown", ());
    }
}

#[tauri::command]
pub fn toggle_overlay(app: tauri::AppHandle, state: State<OverlayState>) {
    if let Some(window) = app.webview_windows().get("overlay") {
        println!("Toggling overlay (command)");
        toggle_overlay_window(window, &state);
    }
}

#[tauri::command]
pub fn set_overlay_visibility(
    app: tauri::AppHandle,
    state: State<OverlayState>,
    visible: bool,
) {
    if let Some(window) = app.webview_windows().get("overlay") {
        if visible {
            println!("Showing overlay (command)");
            let _ = window.show();
            position_overlay_window(window, &state);
            let _ = window.set_focus();
            let _ = window.set_always_on_top(true);
            state.set_visible(true);
            let _ = window.emit("overlay:shown", ());
        } else {
            println!("Hiding overlay (command)");
            let _ = window.hide();
            state.set_visible(false);
        }
    }
}

#[tauri::command]
pub fn set_overlay_corner(
    app: tauri::AppHandle,
    state: State<OverlayState>,
    corner: OverlayCorner,
) {
    state.set_corner(corner);
    state.clear_last_position();
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
