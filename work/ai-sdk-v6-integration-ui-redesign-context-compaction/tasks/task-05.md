# Task 05 — UI message model + streaming integration

## Objective
Adopt AI SDK UI message streams for sidepanel rendering, ensuring reasoning/tool updates are structured and consistent.

## Files Involved
- `sidepanel/panel.ts:438-520` — runtime message handling
- `sidepanel/panel.ts:1788-2133` — streaming + assistant rendering
- `sidepanel/run-history-utils.ts` — tool snapshots
- `types/runtime-messages.ts` — runtime message schema
- New: `sidepanel/ui-message-store.ts` (or similar) — UI message normalization

## Changes
- Integrate AI SDK UI utilities (`readUIMessageStream` / UIMessage parsing) to convert streaming events into structured UI messages.
- Replace ad hoc streaming handling with:
  - A normalized UI message store (messages + tool events + reasoning parts).
  - Direct mapping of tool calls/results to tool cards (status/duration/error state).
- Ensure `reasoning_content` (or thinking) is stored separately and rendered in a collapsible panel or activity rail.
- Update `run-history-utils.ts` usage for consistent tool previews and error handling.

## Tests
- Unit tests for UI message store normalization.
- Unit tests for tool event mapping (start → result → success/error).

## Validation
- `npm run test:unit`
- Manual: streaming tool calls show in UI immediately and finalize with results.

## Acceptance Criteria
- Sidepanel renders streaming content via structured UI messages.
- Tool events are grouped and consistent with reasoning content.
- Legacy `tool_execution` handling is removed or explicitly shimmed.
