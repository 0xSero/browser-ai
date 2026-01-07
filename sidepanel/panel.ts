import { createMessage, normalizeConversationHistory } from '../ai/message-schema.js';
import type { Message } from '../ai/message-schema.js';
import { AccountClient } from './account-client.js';

type AuthState = {
  status: 'signed_out' | 'device_code' | 'signed_in';
  code?: string;
  deviceCode?: string;
  verificationUrl?: string;
  accessToken?: string;
  email?: string;
  expiresAt?: number;
};

type Entitlement = {
  active: boolean;
  plan: string;
  renewsAt?: string;
  status?: string;
};

type BillingOverview = {
  entitlement?: Entitlement;
  paymentMethod?: {
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
  } | null;
  invoices?: Array<{
    id?: string;
    status?: string;
    amountDue?: number;
    currency?: string;
    hostedInvoiceUrl?: string;
    createdAt?: string;
    periodEnd?: string;
  }>;
};

// Side Panel UI Controller
class SidePanelUI {
  elements: Record<string, any>;
  conversationHistory: Message[];
  sessionId: string;
  sessionStartedAt: number;
  firstUserMessage: string;
  currentConfig: string;
  configs: Record<string, any>;
  toolCallViews: Map<string, any>;
  timelineItems: Map<string, any>;
  selectedTabs: Map<number, any>;
  tabGroupInfo: Map<number, chrome.tabGroups.TabGroup>;
  scrollPositions: Map<string, number>;
  pendingToolCount: number;
  isStreaming: boolean;
  streamingState: { container: HTMLElement; textEl: HTMLElement | null; thinking?: string | null } | null;
  userScrolledUp: boolean;
  isNearBottom: boolean;
  chatResizeObserver: ResizeObserver | null;
  contextUsage: { approxTokens: number; maxContextTokens: number; percent: number };
  sessionTokensUsed: number;
  auxAgentProfiles: string[];
  currentView: 'chat' | 'history';
  currentSettingsTab: 'general' | 'profiles';
  profileEditorTarget: string;
  authState: AuthState;
  entitlement: Entitlement;
  billingOverview: BillingOverview | null;
  accessPanelVisible: boolean;
  settingsOpen: boolean;
  accountClient: AccountClient;
  subagents: Map<string, { name: string; status: string; messages: any[]; tasks?: string[] }>;
  activeAgent: string;

  constructor() {
    this.elements = {
      settingsBtn: document.getElementById('settingsBtn'),
      accountBtn: document.getElementById('accountBtn'),
      settingsPanel: document.getElementById('settingsPanel'),
      chatInterface: document.getElementById('chatInterface'),
      accessPanel: document.getElementById('accessPanel'),
      authPanel: document.getElementById('authPanel'),
      billingPanel: document.getElementById('billingPanel'),
      accountPanel: document.getElementById('accountPanel'),
      authSubtitle: document.getElementById('authSubtitle'),
      accessConfigPrompt: document.getElementById('accessConfigPrompt'),
      authStartBtn: document.getElementById('authStartBtn'),
      authVerifyBtn: document.getElementById('authVerifyBtn'),
      authCopyBtn: document.getElementById('authCopyBtn'),
      authOpenBtn: document.getElementById('authOpenBtn'),
      authOpenSettingsBtn: document.getElementById('authOpenSettingsBtn'),
      authCodeValue: document.getElementById('authCodeValue'),
      authCodeWrap: document.getElementById('authCodeWrap'),
      billingStartBtn: document.getElementById('billingStartBtn'),
      billingManageBtn: document.getElementById('billingManageBtn'),
      authLogoutBtn: document.getElementById('authLogoutBtn'),
      accountGreeting: document.getElementById('accountGreeting'),
      accountSubtext: document.getElementById('accountSubtext'),
      accountRefreshBtn: document.getElementById('accountRefreshBtn'),
      accountPlanStatus: document.getElementById('accountPlanStatus'),
      accountPlanBadge: document.getElementById('accountPlanBadge'),
      accountPlanDetails: document.getElementById('accountPlanDetails'),
      accountCheckoutBtn: document.getElementById('accountCheckoutBtn'),
      accountPortalBtn: document.getElementById('accountPortalBtn'),
      accountBillingSummary: document.getElementById('accountBillingSummary'),
      accountInvoices: document.getElementById('accountInvoices'),
      accountSettingsSummary: document.getElementById('accountSettingsSummary'),
      accountConfigs: document.getElementById('accountConfigs'),
      accountHistory: document.getElementById('accountHistory'),
      accountOpenSettingsBtn: document.getElementById('accountOpenSettingsBtn'),
      accountOpenProfilesBtn: document.getElementById('accountOpenProfilesBtn'),
      accountOpenHistoryBtn: document.getElementById('accountOpenHistoryBtn'),
      accountLogoutBtn: document.getElementById('accountLogoutBtn'),
      planStatus: document.getElementById('planStatus'),
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
      composer: document.getElementById('composer'),
      userInput: document.getElementById('userInput'),
      fileBtn: document.getElementById('fileBtn'),
      fileInput: document.getElementById('fileInput'),
      sendBtn: document.getElementById('sendBtn'),
      statusBar: document.getElementById('statusBar'),
      statusText: document.getElementById('statusText'),
      statusMeta: document.getElementById('statusMeta'),
      agentNav: document.getElementById('agentNav'),
      tabSelectorBtn: document.getElementById('tabSelectorBtn'),
      tabSelector: document.getElementById('tabSelector'),
      tabList: document.getElementById('tabList'),
      closeTabSelector: document.getElementById('closeTabSelector'),
      selectedTabsBar: document.getElementById('selectedTabsBar'),
      scrollToLatestBtn: document.getElementById('scrollToLatestBtn'),
      viewChatBtn: document.getElementById('viewChatBtn'),
      viewHistoryBtn: document.getElementById('viewHistoryBtn'),
      historyPanel: document.getElementById('historyPanel'),
      historyItems: document.getElementById('historyItems'),
      startNewSessionBtn: document.getElementById('startNewSessionBtn'),
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
      saveProfileBtn: document.getElementById('saveProfileBtn'),
      permissionRead: document.getElementById('permissionRead'),
      permissionInteract: document.getElementById('permissionInteract'),
      permissionNavigate: document.getElementById('permissionNavigate'),
      permissionTabs: document.getElementById('permissionTabs'),
      permissionScreenshots: document.getElementById('permissionScreenshots'),
      allowedDomains: document.getElementById('allowedDomains'),
      accountSettingsSection: document.getElementById('accountSettingsSection'),
      accountApiBaseGroup: document.getElementById('accountApiBaseGroup'),
      accountApiBase: document.getElementById('accountApiBase'),
      exportSettingsBtn: document.getElementById('exportSettingsBtn'),
      importSettingsBtn: document.getElementById('importSettingsBtn'),
      importSettingsInput: document.getElementById('importSettingsInput'),
      accessStatus: document.getElementById('accessStatus')
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
    this.tabGroupInfo = new Map();
    this.scrollPositions = new Map();
    this.pendingToolCount = 0;
    this.isStreaming = false;
    this.streamingState = null;
    this.userScrolledUp = false;
    this.isNearBottom = true;
    this.chatResizeObserver = null;
    this.contextUsage = { approxTokens: 0, maxContextTokens: 196000, percent: 0 };
    this.sessionTokensUsed = 0; // Track highest context seen in session
    this.auxAgentProfiles = [];
    this.currentView = 'chat';
    this.currentSettingsTab = 'general';
    this.profileEditorTarget = 'default';
    this.authState = { status: 'signed_out' };
    this.entitlement = { active: false, plan: 'none' };
    this.billingOverview = null;
    this.accessPanelVisible = false;
    this.settingsOpen = false;
    this.accountClient = new AccountClient({
      baseUrl: '',
      getAuthToken: () => this.authState?.accessToken || ''
    });
    // Subagent tracking
    this.subagents = new Map(); // id -> { name, status, messages }
    this.activeAgent = 'main';
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupResizeObserver();
    await this.loadSettings();
    await this.loadHistoryList();
    await this.loadAccessState();
    if (this.isAccessReady()) {
      this.updateStatus('Ready', 'success');
    }
  }

  setupEventListeners() {
    // Settings toggle
    this.elements.settingsBtn.addEventListener('click', () => {
      this.toggleSettings();
    });

    this.elements.accountBtn?.addEventListener('click', () => {
      this.toggleAccessPanel();
    });

    this.elements.authStartBtn?.addEventListener('click', () => this.startAuthFlow());
    this.elements.authVerifyBtn?.addEventListener('click', () => this.verifyAuthFlow());
    this.elements.authCopyBtn?.addEventListener('click', () => this.copyAuthCode());
    this.elements.authOpenBtn?.addEventListener('click', () => this.openAuthPage());
    this.elements.authOpenSettingsBtn?.addEventListener('click', () => this.openAccountSettings({ focusAccountApi: true }));
    this.elements.billingStartBtn?.addEventListener('click', () => this.startSubscription());
    this.elements.billingManageBtn?.addEventListener('click', () => this.manageBilling());
    this.elements.authLogoutBtn?.addEventListener('click', () => this.signOut());
    this.elements.accountRefreshBtn?.addEventListener('click', () => this.refreshAccountData());
    this.elements.accountCheckoutBtn?.addEventListener('click', () => this.startSubscription());
    this.elements.accountPortalBtn?.addEventListener('click', () => this.manageBilling());
    this.elements.accountOpenSettingsBtn?.addEventListener('click', () => this.openSettingsFromAccount());
    this.elements.accountOpenProfilesBtn?.addEventListener('click', () => this.openProfilesFromAccount());
    this.elements.accountOpenHistoryBtn?.addEventListener('click', () => this.openHistoryFromAccount());
    this.elements.accountLogoutBtn?.addEventListener('click', () => this.signOut());

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

    this.elements.exportSettingsBtn?.addEventListener('click', () => this.exportSettings());
    this.elements.importSettingsBtn?.addEventListener('click', () => {
      this.elements.importSettingsInput?.click();
    });
    this.elements.importSettingsInput?.addEventListener('change', (event) => this.importSettings(event));

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

    this.elements.chatMessages?.addEventListener('scroll', () => this.handleChatScroll());
    this.elements.scrollToLatestBtn?.addEventListener('click', () => this.scrollToBottom({ force: true }));

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
        } else {
          this.pendingToolCount = Math.max(0, this.pendingToolCount - 1);
          this.updateActivityState();
        }
        this.displayToolExecution(message.tool, message.args, message.result, message.id);
      } else if (message.type === 'assistant_response') {
        this.displayAssistantMessage(message.content, message.thinking);
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
      } else if (message.type === 'subagent_start') {
        this.addSubagent(message.id, message.name, message.tasks);
        this.updateStatus(`Sub-agent "${message.name}" started`, 'active');
      } else if (message.type === 'subagent_complete') {
        this.updateSubagentStatus(message.id, message.success ? 'completed' : 'error');
      } else if (message.type === 'assistant_stream') {
        this.handleAssistantStream(message);
      }
    });
  }

  setupResizeObserver() {
    if (!this.elements.chatMessages || typeof ResizeObserver === 'undefined') return;
    this.chatResizeObserver = new ResizeObserver(() => {
      if (this.shouldAutoScroll() && this.isNearBottom) {
        this.scrollToBottom();
      }
    });
    this.chatResizeObserver.observe(this.elements.chatMessages);
  }

  toggleSettings() {
    this.elements.settingsPanel.classList.toggle('hidden');
    const isOpen = !this.elements.settingsPanel.classList.contains('hidden');
    this.settingsOpen = isOpen;
    if (isOpen) {
      this.elements.accessPanel?.classList.add('hidden');
      this.elements.chatInterface?.classList.add('hidden');
      this.elements.historyPanel?.classList.add('hidden');
      this.switchSettingsTab(this.currentSettingsTab || 'general');
      return;
    }
    this.updateAccessUI();
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

  switchSettingsTab(tabName: 'general' | 'profiles' = 'general') {
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
      'toolPermissions',
      'allowedDomains',
      'activeConfig',
      'configs',
      'auxAgentProfiles',
      'accountApiBase'
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
    this.elements.autoScroll.value = settings.autoScroll !== undefined ? String(settings.autoScroll) : 'true';
    this.elements.confirmActions.value = settings.confirmActions !== undefined ? String(settings.confirmActions) : 'true';
    this.elements.saveHistory.value = settings.saveHistory !== undefined ? String(settings.saveHistory) : 'true';

    const defaultPermissions = {
      read: true,
      interact: true,
      navigate: true,
      tabs: true,
      screenshots: false
    };
    const toolPermissions = { ...defaultPermissions, ...(settings.toolPermissions || {}) };
    if (this.elements.permissionRead) this.elements.permissionRead.value = String(toolPermissions.read);
    if (this.elements.permissionInteract) this.elements.permissionInteract.value = String(toolPermissions.interact);
    if (this.elements.permissionNavigate) this.elements.permissionNavigate.value = String(toolPermissions.navigate);
    if (this.elements.permissionTabs) this.elements.permissionTabs.value = String(toolPermissions.tabs);
    if (this.elements.permissionScreenshots) this.elements.permissionScreenshots.value = String(toolPermissions.screenshots);
    if (this.elements.allowedDomains) this.elements.allowedDomains.value = settings.allowedDomains || '';
    if (this.elements.accountApiBase) {
      this.elements.accountApiBase.value = settings.accountApiBase || '';
    }
    this.accountClient.setBaseUrl(settings.accountApiBase || '');
    this.updateAccessConfigPrompt();

    this.refreshConfigDropdown();
    this.setActiveConfig(this.currentConfig, true);
    this.toggleCustomEndpoint();
    this.updateScreenshotToggleState();
    this.editProfile(this.currentConfig, true);
  }

  async loadAccessState() {
    const { authState, entitlement } = await chrome.storage.local.get(['authState', 'entitlement']);
    this.authState = this.normalizeAuthState(authState);
    this.entitlement = this.normalizeEntitlement(entitlement);
    this.updateAccessUI();
    if (this.authState?.status === 'signed_in' && this.authState?.accessToken) {
      await this.refreshAccountData({ silent: true });
    }
  }

  normalizeAuthState(state: Record<string, any> | null | undefined): AuthState {
    const normalized: AuthState = { status: 'signed_out' };
    if (!state || typeof state !== 'object') return normalized;
    const status: AuthState['status'] = (state.status === 'signed_out' || state.status === 'device_code' || state.status === 'signed_in')
      ? state.status
      : 'signed_out';
    normalized.status = status;
    if (state.code) normalized.code = String(state.code);
    if (state.deviceCode) normalized.deviceCode = String(state.deviceCode);
    if (state.verificationUrl) normalized.verificationUrl = String(state.verificationUrl);
    if (state.accessToken) normalized.accessToken = String(state.accessToken);
    if (state.email) normalized.email = String(state.email);
    if (state.expiresAt) normalized.expiresAt = Number(state.expiresAt);
    return normalized;
  }

  normalizeEntitlement(state) {
    if (!state || typeof state !== 'object') {
      return { active: false, plan: 'none' };
    }
    return {
      active: Boolean(state.active),
      plan: state.plan ? String(state.plan) : 'none',
      renewsAt: state.renewsAt ? String(state.renewsAt) : '',
      status: state.status ? String(state.status) : ''
    };
  }

  async persistAccessState() {
    await chrome.storage.local.set({
      authState: this.authState,
      entitlement: this.entitlement
    });
  }

  getAccessState() {
    if (!this.authState || this.authState.status !== 'signed_in') return 'auth';
    if (!this.entitlement || !this.entitlement.active) return 'billing';
    return 'ready';
  }

  isAccessReady() {
    return this.getAccessState() === 'ready';
  }

  updateAccessUI() {
    const state = this.getAccessState();
    this.updateAccessConfigPrompt();
    const showAccess = this.accessPanelVisible || state !== 'ready';
    const showAccount = this.accessPanelVisible && state !== 'auth';
    const showBilling = state === 'billing' && !showAccount;
    const showAuth = state === 'auth';

    if (this.elements.accessPanel) {
      this.elements.accessPanel.classList.toggle('hidden', !showAccess);
    }
    if (this.elements.authPanel) {
      this.elements.authPanel.classList.toggle('hidden', !showAuth);
    }
    if (this.elements.billingPanel) {
      this.elements.billingPanel.classList.toggle('hidden', !showBilling);
    }
    if (this.elements.accountPanel) {
      this.elements.accountPanel.classList.toggle('hidden', !showAccount);
      if (showAccount) {
        this.renderAccountPanel();
      }
    }

    if (this.elements.authCodeWrap) {
      this.elements.authCodeWrap.classList.toggle('hidden', !this.authState?.code);
    }
    if (this.elements.authCodeValue) {
      this.elements.authCodeValue.textContent = this.authState?.code || '----';
    }
    if (this.elements.authOpenBtn) {
      const canOpenAccount = Boolean(this.authState?.verificationUrl || this.accountClient?.baseUrl);
      this.elements.authOpenBtn.disabled = !canOpenAccount;
    }
    if (this.elements.planStatus) {
      this.elements.planStatus.textContent = this.entitlement?.active
        ? `Active${this.entitlement.renewsAt ? ` · Renews ${new Date(this.entitlement.renewsAt).toLocaleDateString()}` : ''}`
        : 'No active plan';
    }

    if (this.elements.accountBtn) {
      const label = state === 'auth'
        ? 'Signed out'
        : (this.authState?.email || 'Signed in');
      this.elements.accountBtn.textContent = label;
    }

    if (this.settingsOpen) {
      this.elements.accessPanel?.classList.add('hidden');
      return;
    }

    const locked = showAccess;
    if (this.elements.viewChatBtn) this.elements.viewChatBtn.disabled = locked;
    if (this.elements.viewHistoryBtn) this.elements.viewHistoryBtn.disabled = locked;
    if (this.elements.startNewSessionBtn) this.elements.startNewSessionBtn.disabled = locked;
    if (this.elements.sendBtn) this.elements.sendBtn.disabled = locked;
    if (this.elements.userInput) this.elements.userInput.disabled = locked;

    if (showAccess) {
      this.elements.chatInterface?.classList.add('hidden');
      this.elements.historyPanel?.classList.add('hidden');
      if (state !== 'ready') {
        this.updateStatus(state === 'auth' ? 'Sign in required' : 'Subscription required', 'warning');
      }
    } else {
      this.switchView(this.currentView || 'chat');
    }
  }

  updateAccessConfigPrompt() {
    const apiConfigured = Boolean(this.accountClient?.baseUrl);
    if (this.elements.accessConfigPrompt) {
      this.elements.accessConfigPrompt.classList.toggle('hidden', apiConfigured);
    }
    if (this.elements.authSubtitle) {
      this.elements.authSubtitle.textContent = apiConfigured
        ? 'Link this browser with a one-time device code to start using Parchi.'
        : 'Set the account API base URL in Settings before starting device sign-in.';
    }
  }

  toggleAccessPanel() {
    this.accessPanelVisible = !this.accessPanelVisible;
    this.updateAccessUI();
  }

  openExternalUrl(url) {
    if (!url) return;
    chrome.tabs.create({ url });
  }

  openAuthPage() {
    const fallbackUrl = this.accountClient?.baseUrl ? `${this.accountClient.baseUrl}/portal` : '';
    const url = this.authState?.verificationUrl || fallbackUrl;
    if (!url) {
      this.setAccessStatus('Set the account API base URL in Settings to open the account page.', 'warning');
      this.updateStatus('No account page available yet.', 'warning');
      this.openAccountSettings({ focusAccountApi: true });
      return;
    }
    this.openExternalUrl(url);
  }

  async refreshAccountData({ silent = false } = {}) {
    if (!this.authState || this.authState.status !== 'signed_in') return;
    try {
      const [account, billing] = await Promise.all([
        this.accountClient.getAccount(),
        this.accountClient.getBillingOverview()
      ]);
      if (account?.user?.email) {
        this.authState.email = account.user.email;
      }
      if (billing?.entitlement) {
        this.entitlement = this.normalizeEntitlement(billing.entitlement);
      }
      this.billingOverview = billing || null;
      await this.persistAccessState();
      this.updateAccessUI();
      if (!silent) {
        this.updateStatus('Account synced', 'success');
      }
    } catch (error) {
      const message = error?.message || 'Unable to refresh account';
      if (message.includes('Session expired') || message.includes('Missing access token')) {
        await this.signOut();
        if (!silent) {
          this.updateStatus('Session expired. Please sign in again.', 'warning');
        }
        return;
      }
      if (!silent) {
        this.updateStatus(message, 'error');
      }
    }
  }

  openSettingsFromAccount() {
    this.openAccountSettings();
  }

  openAccountSettings({ focusAccountApi = false } = {}) {
    this.accessPanelVisible = false;
    this.updateAccessUI();
    if (this.elements.settingsPanel?.classList.contains('hidden')) {
      this.toggleSettings();
    }
    this.switchSettingsTab('general');
    const accountSection = this.elements.accountSettingsSection;
    if (accountSection && accountSection instanceof HTMLDetailsElement) {
      accountSection.open = true;
    }
    if (focusAccountApi) {
      this.focusAccountApiBase();
    }
  }

  focusAccountApiBase() {
    const group = this.elements.accountApiBaseGroup;
    const input = this.elements.accountApiBase;
    if (!input) return;
    requestAnimationFrame(() => {
      if (group?.classList) {
        group.classList.add('highlight');
        window.setTimeout(() => group.classList.remove('highlight'), 1600);
      }
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  openProfilesFromAccount() {
    this.accessPanelVisible = false;
    this.updateAccessUI();
    if (this.elements.settingsPanel?.classList.contains('hidden')) {
      this.toggleSettings();
    }
    this.switchSettingsTab('profiles');
  }

  openHistoryFromAccount() {
    this.accessPanelVisible = false;
    this.updateAccessUI();
    this.switchView('history');
  }

  generateDeviceCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
      if (i === 3) code += '-';
    }
    return code;
  }

  async startAuthFlow() {
    if (!this.ensureAccountApiBase()) return;
    this.setAccessStatus('');
    try {
      const response = await this.accountClient.startDeviceCode();
      const expiresIn = Number(response?.expiresIn || 600) * 1000;
      this.authState = {
        status: 'device_code',
        code: response?.userCode || response?.code || this.generateDeviceCode(),
        deviceCode: response?.deviceCode || '',
        verificationUrl: response?.verificationUrl || '',
        expiresAt: Date.now() + (expiresIn || 10 * 60 * 1000)
      };
      await this.persistAccessState();
      this.updateAccessUI();
      this.updateStatus('Use the device code to sign in', 'active');
      this.setAccessStatus('Device code ready. Confirm on the account page.', 'success');
      if (this.authState.verificationUrl) {
        this.openExternalUrl(this.authState.verificationUrl);
      }
    } catch (error) {
      this.setAccessStatus(error.message || 'Unable to start sign-in', 'error');
      this.updateStatus(error.message || 'Unable to start sign-in', 'error');
    }
  }

  async verifyAuthFlow() {
    if (!this.ensureAccountApiBase()) return;
    if (!this.authState?.deviceCode) {
      this.setAccessStatus('Generate a device code first.', 'warning');
      this.updateStatus('Generate a device code first.', 'warning');
      return;
    }
    try {
      const response = await this.accountClient.verifyDeviceCode(this.authState.deviceCode);
      if (response?.status === 'pending') {
        this.setAccessStatus('Waiting for confirmation…', 'warning');
        this.updateStatus('Waiting for confirmation…', 'active');
        return;
      }
      const accessToken = response?.accessToken || response?.token;
      if (!accessToken) {
        this.setAccessStatus('Sign-in not confirmed yet.', 'warning');
        this.updateStatus('Sign-in not confirmed yet.', 'warning');
        return;
      }
      this.authState = {
        status: 'signed_in',
        accessToken,
        email: response?.user?.email || response?.email || this.authState?.email || 'Signed in'
      };
      this.entitlement = this.normalizeEntitlement(response?.entitlement || { active: false, plan: 'none' });
      await this.persistAccessState();
      await this.refreshAccountData({ silent: true });
      this.accessPanelVisible = true;
      this.updateAccessUI();
      this.setAccessStatus('');
      this.updateStatus('Signed in — subscription required', 'warning');
    } catch (error) {
      this.setAccessStatus(error.message || 'Unable to verify sign-in', 'error');
      this.updateStatus(error.message || 'Unable to verify sign-in', 'error');
    }
  }

  async copyAuthCode() {
    const code = this.authState?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.updateStatus('Code copied to clipboard', 'success');
    } catch (error) {
      this.updateStatus('Unable to copy code', 'error');
    }
  }

  async startSubscription() {
    if (!this.ensureAccountApiBase()) return;
    if (!this.authState || this.authState.status !== 'signed_in') {
      this.setAccessStatus('Sign in required before subscribing.', 'warning');
      this.updateStatus('Sign in required before subscribing', 'warning');
      return;
    }
    try {
      const response = await this.accountClient.createCheckout();
      if (response?.url) {
        this.openExternalUrl(response.url);
        this.setAccessStatus('Checkout opened in a new tab.', 'success');
        this.updateStatus('Checkout opened in a new tab', 'active');
      } else {
        this.setAccessStatus('Checkout link unavailable.', 'warning');
        this.updateStatus('Checkout link unavailable', 'warning');
      }
    } catch (error) {
      this.setAccessStatus(error.message || 'Unable to start subscription', 'error');
      this.updateStatus(error.message || 'Unable to start subscription', 'error');
    }
  }

  manageBilling() {
    if (!this.ensureAccountApiBase()) return;
    if (!this.authState || this.authState.status !== 'signed_in') {
      this.setAccessStatus('Sign in required before opening billing.', 'warning');
      this.updateStatus('Sign in required before opening billing', 'warning');
      return;
    }
    this.accountClient.createPortal()
      .then(response => {
        if (response?.url) {
          this.openExternalUrl(response.url);
          this.setAccessStatus('Billing portal opened in a new tab.', 'success');
          this.updateStatus('Billing portal opened in a new tab', 'success');
        } else {
          this.setAccessStatus('Billing portal unavailable.', 'warning');
          this.updateStatus('Billing portal unavailable', 'warning');
        }
      })
      .catch(error => {
        this.setAccessStatus(error.message || 'Unable to open billing portal', 'error');
        this.updateStatus(error.message || 'Unable to open billing portal', 'error');
      });
  }

  ensureAccountApiBase() {
    if (this.accountClient?.baseUrl) return true;
    this.setAccessStatus('Open Settings → Account & billing and add the account API base URL.', 'warning');
    this.updateStatus('Account API base URL is not configured', 'warning');
    this.openAccountSettings({ focusAccountApi: true });
    return false;
  }

  setAccessStatus(message: string, tone: 'success' | 'warning' | 'error' | '' = '') {
    const statusEl = this.elements.accessStatus;
    if (!statusEl) return;
    if (!message) {
      statusEl.textContent = '';
      statusEl.className = 'access-status hidden';
      return;
    }
    statusEl.textContent = message;
    statusEl.className = `access-status ${tone}`.trim();
  }

  async signOut() {
    this.authState = { status: 'signed_out' };
    this.entitlement = { active: false, plan: 'none' };
    this.billingOverview = null;
    await this.persistAccessState();
    this.accessPanelVisible = true;
    this.updateAccessUI();
    this.setAccessStatus('Signed out.', 'warning');
    this.updateStatus('Signed out', 'warning');
  }

  formatCurrency(amount, currency = 'usd') {
    if (amount === null || amount === undefined) return '';
    const value = Number(amount) / 100;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase()
      }).format(value);
    } catch (error) {
      return `${value.toFixed(2)} ${currency.toUpperCase()}`;
    }
  }

  formatShortDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString();
  }

  renderAccountPanel() {
    const email = this.authState?.email;
    if (this.elements.accountGreeting) {
      this.elements.accountGreeting.textContent = email ? `Welcome back, ${email}` : 'Welcome back';
    }

    const apiConfigured = Boolean(this.accountClient?.baseUrl);
    const signedIn = this.authState?.status === 'signed_in';

    if (this.elements.accountSubtext) {
      this.elements.accountSubtext.textContent = apiConfigured
        ? 'Manage your subscription, billing, and workspace settings.'
        : 'Set the account API base URL in settings to enable billing.';
    }

    if (this.elements.accountRefreshBtn) {
      this.elements.accountRefreshBtn.disabled = !signedIn || !apiConfigured;
    }

    const planLabel = this.entitlement?.active ? (this.entitlement?.plan || 'Active') : 'No plan';
    if (this.elements.accountPlanBadge) {
      this.elements.accountPlanBadge.textContent = planLabel;
    }
    if (this.elements.accountPlanStatus) {
      const renewsAt = this.entitlement?.renewsAt ? ` · Renews ${this.formatShortDate(this.entitlement.renewsAt)}` : '';
      this.elements.accountPlanStatus.textContent = this.entitlement?.active
        ? `Active${renewsAt}`
        : 'No active plan';
    }

    if (this.elements.accountPlanDetails) {
      if (!apiConfigured) {
        this.elements.accountPlanDetails.textContent = 'Connect billing to activate a subscription.';
      } else if (this.entitlement?.active) {
        this.elements.accountPlanDetails.textContent = `Plan: ${this.entitlement.plan || 'Pro'} · Status: ${this.entitlement.status || 'active'}`;
      } else {
        this.elements.accountPlanDetails.textContent = 'No subscription on this device yet.';
      }
    }

    const billing = this.billingOverview || {};
    const payment = billing?.paymentMethod;
    if (this.elements.accountBillingSummary) {
      if (payment?.brand && payment?.last4) {
        const exp = payment?.expMonth ? ` · exp ${payment.expMonth}/${payment.expYear}` : '';
        this.elements.accountBillingSummary.textContent = `${payment.brand.toUpperCase()} •••• ${payment.last4}${exp}`;
      } else if (!apiConfigured) {
        this.elements.accountBillingSummary.textContent = 'Billing data unavailable until the account API is configured.';
      } else {
        this.elements.accountBillingSummary.textContent = 'No payment method on file yet.';
      }
    }
    if (this.elements.accountInvoices) {
      const invoices = Array.isArray(billing?.invoices) ? billing.invoices : [];
      this.elements.accountInvoices.innerHTML = '';
      if (!invoices.length) {
        this.elements.accountInvoices.innerHTML = '<div class="account-list-item"><span class="muted">No invoices yet.</span></div>';
      } else {
        invoices.slice(0, 4).forEach(invoice => {
          const item = document.createElement('div');
          item.className = 'account-list-item';
          const amount = this.formatCurrency(invoice.amountDue, invoice.currency);
          const date = this.formatShortDate(invoice.periodEnd || invoice.createdAt);
          const link = invoice.hostedInvoiceUrl;
          item.innerHTML = link
            ? `<a href="${this.escapeAttribute(link)}" target="_blank" rel="noopener noreferrer">${amount || 'Invoice'}</a><span class="muted">${this.escapeHtml(date || '')}</span>`
            : `<span>${this.escapeHtml(amount || 'Invoice')}</span><span class="muted">${this.escapeHtml(date || '')}</span>`;
          this.elements.accountInvoices.appendChild(item);
        });
      }
    }

    if (this.elements.accountCheckoutBtn) {
      this.elements.accountCheckoutBtn.disabled = !signedIn || !apiConfigured;
    }
    if (this.elements.accountPortalBtn) {
      this.elements.accountPortalBtn.disabled = !signedIn || !apiConfigured;
    }

    if (this.elements.accountSettingsSummary) {
      const profile = this.currentConfig || 'default';
      const stream = this.elements.streamResponses?.value === 'true' ? 'Streaming on' : 'Streaming off';
      const history = this.elements.saveHistory?.value === 'true' ? 'History saved' : 'History off';
      this.elements.accountSettingsSummary.textContent = `Profile: ${profile} · ${stream} · ${history}`;
    }

    if (this.elements.accountConfigs) {
      const configs = Object.entries(this.configs || {});
      this.elements.accountConfigs.innerHTML = '';
      if (!configs.length) {
        this.elements.accountConfigs.innerHTML = '<div class="account-list-item"><span class="muted">No profiles saved.</span></div>';
      } else {
        configs.slice(0, 4).forEach(([name, config]) => {
          const item = document.createElement('div');
          item.className = 'account-list-item';
          item.innerHTML = `
            <span>${this.escapeHtml(name)}</span>
            <span class="muted">${this.escapeHtml(config.provider || 'provider')} · ${this.escapeHtml(config.model || 'model')}</span>
          `;
          this.elements.accountConfigs.appendChild(item);
        });
      }
    }

    this.renderHistoryPreview();
  }

  async renderHistoryPreview() {
    if (!this.elements.accountHistory) return;
    const { chatSessions = [] } = await chrome.storage.local.get(['chatSessions']);
    this.elements.accountHistory.innerHTML = '';
    if (!chatSessions.length) {
      this.elements.accountHistory.innerHTML = '<div class="account-list-item"><span class="muted">No saved chats yet.</span></div>';
      return;
    }
    chatSessions.slice(0, 4).forEach(session => {
      const item = document.createElement('div');
      item.className = 'account-list-item';
      const date = new Date(session.updatedAt || session.startedAt || Date.now());
      item.innerHTML = `
        <span>${this.escapeHtml(session.title || 'Session')}</span>
        <span class="muted">${this.escapeHtml(date.toLocaleDateString())}</span>
      `;
      item.addEventListener('click', () => {
        this.openHistoryFromAccount();
        if (Array.isArray(session.transcript)) {
          this.recordScrollPosition();
          this.conversationHistory = normalizeConversationHistory(session.transcript || []);
          this.sessionId = session.id || `session-${Date.now()}`;
          this.firstUserMessage = session.title || '';
          this.renderConversationHistory();
          this.updateContextUsage();
        }
      });
      this.elements.accountHistory.appendChild(item);
    });
  }

  async saveSettings() {
    this.configs[this.currentConfig] = this.collectCurrentFormProfile();
    await this.persistAllSettings();
    this.toggleSettings();
  }

  async exportSettings() {
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
        'accountApiBase'
      ];
      const settings = await chrome.storage.local.get(keys);
      const payload = {
        ...settings,
        exportedAt: new Date().toISOString(),
        exportVersion: 1
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
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
  }

  async importSettings(event) {
    const input = event?.target;
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
        'accountApiBase'
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

  collectToolPermissions() {
    return {
      read: this.elements.permissionRead?.value === 'true',
      interact: this.elements.permissionInteract?.value === 'true',
      navigate: this.elements.permissionNavigate?.value === 'true',
      tabs: this.elements.permissionTabs?.value === 'true',
      screenshots: this.elements.permissionScreenshots?.value === 'true'
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
      toolPermissions: this.collectToolPermissions(),
      allowedDomains: this.elements.allowedDomains?.value || '',
      accountApiBase: this.elements.accountApiBase?.value?.trim() || '',
      auxAgentProfiles: this.auxAgentProfiles,
      activeConfig: this.currentConfig,
      configs: this.configs
    };
    await chrome.storage.local.set(payload);
    this.accountClient.setBaseUrl(payload.accountApiBase);
    this.updateAccessConfigPrompt();
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

  async createNewConfig(name?: string) {
    const trimmedName = (name || '').trim() || prompt('Enter profile name:') || '';
    if (!trimmedName) return;
    if (this.configs[trimmedName]) {
      alert('Profile already exists!');
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
    this.updateStatus(`Profile "${trimmedName}" created`, 'success');
  }

  async deleteConfig() {
    if (this.currentConfig === 'default') {
      alert('Cannot delete default profile');
      return;
    }

    if (confirm(`Delete profile "${this.currentConfig}"?`)) {
      delete this.configs[this.currentConfig];
      this.currentConfig = 'default';
      this.refreshConfigDropdown();
      this.setActiveConfig(this.currentConfig, true);
      this.updateStatus('Profile deleted', 'success');
    }
  }

  async switchConfig() {
    const newConfig = this.elements.activeConfig.value;
    if (!this.configs[newConfig]) {
      alert('Profile not found');
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

  populateFormFromConfig(config: Record<string, any> = {}) {
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
    if (!this.isAccessReady()) {
      this.updateAccessUI();
      this.updateStatus('Sign in required', 'warning');
      return;
    }

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
    const userEntry = createMessage({ role: 'user', content: fullMessage });
    if (userEntry) {
      this.conversationHistory.push(userEntry);
    }
    this.updateContextUsage();

    // Update status and input area
    this.updateStatus('Processing...', 'active');
    this.elements.composer?.classList.add('running');

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
      this.elements.composer?.classList.remove('running');
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
    this.scrollToBottom({ force: true });
  }

  deduplicateThinking(thinking: string | null) {
    if (!thinking) return '';

    // Split into lines and deduplicate consecutive identical lines
    const lines = thinking.split('\n');
    const deduplicated: string[] = [];
    let lastLine: string | null = null;
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

  displayAssistantMessage(content: string, thinking: string | null = null) {
    const streamResult = this.finishStreamingMessage();
    const streamedContainer = streamResult?.container;
    const combinedThinking = [streamResult?.thinking, thinking].filter(Boolean).join('\n\n') || null;

    if ((!content || content.trim() === '') && !combinedThinking) {
      if (streamedContainer) {
        streamedContainer.remove();
      }
      this.updateStatus('Ready', 'success');
      this.elements.composer?.classList.remove('running');
      this.pendingToolCount = 0;
      this.updateActivityState();
      return;
    }

    const parsed = this.extractThinking(content, combinedThinking);
    content = parsed.content;
    thinking = parsed.thinking;

    // If we are about to render a new message, remove the temporary streamed one
    if (streamedContainer) {
      streamedContainer.remove();
    }

    // Add to conversation history
    const assistantEntry = createMessage({ role: 'assistant', content });
    if (assistantEntry) {
      this.conversationHistory.push(assistantEntry);
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';

    let html = `<div class="message-header">Assistant</div>`;

    if (thinking && this.elements.showThinking.value === 'true') {
      const cleanedThinking = this.deduplicateThinking(thinking);
      html += `
        <div class="thinking-block">
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
        const block = thinkingHeader.closest('.thinking-block');
        block?.classList.toggle('collapsed');
      });
    }

    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
    this.updateStatus('Ready', 'success');
    this.elements.composer?.classList.remove('running');
    this.pendingToolCount = 0;
    this.updateActivityState();
    this.persistHistory();
  }

  renderMarkdown(text) {
    if (!text) return '';

    const escape = (value = '') => this.escapeHtmlBasic(value);
    const escapeAttr = (value = '') => this.escapeAttribute(value);

    let working = String(text).replace(/\r\n/g, '\n');
    const codeBlocks: string[] = [];
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
    const blocks: string[] = [];
    let paragraph: string[] = [];
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
    const container = this.streamingState?.container;

    if (container) {
      // Clean up indicators but don't remove the container yet
      const indicator = container.querySelector('.typing-indicator');
      if (indicator) indicator.remove();
      container.classList.remove('streaming');
    }
    this.streamingState = null;
    this.isStreaming = false;
    this.updateActivityState();

    // Return preserved thinking and container so caller can use/manage them
    return { thinking: streamingThinking, container };
  }

  displayToolExecution(toolName, args, result, toolCallId = null) {
    const entryId = toolCallId || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let entry = this.toolCallViews.get(entryId);

    if (!entry) {
      entry = this.createToolMessage(entryId, toolName, args);
      this.toolCallViews.set(entryId, entry);
      this.elements.chatMessages.appendChild(entry.container);
      this.scrollToBottom();
    }

    if (result !== null && result !== undefined) {
      this.updateToolMessage(entry, result);
      const isError = result && (result.error || result.success === false);
      if (isError) {
        this.showErrorBanner(`${toolName}: ${result.error || 'Tool execution failed'}`);
      }
    }
  }

  createToolMessage(entryId, toolName, args) {
    const container = document.createElement('div');
    container.className = 'message tool';
    container.dataset.id = entryId;
    const safeToolName = toolName || 'tool';
    const argsPreview = this.getArgsPreview(args);
    const argsText = this.truncateText(this.safeJsonStringify(args), 1600);

    const details = document.createElement('details');
    details.className = 'tool-event running';
    details.innerHTML = `
      <summary>
        <span class="tool-event-dot"></span>
        <span class="tool-event-name">${this.escapeHtml(safeToolName)}</span>
        <span class="tool-event-preview">${this.escapeHtml(argsPreview || 'No args')}</span>
        <span class="tool-event-status">Running</span>
      </summary>
      <div class="tool-event-body">
        <div class="tool-event-section">
          <div class="tool-event-label">Args</div>
          <pre class="tool-event-args-pre">${this.escapeHtml(argsText || 'No args')}</pre>
        </div>
        <div class="tool-event-section">
          <div class="tool-event-label">Result</div>
          <pre class="tool-event-result-pre">Waiting...</pre>
        </div>
      </div>
    `;

    container.appendChild(details);
    return {
      container,
      details,
      statusEl: details.querySelector('.tool-event-status'),
      resultEl: details.querySelector('.tool-event-result-pre'),
      previewEl: details.querySelector('.tool-event-preview')
    };
  }

  updateToolMessage(entry, result) {
    if (!entry?.details) return;
    const isError = result && (result.error || result.success === false);
    entry.details.classList.remove('running', 'success', 'error');
    entry.details.classList.add(isError ? 'error' : 'success');
    if (entry.statusEl) entry.statusEl.textContent = isError ? 'Error' : 'Done';

    if (entry.resultEl) {
      const resultText = this.truncateText(this.safeJsonStringify(result), 2000);
      entry.resultEl.textContent = resultText || (isError ? 'Tool failed' : 'Done');
    }

    if (entry.previewEl) {
      const preview = isError
        ? (result?.error || 'Tool failed')
        : (result?.message || result?.summary || '');
      if (preview) {
        entry.previewEl.textContent = this.truncateText(String(preview), 120);
      }
    }

    if (isError) {
      entry.details.open = true;
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

    const dismissButton = banner.querySelector('.error-dismiss');
    dismissButton?.addEventListener('click', () => banner.remove());

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
    const labels: string[] = [];
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

  scrollToBottom({ force = false } = {}) {
    if (!this.elements.chatMessages) return;
    if (!force && !this.shouldAutoScroll()) return;
    requestAnimationFrame(() => {
      this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
      this.isNearBottom = true;
      this.userScrolledUp = false;
      this.updateScrollButton();
    });
  }

  shouldAutoScroll() {
    const autoScrollEnabled = this.elements.autoScroll?.value !== 'false';
    return autoScrollEnabled && !this.userScrolledUp;
  }

  handleChatScroll() {
    if (!this.elements.chatMessages) return;
    const { scrollTop, scrollHeight, clientHeight } = this.elements.chatMessages;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 60;
    this.isNearBottom = nearBottom;
    this.userScrolledUp = !nearBottom;
    this.recordScrollPosition();
    this.updateScrollButton();
  }

  recordScrollPosition() {
    if (!this.elements.chatMessages) return;
    this.scrollPositions.set(this.sessionId, this.elements.chatMessages.scrollTop);
  }

  restoreScrollPosition() {
    if (!this.elements.chatMessages) return;
    const saved = this.scrollPositions.get(this.sessionId);
    if (saved !== undefined) {
      requestAnimationFrame(() => {
        this.elements.chatMessages.scrollTop = saved;
        this.handleChatScroll();
      });
    } else {
      this.scrollToBottom({ force: true });
    }
  }

  updateScrollButton() {
    if (!this.elements.scrollToLatestBtn) return;
    this.elements.scrollToLatestBtn.classList.toggle('hidden', !this.userScrolledUp);
  }

  safeJsonStringify(value) {
    try {
      if (value === undefined) return '';
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
  }

  truncateText(text, limit = 1200) {
    if (!text) return '';
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}...`;
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

  extractThinking(content: string | null | undefined, existingThinking: string | null = null) {
    let thinking: string | null = existingThinking || null;
    let cleanedContent = content || '';
    const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
    let match;
    const collected: string[] = [];
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

  updateContextUsage(actualTokens: number | null = null) {
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
          this.recordScrollPosition();
          this.conversationHistory = normalizeConversationHistory(session.transcript || []);
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
        const rawContent = typeof msg.content === 'string' ? msg.content : this.safeJsonStringify(msg.content);
        const parsed = this.extractThinking(rawContent, null);
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        let html = `<div class="message-header">Assistant</div>`;
        if (parsed.thinking && this.elements.showThinking.value === 'true') {
          html += `
            <div class="thinking-block">
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
            const block = thinkingHeader.closest('.thinking-block');
            block?.classList.toggle('collapsed');
          });
        }

        this.elements.chatMessages.appendChild(messageDiv);
      }
    });
    this.restoreScrollPosition();
  }

  switchView(view) {
    if (!this.isAccessReady()) {
      this.updateAccessUI();
      return;
    }
    this.currentView = view;
    if (!this.elements.chatInterface || !this.elements.historyPanel) return;
    if (view === 'history') {
      this.recordScrollPosition();
      this.elements.chatInterface.classList.add('hidden');
      this.elements.historyPanel.classList.remove('hidden');
      this.elements.viewHistoryBtn?.classList.add('active');
      this.elements.viewChatBtn?.classList.remove('active', 'live-active');
    } else {
      this.elements.chatInterface.classList.remove('hidden');
      this.elements.historyPanel.classList.add('hidden');
      this.elements.viewChatBtn?.classList.add('active', 'live-active');
      this.elements.viewHistoryBtn?.classList.remove('active');
      this.restoreScrollPosition();
    }
  }

  startNewSession() {
    if (!this.isAccessReady()) {
      this.updateAccessUI();
      return;
    }
    this.conversationHistory = [];
    this.sessionId = `session-${Date.now()}`;
    this.sessionStartedAt = Date.now();
    this.firstUserMessage = '';
    this.sessionTokensUsed = 0; // Reset context tracking
    this.subagents.clear(); // Clear subagents
    this.activeAgent = 'main';
    this.elements.chatMessages.innerHTML = '';
    this.timelineItems.clear();
    this.toolCallViews.clear();
    this.hideAgentNav();
    this.updateStatus('Ready for a new session', 'success');
    this.switchView('chat');
    this.updateContextUsage();
    this.scrollToBottom({ force: true });
  }

  // Subagent Management
  addSubagent(id, name, tasks) {
    this.subagents.set(id, {
      name: name || `Sub-${this.subagents.size + 1}`,
      tasks,
      status: 'running',
      messages: []
    });
    this.renderAgentNav();
  }

  updateSubagentStatus(id, status) {
    const agent = this.subagents.get(id);
    if (agent) {
      agent.status = status;
      this.renderAgentNav();
    }
  }

  renderAgentNav() {
    if (!this.elements.agentNav) return;

    // Show nav if we have subagents
    if (this.subagents.size === 0) {
      this.hideAgentNav();
      return;
    }

    this.elements.agentNav.classList.remove('hidden');

    // Build nav items
    let html = `
      <div class="agent-nav-item main-agent ${this.activeAgent === 'main' ? 'active' : ''}" data-agent="main">
        <span class="agent-status"></span>
        <span>Main</span>
      </div>
    `;

    this.subagents.forEach((agent, id) => {
      const statusClass = agent.status === 'running' ? 'running' : (agent.status === 'completed' ? 'completed' : 'error');
      html += `
        <div class="agent-nav-item sub-agent ${statusClass} ${this.activeAgent === id ? 'active' : ''}" data-agent="${id}">
          <span class="agent-status"></span>
          <span>${agent.name}</span>
        </div>
      `;
    });

    this.elements.agentNav.innerHTML = html;

    // Add click handlers
    this.elements.agentNav.querySelectorAll('.agent-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const agentId = item.dataset.agent;
        this.switchAgent(agentId);
      });
    });
  }

  switchAgent(agentId) {
    this.activeAgent = agentId;
    this.renderAgentNav();
    // Could filter messages by agent here if desired
  }

  hideAgentNav() {
    if (this.elements.agentNav) {
      this.elements.agentNav.classList.add('hidden');
    }
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

  async handleFileSelection(event: Event) {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    const files = Array.from(input.files || []) as File[];
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
    const [tabs, groups] = await Promise.all([
      chrome.tabs.query({}),
      chrome.tabGroups.query({})
    ]);
    this.tabGroupInfo = new Map(groups.map(group => [group.id, group]));
    this.elements.tabList.innerHTML = '';

    const groupedTabs = new Map<number, chrome.tabs.Tab[]>();
    const ungroupedTabs: chrome.tabs.Tab[] = [];

    tabs.filter(tab => typeof tab.id === 'number').forEach(tab => {
      if (tab.groupId !== undefined && tab.groupId >= 0) {
        if (!groupedTabs.has(tab.groupId)) groupedTabs.set(tab.groupId, []);
        const bucket = groupedTabs.get(tab.groupId);
        if (bucket) bucket.push(tab);
      } else {
        ungroupedTabs.push(tab);
      }
    });

    const renderGroup = (label: string, color: string, groupTabs: chrome.tabs.Tab[], groupId: string | number = 'ungrouped') => {
      if (!groupTabs.length) return;
      const section = document.createElement('div');
      section.className = 'tab-group';
      const allSelected = groupTabs.every(tab => typeof tab.id === 'number' && this.selectedTabs.has(tab.id));
      section.innerHTML = `
        <div class="tab-group-header" style="--group-color: ${color}">
          <div class="tab-group-label">${this.escapeHtml(label)}</div>
          <button class="tab-group-toggle" type="button">${allSelected ? 'Clear' : 'Add all'}</button>
        </div>
      `;

      const toggleBtn = section.querySelector('.tab-group-toggle');
      toggleBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        this.toggleGroupSelection(groupTabs, !allSelected);
      });

      groupTabs.forEach(tab => {
        const tabId = tab.id;
        const isSelected = typeof tabId === 'number' && this.selectedTabs.has(tabId);
        const item = document.createElement('div');
        item.className = `tab-item${isSelected ? ' selected' : ''}`;
        item.innerHTML = `
          <div class="tab-item-checkbox"></div>
          <img class="tab-item-favicon" src="${tab.favIconUrl || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27%23666%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%274%27/%3E%3C/svg%3E'}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27%23666%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%274%27/%3E%3C/svg%3E'">
          <span class="tab-item-title">${this.escapeHtml(tab.title || 'Untitled')}</span>
        `;
        item.addEventListener('click', () => this.toggleTabSelection(tab, item));
        section.appendChild(item);
      });

      this.elements.tabList.appendChild(section);
    };

    groupedTabs.forEach((groupTabs, groupId) => {
      const group = this.tabGroupInfo.get(groupId);
      const label = group?.title || `Group ${groupId}`;
      const color = this.mapGroupColor(group?.color);
      renderGroup(label, color, groupTabs, groupId);
    });

    renderGroup('Ungrouped', 'var(--text-tertiary)', ungroupedTabs);
  }

  toggleGroupSelection(groupTabs, shouldSelect) {
    groupTabs.forEach(tab => {
      if (typeof tab.id !== 'number') return;
      if (shouldSelect) {
        this.selectedTabs.set(tab.id, this.buildSelectedTab(tab));
      } else {
        this.selectedTabs.delete(tab.id);
      }
    });
    this.updateSelectedTabsBar();
    this.updateTabSelectorButton();
    this.loadTabs();
  }

  toggleTabSelection(tab, itemElement) {
    if (typeof tab.id !== 'number') return;
    if (this.selectedTabs.has(tab.id)) {
      this.selectedTabs.delete(tab.id);
      itemElement.classList.remove('selected');
    } else {
      this.selectedTabs.set(tab.id, this.buildSelectedTab(tab));
      itemElement.classList.add('selected');
    }
    this.updateSelectedTabsBar();
    this.updateTabSelectorButton();
    this.loadTabs();
  }

  buildSelectedTab(tab) {
    const group = this.tabGroupInfo.get(tab.groupId);
    const hasGroup = tab.groupId !== undefined && tab.groupId >= 0;
    return {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      windowId: tab.windowId,
      groupId: tab.groupId,
      groupTitle: hasGroup ? (group?.title || `Group ${tab.groupId}`) : 'Ungrouped',
      groupColor: hasGroup ? this.mapGroupColor(group?.color) : 'var(--text-tertiary)'
    };
  }

  updateSelectedTabsBar() {
    if (this.selectedTabs.size === 0) {
      this.elements.selectedTabsBar.classList.add('hidden');
      return;
    }

    this.elements.selectedTabsBar.classList.remove('hidden');
    this.elements.selectedTabsBar.innerHTML = '';
    const grouped = new Map<string, Array<any>>();
    this.selectedTabs.forEach(tab => {
      const key = tab.groupId && tab.groupId >= 0 ? `group-${tab.groupId}` : 'ungrouped';
      if (!grouped.has(key)) grouped.set(key, []);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(tab);
    });

    grouped.forEach(tabs => {
      const groupTitle = tabs[0]?.groupTitle || 'Ungrouped';
      const groupLabel = this.truncateText(groupTitle, 18) || 'Ungrouped';
      const groupColor = tabs[0]?.groupColor || 'var(--text-tertiary)';
      const groupWrap = document.createElement('div');
      groupWrap.className = 'selected-tabs-group';
      groupWrap.innerHTML = `
        <div class="selected-group-label" style="--group-color: ${groupColor}">
          <span>${this.escapeHtml(groupLabel)}</span>
          <span class="selected-group-count">${tabs.length}</span>
        </div>
        <div class="selected-tabs-chips"></div>
      `;

      const chipsRow = groupWrap.querySelector('.selected-tabs-chips');
      if (!chipsRow) {
        this.elements.selectedTabsBar.appendChild(groupWrap);
        return;
      }
      tabs.forEach(tab => {
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
        const removeBtn = chip.querySelector('button');
        removeBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectedTabs.delete(tab.id);
          this.updateSelectedTabsBar();
          this.updateTabSelectorButton();
          this.loadTabs();
        });
        chipsRow.appendChild(chip);
      });

      this.elements.selectedTabsBar.appendChild(groupWrap);
    });
  }

  updateTabSelectorButton() {
    if (this.selectedTabs.size > 0) {
      this.elements.tabSelectorBtn.classList.add('has-selection');
    } else {
      this.elements.tabSelectorBtn.classList.remove('has-selection');
    }
  }

  mapGroupColor(colorName) {
    const palette = {
      grey: '#9aa0a6',
      blue: '#4c8bf5',
      red: '#ea4335',
      yellow: '#fbbc04',
      green: '#34a853',
      pink: '#f06292',
      purple: '#a142f4',
      cyan: '#24c1e0',
      orange: '#f29900'
    };
    return palette[colorName] || 'var(--text-tertiary)';
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
