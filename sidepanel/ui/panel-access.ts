import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).loadAccessState = async function loadAccessState() {
  const { authState, entitlement } = await chrome.storage.local.get(['authState', 'entitlement']);
  this.authState = this.normalizeAuthState(authState);
  this.entitlement = this.normalizeEntitlement(entitlement);
  this.updateAccessUI();
  if (this.authState?.status === 'signed_in' && this.authState?.accessToken) {
    await this.refreshAccountData({ silent: true });
  }
};

(SidePanelUI.prototype as any).normalizeAuthState = function normalizeAuthState(
  state: Record<string, any> | null | undefined,
) {
  const normalized = { status: 'signed_out' } as const;
  if (!state || typeof state !== 'object') return normalized;
  const status =
    state.status === 'signed_out' || state.status === 'device_code' || state.status === 'signed_in'
      ? state.status
      : 'signed_out';
  const result: Record<string, any> = { status };
  if (state.code) result.code = String(state.code);
  if (state.deviceCode) result.deviceCode = String(state.deviceCode);
  if (state.verificationUrl) result.verificationUrl = String(state.verificationUrl);
  if (state.accessToken) result.accessToken = String(state.accessToken);
  if (state.email) result.email = String(state.email);
  if (state.expiresAt) result.expiresAt = Number(state.expiresAt);
  return result;
};

(SidePanelUI.prototype as any).normalizeEntitlement = function normalizeEntitlement(state: any) {
  if (!state || typeof state !== 'object') {
    return { active: false, plan: 'none' };
  }
  return {
    active: Boolean(state.active),
    plan: state.plan ? String(state.plan) : 'none',
    renewsAt: state.renewsAt ? String(state.renewsAt) : '',
    status: state.status ? String(state.status) : '',
  };
};

(SidePanelUI.prototype as any).persistAccessState = async function persistAccessState() {
  await chrome.storage.local.set({
    authState: this.authState,
    entitlement: this.entitlement,
  });
};

(SidePanelUI.prototype as any).getAccessState = function getAccessState() {
  if (!this.isAccountRequired()) return 'ready';
  if (!this.authState || this.authState.status !== 'signed_in') return 'auth';
  if (!this.entitlement || !this.entitlement.active) return 'billing';
  return 'ready';
};

(SidePanelUI.prototype as any).isAccessReady = function isAccessReady() {
  return this.getAccessState() === 'ready';
};

(SidePanelUI.prototype as any).updateAccessUI = function updateAccessUI() {
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
};

(SidePanelUI.prototype as any).updateAccessConfigPrompt = function updateAccessConfigPrompt() {
  const apiConfigured = Boolean(this.accountClient?.baseUrl);
  if (this.elements.accessConfigPrompt) {
    this.elements.accessConfigPrompt.classList.toggle('hidden', apiConfigured);
  }
  if (this.elements.authSubtitle) {
    this.elements.authSubtitle.textContent = apiConfigured
      ? 'Sign in with your email to unlock billing and sync.'
      : 'Set the account API base URL in Settings before signing in.';
  }
};

(SidePanelUI.prototype as any).toggleAccessPanel = function toggleAccessPanel() {
  if (this.accessPanelVisible) {
    this.accessPanelVisible = false;
    this.showRightPanel(null);
    this.setNavActive('chat');
    this.updateAccessUI();
    return;
  }
  this.openAccountPanel();
};

(SidePanelUI.prototype as any).openExternalUrl = function openExternalUrl(url: string) {
  if (!url) return;
  chrome.tabs.create({ url });
};

(SidePanelUI.prototype as any).openAuthPage = function openAuthPage() {
  const fallbackUrl = this.accountClient?.baseUrl ? `${this.accountClient.baseUrl}/portal` : '';
  const url = this.authState?.verificationUrl || fallbackUrl;
  if (!url) {
    this.setAccessStatus('Set the account API base URL in Settings to open the account page.', 'warning');
    this.updateStatus('No account page available yet.', 'warning');
    this.openAccountSettings({ focusAccountApi: true });
    return;
  }
  this.openExternalUrl(url);
};

(SidePanelUI.prototype as any).refreshAccountData = async function refreshAccountData({ silent = false } = {}) {
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
  } catch (error: any) {
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
};

(SidePanelUI.prototype as any).openSettingsFromAccount = function openSettingsFromAccount() {
  this.openAccountSettings();
};

(SidePanelUI.prototype as any).openAccountSettings = function openAccountSettings({ focusAccountApi = false } = {}) {
  this.openSettingsPanel();
  this.switchSettingsTab('general');
  const accountSection = this.elements.accountSettingsSection;
  if (accountSection && accountSection instanceof HTMLDetailsElement) {
    accountSection.open = true;
  }
  if (focusAccountApi) {
    this.focusAccountApiBase();
  }
};

(SidePanelUI.prototype as any).focusAccountApiBase = function focusAccountApiBase() {
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
};

(SidePanelUI.prototype as any).openProfilesFromAccount = function openProfilesFromAccount() {
  this.openSettingsPanel();
  this.switchSettingsTab('profiles');
};

(SidePanelUI.prototype as any).openHistoryFromAccount = function openHistoryFromAccount() {
  this.openHistoryPanel();
};

(SidePanelUI.prototype as any).startEmailAuth = async function startEmailAuth() {
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
  } catch (error: any) {
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
};

(SidePanelUI.prototype as any).saveAccessToken = async function saveAccessToken() {
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
};

(SidePanelUI.prototype as any).startSubscription = async function startSubscription() {
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
  } catch (error: any) {
    this.setAccessStatus(error.message || 'Unable to start subscription', 'error');
    this.updateStatus(error.message || 'Unable to start subscription', 'error');
  }
};

(SidePanelUI.prototype as any).manageBilling = function manageBilling() {
  if (!this.ensureAccountApiBase()) return;
  if (!this.authState || this.authState.status !== 'signed_in') {
    this.setAccessStatus('Sign in required before opening billing.', 'warning');
    this.updateStatus('Sign in required before opening billing', 'warning');
    return;
  }
  this.accountClient
    .createPortal()
    .then((response: any) => {
      if (response?.url) {
        this.openExternalUrl(response.url);
        this.setAccessStatus('Billing portal opened in a new tab.', 'success');
        this.updateStatus('Billing portal opened in a new tab', 'success');
      } else {
        this.setAccessStatus('Billing portal unavailable.', 'warning');
        this.updateStatus('Billing portal unavailable', 'warning');
      }
    })
    .catch((error: any) => {
      this.setAccessStatus(error.message || 'Unable to open billing portal', 'error');
      this.updateStatus(error.message || 'Unable to open billing portal', 'error');
    });
};

(SidePanelUI.prototype as any).ensureAccountApiBase = function ensureAccountApiBase() {
  if (this.accountClient?.baseUrl) return true;
  this.setAccessStatus('Open Settings → Account & billing and add the account API base URL.', 'warning');
  this.updateStatus('Account API base URL is not configured', 'warning');
  this.openAccountSettings({ focusAccountApi: true });
  return false;
};

(SidePanelUI.prototype as any).setAccessStatus = function setAccessStatus(
  message: string,
  tone: 'success' | 'warning' | 'error' | '' = '',
) {
  const statusEl = this.elements.accessStatus;
  if (!statusEl) return;
  if (!message) {
    statusEl.textContent = '';
    statusEl.className = 'access-status hidden';
    return;
  }
  statusEl.textContent = message;
  statusEl.className = `access-status ${tone}`.trim();
};

(SidePanelUI.prototype as any).signOut = async function signOut() {
  this.authState = { status: 'signed_out' };
  this.entitlement = { active: false, plan: 'none' };
  this.billingOverview = null;
  await this.persistAccessState();
  this.accessPanelVisible = true;
  this.updateAccessUI();
  this.setAccessStatus('Signed out.', 'warning');
  this.updateStatus('Signed out', 'warning');
};
