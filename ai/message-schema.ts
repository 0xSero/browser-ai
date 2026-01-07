// Message schema utilities for extension <-> provider payloads
export type Role = 'system' | 'user' | 'assistant' | 'tool';
export type ContentPart =
  | string
  | {
      type?: string;
      text?: string;
      content?: unknown;
      image_url?: { url?: string };
      source?: { type?: string; media_type?: string; data?: string };
      tool_use_id?: string;
      id?: string;
      name?: string;
      input?: unknown;
      [key: string]: any;
    };
export type MessageContent = string | ContentPart[] | Record<string, unknown>;
export type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};
export type Usage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};
export type OpenAIFunctionCall = {
  name?: string;
  arguments?: string;
};
export type OpenAIToolCall = {
  id?: string;
  type?: string;
  function?: OpenAIFunctionCall;
  func?: OpenAIFunctionCall;
  tool?: OpenAIFunctionCall;
  name?: string;
  arguments?: string;
  index?: number;
};
export type Message = {
  id?: string;
  createdAt?: string;
  role: Role;
  content: MessageContent;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  function_call?: OpenAIFunctionCall;
  name?: string;
  usage?: Usage;
};
export type ProviderMessage = {
  role: Role;
  content: MessageContent;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
};

const ROLE_SET = new Set<Role>(['system', 'user', 'assistant', 'tool']);

export function createMessageId(): string {
  return `msg_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

export function createMessage({ role, content, ...meta }: Partial<Message> = {}): Message | null {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return null;
  const message: Message = {
    id: meta.id || createMessageId(),
    createdAt: meta.createdAt || new Date().toISOString(),
    role: normalizedRole,
    content: normalizeContent(content)
  };

  if (meta.toolCalls) message.toolCalls = normalizeToolCalls(meta.toolCalls);
  if (meta.toolCallId) message.toolCallId = String(meta.toolCallId);
  if (meta.name) message.name = String(meta.name);
  if (meta.usage) message.usage = normalizeUsage(meta.usage);
  return message;
}

export function normalizeConversationHistory(
  history: Message[] = [],
  options: { defaultRole?: Role; addIds?: boolean; addTimestamps?: boolean } = {}
): Message[] {
  const messages = Array.isArray(history) ? history : [];
  const normalized: Message[] = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const role = normalizeRole(msg.role || options.defaultRole);
    if (!role) continue;

    const base: Message = {
      role,
      content: normalizeContent(msg.content)
    };

    const id = typeof msg.id === 'string' ? msg.id : (options.addIds === false ? null : createMessageId());
    if (id) base.id = id;

    const createdAt = typeof msg.createdAt === 'string'
      ? msg.createdAt
      : (options.addTimestamps === false ? null : new Date().toISOString());
    if (createdAt) base.createdAt = createdAt;

    if (role === 'assistant') {
      const toolCalls = msg.toolCalls || msg.tool_calls;
      if (Array.isArray(toolCalls)) {
        base.toolCalls = normalizeToolCalls(toolCalls);
      }
    }

    if (role === 'tool') {
      const toolCallId = msg.toolCallId || msg.tool_call_id;
      if (toolCallId) base.toolCallId = String(toolCallId);
      if (msg.name) base.name = String(msg.name);
    }

    if (msg.usage) base.usage = normalizeUsage(msg.usage);

    normalized.push(base);
  }
  return normalized;
}

export function toProviderMessages(history: Message[] = []): ProviderMessage[] {
  const normalized = normalizeConversationHistory(history as Message[], { addIds: false, addTimestamps: false });
  return normalized.map(msg => {
    if (msg.role === 'tool') {
      const toolCallId = msg.toolCallId || (msg as any).tool_call_id || '';
      return {
        role: 'tool',
        tool_call_id: toolCallId,
        content: normalizeToolContent(msg.content)
      };
    }

    const payload: ProviderMessage = {
      role: msg.role,
      content: msg.content
    };

    if (msg.role === 'assistant' && Array.isArray(msg.toolCalls)) {
      payload.tool_calls = msg.toolCalls.map(call => ({
        id: call.id || createMessageId(),
        type: 'function',
        function: {
          name: call.name || '',
          arguments: JSON.stringify(call.args || {})
        }
      }));
    }
    return payload;
  });
}

export function normalizeToolCalls(toolCalls: Array<ToolCall | OpenAIToolCall> = []): ToolCall[] {
  return toolCalls.map(call => ({
    id: typeof call?.id === 'string' ? call.id : createMessageId(),
    name: typeof call?.name === 'string'
      ? call.name
      : (call && typeof (call as OpenAIToolCall).function?.name === 'string')
        ? String((call as OpenAIToolCall).function?.name)
        : '',
    args: normalizeArgs(
      (call as ToolCall)?.args ??
      (call as OpenAIToolCall)?.arguments ??
      (call as OpenAIToolCall)?.function?.arguments
    )
  }));
}

export function normalizeUsage(usage: Partial<Usage> = {}): Usage {
  return {
    inputTokens: Number(usage.inputTokens || 0),
    outputTokens: Number(usage.outputTokens || 0),
    totalTokens: Number(usage.totalTokens || 0)
  };
}

function normalizeRole(role?: string): Role | '' {
  if (typeof role !== 'string') return '';
  const lowered = role.toLowerCase();
  return ROLE_SET.has(lowered as Role) ? (lowered as Role) : '';
}

function normalizeContent(content: MessageContent | null | undefined): MessageContent {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function normalizeArgs(args: unknown): Record<string, unknown> {
  if (args && typeof args === 'object' && !Array.isArray(args)) return args as Record<string, unknown>;
  if (Array.isArray(args)) return { value: args };
  if (typeof args === 'string') {
    try {
      return JSON.parse(args);
    } catch {
      return { value: args };
    }
  }
  return {};
}

function normalizeToolContent(content: MessageContent): string {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content ?? '');
  }
}
