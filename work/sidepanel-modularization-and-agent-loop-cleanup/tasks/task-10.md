# Task 10 — Rebuild sidepanel entrypoint wiring

## Objective
Shrink `sidepanel/panel.ts` into a thin entrypoint that wires the new controllers together.

## Files Involved
- `sidepanel/panel.ts`
- `sidepanel/*` new modules (chat, tools, settings, auth, history, tabs, agents, runtime)

## Changes
- Create `SidePanelApp` (or similar) that:
  - Instantiates controllers with shared state + element registry.
  - Wires cross-module callbacks (settings → chat model display, auth → nav label).
  - Initializes runtime router.
- Remove legacy methods from `panel.ts` once moved to controllers.
- Ensure `panel.ts` remains the only entrypoint for esbuild.

## Tests
- Integration tests for module wiring using mock controllers and runtime events (added to `tests/unit`).

## Validation
- `npm run test:unit`
- `npm run build`

## Acceptance Criteria
- `panel.ts` is small and only coordinates modules.
- No functionality regressions in the sidepanel UI.