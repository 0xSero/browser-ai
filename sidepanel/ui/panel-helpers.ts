import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).safeJsonStringify = function safeJsonStringify(value: any) {
  try {
    if (value === undefined) return '';
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
};

(SidePanelUI.prototype as any).truncateText = function truncateText(text: string, limit = 1200) {
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
};

(SidePanelUI.prototype as any).escapeHtmlBasic = function escapeHtmlBasic(text: string) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
};

(SidePanelUI.prototype as any).escapeHtml = function escapeHtml(text: string) {
  return this.escapeHtmlBasic(text).replace(/\n/g, '<br>');
};

(SidePanelUI.prototype as any).escapeAttribute = function escapeAttribute(value: string) {
  return this.escapeHtmlBasic(value).replace(/"/g, '&quot;');
};
