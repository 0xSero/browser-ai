type DeviceCodePayload = {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval?: number;
};

type Entitlement = {
  active: boolean;
  plan: string;
  status?: string;
  renewsAt?: string;
};

type BillingOverview = {
  entitlement: Entitlement;
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

const ACCESS_TOKEN_KEY = 'parchi_access_token';

const elements = {
  authCard: document.getElementById('authCard') as HTMLElement | null,
  accountCard: document.getElementById('accountCard') as HTMLElement | null,
  startAuthBtn: document.getElementById('startAuthBtn') as HTMLButtonElement | null,
  confirmAuthBtn: document.getElementById('confirmAuthBtn') as HTMLButtonElement | null,
  authForm: document.getElementById('authForm') as HTMLFormElement | null,
  authEmail: document.getElementById('authEmail') as HTMLInputElement | null,
  authStatus: document.getElementById('authStatus') as HTMLElement | null,
  deviceCodeValue: document.getElementById('deviceCodeValue') as HTMLElement | null,
  deviceCodeExpiry: document.getElementById('deviceCodeExpiry') as HTMLElement | null,
  deviceVerifyLink: document.getElementById('deviceVerifyLink') as HTMLAnchorElement | null,
  tokenInput: document.getElementById('tokenInput') as HTMLInputElement | null,
  tokenApplyBtn: document.getElementById('tokenApplyBtn') as HTMLButtonElement | null,
  refreshBtn: document.getElementById('refreshBtn') as HTMLButtonElement | null,
  signOutBtn: document.getElementById('signOutBtn') as HTMLButtonElement | null,
  accountEmail: document.getElementById('accountEmail') as HTMLElement | null,
  planBadge: document.getElementById('planBadge') as HTMLElement | null,
  planStatus: document.getElementById('planStatus') as HTMLElement | null,
  paymentMethod: document.getElementById('paymentMethod') as HTMLElement | null,
  invoiceList: document.getElementById('invoiceList') as HTMLElement | null,
  checkoutBtn: document.getElementById('checkoutBtn') as HTMLButtonElement | null,
  portalBtn: document.getElementById('portalBtn') as HTMLButtonElement | null
};

const state = {
  accessToken: localStorage.getItem(ACCESS_TOKEN_KEY) || '',
  deviceCode: '',
  userCode: '',
  expiresAt: 0,
  interval: 5,
  countdownTimer: 0 as number | ReturnType<typeof setInterval>
};

function setAuthStatus(message: string, tone: 'error' | 'success' | '' = ''): void {
  if (!elements.authStatus) return;
  elements.authStatus.textContent = message;
  elements.authStatus.className = `status ${tone}`.trim();
}

function setDeviceCodeUI(payload: DeviceCodePayload): void {
  state.deviceCode = payload.deviceCode;
  state.userCode = payload.userCode;
  state.expiresAt = Date.now() + payload.expiresIn * 1000;
  state.interval = payload.interval || 5;

  if (elements.deviceCodeValue) {
    elements.deviceCodeValue.textContent = payload.userCode || '----';
  }
  if (elements.deviceVerifyLink) {
    elements.deviceVerifyLink.href = payload.verificationUrl || '/device';
  }
  startCountdown();
}

function startCountdown(): void {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer as number);
  }

  state.countdownTimer = setInterval(() => {
    if (!elements.deviceCodeExpiry) return;
    const remaining = Math.max(0, state.expiresAt - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    elements.deviceCodeExpiry.textContent = `Expires in ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (remaining <= 0) {
      clearInterval(state.countdownTimer as number);
      elements.deviceCodeExpiry.textContent = 'Code expired. Generate a new one.';
    }
  }, 1000);
}

function toggleView(isSignedIn: boolean): void {
  elements.authCard?.classList.toggle('hidden', isSignedIn);
  elements.accountCard?.classList.toggle('hidden', !isSignedIn);
}

async function apiFetch(path: string, options: RequestInit = {}, auth = false) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    if (!state.accessToken) throw new Error('Missing access token.');
    headers.Authorization = `Bearer ${state.accessToken}`;
  }
  const response = await fetch(path, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || 'Request failed.');
  }
  return payload;
}

async function startDeviceCode(): Promise<void> {
  if (!elements.startAuthBtn) return;
  elements.startAuthBtn.disabled = true;
  setAuthStatus('Creating device code...');
  try {
    const payload = await apiFetch('/v1/auth/device-code', { method: 'POST' }) as DeviceCodePayload;
    setDeviceCodeUI(payload);
    setAuthStatus('Code ready. Confirm with your email.', 'success');
  } catch (error) {
    const err = error as Error;
    setAuthStatus(err.message || 'Unable to start sign-in.', 'error');
  } finally {
    elements.startAuthBtn.disabled = false;
  }
}

async function approveDeviceCode(email: string): Promise<void> {
  if (!state.deviceCode || !state.userCode) {
    setAuthStatus('Generate a device code first.', 'error');
    return;
  }
  if (!email) {
    setAuthStatus('Enter a valid email address.', 'error');
    return;
  }
  if (elements.confirmAuthBtn) {
    elements.confirmAuthBtn.disabled = true;
  }
  setAuthStatus('Confirming device...');
  try {
    await apiFetch('/v1/auth/device-code/approve', {
      method: 'POST',
      body: JSON.stringify({ userCode: state.userCode, email })
    });
    await verifyDeviceCode();
  } catch (error) {
    const err = error as Error;
    setAuthStatus(err.message || 'Unable to confirm device.', 'error');
  } finally {
    if (elements.confirmAuthBtn) {
      elements.confirmAuthBtn.disabled = false;
    }
  }
}

async function verifyDeviceCode(): Promise<void> {
  const payload = await apiFetch('/v1/auth/device-code/verify', {
    method: 'POST',
    body: JSON.stringify({ deviceCode: state.deviceCode })
  });

  if (payload.status === 'pending') {
    setAuthStatus('Waiting for approval...');
    setTimeout(() => verifyDeviceCode(), state.interval * 1000);
    return;
  }

  if (payload.accessToken) {
    state.accessToken = payload.accessToken;
    localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
    setAuthStatus('Signed in.', 'success');
    await loadAccount();
  }
}

async function loadAccount(): Promise<void> {
  if (!state.accessToken) {
    toggleView(false);
    return;
  }

  try {
    const account = await apiFetch('/v1/account', { method: 'GET' }, true);
    const billing = await apiFetch('/v1/billing/overview', { method: 'GET' }, true) as BillingOverview;
    if (elements.accountEmail) {
      elements.accountEmail.textContent = account?.user?.email ? `Signed in as ${account.user.email}` : 'Signed in';
    }
    renderBilling(billing);
    toggleView(true);
  } catch (error) {
    const err = error as Error;
    if (err.message.toLowerCase().includes('token')) {
      signOut();
    } else {
      setAuthStatus(err.message || 'Failed to load account data.', 'error');
    }
  }
}

function renderBilling(billing: BillingOverview): void {
  const entitlement = billing?.entitlement || { active: false, plan: 'none', status: 'none' };
  if (elements.planBadge) {
    elements.planBadge.textContent = entitlement.active ? entitlement.plan || 'Active' : 'No plan';
  }
  if (elements.planStatus) {
    const renews = entitlement.renewsAt ? `Renews ${new Date(entitlement.renewsAt).toLocaleDateString()}` : '';
    const status = entitlement.status ? entitlement.status : entitlement.active ? 'active' : 'inactive';
    elements.planStatus.textContent = `Status: ${status}${renews ? ` · ${renews}` : ''}`;
  }

  if (elements.checkoutBtn) {
    elements.checkoutBtn.disabled = entitlement.active;
    elements.checkoutBtn.textContent = entitlement.active ? 'Subscription active' : 'Start subscription';
  }

  if (elements.paymentMethod) {
    const payment = billing?.paymentMethod;
    if (payment?.last4) {
      elements.paymentMethod.textContent = `${payment.brand?.toUpperCase() || 'Card'} **** ${payment.last4} · Exp ${payment.expMonth || '--'}/${payment.expYear || '--'}`;
    } else {
      elements.paymentMethod.textContent = 'No payment method on file.';
    }
  }

  if (elements.invoiceList) {
    elements.invoiceList.innerHTML = '';
    const invoices = billing?.invoices || [];
    if (!invoices.length) {
      elements.invoiceList.innerHTML = '<p class="muted">No invoices yet.</p>';
      return;
    }
    invoices.forEach(inv => {
      const item = document.createElement('div');
      item.className = 'invoice-item';
      const amount = formatCurrency(inv.amountDue || 0, inv.currency || 'usd');
      const date = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '';
      item.innerHTML = `
        <strong>${amount}</strong>
        <span>${inv.status || 'paid'} · ${date}</span>
        ${inv.hostedInvoiceUrl ? `<a href="${inv.hostedInvoiceUrl}" target="_blank" rel="noopener noreferrer">View invoice</a>` : ''}
      `;
      elements.invoiceList?.appendChild(item);
    });
  }
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format((amount || 0) / 100);
  } catch {
    return `$${(amount || 0) / 100}`;
  }
}

async function startCheckout(): Promise<void> {
  try {
    const payload = await apiFetch('/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ returnUrl: window.location.href })
    }, true);
    if (payload?.url) {
      window.location.href = payload.url;
    }
  } catch (error) {
    const err = error as Error;
    setAuthStatus(err.message || 'Failed to start checkout.', 'error');
  }
}

async function openPortal(): Promise<void> {
  try {
    const payload = await apiFetch('/v1/billing/portal', {
      method: 'POST',
      body: JSON.stringify({ returnUrl: window.location.href })
    }, true);
    if (payload?.url) {
      window.location.href = payload.url;
    }
  } catch (error) {
    const err = error as Error;
    setAuthStatus(err.message || 'Failed to open billing portal.', 'error');
  }
}

function signOut(): void {
  state.accessToken = '';
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  toggleView(false);
  setAuthStatus('Signed out.', '');
}

elements.startAuthBtn?.addEventListener('click', () => startDeviceCode());
elements.authForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const email = elements.authEmail?.value.trim() || '';
  approveDeviceCode(email);
});

elements.tokenApplyBtn?.addEventListener('click', () => {
  const token = elements.tokenInput?.value.trim() || '';
  if (!token) {
    setAuthStatus('Enter a token to continue.', 'error');
    return;
  }
  state.accessToken = token;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  loadAccount();
});

elements.refreshBtn?.addEventListener('click', () => loadAccount());
elements.signOutBtn?.addEventListener('click', () => signOut());
elements.checkoutBtn?.addEventListener('click', () => startCheckout());
elements.portalBtn?.addEventListener('click', () => openPortal());

if (state.accessToken) {
  loadAccount();
} else {
  toggleView(false);
}
