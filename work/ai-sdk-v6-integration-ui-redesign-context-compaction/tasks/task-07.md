# Task 07 — Wire UI behavior to new layout

## Objective
Update sidepanel logic to drive the redesigned layout, including activity rail, tool cards, reasoning sections, and compaction markers.

## Files Involved
- `sidepanel/panel.ts:438-520` — message event handling
- `sidepanel/panel.ts:2133-2563` — tool rendering
- `sidepanel/panel.ts:2527-2547` — reasoning panel updates
- `sidepanel/panel.ts:2840-2895` — session reset logic
- `sidepanel/run-history-utils.ts` — tool event snapshots

## Changes
- Rework DOM queries to match new panel layout and rail components.
- Update `displayToolExecution` to render structured tool cards (status, args, result, duration, error state).
- Render reasoning content into the activity rail (with inline link to open/close).
- Insert compaction markers into chat timeline when background emits compaction events.
- Keep history and scroll behaviors consistent with the new layout.

## Tests
- Unit tests for tool card rendering (string sanitization, error state).

## Validation
- `npm run test:unit`
- Manual QA: send a prompt that triggers tools and reasoning; verify layout updates.

## Acceptance Criteria
- Tool calls, reasoning, and compaction markers render cleanly in the new layout.
- Activity rail remains in sync with streaming events.
