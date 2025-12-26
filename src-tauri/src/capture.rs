use serde::Serialize;
use tauri::AppHandle;

use crate::config;

#[derive(Debug, Serialize)]
pub struct CaptureResolution {
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

#[derive(Debug, Serialize)]
pub struct CaptureResult {
    pub text: String,
    pub source: &'static str,
    pub app_name: Option<String>,
    pub resolution: CaptureResolution,
}

#[tauri::command]
pub async fn capture_screen_text(app: AppHandle) -> Result<CaptureResult, String> {
    capture_screen_text_impl(app).await
}

#[cfg(target_os = "windows")]
async fn capture_screen_text_impl(app: AppHandle) -> Result<CaptureResult, String> {
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

    let text = capture_text(x, y, width, height).await?;

    Ok(CaptureResult {
        text,
        source: "window",
        app_name: title,
        resolution: CaptureResolution {
            width,
            height,
            scale_factor: 1.0,
        },
    })
}

#[cfg(not(target_os = "windows"))]
async fn capture_screen_text_impl(_app: AppHandle) -> Result<CaptureResult, String> {
    Err("Screen capture is not implemented for this OS yet.".into())
}

#[cfg(target_os = "windows")]
async fn capture_text(x: i32, y: i32, width: u32, height: u32) -> Result<String, String> {
    use windows::Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap};
    use windows::Media::Ocr::OcrEngine;
    use windows::Storage::Streams::DataWriter;
    use windows::Win32::Foundation::RPC_E_CHANGED_MODE;
    use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

    unsafe {
        if let Err(err) = RoInitialize(RO_INIT_MULTITHREADED) {
            if err.code() != RPC_E_CHANGED_MODE {
                return Err(format!("OCR init failed: {err}"));
            }
        }
    }

    let max_dim =
        OcrEngine::MaxImageDimension().map_err(|err| format!("OCR unavailable: {err}"))?;
    if width > max_dim || height > max_dim {
        return Err(format!(
            "Capture too large for OCR. Max dimension is {max_dim}px."
        ));
    }

    // Read raw pixels and pass them through Windows OCR.
    let bgra = capture_bgra(x, y, width, height)?;
    let writer = DataWriter::new().map_err(|err| format!("Buffer init failed: {err}"))?;
    writer
        .WriteBytes(&bgra)
        .map_err(|err| format!("Buffer write failed: {err}"))?;
    let buffer = writer
        .DetachBuffer()
        .map_err(|err| format!("Buffer finalize failed: {err}"))?;

    let bitmap = SoftwareBitmap::CreateCopyFromBuffer(
        &buffer,
        BitmapPixelFormat::Bgra8,
        width as i32,
        height as i32,
    )
    .map_err(|err| format!("Bitmap creation failed: {err}"))?;

    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|err| format!("OCR engine unavailable: {err}"))?;
    let result = engine
        .RecognizeAsync(&bitmap)
        .map_err(|err| format!("OCR request failed: {err}"))?
        .get()
        .map_err(|err| format!("OCR failed: {err}"))?;

    let text = result
        .Text()
        .map_err(|err| format!("OCR read failed: {err}"))?
        .to_string();
    Ok(text.trim().to_string())
}

#[cfg(not(target_os = "windows"))]
async fn capture_text(_x: i32, _y: i32, _width: u32, _height: u32) -> Result<String, String> {
    Err("Screen OCR is not implemented for this OS yet.".into())
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

#[cfg(not(target_os = "windows"))]
fn capture_bgra(_x: i32, _y: i32, _width: u32, _height: u32) -> Result<Vec<u8>, String> {
    Err("Screen capture is only implemented for Windows.".into())
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

#[cfg(not(target_os = "windows"))]
fn active_window_rect() -> Result<((), Option<String>), String> {
    Err("Window capture is only implemented for Windows.".into())
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
