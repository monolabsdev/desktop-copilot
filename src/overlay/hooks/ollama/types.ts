import type { Message } from "ollama";

export type CaptureConsent = {
  approved: boolean;
};

export type ToolOptions = {
  toolsEnabled: boolean;
  requestScreenCapture?: () => Promise<CaptureConsent>;
  setCaptureInProgress?: (inProgress: boolean) => void;
  setToolUsage?: (usage: ToolUsage) => void;
  beforeCapture?: () => Promise<void> | void;
  afterCapture?: () => Promise<void> | void;
  visionModel?: string;
  onLocalMessage?: (message: ChatMessage) => void;
  onToolActivity?: (activity: string | null) => void;
};

export type ToolUsage = {
  inProgress: boolean;
  name?: string;
  lastUsedAt?: number;
};

export type ChatMessage = Message & {
  thinking?: string;
  thinkingDurationMs?: number;
  streamId?: number;
  imagePath?: string;
  imageMime?: string;
  imagePreviewBase64?: string;
  imagePreviewMime?: string;
  toolActivity?: string;
};

export type AssistantPayload = Message & {
  reasoning?: string;
  thinking?: string;
  thoughts?: string;
};

export type StreamPayload = {
  stream_id: string;
  chunk?: {
    done?: boolean;
    message?: AssistantPayload;
  };
  error?: string;
};

export type StreamResult = {
  assistantMessage?: AssistantPayload;
  toolCalls?: NonNullable<Message["tool_calls"]>;
  streamMessageId?: number;
  thinkingDurationMs?: number;
};
