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
  const isCustom = this.elements.provider?.value === 'custom';
  if (this.elements.customEndpointGroup) {
    this.elements.customEndpointGroup.style.display = isCustom ? 'block' : 'none';
  }
  if (isCustom && this.elements.customEndpoint && !this.elements.customEndpoint.value) {
    this.elements.customEndpoint.placeholder = 'https://api.example.com/v1/chat/completions';
  }
};

(SidePanelUI.prototype as any).validateCustomEndpoint = function validateCustomEndpoint() {
  if (!this.elements.customEndpoint) return true;
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
  if (!this.elements.profileEditorEndpointGroup) return;
  const provider = this.elements.profileEditorProvider?.value;
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
  if (this.elements.newProfileNameInput) this.elements.newProfileNameInput.value = '';
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

  if (this.elements.visionBridge)
    this.elements.visionBridge.value = settings.visionBridge !== undefined ? String(settings.visionBridge) : 'true';
  if (this.elements.visionProfile) this.elements.visionProfile.value = settings.visionProfile || '';
  if (this.elements.orchestratorToggle)
    this.elements.orchestratorToggle.value =
      settings.useOrchestrator !== undefined ? String(settings.useOrchestrator) : 'false';
  if (this.elements.orchestratorProfile) this.elements.orchestratorProfile.value = settings.orchestratorProfile || '';
  if (this.elements.showThinking)
    this.elements.showThinking.value = settings.showThinking !== undefined ? String(settings.showThinking) : 'true';
  if (this.elements.streamResponses)
    this.elements.streamResponses.value =
      settings.streamResponses !== undefined ? String(settings.streamResponses) : 'true';
  if (this.elements.autoScroll)
    this.elements.autoScroll.value = settings.autoScroll !== undefined ? String(settings.autoScroll) : 'true';
  if (this.elements.confirmActions)
    this.elements.confirmActions.value =
      settings.confirmActions !== undefined ? String(settings.confirmActions) : 'true';
  if (this.elements.saveHistory)
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
  if (this.elements.provider?.value === 'custom' && !this.validateCustomEndpoint()) {
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
  return `You are a browser automation agent with tools to control the browser: navigate, click, type, scroll, read content, manage tabs, and capture screenshots.

## MANDATORY WORKFLOW

### Step 1: Create a Plan (REQUIRED)
Before ANY action, call \`set_plan\` with 3-6 concrete steps:

\`\`\`
set_plan({
  steps: [
    { title: "Navigate to example.com", status: "pending" },
    { title: "Search for 'product name'", status: "pending" },
    { title: "Extract pricing information", status: "pending" },
    { title: "Summarize findings", status: "pending" }
  ]
})
\`\`\`

**GOOD steps** (specific, actionable):
- "Navigate to google.com"
- "Type 'search query' in search box"
- "Click the first result link"
- "Extract the main article text"
- "Scroll down to find pricing section"

**BAD steps** (vague, non-actionable):
- "Research the topic" (too vague)
- "Phase 1: Discovery" (not an action)
- "## Overview" (this is a header, not a step)
- "Gather information" (what information? how?)

### Step 2: Execute & Update (CRITICAL)
After completing EACH step, you MUST call \`update_plan\`:

\`\`\`
update_plan({ step_index: 0, status: "done" })
\`\`\`

**NEVER skip this.** The system tracks your progress. After marking a step done, proceed to the next step.

### Step 3: Verify Before Proceeding
After navigation, scrolling, or clicking:
1. Call \`getContent\` to see what's on the page
2. Verify the action worked
3. Then mark the step done and continue

### Step 4: Complete All Steps
Do NOT stop until all plan steps are marked done. If blocked:
- Try alternative approaches
- Update your plan if needed
- Explain what's blocking you

## Available Tools

**Navigation & Reading:**
- \`navigate\` - Go to a URL
- \`getContent\` - Read page content (ALWAYS call after navigation/scroll)
- \`scroll\` - Scroll the page (up/down/top/bottom)
- \`screenshot\` - Capture visible page (if enabled)

**Interaction:**
- \`click\` - Click elements by CSS selector
- \`type\` - Enter text into inputs
- \`pressKey\` - Press keyboard keys (Enter, Tab, Escape)

**Tab Management:**
- \`getTabs\` / \`switchTab\` / \`openTab\` / \`closeTab\`
- \`focusTab\` / \`groupTabs\` / \`describeSessionTabs\`

**Planning:**
- \`set_plan\` - Create your action checklist (do this FIRST)
- \`update_plan\` - Mark steps done (do this after EACH step)

## Error Handling
If a tool fails:
1. Try a different selector
2. Scroll to find the element
3. Use getContent to understand page state
4. Update your plan if the approach isn't working

## Example Session

User: "Find the price of iPhone 15 on Apple's website"

You should:
1. \`set_plan\` with steps: Navigate to apple.com → Search for iPhone 15 → Find pricing → Report price
2. \`navigate\` to apple.com
3. \`getContent\` to see the page
4. \`update_plan\` step 0 done
5. \`click\` or \`type\` to search
6. \`getContent\` to see results
7. \`update_plan\` step 1 done
8. Continue until all steps done
9. Summarize with the actual price found`;
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
