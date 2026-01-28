import { createMessage } from '../../ai/message-schema.js';
import type { Message } from '../../ai/message-schema.js';
import { dedupeThinking, extractThinking } from '../../ai/message-utils.js';
import type { UsagePayload } from './panel-types.js';
import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).sendMessage = async function sendMessage() {
  const userMessage = this.elements.userInput.value.trim();
  if (!userMessage) return;
  if (!this.isAccessReady()) {
    this.updateAccessUI();
    this.updateStatus('Sign in required', 'warning');
    return;
  }

  this.elements.userInput.value = '';
  this.elements.userInput.style.height = '';
  if (!this.firstUserMessage) {
    this.firstUserMessage = userMessage;
  }

  this.pendingToolCount = 0;
  this.isStreaming = false;
  this.activeToolName = null;
  this.clearRunIncompleteBanner();
  this.updateActivityState();

  const tabsContext = this.getSelectedTabsContext();
  const fullMessage = userMessage + tabsContext;

  this.displayUserMessage(userMessage);

  const displayEntry = createMessage({ role: 'user', content: userMessage });
  if (displayEntry) {
    this.displayHistory.push(displayEntry);
  }

  const contextEntry = createMessage({ role: 'user', content: fullMessage });
  if (contextEntry) {
    this.contextHistory.push(contextEntry);
  }
  this.updateContextUsage();

  this.updateStatus('Processing...', 'active');
  this.elements.composer?.classList.add('running');

  try {
    chrome.runtime.sendMessage({
      type: 'user_message',
      message: fullMessage,
      conversationHistory: this.contextHistory,
      selectedTabs: Array.from(this.selectedTabs.values()),
      sessionId: this.sessionId,
    });
    // Note: persistHistory is called after the assistant response completes
    // in displayAssistantMessage to ensure complete conversation is saved
  } catch (error: any) {
    this.stopThinkingTimer?.();
    this.updateStatus('Error: ' + error.message, 'error');
    this.elements.composer?.classList.remove('running');
    this.displayAssistantMessage('Sorry, an error occurred: ' + error.message);
  }
};

(SidePanelUI.prototype as any).displayUserMessage = function displayUserMessage(content: string) {
  const turn = document.createElement('div');
  turn.className = 'chat-turn';
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user';
  messageDiv.innerHTML = `
      <div class="message-header">You</div>
      <div class="message-content">${this.escapeHtml(content)}</div>
    `;
  turn.appendChild(messageDiv);
  this.elements.chatMessages.appendChild(turn);
  this.lastChatTurn = turn;
  this.scrollToBottom({ force: true });
  this.updateChatEmptyState();
};

(SidePanelUI.prototype as any).displaySummaryMessage = function displaySummaryMessage(
  messageOrEntry: Message | string,
) {
  const content = typeof messageOrEntry === 'string' ? messageOrEntry : String(messageOrEntry.content || '');
  const container = document.createElement('div');
  container.className = 'message summary';
  container.innerHTML = `
      <div class="summary-header">Context compacted</div>
      <div class="summary-body">${this.renderMarkdown(content)}</div>
    `;
  this.elements.chatMessages.appendChild(container);
  this.scrollToBottom();
  this.updateChatEmptyState();
};

(SidePanelUI.prototype as any).updateChatEmptyState = function updateChatEmptyState() {
  const emptyState = this.elements.chatEmptyState;
  if (!emptyState) return;
  const hasMessages = (this.displayHistory && this.displayHistory.length > 0) ||
    (this.elements.chatMessages && this.elements.chatMessages.children.length > 0);
  emptyState.classList.toggle('hidden', hasMessages);
};

(SidePanelUI.prototype as any).displayAssistantMessage = function displayAssistantMessage(
  content: string,
  thinking: string | null = null,
  usage: UsagePayload | null = null,
  model: string | null = null,
) {
  this.stopThinkingTimer?.();
  const streamResult = this.finishStreamingMessage();
  const streamedContainer = streamResult?.container;
  const streamEventsEl = streamedContainer?.querySelector('.stream-events') as HTMLElement | null;
  const hasStreamEvents = Boolean(streamEventsEl && streamEventsEl.children.length > 0);
  let normalizedUsage = this.normalizeUsage(usage);
  const modelLabel = model || this.getActiveModelLabel();
  const combinedThinking = [streamResult?.thinking, thinking].filter(Boolean).join('\n\n') || null;

  if ((!content || content.trim() === '') && !combinedThinking && !hasStreamEvents) {
    if (streamedContainer) {
      streamedContainer.remove();
    }
    this.updateStatus('Ready', 'success');
    this.elements.composer?.classList.remove('running');
    this.pendingToolCount = 0;
    this.updateActivityState();
    return;
  }

  const parsed = extractThinking(content, combinedThinking);
  content = parsed.content;
  thinking = parsed.thinking;
  this.updateThinkingPanel(thinking, false);

  if (!normalizedUsage) {
    normalizedUsage = this.estimateUsageFromContent(content);
  }
  if (normalizedUsage) {
    this.updateUsageStats(normalizedUsage);
  }
  const messageMeta = this.buildMessageMeta(normalizedUsage, modelLabel);

  const assistantEntry = createMessage({
    role: 'assistant',
    content,
    thinking,
  });
  if (assistantEntry) {
    this.displayHistory.push(assistantEntry);
  }

  if (streamedContainer) {
    if (!streamedContainer.querySelector('.message-header')) {
      const header = document.createElement('div');
      header.className = 'message-header';
      header.textContent = 'Assistant';
      streamedContainer.prepend(header);
    }

    if (messageMeta) {
      let metaEl = streamedContainer.querySelector('.message-meta') as HTMLElement | null;
      if (!metaEl) {
        metaEl = document.createElement('div');
        metaEl.className = 'message-meta';
        const header = streamedContainer.querySelector('.message-header');
        if (header) {
          header.insertAdjacentElement('afterend', metaEl);
        } else {
          streamedContainer.prepend(metaEl);
        }
      }
      metaEl.textContent = messageMeta;
    }

    if (content && content.trim() !== '' && streamEventsEl) {
      const hasTextEvent = streamEventsEl.querySelector('.stream-event-text');
      if (!hasTextEvent) {
        const textEvent = document.createElement('div');
        textEvent.className = 'stream-event stream-event-text';
        textEvent.innerHTML = this.renderMarkdown(content);
        streamEventsEl.appendChild(textEvent);
      }
    }

    this.scrollToBottom();
    this.updateStatus('Ready', 'success');
    this.elements.composer?.classList.remove('running');
    this.pendingToolCount = 0;
    this.updateActivityState();
    this.persistHistory();
    this.updateChatEmptyState();
    return;
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';

  let html = `<div class="message-header">Assistant</div>`;
  if (messageMeta) {
    html += `<div class="message-meta">${this.escapeHtml(messageMeta)}</div>`;
  }

  const showThinking = this.elements.showThinking.value === 'true';
  if (thinking && showThinking) {
    const cleanedThinking = dedupeThinking(thinking);
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

  if (content && content.trim() !== '') {
    const renderedContent = this.renderMarkdown(content);
    html += `<div class="message-content markdown-body">${renderedContent}</div>`;
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

  if (this.lastChatTurn) {
    this.lastChatTurn.appendChild(messageDiv);
  } else {
    this.elements.chatMessages.appendChild(messageDiv);
  }
  this.scrollToBottom();
  this.updateStatus('Ready', 'success');
  this.elements.composer?.classList.remove('running');
  this.pendingToolCount = 0;
  this.updateActivityState();
  this.persistHistory();
  this.updateChatEmptyState();
};
