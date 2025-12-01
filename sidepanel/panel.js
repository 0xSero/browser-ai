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
      contextLimit: document.getElementById('contextLimit'),
      timeout: document.getElementById('timeout'),
      enableScreenshots: document.getElementById('enableScreenshots'),
      sendScreenshotsAsImages: document.getElementById('sendScreenshotsAsImages'),
      screenshotQuality: document.getElementById('screenshotQuality'),
      visionBridge: document.getElementById('visionBridge'),
      visionProfile: document.getElementById('visionProfile'),
      orchestratorToggle: document.getElementById('orchestratorToggle'),
      orchestratorProfile: document.getElementById('orchestratorProfile'),
      showThinking: document.getElementById('showThinking'),
      streamResponses: document.getElementById('streamResponses'),
      autoScroll: document.getElementById('autoScroll'),
      confirmActions: document.getElementById('confirmActions'),
      saveHistory: document.getElementById('saveHistory'),
      activeConfig: document.getElementById('activeConfig'),
      newConfigBtn: document.getElementById('newConfigBtn'),
      deleteConfigBtn: document.getElementById('deleteConfigBtn'),
      agentGrid: document.getElementById('agentGrid'),
      refreshProfilesBtn: document.getElementById('refreshProfilesBtn'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),
      cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
      chatMessages: document.getElementById('chatMessages'),
      userInput: document.getElementById('userInput'),
      fileBtn: document.getElementById('fileBtn'),
      fileInput: document.getElementById('fileInput'),
      sendBtn: document.getElementById('sendBtn'),
      statusBar: document.getElementById('statusBar'),
      statusText: document.getElementById('statusText'),
      statusMeta: document.getElementById('statusMeta'),
      toolTimeline: document.getElementById('toolTimeline'),
      tabSelectorBtn: document.getElementById('tabSelectorBtn'),
      tabSelector: document.getElementById('tabSelector'),
      tabList: document.getElementById('tabList'),
      closeTabSelector: document.getElementById('closeTabSelector'),
      selectedTabsBar: document.getElementById('selectedTabsBar'),
      viewChatBtn: document.getElementById('viewChatBtn'),
      viewHistoryBtn: document.getElementById('viewHistoryBtn'),
      historyPanel: document.getElementById('historyPanel'),
      historyItems: document.getElementById('historyItems'),
      startNewSessionBtn: document.getElementById('startNewSessionBtn'),
      agentGrid: document.getElementById('agentGrid'),
      refreshProfilesBtn: document.getElementById('refreshProfilesBtn'),
      settingsTabGeneralBtn: document.getElementById('settingsTabGeneralBtn'),
      settingsTabProfilesBtn: document.getElementById('settingsTabProfilesBtn'),
      settingsTabGeneral: document.getElementById('settingsTabGeneral'),
      settingsTabProfiles: document.getElementById('settingsTabProfiles'),
      newProfileNameInput: document.getElementById('newProfileNameInput'),
      createProfileBtn: document.getElementById('createProfileBtn'),
      openGeneralBtn: document.getElementById('openGeneralBtn'),
      openProfilesBtn: document.getElementById('openProfilesBtn'),
      generalProfileSelect: document.getElementById('generalProfileSelect'),
      profileEditorTitle: document.getElementById('profileEditorTitle'),
      profileEditorName: document.getElementById('profileEditorName'),
      profileEditorProvider: document.getElementById('profileEditorProvider'),
      profileEditorApiKey: document.getElementById('profileEditorApiKey'),
      profileEditorModel: document.getElementById('profileEditorModel'),
      profileEditorEndpoint: document.getElementById('profileEditorEndpoint'),
      profileEditorEndpointGroup: document.getElementById('profileEditorEndpointGroup'),
      profileEditorTemperature: document.getElementById('profileEditorTemperature'),
      profileEditorTemperatureValue: document.getElementById('profileEditorTemperatureValue'),
      profileEditorMaxTokens: document.getElementById('profileEditorMaxTokens'),
      profileEditorTimeout: document.getElementById('profileEditorTimeout'),
      profileEditorEnableScreenshots: document.getElementById('profileEditorEnableScreenshots'),
      profileEditorSendScreenshots: document.getElementById('profileEditorSendScreenshots'),
      profileEditorScreenshotQuality: document.getElementById('profileEditorScreenshotQuality'),
      profileEditorPrompt: document.getElementById('profileEditorPrompt'),
      saveProfileBtn: document.getElementById('saveProfileBtn')
    };

    this.conversationHistory = [];
    this.sessionId = `session-${Date.now()}`;
    this.sessionStartedAt = Date.now();
    this.firstUserMessage = '';
    this.currentConfig = 'default';
    this.configs = { default: {} };
    this.toolCallViews = new Map();
    this.timelineItems = new Map();
    this.selectedTabs = new Map();
    this.pendingToolCount = 0;
    this.isStreaming = false;
    this.streamingState = null;
    this.contextUsage = { approxTokens: 0, maxContextTokens: 196000, percent: 0 };
    this.sessionTokensUsed = 0; // Track highest context seen in session
    this.auxAgentProfiles = [];
    this.currentView = 'chat';
    this.currentSettingsTab = 'general';
    this.profileEditorTarget = 'default';
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadSettings();
    await this.loadHistoryList();
    this.updateStatus('Ready', 'success');
  }

  setupEventListeners() {
    // Settings toggle
    this.elements.settingsBtn.addEventListener('click', () => {
      this.toggleSettings();
    });

    this.elements.startNewSessionBtn?.addEventListener('click', () => this.startNewSession());

    // Provider change
    this.elements.provider.addEventListener('change', () => {
      this.toggleCustomEndpoint();
      this.updateScreenshotToggleState();
    });

    // Temperature slider
    this.elements.temperature.addEventListener('input', () => {
      this.elements.temperatureValue.textContent = this.elements.temperature.value;
    });

    // Configuration management
    this.elements.newConfigBtn.addEventListener('click', () => this.createNewConfig());
    this.elements.deleteConfigBtn.addEventListener('click', () => this.deleteConfig());
    this.elements.activeConfig.addEventListener('change', () => this.switchConfig());

    this.elements.settingsTabGeneralBtn?.addEventListener('click', () => this.switchSettingsTab('general'));
    this.elements.settingsTabProfilesBtn?.addEventListener('click', () => this.switchSettingsTab('profiles'));
    this.elements.createProfileBtn?.addEventListener('click', () => this.createProfileFromInput());
    this.elements.openGeneralBtn?.addEventListener('click', () => this.switchSettingsTab('general'));
    this.elements.openProfilesBtn?.addEventListener('click', () => this.switchSettingsTab('profiles'));
    this.elements.generalProfileSelect?.addEventListener('change', (e) => this.setActiveConfig(e.target.value));

    this.elements.agentGrid?.addEventListener('click', (event) => {
      const pill = event.target.closest('.role-pill');
      if (pill) {
        const role = pill.dataset.role;
        const profile = pill.dataset.profile;
        this.assignProfileRole(profile, role);
        return;
      }
      const card = event.target.closest('.agent-card');
      if (card) {
        const profile = card.dataset.profile;
        this.editProfile(profile);
      }
    });
    this.elements.refreshProfilesBtn?.addEventListener('click', () => this.renderProfileGrid());

    // Agent management grid
    this.elements.agentGrid?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-role]');
      if (!button) return;
      const role = button.dataset.role;
      const profile = button.dataset.profile;
      this.assignProfileRole(profile, role);
    });
    this.elements.refreshProfilesBtn?.addEventListener('click', () => this.renderProfileGrid());

    // View toggles
    this.elements.viewChatBtn?.addEventListener('click', () => this.switchView('chat'));
    this.elements.viewHistoryBtn?.addEventListener('click', () => this.switchView('history'));

    // Screenshot + vision controls
    this.elements.enableScreenshots?.addEventListener('change', () => this.updateScreenshotToggleState());
    this.elements.visionProfile?.addEventListener('change', () => this.updateScreenshotToggleState());
    this.elements.sendScreenshotsAsImages?.addEventListener('change', () => this.updateScreenshotToggleState());

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

    // File upload
    this.elements.fileBtn?.addEventListener('click', () => {
      this.elements.fileInput?.click();
    });
    this.elements.fileInput?.addEventListener('change', (e) => this.handleFileSelection(e));

    // Tab selector
    this.elements.tabSelectorBtn.addEventListener('click', () => this.toggleTabSelector());
    this.elements.closeTabSelector.addEventListener('click', () => this.closeTabSelector());

    // Profile editor controls
    this.elements.profileEditorProvider?.addEventListener('change', () => this.toggleProfileEditorEndpoint());
    this.elements.profileEditorTemperature?.addEventListener('input', () => {
      if (this.elements.profileEditorTemperatureValue) {
        this.elements.profileEditorTemperatureValue.textContent = this.elements.profileEditorTemperature.value;
      }
    });
    this.elements.saveProfileBtn?.addEventListener('click', () => this.saveProfileEdits());

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'tool_execution') {
        if (!message.result) {
          this.pendingToolCount += 1;
          this.clearErrorBanner(); // Clear errors when new activity starts
          this.updateActivityState();
          this.addTimelineItem(message.id, message.tool, message.args);
        } else {
          this.pendingToolCount = Math.max(0, this.pendingToolCount - 1);
          this.updateActivityState();
          this.updateTimelineItem(message.id, message.result);
        }
        this.displayToolExecution(message.tool, message.args, message.result, message.id);
      } else if (message.type === 'assistant_response') {
        const streamingThinking = this.finishStreamingMessage();
        // Combine streaming thinking with API response thinking
        const combinedThinking = [streamingThinking, message.thinking].filter(Boolean).join('\n\n') || null;
        this.displayAssistantMessage(message.content, combinedThinking);
        // Update context usage with actual token count if available
        if (message.usage?.inputTokens) {
          this.updateContextUsage(message.usage.inputTokens);
        } else {
          this.updateContextUsage();
        }
      } else if (message.type === 'error') {
        this.showErrorBanner(message.message);
        this.updateStatus('Error', 'error');
      } else if (message.type === 'warning') {
        this.showErrorBanner(message.message);
        this.updateStatus('Warning', 'warning');
      } else if (message.type === 'assistant_stream') {
        this.handleAssistantStream(message);
      }
    });
  }

  toggleSettings() {
    this.elements.settingsPanel.classList.toggle('hidden');
    if (!this.elements.settingsPanel.classList.contains('hidden')) {
      this.switchSettingsTab(this.currentSettingsTab || 'general');
    }
  }

  toggleCustomEndpoint() {
    const isCustom = this.elements.provider.value === 'custom';
    this.elements.customEndpointGroup.style.display = isCustom ? 'block' : 'none';
  }

  toggleProfileEditorEndpoint() {
    const provider = this.elements.profileEditorProvider?.value;
    if (!this.elements.profileEditorEndpointGroup) return;
    this.elements.profileEditorEndpointGroup.style.display = provider === 'custom' ? 'block' : 'none';
  }

  switchSettingsTab(tabName = 'general') {
    this.currentSettingsTab = tabName;
    const general = this.elements.settingsTabGeneral;
    const profiles = this.elements.settingsTabProfiles;
    general?.classList.toggle('hidden', tabName !== 'general');
    profiles?.classList.toggle('hidden', tabName !== 'profiles');
    this.elements.settingsTabGeneralBtn?.classList.toggle('active', tabName === 'general');
    this.elements.settingsTabProfilesBtn?.classList.toggle('active', tabName === 'profiles');
  }

  createProfileFromInput() {
    const name = (this.elements.newProfileNameInput?.value || '').trim();
    if (!name) {
      this.updateStatus('Enter a profile name first', 'warning');
      return;
    }
    if (this.configs[name]) {
      this.updateStatus('Profile already exists', 'warning');
      return;
    }
    this.elements.newProfileNameInput.value = '';
    this.createNewConfig(name);
    this.editProfile(name, true);
  }

  async loadSettings() {
    const settings = await chrome.storage.local.get([
      'visionBridge',
      'visionProfile',
      'useOrchestrator',
      'orchestratorProfile',
      'showThinking',
      'streamResponses',
      'autoScroll',
      'confirmActions',
      'saveHistory',
      'activeConfig',
      'configs',
      'auxAgentProfiles'
    ]);

    const storedConfigs = settings.configs || {};
    const baseConfig = {
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4o',
      customEndpoint: '',
      systemPrompt: this.getDefaultSystemPrompt(),
      temperature: 0.7,
      maxTokens: 4096,
      contextLimit: 200000,
      timeout: 30000,
      sendScreenshotsAsImages: false,
      screenshotQuality: 'high',
      showThinking: true,
      streamResponses: true,
      autoScroll: true,
      confirmActions: true,
      saveHistory: true,
      enableScreenshots: false
    };

    this.configs = {
      default: { ...baseConfig, ...(storedConfigs.default || {}) },
      ...storedConfigs
    };
    this.currentConfig = this.configs[settings.activeConfig] ? settings.activeConfig : 'default';
    this.auxAgentProfiles = settings.auxAgentProfiles || [];

    this.elements.visionBridge.value = settings.visionBridge !== undefined ? String(settings.visionBridge) : 'true';
    this.elements.visionProfile.value = settings.visionProfile || '';
    this.elements.orchestratorToggle.value = settings.useOrchestrator !== undefined ? String(settings.useOrchestrator) : 'false';
    this.elements.orchestratorProfile.value = settings.orchestratorProfile || '';
    this.elements.showThinking.value = settings.showThinking !== undefined ? String(settings.showThinking) : 'true';
    this.elements.streamResponses.value = settings.streamResponses !== undefined ? String(settings.streamResponses) : 'true';
    this.elements.autoScroll.value = settings.autoScroll !== undefined ? settings.autoScroll : 'true';
    this.elements.confirmActions.value = settings.confirmActions !== undefined ? settings.confirmActions : 'true';
    this.elements.saveHistory.value = settings.saveHistory !== undefined ? settings.saveHistory : 'true';

    this.refreshConfigDropdown();
    this.setActiveConfig(this.currentConfig, true);
    this.toggleCustomEndpoint();
    this.updateScreenshotToggleState();
    this.editProfile(this.currentConfig, true);
  }

  async saveSettings() {
    this.configs[this.currentConfig] = this.collectCurrentFormProfile();
    await this.persistAllSettings();
    this.toggleSettings();
  }

  collectCurrentFormProfile() {
    return {
      provider: this.elements.provider.value,
      apiKey: this.elements.apiKey.value,
      model: this.elements.model.value,
      customEndpoint: this.elements.customEndpoint.value,
      systemPrompt: this.elements.systemPrompt.value,
      temperature: parseFloat(this.elements.temperature.value) || 0.7,
      maxTokens: parseInt(this.elements.maxTokens.value) || 4096,
      contextLimit: parseInt(this.elements.contextLimit.value) || 200000,
      timeout: parseInt(this.elements.timeout.value) || 30000,
      enableScreenshots: this.elements.enableScreenshots.value === 'true',
      sendScreenshotsAsImages: this.elements.sendScreenshotsAsImages.value === 'true',
      screenshotQuality: this.elements.screenshotQuality.value || 'high',
      showThinking: this.elements.showThinking.value === 'true',
      streamResponses: this.elements.streamResponses.value === 'true',
      autoScroll: this.elements.autoScroll.value === 'true',
      confirmActions: this.elements.confirmActions.value === 'true',
      saveHistory: this.elements.saveHistory.value === 'true'
    };
  }

  async persistAllSettings({ silent = false } = {}) {
    const activeProfile = this.configs[this.currentConfig] || {};
    const payload = {
      provider: activeProfile.provider || 'openai',
      apiKey: activeProfile.apiKey || '',
      model: activeProfile.model || 'gpt-4o',
      customEndpoint: activeProfile.customEndpoint || '',
      systemPrompt: activeProfile.systemPrompt || this.getDefaultSystemPrompt(),
      temperature: activeProfile.temperature ?? 0.7,
      maxTokens: activeProfile.maxTokens || 4096,
      contextLimit: activeProfile.contextLimit || 200000,
      timeout: activeProfile.timeout || 30000,
      enableScreenshots: activeProfile.enableScreenshots ?? false,
      sendScreenshotsAsImages: activeProfile.sendScreenshotsAsImages ?? false,
      screenshotQuality: activeProfile.screenshotQuality || 'high',
      showThinking: activeProfile.showThinking !== false,
      streamResponses: activeProfile.streamResponses !== false,
      autoScroll: activeProfile.autoScroll !== false,
      confirmActions: activeProfile.confirmActions !== false,
      saveHistory: activeProfile.saveHistory !== false,
      visionBridge: this.elements.visionBridge.value === 'true',
      visionProfile: this.elements.visionProfile.value,
      useOrchestrator: this.elements.orchestratorToggle.value === 'true',
      orchestratorProfile: this.elements.orchestratorProfile.value,
      auxAgentProfiles: this.auxAgentProfiles,
      activeConfig: this.currentConfig,
      configs: this.configs
    };
    await chrome.storage.local.set(payload);
    this.updateContextUsage();
    if (!silent) {
      this.updateStatus('Settings saved successfully', 'success');
    }
  }

  getDefaultSystemPrompt() {
    return `You are a browser automation agent. You have tools to navigate, click, type, scroll, read page content, manage tabs, and optionally capture screenshots.

## Core Workflow
1. **Plan first**: Break requests into numbered tasks before taking action.
2. **Act methodically**: Execute one task at a time. After navigation/scroll, call getPageContent to see what's on the page.
3. **Verify**: After actions, check results before proceeding. If something fails, try an alternative approach.
4. **Complete**: Summarize findings with specific evidence (quotes, URLs, data found).

## Available Tools
- **navigate**: Go to a URL
- **click**: Click elements by CSS selector
- **type**: Enter text into inputs
- **pressKey**: Press keyboard keys (Enter, Tab, Escape, etc.)
- **scroll**: Scroll page (up/down/left/right)
- **getPageContent**: Read page content (text, html, links, title, url)
- **getTabs** / **switchTab** / **newTab** / **closeTab**: Manage browser tabs
- **fillForm**: Fill multiple form fields at once
- **screenshot**: Capture visible page (if enabled)

## Tool Errors
If a tool fails, DON'T STOP. Try:
- Different selector (more specific or more general)
- Scroll to find the element
- Navigate to a different page
- Use getPageContent to understand the current state

## Orchestrator Mode (when enabled)
The spawn_subagent tool is available for complex workflows. Use it ONLY when the user explicitly requests:
- Parallel research (e.g., "search Google AND Reddit at the same time")
- Multi-site data gathering mentioned by user
- User says "use sub-agents" or "spawn agents"

Do NOT auto-spawn sub-agents. Let the user decide when orchestration is needed.

## Response Format
- Be concise but thorough
- Cite evidence: "Found on [page]: [quote/data]"
- If blocked, explain what you tried and why it failed`;
  }

  async createNewConfig(name) {
    const trimmedName = (name || '').trim() || prompt('Enter configuration name:') || '';
    if (!trimmedName) return;
    if (this.configs[trimmedName]) {
      alert('Configuration already exists!');
      return;
    }

    this.configs[trimmedName] = {
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
      streamResponses: this.elements.streamResponses.value === 'true',
      enableScreenshots: this.elements.enableScreenshots.value === 'true'
    };

    this.refreshConfigDropdown();
    this.setActiveConfig(trimmedName, true);
    this.updateStatus(`Configuration "${trimmedName}" created`, 'success');
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
      this.setActiveConfig(this.currentConfig, true);
      this.updateStatus('Configuration deleted', 'success');
    }
  }

  async switchConfig() {
    const newConfig = this.elements.activeConfig.value;
    if (!this.configs[newConfig]) {
      alert('Configuration not found');
      return;
    }
    this.setActiveConfig(newConfig);
  }

  refreshConfigDropdown() {
    this.elements.activeConfig.innerHTML = '';
    if (this.elements.generalProfileSelect) {
      this.elements.generalProfileSelect.innerHTML = '';
    }
    Object.keys(this.configs).forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === this.currentConfig) {
        option.selected = true;
      }
      this.elements.activeConfig.appendChild(option);

      if (this.elements.generalProfileSelect) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === this.currentConfig) {
          opt.selected = true;
        }
        this.elements.generalProfileSelect.appendChild(opt);
      }
    });
    this.refreshProfileSelectors();
    this.renderProfileGrid();
    this.updateContextUsage();
  }

  refreshProfileSelectors() {
    const names = Object.keys(this.configs);
    const selects = [this.elements.orchestratorProfile, this.elements.visionProfile];
    selects.forEach(select => {
      if (!select) return;
      select.innerHTML = '<option value=\"\">Use active config</option>';
      names.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
      });
    });
  }

  renderProfileGrid() {
    if (!this.elements.agentGrid) return;
    this.elements.agentGrid.innerHTML = '';
    const currentVision = this.elements.visionProfile?.value;
    const currentOrchestrator = this.elements.orchestratorProfile?.value;
    const configs = Object.keys(this.configs);
    if (!configs.length) {
      this.elements.agentGrid.innerHTML = '<div class="history-empty">No profiles yet.</div>';
      return;
    }
    configs.forEach(name => {
      const card = document.createElement('div');
      card.className = 'agent-card';
      if (name === this.profileEditorTarget) {
        card.classList.add('editing');
      }
      card.dataset.profile = name;
      const rolePills = ['main', 'vision', 'orchestrator', 'aux'].map(role => {
        const isActive = this.isProfileActiveForRole(name, role, currentVision, currentOrchestrator);
        const label = this.getRoleLabel(role);
        return `<span class="role-pill ${isActive ? 'active' : ''} ${role}-pill" data-role="${role}" data-profile="${name}">${label}</span>`;
      }).join('');
      const config = this.configs[name] || {};
      card.innerHTML = `
        <div>
          <h4>${this.escapeHtml(name)}</h4>
          <span>${this.escapeHtml(config.provider || 'Provider')} · ${this.escapeHtml(config.model || 'Model')}</span>
        </div>
        <div class="role-pills">${rolePills}</div>
      `;
      this.elements.agentGrid.appendChild(card);
    });
  }

  getRoleLabel(role) {
    switch (role) {
      case 'main': return 'Main';
      case 'vision': return 'Vision';
      case 'orchestrator': return 'Orchestrator';
      default: return 'Team';
    }
  }

  isProfileActiveForRole(name, role, visionName, orchestratorName) {
    if (role === 'main') return name === this.currentConfig;
    if (role === 'vision') return name && visionName === name;
    if (role === 'orchestrator') return name && orchestratorName === name;
    if (role === 'aux') return this.auxAgentProfiles.includes(name);
    return false;
  }

  assignProfileRole(profileName, role) {
    if (!profileName) return;
    if (role === 'main') {
      this.setActiveConfig(profileName);
      return;
    }
    if (role === 'vision') {
      this.toggleProfileRole('visionProfile', profileName);
    } else if (role === 'orchestrator') {
      this.toggleProfileRole('orchestratorProfile', profileName);
    } else if (role === 'aux') {
      this.toggleAuxProfile(profileName);
    }
  }

  toggleProfileRole(elementId, profileName) {
    const element = this.elements[elementId];
    if (!element) return;
    element.value = element.value === profileName ? '' : profileName;
    this.renderProfileGrid();
  }

  toggleAuxProfile(profileName) {
    const idx = this.auxAgentProfiles.indexOf(profileName);
    if (idx === -1) {
      this.auxAgentProfiles.push(profileName);
    } else {
      this.auxAgentProfiles.splice(idx, 1);
    }
    this.auxAgentProfiles = Array.from(new Set(this.auxAgentProfiles));
    this.renderProfileGrid();
  }

  editProfile(name, silent = false) {
    if (!name || !this.configs[name]) return;
    this.profileEditorTarget = name;
    const config = this.configs[name];
    this.elements.profileEditorTitle && (this.elements.profileEditorTitle.textContent = `Editing: ${name}`);
    this.elements.profileEditorName && (this.elements.profileEditorName.value = name);
    this.elements.profileEditorProvider.value = config.provider || 'openai';
    this.elements.profileEditorApiKey.value = config.apiKey || '';
    this.elements.profileEditorModel.value = config.model || '';
    this.elements.profileEditorEndpoint.value = config.customEndpoint || '';
    this.elements.profileEditorTemperature.value = config.temperature ?? 0.7;
    if (this.elements.profileEditorTemperatureValue) {
      this.elements.profileEditorTemperatureValue.textContent = this.elements.profileEditorTemperature.value;
    }
    this.elements.profileEditorMaxTokens.value = config.maxTokens || 2048;
    this.elements.profileEditorTimeout.value = config.timeout || 30000;
    this.elements.profileEditorEnableScreenshots.value = config.enableScreenshots ? 'true' : 'false';
    this.elements.profileEditorSendScreenshots.value = config.sendScreenshotsAsImages ? 'true' : 'false';
    this.elements.profileEditorScreenshotQuality.value = config.screenshotQuality || 'high';
    this.elements.profileEditorPrompt.value = config.systemPrompt || this.getDefaultSystemPrompt();
    this.toggleProfileEditorEndpoint();
    this.renderProfileGrid();
    if (!silent) {
      this.switchSettingsTab('profiles');
    }
  }

  collectProfileEditorData() {
    return {
      provider: this.elements.profileEditorProvider.value,
      apiKey: this.elements.profileEditorApiKey.value,
      model: this.elements.profileEditorModel.value,
      customEndpoint: this.elements.profileEditorEndpoint.value,
      temperature: parseFloat(this.elements.profileEditorTemperature.value) || 0.7,
      maxTokens: parseInt(this.elements.profileEditorMaxTokens.value) || 2048,
      timeout: parseInt(this.elements.profileEditorTimeout.value) || 30000,
      enableScreenshots: this.elements.profileEditorEnableScreenshots.value === 'true',
      sendScreenshotsAsImages: this.elements.profileEditorSendScreenshots.value === 'true',
      screenshotQuality: this.elements.profileEditorScreenshotQuality.value || 'high',
      systemPrompt: this.elements.profileEditorPrompt.value || this.getDefaultSystemPrompt()
    };
  }

  async saveProfileEdits() {
    const target = this.profileEditorTarget;
    if (!target || !this.configs[target]) {
      this.updateStatus('Select a profile to edit', 'warning');
      return;
    }
    const existing = this.configs[target] || {};
    this.configs[target] = { ...existing, ...this.collectProfileEditorData() };
    await this.persistAllSettings({ silent: true });
    if (target === this.currentConfig) {
      this.populateFormFromConfig(this.configs[target]);
      this.toggleCustomEndpoint();
    }
    this.renderProfileGrid();
    this.updateStatus(`Profile "${target}" saved`, 'success');
  }

  populateFormFromConfig(config = {}) {
    this.elements.provider.value = config.provider || 'openai';
    this.elements.apiKey.value = config.apiKey || '';
    this.elements.model.value = config.model || 'gpt-4o';
    this.elements.customEndpoint.value = config.customEndpoint || '';
    this.elements.systemPrompt.value = config.systemPrompt || this.getDefaultSystemPrompt();
    this.elements.temperature.value = config.temperature !== undefined ? config.temperature : 0.7;
    this.elements.temperatureValue.textContent = this.elements.temperature.value;
    this.elements.maxTokens.value = config.maxTokens || 4096;
    this.elements.contextLimit.value = config.contextLimit || 200000;
    this.elements.timeout.value = config.timeout || 30000;
    this.elements.enableScreenshots.value = config.enableScreenshots ? 'true' : 'false';
    this.elements.sendScreenshotsAsImages.value = config.sendScreenshotsAsImages ? 'true' : 'false';
    this.elements.screenshotQuality.value = config.screenshotQuality || 'high';
    this.elements.streamResponses.value = config.streamResponses !== false ? 'true' : 'true';
    this.elements.showThinking.value = config.showThinking !== false ? 'true' : 'false';
    this.elements.autoScroll.value = config.autoScroll !== false ? 'true' : 'false';
    this.elements.confirmActions.value = config.confirmActions !== false ? 'true' : 'false';
    this.elements.saveHistory.value = config.saveHistory !== false ? 'true' : 'false';
  }

  setActiveConfig(name, quiet = false) {
    if (!this.configs[name]) return;
    this.currentConfig = name;
    this.elements.activeConfig.value = name;
    this.populateFormFromConfig(this.configs[name]);
    this.toggleCustomEndpoint();
    this.renderProfileGrid();
    this.updateScreenshotToggleState();
    this.editProfile(name, true);
    if (!quiet) {
      this.updateStatus(`Switched to configuration "${name}"`, 'success');
    }
  }

  async sendMessage() {
    const userMessage = this.elements.userInput.value.trim();
    if (!userMessage) return;

    // Clear input
    this.elements.userInput.value = '';
    if (!this.firstUserMessage) {
      this.firstUserMessage = userMessage;
    }

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
    this.updateContextUsage();

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
      this.persistHistory();
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

    const parsed = this.extractThinking(content, thinking);
    content = parsed.content;
    thinking = parsed.thinking;

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
        <div class="thinking-block collapsed">
          <div class="thinking-header">
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            Thinking
          </div>
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

    // Add click handler for collapsible thinking blocks
    const thinkingHeader = messageDiv.querySelector('.thinking-header');
    if (thinkingHeader) {
      thinkingHeader.addEventListener('click', () => {
        thinkingHeader.closest('.thinking-block').classList.toggle('collapsed');
      });
    }

    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
    this.updateStatus('Ready', 'success');
    document.querySelector('.input-area').classList.remove('running');
    this.pendingToolCount = 0;
    this.updateActivityState();
    this.persistHistory();
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
      this.clearErrorBanner(); // Clear any existing errors when new activity starts
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
      // Extract and hide thinking content during streaming
      const cleaned = this.extractThinking(content || '');
      // Store thinking for later use
      this.streamingState.thinking = cleaned.thinking;
      // Only show non-thinking content
      const displayContent = cleaned.content || '';
      this.streamingState.textEl.innerHTML = this.renderMarkdown(displayContent);
    }
    this.scrollToBottom();
  }

  finishStreamingMessage() {
    // Preserve thinking before clearing state
    const streamingThinking = this.streamingState?.thinking;

    if (this.streamingState?.container) {
      this.streamingState.container.remove();
    }
    this.streamingState = null;
    this.isStreaming = false;
    this.updateActivityState();

    // Return preserved thinking so caller can use it
    return streamingThinking;
  }

  displayToolExecution(toolName, args, result, toolCallId = null) {
    // Tool execution is now primarily shown in the top timeline
    // Only update the timeline item status when result comes in
    if (result !== null && result !== undefined) {
      // Result received - timeline item already updated via updateTimelineItem
      // Optionally show errors in an error banner
      const isError = result && (result.error || result.success === false);
      if (isError) {
        this.showErrorBanner(`${toolName}: ${result.error || 'Tool execution failed'}`);
      }
    }
  }

  showErrorBanner(message) {
    // Remove existing error banner if present
    const existing = this.elements.chatInterface?.querySelector('.error-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.innerHTML = `
      <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

    banner.querySelector('.error-dismiss').addEventListener('click', () => banner.remove());

    // Insert after status bar
    const statusBar = this.elements.statusBar;
    if (statusBar && statusBar.parentNode) {
      statusBar.parentNode.insertBefore(banner, statusBar.nextSibling);
    }

    // Auto-dismiss after 8 seconds
    setTimeout(() => banner.remove(), 8000);
  }

  clearErrorBanner() {
    const existing = this.elements.chatInterface?.querySelector('.error-banner');
    if (existing) existing.remove();
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

    // Get a compact args preview
    const argsPreview = this.getArgsPreview(args);

    row.innerHTML = `
      <span class="tool-timeline-status running"></span>
      <span class="tool-timeline-name">${this.escapeHtml(toolName)}</span>
      ${argsPreview ? `<span class="tool-timeline-args">${this.escapeHtml(argsPreview)}</span>` : ''}
    `;
    this.elements.toolTimeline.appendChild(row);

    // Keep max 20 items for cleaner display
    while (this.elements.toolTimeline.children.length > 20) {
      this.elements.toolTimeline.removeChild(this.elements.toolTimeline.firstChild);
    }
    if (id) this.timelineItems.set(id, row);
  }

  updateTimelineItem(id, result) {
    if (!id || !this.timelineItems.has(id)) return;
    const row = this.timelineItems.get(id);
    const statusEl = row.querySelector('.tool-timeline-status');
    const start = parseInt(row.dataset.start || '0', 10);
    const dur = start ? Date.now() - start : 0;
    const isError = result && (result.error || result.success === false);

    statusEl.className = `tool-timeline-status ${isError ? 'error' : 'success'}`;

    // Add or update duration meta
    let metaEl = row.querySelector('.tool-timeline-meta');
    if (!metaEl) {
      metaEl = document.createElement('span');
      metaEl.className = 'tool-timeline-meta';
      row.appendChild(metaEl);
    }
    metaEl.textContent = `${dur}ms`;
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
    if (this.contextUsage && this.contextUsage.maxContextTokens) {
      const usedK = (this.contextUsage.approxTokens / 1000).toFixed(1);
      const maxK = (this.contextUsage.maxContextTokens / 1000).toFixed(0);
      labels.push(`Context ~ ${usedK}k / ${maxK}k`);
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

  extractThinking(content, existingThinking = null) {
    let thinking = existingThinking || null;
    let cleanedContent = content || '';
    const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
    let match;
    const collected = [];
    while ((match = thinkRegex.exec(cleanedContent)) !== null) {
      if (match[1]) collected.push(match[1].trim());
    }
    if (collected.length > 0) {
      thinking = [existingThinking, ...collected].filter(Boolean).join('\n\n').trim();
      cleanedContent = cleanedContent.replace(thinkRegex, '').trim();
    }
    return { content: cleanedContent, thinking };
  }

  async persistHistory() {
    if (!this.elements.saveHistory || this.elements.saveHistory.value !== 'true') return;
    const entry = {
      id: this.sessionId,
      startedAt: this.sessionStartedAt,
      updatedAt: Date.now(),
      title: this.firstUserMessage || 'Session',
      transcript: this.conversationHistory.slice(-200)
    };
    const existing = await chrome.storage.local.get(['chatSessions']);
    const sessions = existing.chatSessions || [];
    const filtered = sessions.filter(s => s.id !== entry.id);
    filtered.unshift(entry);
    const trimmed = filtered.slice(0, 20);
    await chrome.storage.local.set({ chatSessions: trimmed });
    this.loadHistoryList();
  }

  updateContextUsage(actualTokens = null) {
    // Use actual tokens if provided (from API response), otherwise estimate
    let approxTokens;

    if (actualTokens !== null && actualTokens > 0) {
      // Track highest context seen in session (API input_tokens represents full context)
      this.sessionTokensUsed = Math.max(this.sessionTokensUsed || 0, actualTokens);
      approxTokens = this.sessionTokensUsed;
    } else {
      // Estimate tokens from conversation history
      const joined = this.conversationHistory
        .map(msg => {
          if (!msg) return '';
          if (typeof msg.content === 'string') return msg.content;
          if (Array.isArray(msg.content)) {
            return msg.content.map(p => {
              if (typeof p === 'string') return p;
              if (p?.text) return p.text;
              if (p?.content) return JSON.stringify(p.content);
              return '';
            }).join('');
          }
          return '';
        })
        .join('\n');
      const chars = joined.length;
      const baseTokens = this.estimateBaseContextTokens();
      const estimated = baseTokens + Math.ceil(chars / 4);
      // Use whichever is higher: estimate or tracked session tokens
      approxTokens = Math.max(estimated, this.sessionTokensUsed || 0);
    }

    // Get context limit from settings (user-configured)
    const maxContextTokens = this.getConfiguredContextLimit();
    const percent = Math.min(100, Math.round((approxTokens / maxContextTokens) * 100));
    this.contextUsage = { approxTokens, maxContextTokens, percent };
    this.updateActivityState();
  }

  getConfiguredContextLimit() {
    // Use configured value from settings
    const active = this.configs[this.currentConfig] || {};
    const configured = active.contextLimit || parseInt(this.elements.contextLimit?.value) || 200000;
    return configured;
  }

  estimateBaseContextTokens() {
    const active = this.configs[this.currentConfig] || {};
    const prompt = active.systemPrompt || this.getDefaultSystemPrompt();
    const promptTokens = Math.ceil((prompt?.length || 0) / 4);
    const toolBudget = 1200; // approximate tool definition + orchestrator overhead
    return promptTokens + toolBudget;
  }

  async loadHistoryList() {
    if (!this.elements.historyItems) return;
    const { chatSessions = [] } = await chrome.storage.local.get(['chatSessions']);
    this.elements.historyItems.innerHTML = '';
    if (!chatSessions.length) {
      this.elements.historyItems.innerHTML = '<div class="history-empty">No saved chats yet.</div>';
      return;
    }
    chatSessions.forEach(session => {
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
          this.conversationHistory = [...session.transcript];
          this.sessionId = session.id || `session-${Date.now()}`;
          this.firstUserMessage = session.title || '';
          this.renderConversationHistory();
          this.updateContextUsage();
        }
      });
      this.elements.historyItems.appendChild(item);
    });
  }

  renderConversationHistory() {
    this.elements.chatMessages.innerHTML = '';
    this.conversationHistory.forEach(msg => {
      if (msg.role === 'user') {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        messageDiv.innerHTML = `
          <div class="message-header">You</div>
          <div class="message-content">${this.escapeHtml(msg.content || '')}</div>
        `;
        this.elements.chatMessages.appendChild(messageDiv);
      } else if (msg.role === 'assistant') {
        const parsed = this.extractThinking(msg.content, null);
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        let html = `<div class="message-header">Assistant</div>`;
        if (parsed.thinking && this.elements.showThinking.value === 'true') {
          html += `
            <div class="thinking-block collapsed">
              <div class="thinking-header">
                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                Thinking
              </div>
              <div class="thinking-content">${this.escapeHtml(parsed.thinking)}</div>
            </div>
          `;
        }
        if (parsed.content && parsed.content.trim() !== '') {
          html += `<div class="message-content markdown-body">${this.renderMarkdown(parsed.content)}</div>`;
        }
        messageDiv.innerHTML = html;

        // Add click handler for collapsible thinking blocks
        const thinkingHeader = messageDiv.querySelector('.thinking-header');
        if (thinkingHeader) {
          thinkingHeader.addEventListener('click', () => {
            thinkingHeader.closest('.thinking-block').classList.toggle('collapsed');
          });
        }

        this.elements.chatMessages.appendChild(messageDiv);
      }
    });
    this.scrollToBottom();
  }

  switchView(view) {
    this.currentView = view;
    if (!this.elements.chatInterface || !this.elements.historyPanel) return;
    if (view === 'history') {
      this.elements.chatInterface.classList.add('hidden');
      this.elements.historyPanel.classList.remove('hidden');
      this.elements.viewHistoryBtn?.classList.add('active');
      this.elements.viewChatBtn?.classList.remove('active');
    } else {
      this.elements.chatInterface.classList.remove('hidden');
      this.elements.historyPanel.classList.add('hidden');
      this.elements.viewChatBtn?.classList.add('active');
      this.elements.viewHistoryBtn?.classList.remove('active');
    }
  }

  startNewSession() {
    this.conversationHistory = [];
    this.sessionId = `session-${Date.now()}`;
    this.sessionStartedAt = Date.now();
    this.firstUserMessage = '';
    this.sessionTokensUsed = 0; // Reset context tracking
    this.elements.chatMessages.innerHTML = '';
    this.elements.toolTimeline.innerHTML = ''; // Clear tool timeline
    this.timelineItems.clear();
    this.updateStatus('Ready for a new session', 'success');
    this.switchView('chat');
    this.updateContextUsage();
  }

  updateScreenshotToggleState() {
    if (!this.elements.enableScreenshots) return;
    const wantsScreens = this.elements.enableScreenshots.value === 'true';
    const visionProfile = this.elements.visionProfile?.value;
    const provider = this.elements.provider?.value;
    const hasVision = (provider && provider !== 'custom') || visionProfile;
    const controls = [this.elements.sendScreenshotsAsImages, this.elements.screenshotQuality];
    controls.forEach(ctrl => {
      if (!ctrl) return;
      ctrl.disabled = !wantsScreens;
      ctrl.parentElement?.classList.toggle('disabled', !wantsScreens);
    });
    if (wantsScreens && !hasVision) {
      this.updateStatus('Enable a vision-capable profile before sending screenshots.', 'warning');
    }
  }

  async handleFileSelection(event) {
    const input = event.target;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const maxPerFile = 4000;
    for (const file of files) {
      try {
        const text = await file.text();
        const trimmed = text.length > maxPerFile
          ? text.slice(0, maxPerFile) + '\n… (truncated)'
          : text;
        const prefix = `\n\n[File: ${file.name}]\n`;
        this.elements.userInput.value += prefix + trimmed;
      } catch (e) {
        console.warn('Failed to read file', file.name, e);
      }
    }
    input.value = '';
    this.elements.userInput.focus();
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
