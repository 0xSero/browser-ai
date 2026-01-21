# Task 06 — Extract history/session controller

## Objective
Move history persistence, session rendering, and context usage tracking into `sidepanel/history.ts`.

## Files Involved
- `sidepanel/history.ts` (new)
- `sidepanel/panel.ts` (remove history methods)
- `ai/message-schema.ts` (reuse)
- `tests/unit/run-unit-tests.ts` (history serialization tests)

## Changes
- Create `HistoryController` with:
  - `persistHistory`, `loadHistoryList`, `renderConversationHistory`.
  - `updateContextUsage`, `estimateBaseContextTokens`.
  - Interfaces to provide `displayHistory`/`contextHistory` to chat controller.
- Preserve existing storage keys + data formats.

## Tests
- Unit tests for history serialization and context usage calculations.

## Validation
- `npm run test:unit`
- `npm run build`

## Acceptance Criteria
- History panel behavior remains unchanged.
- History data persists and reloads exactly as before.
- `panel.ts` no longer contains history/session logic.