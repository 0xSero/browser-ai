# Task 08 — Session storage + history alignment

## Objective
Align UI history persistence with the new model session/compaction flow so users keep a continuous chat transcript.

## Files Involved
- `sidepanel/panel.ts:2660-2745` — history persistence and loading
- `sidepanel/panel.ts:1720-1766` — sendMessage behavior
- `background.ts:69-205` — message handling contract
- `types/runtime-messages.ts` — add compaction event types

## Changes
- Update message contract to include `sessionId` and minimize payload sizes (only send new user messages).
- Store compaction summaries and markers in local history entries so history view reflects session boundaries.
- Ensure `startNewSession` still creates a new UI session while background clears model history.

## Tests
- Unit tests for history persistence including compaction markers.

## Validation
- Manual: verify history view shows compaction markers after long sessions.

## Acceptance Criteria
- History entries preserve full chat transcript plus compaction notes.
- Background session state remains coherent across new sessions.
