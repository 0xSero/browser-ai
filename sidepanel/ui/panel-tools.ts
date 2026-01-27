import { dedupeThinking } from '../../ai/message-utils.js';
import { SidePanelUI } from './panel-ui.js';

// ============================================================================
// Tool Icons - Clean SVG icons instead of emoji
// ============================================================================

const toolIcons: Record<string, string> = {
  // Browser tools
  browser_navigate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 12l6-6m-6 6l6 6"/></svg>',
  browser_click: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/></svg>',
  browser_type: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 12h8M8 16h4"/></svg>',
  browser_screenshot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  browser_get_page_text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  browser_scroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  browser_go_back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a4 4 0 0 1 4 4v1"/></svg>',
  browser_go_forward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a4 4 0 0 0-4 4v1"/></svg>',
  browser_refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  browser_find_element: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
  browser_press_key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M12 8v8"/></svg>',
  browser_select_option: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  browser_get_element_text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>',
  browser_get_element_attribute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  browser_execute_script: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  browser_wait: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  browser_set_viewport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>',
  browser_clear_cookies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5l7 7"/><path d="M15.5 8.5l-7 7"/></svg>',
  browser_get_cookies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/></svg>',
  browser_set_cookie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>',
  browser_delete_cookie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8 12h8"/></svg>',
  
  // MCP (Model Context Protocol) tools
  mcp_read_resource: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  mcp_call_tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  mcp_list_resources: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  mcp_list_tools: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  
  // File system tools
  fs_read: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  fs_write: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  fs_list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  
  // Default
  default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m20.9 9.9h-6m-6 0H2.1m16.12 4.24l4.24 4.24M6.34 17.66l-4.24 4.24"/></svg>',
};

// ============================================================================
// Tool Display - Elegant inline visualization
// ============================================================================

(SidePanelUI.prototype as any).displayToolExecution = function displayToolExecution(
  toolName: string,
  args: any,
  result: any,
  toolCallId: string | null = null,
) {
  const entryId = toolCallId || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let entry = this.toolCallViews.get(entryId);

  // Detect MCP tools
  const isMcp = toolName.startsWith('mcp_') || args?._mcp || result?._mcp;
  const displayName = isMcp ? toolName.replace(/^mcp_/, '') : toolName;

  if (!entry) {
    entry = { 
      id: entryId,
      toolName: displayName, 
      fullToolName: toolName,
      args,
      isMcp,
      startTime: Date.now(),
      element: null,
      statusEl: null,
      durationEl: null,
    };
    this.toolCallViews.set(entryId, entry);

    // Create elegant inline tool display
    if (this.streamingState?.eventsEl) {
      const toolEl = this.createToolElement(entry);
      entry.element = toolEl;
      this.streamingState.eventsEl.appendChild(toolEl);
      this.streamingState.lastEventType = 'tool';
    }

    this.scrollToBottom();
  }

  if (result !== null && result !== undefined) {
    this.updateToolResult(entry, result);
    const isError = result && (result.error || result.success === false);
    if (isError) {
      this.showErrorBanner(`${displayName}: ${result.error || 'Tool execution failed'}`);
    }
  }
  this.updateActivityToggle();
};

(SidePanelUI.prototype as any).createToolElement = function createToolElement(entry: any) {
  const container = document.createElement('div');
  container.className = 'tool-pill running';
  container.dataset.toolId = entry.id;

  const icon = this.getToolIcon(entry.fullToolName, entry.isMcp);
  const argsPreview = this.getArgsPreview(entry.args);
  
  container.innerHTML = `
    <span class="tool-icon">${icon}</span>
    <span class="tool-name">${this.escapeHtml(entry.toolName)}</span>
    ${argsPreview ? `<span class="tool-preview">${this.escapeHtml(argsPreview)}</span>` : ''}
    <span class="tool-duration">...</span>
    ${entry.isMcp ? '<span class="tool-mcp-badge">MCP</span>' : ''}
  `;

  entry.statusEl = container;
  entry.durationEl = container.querySelector('.tool-duration');

  // Animate duration
  this.animateToolDuration(entry);

  return container;
};

(SidePanelUI.prototype as any).animateToolDuration = function animateToolDuration(entry: any) {
  if (!entry.durationEl || entry.endTime) return;
  
  const update = () => {
    if (!entry.durationEl || entry.endTime) return;
    const elapsed = Date.now() - entry.startTime;
    entry.durationEl.textContent = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;
    requestAnimationFrame(() => setTimeout(update, 100));
  };
  update();
};

(SidePanelUI.prototype as any).updateToolResult = function updateToolResult(entry: any, result: any) {
  if (!entry || !entry.element) return;
  
  entry.endTime = Date.now();
  const isError = result && (result.error || result.success === false);
  const duration = entry.endTime - entry.startTime;
  
  // Update visual state - subtle, no red/green
  entry.element.classList.remove('running');
  entry.element.classList.add('done');
  
  if (isError) {
    entry.element.style.opacity = '0.5';
    entry.element.style.borderColor = 'var(--error)';
  }
  
  // Update duration display
  if (entry.durationEl) {
    entry.durationEl.textContent = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
  }
  
  // Store result for potential expansion
  entry.result = result;
};

(SidePanelUI.prototype as any).getToolIcon = function getToolIcon(toolName: string, isMcp = false): string {
  // Check for exact match first
  if (toolIcons[toolName]) {
    return toolIcons[toolName];
  }
  
  // Check for MCP prefix
  if (isMcp || toolName.startsWith('mcp_')) {
    const mcpName = toolName.replace(/^mcp_/, '');
    if (toolIcons[`mcp_${mcpName}`]) {
      return toolIcons[`mcp_${mcpName}`];
    }
    // Try generic MCP icon
    return toolIcons.mcp_call_tool || toolIcons.default;
  }
  
  // Try partial matches for browser tools
  for (const [key, icon] of Object.entries(toolIcons)) {
    if (key === 'default') continue;
    const searchKey = key.replace(/^browser_/, '').replace(/^mcp_/, '').replace(/^fs_/, '');
    if (toolName.toLowerCase().includes(searchKey.toLowerCase())) {
      return icon;
    }
  }
  
  return toolIcons.default;
};

(SidePanelUI.prototype as any).getArgsPreview = function getArgsPreview(args: any): string {
  if (!args || typeof args !== 'object') return '';
  
  // Prioritize common arg keys
  const priorityKeys = ['url', 'path', 'selector', 'text', 'query', 'command', 'name', 'key', 'direction', 'type'];
  for (const key of priorityKeys) {
    if (args[key]) {
      const value = String(args[key]);
      if (key === 'url') return value.replace(/^https?:\/\//, '').substring(0, 35);
      if (key === 'path') return value.substring(0, 35);
      if (key === 'selector') return value.substring(0, 25);
      if (key === 'text' || key === 'query') return `"${value.substring(0, 20)}${value.length > 20 ? '...' : ''}"`;
      return value.substring(0, 25);
    }
  }
  
  // If no priority keys, show count of args
  const keys = Object.keys(args).filter(k => !k.startsWith('_'));
  if (keys.length === 1) {
    const val = String(args[keys[0]]);
    return val.substring(0, 25);
  }
  if (keys.length > 1) {
    return `${keys.length} params`;
  }
  
  return '';
};

// ============================================================================
// Tool Tree - Alternative inline display for multiple tools
// ============================================================================

(SidePanelUI.prototype as any).createToolTreeItem = function createToolTreeItem(
  entryId: string,
  toolName: string,
  args: any,
  isMcp = false,
) {
  const container = document.createElement('div');
  container.className = 'tool-tree-item';
  container.dataset.id = entryId;
  container.dataset.start = String(Date.now());

  const argsPreview = this.getArgsPreview(args);
  const icon = this.getToolIcon(toolName, isMcp);
  const displayName = isMcp ? toolName.replace(/^mcp_/, '') : toolName;

  container.innerHTML = `
    <span class="tool-tree-icon-wrap">${icon}</span>
    <div class="tool-tree-info">
      <span class="tool-tree-name">${this.escapeHtml(displayName)}</span>
      ${argsPreview ? `<span class="tool-tree-detail">${this.escapeHtml(argsPreview)}</span>` : ''}
    </div>
    <span class="tool-tree-time">running</span>
  `;

  return {
    container,
    statusEl: container.querySelector('.tool-tree-time'),
  };
};

(SidePanelUI.prototype as any).updateToolTreeItem = function updateToolTreeItem(entry: any, result: any) {
  if (!entry?.container) return;
  const isError = result && (result.error || result.success === false);
  
  const start = Number.parseInt(entry.container.dataset.start || '0', 10);
  const dur = start ? Date.now() - start : 0;
  const durText = dur < 1000 ? `${dur}ms` : `${(dur / 1000).toFixed(1)}s`;

  if (entry.statusEl) {
    entry.statusEl.textContent = isError ? `failed · ${durText}` : durText;
    entry.statusEl.style.color = isError ? 'var(--error)' : 'var(--muted)';
  }
  
  // Subtle border change on error, no green on success
  if (isError) {
    entry.container.style.borderColor = 'var(--error)';
    entry.container.style.opacity = '0.7';
  }
};

// ============================================================================
// Error Handling
// ============================================================================

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

  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 8000);
};

(SidePanelUI.prototype as any).clearRunIncompleteBanner = function clearRunIncompleteBanner() {
  document.querySelectorAll('.run-incomplete-banner').forEach((el) => el.remove());
};

(SidePanelUI.prototype as any).clearErrorBanner = function clearErrorBanner() {
  document.querySelectorAll('.error-banner').forEach((el) => el.remove());
};

// ============================================================================
// Legacy update helpers (for backward compatibility)
// ============================================================================

(SidePanelUI.prototype as any).updateToolMessage = function updateToolMessage(entry: any, result: any) {
  if (!entry) return;
  if (entry.element) {
    this.updateToolResult(entry, result);
  }
};

(SidePanelUI.prototype as any).updateToolLogEntry = function updateToolLogEntry(_entry: any, _result: any) {
  // Legacy method - tool log panel removed
};

// ============================================================================
// Activity State
// ============================================================================

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
  
  const usageLabel = this.buildUsageLabel?.(this.lastUsage);
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
  // Activity panel removed — no-op
};

(SidePanelUI.prototype as any).toggleActivityPanel = function toggleActivityPanel(_force?: boolean) {
  // Activity panel removed — no-op
};

(SidePanelUI.prototype as any).updateThinkingPanel = function updateThinkingPanel(
  thinking: string | null,
  _isStreaming = false,
) {
  // Track latest thinking for activity state, no DOM updates (panel removed)
  if (thinking) {
    this.latestThinking = dedupeThinking(thinking.trim());
  } else if (!_isStreaming) {
    this.latestThinking = null;
  }
};

(SidePanelUI.prototype as any).resetActivityPanel = function resetActivityPanel() {
  // Clear inline tool displays
  if (this.elements.chatMessages) {
    const trees = this.elements.chatMessages.querySelectorAll('.tool-tree, .tool-chain');
    trees.forEach((tree) => tree.remove());
  }
  this.latestThinking = null;
  this.activeToolName = null;
  this.toolCallViews.clear();
};
