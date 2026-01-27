# Task 00 — Consolidate shared types & utilities

## Objective
Create a single source of truth for runtime message types, tool event models, and shared chat utilities, eliminating duplicated logic before the AI SDK and UI refactor lands.

## Files Involved
- `ai/message-schema.ts:1-226` — duplicate `compactConversationHistory` and message models
- `background.ts:1-742` — duplicate `compactConversationHistory`, runtime message variants
- `sidepanel/panel.ts:438-1905` — runtime message handling + local utilities
- `sidepanel/panel.ts:2644-2732` — `extractThinking`, context estimation utilities
- `sidepanel/notes-utils.ts` — duplicate `extractThinking`
- `sidepanel/run-history-utils.ts` — tool snapshot utilities
- `types/runtime-messages.ts` — canonical runtime message schema (currently unused)

## Changes
- Create a shared utilities module (e.g., `shared/chat-utils.ts` or `types/chat-utils.ts`) that exports:
  - `extractThinking` (replace `sidepanel/panel.ts` inline helper)
  - `compactConversationHistory` (replace `background.ts` + `ai/message-schema.ts` duplicates)
  - `truncateText`, `safeJsonStringify` (use in both panel + run-history utils)
- Promote `types/runtime-messages.ts` as the runtime message contract:
  - Update `background.ts` and `sidepanel/panel.ts` to use `RuntimeMessage` types and validators where possible.
  - Replace legacy `tool_execution` events with `tool_execution_start` + `tool_execution_result` where feasible, or add a typed union that clearly marks legacy messages.
- Remove duplicated helper implementations once imports are in place.

## Tests
- Add/update unit tests in `tests/unit/run-unit-tests.ts` to cover:
  - `extractThinking` behavior for `<think>`/`<analysis>` content
  - `compactConversationHistory` for length and message trimming
  - runtime message validation (`isRuntimeMessage`)

## Validation
- `npm run test:unit`
- `npm run typecheck`

## Acceptance Criteria
- No duplicate utility implementations remain for thinking extraction or compaction.
- Runtime messages are typed via `types/runtime-messages.ts` in background + panel.
- Unit tests cover new shared utilities and message validation.
