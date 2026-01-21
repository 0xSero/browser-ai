# Rules: Sidepanel modularization and agent loop cleanup

## Non-negotiables
1. Do not ask questions. If blocked, make best-effort decisions and document assumptions.
2. Keep behavior stable; only reorganize code and add minimal interfaces.
3. UI changes must be followed by `npm run build` so `dist/sidepanel/` stays in sync.
4. Add realistic unit + integration + E2E tests for new/changed modules.
5. Enforce strict coverage for new/changed modules within scope.

## Branching & Hygiene
- Start from a clean working tree and a dedicated branch.
- Avoid drive-by refactors outside the module split and agent-loop extraction.
- Keep commits small and reversible.

## Engineering Practices
- Prefer explicit controller interfaces and dependency injection (elements, state, runtime port).
- Keep modules small and cohesive; avoid cross-module circular imports.
- Move pure logic to `extension-helpers.ts` or dedicated utility modules with tests.

## Testing & Coverage
- Unit: helpers, state normalization, agent loop utilities.
- Integration: runtime message routing (chat + tools), settings persistence flow.
- E2E: tool stream ordering + error recovery with existing harness.
- Coverage: 100% for new/changed modules in scope.

## Feature Flags (Not planned)
- No feature flags are expected. If introduced, they must be default-off and gated at both UI and runtime.

## Definition of Done
- `npm run build`, `npm run test:unit`, and `npm run test:e2e` pass.
- `sidepanel/panel.ts` is a minimal entrypoint (<~300 LOC) with clear module wiring.
- Agent loop logic is isolated in a dedicated module and used by background flows.
- Dist assets regenerated and verified.