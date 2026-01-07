# Billing & Auth Service

Parchi ships with an optional Stripe-backed billing/auth service under `server/`. The extension connects to this service to issue device codes, verify sign-in, start Stripe Checkout, and open the customer portal.

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
- `DEVICE_CODE_TTL_SEC`: Optional device code TTL in seconds (default 600).
- `SESSION_TTL_SEC`: Optional session TTL in seconds (default 7 days).

## Connect the extension

1. Open the extension settings.
2. Set **Account API base URL** to the service URL (for local dev: `http://localhost:8787`).
3. Use the **Account** panel to generate a device code, open the verification page, and confirm the device.

## Account portal

The billing service also serves a lightweight account portal at `/portal`. Use it to sign in, review billing, and jump into Stripe Checkout or the customer portal.

## Notes

- The service stores device codes and sessions in a local JSON file by default. Replace with a real database in production.
- Stripe webhooks are not included; add them if you need real-time subscription status updates.
- The `/v1/billing/overview` endpoint returns entitlement, payment method summary, and recent invoices for the account UI.
