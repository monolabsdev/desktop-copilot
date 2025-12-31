use serde::Serialize;

const KEYRING_SERVICE: &str = "desktop-copilot";
const OLLAMA_WEB_SEARCH_API_KEY_ENV: &str = "OLLAMA_WEB_SEARCH_API_KEY";
const WEB_SEARCH_KEY_NAME: &str = "ollama_web_search_api_key";

#[derive(Debug, Serialize, Clone)]
pub struct WebSearchKeyStatus {
    pub has_key: bool,
    pub source: Option<String>,
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, WEB_SEARCH_KEY_NAME)
        .map_err(|err| format!("Keyring init error: {err}"))
}

fn env_key() -> Option<String> {
    std::env::var(OLLAMA_WEB_SEARCH_API_KEY_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn keyring_key() -> Result<Option<String>, String> {
    let entry = keyring_entry()?;
    match entry.get_password() {
        Ok(value) => {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                Ok(Some(trimmed))
            }
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(format!("Keyring read error: {err}")),
    }
}

pub fn load_web_search_api_key() -> Result<String, String> {
    if let Some(key) = env_key() {
        return Ok(key);
    }
    if let Some(key) = keyring_key()? {
        return Ok(key);
    }
    Err("Missing OLLAMA_WEB_SEARCH_API_KEY env var or saved key.".to_string())
}

#[tauri::command]
pub fn get_ollama_web_search_key_status() -> Result<WebSearchKeyStatus, String> {
    if env_key().is_some() {
        return Ok(WebSearchKeyStatus {
            has_key: true,
            source: Some("env".to_string()),
        });
    }
    if keyring_key()?.is_some() {
        return Ok(WebSearchKeyStatus {
            has_key: true,
            source: Some("keyring".to_string()),
        });
    }
    Ok(WebSearchKeyStatus {
        has_key: false,
        source: None,
    })
}

#[tauri::command]
pub fn set_ollama_web_search_api_key(key: String) -> Result<(), String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err("API key is required.".to_string());
    }
    let entry = keyring_entry()?;
    entry
        .set_password(trimmed)
        .map_err(|err| format!("Keyring write error: {err}"))
}

#[tauri::command]
pub fn clear_ollama_web_search_api_key() -> Result<(), String> {
    let entry = keyring_entry()?;
    match entry.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(format!("Keyring delete error: {err}")),
    }
}
