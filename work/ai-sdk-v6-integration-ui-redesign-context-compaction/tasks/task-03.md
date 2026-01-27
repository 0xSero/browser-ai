# Task 03 — Replace background orchestration with AI SDK

## Objective
Use AI SDK v6 for all background model/tool orchestration, replacing the manual loop in `background.ts` and standardizing runtime messages.

## Files Involved
- `background.ts:69-340` — chat request handling, streaming events, tool loops
- `background.ts:320-560` — tool execution and UI event dispatch
- `ai/provider.ts` — remove or archive legacy usage
- New: `ai/sdk-client.ts` — AI SDK adapter from Task 02
- `types/runtime-messages.ts` — runtime message contracts

## Changes
- Replace `AIProvider` calls with AI SDK `streamText` (streaming) and `generateText` (non-streaming).
- Emit runtime message events based on AI SDK stream chunks:
  - `assistant_stream_start`, `assistant_stream_delta`, `assistant_stream_stop`
  - `tool_execution_start`, `tool_execution_result` for tool calls
  - `assistant_response` / `assistant_final` when complete
- Ensure tool results are surfaced as UI events and forwarded back into AI SDK tool pipeline.
- Preserve subagent tool behavior, but emit typed events via runtime message schema.
- Remove duplicated `compactConversationHistory` logic (use shared utilities).

## Tests
- Add unit tests for chunk-to-runtime-message mapping.
- Add integration test harness that mocks tool calls and validates event sequencing.

## Validation
- `npm run test:unit`
- `npm run typecheck`

## Acceptance Criteria
- Background no longer uses legacy `AIProvider` for primary chat flows.
- Runtime messages follow the canonical schema in `types/runtime-messages.ts`.
- Streaming UI updates correctly reflect tool calls and reasoning chunks.
