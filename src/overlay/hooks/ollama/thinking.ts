import type { Message } from "ollama";

import type { AssistantPayload } from "./types";

const THINKING_TAGS = [
  /<think>([\s\S]*?)<\/think>/gi,
  /<thinking>([\s\S]*?)<\/thinking>/gi,
];

export function extractThinking(content: string) {
  let cleaned = content;
  const thinkingParts: string[] = [];

  THINKING_TAGS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, (_match, inner) => {
      if (typeof inner === "string") {
        const trimmed = inner.trim();
        if (trimmed) thinkingParts.push(trimmed);
      }
      return "";
    });
  });

  return {
    content: cleaned.trim(),
    thinking: thinkingParts.length
      ? thinkingParts.join("\n\n").trim()
      : undefined,
  };
}

export function normalizeThinkingValue(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^[\.\?\!]+$/.test(trimmed)) return undefined;
  return trimmed;
}

export function mergeStreamText(current: string | undefined, next: string) {
  if (!current) return next;
  if (next.startsWith(current)) return next;
  return current + next;
}

export function chooseThinking(
  responseThinking?: string,
  extractedThinking?: string,
) {
  if (!extractedThinking) return responseThinking;
  if (!responseThinking) return extractedThinking;
  const responseWords = responseThinking.split(/\s+/).filter(Boolean);
  if (responseWords.length <= 2 && responseThinking.length <= 24) {
    return extractedThinking;
  }
  return responseThinking;
}

export function normalizeAssistantMessage(
  assistantMessage: AssistantPayload | undefined,
  thinkingDurationMs?: number,
) {
  if (!assistantMessage) throw new Error("Invalid response from Ollama.");

  const responseContent = assistantMessage.content ?? "";
  const responseThinking = normalizeThinkingValue(
    assistantMessage.reasoning ??
      assistantMessage.thinking ??
      assistantMessage.thoughts,
  );

  const extracted = extractThinking(responseContent);
  const extractedThinking = normalizeThinkingValue(extracted.thinking);
  const thinking = chooseThinking(responseThinking, extractedThinking);

  const content = extracted.content;
  const historyMessage: Message = { role: "assistant", content };
  if (!content.trim() && !thinking) throw new Error("No response from Ollama.");

  return {
    historyMessage,
    displayMessage: { ...historyMessage, thinking, thinkingDurationMs },
  };
}
