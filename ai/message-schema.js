// Message schema utilities for extension <-> provider payloads
const ROLE_SET = new Set(['system', 'user', 'assistant', 'tool']);

export function createMessageId() {
  return `msg_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

export function createMessage({ role, content, ...meta } = {}) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return null;
  const message = {
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

export function normalizeConversationHistory(history = [], options = {}) {
  const messages = Array.isArray(history) ? history : [];
  const normalized = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const role = normalizeRole(msg.role || options.defaultRole);
    if (!role) continue;

    const base = {
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

export function toProviderMessages(history = []) {
  const normalized = normalizeConversationHistory(history, { addIds: false, addTimestamps: false });
  return normalized.map(msg => {
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: msg.toolCallId || msg.tool_call_id || '',
        content: normalizeToolContent(msg.content)
      };
    }

    const payload = {
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

export function normalizeToolCalls(toolCalls = []) {
  return toolCalls.map(call => ({
    id: typeof call?.id === 'string' ? call.id : createMessageId(),
    name: typeof call?.name === 'string' ? call.name : '',
    args: normalizeArgs(call?.args)
  }));
}

export function normalizeUsage(usage = {}) {
  return {
    inputTokens: Number(usage.inputTokens || 0),
    outputTokens: Number(usage.outputTokens || 0),
    totalTokens: Number(usage.totalTokens || 0)
  };
}

function normalizeRole(role) {
  if (typeof role !== 'string') return '';
  const lowered = role.toLowerCase();
  return ROLE_SET.has(lowered) ? lowered : '';
}

function normalizeContent(content) {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function normalizeArgs(args) {
  if (args && typeof args === 'object') return args;
  if (typeof args === 'string') {
    try {
      return JSON.parse(args);
    } catch {
      return { value: args };
    }
  }
  return {};
}

function normalizeToolContent(content) {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content ?? '');
  }
}
