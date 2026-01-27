import { dedupeThinking } from '../../ai/message-utils.js';
import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).displayToolExecution = function displayToolExecution(
  toolName: string,
  args: any,
  result: any,
  toolCallId: string | null = null,
) {
  const entryId = toolCallId || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let entry = this.toolCallViews.get(entryId);

  if (!entry) {
    entry = { inline: null, log: null };
    this.toolCallViews.set(entryId, entry);

    if (this.streamingState?.eventsEl) {
      if (this.currentPlan) {
        this.ensurePlanBlock();
      }
      const inlineEntry = this.createToolTreeItem(entryId, toolName, args);
      entry.inline = inlineEntry;
      this.streamingState.eventsEl.appendChild(inlineEntry.container);
      this.streamingState.lastEventType = 'tool';
    }

    if (this.elements.toolLog) {
      const logEntry = this.createToolTreeItem(entryId, toolName, args);
      entry.log = logEntry;
      this.elements.toolLog.appendChild(logEntry.container);
    }

    this.scrollToBottom();
  }

  if (result !== null && result !== undefined) {
    this.updateToolMessage(entry, result);
    const isError = result && (result.error || result.success === false);
    if (isError) {
      this.showErrorBanner(`${toolName}: ${result.error || 'Tool execution failed'}`);
    }
  }
  this.updateActivityToggle();
};

(SidePanelUI.prototype as any).updateToolMessage = function updateToolMessage(entry: any, result: any) {
  if (!entry) return;

  if (entry.inline || entry.log) {
    if (entry.inline) {
      this.updateToolTreeItem(entry.inline, result);
    }
    if (entry.log) {
      const isTreeItem = entry.log.container?.classList?.contains('tool-tree-item');
      if (isTreeItem) {
        this.updateToolTreeItem(entry.log, result);
      } else {
        this.updateToolLogEntry(entry.log, result);
      }
    }
    return;
  }

  this.updateToolLogEntry(entry, result);
};

(SidePanelUI.prototype as any).updateToolLogEntry = function updateToolLogEntry(entry: any, result: any) {
  if (!entry) return;
  const isError = result && (result.error || result.success === false);

  if (entry.details) {
    entry.details.classList.remove('running', 'success', 'error');
    entry.details.classList.add(isError ? 'error' : 'success');
    if (entry.statusEl) entry.statusEl.textContent = isError ? 'Error' : 'Done';

    if (entry.resultEl) {
      const resultText = this.truncateText(this.safeJsonStringify(result), 2000);
      entry.resultEl.textContent = resultText || (isError ? 'Tool failed' : 'Done');
    }

    if (entry.previewEl) {
      const preview = isError ? result?.error || 'Tool failed' : result?.message || result?.summary || '';
      if (preview) {
        entry.previewEl.textContent = this.truncateText(String(preview), 120);
      }
    }

    if (isError) {
      entry.details.open = true;
    }
    return;
  }

  if (entry.container) {
    entry.container.classList.remove('running', 'success', 'error');
    entry.container.classList.add(isError ? 'error' : 'success');
  }
  if (entry.statusEl) entry.statusEl.textContent = isError ? 'Error' : 'Done';

  if (entry.resultEl) {
    const resultText = this.truncateText(this.safeJsonStringify(result), 2000);
    entry.resultEl.textContent = resultText || (isError ? 'Tool failed' : 'Done');
  }

  if (entry.previewEl) {
    const preview = isError ? result?.error || 'Tool failed' : result?.message || result?.summary || '';
    if (preview) {
      entry.previewEl.textContent = this.truncateText(String(preview), 120);
    }
  }

  if (isError && entry.container) {
    entry.container.classList.add('expanded');
    if (entry.toggleBtn) {
      entry.toggleBtn.textContent = 'Hide';
    }
  }

  if (this.elements.toolLog) {
    this.scrollToolLogToBottom();
  }
};

(SidePanelUI.prototype as any).showErrorBanner = function showErrorBanner(message: string) {
  // Remove any existing error banners to prevent stacking
  document.querySelectorAll('.error-banner').forEach((el) => el.remove());

  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.innerHTML = `
      <svg class="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span class="error-text">${this.escapeHtml(message)}</span>
      <button class="error-dismiss" title="Dismiss">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

  const dismissButton = banner.querySelector('.error-dismiss');
  dismissButton?.addEventListener('click', () => banner.remove());

  // Append to body for fixed positioning (toast style)
  document.body.appendChild(banner);

  setTimeout(() => banner.remove(), 8000);
};

(SidePanelUI.prototype as any).clearRunIncompleteBanner = function clearRunIncompleteBanner() {
  // Remove all run-incomplete banners globally
  document.querySelectorAll('.run-incomplete-banner').forEach((el) => el.remove());
};

(SidePanelUI.prototype as any).clearErrorBanner = function clearErrorBanner() {
  // Remove all error banners globally
  document.querySelectorAll('.error-banner').forEach((el) => el.remove());
};

(SidePanelUI.prototype as any).getArgsPreview = function getArgsPreview(args: any) {
  if (!args) return '';
  if (args.url) return args.url.substring(0, 30) + (args.url.length > 30 ? '...' : '');
  if (args.text) return `"${args.text.substring(0, 20)}${args.text.length > 20 ? '...' : ''}"`;
  if (args.selector) return args.selector.substring(0, 25);
  if (args.key) return args.key;
  if (args.direction) return args.direction;
  if (args.type) return args.type;
  return '';
};

(SidePanelUI.prototype as any).createToolTreeItem = function createToolTreeItem(
  entryId: string,
  toolName: string,
  args: any,
) {
  const container = document.createElement('div');
  container.className = 'tool-tree-item running';
  container.dataset.id = entryId;
  container.dataset.start = String(Date.now());

  const argsPreview = this.getArgsPreview(args);
  const icon = this.getToolIcon(toolName);

  container.innerHTML = `
      <span class="tool-tree-status"></span>
      <div class="tool-tree-content">
        <div class="tool-tree-header">
          <div class="tool-tree-title">
            <span class="tool-tree-icon">${icon}</span>
            <span class="tool-tree-name">${this.escapeHtml(toolName || 'tool')}</span>
          </div>
          <span class="tool-tree-args">${this.escapeHtml(argsPreview || '')}</span>
        </div>
        <span class="tool-tree-meta">Running</span>
      </div>
    `;

  return {
    container,
    statusEl: container.querySelector('.tool-tree-meta'),
  };
};

(SidePanelUI.prototype as any).getToolIcon = function getToolIcon(toolName: string): string {
  const iconMap: Record<string, string> = {
    browser_navigate: '→',
    browser_click: '👆',
    browser_type: '⌨️',
    browser_screenshot: '📷',
    browser_get_page_text: '📄',
    browser_scroll: '↕️',
    browser_go_back: '←',
    browser_go_forward: '→',
    browser_refresh: '↻',
    browser_find_element: '🔍',
    browser_press_key: '🔘',
    browser_select_option: '☑️',
    browser_get_element_text: '📝',
    browser_get_element_attribute: '🏷️',
    browser_execute_script: '⚡',
    browser_wait: '⏱️',
    browser_set_viewport: '📐',
    browser_clear_cookies: '🍪',
    browser_get_cookies: '🍪',
    browser_set_cookie: '🍪',
    browser_delete_cookie: '🗑️',
  };
  
  // Find matching icon or return default
  for (const [key, icon] of Object.entries(iconMap)) {
    if (toolName.toLowerCase().includes(key.toLowerCase().replace('browser_', ''))) {
      return icon;
    }
  }
  
  return '⚙️';
};

(SidePanelUI.prototype as any).updateToolTreeItem = function updateToolTreeItem(entry: any, result: any) {
  if (!entry?.container) return;
  const isError = result && (result.error || result.success === false);
  entry.container.classList.remove('running', 'success', 'error');
  entry.container.classList.add(isError ? 'error' : 'success');

  const start = Number.parseInt(entry.container.dataset.start || '0', 10);
  const dur = start ? Date.now() - start : 0;

  if (entry.statusEl) {
    if (isError) {
      entry.statusEl.textContent = 'Error';
    } else {
      entry.statusEl.textContent = dur > 0 ? `${dur}ms` : 'Done';
    }
  }
};

(SidePanelUI.prototype as any).updateActivityState = function updateActivityState() {
  if (!this.elements.statusMeta) return;
  const labels: string[] = [];
  if (this.pendingToolCount > 0) {
    labels.push(`${this.pendingToolCount} action${this.pendingToolCount > 1 ? 's' : ''} running`);
  }
  if (this.isStreaming) {
    labels.push('Streaming response');
  }
  if (this.contextUsage && this.contextUsage.maxContextTokens) {
    const used = Math.max(0, this.contextUsage.approxTokens || 0);
    const max = Math.max(1, this.contextUsage.maxContextTokens || 0);
    const usedLabel = used >= 10000 ? `${(used / 1000).toFixed(1)}k` : `${used}`;
    const maxLabel = max >= 10000 ? `${(max / 1000).toFixed(0)}k` : `${max}`;
    labels.push(`Context ~ ${usedLabel} / ${maxLabel}`);
  }
  const usageLabel = this.buildUsageLabel(this.lastUsage);
  if (usageLabel) {
    labels.push(usageLabel);
  }
  if (labels.length > 0) {
    this.elements.statusMeta.textContent = labels.join(' · ');
    this.elements.statusMeta.classList.remove('hidden');
  } else {
    this.elements.statusMeta.textContent = '';
    this.elements.statusMeta.classList.add('hidden');
  }
  this.updateActivityToggle();
};

(SidePanelUI.prototype as any).updateActivityToggle = function updateActivityToggle() {
  const toggle = this.elements.activityToggleBtn;
  if (!toggle) return;
  const toolCount = this.toolCallViews.size;
  const hasThinking = Boolean(this.latestThinking);
  const segments: string[] = [];
  if (toolCount > 0) {
    segments.push(`${toolCount} tool${toolCount === 1 ? '' : 's'}`);
  }
  if (hasThinking) {
    segments.push('thinking');
  }
  if (this.activeToolName) {
    segments.push(`${this.activeToolName}…`);
  }
  toggle.textContent = segments.length ? `Activity · ${segments.join(' · ')}` : 'Activity';
  const hasActiveWork = this.pendingToolCount > 0 || this.isStreaming;
  toggle.classList.toggle('active', hasActiveWork);
};

(SidePanelUI.prototype as any).toggleActivityPanel = function toggleActivityPanel(force?: boolean) {
  const shouldOpen = typeof force === 'boolean' ? force : !this.activityPanelOpen;
  this.activityPanelOpen = shouldOpen;
  if (this.elements.activityPanel) {
    this.elements.activityPanel.classList.toggle('open', shouldOpen);
    this.elements.activityPanel.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
  }
  this.elements.activityToggleBtn?.classList.toggle('open', shouldOpen);
  this.elements.chatInterface?.classList.toggle('activity-open', shouldOpen);
  if (shouldOpen) {
    this.scrollToolLogToBottom();
  }
};

(SidePanelUI.prototype as any).updateThinkingPanel = function updateThinkingPanel(
  thinking: string | null,
  isStreaming = false,
) {
  const panel = this.elements.thinkingPanel;
  if (!panel) return;
  const content = thinking ? thinking.trim() : '';
  if (content) {
    const cleaned = dedupeThinking(content);
    this.latestThinking = cleaned;
    panel.textContent = cleaned;
    panel.classList.remove('empty');
  } else {
    if (!isStreaming) {
      this.latestThinking = null;
    }
    panel.textContent = isStreaming ? 'Thinking…' : 'No reasoning captured yet.';
    panel.classList.add('empty');
  }
  panel.classList.toggle('streaming', isStreaming);
};

(SidePanelUI.prototype as any).resetActivityPanel = function resetActivityPanel() {
  if (this.elements.toolLog) {
    this.elements.toolLog.innerHTML = '';
  }
  if (this.elements.chatMessages) {
    const tree = this.elements.chatMessages.querySelector('.tool-tree');
    if (tree) tree.remove();
  }
  this.latestThinking = null;
  this.activeToolName = null;
  this.updateThinkingPanel(null, false);
  this.updateActivityToggle();
};

(SidePanelUI.prototype as any).scrollToolLogToBottom = function scrollToolLogToBottom() {
  if (!this.elements.toolLog) return;
  this.elements.toolLog.scrollTop = this.elements.toolLog.scrollHeight;
};
