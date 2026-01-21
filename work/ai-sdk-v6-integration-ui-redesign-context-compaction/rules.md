# Rules: AI SDK v6 integration + UI redesign + context compaction

## Non-negotiables
1. Do not ask questions; make best-effort decisions and document assumptions.
2. Keep changes minimal and reversible; avoid unrelated refactors.
3. Add realistic unit + integration + E2E coverage for new/changed modules.
4. Enforce strict coverage for new/changed modules in scope only.
5. UI changes must be reflected in `dist/` by running `npm run build` before handoff.

## Branching & Hygiene
- Work on a dedicated branch when implementation begins.
- Avoid touching unrelated files; do not revert existing unrelated changes.
- Keep commits small and logically grouped (types/utilities → AI SDK integration → UI → tests).

## Engineering Practices
- Centralize shared types/utilities in `types/` or a dedicated `shared/` module.
- Keep runtime message schema explicit and validated using `types/runtime-messages.ts`.
- Preserve existing tool permission checks and fail-closed behavior.
- Ensure AI SDK integration does not leak API keys or sensitive tool outputs.

## Testing & Coverage
- Unit tests: update `tests/unit/run-unit-tests.ts` or add new unit modules for shared utilities and compaction.
- Integration tests: validate tool-event sequencing and streaming UI rendering.
- E2E/manual: load `dist/` extension and verify core workflows.

## Security/Privacy
- Never log API keys or full page content to console.
- Ensure summaries do not include sensitive data beyond what is already in chat history.
- Keep access tokens and billing data confined to existing storage flows.

## Definition of Done
- AI SDK v6 is the only orchestration layer used for chat/tool execution.
- Context compaction triggers reliably near the configured limit and preserves UI transcript.
- UI redesigned to factory.ai-inspired layout with clear message/reasoning/tool organization.
- `npm run build` completes and `dist/` is updated.
- Tests pass (`npm run test:unit` at minimum; additional coverage as defined in scope).
