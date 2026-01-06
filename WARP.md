# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

### Testing & Validation
```bash
npm test                # Full test suite (validation + unit tests)
npm run validate        # Validate manifest, files, and structure
npm run test:unit       # Unit tests only
npm run lint            # Lint check
npm run build           # Validate extension (no bundling)
```

### Development Workflow
```bash
npm run dev             # Shows instructions for loading extension
```

**Local Testing:**
1. Open `chrome://extensions` → Enable Developer Mode
2. Click "Load unpacked" → Select repository root
3. Pin extension to toolbar
4. Open side panel via toolbar icon
5. For tool testing: open `tests/integration/test-page.html` in browser

**Node 23+ Corepack Issue:** If `npm` fails with Corepack signature error, run `node scripts/run-checks.mjs` instead, or run `corepack disable` once.

## Architecture Overview

### Core Service Worker Pattern
**background.js** is the orchestrator that:
- Manages AI provider instances (main, vision, orchestrator)
- Executes tool execution loops with retry logic
- Handles sub-agent spawning/coordination when orchestrator mode is enabled
- Compacts conversation history when approaching context limits
- Applies safety guards (URL validation, destructive action prevention)

**Key flow:** User message → normalize history → initialize providers → AI chat with tools → tool execution loop (max 1000 iterations) → handle streaming/followups → return response

### Provider Abstraction Layer
**ai/provider.js** handles:
- Multi-provider support (OpenAI, Anthropic, custom endpoints)
- Message format translation between internal schema and provider APIs
- Tool definition conversion (Anthropic vs OpenAI formats)
- Streaming support with delta callbacks
- Retry logic for tool ordering errors (common with proxy endpoints routing to Anthropic)
- Vision bridge mode: routes screenshots to vision-capable profiles, returns text descriptions

**Message normalization:** Internal format uses `toolCalls`/`toolCallId` fields. `ai/message-schema.js` normalizes between formats and converts to provider-specific payloads via `toProviderMessages()`.

### Browser Automation Layer
**tools/browser-tools.js** provides:
- Session tab management: tracks selected tabs, creates groups (preserving user-created groups)
- Page glow effect: visual feedback on tabs being automated
- Tool implementations: navigate, click (with text-based fallback), type, scroll, screenshot, getContent, tab operations
- Safety validation: blocks `javascript:`, `data:`, `chrome:` schemes
- Focus/switch/describe operations for multi-tab workflows

**Tool registration:** Tools must be added in both `initializeTools()` (method binding) and `getToolDefinitions()` (schema for LLM).

### UI Architecture
**sidepanel/** contains:
- `panel.html`: Side panel with Live/History tabs, settings, agent teams, tab selector
- `panel.js`: Manages conversation history, streaming state, tool timeline, profile management, sub-agent tracking
- `panel.css`: Warm Paper design system (Geist Sans, warm hues, card shadows, subtle animations)

**Key UI patterns:**
- Streaming deltas render incrementally with `<think>` block extraction
- Tool timeline shows progress rings for pending/completed tools
- Agent teams panel: assign Main/Vision/Orchestrator/Team roles via pill buttons
- Profile editor: in-panel editing without leaving agent library tab

### Orchestrator & Sub-Agents
When `useOrchestrator` is enabled:
- Exposes `spawn_subagent` and `subagent_complete` tools
- Main agent delegates subtasks to focused helpers (max 4 simultaneous)
- Each sub-agent has isolated history, runs tools independently
- Sub-agent returns structured summary via `subagent_complete`
- Orchestrator profile can differ from main profile

### Content Script Utilities
**content.js** provides DOM helpers for:
- Element highlighting (green pulse outline)
- Hover simulation
- Page metadata extraction (title, description, keywords)
- Injected by manifest into all pages at `document_idle`

## Code Style

- **JavaScript:** ES modules (`"type": "module"` in package.json)
- **Indentation:** 2 spaces, semicolons, single quotes
- **Entry points:** `background.js`, `content.js`, `sidepanel/panel.js` orchestrate; shared logic lives in `ai/` or `tools/`
- **Tool additions:** Implement method + register in `initializeTools()` + add schema to `getToolDefinitions()` + update `docs/API_SPECIFICATION.md`

## Testing Guidelines

- Lightweight Node scripts (no Jest/Mocha)
- Add assertions to `tests/unit/run-unit-tests.js`
- Manual smoke test required: load extension in Chrome and exercise tools
- Before PR: run `npm test` + manual test + screenshots for UI changes

## Security Constraints

- API keys stored in `chrome.storage.local`, never committed
- System prompts forbid: installing extensions, destructive history edits, logging out, unknown URLs
- URL validation rejects unsafe schemes (`javascript:`, `data:`, `chrome:`)
- Screenshots opt-in (disabled by default), only sent when vision profile configured
- Preserves user-created tab groups and content (e.g., docs, HackMD)

## Context Management

**Context compaction** (in `background.js`):
- Triggers when conversation approaches model's context limit
- Removes oldest assistant messages first, preserving recent tool results
- Keeps at least last 4 messages for continuity
- Updates UI with compaction events

**History persistence:**
- Optional (toggle in settings)
- Stored in `chrome.storage.local` as sessions
- First user message becomes session title
- History tab allows reopening past sessions

## Common Patterns

### Adding a New Tool
1. Implement method in `BrowserTools` class (`tools/browser-tools.js`)
2. Bind in `initializeTools()`: `toolName: this.toolName.bind(this)`
3. Add schema in `getToolDefinitions()` with Anthropic-style `input_schema`
4. Document in `docs/API_SPECIFICATION.md`
5. Add unit test in `tests/unit/run-unit-tests.js`

### Profile Management
- Profiles store: provider, API key, model, system prompt, temperature, max tokens, timeout, screenshot preferences
- Active profile selected via dropdown
- Agent teams: assign profiles to Main/Vision/Orchestrator/Team roles
- Vision profiles must support vision models; screenshots routed through vision bridge if enabled

### Streaming Flow
1. Panel sends `user_message` to background
2. Background initializes provider with `stream: true` and callbacks
3. Provider calls `onStart` → `onDelta` (incremental chunks) → `onComplete`
4. Panel renders deltas, extracts `<think>` blocks, auto-scrolls

### Tool Execution Loop
1. AI returns response with `toolCalls` array
2. Background executes tools sequentially (errors caught, not thrown)
3. Results appended as `tool` role messages
4. Loop continues until no more tool calls or max iterations reached
5. If no content after tools, follow-up request prompts for final answer

## Commit Conventions

- `feat:` / `feat(scope):` - New features
- `fix:` / `fix(scope):` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks

**PR Requirements:**
- Clear description + how you tested (`npm test` + manual steps)
- Screenshots for `sidepanel/` UI changes
- Explicit note if `manifest.json` permissions changed
