import type { Message } from '../../ai/message-schema.js';
import type { RunPlan } from '../../types/plan.js';
import { AccountClient } from '../services/account-client.js';
import { getSidePanelElements } from './panel-elements.js';
import type { AuthState, BillingOverview, Entitlement, UsageStats } from './panel-types.js';

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

  // Methods attached via prototype in panel-modules
  declare init: () => Promise<void>;

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
    this.sessionTokensUsed = 0;
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
    this.subagents = new Map();
    this.activeAgent = 'main';
    this.activityPanelOpen = false;
    this.latestThinking = null;
    this.activeToolName = null;
    this.streamingReasoning = '';
    this.currentPlan = null;
    void this.init();
  }
}
