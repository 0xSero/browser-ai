import type {
  AssistantContent,
  JSONValue,
  ModelMessage,
  ToolContent,
  ToolResultPart,
  UserContent,
} from "ai";
import type { Message, MessageContent } from "./message-schema.js";

export function toModelMessages(history: Message[] = []): ModelMessage[] {
  const normalized = Array.isArray(history) ? history : [];
  return normalized
    .filter((msg) => msg && msg.role)
    .map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "tool",
          content: normalizeToolContent(msg),
        };
      }
      if (msg.role === "assistant") {
        return {
          role: "assistant",
          content: normalizeAssistantContent(msg),
        };
      }
      if (msg.role === "system") {
        return {
          role: "system",
          content: normalizeSystemContent(msg.content),
        };
      }
      return {
        role: "user",
        content: normalizeUserContent(msg.content),
      };
    });
}

function normalizeToolContent(message: Message): ToolContent {
  const content = message.content;
  if (Array.isArray(content)) {
    const parts = content.filter(
      (part) => part && typeof part === "object" && "type" in part,
    ) as ToolResultPart[];
    if (parts.length) return parts;
  }
  const toolCallId =
    message.toolCallId || message.tool_call_id || `tool_${Date.now()}`;
  return [
    {
      type: "tool-result",
      toolCallId: String(toolCallId),
      toolName: message.name || message.toolName || "tool",
      output: normalizeToolOutput(content),
    },
  ];
}

function normalizeToolOutput(
  content: MessageContent,
): ToolResultPart["output"] {
  if (typeof content === "string") {
    return { type: "text", value: content };
  }
  if (content && typeof content === "object") {
    return {
      type: "json",
      value: coerceJsonValue(content),
    };
  }
  return { type: "text", value: "" };
}

function normalizeUserContent(content: MessageContent): UserContent {
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return { type: "text", text: part } as const;
        }
        if (part && typeof part === "object") {
          if ("text" in part && typeof part.text === "string") {
            return { type: "text", text: part.text } as const;
          }
          if ("image" in part && part.image) {
            return { type: "image", image: part.image } as const;
          }
          if ("image_url" in part && part.image_url?.url) {
            return { type: "image", image: part.image_url.url } as const;
          }
        }
        return { type: "text", text: "" } as const;
      })
      .filter(Boolean);
  }
  if (typeof content === "string") return content;
  if (content && typeof content === "object") return JSON.stringify(content);
  return "";
}

function normalizeAssistantContent(message: Message): AssistantContent {
  if (message.thinking) {
    const text = typeof message.content === "string" ? message.content : "";
    return [
      { type: "reasoning", text: message.thinking } as const,
      { type: "text", text } as const,
    ];
  }
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string")
          return { type: "text", text: part } as const;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return { type: "text", text: part.text } as const;
        }
        return null;
      })
      .filter((part): part is { type: "text"; text: string } => part !== null);
  }
  if (message.content && typeof message.content === "object") {
    return JSON.stringify(message.content);
  }
  return "";
}

function normalizeSystemContent(content: MessageContent) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .join("\n");
  }
  if (content && typeof content === "object") return JSON.stringify(content);
  return "";
}

function coerceJsonValue(value: unknown): JSONValue {
  try {
    return JSON.parse(JSON.stringify(value)) as JSONValue;
  } catch {
    return String(value ?? "");
  }
}
