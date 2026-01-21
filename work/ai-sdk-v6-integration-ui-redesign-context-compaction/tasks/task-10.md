# Task 10 — Build + QA pass

## Objective
Verify final behavior in the extension and ensure `dist/` is up to date.

## Files Involved
- `scripts/build.mjs`
- `dist/sidepanel/*`
- `dist/background.js` (or bundled output)

## Changes
- Run full build and update `dist/` outputs.
- Perform manual QA:
  - Streaming response with tool calls.
  - Reasoning content display.
  - Auto-compaction trigger and summary marker.
  - Start new session and history replay.

## Tests
- `npm run build`
- `npm run test:unit`

## Validation
- Load `dist/` in Chrome extensions and verify UX against requirements.

## Acceptance Criteria
- `dist/` reflects UI and background changes.
- All tests pass.
- Manual QA confirms design and compaction behavior.
