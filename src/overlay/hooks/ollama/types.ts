import type { Message } from "ollama";

export type CaptureConsent = {
  approved: boolean;
};

export type ToolOptions = {
  toolsEnabled: boolean;
  agentEnabled?: boolean;
  requestScreenCapture?: () => Promise<CaptureConsent>;
  setCaptureInProgress?: (inProgress: boolean) => void;
  setToolUsage?: (usage: ToolUsage) => void;
  beforeCapture?: () => Promise<void> | void;
  afterCapture?: () => Promise<void> | void;
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
