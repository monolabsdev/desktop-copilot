use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

const MAX_FILE_BYTES: u64 = 1_000_000;
const MAX_WRITE_BYTES: usize = 1_000_000;
const DEFAULT_MAX_LIST_FILES: usize = 5000;
const DEFAULT_MAX_SEARCH_RESULTS: usize = 200;
const MAX_SEARCH_FILE_BYTES: u64 = 500_000;
const PROJECT_MARKERS: [&str; 4] = ["package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json"];

#[derive(Debug, Serialize)]
pub struct ReadFileResponse {
    pub path: String,
    pub bytes: u64,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct WriteFileResponse {
    pub path: String,
    pub bytes: u64,
    pub appended: bool,
}

#[derive(Debug, Serialize)]
pub struct ListProjectFilesResponse {
    pub root: String,
    pub files: Vec<String>,
    pub truncated: bool,
}

#[derive(Debug, Serialize)]
pub struct SearchMatch {
    pub path: String,
    pub line: String,
    pub line_number: u32,
}

#[derive(Debug, Serialize)]
pub struct SearchInFilesResponse {
    pub root: String,
    pub query: String,
    pub matches: Vec<SearchMatch>,
    pub truncated: bool,
}

fn is_skipped_dir(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };
    if name.starts_with('.') {
        return true;
    }
    matches!(
        name,
        "node_modules"
            | "dist"
            | "build"
            | "target"
            | ".git"
            | ".svn"
            | ".hg"
            | ".idea"
            | ".vscode"
    )
}

fn normalize_root(root: Option<String>) -> Result<PathBuf, String> {
    let base = if let Some(root) = root {
        if root.trim().is_empty() {
            project_root().map_err(|err| format!("Unable to read cwd: {err}"))?
        } else {
            resolve_path(root.trim())?
        }
    } else {
        project_root().map_err(|err| format!("Unable to read cwd: {err}"))?
    };
    if !base.exists() {
        return Err("Root path does not exist.".into());
    }
    if !base.is_dir() {
        return Err("Root path is not a directory.".into());
    }
    Ok(base)
}

fn has_any_file(dir: &Path, names: &[&str]) -> bool {
    names.iter().any(|name| dir.join(name).exists())
}

fn project_root() -> Result<PathBuf, std::io::Error> {
    let mut current = std::env::current_dir()?;
    if current.file_name().and_then(|name| name.to_str()) == Some("src-tauri") {
        if let Some(parent) = current.parent() {
            if has_any_file(parent, &PROJECT_MARKERS) {
                return Ok(parent.to_path_buf());
            }
        }
    }
    let mut steps = 0;
    loop {
        if has_any_file(&current, &PROJECT_MARKERS) {
            return Ok(current);
        }
        if !current.pop() || steps > 6 {
            return std::env::current_dir();
        }
        steps += 1;
    }
}

fn resolve_path(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);
    if candidate.is_absolute() {
        return Ok(candidate);
    }
    let root = project_root().map_err(|err| format!("Unable to read cwd: {err}"))?;
    Ok(root.join(candidate))
}

#[tauri::command]
pub fn read_file(path: String) -> Result<ReadFileResponse, String> {
    // Keep reads bounded for safety; this tool is meant for small text files.
    let path = resolve_path(&path)?;
    let metadata =
        fs::metadata(&path).map_err(|err| format!("Unable to read file metadata: {err}"))?;
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
    let content =
        String::from_utf8(bytes).map_err(|_| "File is not valid UTF-8 text.".to_string())?;

    Ok(ReadFileResponse {
        path: path.to_string_lossy().into_owned(),
        bytes: metadata.len(),
        content,
    })
}

#[tauri::command]
pub fn write_file(
    path: String,
    content: String,
    append: Option<bool>,
    create_dirs: Option<bool>,
) -> Result<WriteFileResponse, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path is required.".into());
    }

    let content_bytes = content.as_bytes();
    if content_bytes.len() > MAX_WRITE_BYTES {
        return Err(format!(
            "Content too large ({bytes} bytes). Limit is {limit} bytes.",
            bytes = content_bytes.len(),
            limit = MAX_WRITE_BYTES
        ));
    }

    let path = resolve_path(trimmed)?;
    if create_dirs.unwrap_or(true) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|err| format!("Unable to create parent directories: {err}"))?;
        }
    }

    let appended = append.unwrap_or(false);
    if appended {
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|err| format!("Unable to open file for append: {err}"))?;
        file.write_all(content_bytes)
            .map_err(|err| format!("Unable to append file: {err}"))?;
    } else {
        fs::write(&path, content_bytes).map_err(|err| format!("Unable to write file: {err}"))?;
    }

    Ok(WriteFileResponse {
        path: path.to_string_lossy().into_owned(),
        bytes: content_bytes.len() as u64,
        appended,
    })
}

#[tauri::command]
pub fn list_project_files(
    root: Option<String>,
    max_files: Option<u32>,
) -> Result<ListProjectFilesResponse, String> {
    let root_path = normalize_root(root)?;
    let max_files = max_files
        .map(|value| value as usize)
        .unwrap_or(DEFAULT_MAX_LIST_FILES)
        .max(1);

    let mut files = Vec::new();
    let mut stack = vec![root_path.clone()];
    let mut truncated = false;

    while let Some(path) = stack.pop() {
        let entries =
            fs::read_dir(&path).map_err(|err| format!("Unable to read directory: {err}"))?;
        for entry in entries {
            let entry = entry.map_err(|err| format!("Unable to read entry: {err}"))?;
            let entry_path = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|err| format!("Unable to read entry type: {err}"))?;
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                if is_skipped_dir(&entry_path) {
                    continue;
                }
                stack.push(entry_path);
                continue;
            }
            if file_type.is_file() {
                if files.len() >= max_files {
                    truncated = true;
                    break;
                }
                if let Ok(relative) = entry_path.strip_prefix(&root_path) {
                    files.push(relative.to_string_lossy().into_owned());
                } else {
                    files.push(entry_path.to_string_lossy().into_owned());
                }
            }
        }
        if truncated {
            break;
        }
    }

    Ok(ListProjectFilesResponse {
        root: root_path.to_string_lossy().into_owned(),
        files,
        truncated,
    })
}

#[tauri::command]
pub fn search_in_files(
    query: String,
    root: Option<String>,
    max_results: Option<u32>,
    case_insensitive: Option<bool>,
) -> Result<SearchInFilesResponse, String> {
    let trimmed_query = query.trim();
    if trimmed_query.is_empty() {
        return Err("Query is required.".into());
    }
    let root_path = normalize_root(root)?;
    let max_results = max_results
        .map(|value| value as usize)
        .unwrap_or(DEFAULT_MAX_SEARCH_RESULTS)
        .max(1);
    let case_insensitive = case_insensitive.unwrap_or(false);
    let needle = if case_insensitive {
        trimmed_query.to_lowercase()
    } else {
        trimmed_query.to_string()
    };

    let mut matches = Vec::new();
    let mut stack = vec![root_path.clone()];
    let mut truncated = false;

    while let Some(path) = stack.pop() {
        let entries =
            fs::read_dir(&path).map_err(|err| format!("Unable to read directory: {err}"))?;
        for entry in entries {
            let entry = entry.map_err(|err| format!("Unable to read entry: {err}"))?;
            let entry_path = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|err| format!("Unable to read entry type: {err}"))?;
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                if is_skipped_dir(&entry_path) {
                    continue;
                }
                stack.push(entry_path);
                continue;
            }
            if !file_type.is_file() {
                continue;
            }
            let metadata =
                fs::metadata(&entry_path).map_err(|err| format!("Unable to read file: {err}"))?;
            if metadata.len() > MAX_SEARCH_FILE_BYTES {
                continue;
            }
            let bytes = match fs::read(&entry_path) {
                Ok(bytes) => bytes,
                Err(_) => continue,
            };
            let content = match String::from_utf8(bytes) {
                Ok(content) => content,
                Err(_) => continue,
            };

            for (index, line) in content.lines().enumerate() {
                let haystack = if case_insensitive {
                    line.to_lowercase()
                } else {
                    line.to_string()
                };
                if haystack.contains(&needle) {
                    if matches.len() >= max_results {
                        truncated = true;
                        break;
                    }
                    let path_display = if let Ok(relative) = entry_path.strip_prefix(&root_path) {
                        relative.to_string_lossy().into_owned()
                    } else {
                        entry_path.to_string_lossy().into_owned()
                    };
                    matches.push(SearchMatch {
                        path: path_display,
                        line: line.to_string(),
                        line_number: (index + 1) as u32,
                    });
                }
            }
            if truncated {
                break;
            }
        }
        if truncated {
            break;
        }
    }

    Ok(SearchInFilesResponse {
        root: root_path.to_string_lossy().into_owned(),
        query: trimmed_query.to_string(),
        matches,
        truncated,
    })
}
