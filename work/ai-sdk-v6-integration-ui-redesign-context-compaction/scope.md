# Scope: AI SDK v6 integration + UI redesign + context compaction

## Goal
Unify the extension around AI SDK v6 for model/tool orchestration, redesign the sidepanel UI to a refined factory.ai-style layout that clearly showcases messages/reasoning/tools, and implement reliable context tracking with automatic compaction (1–2k token summaries) that starts new model sessions while preserving the same chat in the UI.

## Context
The current codebase ships a Chrome extension with a warm-paper UI, a custom `AIProvider` wrapper for OpenAI/Anthropic, manual tool-loop orchestration, and ad hoc context compaction based on message count/char length. The user wants a refined UI and standardized AI SDK v6 flows for tools + streaming + UI state, plus correct context tracking and automatic compaction. UI changes must be rebuilt to `dist/` per `AGENTS.md`.

## Current State (What Exists)
- Runtime message + tool orchestration:
  - `background.ts` handles chat requests, tool execution, and sends UI events (notably `tool_execution`), and includes a duplicated `compactConversationHistory` implementation. (`background.ts:1-742`)
  - `ai/provider.ts` implements OpenAI/Anthropic/custom calls, tool loop, streaming, and usage extraction via direct `fetch`. (`ai/provider.ts`)
  - `ai/message-schema.ts` defines message types and duplicates `compactConversationHistory`. (`ai/message-schema.ts:1-226`)
- UI state + rendering:
  - `sidepanel/panel.ts` manages conversation history, streaming, and tool UI. It has its own `extractThinking` and helpers. (`sidepanel/panel.ts:438-1905`, `sidepanel/panel.ts:2644-2732`)
  - `sidepanel/panel.html` defines header, activity panel (thinking/tools), chat area, and composer. (`sidepanel/panel.html:560-700`)
  - `sidepanel/panel.css` provides warm-paper styling; current activity panel/tool log layout feels cluttered. (`sidepanel/panel.css`)
- Utilities/types (partially integrated):
  - `sidepanel/notes-utils.ts` duplicates thinking extraction. (`sidepanel/notes-utils.ts`)
  - `sidepanel/run-history-utils.ts` provides tool event snapshots and formatting helpers. (`sidepanel/run-history-utils.ts`)
  - `types/plan.ts` + `types/runtime-messages.ts` exist but are not consistently used by runtime message handling. (`types/plan.ts`, `types/runtime-messages.ts`)
- Build pipeline:
  - `scripts/build.mjs` compiles TS and copies `sidepanel/` assets into `dist/`. No bundler for third-party deps. (`scripts/build.mjs`)
- Tests:
  - `tests/unit/run-unit-tests.ts` covers message schema utilities, run-history utils, plan/runtime types, etc. (`tests/unit/run-unit-tests.ts`)

## Target State (What Changes)
- AI SDK v6 becomes the single orchestration layer for all model interactions (streaming, tool calls, reasoning, usage), replacing `ai/provider.ts` and manual tool loops.
- Shared, deduplicated types/utilities for messages, tool events, and compaction live in a common module; `types/runtime-messages.ts` becomes the authoritative schema for background ↔ sidepanel messaging.
- Context tracking is accurate and proactive: token usage is measured (actual usage when available, fallback estimation), and auto-compaction triggers near the configured context limit. Compaction produces 1–2k token summaries and starts a fresh model session while preserving the same UI chat thread.
- Sidepanel UI is redesigned with a refined factory.ai-inspired aesthetic: clearer hierarchy, polished typography, and dedicated zones for messages, reasoning, and tool calls. Tool events become structured cards with status/duration; reasoning is collapsible and optionally surfaced in a side rail.
- Build and tests are updated for new dependencies + updated architecture; dist remains authoritative.

## Integration Plan
1. Establish shared types and utilities:
   - Centralize runtime message types and tool event models.
   - Deduplicate `extractThinking`, `compactConversationHistory`, `truncateText`, and `safeJsonStringify`.
2. AI SDK v6 adoption:
   - Add AI SDK dependencies and introduce a bundling step (or explicit dist packaging) so extension code can import AI SDK modules.
   - Create an AI SDK adapter that exposes existing settings (provider, model, custom endpoint, temperature, etc.) to AI SDK core functions.
   - Replace `AIProvider` usage with AI SDK `streamText/generateText`, enabling tool calling and usage reporting via SDK hooks.
3. Tool model alignment:
   - Convert `BrowserTools` definitions into AI SDK `tool()` definitions with consistent schemas.
   - Preserve existing permission checks and tool execution, but drive them from SDK tool executions.
4. Context manager + compaction:
   - Introduce a `ContextManager` that calculates usage and triggers summary compaction at a configurable threshold (e.g., 80–90%).
   - Implement a summarization prompt that yields a 1–2k token summary, store it as an internal “memory” message, and reset model history while keeping the UI transcript intact.
5. UI redesign + data flow:
   - Update `sidepanel/panel.html` structure to include a refined header, conversation timeline, and a dedicated activity rail (reasoning + tool calls).
   - Rewrite `sidepanel/panel.css` to match factory.ai-style polish (fonts, grid, glass/ink surfaces, improved spacing/contrast).
   - Update `sidepanel/panel.ts` to consume SDK streaming events (reasoning/tool chunks) and render them in the new layout.
6. Testing + validation:
   - Expand unit tests for new shared utilities, context manager, and runtime message parsing.
   - Add integration-like tests for tool streaming events and compaction triggers.
   - Validate build outputs and ensure `dist/` is updated.

## Feature Flagging (if needed)
- Add a `useAiSdk` or `aiSdkMode` setting in local storage to allow rollback to the legacy provider for emergency use (default ON once stable).
- Add `autoCompact` and `autoCompactThreshold` settings (default ON and 85%).

## Testing Plan
- Unit tests (in `tests/unit/run-unit-tests.ts` or new modules):
  - Shared utility functions (thinking extraction, truncation, tool event normalization).
  - Context manager logic (thresholds, summary creation, session rollover).
  - Runtime message validation using `types/runtime-messages.ts`.
- Integration tests:
  - Simulate tool-call streaming (AI SDK `onChunk`/UI message streams) and verify UI receives start/result events.
  - Ensure compaction sends a summary event and model history resets without losing UI transcript.
- E2E/manual:
  - Run `npm run build`, load `dist/` into Chrome, verify streaming, tool cards, reasoning display, and compaction thresholds.

## Non-goals
- No changes to billing server (`server/`) beyond dependency alignment if required.
- No new features unrelated to AI SDK migration, UI redesign, or context compaction.
- No redesign of the extension’s account/billing portal UI beyond minimal alignment if needed.

## Risks & Mitigations
- **Bundling AI SDK for extension**: AI SDK dependencies may require bundling; mitigate by adding a dedicated bundler step (e.g., esbuild) or copying compiled deps into `dist/`.
- **Streaming/tool event compatibility**: Ensure AI SDK `onChunk` events are mapped to runtime message types; add test coverage and fallback to non-streaming mode.
- **Compaction quality/size**: Summary may be too verbose; enforce strict token budget and add guardrails.
- **UI regressions**: Redesign may disrupt usability; mitigate with layout breakpoints and manual QA.

## Assumptions
- The repo is currently in a dirty state; this plan does not attempt to clean or reset it.
- Adding a bundler (or equivalent packaging step) is acceptable to support AI SDK v6 in the extension.
- The “factory.ai” aesthetic implies a refined, minimal, high-contrast UI with structured cards and a right-hand activity rail.
- Compaction can be handled fully client-side using the user’s configured provider/model.
