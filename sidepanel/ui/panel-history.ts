import { normalizeConversationHistory } from '../../ai/message-schema.js';
import { dedupeThinking, extractThinking } from '../../ai/message-utils.js';
import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).persistHistory = async function persistHistory() {
  if (!this.elements.saveHistory || this.elements.saveHistory.value !== 'true') return;
  const entry = {
    id: this.sessionId,
    startedAt: this.sessionStartedAt,
    updatedAt: Date.now(),
    title: this.firstUserMessage || 'Session',
    transcript: this.displayHistory.slice(-200),
  };
  const existing = await chrome.storage.local.get(['chatSessions']);
  const sessions = existing.chatSessions || [];
  const filtered = sessions.filter((s: any) => s.id !== entry.id);
  filtered.unshift(entry);
  const trimmed = filtered.slice(0, 20);
  await chrome.storage.local.set({ chatSessions: trimmed });
  this.loadHistoryList();
};

(SidePanelUI.prototype as any).loadHistoryList = async function loadHistoryList() {
  if (!this.elements.historyItems) return;
  const { chatSessions = [] } = await chrome.storage.local.get(['chatSessions']);
  this.elements.historyItems.innerHTML = '';
  if (!chatSessions.length) {
    this.elements.historyItems.innerHTML = '<div class="history-empty">No saved chats yet.</div>';
    return;
  }
  chatSessions.forEach((session: any) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const date = new Date(session.updatedAt || session.startedAt || Date.now());
    item.innerHTML = `
        <div class="history-title">${this.escapeHtml(session.title || 'Session')}</div>
        <div class="history-meta">${date.toLocaleString()}</div>
      `;
    item.addEventListener('click', () => {
      this.switchView('chat');
      if (Array.isArray(session.transcript)) {
        this.recordScrollPosition();
        const normalized = normalizeConversationHistory(session.transcript || []);
        this.displayHistory = normalized;
        this.contextHistory = normalized;
        this.sessionId = session.id || `session-${Date.now()}`;
        this.firstUserMessage = session.title || '';
        this.renderConversationHistory();
        this.updateContextUsage();
      }
    });
    this.elements.historyItems.appendChild(item);
  });
};

(SidePanelUI.prototype as any).renderConversationHistory = function renderConversationHistory() {
  this.elements.chatMessages.innerHTML = '';
  this.toolCallViews.clear();
  this.lastChatTurn = null;
  this.resetActivityPanel();

  this.displayHistory.forEach((msg: any) => {
    if (msg.role === 'system' || msg.meta?.kind === 'summary') {
      this.displaySummaryMessage(msg);
      return;
    }
    if (msg.role === 'user') {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message user';
      messageDiv.innerHTML = `
          <div class="message-header">You</div>
          <div class="message-content">${this.escapeHtml(msg.content || '')}</div>
        `;
      this.elements.chatMessages.appendChild(messageDiv);
    } else if (msg.role === 'assistant') {
      const rawContent = typeof msg.content === 'string' ? msg.content : this.safeJsonStringify(msg.content);
      const parsed = extractThinking(rawContent, msg.thinking || null);
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message assistant';
      let html = `<div class="message-header">Assistant</div>`;
      const showThinking = this.elements.showThinking.value === 'true';
      if (parsed.thinking && showThinking) {
        const cleanedThinking = dedupeThinking(parsed.thinking);
        html += `
            <div class="thinking-block collapsed">
              <button class="thinking-header" type="button" aria-expanded="false">
                <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                Thinking
              </button>
              <div class="thinking-content">${this.escapeHtml(cleanedThinking)}</div>
            </div>
          `;
      }
      if (parsed.content && parsed.content.trim() !== '') {
        html += `<div class="message-content markdown-body">${this.renderMarkdown(parsed.content)}</div>`;
      }
      messageDiv.innerHTML = html;

      const thinkingHeader = messageDiv.querySelector('.thinking-header');
      if (thinkingHeader) {
        thinkingHeader.addEventListener('click', () => {
          const block = thinkingHeader.closest('.thinking-block');
          if (!block || block.classList.contains('thinking-hidden')) return;
          block.classList.toggle('collapsed');
          const expanded = !block.classList.contains('collapsed');
          thinkingHeader.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        });
      }

      this.elements.chatMessages.appendChild(messageDiv);
    }
  });
  this.restoreScrollPosition();
};
