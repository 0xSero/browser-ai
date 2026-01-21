# Task 05 — Create runtime message router

## Objective
Isolate `chrome.runtime` message handling into a single router module that dispatches to chat/tools/settings/history controllers.

## Files Involved
- `sidepanel/runtime.ts` (new)
- `sidepanel/panel.ts` (remove runtime listener + switch)
- `types/runtime-messages.ts` (reuse schema)
- `tests/unit/run-unit-tests.ts` (router tests)

## Changes
- Implement `RuntimeRouter` with:
  - `attach()` to subscribe to runtime messages.
  - `handleMessage()` to validate via `isRuntimeMessage` and dispatch to controllers.
  - Event hooks for `assistant_stream_*`, `tool_execution_*`, `run_error`, `context_compaction`.
- Provide a strict mapping table so adding new runtime events is explicit.

## Tests
- Unit tests for routing behavior with mocked controllers and representative runtime messages.

## Validation
- `npm run test:unit`
- `npm run build`

## Acceptance Criteria
- `panel.ts` no longer contains a large `handleRuntimeMessage` switch.
- Runtime events dispatch to the correct controller methods.
- Invalid runtime messages are ignored safely.