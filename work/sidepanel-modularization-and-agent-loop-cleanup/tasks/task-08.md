# Task 08 — Extract agent/subagent controller

## Objective
Move subagent tracking and agent navigation UI into a dedicated controller for clarity and testability.

## Files Involved
- `sidepanel/agents.ts` (new)
- `sidepanel/panel.ts` (remove subagent methods)
- `tests/unit/run-unit-tests.ts` (agent state tests)

## Changes
- Create `AgentController` with:
  - `addSubagent`, `updateSubagentStatus`, `renderAgentNav`, `switchAgent`.
  - `activeAgent` state + UI toggle handling.
- Provide events/callbacks to chat/history modules for agent switching.

## Tests
- Unit tests for agent state changes and active agent selection logic.

## Validation
- `npm run test:unit`
- `npm run build`

## Acceptance Criteria
- Agent nav behavior stays unchanged.
- `panel.ts` no longer owns subagent logic.