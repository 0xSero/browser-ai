# Task 07 — Extract tab selector controller

## Objective
Move tab selector and selected-tab context logic into `sidepanel/tabs.ts`.

## Files Involved
- `sidepanel/tabs.ts` (new)
- `sidepanel/panel.ts` (remove tab selection methods)
- `tests/unit/run-unit-tests.ts` (tab context tests)

## Changes
- Create `TabsController` with:
  - `loadTabs`, `toggleTabSelector`, `toggleTabSelection`, `updateSelectedTabsBar`.
  - `getSelectedTabsContext()` to provide runtime context.
- Keep DOM classnames and UX unchanged.

## Tests
- Unit tests for `getSelectedTabsContext` and group color mapping.

## Validation
- `npm run test:unit`
- `npm run build`

## Acceptance Criteria
- Tab selection and context extraction behave identically.
- `panel.ts` no longer owns tab selector logic.