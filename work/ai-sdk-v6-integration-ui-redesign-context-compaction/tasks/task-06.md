# Task 06 — Redesign sidepanel layout + styling

## Objective
Implement a refined factory.ai-inspired layout that cleanly showcases messages, reasoning, and tools.

## Files Involved
- `sidepanel/panel.html:1-700` — structural layout
- `sidepanel/panel.css` — visual design system and components
- `sidepanel/panel.ts` — DOM query selectors for new structure

## Changes
- Update `panel.html` to introduce a clearer app frame:
  - Header with compact account + settings actions.
  - Main content area with conversation timeline.
  - Right-side activity rail for reasoning + tool cards (collapsible on small widths).
  - Dedicated compaction banner component.
- Rewrite CSS tokens to align with factory.ai aesthetic:
  - Stronger typographic hierarchy, refined spacing, subtle gradients.
  - Elevated card components for messages, tools, and summaries.
  - Purposeful motion: entrance fade/slide and tool status transitions.
- Ensure responsive behavior for small sidepanel widths.

## Tests
- Visual/manual QA in Chrome (no automated test additions required here).

## Validation
- `npm run build`
- Load `dist/` in Chrome sidepanel and verify layout across narrow/wide widths.

## Acceptance Criteria
- UI matches refined aesthetic and preserves readability.
- Reasoning and tool calls are clearly separated and discoverable.
- Layout works on small and large sidepanel widths.
