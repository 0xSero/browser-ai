// Side Panel UI Controller
class SidePanelUI {
  constructor() {
    this.elements = {
      settingsBtn: document.getElementById('settingsBtn'),
      settingsPanel: document.getElementById('settingsPanel'),
      chatInterface: document.getElementById('chatInterface'),
      provider: document.getElementById('provider'),
      apiKey: document.getElementById('apiKey'),
      model: document.getElementById('model'),
      customEndpoint: document.getElementById('customEndpoint'),
      customEndpointGroup: document.getElementById('customEndpointGroup'),
      systemPrompt: document.getElementById('systemPrompt'),
      temperature: document.getElementById('temperature'),
      temperatureValue: document.getElementById('temperatureValue'),
      maxTokens: document.getElementById('maxTokens'),
      timeout: document.getElementById('timeout'),
      sendScreenshotsAsImages: document.getElementById('sendScreenshotsAsImages'),
      screenshotQuality: document.getElementById('screenshotQuality'),
      showThinking: document.getElementById('showThinking'),
      streamResponses: document.getElementById('streamResponses'),
      autoScroll: document.getElementById('autoScroll'),
      confirmActions: document.getElementById('confirmActions'),
      saveHistory: document.getElementById('saveHistory'),
      activeConfig: document.getElementById('activeConfig'),
      newConfigBtn: document.getElementById('newConfigBtn'),
      deleteConfigBtn: document.getElementById('deleteConfigBtn'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),
      cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
      chatMessages: document.getElementById('chatMessages'),
      userInput: document.getElementById('userInput'),
      sendBtn: document.getElementById('sendBtn'),
      statusBar: document.getElementById('statusBar'),
      statusText: document.getElementById('statusText'),
      statusMeta: document.getElementById('statusMeta'),
      toolTimeline: document.getElementById('toolTimeline'),
      tabSelectorBtn: document.getElementById('tabSelectorBtn'),
      tabSelector: document.getElementById('tabSelector'),
      tabList: document.getElementById('tabList'),
      closeTabSelector: document.getElementById('closeTabSelector'),
      selectedTabsBar: document.getElementById('selectedTabsBar')
    };

    this.conversationHistory = [];
    this.currentConfig = 'default';
    this.configs = { default: {} };
    this.toolCallViews = new Map();
    this.timelineItems = new Map();
    this.selectedTabs = new Map();
    this.pendingToolCount = 0;
    this.isStreaming = false;
    this.streamingState = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadSettings();
    this.updateStatus('Ready', 'success');
  }

  setupEventListeners() {
    // Settings toggle
    this.elements.settingsBtn.addEventListener('click', () => {
      this.toggleSettings();
    });

    // Provider change
    this.elements.provider.addEventListener('change', () => {
      this.toggleCustomEndpoint();
    });

    // Temperature slider
    this.elements.temperature.addEventListener('input', () => {
      this.elements.temperatureValue.textContent = this.elements.temperature.value;
    });

    // Configuration management
    this.elements.newConfigBtn.addEventListener('click', () => this.createNewConfig());
    this.elements.deleteConfigBtn.addEventListener('click', () => this.deleteConfig());
    this.elements.activeConfig.addEventListener('change', () => this.switchConfig());

    // Save settings
    this.elements.saveSettingsBtn.addEventListener('click', () => {
      this.saveSettings();
    });

    // Cancel settings
    this.elements.cancelSettingsBtn.addEventListener('click', () => {
      this.toggleSettings();
    });

    // Send message
    this.elements.sendBtn.addEventListener('click', () => {
      this.sendMessage();
    });

    // Enter to send (Shift+Enter for newline)
    this.elements.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Tab selector
    this.elements.tabSelectorBtn.addEventListener('click', () => this.toggleTabSelector());
    this.elements.closeTabSelector.addEventListener('click', () => this.closeTabSelector());

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'tool_execution') {
        if (!message.result) {
          this.pendingToolCount += 1;
          this.updateActivityState();
          this.addTimelineItem(message.id, message.tool, message.args);
        } else {
          this.pendingToolCount = Math.max(0, this.pendingToolCount - 1);
          this.updateActivityState();
          this.updateTimelineItem(message.id, message.result);
        }
        this.displayToolExecution(message.tool, message.args, message.result, message.id);
      } else if (message.type === 'assistant_response') {
        this.finishStreamingMessage();
        this.displayAssistantMessage(message.content, message.thinking);
      } else if (message.type === 'error') {
        this.updateStatus(message.message, 'error');
      } else if (message.type === 'warning') {
        this.updateStatus(message.message, 'warning');
      } else if (message.type === 'assistant_stream') {
        this.handleAssistantStream(message);
      }
    });
  }

  toggleSettings() {
    this.elements.settingsPanel.classList.toggle('hidden');
  }

  toggleCustomEndpoint() {
    const isCustom = this.elements.provider.value === 'custom';
    this.elements.customEndpointGroup.style.display = isCustom ? 'block' : 'none';
  }

  async loadSettings() {
    const settings = await chrome.storage.local.get([
      'provider',
      'apiKey',
      'model',
      'customEndpoint',
      'systemPrompt',
      'temperature',
      'maxTokens',
      'timeout',
      'sendScreenshotsAsImages',
      'screenshotQuality',
      'showThinking',
      'streamResponses',
      'autoScroll',
      'confirmActions',
      'saveHistory',
      'activeConfig',
      'configs'
    ]);

    this.elements.provider.value = settings.provider || 'openai';
    this.elements.apiKey.value = settings.apiKey || '';
    this.elements.model.value = settings.model || 'gpt-4o';
    this.elements.customEndpoint.value = settings.customEndpoint || '';
    this.elements.systemPrompt.value = settings.systemPrompt || this.getDefaultSystemPrompt();
    this.elements.temperature.value = settings.temperature || 0.7;
    this.elements.temperatureValue.textContent = this.elements.temperature.value;
    this.elements.maxTokens.value = settings.maxTokens || 2048;
    this.elements.timeout.value = settings.timeout || 30000;
    this.elements.sendScreenshotsAsImages.value = settings.sendScreenshotsAsImages !== undefined ? settings.sendScreenshotsAsImages : 'true';
    this.elements.screenshotQuality.value = settings.screenshotQuality || 'high';
    this.elements.showThinking.value = settings.showThinking !== undefined ? String(settings.showThinking) : 'true';
    this.elements.streamResponses.value = settings.streamResponses !== undefined ? String(settings.streamResponses) : 'true';
    this.elements.autoScroll.value = settings.autoScroll !== undefined ? settings.autoScroll : 'true';
    this.elements.confirmActions.value = settings.confirmActions !== undefined ? settings.confirmActions : 'true';
    this.elements.saveHistory.value = settings.saveHistory !== undefined ? settings.saveHistory : 'true';

    this.currentConfig = settings.activeConfig || 'default';
    this.configs = settings.configs || { default: {} };

    this.refreshConfigDropdown();
    this.toggleCustomEndpoint();
  }

  async saveSettings() {
    const settings = {
      provider: this.elements.provider.value,
      apiKey: this.elements.apiKey.value,
      model: this.elements.model.value,
      customEndpoint: this.elements.customEndpoint.value,
      systemPrompt: this.elements.systemPrompt.value,
      temperature: parseFloat(this.elements.temperature.value),
      maxTokens: parseInt(this.elements.maxTokens.value),
      timeout: parseInt(this.elements.timeout.value),
      sendScreenshotsAsImages: this.elements.sendScreenshotsAsImages.value === 'true',
      screenshotQuality: this.elements.screenshotQuality.value,
      showThinking: this.elements.showThinking.value === 'true',
      streamResponses: this.elements.streamResponses.value === 'true',
      autoScroll: this.elements.autoScroll.value === 'true',
      confirmActions: this.elements.confirmActions.value === 'true',
      saveHistory: this.elements.saveHistory.value === 'true',
      activeConfig: this.currentConfig,
      configs: this.configs
    };

    await chrome.storage.local.set(settings);
    this.updateStatus('Settings saved successfully', 'success');
    this.toggleSettings();
  }

  getDefaultSystemPrompt() {
    return `You are a browser automation agent with tools to browse, click, type, scroll, capture screenshots, manage tabs, read content, and fill forms.

Workflow:
1. Turn every request into a short numbered list of observable tasks before taking action.
2. Work the list in order, updating it as you learn more. After any scroll, navigation, or tab change, call getPageContent again before marking a task complete.
3. Do not finish until each task has a concrete outcome or a clear explanation of what blocked it.

Responses:
- Summarize the result of each task, then answer the user plainly.
- Cite the specific evidence you gathered (section, headline, element, etc.).
- Confirm before destructive actions and describe exactly what you will do.`;
  }

  async createNewConfig() {
    const name = prompt('Enter configuration name:');
    if (!name) return;

    if (this.configs[name]) {
      alert('Configuration already exists!');
      return;
    }

    this.configs[name] = {
      provider: this.elements.provider.value,
      apiKey: this.elements.apiKey.value,
      model: this.elements.model.value,
      customEndpoint: this.elements.customEndpoint.value,
      systemPrompt: this.elements.systemPrompt.value,
      temperature: parseFloat(this.elements.temperature.value),
      maxTokens: parseInt(this.elements.maxTokens.value),
      timeout: parseInt(this.elements.timeout.value),
      sendScreenshotsAsImages: this.elements.sendScreenshotsAsImages.value === 'true',
      screenshotQuality: this.elements.screenshotQuality.value,
      streamResponses: this.elements.streamResponses.value === 'true'
    };

    this.currentConfig = name;
    this.refreshConfigDropdown();
    this.updateStatus(`Configuration "${name}" created`, 'success');
  }

  async deleteConfig() {
    if (this.currentConfig === 'default') {
      alert('Cannot delete default configuration');
      return;
    }

    if (confirm(`Delete configuration "${this.currentConfig}"?`)) {
      delete this.configs[this.currentConfig];
      this.currentConfig = 'default';
      this.refreshConfigDropdown();
      this.updateStatus('Configuration deleted', 'success');
    }
  }

  async switchConfig() {
    const newConfig = this.elements.activeConfig.value;
    if (!this.configs[newConfig]) {
      alert('Configuration not found');
      return;
    }

    const config = this.configs[newConfig];
    this.elements.provider.value = config.provider;
    this.elements.model.value = config.model;
    this.elements.customEndpoint.value = config.customEndpoint;
    this.elements.systemPrompt.value = config.systemPrompt;
    this.elements.temperature.value = config.temperature;
    this.elements.temperatureValue.textContent = config.temperature;
    this.elements.maxTokens.value = config.maxTokens;
    this.elements.timeout.value = config.timeout;
    this.elements.sendScreenshotsAsImages.value = config.sendScreenshotsAsImages ? 'true' : 'false';
    this.elements.screenshotQuality.value = config.screenshotQuality;
    this.elements.streamResponses.value = config.streamResponses !== false ? 'true' : 'false';

    this.currentConfig = newConfig;
    this.toggleCustomEndpoint();
    this.updateStatus(`Switched to configuration "${newConfig}"`, 'success');
  }

  refreshConfigDropdown() {
    this.elements.activeConfig.innerHTML = '';
    Object.keys(this.configs).forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === this.currentConfig) {
        option.selected = true;
      }
      this.elements.activeConfig.appendChild(option);
    });
  }

  async sendMessage() {
    const userMessage = this.elements.userInput.value.trim();
    if (!userMessage) return;

    // Clear input
    this.elements.userInput.value = '';

    this.pendingToolCount = 0;
    this.isStreaming = false;
    this.updateActivityState();

    // Get selected tabs context
    const tabsContext = this.getSelectedTabsContext();
    const fullMessage = userMessage + tabsContext;

    // Display user message (show original without context)
    this.displayUserMessage(userMessage);

    // Add to conversation history (include context)
    this.conversationHistory.push({
      role: 'user',
      content: fullMessage
    });

    // Update status and input area
    this.updateStatus('Processing...', 'active');
    document.querySelector('.input-area').classList.add('running');

    // Send to background for processing
    try {
      chrome.runtime.sendMessage({
        type: 'user_message',
        message: fullMessage,
        conversationHistory: this.conversationHistory,
        selectedTabs: Array.from(this.selectedTabs.values())
      });
    } catch (error) {
      this.updateStatus('Error: ' + error.message, 'error');
      document.querySelector('.input-area').classList.remove('running');
      this.displayAssistantMessage('Sorry, an error occurred: ' + error.message);
    }
  }

  displayUserMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
      <div class="message-header">You</div>
      <div class="message-content">${this.escapeHtml(content)}</div>
    `;
    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  deduplicateThinking(thinking) {
    if (!thinking) return thinking;

    // Split into lines and deduplicate consecutive identical lines
    const lines = thinking.split('\n');
    const deduplicated = [];
    let lastLine = null;
    let repeatCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === lastLine) {
        repeatCount++;
        // Show first occurrence and count if more than 3 repeats
        if (repeatCount === 3) {
          deduplicated.push(`... (repeated ${repeatCount + 1} times)`);
        } else if (repeatCount > 3) {
          // Update the repeat count
          deduplicated[deduplicated.length - 1] = `... (repeated ${repeatCount + 1} times)`;
        }
      } else {
        deduplicated.push(line);
        lastLine = trimmed;
        repeatCount = 0;
      }
    }

    return deduplicated.join('\n');
  }

  displayAssistantMessage(content, thinking = null) {
    // Don't display empty messages unless there's thinking content
    if ((!content || content.trim() === '') && !thinking) {
      return;
    }

    this.finishStreamingMessage();

    // Add to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: content
    });

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';

    let html = `<div class="message-header">Assistant</div>`;

    if (thinking && this.elements.showThinking.value === 'true') {
      const cleanedThinking = this.deduplicateThinking(thinking);
      html += `
        <div class="thinking-block">
          <div class="thinking-header">Thinking</div>
          <div class="thinking-content">${this.escapeHtml(cleanedThinking)}</div>
        </div>
      `;
    }

    // Only add content div if content is not empty
    if (content && content.trim() !== '') {
      const renderedContent = this.renderMarkdown(content);
      html += `<div class="message-content markdown-body">${renderedContent}</div>`;
    }

    messageDiv.innerHTML = html;
    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
    this.updateStatus('Ready', 'success');
    document.querySelector('.input-area').classList.remove('running');
    this.pendingToolCount = 0;
    this.updateActivityState();
  }

  renderMarkdown(text) {
    if (!text) return '';

    const escape = (value = '') => this.escapeHtmlBasic(value);
    const escapeAttr = (value = '') => this.escapeAttribute(value);

    let working = String(text).replace(/\r\n/g, '\n');
    const codeBlocks = [];
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    working = working.replace(codeBlockRegex, (_, lang = '', body = '') => {
      const placeholder = `@@CODE_BLOCK_${codeBlocks.length}@@`;
      const languageClass = lang ? ` class="language-${escapeAttr(lang.toLowerCase())}"` : '';
      codeBlocks.push(`<pre><code${languageClass}>${escape(body)}</code></pre>`);
      return placeholder;
    });

    const applyInline = (value = '') => {
      let html = escape(value);
      html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) =>
        `<img alt="${escape(alt)}" src="${escapeAttr(url)}">`
      );
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) =>
        `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      );
      html = html.replace(/`([^`]+)`/g, (_, code) => `<code>${escape(code)}</code>`);
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
      html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
      html = html.replace(/(?<!\*)\*(?!\s)(.+?)\*(?!\*)/g, '<em>$1</em>');
      html = html.replace(/(?<!_)_(?!\s)(.+?)_(?!_)/g, '<em>$1</em>');
      return html;
    };

    const lines = working.split('\n');
    const blocks = [];
    let paragraph = [];
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
      if (inUl) {
        blocks.push('</ul>');
        inUl = false;
      }
      if (inOl) {
        blocks.push('</ol>');
        inOl = false;
      }
    };

    const flushParagraph = () => {
      if (!paragraph.length) return;
      blocks.push(`<p>${applyInline(paragraph.join('\n'))}</p>`);
      paragraph = [];
    };

    for (const rawLine of lines) {
      const line = rawLine;
      const trimmed = line.trim();

      if (!trimmed) {
        flushParagraph();
        closeLists();
        continue;
      }

      const placeholderMatch = trimmed.match(/^@@CODE_BLOCK_(\d+)@@$/);
      if (placeholderMatch) {
        flushParagraph();
        closeLists();
        blocks.push(trimmed);
        continue;
      }

      if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
        flushParagraph();
        closeLists();
        blocks.push('<hr>');
        continue;
      }

      const headingMatch = line.match(/^\s*(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushParagraph();
        closeLists();
        const level = headingMatch[1].length;
        blocks.push(`<h${level}>${applyInline(headingMatch[2])}</h${level}>`);
        continue;
      }

      if (/^\s*>\s*/.test(line)) {
        flushParagraph();
        closeLists();
        blocks.push(`<blockquote>${applyInline(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        flushParagraph();
        if (inOl) {
          blocks.push('</ol>');
          inOl = false;
        }
        if (!inUl) {
          blocks.push('<ul>');
          inUl = true;
        }
        blocks.push(`<li>${applyInline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        flushParagraph();
        if (inUl) {
          blocks.push('</ul>');
          inUl = false;
        }
        if (!inOl) {
          blocks.push('<ol>');
          inOl = true;
        }
        blocks.push(`<li>${applyInline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
        continue;
      }

      paragraph.push(line);
    }

    flushParagraph();
    closeLists();

    let html = blocks.join('');
    codeBlocks.forEach((block, index) => {
      const placeholder = `@@CODE_BLOCK_${index}@@`;
      html = html.split(placeholder).join(block);
    });

    return html;
  }

  handleAssistantStream(event) {
    if (event.status === 'start') {
      this.isStreaming = true;
      this.startStreamingMessage();
      this.updateStatus('Model is thinking...', 'active');
    } else if (event.status === 'delta') {
      this.isStreaming = true;
      this.updateStreamingMessage(event.content || '');
    } else if (event.status === 'stop') {
      this.isStreaming = false;
      this.finishStreamingMessage();
    }
    this.updateActivityState();
  }

  startStreamingMessage() {
    if (this.streamingState) return;
    const container = document.createElement('div');
    container.className = 'message assistant streaming';
    container.innerHTML = `
      <div class="message-content streaming-content markdown-body">
        <div class="typing-indicator"><span></span><span></span><span></span></div>
        <div class="streaming-text markdown-body"></div>
      </div>
    `;
    this.elements.chatMessages.appendChild(container);
    this.streamingState = {
      container,
      textEl: container.querySelector('.streaming-text')
    };
    this.scrollToBottom();
  }

  updateStreamingMessage(content) {
    if (!this.streamingState) {
      this.startStreamingMessage();
    }
    if (this.streamingState?.textEl) {
      this.streamingState.textEl.innerHTML = this.renderMarkdown(content || '');
    }
    this.scrollToBottom();
  }

  finishStreamingMessage() {
    if (this.streamingState?.container) {
      this.streamingState.container.remove();
    }
    this.streamingState = null;
    this.isStreaming = false;
    this.updateActivityState();
  }

  displayToolExecution(toolName, args, result, toolCallId = null) {
    let toolDiv = null;

    if (result === null || result === undefined) {
      // Create a simple chip for the running tool
      toolDiv = document.createElement('span');
      toolDiv.className = 'tool-call running';
      toolDiv.dataset.toolId = toolCallId || `temp-${Date.now()}`;

      const argsPreview = this.getArgsPreview(args);
      toolDiv.innerHTML = `
        <svg class="tool-call-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
        <span>${toolName}</span>
        ${argsPreview ? `<span style="opacity:0.6">${argsPreview}</span>` : ''}
      `;

      // Find or create container for tool calls
      let container = this.elements.chatMessages.querySelector('.tool-calls-container:last-child');
      const lastElement = this.elements.chatMessages.lastElementChild;

      if (!container || (lastElement && !lastElement.classList.contains('tool-calls-container'))) {
        container = document.createElement('div');
        container.className = 'tool-calls-container';
        this.elements.chatMessages.appendChild(container);
      }

      container.appendChild(toolDiv);

      if (toolCallId) {
        this.toolCallViews.set(toolCallId, toolDiv);
      }
    } else {
      // Update existing tool chip with result
      if (toolCallId && this.toolCallViews.has(toolCallId)) {
        toolDiv = this.toolCallViews.get(toolCallId);
      } else {
        const toolChips = this.elements.chatMessages.querySelectorAll('.tool-call.running');
        toolDiv = toolChips[toolChips.length - 1];
      }

      if (toolDiv) {
        const isError = result && (result.error || result.success === false);
        toolDiv.classList.remove('running');
        toolDiv.classList.add(isError ? 'error' : 'success');
      }
    }

    this.scrollToBottom();
  }

  getArgsPreview(args) {
    if (!args) return '';
    if (args.url) return args.url.substring(0, 30) + (args.url.length > 30 ? '...' : '');
    if (args.text) return `"${args.text.substring(0, 20)}${args.text.length > 20 ? '...' : ''}"`;
    if (args.selector) return args.selector.substring(0, 25);
    if (args.key) return args.key;
    if (args.direction) return args.direction;
    if (args.type) return args.type;
    return '';
  }

  addTimelineItem(id, toolName, args) {
    if (!this.elements.toolTimeline) return;
    const row = document.createElement('div');
    row.className = 'tool-timeline-item';
    row.dataset.id = id || `temp-${Date.now()}`;
    row.dataset.start = String(Date.now());
    row.innerHTML = `
      <span class="tool-timeline-status running"></span>
      <span class="tool-timeline-name">${this.escapeHtml(toolName)}</span>
      <span class="tool-timeline-args" style="opacity:0.8;">${this.escapeHtml(JSON.stringify(args))}</span>
      <span class="tool-timeline-meta">Running...</span>
    `;
    this.elements.toolTimeline.appendChild(row);
    while (this.elements.toolTimeline.children.length > 30) {
      this.elements.toolTimeline.removeChild(this.elements.toolTimeline.firstChild);
    }
    if (id) this.timelineItems.set(id, row);
  }

  updateTimelineItem(id, result) {
    if (!id || !this.timelineItems.has(id)) return;
    const row = this.timelineItems.get(id);
    const statusEl = row.querySelector('.tool-timeline-status');
    const metaEl = row.querySelector('.tool-timeline-meta');
    const start = parseInt(row.dataset.start || '0', 10);
    const dur = start ? `${Math.max(1, Date.now() - start)}ms` : '';
    const isError = result && (result.error || result.success === false);
    statusEl.className = `tool-timeline-status ${isError ? 'error' : 'success'}`;
    metaEl.textContent = isError ? `Error · ${dur}` : `Done · ${dur}`;
  }

  updateStatus(text, type = 'default') {
    this.elements.statusText.textContent = text;
    this.elements.statusBar.className = 'status-bar ' + type;
    this.updateActivityState();
  }

  updateActivityState() {
    if (!this.elements.statusMeta) return;
    const labels = [];
    if (this.pendingToolCount > 0) {
      labels.push(`${this.pendingToolCount} action${this.pendingToolCount > 1 ? 's' : ''} running`);
    }
    if (this.isStreaming) {
      labels.push('Streaming response');
    }
    if (labels.length > 0) {
      this.elements.statusMeta.textContent = labels.join(' · ');
      this.elements.statusMeta.classList.remove('hidden');
    } else {
      this.elements.statusMeta.textContent = '';
      this.elements.statusMeta.classList.add('hidden');
    }
  }

  scrollToBottom() {
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    });
  }

  escapeHtmlBasic(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : text;
    return div.innerHTML;
  }

  escapeHtml(text) {
    return this.escapeHtmlBasic(text).replace(/\n/g, '<br>');
  }

  escapeAttribute(value) {
    return this.escapeHtmlBasic(value).replace(/"/g, '&quot;');
  }

  async toggleTabSelector() {
    const isHidden = this.elements.tabSelector.classList.contains('hidden');
    if (isHidden) {
      await this.loadTabs();
      this.elements.tabSelector.classList.remove('hidden');
    } else {
      this.closeTabSelector();
    }
  }

  closeTabSelector() {
    this.elements.tabSelector.classList.add('hidden');
  }

  async loadTabs() {
    const tabs = await chrome.tabs.query({});
    this.elements.tabList.innerHTML = '';

    tabs.forEach(tab => {
      const isSelected = this.selectedTabs.has(tab.id);
      const item = document.createElement('div');
      item.className = `tab-item${isSelected ? ' selected' : ''}`;
      item.innerHTML = `
        <div class="tab-item-checkbox"></div>
        <img class="tab-item-favicon" src="${tab.favIconUrl || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27%23666%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%274%27/%3E%3C/svg%3E'}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27%23666%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%274%27/%3E%3C/svg%3E'">
        <span class="tab-item-title">${this.escapeHtml(tab.title || 'Untitled')}</span>
      `;
      item.addEventListener('click', () => this.toggleTabSelection(tab, item));
      this.elements.tabList.appendChild(item);
    });
  }

  toggleTabSelection(tab, itemElement) {
    if (this.selectedTabs.has(tab.id)) {
      this.selectedTabs.delete(tab.id);
      itemElement.classList.remove('selected');
    } else {
      this.selectedTabs.set(tab.id, { id: tab.id, title: tab.title, url: tab.url, windowId: tab.windowId });
      itemElement.classList.add('selected');
    }
    this.updateSelectedTabsBar();
    this.updateTabSelectorButton();
  }

  updateSelectedTabsBar() {
    if (this.selectedTabs.size === 0) {
      this.elements.selectedTabsBar.classList.add('hidden');
      return;
    }

    this.elements.selectedTabsBar.classList.remove('hidden');
    this.elements.selectedTabsBar.innerHTML = '';

    this.selectedTabs.forEach((tab, tabId) => {
      const chip = document.createElement('div');
      chip.className = 'selected-tab-chip';
      chip.innerHTML = `
        <span>${this.escapeHtml(tab.title?.substring(0, 25) || 'Tab')}${tab.title?.length > 25 ? '...' : ''}</span>
        <button title="Remove">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
      chip.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedTabs.delete(tabId);
        this.updateSelectedTabsBar();
        this.updateTabSelectorButton();
        this.loadTabs();
      });
      this.elements.selectedTabsBar.appendChild(chip);
    });
  }

  updateTabSelectorButton() {
    if (this.selectedTabs.size > 0) {
      this.elements.tabSelectorBtn.classList.add('has-selection');
    } else {
      this.elements.tabSelectorBtn.classList.remove('has-selection');
    }
  }

  getSelectedTabsContext() {
    if (this.selectedTabs.size === 0) return '';

    let context = '\n\n[Context from selected tabs:]\n';
    this.selectedTabs.forEach(tab => {
      const tabTitle = tab.title || 'Untitled';
      context += `- Tab [${tab.id}] "${tabTitle}": ${tab.url}\n`;
    });
    return context;
  }
}

// Initialize the UI
const sidePanelUI = new SidePanelUI();
