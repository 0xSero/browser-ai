# Task 02 — Extract auth/account controller

## Objective
Move auth state, account panel, and billing flows into `sidepanel/auth.ts` while preserving all account UI behavior.

## Files Involved
- `sidepanel/auth.ts` (new)
- `sidepanel/account-client.ts` (reuse)
- `sidepanel/panel.ts` (remove auth/account methods)
- `sidepanel/state.ts` (auth state types)
- `tests/unit/run-unit-tests.ts` (auth state tests)

## Changes
- Create `AuthController` with:
  - `init()` to wire auth UI listeners.
  - `loadAccessState()`, `persistAccessState()`, `normalizeAuthState()`.
  - Account panel rendering (`renderAccountPanel`, `refreshAccountData`).
  - Billing actions (`startSubscription`, `manageBilling`).
- Use `AccountClient` to keep API access centralized.
- Expose callbacks for navigation state updates (e.g., account nav label).

## Tests
- Unit tests for `normalizeAuthState`, `normalizeEntitlement`, and currency/date formatting helpers.

## Validation
- `npm run test:unit`
- `npm run build`

## Acceptance Criteria
- `panel.ts` no longer contains auth/account/billing logic.
- Auth state persistence and account panel UI behave identically.
- Unit tests cover new auth helpers at 100% coverage.