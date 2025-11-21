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
      
      // Dynamic Prompts
      insightPromptsContainer: document.getElementById('insightPromptsContainer'),
      addInsightPromptBtn: document.getElementById('addInsightPromptBtn'),

      // Backup & Restore
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
      if (message.type === 'assistant_response') {
        this.displayAssistantMessage(message.content, message.thinking, message.isInsight);
      } else if (message.type === 'error') {
        this.updateStatus(message.message, 'error');
      }
      // Other message types can be handled here
    });

    this.port.onDisconnect.addListener(() => {
      this.port = null;
      this.updateStatus('Disconnected. Reconnecting...', 'error');
      setTimeout(() => this.connectToBackground(), 1000);
    });
  }

  setupEventListeners() {
    // Main UI
    this.elements.settingsBtn.addEventListener('click', () => this.toggleSettings());
    this.elements.agentTabBtn.addEventListener('click', () => this.switchTab('agent'));
    this.elements.deepInsightTabBtn.addEventListener('click', () => this.switchTab('deep-insight'));

    // Agent View
    this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
    this.elements.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Deep-Insight View is handled dynamically

    // Settings
    this.elements.provider.addEventListener('change', () => this.toggleCustomEndpoint());
    this.elements.temperature.addEventListener('input', () => {
      this.elements.temperatureValue.textContent = this.elements.temperature.value;
    });
    this.elements.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    this.elements.cancelSettingsBtn.addEventListener('click', () => this.toggleSettings());
    this.elements.exportSettingsBtn.addEventListener('click', () => this.exportSettings());
    this.elements.importSettingsInput.addEventListener('change', (e) => this.importSettings(e));
    
    // Dynamic Prompts
    this.elements.addInsightPromptBtn.addEventListener('click', () => this.addInsightPrompt());
    this.elements.insightPromptsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-prompt-btn')) {
        const index = e.target.dataset.index;
        this.deleteInsightPrompt(index);
      }
    });

    // Event delegation for dynamically created insight buttons
    this.elements.insightActions.addEventListener('click', (e) => {
      if (e.target.classList.contains('insight-btn')) {
        const promptText = e.target.dataset.prompt;
        if (promptText) {
          this.elements.insightOutput.innerHTML = 'Processing...';
          this.sendMessage(promptText, true);
        }
      }
    });
  }

  switchTab(tabName) {
    const isAgent = tabName === 'agent';
    this.elements.agentView.classList.toggle('hidden', !isAgent);
    this.elements.deepInsightView.classList.toggle('hidden', isAgent);
    this.elements.agentTabBtn.classList.toggle('active', isAgent);
    this.elements.deepInsightTabBtn.classList.toggle('active', !isAgent);
  }

  toggleSettings() {
    this.elements.settingsPanel.classList.toggle('hidden');
  }

  toggleCustomEndpoint() {
    const isCustom = this.elements.provider.value === 'custom';
    this.elements.customEndpointGroup.style.display = isCustom ? 'block' : 'none';
  }

  getDefaultInsightPrompts() {
    return [
      { label: 'Summarize Page', prompt: 'Summarize the key points of the current page.' },
      { label: 'Extract Headings', prompt: 'Extract all the main headings from this page.' },
      { label: 'Analyze Tone', prompt: 'Analyze the tone and sentiment of the text on this page.' },
      { label: 'Extract Links', prompt: 'Extract all links (URLs and their text) from the current page content.' }
    ];
  }

  async loadSettings() {
    const settings = await browser.storage.local.get(null); // Get all settings

    // Core settings
    this.elements.provider.value = settings.provider || 'openai';
    this.elements.apiKey.value = settings.apiKey || '';
    this.elements.model.value = settings.model || 'gpt-4o';
    this.elements.customEndpoint.value = settings.customEndpoint || '';
    this.elements.systemPrompt.value = settings.systemPrompt || `You are a browser automation assistant.`;
    this.elements.temperature.value = settings.temperature || 0.7;
    this.elements.temperatureValue.textContent = this.elements.temperature.value;
    this.elements.maxTokens.value = settings.maxTokens || 2048;
    this.elements.timeout.value = settings.timeout || 30000;
    this.elements.showThinking.value = settings.showThinking !== undefined ? String(settings.showThinking) : 'true';
    
    // Insight Prompts
    const insightPrompts = settings.insightPrompts || this.getDefaultInsightPrompts();
    this.renderInsightPrompts(insightPrompts);
    this.renderInsightButtons(insightPrompts);

    this.toggleCustomEndpoint();
  }

  async saveSettings() {
    const insightPrompts = this.getInsightPromptsFromUI();

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
      insightPrompts: insightPrompts,
    };

    await browser.storage.local.set(settings);
    this.renderInsightButtons(insightPrompts); // Re-render buttons in main UI
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
      a.click();
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
        await this.loadSettings(); // Reload all settings from storage
        this.updateStatus('Settings imported successfully', 'success');
        this.toggleSettings();
      } catch (error) {
        this.updateStatus(`Import failed: ${error.message}`, 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  }

  renderInsightPrompts(prompts) {
    this.elements.insightPromptsContainer.innerHTML = '';
    prompts.forEach((prompt, index) => {
      const div = document.createElement('div');
      div.className = 'prompt-item';
      div.innerHTML = `
        <input type="text" class="prompt-label" value="${this.escapeHtml(prompt.label)}" placeholder="Button Label">
        <textarea class="prompt-text" placeholder="Prompt for the AI">${this.escapeHtml(prompt.prompt)}</textarea>
        <button class="delete-prompt-btn" data-index="${index}">Delete</button>
      `;
      this.elements.insightPromptsContainer.appendChild(div);
    });
  }

  renderInsightButtons(prompts) {
    this.elements.insightActions.innerHTML = '';
    prompts.forEach(prompt => {
      const button = document.createElement('button');
      button.className = 'insight-btn';
      button.dataset.prompt = prompt.prompt;
      button.textContent = prompt.label;
      this.elements.insightActions.appendChild(button);
    });
  }

  addInsightPrompt(label = '', prompt = '') {
    const prompts = this.getInsightPromptsFromUI();
    prompts.push({ label, prompt });
    this.renderInsightPrompts(prompts);
  }

  deleteInsightPrompt(index) {
    const prompts = this.getInsightPromptsFromUI();
    prompts.splice(index, 1);
    this.renderInsightPrompts(prompts);
  }

  getInsightPromptsFromUI() {
    const prompts = [];
    this.elements.insightPromptsContainer.querySelectorAll('.prompt-item').forEach(item => {
      const label = item.querySelector('.prompt-label').value.trim();
      const prompt = item.querySelector('.prompt-text').value.trim();
      if (label && prompt) {
        prompts.push({ label, prompt });
      }
    });
    return prompts;
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
      this.updateStatus('Error: Not connected to background.', 'error');
      return;
    }

    try {
      this.port.postMessage({
        type: 'user_message',
        message: userMessage,
        conversationHistory: this.conversationHistory,
        isInsight: isInsight
      });
    } catch (error) {
      this.updateStatus('Error: ' + error.message, 'error');
    }
  }

  displayUserMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `<div class="message-header">You</div><div class="message-content">${this.escapeHtml(content)}</div>`;
    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  displayAssistantMessage(content, thinking = null, isInsight = false) {
    if (!content && !thinking) return;

    this.conversationHistory.push({ role: 'assistant', content });
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
      html += `<div class="thinking-block">... Thinking ...</div>`;
    }
    html += `<div class="message-content">${formattedContent}</div>`;
    messageDiv.innerHTML = html;
    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
    this.updateStatus('Ready', 'success');
  }

  updateStatus(text, type = 'default') {
    this.elements.statusText.textContent = text;
    this.elements.statusBar.className = 'status-bar ' + type;
  }

  scrollToBottom() {
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
  }

  escapeHtml(text) {
    return text
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }
}

// Initialize the UI
const sidePanelUI = new SidePanelUI();
