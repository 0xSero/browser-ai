# Task 09 — Expand tests for AI SDK + compaction

## Objective
Add coverage for AI SDK integration points, tool streaming, and compaction behaviors.

## Files Involved
- `tests/unit/run-unit-tests.ts` — add cases for SDK adapter, context manager
- New: `tests/unit/context-manager.test.ts` (if splitting unit tests)
- New: `tests/unit/ui-message-store.test.ts` (if extracting UI message store)

## Changes
- Add tests for:
  - AI SDK adapter creation with OpenAI/Anthropic/custom endpoint settings.
  - Tool definition conversion to AI SDK format.
  - Context manager summary creation + threshold triggering.
  - Runtime message validation for new compaction event.

## Tests
- `npm run test:unit`

## Validation
- `npm run test:unit`

## Acceptance Criteria
- New unit tests cover AI SDK adapter, tool conversion, and compaction.
- All unit tests pass.
