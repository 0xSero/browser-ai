type AccountClientOptions = {
  baseUrl?: string;
  getAuthToken?: () => string;
};

type RequestOptions = {
  method?: string;
  body?: Record<string, unknown>;
  auth?: boolean;
};

export class AccountClient {
  baseUrl: string;
  getAuthToken: () => string;

  constructor({ baseUrl = '', getAuthToken }: AccountClientOptions = {}) {
    this.baseUrl = baseUrl;
    this.getAuthToken = typeof getAuthToken === 'function' ? getAuthToken : () => '';
  }

  setBaseUrl(baseUrl = ''): void {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
  }

  async request(path: string, { method = 'GET', body, auth = false }: RequestOptions = {}): Promise<any> {
    if (!this.baseUrl) {
      throw new Error('Account API base URL is not configured.');
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let payload: Record<string, any> | null = null;
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

  startDeviceCode(): Promise<any> {
    return this.request('/v1/auth/device-code', { method: 'POST' });
  }

  verifyDeviceCode(deviceCode: string): Promise<any> {
    return this.request('/v1/auth/device-code/verify', {
      method: 'POST',
      body: { deviceCode },
    });
  }

  signInWithEmail(email: string): Promise<any> {
    return this.request('/v1/auth/email', {
      method: 'POST',
      body: { email },
    });
  }

  getAccount(): Promise<any> {
    return this.request('/v1/account', { auth: true });
  }

  getBillingOverview(): Promise<any> {
    return this.request('/v1/billing/overview', { auth: true });
  }

  createCheckout({ returnUrl }: { returnUrl?: string } = {}): Promise<any> {
    return this.request('/v1/billing/checkout', {
      method: 'POST',
      auth: true,
      body: returnUrl ? { returnUrl } : undefined,
    });
  }

  createPortal({ returnUrl }: { returnUrl?: string } = {}): Promise<any> {
    return this.request('/v1/billing/portal', {
      method: 'POST',
      auth: true,
      body: returnUrl ? { returnUrl } : undefined,
    });
  }
}
