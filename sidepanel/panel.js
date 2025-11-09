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
      autoScroll: document.getElementById('autoScroll'),
      confirmActions: document.getElementById('confirmActions'),
      saveHistory: document.getElementById('saveHistory'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),
      cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
      chatMessages: document.getElementById('chatMessages'),
      userInput: document.getElementById('userInput'),
      sendBtn: document.getElementById('sendBtn'),
      statusBar: document.getElementById('statusBar'),
      statusText: document.getElementById('statusText')
    };

    this.conversationHistory = [];
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
        this.displayToolExecution(message.tool, message.args, message.result);
      } else if (message.type === 'assistant_response') {
        this.displayAssistantMessage(message.content);
      } else if (message.type === 'error') {
        this.updateStatus(message.message, 'error');
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
      'autoScroll',
      'confirmActions',
      'saveHistory'
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
    this.elements.autoScroll.value = settings.autoScroll !== undefined ? settings.autoScroll : 'true';
    this.elements.confirmActions.value = settings.confirmActions !== undefined ? settings.confirmActions : 'true';
    this.elements.saveHistory.value = settings.saveHistory !== undefined ? settings.saveHistory : 'true';

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
      autoScroll: this.elements.autoScroll.value === 'true',
      confirmActions: this.elements.confirmActions.value === 'true',
      saveHistory: this.elements.saveHistory.value === 'true'
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

Always confirm before performing destructive actions. Be precise and describe what you're doing.`;
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

  displayAssistantMessage(content) {
    // Add to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: content
    });

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
      <div class="message-header">Assistant</div>
      <div class="message-content">${this.escapeHtml(content)}</div>
    `;
    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
    this.updateStatus('Ready', 'success');
  }

  displayToolExecution(toolName, args, result) {
    const toolDiv = document.createElement('div');
    toolDiv.className = 'tool-call';
    toolDiv.innerHTML = `
      <div class="tool-call-name">🔧 ${toolName}</div>
      <div class="tool-call-args">${JSON.stringify(args, null, 2)}</div>
    `;

    const lastMessage = this.elements.chatMessages.lastElementChild;
    if (lastMessage && lastMessage.classList.contains('assistant')) {
      lastMessage.appendChild(toolDiv);
    } else {
      this.elements.chatMessages.appendChild(toolDiv);
    }

    this.scrollToBottom();
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
