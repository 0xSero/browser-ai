import type { RetryCounts, RunPhase } from '../types/runtime-messages.js';

export type RetryCategory = 'api' | 'tool' | 'finalize';

export type ErrorCategory = 'api' | 'tool' | 'validation' | 'policy';

export type RetryStatus = {
  phase: RunPhase;
  attempts: RetryCounts;
  maxRetries: RetryCounts;
  lastError?: string;
  note?: string;
};

export type RetryEngineOptions = {
  maxApiRetries: number;
  maxToolRetries: number;
  maxFinalizeRetries: number;
  backoff?: (attempt: number, category: RetryCategory) => number;
  onStatus?: (status: RetryStatus) => void;
};

export type BackoffOptions = {
  baseMs?: number;
  maxMs?: number;
  jitter?: number;
  rng?: () => number;
};

const DEFAULT_QUIT_PHRASES = [
  'please try again',
  'i could not produce a final summary',
  'i could not produce a final response',
  'unable to produce a final summary',
  'unable to provide a final response',
];

export function createExponentialBackoff(options: BackoffOptions = {}) {
  const baseMs = Number.isFinite(options.baseMs) ? Number(options.baseMs) : 500;
  const maxMs = Number.isFinite(options.maxMs) ? Number(options.maxMs) : 8000;
  const jitter = Number.isFinite(options.jitter) ? Number(options.jitter) : 0.2;
  const rng = options.rng || Math.random;

  return (attempt: number) => {
    const safeAttempt = Math.max(1, Math.floor(attempt));
    const raw = Math.min(maxMs, baseMs * 2 ** (safeAttempt - 1));
    if (jitter <= 0) return Math.round(raw);
    const jitterFactor = 1 + (rng() * 2 - 1) * jitter;
    return Math.round(raw * jitterFactor);
  };
}

export function isValidFinalResponse(
  text: unknown,
  options: { quitPhrases?: string[]; allowEmpty?: boolean } = {},
): text is string {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  // Allow empty responses if tool calls were made (model communicated through actions)
  if (!trimmed) return options.allowEmpty === true;
  const lowered = trimmed.toLowerCase();
  const phrases = options.quitPhrases || DEFAULT_QUIT_PHRASES;
  return !phrases.some((phrase) => lowered.includes(phrase));
}

export function classifyError(error: unknown): ErrorCategory {
  const message = normalizeError(error).toLowerCase();
  if (!message) return 'tool';
  if (
    message.includes('permission') ||
    message.includes('blocked') ||
    message.includes('not allowed') ||
    message.includes('disabled')
  ) {
    return 'policy';
  }
  if (message.includes('invalid') || message.includes('missing') || message.includes('unknown tool')) {
    return 'validation';
  }
  if (
    message.includes('timeout') ||
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('api')
  ) {
    return 'api';
  }
  return 'tool';
}

export class RetryEngine {
  phase: RunPhase;
  attempts: RetryCounts;
  maxRetries: RetryCounts;
  lastError?: string;
  backoff: (attempt: number, category: RetryCategory) => number;
  onStatus?: (status: RetryStatus) => void;

  constructor(options: RetryEngineOptions) {
    this.phase = 'planning';
    this.attempts = { api: 0, tool: 0, finalize: 0 };
    this.maxRetries = {
      api: Math.max(0, Math.floor(options.maxApiRetries)),
      tool: Math.max(0, Math.floor(options.maxToolRetries)),
      finalize: Math.max(0, Math.floor(options.maxFinalizeRetries)),
    };
    this.backoff = options.backoff || createExponentialBackoff();
    this.onStatus = options.onStatus;
  }

  setPhase(phase: RunPhase, note?: string) {
    this.phase = phase;
    this.emitStatus(note);
  }

  markCompleted(note?: string) {
    this.setPhase('completed', note);
  }

  markStopped(note?: string, error?: unknown) {
    if (error) {
      this.lastError = normalizeError(error);
    }
    this.setPhase('stopped', note);
  }

  markFailed(note?: string, error?: unknown) {
    if (error) {
      this.lastError = normalizeError(error);
    }
    this.setPhase('failed', note);
  }

  registerRetry(category: RetryCategory, error: unknown, note?: string): boolean {
    this.attempts[category] = Math.max(0, this.attempts[category] + 1);
    this.lastError = normalizeError(error);
    this.emitStatus(note);
    return this.attempts[category] <= this.maxRetries[category];
  }

  canRetry(category: RetryCategory): boolean {
    return this.attempts[category] < this.maxRetries[category];
  }

  async wait(category: RetryCategory, signal?: AbortSignal | null) {
    const attempt = Math.max(1, this.attempts[category]);
    const delay = this.backoff(attempt, category);
    if (!signal) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return;
    }
    if (signal.aborted) {
      throw createAbortError();
    }
    await new Promise<void>((resolve, reject) => {
      const timer = globalThis.setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, delay);
      const onAbort = () => {
        globalThis.clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(createAbortError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private emitStatus(note?: string) {
    if (!this.onStatus) return;
    this.onStatus({
      phase: this.phase,
      attempts: { ...this.attempts },
      maxRetries: { ...this.maxRetries },
      lastError: this.lastError,
      note,
    });
  }
}

function normalizeError(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || error.name;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function createAbortError() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}
