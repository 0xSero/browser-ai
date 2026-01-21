# Task 11 — Regression tests, dist rebuild, and cleanup

## Objective
Validate the refactor with automated tests and rebuild the extension output.

## Files Involved
- `dist/sidepanel/panel.js` (generated)
- `dist/sidepanel/panel.css` (copied)
- `dist/sidepanel/panel.html` (copied)
- Test outputs (no repo edits)

## Changes
- Run the full build/test pipeline after refactor.
- Ensure dist assets are regenerated to match new module structure.

## Tests
- `npm run test:unit`
- `npm run test:e2e`

## Validation
- `npm run build`
- Manual smoke check: open sidepanel, send a message, verify tool stream ordering and auth panel.

## Acceptance Criteria
- Tests pass with no new failures.
- Dist artifacts updated and extension loads cleanly.