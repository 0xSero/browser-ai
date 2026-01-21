# Task 00 — Scaffold shared types, DOM registry, and helpers

## Objective
Create the foundational building blocks for the refactor: typed element registry, shared state interfaces, and extracted pure helpers. `panel.ts` should compile with these new modules while keeping behavior unchanged.

## Files Involved
- `sidepanel/panel.ts` (replace inline helper functions + element lookup)
- `sidepanel/extension-helpers.ts` (new)
- `sidepanel/dom.ts` (new)
- `sidepanel/state.ts` (new)
- `tests/unit/run-unit-tests.ts` (add tests for helpers)

## Changes
- Create `sidepanel/state.ts` with:
  - `SidePanelState` (sessionId, histories, streaming flags, auth state, configs).
  - `SidePanelConfig` shape for settings/profile values.
- Create `sidepanel/dom.ts`:
  - `SidePanelElements` type matching IDs used in `panel.html`.
  - `getSidePanelElements()` to fetch DOM references in one place.
- Create `sidepanel/extension-helpers.ts`:
  - Move pure helpers from `panel.ts` (`safeJsonStringify`, `truncateText`, `escapeHtml`, `escapeAttribute`, formatting helpers).
  - Keep these helpers DOM-free for unit testing.
- Update `panel.ts` to import helpers and DOM registry; remove duplicated utility methods from the class.

## Tests
- Add unit tests for `extension-helpers.ts` functions in `tests/unit/run-unit-tests.ts`.

## Validation
- `npm run test:unit`
- `npm run build`

## Acceptance Criteria
- New helper modules exist and are used by `panel.ts` without behavior changes.
- Unit tests cover helper functions with 100% coverage for new helpers.
- Build succeeds with no runtime warnings.