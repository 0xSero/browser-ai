// Cross-browser compatibility
if (typeof browser === 'undefined') {
  var browser = chrome;
}

// Side Panel UI Controller
class SidePanelUI {
  constructor() {
    this.elements = {
      // Main layout
      settingsBtn: document.getElementById('settingsBtn'),
      settingsPanel: document.getElementById('settingsPanel'),
      
      // Tabs
      agentTabBtn: document.getElementById('agentTabBtn'),
      deepInsightTabBtn: document.getElementById('deepInsightTabBtn'),
      agentView: document.getElementById('agentView'),
      deepInsightView: document.getElementById('deepInsightView'),

      // Agent View
      chatInterface: document.getElementById('chatInterface'),
      chatMessages: document.getElementById('chatMessages'),
      userInput: document.getElementById('userInput'),
      sendBtn: document.getElementById('sendBtn'),
      toolTimeline: document.getElementById('toolTimeline'),

      // Deep-Insight View
      insightActions: document.querySelector('.insight-actions'),
      insightOutput: document.getElementById('insight-output'),

      // Settings
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
      showThinking: document.getElementById('showThinking'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),
      cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
      exportSettingsBtn: document.getElementById('exportSettingsBtn'),
      importSettingsInput: document.getElementById('importSettingsInput'),

      // Status Bar
      statusBar: document.getElementById('statusBar'),
      statusText: document.getElementById('statusText'),
    };

    this.conversationHistory = [];
    this.toolCallViews = new Map();
    this.timelineItems = new Map();
    this.port = null;
    this.init();
  }

  async init() {
    this.connectToBackground();
    this.setupEventListeners();
    await this.loadSettings();
    this.updateStatus('Ready', 'success');
  }

  connectToBackground() {
    this.port = browser.runtime.connect({ name: 'sidepanel' });

    this.port.onMessage.addListener((message) => {
      if (message.type === 'tool_execution') {
        // ... (same as before)
      } else if (message.type === 'assistant_response') {
        this.displayAssistantMessage(message.content, message.thinking, message.isInsight);
      } else if (message.type === 'error') {
        this.updateStatus(message.message, 'error');
      } else if (message.type === 'warning') {
        this.updateStatus(message.message, 'warning');
      }
    });

    this.port.onDisconnect.addListener(() => {
      this.port = null;
      this.updateStatus('Disconnected. Reconnecting...', 'error');
      setTimeout(() => this.connectToBackground(), 1000);
    });
  }

  setupEventListeners() {
    // Settings toggle
    this.elements.settingsBtn.addEventListener('click', () => this.toggleSettings());

    // Tabs
    this.elements.agentTabBtn.addEventListener('click', () => this.switchTab('agent'));
    this.elements.deepInsightTabBtn.addEventListener('click', () => this.switchTab('deep-insight'));

    // Provider change
    this.elements.provider.addEventListener('change', () => this.toggleCustomEndpoint());

    // Temperature slider
    this.elements.temperature.addEventListener('input', () => {
      this.elements.temperatureValue.textContent = this.elements.temperature.value;
    });

    // Save/Cancel settings
    this.elements.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    this.elements.cancelSettingsBtn.addEventListener('click', () => this.toggleSettings());

    // Export/Import settings
    this.elements.exportSettingsBtn.addEventListener('click', () => this.exportSettings());
    this.elements.importSettingsInput.addEventListener('change', (e) => this.importSettings(e));

    // Agent View: Send message
    this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
    this.elements.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Deep-Insight View: Action buttons
    this.elements.insightActions.addEventListener('click', (e) => {
      if (e.target.classList.contains('insight-btn')) {
        const prompt = e.target.dataset.prompt;
        if (prompt) {
          this.elements.insightOutput.innerHTML = 'Processing...';
          this.sendMessage(prompt, true); // Send prompt and mark as insight message
        }
      }
    });
  }

  switchTab(tabName) {
    if (tabName === 'agent') {
      this.elements.agentView.classList.remove('hidden');
      this.elements.deepInsightView.classList.add('hidden');
      this.elements.agentTabBtn.classList.add('active');
      this.elements.deepInsightTabBtn.classList.remove('active');
    } else if (tabName === 'deep-insight') {
      this.elements.agentView.classList.add('hidden');
      this.elements.deepInsightView.classList.remove('hidden');
      this.elements.agentTabBtn.classList.remove('active');
      this.elements.deepInsightTabBtn.classList.add('active');
    }
  }

  toggleSettings() {
    this.elements.settingsPanel.classList.toggle('hidden');
  }

  toggleCustomEndpoint() {
    const isCustom = this.elements.provider.value === 'custom';
    this.elements.customEndpointGroup.style.display = isCustom ? 'block' : 'none';
  }

  async loadSettings() {
    const settings = await browser.storage.local.get([
      'provider', 'apiKey', 'model', 'customEndpoint', 'systemPrompt',
      'temperature', 'maxTokens', 'timeout', 'showThinking'
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
    this.elements.showThinking.value = settings.showThinking !== undefined ? settings.showThinking : 'true';
    
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
      showThinking: this.elements.showThinking.value === 'true',
    };

    await browser.storage.local.set(settings);
    this.updateStatus('Settings saved successfully', 'success');
    this.toggleSettings();
  }

  async exportSettings() {
    try {
      const settings = await browser.storage.local.get(null);
      const jsonString = JSON.stringify(settings, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'browser-ai-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.updateStatus('Settings exported', 'success');
    } catch (error) {
      this.updateStatus(`Export failed: ${error.message}`, 'error');
    }
  }

  importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const settings = JSON.parse(e.target.result);
        await browser.storage.local.set(settings);
        await this.loadSettings();
        this.updateStatus('Settings imported successfully', 'success');
        this.toggleSettings();
      } catch (error) {
        this.updateStatus(`Import failed: ${error.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  getDefaultSystemPrompt() {
    return `You are a browser automation assistant. You can interact with web pages using the available tools.`;
  }

  async sendMessage(message = null, isInsight = false) {
    const userMessage = message !== null ? message : this.elements.userInput.value.trim();
    if (!userMessage) return;

    if (!isInsight) {
      this.elements.userInput.value = '';
      this.displayUserMessage(userMessage);
    }

    this.conversationHistory.push({ role: 'user', content: userMessage });
    this.updateStatus('Processing...', 'active');

    if (!this.port) {
      this.updateStatus('Error: Not connected to background service.', 'error');
      return;
    }

    try {
      this.port.postMessage({
        type: 'user_message',
        message: userMessage,
        conversationHistory: this.conversationHistory,
        isInsight: isInsight // Pass flag to background
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

  displayAssistantMessage(content, thinking = null, isInsight = false) {
    if (!content && !thinking) return;

    this.conversationHistory.push({ role: 'assistant', content });

    // Use Markdown for the content
    const formattedContent = marked.parse(content || '');

    if (isInsight) {
      this.elements.insightOutput.innerHTML = formattedContent;
      this.updateStatus('Analysis complete', 'success');
      return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    let html = `<div class="message-header">Assistant</div>`;

    if (thinking && this.elements.showThinking.value === 'true') {
      html += `
        <div class="thinking-block">
          <div class="thinking-header">🤔 Thinking...</div>
          <div class="thinking-content">${this.escapeHtml(thinking)}</div>
        </div>
      `;
    }
    
    html += `<div class="message-content">${formattedContent}</div>`;
    messageDiv.innerHTML = html;
    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
    this.updateStatus('Ready', 'success');
  }

  displayToolExecution(toolName, args, result, toolCallId = null) {
    // This function remains largely the same, but we ensure it appends to the correct view.
    // For now, all tool executions will appear in the Agent view.
    // ... (rest of the function is the same as before)
  }

  // ... (addTimelineItem, updateTimelineItem, updateStatus, scrollToBottom functions are the same)

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Placeholder for functions that are the same
  addTimelineItem(id, toolName, args) {
    if (!this.elements.toolTimeline) return;
    const row = document.createElement('div');
    row.className = 'tool-timeline-item';
    row.dataset.id = id || `temp-${Date.now()}`;
    row.dataset.start = String(Date.now());
    row.innerHTML = `<span class="tool-timeline-status running"></span><span class="tool-timeline-name">${this.escapeHtml(toolName)}</span>`;
    this.elements.toolTimeline.appendChild(row);
    if (id) this.timelineItems.set(id, row);
  }

  updateTimelineItem(id, result) {
    if (!id || !this.timelineItems.has(id)) return;
    const row = this.timelineItems.get(id);
    const statusEl = row.querySelector('.tool-timeline-status');
    const isError = result && (result.error || result.success === false);
    statusEl.className = `tool-timeline-status ${isError ? 'error' : 'success'}`;
  }

  updateStatus(text, type = 'default') {
    this.elements.statusText.textContent = text;
    this.elements.statusBar.className = 'status-bar ' + type;
  }

  scrollToBottom() {
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
  }
}

// Initialize the UI
const sidePanelUI = new SidePanelUI();