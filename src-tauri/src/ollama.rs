use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const OLLAMA_BASE_URL: &str = "http://localhost:11434";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaHealthPayload {
    pub ok: bool,
    pub error: Option<String>,
}

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|err| format!("HTTP client error: {err}"))
}

fn describe_reqwest_error(err: &reqwest::Error) -> String {
    if err.is_timeout() {
        return "timeout while connecting to Ollama".to_string();
    }
    if err.is_connect() {
        return "connection refused by Ollama".to_string();
    }
    format!("request error: {err}")
}

async fn check_ollama_health() -> Result<(), String> {
    let client = build_client()?;
    let url = format!("{}/api/tags", OLLAMA_BASE_URL);
    let response = client.get(url).send().await.map_err(|err| {
        let detail = describe_reqwest_error(&err);
        eprintln!("Ollama health check failed: {detail}");
        detail
    })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let detail = format!("non-200 from Ollama: {status} {body}");
        eprintln!("Ollama health check failed: {detail}");
        return Err(detail);
    }

    Ok(())
}

pub async fn emit_health_if_needed(app: AppHandle) {
    if let Err(err) = check_ollama_health().await {
        let payload = OllamaHealthPayload {
            ok: false,
            error: Some(err),
        };
        let _ = app.emit("ollama:health", payload);
    }
}

#[tauri::command]
pub async fn ollama_health_check() -> Result<(), String> {
    check_ollama_health().await
}

#[tauri::command]
pub async fn ollama_chat(request: Value) -> Result<Value, String> {
    let client = build_client()?;
    let mut payload = request;
    let Some(obj) = payload.as_object_mut() else {
        return Err("Invalid request payload.".to_string());
    };
    obj.insert("stream".to_string(), Value::Bool(false));

    let url = format!("{}/api/chat", OLLAMA_BASE_URL);
    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|err| {
            let detail = describe_reqwest_error(&err);
            eprintln!("Ollama chat request failed: {detail}");
            detail
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let detail = format!("non-200 from Ollama: {status} {body}");
        eprintln!("Ollama chat request failed: {detail}");
        return Err(detail);
    }

    response.json::<Value>().await.map_err(|err| {
        let detail = format!("invalid Ollama response: {err}");
        eprintln!("Ollama chat request failed: {detail}");
        detail
    })
}
