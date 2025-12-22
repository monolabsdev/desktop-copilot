import { invoke } from "@tauri-apps/api/core";
import type { Message } from "ollama";

export type OllamaChatRequest = {
  model: string;
  messages: Message[];
  tools?: unknown;
};

export type OllamaChatResponse = {
  message?: Message;
};

export async function ollamaHealthCheck() {
  return invoke("ollama_health_check");
}

export async function ollamaChat(request: OllamaChatRequest) {
  const payload: Record<string, unknown> = {
    model: request.model,
    messages: request.messages,
    stream: false,
  };
  if (request.tools) payload.tools = request.tools;
  return invoke<OllamaChatResponse>("ollama_chat", { request: payload });
}
