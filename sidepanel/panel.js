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
      toolTimeline: document.getElementById('toolTimeline')
    };

    this.conversationHistory = [];
    this.currentConfig = 'default';
    this.configs = { default: {} };
    this.toolCallViews = new Map();
    this.timelineItems = new Map();
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

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'tool_execution') {
        if (!message.result) {
          this.addTimelineItem(message.id, message.tool, message.args);
        } else {
          this.updateTimelineItem(message.id, message.result);
        }
        this.displayToolExecution(message.tool, message.args, message.result, message.id);
      } else if (message.type === 'assistant_response') {
        this.displayAssistantMessage(message.content, message.thinking);
      } else if (message.type === 'error') {
        this.updateStatus(message.message, 'error');
      } else if (message.type === 'warning') {
        this.updateStatus(message.message, 'warning');
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
    this.elements.showThinking.value = settings.showThinking !== undefined ? settings.showThinking : 'true';
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
    return `You are a browser automation assistant. You can interact with web pages using the available tools.

Available actions:
- Navigate to URLs
- Click on elements
- Type text into inputs
- Scroll pages
- Take screenshots
- Manage tabs and windows
- Extract page content
- Fill forms

Execution protocol:
1. Immediately translate the user request into a short numbered task list before taking action. Keep tasks focused on observable work you can perform in the browser.
2. Act through the tasks in order, updating the plan as new information appears. If you scroll or change context, always re-read via getPageContent before marking a task complete.
3. Never finish until each task has an explicit outcome. If something cannot be completed, state why and what would be needed.

Response requirements:
- Clearly summarize the results for every task, then provide the final answer the user requested in your own words.
- Reference the specific evidence you gathered (e.g., which page section, headline, or element) when describing findings.
- Always confirm before performing destructive actions. Be precise and describe what you're doing.`;
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
      screenshotQuality: this.elements.screenshotQuality.value
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

    // Display user message
    this.displayUserMessage(userMessage);

    // Add to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    // Update status
    this.updateStatus('Processing...', 'active');

    // Send to background for processing
    try {
      chrome.runtime.sendMessage({
        type: 'user_message',
        message: userMessage,
        conversationHistory: this.conversationHistory
      });
    } catch (error) {
      this.updateStatus('Error: ' + error.message, 'error');
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
          <div class="thinking-header">🤔 Thinking...</div>
          <div class="thinking-content">${this.escapeHtml(cleanedThinking)}</div>
        </div>
      `;
    }

    // Only add content div if content is not empty
    if (content && content.trim() !== '') {
      html += `<div class="message-content">${this.escapeHtml(content)}</div>`;
    }

    messageDiv.innerHTML = html;
    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
    this.updateStatus('Ready', 'success');
  }

  displayToolExecution(toolName, args, result, toolCallId = null) {
    // Find or create tool call element
    let toolDiv = null;
    const lastMessage = this.elements.chatMessages.lastElementChild;

    if (result === null || result === undefined) {
      // First message - just show the tool being called
      toolDiv = document.createElement('div');
      toolDiv.className = 'tool-call';

      toolDiv.innerHTML = `
        <div class="tool-call-header">
          <svg class="tool-call-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
          <span>🔧 ${toolName}</span>
        </div>
        <div class="tool-call-body">
          <div class="tool-call-section">
            <div class="tool-call-label">Arguments</div>
            <div class="tool-call-args">${this.escapeHtml(JSON.stringify(args, null, 2))}</div>
          </div>
          <div class="tool-call-section">
            <div class="tool-call-label">Result</div>
            <div class="tool-call-result">⏳ Running...</div>
          </div>
        </div>
      `;

      // Make it collapsible (start expanded by default)
      const header = toolDiv.querySelector('.tool-call-header');
      const body = toolDiv.querySelector('.tool-call-body');
      body.style.display = 'block'; // Start expanded
      let isExpanded = true;

      // Add expand/collapse indicator
      const indicator = document.createElement('span');
      indicator.textContent = '▼';
      indicator.style.marginLeft = 'auto';
      indicator.style.transition = 'transform 0.2s ease';
      header.appendChild(indicator);

      header.addEventListener('click', () => {
        isExpanded = !isExpanded;
        body.style.display = isExpanded ? 'block' : 'none';
        indicator.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
      });

      if (lastMessage && lastMessage.classList.contains('assistant')) {
        lastMessage.appendChild(toolDiv);
      } else {
        this.elements.chatMessages.appendChild(toolDiv);
      }
      if (toolCallId) {
        this.toolCallViews.set(toolCallId, toolDiv);
      }
    } else {
      // Second message - update with result
      if (toolCallId && this.toolCallViews.has(toolCallId)) {
        toolDiv = this.toolCallViews.get(toolCallId);
      } else {
        // Fallback to last tool-call in chat
        const toolCallElements = this.elements.chatMessages.querySelectorAll('.tool-call');
        if (toolCallElements.length === 0) {
          console.warn('No tool-call element found to update with result');
          return;
        }
        toolDiv = toolCallElements[toolCallElements.length - 1];
      }
      let resultDiv = toolDiv.querySelector('.tool-call-result');
      if (!resultDiv) {
        // Create a result container defensively if missing
        resultDiv = document.createElement('div');
        resultDiv.className = 'tool-call-result';
        toolDiv.appendChild(resultDiv);
      }

      const isError = (result && (result.error || result.success === false));
      resultDiv.className = `tool-call-result ${isError ? 'error' : ''}`;

      // Special handling for results with dataUrl (screenshots)
      if (result && result.dataUrl && result.dataUrl.startsWith('data:image/')) {
        const metaData = { ...result };
        delete metaData.dataUrl; // Avoid rendering massive base64 in metadata block

        // Use a safe innerHTML with only our own generated content
        resultDiv.innerHTML = `
          <div style="margin-bottom: 12px;">
            <img src="${result.dataUrl}" alt="Screenshot" style="max-width: 100%; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer;" />
          </div>
          <div style="font-size: 10px; color: #888; opacity: 0.7;">
            Click image to open in new tab
          </div>
          <pre style="margin-top: 8px; font-size: 10px;">${this.escapeHtml(JSON.stringify(metaData, null, 2))}</pre>
        `;

        // Add click handler programmatically to avoid inline JS being blocked by CSP
        const img = resultDiv.querySelector('img');
        if (img) {
          img.addEventListener('click', () => {
            try {
              window.open(result.dataUrl, '_blank');
            } catch (e) {
              console.warn('Failed to open screenshot in new tab:', e);
            }
          });
        }
      } else {
        // Fallback to plain JSON rendering
        resultDiv.textContent = JSON.stringify(result, null, 2);
      }
    }

    this.scrollToBottom();
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
      <span class="tool-timeline-meta">Running…</span>
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
  }

  scrollToBottom() {
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }
}

// Initialize the UI
const sidePanelUI = new SidePanelUI();
