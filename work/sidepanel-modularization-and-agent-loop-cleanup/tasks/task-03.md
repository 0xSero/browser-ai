# Task 03 — Extract chat controller (rendering + streaming)

## Objective
Move chat rendering, streaming event timeline, markdown formatting, and scroll management into `sidepanel/chat.ts`.

## Files Involved
- `sidepanel/chat.ts` (new)
- `sidepanel/panel.ts` (remove chat + streaming logic)
- `sidepanel/extension-helpers.ts` (shared helpers)
- `tests/unit/run-unit-tests.ts` (chat helper tests)

## Changes
- Create `ChatController` with:
  - `displayUserMessage`, `displayAssistantMessage`, `displaySummaryMessage`.
  - Streaming API: `startStreamingMessage`, `updateStreamingText`, `updateStreamingReasoning`, `completeStreamingMessage`.
  - `renderMarkdown` with the current custom markdown rules.
  - Scroll controls and the "scroll to latest" logic.
- Ensure chat controller exposes hooks to append tool events in-order.

## Tests
- Unit tests for `renderMarkdown` edge cases (lists, code blocks, inline formatting).
- Unit tests for thinking extraction + dedupe when called through chat controller.

## Validation
- `npm run test:unit`
- `npm run build`

## Acceptance Criteria
- `panel.ts` no longer owns chat/streaming rendering logic.
- Streaming order stays identical, including reasoning/text/tool sequencing.
- Chat output matches existing formatting.