import { createMessage, normalizeConversationHistory } from '../ai/message-schema.js';
import type { Message } from '../ai/message-schema.js';
import { dedupeThinking, extractThinking } from '../ai/message-utils.js';
import type { RunPlan } from '../types/plan.js';
import { isRuntimeMessage } from '../types/runtime-messages.js';
import { AccountClient } from './account-client.js';
import { getSidePanelElements } from './panel-elements.js';
import {
  type RightPanelName,
  bindSidebarNavigation,
  setSidebarOpen,
  showRightPanel as showRightPanelContent,
  updateNavActive,
} from './panel-navigation.js';

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

type UsagePayload = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

type UsageStats = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

// Side Panel UI Controller
export class SidePanelUI {
  elements: Record<string, any>;
  displayHistory: Message[];
  contextHistory: Message[];
  sessionId: string;
  sessionStartedAt: number;
  firstUserMessage: string;
  currentConfig: string;
  configs: Record<string, any>;
  toolCallViews: Map<string, any>;
  lastChatTurn: HTMLElement | null;
  selectedTabs: Map<number, any>;
  tabGroupInfo: Map<number, chrome.tabGroups.TabGroup>;
  scrollPositions: Map<string, number>;
  pendingToolCount: number;
  isStreaming: boolean;
  streamingState: {
    container: HTMLElement;
    eventsEl: HTMLElement | null;
    lastEventType?: 'text' | 'reasoning' | 'tool' | 'plan';
    textEventEl?: HTMLElement | null;
    reasoningEventEl?: HTMLElement | null;
    textBuffer?: string;
    reasoningBuffer?: string;
    planEl?: HTMLElement | null;
    planListEl?: HTMLOListElement | null;
    planMetaEl?: HTMLElement | null;
  } | null;
  userScrolledUp: boolean;
  isNearBottom: boolean;
  chatResizeObserver: ResizeObserver | null;
  contextUsage: {
    approxTokens: number;
    maxContextTokens: number;
    percent: number;
  };
  sessionTokensUsed: number;
  lastUsage: UsageStats | null;
  sessionTokenTotals: UsageStats;
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
  activityPanelOpen: boolean;
  latestThinking: string | null;
  activeToolName: string | null;
  streamingReasoning: string;
  currentPlan: RunPlan | null;

  constructor() {
    this.elements = getSidePanelElements();

    this.displayHistory = [];
    this.contextHistory = [];
    this.sessionId = `session-${Date.now()}`;
    this.sessionStartedAt = Date.now();
    this.firstUserMessage = '';
    this.currentConfig = 'default';
    this.configs = { default: {} };
    this.toolCallViews = new Map();
    this.lastChatTurn = null;
    this.selectedTabs = new Map();
    this.tabGroupInfo = new Map();
    this.scrollPositions = new Map();
    this.pendingToolCount = 0;
    this.isStreaming = false;
    this.streamingState = null;
    this.userScrolledUp = false;
    this.isNearBottom = true;
    this.chatResizeObserver = null;
    this.contextUsage = {
      approxTokens: 0,
      maxContextTokens: 196000,
      percent: 0,
    };
    this.sessionTokensUsed = 0; // Track highest context seen in session
    this.lastUsage = null;
    this.sessionTokenTotals = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
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
      getAuthToken: () => this.authState?.accessToken || '',
    });
    // Subagent tracking
    this.subagents = new Map(); // id -> { name, status, messages }
    this.activeAgent = 'main';
    this.activityPanelOpen = false;
    this.latestThinking = null;
    this.activeToolName = null;
    this.streamingReasoning = '';
    this.currentPlan = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupResizeObserver();
    // Start with sidebar closed by default
    this.elements.sidebar?.classList.add('closed');
    await this.loadSettings();
    await this.loadHistoryList();
    await this.loadAccessState();
    if (this.isAccessReady()) {
      this.updateStatus('Ready', 'success');
    }
    this.updateModelDisplay();
    this.fetchAvailableModels();
  }

  setupEventListeners() {
    bindSidebarNavigation(this.elements, {
      onOpen: () => this.openSidebar(),
      onClose: () => this.closeSidebar(),
      onChat: () => this.openChatView(),
      onHistory: () => this.openHistoryPanel(),
      onSettings: () => this.openSettingsPanel(),
      onAccount: () => this.openAccountPanel(),
    });

    // Legacy settings toggle (if old button exists)
    this.elements.settingsBtn?.addEventListener('click', () => {
      void this.toggleSettings();
    });

    this.elements.accountBtn?.addEventListener('click', () => {
      this.toggleAccessPanel();
    });

    this.elements.authStartBtn?.addEventListener('click', (event) => {
      event?.preventDefault?.();
      this.startEmailAuth();
    });
    this.elements.authForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.startEmailAuth();
    });
    this.elements.authOpenBtn?.addEventListener('click', () => this.openAuthPage());
    this.elements.authTokenSaveBtn?.addEventListener('click', () => this.saveAccessToken());
    this.elements.authOpenSettingsBtn?.addEventListener('click', () =>
      this.openAccountSettings({ focusAccountApi: true }),
    );
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

    // Custom endpoint validation
    this.elements.customEndpoint?.addEventListener('input', () => this.validateCustomEndpoint());

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
      void this.saveSettings();
    });

    // Cancel settings
    this.elements.cancelSettingsBtn.addEventListener('click', () => {
      void this.cancelSettings();
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

    // Model selector
    this.elements.modelSelect?.addEventListener('change', () => this.handleModelSelectChange());

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

    this.elements.activityCloseBtn?.addEventListener('click', () => this.toggleActivityPanel(false));

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
      if (isRuntimeMessage(message)) {
        this.handleRuntimeMessage(message);
        return;
      }

      if (message.type === 'tool_execution_start') {
        this.pendingToolCount += 1;
        this.clearErrorBanner();
        this.updateActivityState();
        this.activeToolName = message.tool || null;
        this.displayToolExecution(message.tool, message.args, null, message.id);
      } else if (message.type === 'tool_execution_result') {
        this.pendingToolCount = Math.max(0, this.pendingToolCount - 1);
        this.updateActivityState();
        this.activeToolName = null;
        this.displayToolExecution(message.tool, message.args, message.result, message.id);
      } else if (message.type === 'assistant_response' || message.type === 'assistant_final') {
        this.displayAssistantMessage(message.content, message.thinking, message.usage, message.model);
        if (message.usage?.inputTokens) {
          this.updateContextUsage(message.usage.inputTokens);
        } else {
          this.updateContextUsage();
        }
      } else if (message.type === 'assistant_stream_start') {
        this.handleAssistantStream({ status: 'start' });
      } else if (message.type === 'assistant_stream_delta') {
        this.handleAssistantStream({
          status: 'delta',
          content: message.content,
        });
      } else if (message.type === 'assistant_stream_stop') {
        this.handleAssistantStream({ status: 'stop' });
      } else if (message.type === 'run_error' || message.type === 'error') {
        this.showErrorBanner(message.message);
        this.updateStatus('Error', 'error');
      } else if (message.type === 'run_warning' || message.type === 'warning') {
        this.showErrorBanner(message.message);
      } else if (message.type === 'subagent_start') {
        this.addSubagent(message.id, message.name, message.tasks);
        this.updateStatus(`Sub-agent "${message.name}" started`, 'active');
      } else if (message.type === 'subagent_complete') {
        this.updateSubagentStatus(message.id, message.success ? 'completed' : 'error');
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

  handleRuntimeMessage(message) {
    if (message.type === 'assistant_stream_start') {
      this.streamingReasoning = '';
      this.handleAssistantStream({ status: 'start' });
      return;
    }
    if (message.type === 'assistant_stream_delta') {
      if (message.channel === 'reasoning') {
        const delta = message.content || '';
        this.streamingReasoning = `${this.streamingReasoning}${delta}`;
        this.updateThinkingPanel(this.streamingReasoning, true);
        this.updateStreamReasoning(delta);
        return;
      }
      this.handleAssistantStream({ status: 'delta', content: message.content });
      return;
    }
    if (message.type === 'assistant_stream_stop') {
      this.handleAssistantStream({ status: 'stop' });
      return;
    }

    if (message.type === 'plan_update') {
      this.applyPlanUpdate(message.plan);
      return;
    }

    if (message.type === 'manual_plan_update') {
      this.applyManualPlanUpdate(message.steps);
      return;
    }

    if (message.type === 'tool_execution_start') {
      this.pendingToolCount += 1;
      this.clearErrorBanner();
      this.updateActivityState();
      this.activeToolName = message.tool || null;
      this.displayToolExecution(message.tool, message.args, null, message.id);
      return;
    }
    if (message.type === 'tool_execution_result') {
      this.pendingToolCount = Math.max(0, this.pendingToolCount - 1);
      this.updateActivityState();
      this.activeToolName = null;
      this.displayToolExecution(message.tool, message.args, message.result, message.id);
      return;
    }

    if (message.type === 'assistant_final') {
      this.displayAssistantMessage(message.content, message.thinking, message.usage, message.model);
      this.appendContextMessages(message.responseMessages, message.content, message.thinking);
      if (message.usage?.inputTokens) {
        this.updateContextUsage(message.usage.inputTokens);
      } else if (message.contextUsage?.approxTokens) {
        this.updateContextUsage(message.contextUsage.approxTokens);
      } else {
        this.updateContextUsage();
      }
      return;
    }

    if (message.type === 'context_compacted') {
      this.handleContextCompaction(message);
      return;
    }

    if (message.type === 'run_error') {
      this.showErrorBanner(message.message);
      this.updateStatus('Error', 'error');
      return;
    }
    if (message.type === 'run_warning') {
      this.showErrorBanner(message.message);
      return;
    }
    if (message.type === 'subagent_start') {
      this.addSubagent(message.id, message.name, message.tasks);
      this.updateStatus(`Sub-agent "${message.name}" started`, 'active');
      return;
    }
    if (message.type === 'subagent_complete') {
      this.updateSubagentStatus(message.id, message.success ? 'completed' : 'error');
      return;
    }
  }

  appendContextMessages(
    responseMessages?: Array<Record<string, unknown>>,
    fallbackContent?: string,
    fallbackThinking?: string | null,
  ) {
    if (!responseMessages || responseMessages.length === 0) {
      const assistantEntry = createMessage({
        role: 'assistant',
        content: fallbackContent || '',
        thinking: fallbackThinking || null,
      });
      if (assistantEntry) {
        this.contextHistory.push(assistantEntry);
      }
      return;
    }
    const normalized = normalizeConversationHistory(responseMessages as unknown as Message[]);
    this.contextHistory.push(...normalized);
  }

  handleContextCompaction(message) {
    const normalized = normalizeConversationHistory(message.contextMessages as unknown as Message[]);
    this.contextHistory = normalized;
    this.sessionId = message.newSessionId || this.sessionId;

    const summaryText = message.summary || 'Context compacted.';
    const summaryEntry = createMessage({
      role: 'system',
      content: summaryText,
      meta: {
        kind: 'summary',
        summaryOfCount: message.trimmedCount,
        source: 'auto',
      },
    });
    if (summaryEntry) {
      this.displayHistory.push(summaryEntry);
      this.displaySummaryMessage(summaryEntry);
    }

    if (message.contextUsage?.approxTokens) {
      this.updateContextUsage(message.contextUsage.approxTokens);
    }
  }

  async toggleSettings(saveOnClose = true) {
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
  }

  async cancelSettings() {
    await this.loadSettings();
    await this.toggleSettings(false);
  }

  toggleCustomEndpoint() {
    const isCustom = this.elements.provider.value === 'custom';
    this.elements.customEndpointGroup.style.display = isCustom ? 'block' : 'none';
    if (isCustom && !this.elements.customEndpoint.value) {
      this.elements.customEndpoint.placeholder = 'https://api.example.com/v1/chat/completions';
    }
  }

  validateCustomEndpoint() {
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
  }

  toggleProfileEditorEndpoint() {
    const provider = this.elements.profileEditorProvider?.value;
    if (!this.elements.profileEditorEndpointGroup) return;
    this.elements.profileEditorEndpointGroup.style.display = provider === 'custom' ? 'block' : 'none';
  }

  switchSettingsTab(tabName: 'general' | 'profiles' = 'general') {
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
    this.elements.confirmActions.value =
      settings.confirmActions !== undefined ? String(settings.confirmActions) : 'true';
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
    const status: AuthState['status'] =
      state.status === 'signed_out' || state.status === 'device_code' || state.status === 'signed_in'
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
      status: state.status ? String(state.status) : '',
    };
  }

  async persistAccessState() {
    await chrome.storage.local.set({
      authState: this.authState,
      entitlement: this.entitlement,
    });
  }

  getAccessState() {
    if (!this.isAccountRequired()) return 'ready';
    if (!this.authState || this.authState.status !== 'signed_in') return 'auth';
    if (!this.entitlement || !this.entitlement.active) return 'billing';
    return 'ready';
  }

  isAccessReady() {
    return this.getAccessState() === 'ready';
  }

  updateAccessUI() {
    const accountRequired = this.isAccountRequired();
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

    if (this.elements.authOpenBtn) {
      const canOpenAccount = Boolean(this.accountClient?.baseUrl);
      this.elements.authOpenBtn.disabled = !canOpenAccount;
    }
    if (this.elements.planStatus) {
      this.elements.planStatus.textContent = this.entitlement?.active
        ? `Active${this.entitlement.renewsAt ? ` · Renews ${new Date(this.entitlement.renewsAt).toLocaleDateString()}` : ''}`
        : 'No active plan';
    }

    if (this.elements.accountBtn) {
      const label = accountRequired
        ? state === 'auth'
          ? 'Signed out'
          : this.authState?.email || 'Signed in'
        : this.authState?.email || 'Account';
      this.elements.accountBtn.textContent = label;
    }

    // Update sidebar account nav label
    if (this.elements.accountNavLabel) {
      const navLabel = this.authState?.email || 'Account';
      this.elements.accountNavLabel.textContent = navLabel;
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
        ? 'Sign in with your email to unlock billing and sync.'
        : 'Set the account API base URL in Settings before signing in.';
    }
  }

  toggleAccessPanel() {
    if (this.accessPanelVisible) {
      this.accessPanelVisible = false;
      this.showRightPanel(null);
      this.setNavActive('chat');
      this.updateAccessUI();
      return;
    }
    this.openAccountPanel();
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
        this.accountClient.getBillingOverview(),
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
    this.openSettingsPanel();
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
    this.openSettingsPanel();
    this.switchSettingsTab('profiles');
  }

  openHistoryFromAccount() {
    this.openHistoryPanel();
  }

  async startEmailAuth() {
    if (!this.ensureAccountApiBase()) return;
    const email = (this.elements.authEmail?.value || '').trim();
    if (!email) {
      this.setAccessStatus('Enter your email to sign in.', 'warning');
      this.updateStatus('Email is required to sign in', 'warning');
      this.elements.authEmail?.focus();
      return;
    }
    if (this.elements.authStartBtn) {
      this.elements.authStartBtn.disabled = true;
    }
    if (this.elements.authEmail) {
      this.elements.authEmail.disabled = true;
    }
    this.setAccessStatus('Signing you in…');
    try {
      const response = await this.accountClient.signInWithEmail(email);
      const accessToken = response?.accessToken || response?.token;
      if (!accessToken) {
        throw new Error('Sign-in did not return an access token.');
      }
      this.authState = {
        status: 'signed_in',
        accessToken,
        email: response?.user?.email || email,
      };
      this.entitlement = this.normalizeEntitlement(response?.entitlement || { active: false, plan: 'none' });
      await this.persistAccessState();
      await this.refreshAccountData({ silent: true });
      this.accessPanelVisible = true;
      this.updateAccessUI();
      this.setAccessStatus('Signed in successfully.', 'success');
      this.updateStatus('Signed in — subscription required', 'warning');
    } catch (error) {
      this.setAccessStatus(error.message || 'Unable to sign in', 'error');
      this.updateStatus(error.message || 'Unable to sign in', 'error');
    } finally {
      if (this.elements.authStartBtn) {
        this.elements.authStartBtn.disabled = false;
      }
      if (this.elements.authEmail) {
        this.elements.authEmail.disabled = false;
      }
    }
  }

  async saveAccessToken() {
    const token = (this.elements.authTokenInput?.value || '').trim();
    if (!token) {
      this.setAccessStatus('Paste an access token to continue.', 'warning');
      this.updateStatus('Access token required', 'warning');
      this.elements.authTokenInput?.focus();
      return;
    }
    this.authState = {
      status: 'signed_in',
      accessToken: token,
      email: this.authState?.email || 'Token user',
    };
    await this.persistAccessState();
    this.accessPanelVisible = true;
    this.updateAccessUI();
    this.setAccessStatus('Access token saved.', 'success');
    this.updateStatus('Signed in with token', 'success');
    this.elements.authTokenInput.value = '';
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
    this.accountClient
      .createPortal()
      .then((response) => {
        if (response?.url) {
          this.openExternalUrl(response.url);
          this.setAccessStatus('Billing portal opened in a new tab.', 'success');
          this.updateStatus('Billing portal opened in a new tab', 'success');
        } else {
          this.setAccessStatus('Billing portal unavailable.', 'warning');
          this.updateStatus('Billing portal unavailable', 'warning');
        }
      })
      .catch((error) => {
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
        currency: currency.toUpperCase(),
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

  formatTokenCount(value: number) {
    if (!value || value <= 0) return '0';
    if (value >= 1000) {
      const precision = value >= 10000 ? 0 : 1;
      return `${(value / 1000).toFixed(precision)}k`;
    }
    return `${Math.round(value)}`;
  }

  normalizeUsage(usage: UsagePayload | null) {
    if (!usage) return null;
    const inputTokens = Math.max(0, usage.inputTokens || 0);
    const outputTokens = Math.max(0, usage.outputTokens || 0);
    const totalTokens = Math.max(0, usage.totalTokens || inputTokens + outputTokens);
    if (!inputTokens && !outputTokens && !totalTokens) return null;
    return { inputTokens, outputTokens, totalTokens };
  }

  buildUsageLabel(usage: UsageStats | null) {
    if (!usage) return '';
    const parts: string[] = [];
    if (usage.inputTokens) {
      parts.push(`${this.formatTokenCount(usage.inputTokens)} in`);
    }
    if (usage.outputTokens) {
      parts.push(`${this.formatTokenCount(usage.outputTokens)} out`);
    }
    if (!parts.length && usage.totalTokens) {
      parts.push(`${this.formatTokenCount(usage.totalTokens)} total`);
    }
    return parts.length ? `Tokens ${parts.join(' / ')}` : '';
  }

  buildMessageMeta(usage: UsageStats | null, modelLabel?: string | null) {
    const segments: string[] = [];
    const model = modelLabel?.trim();
    if (model) {
      segments.push(model);
    }
    const usageLabel = this.buildUsageLabel(usage);
    if (usageLabel) {
      segments.push(usageLabel);
    }
    return segments.join(' · ');
  }

  estimateUsageFromContent(content: string) {
    if (!content) return null;
    const tokens = Math.ceil(content.length / 4);
    if (!tokens) return null;
    return {
      inputTokens: 0,
      outputTokens: tokens,
      totalTokens: tokens,
    } as UsageStats;
  }

  getActiveModelLabel() {
    return this.elements.modelSelect?.value || this.configs[this.currentConfig]?.model || '';
  }

  updateUsageStats(usage: UsageStats | null) {
    if (!usage) return;
    this.lastUsage = usage;
    this.sessionTokenTotals = {
      inputTokens: this.sessionTokenTotals.inputTokens + usage.inputTokens,
      outputTokens: this.sessionTokenTotals.outputTokens + usage.outputTokens,
      totalTokens: this.sessionTokenTotals.totalTokens + usage.totalTokens,
    };
    this.updateActivityState();
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

    const planLabel = this.entitlement?.active ? this.entitlement?.plan || 'Active' : 'No plan';
    if (this.elements.accountPlanBadge) {
      this.elements.accountPlanBadge.textContent = planLabel;
    }
    if (this.elements.accountPlanStatus) {
      const renewsAt = this.entitlement?.renewsAt ? ` · Renews ${this.formatShortDate(this.entitlement.renewsAt)}` : '';
      this.elements.accountPlanStatus.textContent = this.entitlement?.active ? `Active${renewsAt}` : 'No active plan';
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
        this.elements.accountBillingSummary.textContent =
          'Billing data unavailable until the account API is configured.';
      } else {
        this.elements.accountBillingSummary.textContent = 'No payment method on file yet.';
      }
    }
    if (this.elements.accountInvoices) {
      const invoices = Array.isArray(billing?.invoices) ? billing.invoices : [];
      this.elements.accountInvoices.innerHTML = '';
      if (!invoices.length) {
        this.elements.accountInvoices.innerHTML =
          '<div class="account-list-item"><span class="muted">No invoices yet.</span></div>';
      } else {
        invoices.slice(0, 4).forEach((invoice) => {
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
        this.elements.accountConfigs.innerHTML =
          '<div class="account-list-item"><span class="muted">No profiles saved.</span></div>';
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
      this.elements.accountHistory.innerHTML =
        '<div class="account-list-item"><span class="muted">No saved chats yet.</span></div>';
      return;
    }
    chatSessions.slice(0, 4).forEach((session) => {
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
          const normalized = normalizeConversationHistory(session.transcript || []);
          this.displayHistory = normalized;
          this.contextHistory = normalized;
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
    if (this.elements.provider.value === 'custom' && !this.validateCustomEndpoint()) {
      this.updateStatus('Invalid custom endpoint URL', 'error');
      return;
    }
    this.configs[this.currentConfig] = this.collectCurrentFormProfile();
    await this.persistAllSettings();
    await this.toggleSettings(false);
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
  }

  collectCurrentFormProfile() {
    // Get current config as base to preserve values if form elements are missing
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
  }

  collectToolPermissions() {
    return {
      read: this.elements.permissionRead?.value !== 'false',
      interact: this.elements.permissionInteract?.value !== 'false',
      navigate: this.elements.permissionNavigate?.value !== 'false',
      tabs: this.elements.permissionTabs?.value !== 'false',
      screenshots: this.elements.permissionScreenshots?.value === 'true',
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
  }

  getDefaultSystemPrompt() {
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
  }

  getDefaultAccountApiBase() {
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
  }

  isAccountRequired() {
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
      temperature: Number.parseFloat(this.elements.temperature.value),
      maxTokens: Number.parseInt(this.elements.maxTokens.value),
      timeout: Number.parseInt(this.elements.timeout.value),
      sendScreenshotsAsImages: this.elements.sendScreenshotsAsImages.value === 'true',
      screenshotQuality: this.elements.screenshotQuality.value,
      streamResponses: this.elements.streamResponses.value === 'true',
      enableScreenshots: this.elements.enableScreenshots.value === 'true',
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
    this.configs[this.currentConfig] = this.collectCurrentFormProfile();
    this.setActiveConfig(newConfig);
    await this.persistAllSettings({ silent: true });
  }

  refreshConfigDropdown() {
    this.elements.activeConfig.innerHTML = '';
    if (this.elements.generalProfileSelect) {
      this.elements.generalProfileSelect.innerHTML = '';
    }
    Object.keys(this.configs).forEach((name) => {
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
    selects.forEach((select) => {
      if (!select) return;
      select.innerHTML = '<option value="">Use active config</option>';
      names.forEach((name) => {
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
    configs.forEach((name) => {
      const card = document.createElement('div');
      card.className = 'agent-card';
      if (name === this.profileEditorTarget) {
        card.classList.add('editing');
      }
      card.dataset.profile = name;
      const rolePills = ['main', 'vision', 'orchestrator', 'aux']
        .map((role) => {
          const isActive = this.isProfileActiveForRole(name, role, currentVision, currentOrchestrator);
          const label = this.getRoleLabel(role);
          return `<span class="role-pill ${isActive ? 'active' : ''} ${role}-pill" data-role="${role}" data-profile="${name}">${label}</span>`;
        })
        .join('');
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
      case 'main':
        return 'Main';
      case 'vision':
        return 'Vision';
      case 'orchestrator':
        return 'Orchestrator';
      default:
        return 'Team';
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
      temperature: Number.parseFloat(this.elements.profileEditorTemperature.value) || 0.7,
      maxTokens: Number.parseInt(this.elements.profileEditorMaxTokens.value) || 2048,
      timeout: Number.parseInt(this.elements.profileEditorTimeout.value) || 30000,
      enableScreenshots: this.elements.profileEditorEnableScreenshots.value === 'true',
      sendScreenshotsAsImages: this.elements.profileEditorSendScreenshots.value === 'true',
      screenshotQuality: this.elements.profileEditorScreenshotQuality.value || 'high',
      systemPrompt: this.elements.profileEditorPrompt.value || this.getDefaultSystemPrompt(),
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
    this.updateModelDisplay();
    this.fetchAvailableModels();
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
    this.activeToolName = null;
    this.clearRunIncompleteBanner();
    this.updateActivityState();

    // Get selected tabs context
    const tabsContext = this.getSelectedTabsContext();
    const fullMessage = userMessage + tabsContext;

    this.currentPlan = null;

    // Display user message (show original without context)
    this.displayUserMessage(userMessage);

    const displayEntry = createMessage({ role: 'user', content: userMessage });
    if (displayEntry) {
      this.displayHistory.push(displayEntry);
    }

    const contextEntry = createMessage({ role: 'user', content: fullMessage });
    if (contextEntry) {
      this.contextHistory.push(contextEntry);
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
        conversationHistory: this.contextHistory,
        selectedTabs: Array.from(this.selectedTabs.values()),
        sessionId: this.sessionId,
      });
      this.persistHistory();
    } catch (error) {
      this.updateStatus('Error: ' + error.message, 'error');
      this.elements.composer?.classList.remove('running');
      this.displayAssistantMessage('Sorry, an error occurred: ' + error.message);
    }
  }

  displayUserMessage(content) {
    const turn = document.createElement('div');
    turn.className = 'chat-turn';
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
      <div class="message-header">You</div>
      <div class="message-content">${this.escapeHtml(content)}</div>
    `;
    turn.appendChild(messageDiv);
    this.elements.chatMessages.appendChild(turn);
    this.lastChatTurn = turn;
    this.scrollToBottom({ force: true });
  }

  displaySummaryMessage(messageOrEntry: Message | string) {
    const content = typeof messageOrEntry === 'string' ? messageOrEntry : String(messageOrEntry.content || '');
    const container = document.createElement('div');
    container.className = 'message summary';
    container.innerHTML = `
      <div class="summary-header">Context compacted</div>
      <div class="summary-body">${this.renderMarkdown(content)}</div>
    `;
    this.elements.chatMessages.appendChild(container);
    this.scrollToBottom();
  }

  displayAssistantMessage(
    content: string,
    thinking: string | null = null,
    usage: UsagePayload | null = null,
    model: string | null = null,
  ) {
    const streamResult = this.finishStreamingMessage();
    const streamedContainer = streamResult?.container;
    const streamEventsEl = streamedContainer?.querySelector('.stream-events') as HTMLElement | null;
    const hasStreamEvents = Boolean(streamEventsEl && streamEventsEl.children.length > 0);
    let normalizedUsage = this.normalizeUsage(usage);
    const modelLabel = model || this.getActiveModelLabel();
    const combinedThinking = [streamResult?.thinking, thinking].filter(Boolean).join('\n\n') || null;

    if ((!content || content.trim() === '') && !combinedThinking && !hasStreamEvents) {
      if (streamedContainer) {
        streamedContainer.remove();
      }
      this.updateStatus('Ready', 'success');
      this.elements.composer?.classList.remove('running');
      this.pendingToolCount = 0;
      this.updateActivityState();
      return;
    }

    const parsed = extractThinking(content, combinedThinking);
    content = parsed.content;
    thinking = parsed.thinking;
    this.updateThinkingPanel(thinking, false);

    if (!normalizedUsage) {
      normalizedUsage = this.estimateUsageFromContent(content);
    }
    if (normalizedUsage) {
      this.updateUsageStats(normalizedUsage);
    }
    const messageMeta = this.buildMessageMeta(normalizedUsage, modelLabel);

    // Add to conversation history
    const assistantEntry = createMessage({
      role: 'assistant',
      content,
      thinking,
    });
    if (assistantEntry) {
      this.displayHistory.push(assistantEntry);
    }

    if (streamedContainer) {
      if (!streamedContainer.querySelector('.message-header')) {
        const header = document.createElement('div');
        header.className = 'message-header';
        header.textContent = 'Assistant';
        streamedContainer.prepend(header);
      }

      if (messageMeta) {
        let metaEl = streamedContainer.querySelector('.message-meta') as HTMLElement | null;
        if (!metaEl) {
          metaEl = document.createElement('div');
          metaEl.className = 'message-meta';
          const header = streamedContainer.querySelector('.message-header');
          if (header) {
            header.insertAdjacentElement('afterend', metaEl);
          } else {
            streamedContainer.prepend(metaEl);
          }
        }
        metaEl.textContent = messageMeta;
      }

      if (content && content.trim() !== '' && streamEventsEl) {
        const hasTextEvent = streamEventsEl.querySelector('.stream-event-text');
        if (!hasTextEvent) {
          const textEvent = document.createElement('div');
          textEvent.className = 'stream-event stream-event-text';
          textEvent.innerHTML = this.renderMarkdown(content);
          streamEventsEl.appendChild(textEvent);
        }
      }

      this.scrollToBottom();
      this.updateStatus('Ready', 'success');
      this.elements.composer?.classList.remove('running');
      this.pendingToolCount = 0;
      this.updateActivityState();
      this.persistHistory();
      return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';

    let html = `<div class="message-header">Assistant</div>`;
    if (messageMeta) {
      html += `<div class="message-meta">${this.escapeHtml(messageMeta)}</div>`;
    }

    const showThinking = this.elements.showThinking.value === 'true';
    if (thinking && showThinking) {
      const cleanedThinking = dedupeThinking(thinking);
      html += `
        <div class="thinking-block collapsed">
          <button class="thinking-header" type="button" aria-expanded="false">
            <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            Thinking
          </button>
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
        if (!block || block.classList.contains('thinking-hidden')) return;
        block.classList.toggle('collapsed');
        const expanded = !block.classList.contains('collapsed');
        thinkingHeader.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      });
    }

    if (this.lastChatTurn) {
      this.lastChatTurn.appendChild(messageDiv);
    } else {
      this.elements.chatMessages.appendChild(messageDiv);
    }
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
      html = html.replace(
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        (_, alt, url) => `<img alt="${escape(alt)}" src="${escapeAttr(url)}">`,
      );
      html = html.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        (_, label, url) => `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
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
      this.completeStreamingMessage();
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
        <div class="stream-events"></div>
      </div>
    `;

    this.elements.chatMessages.appendChild(container);
    this.streamingState = {
      container,
      eventsEl: container.querySelector('.stream-events') as HTMLElement | null,
      lastEventType: undefined,
      textEventEl: null,
      reasoningEventEl: null,
      textBuffer: '',
      reasoningBuffer: '',
      planEl: null,
      planListEl: null,
      planMetaEl: null,
    };
    this.updateThinkingPanel(null, true);
    this.scrollToBottom();
  }

  updateStreamingMessage(content) {
    if (!this.streamingState) {
      this.startStreamingMessage();
    }
    if (!this.streamingState?.eventsEl) return;

    // Start a new text event block if needed
    if (this.streamingState.lastEventType !== 'text') {
      const textEvent = document.createElement('div');
      textEvent.className = 'stream-event stream-event-text';
      this.streamingState.eventsEl.appendChild(textEvent);
      this.streamingState.textEventEl = textEvent;
      this.streamingState.textBuffer = '';
      this.streamingState.lastEventType = 'text';
    }

    this.streamingState.textBuffer = `${this.streamingState.textBuffer || ''}${content || ''}`;
    if (this.streamingState.textEventEl) {
      this.streamingState.textEventEl.innerHTML = this.renderMarkdown(this.streamingState.textBuffer || '');
    }

    this.scrollToBottom();
  }

  completeStreamingMessage() {
    if (!this.streamingState?.container) return;
    const indicator = this.streamingState.container.querySelector('.typing-indicator');
    if (indicator) indicator.remove();
    this.streamingState.container.classList.remove('streaming');
    if (this.streamingReasoning) {
      this.updateThinkingPanel(this.streamingReasoning, false);
    } else {
      this.updateThinkingPanel(null, false);
    }
  }

  updateStreamReasoning(delta: string | null) {
    if (!this.streamingState?.eventsEl) return;
    if (delta === null || delta === undefined) return;
    if (!delta.trim() && !this.streamingState.reasoningBuffer) return;

    if (this.streamingState.lastEventType !== 'reasoning') {
      const reasoningEvent = document.createElement('div');
      reasoningEvent.className = 'stream-event stream-event-reasoning';
      reasoningEvent.innerHTML = `
        <div class="stream-reasoning-label">Reasoning</div>
        <div class="stream-reasoning-content"></div>
      `;
      this.streamingState.eventsEl.appendChild(reasoningEvent);
      this.streamingState.reasoningEventEl = reasoningEvent.querySelector(
        '.stream-reasoning-content',
      ) as HTMLElement | null;
      this.streamingState.reasoningBuffer = '';
      this.streamingState.lastEventType = 'reasoning';
    }

    const nextBuffer = `${this.streamingState.reasoningBuffer || ''}${delta}`;
    this.streamingState.reasoningBuffer = nextBuffer;
    const cleaned = dedupeThinking(nextBuffer);
    if (this.streamingState.reasoningEventEl) {
      this.streamingState.reasoningEventEl.textContent = cleaned;
    }
    this.scrollToBottom();
  }

  applyPlanUpdate(plan: RunPlan) {
    if (!plan) return;
    this.currentPlan = plan;
    this.renderPlanBlock(plan);
  }

  applyManualPlanUpdate(steps: Array<{ title: string; status?: string; notes?: string }> = []) {
    if (!steps || steps.length === 0) return;
    const now = Date.now();
    const normalizedSteps = steps
      .map((step, index) => {
        const status =
          step.status === 'running' || step.status === 'done' || step.status === 'blocked' ? step.status : 'pending';
        return {
          id: `step-${index + 1}`,
          title: step.title,
          status: status as RunPlan['steps'][number]['status'],
          notes: step.notes,
        };
      })
      .filter((step) => step.title);
    if (!normalizedSteps.length) return;
    this.currentPlan = {
      steps: normalizedSteps,
      createdAt: this.currentPlan?.createdAt || now,
      updatedAt: now,
    };
    if (this.currentPlan) {
      this.renderPlanBlock(this.currentPlan);
    }
  }

  renderPlanBlock(plan: RunPlan) {
    if (!this.streamingState) {
      this.startStreamingMessage();
    }
    const planEl = this.ensurePlanBlock();
    if (!planEl || !this.streamingState) return;

    const steps = Array.isArray(plan.steps) ? plan.steps : [];
    if (this.streamingState.planMetaEl) {
      this.streamingState.planMetaEl.textContent = steps.length === 1 ? '1 step' : `${steps.length} steps`;
    }
    if (this.streamingState.planListEl) {
      this.streamingState.planListEl.innerHTML = steps
        .map((step) => {
          const status = step.status || 'pending';
          const statusClass = `plan-step-${status}`;
          const notes = step.notes ? `<div class="plan-step-notes">${this.escapeHtml(step.notes)}</div>` : '';
          return `
            <li class="plan-step ${statusClass}">
              <span class="plan-step-dot"></span>
              <div class="plan-step-content">
                <span class="plan-step-title">${this.escapeHtml(step.title)}</span>
                ${notes}
              </div>
            </li>
          `;
        })
        .join('');
    }
    this.scrollToBottom();
  }

  ensurePlanBlock() {
    if (!this.streamingState?.eventsEl) return null;
    if (this.streamingState.planEl) return this.streamingState.planEl;

    const container = document.createElement('div');
    container.className = 'plan-block';
    container.innerHTML = `
      <div class="plan-header">
        <span class="plan-title">Plan</span>
        <span class="plan-meta"></span>
      </div>
      <ol class="plan-steps"></ol>
    `;

    const firstChild = this.streamingState.eventsEl.firstChild;
    if (firstChild) {
      this.streamingState.eventsEl.insertBefore(container, firstChild);
    } else {
      this.streamingState.eventsEl.appendChild(container);
    }

    this.streamingState.planEl = container;
    this.streamingState.planListEl = container.querySelector('.plan-steps') as HTMLOListElement | null;
    this.streamingState.planMetaEl = container.querySelector('.plan-meta') as HTMLElement | null;
    return container;
  }

  finishStreamingMessage() {
    if (!this.streamingState) return null;
    // Preserve thinking before clearing state
    const streamingThinking = this.streamingReasoning;
    const container = this.streamingState.container;

    this.completeStreamingMessage();
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
      entry = { inline: null, log: null };
      this.toolCallViews.set(entryId, entry);

      // Inline tools inside the streaming message (ordered)
      if (this.streamingState?.eventsEl) {
        if (this.currentPlan) {
          this.ensurePlanBlock();
        }
        const inlineEntry = this.createToolTreeItem(entryId, toolName, args);
        entry.inline = inlineEntry;
        this.streamingState.eventsEl.appendChild(inlineEntry.container);
        this.streamingState.lastEventType = 'tool';
      }

      // Activity panel log (right sidebar)
      if (this.elements.toolLog) {
        const logEntry = this.createToolTreeItem(entryId, toolName, args);
        entry.log = logEntry;
        this.elements.toolLog.appendChild(logEntry.container);
      }

      this.scrollToBottom();
    }

    if (result !== null && result !== undefined) {
      this.updateToolMessage(entry, result);
      const isError = result && (result.error || result.success === false);
      if (isError) {
        this.showErrorBanner(`${toolName}: ${result.error || 'Tool execution failed'}`);
      }
    }
    this.updateActivityToggle();
  }

  createToolMessage(entryId, toolName, args) {
    if (!this.elements.toolLog) {
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
        previewEl: details.querySelector('.tool-event-preview'),
      };
    }

    const container = document.createElement('div');
    container.className = 'tool-log-item running';
    container.dataset.id = entryId;
    const safeToolName = toolName || 'tool';
    const argsPreview = this.getArgsPreview(args);
    const argsText = this.truncateText(this.safeJsonStringify(args), 1600);

    container.innerHTML = `
      <div class="tool-log-header">
        <div class="tool-log-title"><span>${this.escapeHtml(safeToolName)}</span></div>
        <span class="tool-log-status">Running</span>
      </div>
      <div class="tool-log-meta">${this.escapeHtml(argsPreview || 'No args')}</div>
      <div class="tool-log-body">
        <div class="tool-log-args">${this.escapeHtml(argsText || 'No args')}</div>
        <div class="tool-log-result">Waiting...</div>
      </div>
      <button class="tool-log-toggle" type="button">Details</button>
    `;

    const toggleBtn = container.querySelector('.tool-log-toggle');
    toggleBtn?.addEventListener('click', () => {
      container.classList.toggle('expanded');
      const expanded = container.classList.contains('expanded');
      toggleBtn.textContent = expanded ? 'Hide' : 'Details';
    });

    return {
      container,
      statusEl: container.querySelector('.tool-log-status'),
      resultEl: container.querySelector('.tool-log-result'),
      previewEl: container.querySelector('.tool-log-meta'),
      toggleBtn,
    };
  }

  updateToolMessage(entry, result) {
    if (!entry) return;

    // Combined entry (inline + log)
    if (entry.inline || entry.log) {
      if (entry.inline) {
        this.updateToolTreeItem(entry.inline, result);
      }
      if (entry.log) {
        const isTreeItem = entry.log.container?.classList?.contains('tool-tree-item');
        if (isTreeItem) {
          this.updateToolTreeItem(entry.log, result);
        } else {
          this.updateToolLogEntry(entry.log, result);
        }
      }
      return;
    }

    // Backwards compatibility for single entry
    this.updateToolLogEntry(entry, result);
  }

  updateToolLogEntry(entry, result) {
    if (!entry) return;
    const isError = result && (result.error || result.success === false);

    if (entry.details) {
      entry.details.classList.remove('running', 'success', 'error');
      entry.details.classList.add(isError ? 'error' : 'success');
      if (entry.statusEl) entry.statusEl.textContent = isError ? 'Error' : 'Done';

      if (entry.resultEl) {
        const resultText = this.truncateText(this.safeJsonStringify(result), 2000);
        entry.resultEl.textContent = resultText || (isError ? 'Tool failed' : 'Done');
      }

      if (entry.previewEl) {
        const preview = isError ? result?.error || 'Tool failed' : result?.message || result?.summary || '';
        if (preview) {
          entry.previewEl.textContent = this.truncateText(String(preview), 120);
        }
      }

      if (isError) {
        entry.details.open = true;
      }
      return;
    }

    if (entry.container) {
      entry.container.classList.remove('running', 'success', 'error');
      entry.container.classList.add(isError ? 'error' : 'success');
    }
    if (entry.statusEl) entry.statusEl.textContent = isError ? 'Error' : 'Done';

    if (entry.resultEl) {
      const resultText = this.truncateText(this.safeJsonStringify(result), 2000);
      entry.resultEl.textContent = resultText || (isError ? 'Tool failed' : 'Done');
    }

    if (entry.previewEl) {
      const preview = isError ? result?.error || 'Tool failed' : result?.message || result?.summary || '';
      if (preview) {
        entry.previewEl.textContent = this.truncateText(String(preview), 120);
      }
    }

    if (isError && entry.container) {
      entry.container.classList.add('expanded');
      if (entry.toggleBtn) {
        entry.toggleBtn.textContent = 'Hide';
      }
    }

    if (this.elements.toolLog) {
      this.scrollToolLogToBottom();
    }
  }

  showErrorBanner(message) {
    // Remove existing error banner if present
    const existing = this.elements.chatInterface?.querySelector('.error-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.innerHTML = `
      <svg class="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
    this.showRunIncompleteBanner();
  }

  showRunIncompleteBanner() {
    const existing = this.elements.chatInterface?.querySelector('.run-incomplete-banner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.className = 'run-incomplete-banner';
    banner.innerHTML = `
      <span class="run-incomplete-dot"></span>
      <span>Run incomplete — response may be partial.</span>
      <button class="run-incomplete-dismiss" title="Dismiss">Dismiss</button>
    `;
    const dismiss = banner.querySelector('.run-incomplete-dismiss');
    dismiss?.addEventListener('click', () => banner.remove());
    const statusBar = this.elements.statusBar;
    if (statusBar && statusBar.parentNode) {
      statusBar.parentNode.insertBefore(banner, statusBar.nextSibling);
    }
  }

  clearRunIncompleteBanner() {
    const existing = this.elements.chatInterface?.querySelector('.run-incomplete-banner');
    if (existing) existing.remove();
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

  createToolTreeItem(entryId, toolName, args) {
    const container = document.createElement('div');
    container.className = 'tool-tree-item running';
    container.dataset.id = entryId;
    container.dataset.start = String(Date.now());

    const argsPreview = this.getArgsPreview(args);
    const argsText = this.truncateText(this.safeJsonStringify(args), 1600);

    // Compact single-line design
    container.innerHTML = `
      <span class="tool-tree-status"></span>
      <div class="tool-tree-content">
        <div class="tool-tree-header">
          <span class="tool-tree-name">${this.escapeHtml(toolName || 'tool')}</span>
          <span class="tool-tree-args">${this.escapeHtml(argsPreview || '')}</span>
        </div>
        <span class="tool-tree-meta">Running</span>
      </div>
    `;

    return {
      container,
      statusEl: container.querySelector('.tool-tree-meta'),
    };
  }

  updateToolTreeItem(entry, result) {
    if (!entry?.container) return;
    const isError = result && (result.error || result.success === false);
    entry.container.classList.remove('running', 'success', 'error');
    entry.container.classList.add(isError ? 'error' : 'success');

    const start = Number.parseInt(entry.container.dataset.start || '0', 10);
    const dur = start ? Date.now() - start : 0;

    if (entry.statusEl) {
      if (isError) {
        entry.statusEl.textContent = 'Error';
      } else {
        entry.statusEl.textContent = dur > 0 ? `${dur}ms` : 'Done';
      }
    }
  }

  ensureToolTree() {
    const container = this.lastChatTurn || this.elements.chatMessages;
    if (!container) {
      return document.createElement('div');
    }
    let tree = container.querySelector('.tool-tree');
    if (!tree) {
      tree = document.createElement('div');
      tree.className = 'tool-tree';
      container.appendChild(tree);
    }
    return tree;
  }

  updateStatus(text, type = 'default') {
    if (this.elements.statusText) {
      this.elements.statusText.textContent = text;
    }
    // Update status dot color based on type
    const statusDot = document.getElementById('statusDot');
    if (statusDot) {
      statusDot.className = 'status-dot';
      if (type === 'error') statusDot.classList.add('error');
      else if (type === 'warning') statusDot.classList.add('warning');
      else if (type === 'active') statusDot.classList.add('active');
    }
    this.updateActivityState();
  }

  updateModelDisplay() {
    const config = this.configs[this.currentConfig] || {};
    const modelName = config.model || '';
    // Update the model selector if it exists
    if (this.elements.modelSelect) {
      this.elements.modelSelect.value = modelName;
    }
  }

  async fetchAvailableModels() {
    const config = this.configs[this.currentConfig] || {};
    const provider = config.provider || 'openai';
    const apiKey = config.apiKey || '';
    const customEndpoint = config.customEndpoint || '';

    if (!apiKey) {
      this.populateModelSelect([config.model || 'gpt-4o']);
      return;
    }

    let baseUrl = '';
    if (provider === 'custom' && customEndpoint) {
      baseUrl = customEndpoint
        .replace(/\/chat\/completions\/?$/i, '')
        .replace(/\/v1\/?$/i, '')
        .replace(/\/+$/, '');
    } else if (provider === 'openai') {
      baseUrl = 'https://api.openai.com';
    } else if (provider === 'anthropic') {
      // Anthropic doesn't have a models endpoint, use known models
      this.populateModelSelect([
        'claude-opus-4-20250514',
        'claude-sonnet-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
      ]);
      return;
    }

    if (!baseUrl) {
      this.populateModelSelect([config.model || 'gpt-4o']);
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/v1/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('Failed to fetch models:', response.status);
        this.populateModelSelect([config.model || 'gpt-4o']);
        return;
      }

      const data = await response.json();
      const models = (data.data || [])
        .map((m: { id: string }) => m.id)
        .filter((id: string) => id && typeof id === 'string')
        .sort((a: string, b: string) => a.localeCompare(b));

      if (models.length > 0) {
        this.populateModelSelect(models);
      } else {
        this.populateModelSelect([config.model || 'gpt-4o']);
      }
    } catch (error) {
      console.warn('Error fetching models:', error);
      this.populateModelSelect([config.model || 'gpt-4o']);
    }
  }

  populateModelSelect(models: string[]) {
    const select = this.elements.modelSelect;
    if (!select) return;

    const config = this.configs[this.currentConfig] || {};
    const currentModel = config.model || '';

    // Clear existing options
    select.innerHTML = '';

    // Add models
    for (const model of models) {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      if (model === currentModel) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    // If current model not in list, add it
    if (currentModel && !models.includes(currentModel)) {
      const option = document.createElement('option');
      option.value = currentModel;
      option.textContent = currentModel;
      option.selected = true;
      select.insertBefore(option, select.firstChild);
    }
  }

  handleModelSelectChange() {
    const select = this.elements.modelSelect;
    if (!select) return;

    const selectedModel = select.value;
    if (!selectedModel) return;

    // Update current config
    if (this.configs[this.currentConfig]) {
      this.configs[this.currentConfig].model = selectedModel;
    }

    // Also update the form field if visible
    if (this.elements.model) {
      this.elements.model.value = selectedModel;
    }

    // Persist settings
    this.persistAllSettings({ silent: true });
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
      const used = Math.max(0, this.contextUsage.approxTokens || 0);
      const max = Math.max(1, this.contextUsage.maxContextTokens || 0);
      const usedLabel = used >= 10000 ? `${(used / 1000).toFixed(1)}k` : `${used}`;
      const maxLabel = max >= 10000 ? `${(max / 1000).toFixed(0)}k` : `${max}`;
      labels.push(`Context ~ ${usedLabel} / ${maxLabel}`);
    }
    const usageLabel = this.buildUsageLabel(this.lastUsage);
    if (usageLabel) {
      labels.push(usageLabel);
    }
    if (labels.length > 0) {
      this.elements.statusMeta.textContent = labels.join(' · ');
      this.elements.statusMeta.classList.remove('hidden');
    } else {
      this.elements.statusMeta.textContent = '';
      this.elements.statusMeta.classList.add('hidden');
    }
    this.updateActivityToggle();
  }

  updateActivityToggle() {
    const toggle = this.elements.activityToggleBtn;
    if (!toggle) return;
    const toolCount = this.toolCallViews.size;
    const hasThinking = Boolean(this.latestThinking);
    const segments: string[] = [];
    if (toolCount > 0) {
      segments.push(`${toolCount} tool${toolCount === 1 ? '' : 's'}`);
    }
    if (hasThinking) {
      segments.push('thinking');
    }
    if (this.activeToolName) {
      segments.push(`${this.activeToolName}…`);
    }
    toggle.textContent = segments.length ? `Activity · ${segments.join(' · ')}` : 'Activity';
    const hasActiveWork = this.pendingToolCount > 0 || this.isStreaming;
    toggle.classList.toggle('active', hasActiveWork);
  }

  toggleActivityPanel(force?: boolean) {
    const shouldOpen = typeof force === 'boolean' ? force : !this.activityPanelOpen;
    this.activityPanelOpen = shouldOpen;
    if (this.elements.activityPanel) {
      this.elements.activityPanel.classList.toggle('open', shouldOpen);
      this.elements.activityPanel.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    }
    this.elements.activityToggleBtn?.classList.toggle('open', shouldOpen);
    this.elements.chatInterface?.classList.toggle('activity-open', shouldOpen);
    if (shouldOpen) {
      this.scrollToolLogToBottom();
    }
  }

  updateThinkingPanel(thinking: string | null, isStreaming = false) {
    const panel = this.elements.thinkingPanel;
    if (!panel) return;
    const content = thinking ? thinking.trim() : '';
    if (content) {
      const cleaned = dedupeThinking(content);
      this.latestThinking = cleaned;
      panel.textContent = cleaned;
      panel.classList.remove('empty');
    } else {
      if (!isStreaming) {
        this.latestThinking = null;
      }
      panel.textContent = isStreaming ? 'Thinking…' : 'No reasoning captured yet.';
      panel.classList.add('empty');
    }
    panel.classList.toggle('streaming', isStreaming);
  }

  resetActivityPanel() {
    if (this.elements.toolLog) {
      this.elements.toolLog.innerHTML = '';
    }
    if (this.elements.chatMessages) {
      const tree = this.elements.chatMessages.querySelector('.tool-tree');
      if (tree) tree.remove();
    }
    this.latestThinking = null;
    this.activeToolName = null;
    this.updateThinkingPanel(null, false);
    this.updateActivityToggle();
  }

  scrollToolLogToBottom() {
    if (!this.elements.toolLog) return;
    this.elements.toolLog.scrollTop = this.elements.toolLog.scrollHeight;
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

  async persistHistory() {
    if (!this.elements.saveHistory || this.elements.saveHistory.value !== 'true') return;
    const entry = {
      id: this.sessionId,
      startedAt: this.sessionStartedAt,
      updatedAt: Date.now(),
      title: this.firstUserMessage || 'Session',
      transcript: this.displayHistory.slice(-200),
    };
    const existing = await chrome.storage.local.get(['chatSessions']);
    const sessions = existing.chatSessions || [];
    const filtered = sessions.filter((s) => s.id !== entry.id);
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
      const joined = this.contextHistory
        .map((msg) => {
          if (!msg) return '';
          if (typeof msg.content === 'string') return msg.content;
          if (Array.isArray(msg.content)) {
            return msg.content
              .map((p) => {
                if (typeof p === 'string') return p;
                if (p?.text) return p.text;
                if (p?.content) return JSON.stringify(p.content);
                if (p?.output) {
                  const output = p.output?.value ?? p.output;
                  if (typeof output === 'string') return output;
                  try {
                    return JSON.stringify(output);
                  } catch {
                    return String(output);
                  }
                }
                return '';
              })
              .join('');
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
    const configured = active.contextLimit || Number.parseInt(this.elements.contextLimit?.value) || 200000;
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
    chatSessions.forEach((session) => {
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
          const normalized = normalizeConversationHistory(session.transcript || []);
          this.displayHistory = normalized;
          this.contextHistory = normalized;
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
    this.toolCallViews.clear();
    this.lastChatTurn = null;
    this.resetActivityPanel();

    this.displayHistory.forEach((msg) => {
      if (msg.role === 'system' || msg.meta?.kind === 'summary') {
        this.displaySummaryMessage(msg);
        return;
      }
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
        const parsed = extractThinking(rawContent, msg.thinking || null);
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        let html = `<div class="message-header">Assistant</div>`;
        const showThinking = this.elements.showThinking.value === 'true';
        if (parsed.thinking && showThinking) {
          const cleanedThinking = dedupeThinking(parsed.thinking);
          html += `
            <div class="thinking-block collapsed">
              <button class="thinking-header" type="button" aria-expanded="false">
                <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                Thinking
              </button>
              <div class="thinking-content">${this.escapeHtml(cleanedThinking)}</div>
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
            if (!block || block.classList.contains('thinking-hidden')) return;
            block.classList.toggle('collapsed');
            const expanded = !block.classList.contains('collapsed');
            thinkingHeader.setAttribute('aria-expanded', expanded ? 'true' : 'false');
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

  openSidebar() {
    setSidebarOpen(this.elements, true);
  }

  closeSidebar() {
    setSidebarOpen(this.elements, false);
  }

  showRightPanel(panelName: RightPanelName) {
    showRightPanelContent(this.elements, panelName);
  }

  setNavActive(navName: 'chat' | 'history' | 'settings' | 'account') {
    updateNavActive(this.elements, navName);
  }

  openChatView() {
    this.settingsOpen = false;
    this.accessPanelVisible = false;
    this.showRightPanel(null);
    this.switchView('chat');
    this.setNavActive('chat');
    this.updateAccessUI();
  }

  openHistoryPanel() {
    this.settingsOpen = false;
    this.accessPanelVisible = false;
    this.openSidebar();
    this.showRightPanel('history');
    this.setNavActive('history');
    this.updateAccessUI();
  }

  openSettingsPanel() {
    this.settingsOpen = true;
    this.accessPanelVisible = false;
    this.openSidebar();
    this.showRightPanel('settings');
    this.switchSettingsTab(this.currentSettingsTab || 'general');
    this.setNavActive('settings');
    this.updateAccessUI();
  }

  openAccountPanel() {
    this.settingsOpen = false;
    this.accessPanelVisible = true;
    this.openSidebar();
    this.showRightPanel('account');
    this.setNavActive('account');
    this.updateAccessUI();
  }

  startNewSession() {
    if (!this.isAccessReady()) {
      this.updateAccessUI();
      return;
    }
    this.displayHistory = [];
    this.contextHistory = [];
    this.sessionId = `session-${Date.now()}`;
    this.sessionStartedAt = Date.now();
    this.firstUserMessage = '';
    this.sessionTokensUsed = 0; // Reset context tracking
    this.lastUsage = null;
    this.sessionTokenTotals = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    this.currentPlan = null;
    this.subagents.clear(); // Clear subagents
    this.activeAgent = 'main';
    this.elements.chatMessages.innerHTML = '';
    this.toolCallViews.clear();
    this.resetActivityPanel();
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
      messages: [],
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
      const statusClass = agent.status === 'running' ? 'running' : agent.status === 'completed' ? 'completed' : 'error';
      html += `
        <div class="agent-nav-item sub-agent ${statusClass} ${this.activeAgent === id ? 'active' : ''}" data-agent="${id}">
          <span class="agent-status"></span>
          <span>${agent.name}</span>
        </div>
      `;
    });

    this.elements.agentNav.innerHTML = html;

    // Add click handlers
    this.elements.agentNav.querySelectorAll('.agent-nav-item').forEach((item) => {
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
    controls.forEach((ctrl) => {
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
        const trimmed = text.length > maxPerFile ? text.slice(0, maxPerFile) + '\n… (truncated)' : text;
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
    const [tabs, groups] = await Promise.all([chrome.tabs.query({}), chrome.tabGroups.query({})]);
    this.tabGroupInfo = new Map(groups.map((group) => [group.id, group]));
    this.elements.tabList.innerHTML = '';

    const groupedTabs = new Map<number, chrome.tabs.Tab[]>();
    const ungroupedTabs: chrome.tabs.Tab[] = [];

    tabs
      .filter((tab) => typeof tab.id === 'number')
      .forEach((tab) => {
        if (tab.groupId !== undefined && tab.groupId >= 0) {
          if (!groupedTabs.has(tab.groupId)) groupedTabs.set(tab.groupId, []);
          const bucket = groupedTabs.get(tab.groupId);
          if (bucket) bucket.push(tab);
        } else {
          ungroupedTabs.push(tab);
        }
      });

    const renderGroup = (
      label: string,
      color: string,
      groupTabs: chrome.tabs.Tab[],
      groupId: string | number = 'ungrouped',
    ) => {
      if (!groupTabs.length) return;
      const section = document.createElement('div');
      section.className = 'tab-group';
      const allSelected = groupTabs.every((tab) => typeof tab.id === 'number' && this.selectedTabs.has(tab.id));
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

      groupTabs.forEach((tab) => {
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
    groupTabs.forEach((tab) => {
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
      groupTitle: hasGroup ? group?.title || `Group ${tab.groupId}` : 'Ungrouped',
      groupColor: hasGroup ? this.mapGroupColor(group?.color) : 'var(--text-tertiary)',
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
    this.selectedTabs.forEach((tab) => {
      const key = tab.groupId && tab.groupId >= 0 ? `group-${tab.groupId}` : 'ungrouped';
      if (!grouped.has(key)) grouped.set(key, []);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(tab);
    });

    grouped.forEach((tabs) => {
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
      tabs.forEach((tab) => {
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
      orange: '#f29900',
    };
    return palette[colorName] || 'var(--text-tertiary)';
  }

  getSelectedTabsContext() {
    if (this.selectedTabs.size === 0) return '';

    let context = '\n\n[Context from selected tabs:]\n';
    this.selectedTabs.forEach((tab) => {
      const tabTitle = tab.title || 'Untitled';
      context += `- Tab [${tab.id}] "${tabTitle}": ${tab.url}\n`;
    });
    return context;
  }
}
