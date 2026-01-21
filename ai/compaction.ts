import type { Message } from './message-schema.js';
import { estimateTokensFromContent } from './message-utils.js';

export type CompactionResult = {
  compacted: Message[];
  summaryMessage: Message;
  trimmedCount: number;
  preservedCount: number;
};

export function estimateTokensFromMessages(messages: Message[], baseTokens = 1200): number {
  const contentTokens = messages.reduce((acc, msg) => acc + estimateTokensFromContent(msg?.content), 0);
  return baseTokens + contentTokens;
}

export function shouldCompact({
  messages,
  contextLimit,
  threshold = 0.85,
  baseTokens = 1200,
}: {
  messages: Message[];
  contextLimit: number;
  threshold?: number;
  baseTokens?: number;
}): { shouldCompact: boolean; approxTokens: number; percent: number } {
  const approxTokens = estimateTokensFromMessages(messages, baseTokens);
  const percent = contextLimit > 0 ? approxTokens / contextLimit : 0;
  return { shouldCompact: percent >= threshold, approxTokens, percent };
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
}): CompactionResult {
  return {
    compacted: [summaryMessage, ...preserved],
    summaryMessage,
    trimmedCount,
    preservedCount: preserved.length,
  };
}
