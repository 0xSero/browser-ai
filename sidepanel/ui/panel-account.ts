import { normalizeConversationHistory } from '../../ai/message-schema.js';
import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).renderAccountPanel = function renderAccountPanel() {
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
  const payment = (billing as any)?.paymentMethod;
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
    const invoices = Array.isArray((billing as any)?.invoices) ? (billing as any).invoices : [];
    this.elements.accountInvoices.innerHTML = '';
    if (!invoices.length) {
      this.elements.accountInvoices.innerHTML =
        '<div class="account-list-item"><span class="muted">No invoices yet.</span></div>';
    } else {
      invoices.slice(0, 4).forEach((invoice: any) => {
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
      configs.slice(0, 4).forEach(([name, config]: any) => {
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
};

(SidePanelUI.prototype as any).renderHistoryPreview = async function renderHistoryPreview() {
  if (!this.elements.accountHistory) return;
  const { chatSessions = [] } = await chrome.storage.local.get(['chatSessions']);
  this.elements.accountHistory.innerHTML = '';
  if (!chatSessions.length) {
    this.elements.accountHistory.innerHTML =
      '<div class="account-list-item"><span class="muted">No saved chats yet.</span></div>';
    return;
  }
  chatSessions.slice(0, 4).forEach((session: any) => {
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
};
