import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).toggleSettings = async function toggleSettings(saveOnClose = true) {
  const isOpen = this.elements.settingsPanel ? !this.elements.settingsPanel.classList.contains('hidden') : false;
  if (isOpen) {
    if (saveOnClose) {
      this.configs[this.currentConfig] = this.collectCurrentFormProfile();
      await this.persistAllSettings({ silent: true });
    }
    this.settingsOpen = false;
    this.showRightPanel(null);
    this.setNavActive('chat');
    this.updateAccessUI();
    return;
  }
  this.settingsOpen = true;
  this.accessPanelVisible = false;
  this.openSidebar();
  this.showRightPanel('settings');
  this.switchSettingsTab(this.currentSettingsTab || 'general');
  this.setNavActive('settings');
  this.updateAccessUI();
};

(SidePanelUI.prototype as any).cancelSettings = async function cancelSettings() {
  await this.loadSettings();
  await this.toggleSettings(false);
};

(SidePanelUI.prototype as any).toggleCustomEndpoint = function toggleCustomEndpoint() {
  const isCustom = this.elements.provider.value === 'custom';
  this.elements.customEndpointGroup.style.display = isCustom ? 'block' : 'none';
  if (isCustom && !this.elements.customEndpoint.value) {
    this.elements.customEndpoint.placeholder = 'https://api.example.com/v1/chat/completions';
  }
};

(SidePanelUI.prototype as any).validateCustomEndpoint = function validateCustomEndpoint() {
  const url = this.elements.customEndpoint.value.trim();
  if (!url) return true;
  try {
    new URL(url);
    this.elements.customEndpoint.style.borderColor = '';
    return true;
  } catch {
    this.elements.customEndpoint.style.borderColor = 'var(--status-error)';
    return false;
  }
};

(SidePanelUI.prototype as any).toggleProfileEditorEndpoint = function toggleProfileEditorEndpoint() {
  const provider = this.elements.profileEditorProvider?.value;
  if (!this.elements.profileEditorEndpointGroup) return;
  this.elements.profileEditorEndpointGroup.style.display = provider === 'custom' ? 'block' : 'none';
};

(SidePanelUI.prototype as any).switchSettingsTab = function switchSettingsTab(
  tabName: 'general' | 'profiles' = 'general',
) {
  if (this.currentSettingsTab === 'general' && tabName === 'profiles') {
    this.configs[this.currentConfig] = this.collectCurrentFormProfile();
    void this.persistAllSettings({ silent: true });
  }
  this.currentSettingsTab = tabName;
  const general = this.elements.settingsTabGeneral;
  const profiles = this.elements.settingsTabProfiles;
  general?.classList.toggle('hidden', tabName !== 'general');
  profiles?.classList.toggle('hidden', tabName !== 'profiles');
  this.elements.settingsTabGeneralBtn?.classList.toggle('active', tabName === 'general');
  this.elements.settingsTabProfilesBtn?.classList.toggle('active', tabName === 'profiles');
};

(SidePanelUI.prototype as any).createProfileFromInput = function createProfileFromInput() {
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
};

(SidePanelUI.prototype as any).loadSettings = async function loadSettings() {
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
    'toolPermissions',
    'allowedDomains',
    'activeConfig',
    'configs',
    'auxAgentProfiles',
    'accountApiBase',
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
    enableScreenshots: false,
  };

  this.configs = {
    default: { ...baseConfig, ...(storedConfigs.default || {}) },
    ...storedConfigs,
  };
  this.currentConfig = this.configs[settings.activeConfig] ? settings.activeConfig : 'default';
  this.auxAgentProfiles = settings.auxAgentProfiles || [];

  this.elements.visionBridge.value = settings.visionBridge !== undefined ? String(settings.visionBridge) : 'true';
  this.elements.visionProfile.value = settings.visionProfile || '';
  this.elements.orchestratorToggle.value =
    settings.useOrchestrator !== undefined ? String(settings.useOrchestrator) : 'false';
  this.elements.orchestratorProfile.value = settings.orchestratorProfile || '';
  this.elements.showThinking.value = settings.showThinking !== undefined ? String(settings.showThinking) : 'true';
  this.elements.streamResponses.value =
    settings.streamResponses !== undefined ? String(settings.streamResponses) : 'true';
  this.elements.autoScroll.value = settings.autoScroll !== undefined ? String(settings.autoScroll) : 'true';
  this.elements.confirmActions.value = settings.confirmActions !== undefined ? String(settings.confirmActions) : 'true';
  this.elements.saveHistory.value = settings.saveHistory !== undefined ? String(settings.saveHistory) : 'true';

  const defaultPermissions = {
    read: true,
    interact: true,
    navigate: true,
    tabs: true,
    screenshots: false,
  };
  const toolPermissions = {
    ...defaultPermissions,
    ...(settings.toolPermissions || {}),
  };
  if (this.elements.permissionRead) this.elements.permissionRead.value = String(toolPermissions.read);
  if (this.elements.permissionInteract) this.elements.permissionInteract.value = String(toolPermissions.interact);
  if (this.elements.permissionNavigate) this.elements.permissionNavigate.value = String(toolPermissions.navigate);
  if (this.elements.permissionTabs) this.elements.permissionTabs.value = String(toolPermissions.tabs);
  if (this.elements.permissionScreenshots)
    this.elements.permissionScreenshots.value = String(toolPermissions.screenshots);
  if (this.elements.allowedDomains) this.elements.allowedDomains.value = settings.allowedDomains || '';
  const fallbackAccountBase = this.getDefaultAccountApiBase();
  const accountApiBase = settings.accountApiBase || fallbackAccountBase;
  if (this.elements.accountApiBase) {
    this.elements.accountApiBase.value = accountApiBase || '';
  }
  this.accountClient.setBaseUrl(accountApiBase || '');
  if (!settings.accountApiBase && accountApiBase) {
    await chrome.storage.local.set({ accountApiBase });
  }
  this.updateAccessConfigPrompt();

  this.refreshConfigDropdown();
  this.setActiveConfig(this.currentConfig, true);
  this.toggleCustomEndpoint();
  this.updateScreenshotToggleState();
  this.editProfile(this.currentConfig, true);
};

(SidePanelUI.prototype as any).saveSettings = async function saveSettings() {
  if (this.elements.provider.value === 'custom' && !this.validateCustomEndpoint()) {
    this.updateStatus('Invalid custom endpoint URL', 'error');
    return;
  }
  this.configs[this.currentConfig] = this.collectCurrentFormProfile();
  await this.persistAllSettings();
  await this.toggleSettings(false);
};

(SidePanelUI.prototype as any).exportSettings = async function exportSettings() {
  try {
    const keys = [
      'configs',
      'activeConfig',
      'auxAgentProfiles',
      'visionBridge',
      'visionProfile',
      'useOrchestrator',
      'orchestratorProfile',
      'showThinking',
      'streamResponses',
      'autoScroll',
      'confirmActions',
      'saveHistory',
      'toolPermissions',
      'allowedDomains',
      'accountApiBase',
    ];
    const settings = await chrome.storage.local.get(keys);
    const payload = {
      ...settings,
      exportedAt: new Date().toISOString(),
      exportVersion: 1,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `parchi-settings-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.updateStatus('Settings export downloaded', 'success');
  } catch (error) {
    this.updateStatus('Unable to export settings', 'error');
  }
};

(SidePanelUI.prototype as any).importSettings = async function importSettings(event: Event) {
  const input = event?.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const payload: Record<string, any> = {};
    const allowedKeys = [
      'configs',
      'activeConfig',
      'auxAgentProfiles',
      'visionBridge',
      'visionProfile',
      'useOrchestrator',
      'orchestratorProfile',
      'showThinking',
      'streamResponses',
      'autoScroll',
      'confirmActions',
      'saveHistory',
      'toolPermissions',
      'allowedDomains',
      'accountApiBase',
    ];
    allowedKeys.forEach((key) => {
      if (data[key] !== undefined) {
        payload[key] = data[key];
      }
    });
    if (payload.configs && typeof payload.configs !== 'object') {
      throw new Error('Invalid configs payload');
    }
    await chrome.storage.local.set(payload);
    await this.loadSettings();
    this.renderProfileGrid();
    this.updateAccessUI();
    this.updateStatus('Settings imported successfully', 'success');
  } catch (error) {
    this.updateStatus('Unable to import settings', 'error');
  } finally {
    if (input) input.value = '';
  }
};

(SidePanelUI.prototype as any).collectCurrentFormProfile = function collectCurrentFormProfile() {
  const current = this.configs[this.currentConfig] || {};
  return {
    provider: this.elements.provider?.value || current.provider || 'openai',
    apiKey: this.elements.apiKey?.value || current.apiKey || '',
    model: this.elements.model?.value || current.model || 'gpt-4o',
    customEndpoint: this.elements.customEndpoint?.value || current.customEndpoint || '',
    systemPrompt: this.elements.systemPrompt?.value || current.systemPrompt || '',
    temperature: Number.parseFloat(this.elements.temperature?.value) || current.temperature || 0.7,
    maxTokens: Number.parseInt(this.elements.maxTokens?.value) || current.maxTokens || 4096,
    contextLimit: Number.parseInt(this.elements.contextLimit?.value) || current.contextLimit || 200000,
    timeout: Number.parseInt(this.elements.timeout?.value) || current.timeout || 30000,
    enableScreenshots: this.elements.enableScreenshots?.value === 'true' || current.enableScreenshots || false,
    sendScreenshotsAsImages:
      this.elements.sendScreenshotsAsImages?.value === 'true' || current.sendScreenshotsAsImages || false,
    screenshotQuality: this.elements.screenshotQuality?.value || current.screenshotQuality || 'high',
    showThinking: this.elements.showThinking?.value === 'true',
    streamResponses: this.elements.streamResponses?.value === 'true',
    autoScroll: this.elements.autoScroll?.value === 'true',
    confirmActions: this.elements.confirmActions?.value === 'true',
    saveHistory: this.elements.saveHistory?.value === 'true',
  };
};

(SidePanelUI.prototype as any).collectToolPermissions = function collectToolPermissions() {
  return {
    read: this.elements.permissionRead?.value !== 'false',
    interact: this.elements.permissionInteract?.value !== 'false',
    navigate: this.elements.permissionNavigate?.value !== 'false',
    tabs: this.elements.permissionTabs?.value !== 'false',
    screenshots: this.elements.permissionScreenshots?.value === 'true',
  };
};

(SidePanelUI.prototype as any).persistAllSettings = async function persistAllSettings({ silent = false } = {}) {
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
    visionBridge: this.elements.visionBridge?.value === 'true',
    visionProfile: this.elements.visionProfile?.value || '',
    useOrchestrator: this.elements.orchestratorToggle?.value === 'true',
    orchestratorProfile: this.elements.orchestratorProfile?.value || '',
    toolPermissions: this.collectToolPermissions(),
    allowedDomains: this.elements.allowedDomains?.value || '',
    accountApiBase: this.elements.accountApiBase?.value?.trim() || '',
    auxAgentProfiles: this.auxAgentProfiles,
    activeConfig: this.currentConfig,
    configs: this.configs,
  };
  await chrome.storage.local.set(payload);
  this.accountClient.setBaseUrl(payload.accountApiBase);
  this.updateAccessConfigPrompt();
  this.updateContextUsage();
  if (!silent) {
    this.updateStatus('Settings saved successfully', 'success');
  }
};

(SidePanelUI.prototype as any).getDefaultSystemPrompt = function getDefaultSystemPrompt() {
  return `You are a browser automation agent. You have tools to navigate, click, type, scroll, read page content, manage tabs, and optionally capture screenshots.

## Core Workflow
1. **Plan first**: Break requests into numbered tasks before taking action.
2. **Act methodically**: Execute one task at a time. After navigation/scroll, call getContent to see what's on the page.
3. **Verify**: After actions, check results before proceeding. If something fails, try an alternative approach.
4. **Complete**: Summarize findings with specific evidence (quotes, URLs, data found).

## Available Tools
- **navigate**: Go to a URL
- **click**: Click elements by CSS selector
- **type**: Enter text into inputs
- **pressKey**: Press keyboard keys (Enter, Tab, Escape, etc.)
- **scroll**: Scroll page (up/down/top/bottom)
- **getContent**: Read page content (text, html, links, title, url)
- **getTabs** / **switchTab** / **openTab** / **closeTab**: Manage browser tabs
- **focusTab** / **groupTabs** / **describeSessionTabs**: Organize and inspect session tabs
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
};

(SidePanelUI.prototype as any).getDefaultAccountApiBase = function getDefaultAccountApiBase() {
  try {
    const manifest = chrome.runtime.getManifest();
    const config = manifest && (manifest as Record<string, any>).parchi;
    if (config && typeof config.accountApiBase === 'string') {
      return config.accountApiBase.trim();
    }
  } catch (error) {
    // Ignore manifest read failures and fall back to empty.
  }
  return '';
};

(SidePanelUI.prototype as any).isAccountRequired = function isAccountRequired() {
  try {
    const manifest = chrome.runtime.getManifest();
    const config = manifest && (manifest as Record<string, any>).parchi;
    if (config && typeof config.requireAccount === 'boolean') {
      return config.requireAccount;
    }
  } catch (error) {
    // Ignore manifest read failures and fall back to default.
  }
  return true;
};

(SidePanelUI.prototype as any).updateScreenshotToggleState = function updateScreenshotToggleState() {
  if (!this.elements.enableScreenshots) return;
  const wantsScreens = this.elements.enableScreenshots.value === 'true';
  const visionProfile = this.elements.visionProfile?.value;
  const provider = this.elements.provider?.value;
  const hasVision = (provider && provider !== 'custom') || visionProfile;
  const controls = [this.elements.sendScreenshotsAsImages, this.elements.screenshotQuality];
  controls.forEach((ctrl) => {
    if (!ctrl) return;
    ctrl.disabled = !wantsScreens;
    ctrl.parentElement?.classList.toggle('disabled', !wantsScreens);
  });
  if (wantsScreens && !hasVision) {
    this.updateStatus('Enable a vision-capable profile before sending screenshots.', 'warning');
  }
};
