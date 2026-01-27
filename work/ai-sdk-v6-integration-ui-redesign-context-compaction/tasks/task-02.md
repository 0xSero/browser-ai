# Task 02 — AI SDK core wrapper + tool definitions

## Objective
Create an AI SDK v6 adapter that translates existing settings and BrowserTools into AI SDK models and tool definitions.

## Files Involved
- `ai/provider.ts` — legacy provider (to be superseded)
- `tools/browser-tools.ts` — tool definitions and execution logic
- New: `ai/sdk-client.ts` (or similar) — AI SDK adapter
- New/updated: shared tool schema/type module from Task 00

## Changes
- Implement `ai/sdk-client.ts` that:
  - Builds provider models (OpenAI/Anthropic/custom endpoint) from settings.
  - Exposes `streamText`/`generateText` entry points.
  - Maps settings like `temperature`, `maxTokens`, `customEndpoint` into AI SDK options.
- Convert `BrowserTools.getToolDefinitions()` into AI SDK `tool()` definitions:
  - Ensure JSON schema inputs align with AI SDK tool requirements.
  - Provide tool metadata (description) and execute handlers that call existing `BrowserTools.executeTool`.
- Add hooks for `spawn_subagent` and `subagent_complete` as AI SDK tools.
- Keep backward-compatible tool permission checks by wrapping tool execution.

## Tests
- Add unit coverage for tool schema conversion and adapter creation.

## Validation
- `npm run test:unit`
- `npm run typecheck`

## Acceptance Criteria
- AI SDK adapter can be constructed from existing settings.
- BrowserTools definitions are exposed as AI SDK-compatible tools.
- Tool execution still respects permissions/limits.
