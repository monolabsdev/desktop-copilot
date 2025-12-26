use serde::Serialize;
use std::fs;
use std::path::PathBuf;

const MAX_FILE_BYTES: u64 = 1_000_000;

#[derive(Debug, Serialize)]
pub struct ReadFileResponse {
    pub path: String,
    pub bytes: u64,
    pub content: String,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<ReadFileResponse, String> {
    // Keep reads bounded for safety; this tool is meant for small text files.
    let path = PathBuf::from(path);
    let metadata = fs::metadata(&path)
        .map_err(|err| format!("Unable to read file metadata: {err}"))?;
    if !metadata.is_file() {
        return Err("Path is not a file.".into());
    }
    if metadata.len() > MAX_FILE_BYTES {
        return Err(format!(
            "File too large ({bytes} bytes). Limit is {limit} bytes.",
            bytes = metadata.len(),
            limit = MAX_FILE_BYTES
        ));
    }

    let bytes = fs::read(&path).map_err(|err| format!("Unable to read file: {err}"))?;
    let content = String::from_utf8(bytes)
        .map_err(|_| "File is not valid UTF-8 text.".to_string())?;

    Ok(ReadFileResponse {
        path: path.to_string_lossy().into_owned(),
        bytes: metadata.len(),
        content,
    })
}
