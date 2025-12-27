use image::{DynamicImage, ImageFormat};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[cfg(target_os = "windows")]
use crate::config;

#[derive(Debug, Serialize)]
pub struct CaptureResolution {
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

#[derive(Debug, Serialize)]
pub struct CaptureResult {
    pub mime_type: &'static str,
    pub file_path: String,
    pub source: &'static str,
    pub app_name: Option<String>,
    pub resolution: CaptureResolution,
}

const MAX_IMAGE_DIM: u32 = 1280;
const MAX_CAPTURE_FILES: usize = 10;

#[tauri::command]
pub async fn capture_screen_image(app: AppHandle) -> Result<CaptureResult, String> {
    capture_screen_image_impl(app).await
}

#[cfg(target_os = "windows")]
async fn capture_screen_image_impl(app: AppHandle) -> Result<CaptureResult, String> {
    // Enforce the user-configurable safety switch before any capture work.
    if !config::capture_tool_enabled(&app) {
        return Err("Screen capture tool disabled in settings.".into());
    }

    let (rect, title) = active_window_rect()?;
    let width = (rect.right - rect.left).max(0) as u32;
    let height = (rect.bottom - rect.top).max(0) as u32;
    let x = rect.left;
    let y = rect.top;

    if width == 0 || height == 0 {
        return Err("Capture region is empty.".into());
    }

    let png_bytes = capture_png(x, y, width, height)?;
    let file_path = save_capture(&app, &png_bytes)?;
    Ok(CaptureResult {
        mime_type: "image/png",
        file_path: file_path.to_string_lossy().to_string(),
        source: "window",
        app_name: title,
        resolution: CaptureResolution {
            width: png_bytes.width,
            height: png_bytes.height,
            scale_factor: png_bytes.scale_factor,
        },
    })
}

#[cfg(target_os = "macos")]
async fn capture_screen_image_impl(app: AppHandle) -> Result<CaptureResult, String> {
    if !crate::config::capture_tool_enabled(&app) {
        return Err("Screen capture tool disabled in settings.".into());
    }

    let png_bytes = capture_screen_png()?;
    let file_path = save_capture(&app, &png_bytes)?;
    Ok(CaptureResult {
        mime_type: "image/png",
        file_path: file_path.to_string_lossy().to_string(),
        source: "screen",
        app_name: None,
        resolution: CaptureResolution {
            width: png_bytes.width,
            height: png_bytes.height,
            scale_factor: png_bytes.scale_factor,
        },
    })
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
async fn capture_screen_image_impl(_app: AppHandle) -> Result<CaptureResult, String> {
    Err("Screen capture is not implemented for this OS yet.".into())
}

struct EncodedPng {
    bytes: Vec<u8>,
    width: u32,
    height: u32,
    scale_factor: f64,
}

#[cfg(target_os = "windows")]
fn capture_png(x: i32, y: i32, width: u32, height: u32) -> Result<EncodedPng, String> {
    let bgra = capture_bgra(x, y, width, height)?;
    let mut rgba = vec![0u8; bgra.len()];
    for (chunk, out) in bgra.chunks_exact(4).zip(rgba.chunks_exact_mut(4)) {
        out[0] = chunk[2];
        out[1] = chunk[1];
        out[2] = chunk[0];
        out[3] = chunk[3];
    }
    let image = image::RgbaImage::from_raw(width, height, rgba)
        .ok_or_else(|| "Failed to create image buffer.".to_string())?;
    let image = DynamicImage::ImageRgba8(image);
    let (resized, scale_factor) = downscale_image(image);
    let bytes = encode_png(&resized)?;
    Ok(EncodedPng {
        bytes,
        width: resized.width(),
        height: resized.height(),
        scale_factor,
    })
}


#[cfg(target_os = "windows")]
fn capture_bgra(x: i32, y: i32, width: u32, height: u32) -> Result<Vec<u8>, String> {
    use std::mem::{size_of, zeroed};
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC,
        GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
        HBITMAP, SRCCOPY,
    };

    unsafe {
        let hdc_screen = GetDC(None);
        if hdc_screen.0.is_null() {
            return Err("Failed to access screen device context.".into());
        }

        let hdc_mem = CreateCompatibleDC(Some(hdc_screen));
        if hdc_mem.0.is_null() {
            ReleaseDC(None, hdc_screen);
            return Err("Failed to create compatible DC.".into());
        }

        let hbitmap: HBITMAP = CreateCompatibleBitmap(hdc_screen, width as i32, height as i32);
        if hbitmap.0.is_null() {
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(None, hdc_screen);
            return Err("Failed to create bitmap.".into());
        }

        let old_object = SelectObject(hdc_mem, hbitmap.into());
        let blit_ok = BitBlt(
            hdc_mem,
            0,
            0,
            width as i32,
            height as i32,
            Some(hdc_screen),
            x,
            y,
            SRCCOPY,
        )
        .is_ok();

        if !blit_ok {
            SelectObject(hdc_mem, old_object);
            let _ = DeleteObject(hbitmap.into());
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(None, hdc_screen);
            return Err("Failed to copy screen pixels.".into());
        }

        let mut bmi: BITMAPINFO = zeroed();
        bmi.bmiHeader = BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width as i32,
            biHeight: -(height as i32),
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0 as u32,
            biSizeImage: 0,
            biXPelsPerMeter: 0,
            biYPelsPerMeter: 0,
            biClrUsed: 0,
            biClrImportant: 0,
        };

        let mut buffer = vec![0u8; (width * height * 4) as usize];
        let scanlines = GetDIBits(
            hdc_mem,
            hbitmap,
            0,
            height as u32,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        SelectObject(hdc_mem, old_object);
        let _ = DeleteObject(hbitmap.into());
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(None, hdc_screen);

        if scanlines == 0 {
            return Err("Failed to read bitmap data.".into());
        }

        Ok(buffer)
    }
}

#[cfg(target_os = "macos")]
fn capture_screen_png() -> Result<EncodedPng, String> {
    use std::process::Command;

    let path = std::env::temp_dir().join(format!(
        "ai-copilot-screen-{}.png",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| "Failed to generate timestamp.")?
            .as_millis()
    ));

    let status = Command::new("screencapture")
        .arg("-x")
        .arg("-t")
        .arg("png")
        .arg(&path)
        .status()
        .map_err(|err| format!("Failed to run screencapture: {err}"))?;

    if !status.success() {
        return Err("screencapture command failed.".into());
    }

    let bytes = std::fs::read(&path).map_err(|err| format!("Failed to read capture: {err}"))?;
    let _ = std::fs::remove_file(&path);
    let image =
        image::load_from_memory(&bytes).map_err(|err| format!("PNG load failed: {err}"))?;
    let (resized, scale_factor) = downscale_image(image);
    let bytes = encode_png(&resized)?;
    Ok(EncodedPng {
        bytes,
        width: resized.width(),
        height: resized.height(),
        scale_factor,
    })
}

fn downscale_image(image: DynamicImage) -> (DynamicImage, f64) {
    let width = image.width();
    let height = image.height();
    let max_dim = width.max(height);
    if max_dim <= MAX_IMAGE_DIM {
        return (image, 1.0);
    }
    let scale = MAX_IMAGE_DIM as f64 / max_dim as f64;
    let target_width = (width as f64 * scale).round().max(1.0) as u32;
    let target_height = (height as f64 * scale).round().max(1.0) as u32;
    let resized = image.resize(target_width, target_height, image::imageops::FilterType::Triangle);
    (resized, scale)
}

fn encode_png(image: &DynamicImage) -> Result<Vec<u8>, String> {
    use std::io::Cursor;

    let mut buffer = Cursor::new(Vec::new());
    image
        .write_to(&mut buffer, ImageFormat::Png)
        .map_err(|err| format!("PNG encode failed: {err}"))?;
    Ok(buffer.into_inner())
}

fn save_capture(app: &AppHandle, png: &EncodedPng) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|err| format!("Failed to locate cache dir: {err}"))?
        .join("captures");
    std::fs::create_dir_all(&dir)
        .map_err(|err| format!("Failed to create capture dir: {err}"))?;
    let filename = format!(
        "capture-{}.png",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| "Failed to generate timestamp.")?
            .as_millis()
    );
    let path = dir.join(filename);
    std::fs::write(&path, &png.bytes)
        .map_err(|err| format!("Failed to write capture: {err}"))?;
    prune_captures(&dir, MAX_CAPTURE_FILES);
    Ok(path)
}

fn prune_captures(dir: &Path, max_files: usize) {
    let mut entries: Vec<(PathBuf, std::time::SystemTime)> = std::fs::read_dir(dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("png") {
                return None;
            }
            let modified = entry.metadata().ok()?.modified().ok()?;
            Some((path, modified))
        })
        .collect();

    if entries.len() <= max_files {
        return;
    }

    entries.sort_by_key(|(_, modified)| *modified);
    let remove_count = entries.len().saturating_sub(max_files);
    for (path, _) in entries.into_iter().take(remove_count) {
        let _ = std::fs::remove_file(path);
    }
}

#[cfg(target_os = "windows")]
fn active_window_rect() -> Result<(windows::Win32::Foundation::RECT, Option<String>), String> {
    use std::mem::zeroed;
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return Err("No active window found.".into());
        }

        let mut rect: RECT = zeroed();
        if GetWindowRect(hwnd, &mut rect).is_err() {
            return Err("Failed to read active window bounds.".into());
        }

        let title = window_title(hwnd);
        Ok((rect, title))
    }
}


#[cfg(target_os = "windows")]
fn window_title(hwnd: windows::Win32::Foundation::HWND) -> Option<String> {
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowTextLengthW, GetWindowTextW};

    unsafe {
        let length = GetWindowTextLengthW(hwnd);
        if length <= 0 {
            return None;
        }

        let mut buffer = vec![0u16; (length + 1) as usize];
        let copied = GetWindowTextW(hwnd, &mut buffer);
        if copied == 0 {
            return None;
        }
        let title = String::from_utf16_lossy(&buffer[..copied as usize]);
        if title.trim().is_empty() {
            None
        } else {
            Some(title)
        }
    }
}
