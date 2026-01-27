export type AuthState = {
  status: 'signed_out' | 'device_code' | 'signed_in';
  code?: string;
  deviceCode?: string;
  verificationUrl?: string;
  accessToken?: string;
  email?: string;
  expiresAt?: number;
};

export type Entitlement = {
  active: boolean;
  plan: string;
  renewsAt?: string;
  status?: string;
};

export type BillingOverview = {
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

export type UsagePayload = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type UsageStats = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};
