import cors from 'cors';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import path from 'path';
import { fileURLToPath } from 'url';
import { DataStore } from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);
const BASE_URL = process.env.BASE_URL || '';
const DEVICE_CODE_TTL_SEC = Number(process.env.DEVICE_CODE_TTL_SEC || 600);
const SESSION_TTL_SEC = Number(process.env.SESSION_TTL_SEC || 60 * 60 * 24 * 7);
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const CHECKOUT_SUCCESS_URL = process.env.CHECKOUT_SUCCESS_URL || '';
const CHECKOUT_CANCEL_URL = process.env.CHECKOUT_CANCEL_URL || '';
const PORTAL_RETURN_URL = process.env.PORTAL_RETURN_URL || '';
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '../data/store.json');
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(item => item.trim()) : [];

type User = {
  id: string;
  email: string;
  createdAt: string;
  stripeCustomerId: string;
};

type AuthenticatedRequest = Request & { user: User };

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) : null;
const store = new DataStore(DATA_PATH);

await store.load();

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origin not allowed'));
    }
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use('/public', express.static(path.join(__dirname, '../public')));

function resolveBaseUrl(req: Request): string {
  if (BASE_URL) return BASE_URL.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function requireStripe() {
  if (!stripe) {
    throw new Error('Stripe is not configured.');
  }
}

function requirePriceId() {
  if (!STRIPE_PRICE_ID) {
    throw new Error('Stripe price ID is not configured.');
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  store.cleanupExpired();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Missing access token.' });
    return;
  }
  const session = store.findSession(token);
  if (!session || session.expiresAt <= Date.now()) {
    res.status(401).json({ error: 'Session expired.' });
    return;
  }
  const user = store.findUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found.' });
    return;
  }
  (req as AuthenticatedRequest).user = user;
  next();
}

async function ensureCustomer(user: User): Promise<string> {
  requireStripe();
  const stripeClient = stripe!;
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripeClient.customers.create({ email: user.email });
  user.stripeCustomerId = customer.id;
  await store.save();
  return customer.id;
}

async function fetchSubscription(customerId: string) {
  requireStripe();
  const stripeClient = stripe!;
  const subs = await stripeClient.subscriptions.list({ customer: customerId, status: 'all', limit: 5 });
  if (!subs.data.length) return null;
  const preferred = subs.data.find(sub => ['active', 'trialing', 'past_due'].includes(sub.status));
  return preferred || subs.data[0];
}

async function buildEntitlement(user: User) {
  if (!stripe || !user.stripeCustomerId) {
    return { active: false, plan: 'none', status: 'none', renewsAt: '' };
  }
  const subscription = await fetchSubscription(user.stripeCustomerId);
  if (!subscription) {
    return { active: false, plan: 'none', status: 'none', renewsAt: '' };
  }
  const price = subscription.items.data[0]?.price;
  const plan = price?.nickname || price?.id || 'plan';
  const status = subscription.status || 'active';
  const renewsAt = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : '';
  const active = ['active', 'trialing', 'past_due'].includes(status);
  return { active, plan, status, renewsAt };
}

async function buildBillingOverview(user: User) {
  const entitlement = await buildEntitlement(user);
  if (!stripe || !user.stripeCustomerId) {
    return { entitlement, paymentMethod: null, invoices: [] };
  }
  const stripeClient = stripe!;
  const customer = await stripeClient.customers.retrieve(user.stripeCustomerId);
  let paymentMethod: { brand?: string; last4?: string; expMonth?: number; expYear?: number } | null = null;
  const customerData = customer as Stripe.Customer | Stripe.DeletedCustomer;
  const isDeletedCustomer = 'deleted' in customerData && customerData.deleted === true;
  const defaultPayment = !isDeletedCustomer
    ? (customerData as Stripe.Customer).invoice_settings?.default_payment_method
    : null;
  const defaultPaymentId = typeof defaultPayment === 'string' ? defaultPayment : defaultPayment?.id;
  if (defaultPaymentId) {
    const pm = await stripeClient.paymentMethods.retrieve(defaultPaymentId);
    if (pm?.card) {
      paymentMethod = {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year
      };
    }
  } else {
    const pmList = await stripeClient.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card', limit: 1 });
    const pm = pmList.data[0];
    if (pm?.card) {
      paymentMethod = {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year
      };
    }
  }

  const invoiceList = await stripeClient.invoices.list({ customer: user.stripeCustomerId, limit: 5 });
  const invoices = invoiceList.data.map(inv => ({
    id: inv.id,
    status: inv.status,
    amountDue: inv.amount_due,
    currency: inv.currency,
    hostedInvoiceUrl: inv.hosted_invoice_url,
    createdAt: inv.created ? new Date(inv.created * 1000).toISOString() : '',
    periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : ''
  }));

  return { entitlement, paymentMethod, invoices };
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/device', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/device.html'));
});

app.post('/v1/auth/device-code', async (req, res, next) => {
  try {
    store.cleanupExpired();
    const entry = store.createDeviceCode({ expiresInMs: DEVICE_CODE_TTL_SEC * 1000 });
    await store.save();
    const verificationUrl = `${resolveBaseUrl(req)}/device?code=${encodeURIComponent(entry.userCode)}`;
    res.json({
      deviceCode: entry.deviceCode,
      userCode: entry.userCode,
      verificationUrl,
      expiresIn: DEVICE_CODE_TTL_SEC,
      interval: 5
    });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/auth/device-code/approve', async (req, res, next) => {
  try {
    store.cleanupExpired();
    const { userCode, email } = req.body || {};
    if (!userCode || !email) {
      res.status(400).json({ error: 'userCode and email are required.' });
      return;
    }
    const { user } = store.approveDeviceCode({ userCode, email });
    await store.save();
    res.json({ success: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/auth/device-code/verify', async (req, res, next) => {
  try {
    store.cleanupExpired();
    const { deviceCode } = req.body || {};
    if (!deviceCode) {
      res.status(400).json({ error: 'deviceCode is required.' });
      return;
    }
    const result = store.verifyDeviceCode({
      deviceCode,
      sessionTtlMs: SESSION_TTL_SEC * 1000
    });
    await store.save();
    if (result.status === 'pending') {
      res.json({ status: 'pending' });
      return;
    }
    const user = store.findUserById(result.session.userId);
    const entitlement = user ? await buildEntitlement(user) : { active: false, plan: 'none' };
    res.json({
      status: 'approved',
      accessToken: result.session.token,
      user: user ? { id: user.id, email: user.email } : null,
      entitlement
    });
  } catch (error) {
    next(error);
  }
});

app.get('/v1/account', requireAuth, (req, res) => {
  const authed = req as AuthenticatedRequest;
  res.json({ user: { id: authed.user.id, email: authed.user.email } });
});

app.get('/v1/billing/overview', requireAuth, async (req, res, next) => {
  try {
    const overview = await buildBillingOverview((req as AuthenticatedRequest).user);
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/billing/checkout', requireAuth, async (req, res, next) => {
  try {
    requireStripe();
    requirePriceId();
    const customerId = await ensureCustomer((req as AuthenticatedRequest).user);
    const stripeClient = stripe!;
    const returnUrl = req.body?.returnUrl || '';
    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: returnUrl || CHECKOUT_SUCCESS_URL || `${resolveBaseUrl(req)}/public/success.html`,
      cancel_url: returnUrl || CHECKOUT_CANCEL_URL || `${resolveBaseUrl(req)}/public/cancel.html`
    });
    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/billing/portal', requireAuth, async (req, res, next) => {
  try {
    requireStripe();
    const customerId = await ensureCustomer((req as AuthenticatedRequest).user);
    const stripeClient = stripe!;
    const returnUrl = req.body?.returnUrl || PORTAL_RETURN_URL || `${resolveBaseUrl(req)}/public/success.html`;
    const portal = await stripeClient.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });
    res.json({ url: portal.url });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error('[billing]', error);
  res.status(500).json({ error: error.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Billing server running on http://localhost:${PORT}`);
});
