# Task 04 — Extract tool execution controller

## Objective
Move tool execution UI (inline tool events, activity panel, tool log) into `sidepanel/tools.ts` with a clean API used by chat/runtime modules.

## Files Involved
- `sidepanel/tools.ts` (new)
- `sidepanel/run-history-utils.ts` (reuse)
- `sidepanel/panel.ts` (remove tool/event UI logic)
- `tests/unit/run-unit-tests.ts` (tool helper tests)

## Changes
- Create `ToolController` with:
  - `handleToolStart`, `handleToolResult`.
  - Tool log entry rendering + updates.
  - Activity panel state + error banner logic.
- Keep inline tool rendering compatible with the stream event timeline.
- Move `getArgsPreview` and preview formatting to helpers (pure function for tests).

## Tests
- Unit tests for args preview + result formatting.
- Unit tests for tool snapshot creation using `run-history-utils`.

## Validation
- `npm run test:unit`
- `npm run build`

## Acceptance Criteria
- Tool logs and activity panel look/behave identically.
- Tool events render inside the streaming timeline in correct order.
- `panel.ts` no longer contains tool-related DOM logic.