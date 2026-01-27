import type { Message, Usage } from './message-schema.js';
import { estimateTokensFromContent } from './message-utils.js';

export type CompactionSettings = {
  enabled: boolean;
  reserveTokens: number;
  keepRecentTokens: number;
};

export const DEFAULT_COMPACTION_SETTINGS: CompactionSettings = {
  enabled: true,
  reserveTokens: 16384,
  keepRecentTokens: 20000,
};

export const SUMMARIZATION_SYSTEM_PROMPT = `You are a context summarization assistant. Your task is to read a conversation between a user and an AI coding assistant, then produce a structured summary following the exact format specified.

Do NOT continue the conversation. Do NOT respond to any questions in the conversation. ONLY output the structured summary.`;

export const SUMMARIZATION_PROMPT = `The messages above are a conversation to summarize. Create a structured context checkpoint summary that another LLM will use to continue the work.

Use this EXACT format:

## Goal
[What is the user trying to accomplish? Can be multiple items if the session covers different tasks.]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned by user]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [Ordered list of what should happen next]

## Critical Context
- [Any data, examples, or references needed to continue]
- [Or "(none)" if not applicable]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

export const UPDATE_SUMMARIZATION_PROMPT = `The messages above are NEW conversation messages to incorporate into the existing summary provided in <previous-summary> tags.

Update the existing structured summary with new information. RULES:
- PRESERVE all existing information from the previous summary
- ADD new progress, decisions, and context from the new messages
- UPDATE the Progress section: move items from "In Progress" to "Done" when completed
- UPDATE "Next Steps" based on what was accomplished
- PRESERVE exact file paths, function names, and error messages
- If something is no longer relevant, you may remove it

Use this EXACT format:

## Goal
[Preserve existing goals, add new ones if the task expanded]

## Constraints & Preferences
- [Preserve existing, add new ones discovered]

## Progress
### Done
- [x] [Include previously done items AND newly completed items]

### In Progress
- [ ] [Current work - update based on progress]

### Blocked
- [Current blockers - remove if resolved]

## Key Decisions
- **[Decision]**: [Brief rationale] (preserve all previous, add new)

## Next Steps
1. [Update based on current state]

## Critical Context
- [Preserve important context, add new if needed]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

function calculateContextTokens(usage: Usage): number {
  return usage.totalTokens || usage.inputTokens + usage.outputTokens;
}

function getAssistantUsage(message: Message): Usage | undefined {
  if (message.role !== 'assistant') return undefined;
  return message.usage && message.usage.totalTokens >= 0 ? message.usage : undefined;
}

function getLastAssistantUsageInfo(messages: Message[]): { usage: Usage; index: number } | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const usage = getAssistantUsage(messages[i]);
    if (usage) return { usage, index: i };
  }
  return undefined;
}

export function estimateContextTokens(messages: Message[]): {
  tokens: number;
  usageTokens: number;
  trailingTokens: number;
  lastUsageIndex: number | null;
} {
  const usageInfo = getLastAssistantUsageInfo(messages);
  if (!usageInfo) {
    let estimated = 0;
    for (const message of messages) {
      estimated += estimateTokens(message);
    }
    return {
      tokens: estimated,
      usageTokens: 0,
      trailingTokens: estimated,
      lastUsageIndex: null,
    };
  }

  const usageTokens = calculateContextTokens(usageInfo.usage);
  let trailingTokens = 0;
  for (let i = usageInfo.index + 1; i < messages.length; i += 1) {
    trailingTokens += estimateTokens(messages[i]);
  }

  return {
    tokens: usageTokens + trailingTokens,
    usageTokens,
    trailingTokens,
    lastUsageIndex: usageInfo.index,
  };
}

export function shouldCompact({
  contextTokens,
  contextLimit,
  settings = DEFAULT_COMPACTION_SETTINGS,
}: {
  contextTokens: number;
  contextLimit: number;
  settings?: CompactionSettings;
}): { shouldCompact: boolean; approxTokens: number; percent: number } {
  if (!settings.enabled) {
    return { shouldCompact: false, approxTokens: contextTokens, percent: 0 };
  }
  const percent = contextLimit > 0 ? contextTokens / contextLimit : 0;
  return {
    shouldCompact: contextTokens > contextLimit - settings.reserveTokens,
    approxTokens: contextTokens,
    percent,
  };
}

function estimateTokens(message: Message): number {
  let tokens = estimateTokensFromContent(message.content);
  if (message.thinking) {
    tokens += Math.ceil(message.thinking.length / 4);
  }

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (!part || typeof part !== 'object') continue;
      if (part.type === 'image' || part.type === 'image_url' || part.type === 'image_url') {
        tokens += 1200;
      }
      if (part.source?.data) {
        tokens += 1200;
      }
    }
  }

  if (message.role === 'assistant' && Array.isArray(message.toolCalls)) {
    tokens += Math.ceil(JSON.stringify(message.toolCalls).length / 4);
  }
  return tokens;
}

function isValidCutPoint(message: Message): boolean {
  return message.role !== 'tool';
}

export function findCutPoint(messages: Message[], startIndex: number, keepRecentTokens: number): number {
  const cutPoints = messages
    .map((msg, index) => ({ msg, index }))
    .filter(({ msg, index }) => index >= startIndex && isValidCutPoint(msg))
    .map(({ index }) => index);

  if (cutPoints.length === 0) return startIndex;

  let accumulatedTokens = 0;
  let cutIndex = cutPoints[0];

  for (let i = messages.length - 1; i >= startIndex; i -= 1) {
    accumulatedTokens += estimateTokens(messages[i]);
    if (accumulatedTokens >= keepRecentTokens) {
      for (let c = 0; c < cutPoints.length; c += 1) {
        if (cutPoints[c] >= i) {
          cutIndex = cutPoints[c];
          break;
        }
      }
      break;
    }
  }

  if (messages[cutIndex]?.role === 'tool' && cutIndex > startIndex) {
    let adjusted = cutIndex - 1;
    while (adjusted > startIndex && messages[adjusted].role === 'tool') {
      adjusted -= 1;
    }
    cutIndex = adjusted;
  }

  return cutIndex;
}

export function serializeConversation(messages: Message[]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    const contentText = normalizeContentText(msg.content);
    if (msg.role === 'user') {
      if (contentText) parts.push(`[User]: ${contentText}`);
    } else if (msg.role === 'assistant') {
      if (msg.thinking) parts.push(`[Assistant thinking]: ${msg.thinking}`);
      if (contentText) parts.push(`[Assistant]: ${contentText}`);
      if (Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
        const toolCalls = msg.toolCalls
          .map((call) => `${call.name}(${JSON.stringify(call.args || {})})`)
          .join('; ');
        parts.push(`[Assistant tool calls]: ${toolCalls}`);
      }
    } else if (msg.role === 'tool') {
      if (contentText) parts.push(`[Tool result]: ${contentText}`);
    } else if (msg.role === 'system') {
      if (contentText) parts.push(`[System]: ${contentText}`);
    }
  }

  return parts.join('\n\n');
}

function normalizeContentText(content: Message['content']): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          if (typeof part.text === 'string') return part.text;
          if (typeof part.content === 'string') return part.content;
          try {
            return JSON.stringify(part);
          } catch {
            return '';
          }
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content ?? '');
  }
}

export function buildCompactionSummaryMessage(summary: string, trimmedCount: number): Message {
  return {
    role: 'system',
    content: summary.trim(),
    meta: {
      kind: 'summary',
      summaryOfCount: trimmedCount,
      source: 'auto',
    },
  };
}

export function applyCompaction({
  summaryMessage,
  preserved,
  trimmedCount,
}: {
  summaryMessage: Message;
  preserved: Message[];
  trimmedCount: number;
}): {
  compacted: Message[];
  summaryMessage: Message;
  trimmedCount: number;
  preservedCount: number;
} {
  return {
    compacted: [summaryMessage, ...preserved],
    summaryMessage,
    trimmedCount,
    preservedCount: preserved.length,
  };
}
