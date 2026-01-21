# Task 09 — Extract AI SDK agent loop module

## Objective
Move the AI SDK streaming loop and tool execution orchestration out of `background.ts` into a dedicated agent-loop module, shared by main and sub-agent runs.

## Files Involved
- `ai/agent-loop.ts` (new) **or** `background/agent-runner.ts` (new)
- `background.ts` (rewire to new module)
- `ai/sdk-client.ts`, `ai/retry-engine.ts` (reuse)
- `tests/unit/run-unit-tests.ts` (agent loop tests)

## Changes
- Implement `runAgentTurn()` with:
  - Inputs: model settings, system prompt, messages, tool definitions, runtime event callbacks.
  - AI SDK `streamText` invocation with reasoning delta routing.
  - Tool execution hooks (via `buildToolSet` + `executeToolByName`).
  - Final response validation and fallback logic.
- Implement `runSubagentTurn()` or parameterize `runAgentTurn()` for subagents.
- Update `background.ts` to call the agent-loop module for both main and sub-agent flows.

## Tests
- Unit tests for:
  - Streaming delta routing (reasoning vs content).
  - Tool error handling (exceptions converted to tool result errors).
  - Final response validation with tool-only runs.

## Validation
- `npm run test:unit`
- `npm run build`

## Acceptance Criteria
- `background.ts` is significantly smaller and only wires inputs/outputs.
- Agent loop behavior (streaming + tools + retries) remains unchanged.