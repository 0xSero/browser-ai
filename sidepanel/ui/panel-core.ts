import { createMessage, normalizeConversationHistory } from '../../ai/message-schema.js';
import type { Message } from '../../ai/message-schema.js';
import { isRuntimeMessage } from '../../types/runtime-messages.js';
import { bindSidebarNavigation } from './panel-navigation.js';
import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).init = async function init() {
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
};

(SidePanelUI.prototype as any).setupEventListeners = function setupEventListeners() {
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
  this.elements.generalProfileSelect?.addEventListener('change', (event) =>
    this.setActiveConfig((event.target as HTMLSelectElement).value),
  );

  this.elements.agentGrid?.addEventListener('click', (event) => {
    const pill = (event.target as HTMLElement | null)?.closest('.role-pill');
    if (pill) {
      const role = (pill as HTMLElement).dataset.role;
      const profile = (pill as HTMLElement).dataset.profile;
      this.assignProfileRole(profile, role);
      return;
    }
    const card = (event.target as HTMLElement | null)?.closest('.agent-card');
    if (card) {
      const profile = (card as HTMLElement).dataset.profile;
      this.editProfile(profile);
    }
  });
  this.elements.refreshProfilesBtn?.addEventListener('click', () => this.renderProfileGrid());

  // Agent management grid
  this.elements.agentGrid?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest('[data-role]');
    if (!button) return;
    const role = (button as HTMLElement).dataset.role;
    const profile = (button as HTMLElement).dataset.profile;
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
  this.elements.userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  });

  // Model selector
  this.elements.modelSelect?.addEventListener('change', () => this.handleModelSelectChange());

  // File upload
  this.elements.fileBtn?.addEventListener('click', () => {
    this.elements.fileInput?.click();
  });
  this.elements.fileInput?.addEventListener('change', (event) => this.handleFileSelection(event));

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
  chrome.runtime.onMessage.addListener((message) => {
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
};

(SidePanelUI.prototype as any).setupResizeObserver = function setupResizeObserver() {
  if (!this.elements.chatMessages || typeof ResizeObserver === 'undefined') return;
  this.chatResizeObserver = new ResizeObserver(() => {
    if (this.shouldAutoScroll() && this.isNearBottom) {
      this.scrollToBottom();
    }
  });
  this.chatResizeObserver.observe(this.elements.chatMessages);
};

(SidePanelUI.prototype as any).handleRuntimeMessage = function handleRuntimeMessage(message: any) {
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
};

(SidePanelUI.prototype as any).appendContextMessages = function appendContextMessages(
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
};

(SidePanelUI.prototype as any).handleContextCompaction = function handleContextCompaction(message: any) {
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
};
