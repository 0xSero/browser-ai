# Task 04 — Context manager + auto-compaction

## Objective
Implement accurate context tracking and automatic compaction that summarizes history into 1–2k tokens and starts a new model session while preserving the UI transcript.

## Files Involved
- `background.ts:183-205` — currently compacts by message count only
- `sidepanel/panel.ts:2678-2732` — local context estimation
- `sidepanel/panel.ts:2840-2895` — `startNewSession` behavior
- New: `ai/context-manager.ts` — session + compaction logic
- New: `types/context.ts` or shared types

## Changes
- Add `ContextManager` that:
  - Tracks usage from AI SDK responses and estimates tokens when usage is missing.
  - Checks threshold (e.g., 85% of `contextLimit`) before each model call.
  - Triggers a summarization call (AI SDK `generateText`) when threshold is exceeded.
  - Stores summary as a “memory” message and resets model history while preserving UI history.
- Update background to manage session state instead of relying on UI-sent full history:
  - UI sends `sessionId` + new user message; background loads/stores model history.
  - Persist minimal session state in `chrome.storage.session` (summary + recent turns).
- Add a new runtime message type (e.g., `context_compacted` or `run_status` note) so UI can display compaction events and summary previews.
- Update UI to show compaction markers and keep chat history intact.

## Tests
- Unit tests for `ContextManager` threshold logic and summary size enforcement.
- Unit tests for session rollover (summary stored + history reset).

## Validation
- `npm run test:unit`
- Manual: simulate long chat until compaction triggers; verify summary and continued conversation.

## Acceptance Criteria
- Compaction triggers near configured limit and produces 1–2k token summaries.
- Model session restarts without deleting the visible UI transcript.
- UI receives and displays compaction markers cleanly.
