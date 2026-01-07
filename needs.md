# Needs: Keys, Context Budget, Tools, Activation, Type Safety, E2E

This document is the canonical inventory of keys/secrets, model context injection, tool availability, and type safety/e2e guidance for Parchi.

## 1) Required keys and where to get them

### 1.1 LLM provider keys (required to use the extension)

The extension will not run without at least one provider key. These are stored in `chrome.storage.local` and never checked into git.

- OpenAI API key
  - Where: https://platform.openai.com/api-keys
  - Why: Used for chat responses, tool calling, and (optionally) vision when `sendScreenshotsAsImages` is enabled for OpenAI models.
  - How:
    1) Sign in to the OpenAI dashboard.
    2) Create a new secret key.
    3) Paste it into Settings -> Provider & model -> API Key.
  - Notes:
    - The key must be valid for the model you choose (e.g., `gpt-4o`).
    - If you use a proxy or OpenAI-compatible endpoint, configure `customEndpoint` and use the key for that service.

- Anthropic API key
  - Where: https://console.anthropic.com/
  - Why: Used for chat responses, tool calling, and vision when the provider is set to Anthropic.
  - How:
    1) Sign in to Anthropic console.
    2) Create an API key.
    3) Paste it into Settings -> Provider & model -> API Key.
  - Notes:
    - Anthropic models are referenced by name (e.g., `claude-3-5-sonnet-20241022`).

- Custom (OpenAI-compatible) key + endpoint
  - Where: Your custom provider dashboard (e.g., OpenRouter, gateway, or self-hosted OpenAI-compatible API).
  - Why: Enables routing requests to non-OpenAI providers that support the OpenAI tool call schema.
  - How:
    1) Set Provider to "Custom (OpenAI Compatible)".
    2) Enter your API key.
    3) Set "Custom endpoint" to the base URL (e.g., `https://api.example.com/v1`).
  - Notes:
    - Some proxies are strict about tool call ordering; the provider layer already performs message sanitation and retries.
    - If your endpoint does not accept images, keep `sendScreenshotsAsImages` disabled.

### 1.2 Billing/auth service keys (for Stripe + device sign-in)

These keys are only needed if you use the optional billing/auth service under `server/`.

- STRIPE_SECRET_KEY
  - Where: Stripe Dashboard -> Developers -> API keys.
  - Why: Required for creating customers, subscriptions, invoices, and portal sessions.
  - How: Copy the secret key (`sk_live_...` for production, `sk_test_...` for testing) into the server environment.

- STRIPE_PRICE_ID
  - Where: Stripe Dashboard -> Products -> Pricing.
  - Why: Checkout needs a recurring price ID to start a subscription.
  - How: Create or select a product and recurring price, then copy its ID (e.g., `price_...`).

- CHECKOUT_SUCCESS_URL / CHECKOUT_CANCEL_URL
  - Where: Your own app URLs (or the included `server/public/success.html` and `server/public/cancel.html`).
  - Why: Stripe Checkout requires URLs to redirect users after success or cancel.
  - How: Set environment variables to the URL you want users to land on after checkout.

- PORTAL_RETURN_URL
  - Where: Your app URL (usually the account page).
  - Why: Stripe customer portal needs a return URL after the user finishes.

- BASE_URL
  - Where: Your public server URL (e.g., `https://billing.example.com`).
  - Why: Device code verification links include this base.

- ALLOWED_ORIGINS
  - Where: Your deployment configuration.
  - Why: CORS allowlist for the billing/auth service. Use your extension origins during dev.

### 1.3 Account API base URL (extension setting)

- Where: Settings -> Account & billing -> Account API base URL.
- Why: Points the extension to the billing/auth service for device sign-in, entitlement status, checkout, and portal.
- Example: `http://localhost:8787` for local dev.

### 1.4 Optional operational keys (future expansion)

These are not wired yet but are common in production:

- STRIPE_WEBHOOK_SECRET
  - Why: Sync subscription status in real time without polling.
  - Status: Not implemented. Add webhook handlers in `server/src/index.js` if needed.

## 2) Context injection: how much and how many tokens

### 2.1 Where context is injected

The system prompt is assembled in `ai/provider.js` via `enhanceSystemPrompt()`. It merges:

1) Base system prompt from `sidepanel/panel.js#getDefaultSystemPrompt()`.
2) Context lines (URL, title, tab ID, tab list).
3) Tool discipline and safety rules.
4) Optional orchestrator/team profile hints.

### 2.2 Actual sizes (measured)

Measured from the current codebase (character count -> token estimate using the UI estimator of `chars / 4`):

- Base system prompt only:
  - 1,816 chars ~= 454 tokens.

- Full system prompt with 1 tab, no orchestrator/team:
  - 3,160 chars ~= 790 tokens.

- Full system prompt with 1 tab + orchestrator enabled + 2 team profiles:
  - 3,482 chars ~= 871 tokens.

These are estimates. Actual token count depends on the model's tokenizer.

### 2.3 Additional injected overhead

The UI context meter uses:

- `estimateBaseContextTokens()` in `sidepanel/panel.js`
  - `promptTokens ~= prompt.length / 4`
  - `toolBudget = 1200` (approximate schema/tool overhead)
  - `baseContextTokens = promptTokens + toolBudget`

So in practice, before any conversation history:

- Baseline overhead ~= 790 + 1200 = 1,990 tokens
- Orchestrator + team overhead ~= 871 + 1200 = 2,071 tokens

Additional tokens come from:

- Conversation history (user/assistant messages + tool results).
- Tool definitions (variable length based on tools enabled).
- Optional screenshot data if images are sent to a vision model.

## 3) Tools: list and activation rules

### 3.1 Core tools (always available)

Defined in `tools/browser-tools.js`:

- `navigate`: Go to URL
- `click`: Click by selector or text
- `type`: Type text into input
- `pressKey`: Press keyboard key
- `scroll`: Scroll page
- `getContent`: Read page content (text/html/title/url/links)
- `openTab`: Open new tab
- `closeTab`: Close tab
- `switchTab`: Switch to tab
- `getTabs`: List all tabs
- `groupTabs`: Create/clear tab groups
- `focusTab`: Set tab for future actions
- `describeSessionTabs`: List tabs selected for the session

### 3.2 Conditional tools

- `screenshot`
  - Tool is removed entirely if `enableScreenshots` is false (settings).
  - Tool also blocked at execution if `toolPermissions.screenshots` is false.
  - If `visionBridge` is enabled and a vision profile is configured, screenshots are described by the vision model and returned as text for non-vision models.

- `spawn_subagent`, `subagent_complete`
  - Only available when `useOrchestrator` is enabled.
  - `spawn_subagent` accepts a `profile` name (limited to the Team profiles list when set).
  - Sub-agents use the same tool list (minus orchestrator tools) and respect the same tool permission guardrails.

### 3.3 Permission gating

Enforced in `background.js#checkToolPermission()`:

- Tool categories:
  - read: `getContent`
  - interact: `click`, `type`, `pressKey`, `scroll`
  - navigate: `navigate`, `openTab`
  - tabs: `getTabs`, `switchTab`, `closeTab`, `groupTabs`, `focusTab`, `describeSessionTabs`
  - screenshots: `screenshot`

If a category is blocked in `toolPermissions`, the tool returns a blocked error.

### 3.4 Domain allowlist

If `allowedDomains` is configured:

- All non-tab tools are blocked unless the current/target URL matches the allowlist.
- Tabs tools bypass this allowlist check.

## 4) E2E testing options (yes, it is possible)

### 4.1 Recommended approach: Playwright + extension

You can run end-to-end tests by launching Chromium with the extension loaded:

1) Use `chromium.launchPersistentContext()` with:
   - `--disable-extensions-except=<path>`
   - `--load-extension=<path>`
   - (optional) `--allow-file-access-from-files` if using the local HTML fixture.
2) Detect the extension ID from the service worker URL.
3) Open the side panel page with:
   - `chrome-extension://<extensionId>/sidepanel/panel.html`
4) Drive the UI and assert against DOM output.
5) Use `tests/integration/test-page.html` as the deterministic target.

This gives you real UI + tool execution coverage.

### 4.2 Mock providers to avoid API costs

For deterministic tests:

- Set provider to "Custom (OpenAI Compatible)".
- Point `customEndpoint` to a local mock server.
- Return fixed tool calls and assistant responses.

This isolates UI + tool execution logic without paying for tokens.

### 4.3 Example scenarios worth covering

- Sign-in flow (device code -> verification -> access unlocked).
- Subscription flow (checkout opens, entitlement synced).
- Screenshot gating (disabled tool should be blocked).
- Orchestrator + subagent completion (tool presence, summary reported).
- Tool permission blocking and domain allowlist.

## 5) Type safety (yes, it is possible in extensions)

### 5.1 Zero-build option (fastest)

- Add `jsconfig.json` with `"checkJs": true` and `"strict": true`.
- Use `// @ts-check` in key entry points (`background.js`, `sidepanel/panel.js`, `tools/browser-tools.js`).
- Add `@types/chrome` as a dev dependency for Chrome API type hints.

This gives type checking in editors without changing the build.

### 5.2 Full TypeScript build (robust)

Recommended if you want compile-time guarantees:

1) Add `tsconfig.json` and move source into `src/`.
2) Convert entry points to TS: `background.ts`, `sidepanel/panel.ts`, `tools/browser-tools.ts`, etc.
3) Compile to `dist/` with `tsc` (and optional bundler if needed).
4) Update `manifest.json` to point at compiled JS.
5) Add `@types/chrome` and `@types/node` as dev deps.

### 5.3 Runtime safety

For additional safety:

- Validate settings and tool args at runtime (Zod or custom validators).
- Keep schemas for tool inputs and storage payloads in one shared module.

## 6) Source references

- Provider + system prompt injection: `ai/provider.js`
- Default system prompt: `sidepanel/panel.js`
- Tool list: `tools/browser-tools.js`
- Tool activation and permissions: `background.js`
- Billing/auth service: `server/src/index.js`
