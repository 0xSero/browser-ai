export class AccountClient {
  constructor({ baseUrl = '', getAuthToken } = {}) {
    this.baseUrl = baseUrl;
    this.getAuthToken = typeof getAuthToken === 'function' ? getAuthToken : () => '';
  }

  setBaseUrl(baseUrl = '') {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
  }

  async request(path, { method = 'GET', body, auth = false } = {}) {
    if (!this.baseUrl) {
      throw new Error('Account API base URL is not configured.');
    }
    const headers = {
      'Content-Type': 'application/json'
    };
    if (auth) {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Missing access token. Please sign in again.');
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = { error: text };
      }
    }

    if (!response.ok) {
      const message = payload?.error || payload?.message || `Request failed (${response.status})`;
      throw new Error(message);
    }

    return payload || {};
  }

  startDeviceCode() {
    return this.request('/v1/auth/device-code', { method: 'POST' });
  }

  verifyDeviceCode(deviceCode) {
    return this.request('/v1/auth/device-code/verify', {
      method: 'POST',
      body: { deviceCode }
    });
  }

  getAccount() {
    return this.request('/v1/account', { auth: true });
  }

  getBillingOverview() {
    return this.request('/v1/billing/overview', { auth: true });
  }

  createCheckout({ returnUrl } = {}) {
    return this.request('/v1/billing/checkout', {
      method: 'POST',
      auth: true,
      body: returnUrl ? { returnUrl } : undefined
    });
  }

  createPortal({ returnUrl } = {}) {
    return this.request('/v1/billing/portal', {
      method: 'POST',
      auth: true,
      body: returnUrl ? { returnUrl } : undefined
    });
  }
}
