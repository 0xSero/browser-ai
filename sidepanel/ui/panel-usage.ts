import type { UsagePayload, UsageStats } from './panel-types.js';
import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).formatCurrency = function formatCurrency(amount: number, currency = 'usd') {
  if (amount === null || amount === undefined) return '';
  const value = Number(amount) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(value);
  } catch (error) {
    return `${value.toFixed(2)} ${currency.toUpperCase()}`;
  }
};

(SidePanelUI.prototype as any).formatShortDate = function formatShortDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
};

(SidePanelUI.prototype as any).formatTokenCount = function formatTokenCount(value: number) {
  if (!value || value <= 0) return '0';
  if (value >= 1000) {
    const precision = value >= 10000 ? 0 : 1;
    return `${(value / 1000).toFixed(precision)}k`;
  }
  return `${Math.round(value)}`;
};

(SidePanelUI.prototype as any).normalizeUsage = function normalizeUsage(usage: UsagePayload | null) {
  if (!usage) return null;
  const inputTokens = Math.max(0, usage.inputTokens || 0);
  const outputTokens = Math.max(0, usage.outputTokens || 0);
  const totalTokens = Math.max(0, usage.totalTokens || inputTokens + outputTokens);
  if (!inputTokens && !outputTokens && !totalTokens) return null;
  return { inputTokens, outputTokens, totalTokens } as UsageStats;
};

(SidePanelUI.prototype as any).buildUsageLabel = function buildUsageLabel(usage: UsageStats | null) {
  if (!usage) return '';
  const parts: string[] = [];
  if (usage.inputTokens) {
    parts.push(`${this.formatTokenCount(usage.inputTokens)} in`);
  }
  if (usage.outputTokens) {
    parts.push(`${this.formatTokenCount(usage.outputTokens)} out`);
  }
  if (!parts.length && usage.totalTokens) {
    parts.push(`${this.formatTokenCount(usage.totalTokens)} total`);
  }
  return parts.length ? `Tokens ${parts.join(' / ')}` : '';
};

(SidePanelUI.prototype as any).buildMessageMeta = function buildMessageMeta(
  usage: UsageStats | null,
  modelLabel?: string | null,
) {
  const segments: string[] = [];
  const model = modelLabel?.trim();
  if (model) {
    segments.push(model);
  }
  const usageLabel = this.buildUsageLabel(usage);
  if (usageLabel) {
    segments.push(usageLabel);
  }
  return segments.join(' · ');
};

(SidePanelUI.prototype as any).estimateUsageFromContent = function estimateUsageFromContent(content: string) {
  if (!content) return null;
  const tokens = Math.ceil(content.length / 4);
  if (!tokens) return null;
  return {
    inputTokens: 0,
    outputTokens: tokens,
    totalTokens: tokens,
  } as UsageStats;
};

(SidePanelUI.prototype as any).getActiveModelLabel = function getActiveModelLabel() {
  const config = this.configs[this.currentConfig] || {};
  return config.model || '';
};

(SidePanelUI.prototype as any).updateUsageStats = function updateUsageStats(usage: UsageStats | null) {
  if (!usage) return;
  this.lastUsage = usage;
  this.sessionTokenTotals = {
    inputTokens: this.sessionTokenTotals.inputTokens + usage.inputTokens,
    outputTokens: this.sessionTokenTotals.outputTokens + usage.outputTokens,
    totalTokens: this.sessionTokenTotals.totalTokens + usage.totalTokens,
  };
  this.updateActivityState();
};
