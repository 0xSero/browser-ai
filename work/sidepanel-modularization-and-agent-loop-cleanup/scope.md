# Scope: Sidepanel modularization and agent loop cleanup

## Goal
- Break `sidepanel/panel.ts` (~4k LOC) into focused, testable modules (settings, chat, tools, auth, shared helpers).
- Keep UI behavior identical while making the sidepanel codebase debuggable and maintainable.
- Extract the AI SDK agent loop into a dedicated module so `background.ts` is small and explicit.

## Context
- Requested refactor to split monolithic `sidepanel/panel.ts` into smaller files (`settings.ts`, `chat.ts`, `tools.ts`, `extension-helpers.ts`, `auth.ts`, plus any supporting modules).
- Current runtime ordering and tool UI fixes have made `panel.ts` harder to navigate; a clean module split is required before further iteration.
- “Agent loop via the ai-sdk” should live in a dedicated module (not inline in `background.ts`).

## Current State (What Exists)
- **`sidepanel/panel.ts`**
  - Single `SidePanelUI` class owns: DOM element caching, event listener wiring, settings/profile CRUD, auth/account UX, chat rendering/streaming, tool log + activity panel, history, tabs, agent nav/subagents, scrolling/escape helpers, and runtime message routing.
  - Key method clusters:
    - Settings/configs: `loadSettings`, `saveSettings`, `persistAllSettings`, `collectProfileEditorData`, `switchConfig`, `renderProfileGrid`.
    - Auth/account/billing: `loadAccessState`, `startEmailAuth`, `manageBilling`, `renderAccountPanel`.
    - Chat/streaming: `sendMessage`, `startStreamingMessage`, `updateStreamingMessage`, `updateStreamReasoning`, `displayAssistantMessage`.
    - Tools/activity: `displayToolExecution`, `updateToolMessage`, `updateActivityState`.
    - History/tabs/subagents: `renderConversationHistory`, `loadTabs`, `addSubagent`.
- **`sidepanel/panel.html` / `sidepanel/panel.css`** define UI sections and IDs used by `panel.ts`.
- **Helper modules:** `sidepanel/account-client.ts`, `sidepanel/run-history-utils.ts`, `sidepanel/notes-utils.ts`.
- **`background.ts`** contains AI SDK `streamText` loop, tool execution, and sub-agent spawning inline in one class.
- Build pipeline (`scripts/build.mjs`) bundles `sidepanel/panel.ts` and copies `panel.html/panel.css` to `dist/`.

## Target State (What Changes)
- `sidepanel/panel.ts` becomes a small entrypoint that wires modules together.
- New modules (exact filenames may vary but must cover these responsibilities):
  - `sidepanel/extension-helpers.ts`: shared pure utilities (escape/sanitize, truncate, formatting, safe JSON, etc.).
  - `sidepanel/chat.ts`: chat rendering + streaming event timeline, markdown rendering, scroll logic, message history display.
  - `sidepanel/tools.ts`: tool execution UI, activity panel/log, error banners.
  - `sidepanel/settings.ts`: settings UI, profile/config management, storage IO.
  - `sidepanel/auth.ts`: auth state + account/billing UX using `AccountClient`.
  - Supporting modules as needed: `sidepanel/history.ts`, `sidepanel/tabs.ts`, `sidepanel/agents.ts`, `sidepanel/runtime.ts`, `sidepanel/dom.ts`, `sidepanel/state.ts`.
- **Agent loop module** (new, e.g. `ai/agent-loop.ts` or `background/agent-runner.ts`) owns:
  - AI SDK `streamText` invocation, chunk routing, tool execution hooks, retry/final response handling.
  - Used by both main agent and sub-agent flows.
- Behavior and UI remain unchanged; only code organization and clear interfaces change.

## Integration Plan
1. Introduce shared types (`SidePanelElements`, `SidePanelState`, controller interfaces) and `extension-helpers.ts`.
2. Extract settings + auth/account modules, leaving compatible method signatures.
3. Extract chat streaming + tool UI modules; introduce explicit event timeline API.
4. Move history, tabs, and agent-nav behaviors into their own controllers.
5. Add a runtime message router module to mediate background ↔ UI events.
6. Extract AI SDK agent loop from `background.ts` into a dedicated module and rewire background to call it.
7. Update tests, rebuild, and keep `dist/sidepanel/` in sync.

## Testing Plan
- **Unit:**
  - Pure helper utilities in `extension-helpers.ts`.
  - Settings/auth normalization logic (e.g., profile and auth state normalization).
  - Agent loop helpers (e.g., event sequencing, final response validation) with mocks.
- **Integration:**
  - Runtime message routing across `chat` + `tools` controllers using mocked runtime messages.
- **E2E:**
  - Existing `tests/e2e` flow and a new scenario for tool stream ordering + error recovery.
- **Coverage:** 100% for new/changed modules within scope.

## Non-goals
- No UI redesign or new features.
- No change to tool APIs or AI provider behavior.
- No framework migration (keep ES modules + esbuild).

## Risks & Mitigations
- **Risk:** Regressions due to event wiring changes.
  - *Mitigation:* Extract incrementally with compatibility shims + integration tests.
- **Risk:** Hard-to-test DOM logic.
  - *Mitigation:* Move pure logic to helpers; keep DOM operations thin.
- **Risk:** Agent loop refactor breaks streaming or tool execution.
  - *Mitigation:* Add unit tests + run `test:e2e` after wiring.

## Assumptions
- Keep existing `panel.html` element IDs and CSS class names unchanged.
- Continue using `scripts/build.mjs` and esbuild bundling.
- Work will be performed on a clean branch even though the current working tree is dirty.
