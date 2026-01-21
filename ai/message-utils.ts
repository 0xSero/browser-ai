import type { MessageContent } from './message-schema.js';

export type ExtractThinkingResult = {
  content: string;
  thinking: string | null;
};

export function extractThinking(content: string | null | undefined, existingThinking: string | null = null) {
  let thinking: string | null = existingThinking || null;
  let cleanedContent = content || '';
  const thinkRegex = /<\s*(think|analysis|thinking)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;
  let match;
  const collected: string[] = [];

  while ((match = thinkRegex.exec(cleanedContent)) !== null) {
    if (match[2]) collected.push(match[2].trim());
  }

  if (collected.length > 0) {
    thinking = [existingThinking, ...collected].filter(Boolean).join('\n\n').trim();
    thinkRegex.lastIndex = 0;
    cleanedContent = cleanedContent.replace(thinkRegex, '').trim();
  }

  return { content: cleanedContent, thinking };
}

export function dedupeThinking(thinking: string | null) {
  if (!thinking) return '';
  
  // First, split into paragraphs and dedupe whole paragraphs
  const paragraphs = thinking.split(/\n\n+/);
  const seenParagraphs = new Set<string>();
  const dedupedParagraphs: string[] = [];
  
  for (const para of paragraphs) {
    const normalized = para.trim().toLowerCase();
    if (normalized && !seenParagraphs.has(normalized)) {
      seenParagraphs.add(normalized);
      dedupedParagraphs.push(para.trim());
    }
  }
  
  // Then dedupe consecutive identical lines within each paragraph
  const result = dedupedParagraphs.join('\n\n');
  const lines = result.split('\n');
  const deduplicated: string[] = [];
  let lastLine: string | null = null;
  let repeatCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === lastLine && trimmed !== '') {
      repeatCount++;
      if (repeatCount >= 2) {
        // Skip repeated lines after 2nd occurrence
        continue;
      }
    } else {
      deduplicated.push(line);
      lastLine = trimmed;
      repeatCount = 0;
    }
  }

  return deduplicated.join('\n').trim();
}

export function estimateTokensFromContent(content: MessageContent): number {
  if (!content) return 0;
  if (typeof content === 'string') return Math.ceil(content.length / 4);
  if (Array.isArray(content)) {
    return content.reduce((acc, part) => {
      if (typeof part === 'string') return acc + Math.ceil(part.length / 4);
      if (part && typeof part === 'object') {
        if ('text' in part && typeof part.text === 'string') return acc + Math.ceil(part.text.length / 4);
        try {
          return acc + Math.ceil(JSON.stringify(part).length / 4);
        } catch {
          return acc;
        }
      }
      return acc;
    }, 0);
  }
  try {
    return Math.ceil(JSON.stringify(content).length / 4);
  } catch {
    return Math.ceil(String(content).length / 4);
  }
}

export function safeJsonStringify(value: unknown): string {
  try {
    if (value === undefined) return '';
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
