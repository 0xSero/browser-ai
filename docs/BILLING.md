# Billing & Auth Service

Parchi ships with an optional Stripe-backed billing/auth service under `server/`. The extension connects to this service to sign users in with email, start Stripe Checkout, and open the customer portal.

## Run the service locally

```bash
cd server
npm install
npm run build
npm run dev
```

Set the following environment variables before starting the service:

- `STRIPE_SECRET_KEY`: Stripe secret key.
- `STRIPE_PRICE_ID`: Subscription price ID for Checkout.
- `BASE_URL`: Public base URL for verification links (e.g. `https://billing.example.com`).
- `CHECKOUT_SUCCESS_URL`: Stripe success redirect URL.
- `CHECKOUT_CANCEL_URL`: Stripe cancel redirect URL.
- `PORTAL_RETURN_URL`: Customer portal return URL.
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS.
- `DATA_PATH`: Optional file path for local data storage.
- `DEVICE_CODE_TTL_SEC`: Optional device code TTL in seconds (default 600) if you keep legacy device-code flows enabled.
- `SESSION_TTL_SEC`: Optional session TTL in seconds (default 7 days).

You can place these in `server/.env` for local development (the server loads dotenv automatically).

Example:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
BASE_URL=http://localhost:8787
CHECKOUT_SUCCESS_URL=http://localhost:8787/public/success.html
CHECKOUT_CANCEL_URL=http://localhost:8787/public/cancel.html
PORTAL_RETURN_URL=http://localhost:8787/portal
```

## Create a $20/month price (Stripe CLI)

```bash
stripe products create --name "Parchi Pro"
stripe prices create --product prod_XXXXXXXX --unit-amount 2000 --currency usd -d "recurring[interval]=month" -d "nickname=Parchi Pro Monthly"
```

## Connect the extension

1. Open the extension settings.
2. Set **Account API base URL** to the service URL (for local dev: `http://localhost:8787`).
3. Use the **Account** panel to sign in with your email.

## Account portal

The billing service also serves a lightweight account portal at `/portal`. Use it to sign in, review billing, and jump into Stripe Checkout or the customer portal.

## Notes

- The service stores sessions (and any device codes, if enabled) in a local JSON file by default. Replace with a real database in production.
- Stripe webhooks are not included; add them if you need real-time subscription status updates.
- The `/v1/billing/overview` endpoint returns entitlement, payment method summary, and recent invoices for the account UI.
