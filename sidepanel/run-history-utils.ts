export type ToolCategory = 'screenshots' | 'navigation' | 'extraction' | 'input' | 'other';

export type ToolFilter = 'all' | 'errors' | 'screenshots' | 'navigation' | 'extraction' | 'input';

export type HistoryScreenshot = {
  url: string;
  toolId: string;
  capturedAt: number;
  caption?: string;
};

export type HistoryToolEventSnapshot = {
  id: string;
  toolName: string;
  argsText: string;
  argsPreview?: string;
  resultText?: string;
  resultPreview?: string;
  status: 'running' | 'success' | 'error';
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
  category: ToolCategory;
  screenshotUrls?: string[];
  policy?: ToolPolicyInfo;
};

export type ToolPolicyInfo = {
  reason: string;
  type?: 'permission' | 'allowlist' | 'screenshots';
  category?: string;
  domain?: string;
};

export function truncateText(text: string, limit: number): string {
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

export function sanitizeToolPayload(value: unknown, limit = 2000): string {
  if (value === undefined || value === null) return '';
  const raw = typeof value === 'string' ? value : safeJsonStringify(value);
  if (!raw) return '';
  return truncateText(raw, limit);
}

export function safeJsonStringify(value: unknown): string {
  try {
    if (value === undefined) return '';
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function categorizeToolName(toolName: string): ToolCategory {
  const normalized = String(toolName || '').toLowerCase();
  if (normalized === 'screenshot') return 'screenshots';
  if (
    normalized === 'navigate' ||
    normalized === 'opentab' ||
    normalized === 'closetab' ||
    normalized === 'switchtab' ||
    normalized === 'focustab' ||
    normalized === 'grouptabs'
  ) {
    return 'navigation';
  }
  if (normalized === 'getcontent' || normalized === 'gettabs' || normalized === 'describesessiontabs') {
    return 'extraction';
  }
  if (normalized === 'click' || normalized === 'type' || normalized === 'presskey' || normalized === 'scroll') {
    return 'input';
  }
  return 'other';
}

export function extractScreenshotUrls(result: unknown): string[] {
  if (!result || typeof result !== 'object') return [];
  const record = result as Record<string, unknown>;
  const urls: string[] = [];

  const pushUrl = (value: unknown) => {
    if (typeof value === 'string' && value.startsWith('data:image')) {
      urls.push(value);
    }
  };

  pushUrl(record.dataUrl);
  pushUrl(record.data_url);
  pushUrl(record.image);
  pushUrl(record.imageUrl);
  pushUrl(record.image_url);
  pushUrl(record.screenshot);

  const images = record.images || record.screenshots;
  if (Array.isArray(images)) {
    images.forEach((entry) => {
      if (typeof entry === 'string') {
        pushUrl(entry);
      } else if (entry && typeof entry === 'object') {
        const item = entry as Record<string, unknown>;
        pushUrl(item.url);
        pushUrl(item.dataUrl);
        pushUrl(item.data_url);
        pushUrl(item.image);
      }
    });
  }

  return Array.from(new Set(urls));
}

export function normalizeToolFilter(value: unknown): ToolFilter {
  const normalized = String(value || '').toLowerCase();
  if (
    normalized === 'errors' ||
    normalized === 'screenshots' ||
    normalized === 'navigation' ||
    normalized === 'extraction' ||
    normalized === 'input'
  ) {
    return normalized as ToolFilter;
  }
  return 'all';
}

export function buildToolEventSnapshot(params: {
  id: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  startedAt?: number;
  previous?: HistoryToolEventSnapshot | null;
}): HistoryToolEventSnapshot {
  const now = Date.now();
  const startedAt = params.previous?.startedAt ?? params.startedAt ?? now;
  const toolName = params.toolName || 'tool';
  const category = params.previous?.category || categorizeToolName(toolName);
  const argsText = params.previous?.argsText || sanitizeToolPayload(params.args, 1600);
  const argsPreview = params.previous?.argsPreview || buildArgsPreview(params.args);
  const snapshot: HistoryToolEventSnapshot = {
    id: params.id,
    toolName,
    argsText,
    argsPreview,
    status: params.previous?.status || 'running',
    startedAt,
    category,
  };

  if (params.previous?.screenshotUrls?.length) {
    snapshot.screenshotUrls = params.previous.screenshotUrls;
  }
  if (params.previous?.policy) {
    snapshot.policy = params.previous.policy;
  }

  if (params.result !== undefined) {
    const resultRecord =
      typeof params.result === 'object' && params.result !== null ? (params.result as Record<string, unknown>) : null;
    const errorText = resultRecord && typeof resultRecord.error === 'string' ? resultRecord.error : '';
    const successFlag = resultRecord && typeof resultRecord.success === 'boolean' ? resultRecord.success : true;
    const isError = Boolean(errorText || successFlag === false);
    const messagePreview = resultRecord && typeof resultRecord.message === 'string' ? resultRecord.message : '';
    const summaryPreview = resultRecord && typeof resultRecord.summary === 'string' ? resultRecord.summary : '';

    snapshot.status = isError ? 'error' : 'success';
    snapshot.error = isError ? errorText || 'Tool failed' : undefined;
    snapshot.resultText = sanitizeToolPayload(params.result, 2400);
    snapshot.resultPreview = truncateText(errorText || messagePreview || summaryPreview, 120);
    snapshot.completedAt = now;
    snapshot.durationMs = startedAt ? now - startedAt : undefined;

    const screenshotUrls = extractScreenshotUrls(params.result);
    if (screenshotUrls.length) {
      snapshot.screenshotUrls = screenshotUrls;
      snapshot.category = 'screenshots';
    }

    const policy = extractPolicyInfo(resultRecord);
    if (policy) {
      snapshot.policy = policy;
    }
  }

  return snapshot;
}

function extractPolicyInfo(resultRecord: Record<string, unknown> | null): ToolPolicyInfo | null {
  const rawPolicy = resultRecord && typeof resultRecord.policy === 'object' ? resultRecord.policy : null;
  if (!rawPolicy || typeof rawPolicy !== 'object') return null;
  const policy = rawPolicy as Record<string, unknown>;
  const reasonValue = typeof policy.reason === 'string' ? policy.reason.trim() : '';
  const typeRaw = typeof policy.type === 'string' ? policy.type.trim().toLowerCase() : '';
  const typeValue = typeRaw === 'permission' || typeRaw === 'allowlist' || typeRaw === 'screenshots' ? typeRaw : '';
  const categoryValue = typeof policy.category === 'string' ? policy.category.trim() : '';
  const domainValue = typeof policy.domain === 'string' ? policy.domain.trim() : '';
  const reason = reasonValue || 'Tool blocked by policy.';
  return {
    reason,
    ...(typeValue ? { type: typeValue as ToolPolicyInfo['type'] } : {}),
    ...(categoryValue ? { category: categoryValue } : {}),
    ...(domainValue ? { domain: domainValue } : {}),
  };
}

export function buildArgsPreview(args: unknown): string {
  if (!args || typeof args !== 'object') return '';
  const record = args as Record<string, unknown>;
  if (typeof record.url === 'string') return record.url.substring(0, 30) + (record.url.length > 30 ? '...' : '');
  if (typeof record.text === 'string')
    return `"${record.text.substring(0, 20)}${record.text.length > 20 ? '...' : ''}"`;
  if (typeof record.selector === 'string') return record.selector.substring(0, 25);
  if (typeof record.key === 'string') return record.key;
  if (typeof record.direction === 'string') return record.direction;
  if (typeof record.type === 'string') return record.type;
  return '';
}
