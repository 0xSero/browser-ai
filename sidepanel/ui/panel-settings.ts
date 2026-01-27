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
  const provider = this.elements.provider?.value;
  const isCustom = provider === 'custom' || provider === 'kimi';
  
  // Always show the endpoint field, but highlight when required
  if (this.elements.customEndpointGroup) {
    // Add visual emphasis when custom provider selected
    this.elements.customEndpointGroup.classList.toggle('required', isCustom);
  }
  
  // Update placeholder based on provider
  if (this.elements.customEndpoint) {
    if (provider === 'kimi') {
      if (!this.elements.customEndpoint.value || this.elements.customEndpoint.value === 'https://openrouter.ai/api/v1') {
        this.elements.customEndpoint.value = 'https://api.kimi.com/coding/v1';
      }
      this.elements.customEndpoint.placeholder = 'https://api.kimi.com/coding/v1';
    } else if (isCustom) {
      this.elements.customEndpoint.placeholder = 'https://openrouter.ai/api/v1';
    } else {
      this.elements.customEndpoint.placeholder = 'Leave empty for default API URL';
    }
  }
  
  // Update model hint based on provider
  const modelHint = document.getElementById('modelHint');
  if (modelHint) {
    switch (provider) {
      case 'anthropic':
        modelHint.textContent = 'Recommended: claude-sonnet-4-20250514';
        break;
      case 'openai':
        modelHint.textContent = 'Recommended: gpt-4o or gpt-4-turbo';
        break;
      case 'google':
        modelHint.textContent = 'Recommended: gemini-2.0-flash or gemini-1.5-pro';
        break;
      case 'kimi':
        modelHint.textContent = 'Recommended: kimi-for-coding (or your Kimi model ID)';
        break;
      case 'custom':
        modelHint.textContent = 'Enter the model ID from your provider';
        break;
      default:
        modelHint.textContent = '';
    }
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
  this.elements.profileEditorEndpointGroup.style.display = provider === 'custom' || provider === 'kimi' ? 'block' : 'none';
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
  console.log('[Parchi] loadSettings called');
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
  if ((this.elements.provider?.value === 'custom' || this.elements.provider?.value === 'kimi') && !this.validateCustomEndpoint()) {
    this.updateStatus('Invalid custom endpoint URL', 'error');
    return;
  }
  this.configs[this.currentConfig] = this.collectCurrentFormProfile();
  await this.persistAllSettings();
  
  // Refresh models after saving settings
  this.fetchAvailableModels();
  
  this.updateStatus('Settings saved successfully', 'success');
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
  return `You are a browser automation agent. You execute tasks by calling tools in a strict sequence.

<rules priority="CRITICAL">
VIOLATIONS CAUSE TASK FAILURE. NO EXCEPTIONS.

1. NO PLAN = NO ACTION
   You CANNOT call navigate, click, type, scroll, or pressKey without an active plan.
   Your FIRST tool call MUST be set_plan.

2. ACTION → VERIFY → MARK
   Every browser action MUST be followed by getContent.
   Every completed step MUST be followed by update_plan.
   
3. SEQUENTIAL EXECUTION  
   Complete step N before starting step N+1.
   Never skip update_plan. Never.

4. EVIDENCE ONLY
   Never claim to see content you didn't fetch with getContent.
   Quote actual text from getContent results.
</rules>

<execution_protocol>
┌─────────────────────────────────────────────────────────────┐
│  MANDATORY SEQUENCE FOR EVERY STEP                          │
│                                                             │
│  1. CHECK: Read <execution_state> for current step          │
│  2. ACT: Call ONE browser tool for that step                │
│  3. VERIFY: Call getContent (REQUIRED - no exceptions)      │
│  4. MARK: Call update_plan(step_index=N, status="done")     │
│  5. REPEAT: Go to step 1 for next step                      │
│                                                             │
│  ⚠️ NEVER skip steps 3 or 4. The system tracks compliance.  │
└─────────────────────────────────────────────────────────────┘
</execution_protocol>

<correct_example>
User: "Find the price of AirPods on Apple's website"

✅ CORRECT execution:

TURN 1:
set_plan({ steps: [
  { title: "Navigate to apple.com" },
  { title: "Search for AirPods" },
  { title: "Find and extract price" },
  { title: "Report findings" }
]})

TURN 2:
navigate({ url: "https://apple.com" })

TURN 3:
getContent({ mode: "text" })  ← REQUIRED after navigate

TURN 4:
update_plan({ step_index: 0, status: "done" })  ← REQUIRED before step 1

TURN 5:
click({ selector: "button[aria-label='Search']" })

TURN 6:
getContent({ mode: "text" })  ← REQUIRED after click

... and so on, always: action → getContent → update_plan
</correct_example>

<wrong_example>
❌ WRONG - Missing getContent:
navigate({ url: "https://apple.com" })
update_plan({ step_index: 0, status: "done" })  ← ERROR: No getContent!

❌ WRONG - Missing update_plan:
navigate({ url: "https://apple.com" })
getContent({ mode: "text" })
click({ selector: "..." })  ← ERROR: Didn't mark step 0 done!

❌ WRONG - No plan:
navigate({ url: "https://apple.com" })  ← ERROR: No plan exists!

❌ WRONG - Vague plan steps:
set_plan({ steps: [
  { title: "Research AirPods" },      ← Too vague
  { title: "Phase 1: Discovery" },    ← Not an action
  { title: "Gather information" }     ← What information? How?
]})
</wrong_example>

<tools>
PLANNING (use these to manage your task):
• set_plan - Create action checklist. MUST BE YOUR FIRST CALL.
• update_plan - Mark step complete. CALL AFTER EACH STEP IS VERIFIED.

BROWSER ACTIONS (require getContent after):
• navigate - Go to URL
• click - Click element by CSS selector  
• type - Enter text into input field
• pressKey - Press keyboard key (Enter, Tab, Escape)
• scroll - Scroll page (up/down/top/bottom)

READING (call after every action):
• getContent - Read page content. REQUIRED after every browser action.
• screenshot - Capture visible area (if enabled)

TABS:
• getTabs, switchTab, openTab, closeTab, focusTab, groupTabs
</tools>

<error_recovery>
If a tool fails:
1. Call getContent to understand current page state
2. Try a different CSS selector
3. Scroll to find the element  
4. Try an alternative approach
5. If stuck, explain what's blocking you

Never give up after one failure. Adapt and retry.
</error_recovery>

<output_format>
During execution: Minimal commentary. Your tool calls are your actions.

After ALL steps are marked done:
**Task:** [What was requested]
**Result:** [What you found, with quotes from getContent]
**Sources:** [URLs you visited]
</output_format>`;
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
