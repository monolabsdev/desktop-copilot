import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
  type ToolCall,
} from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ChatResult } from "@langchain/core/outputs";
import type { StructuredTool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { Message as OllamaMessage } from "ollama";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createReadFileTool } from "../tools/readFile";
import { ollamaChat } from "./client";

type OllamaToolDefinition = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

type OllamaToolCall = {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
};

function contentToString(content: BaseMessage["content"]) {
  if (typeof content === "string") return content;
  return JSON.stringify(content);
}

function isZodSchema(schema: unknown): boolean {
  if (!schema || typeof schema !== "object") return false;
  const candidate = schema as { safeParse?: unknown; _def?: unknown };
  return (
    typeof candidate.safeParse === "function" ||
    typeof candidate._def === "object"
  );
}

function toOllamaToolCalls(calls?: ToolCall[]) {
  if (!calls?.length) return undefined;
  return calls.map(
    (call): OllamaToolCall => ({
      function: {
        name: call.name,
        arguments: call.args ?? {},
      },
    }),
  );
}

function toOllamaMessage(message: BaseMessage): OllamaMessage {
  const content = contentToString(message.content);
  const type = message._getType();
  if (type === "human") {
    return { role: "user", content };
  }
  if (type === "system") {
    return { role: "system", content };
  }
  if (type === "tool") {
    const toolMessage = message as ToolMessage;
    const rawToolName = toolMessage.name ?? toolMessage.additional_kwargs?.name;
    const toolName =
      typeof rawToolName === "string" && rawToolName.trim()
        ? rawToolName.trim()
        : "tool";
    return {
      role: "tool",
      content,
      tool_name: toolName,
    };
  }
  const aiMessage = message as AIMessage;
  const toolCalls = toOllamaToolCalls(aiMessage.tool_calls);
  return {
    role: "assistant",
    content,
    ...(toolCalls ? { tool_calls: toolCalls } : {}),
  };
}

function fromOllamaToolCalls(message: OllamaMessage): ToolCall[] | undefined {
  if (!message.tool_calls?.length) return undefined;
  return message.tool_calls.map((call, index) => {
    const name = call.function?.name ?? "tool";
    let args: Record<string, unknown> = {};
    const rawArgs = call.function?.arguments;
    if (rawArgs && typeof rawArgs === "object") {
      args = rawArgs as Record<string, unknown>;
    } else if (typeof rawArgs === "string") {
      try {
        args = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        args = { raw: rawArgs };
      }
    }
    return {
      id: `call_${index}`,
      name,
      args,
    };
  });
}

function toOllamaTools(tools: StructuredTool[]): OllamaToolDefinition[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema
        ? isZodSchema(tool.schema)
          ? (zodToJsonSchema(tool.schema as never) as Record<string, unknown>)
          : (tool.schema as Record<string, unknown>)
        : undefined,
    },
  }));
}

// Adapter that lets LangChain call into the Tauri-backed Ollama client.
class TauriOllamaChatModel extends BaseChatModel {
  private readonly model: string;
  private readonly tools?: OllamaToolDefinition[];

  constructor(fields: { model: string; tools?: OllamaToolDefinition[] }) {
    super({});
    this.model = fields.model;
    this.tools = fields.tools;
  }

  _llmType() {
    return "tauri-ollama";
  }

  bindTools(tools: StructuredTool[]) {
    return new TauriOllamaChatModel({
      model: this.model,
      tools: toOllamaTools(tools),
    });
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const response = await ollamaChat({
      model: this.model,
      messages: messages.map(toOllamaMessage),
      tools: this.tools,
    });

    const message = response.message;
    if (!message) {
      throw new Error("Invalid response from Ollama.");
    }

    const content = typeof message.content === "string" ? message.content : "";
    const toolCalls = fromOllamaToolCalls(message);
    const aiMessage = new AIMessage({
      content,
      tool_calls: toolCalls,
    });

    return {
      generations: [{ text: content, message: aiMessage }],
    };
  }
}

export function toLangChainHistory(messages: OllamaMessage[]) {
  const history: BaseMessage[] = [];
  messages.forEach((message, index) => {
    if (message.role === "user") {
      history.push(new HumanMessage(message.content ?? ""));
      return;
    }
    if (message.role === "assistant") {
      history.push(new AIMessage(message.content ?? ""));
      return;
    }
    if (message.role === "system") {
      history.push(new SystemMessage(message.content ?? ""));
      return;
    }
    if (message.role === "tool") {
      history.push(
        new ToolMessage({
          content: message.content ?? "",
          name: message.tool_name ?? "tool",
          tool_call_id: `tool-${index}`,
        }),
      );
      return;
    }
  });
  return history;
}

export function toOllamaMessages(messages: BaseMessage[]) {
  return messages.map(toOllamaMessage);
}

export function getLatestAssistantMessage(messages: BaseMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.getType() === "ai") {
      return toOllamaMessage(message);
    }
  }
  return null;
}

export async function createFileAgent(model: string) {
  // Keep the agent toolset minimal for safety.
  const tools = [createReadFileTool()];
  const llm = new TauriOllamaChatModel({ model });
  return createReactAgent({
    llm,
    tools,
    prompt:
      "You are Desktop Copilot. Use tools when needed. Use read_file to access local files. Do not claim to read files you did not open.",
  });
}
