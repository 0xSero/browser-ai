# Parchi

Parchi is a premium warm-paper inspired Chrome (Chromium) extension built for professionals and teams who want brand-safe browser automation. Every detail – from the tactile UI to the safety prompts – is tuned for production distribution, paid plans, and tight visual identity. The Live/History panes, profile manager (including vision routes and orchestrator tools), and compacted context allow you to confidently surface Parchi as a monetizable feature inside your workflow toolkit.

## Highlights

- **Safe automation**: Unsafe actions (installing extensions, logging out, closing tabs, visiting unknown schemes) are blocked unless explicitly requested, and tab groups created by the user are preserved.
- **Vision & screenshot controls**: Screenshots stay off by default; enable them only when pairing the main agent with a vision-capable profile. Vision bridges automatically describe captures so non-vision models can continue reasoning.
- **Orchestrator workflows**: Toggle orchestrator mode to expose `spawn_subagent`/`subagent_complete`, letting the orchestrator spin focused helpers for subtasks and gather sanitized summaries.
- **Warm Paper UI**: Geist Sans typography, rounded cards, solid warm hues, card glow, and tab/history panes deliver a clean, tactile experience with subtle pulses and scrollbars.
- **History & context management**: Sessions persist locally (if enabled), `<think>` blocks render cleanly, context is compacted when the limit nears, and the model keeps working even after individual errors.

## Brand & Production Readiness

- **Parchi identity**: Header copy, pill tabs, pill buttons, and status rings carry the brand narrative – the product never looks like a rough utility overlay but a curated experience you can safely charge for.
- **Monetization-friendly controls**: Strict safety guardrails, orchestrator tooling, and history segmentation let you offer Parchi as a paid tier where customers rely on reliable outcomes.
- **Design system ready**: Warm Paper palette (solid creams, soft tans, charcoal text) plus Geist Sans/Mono fonts, subtle rings, and card shadows form a reusable system for future marketing or docs.

## Features

### Provider & Profile Management
- Configure multiple profiles (system prompt, model, provider, temperature, tokens, timeout, screenshot preferences) and switch mid-session.
- Vision profiles describe screenshots for non-vision agents, while screenshots stay disabled unless explicitly toggled.
- Profiles are reused by orchestrators and optional sub-agents for flexible workflows.

### Automation Tools
- **Navigation & visibility**: `navigate`, `getContent`, `screenshot` (vision aware), `getTabs`, `describeSessionTabs`, glow annotations keep track of operated pages.
- **Interaction**: `click`, `type`, `pressKey`, `scroll`, `focusTab`, `switchTab`, `openTab`, `closeTab`.
- **Tab orchestration**: `groupTabs`, `describeSessionTabs`, `spawn_subagent`, `subagent_complete`.
- **History & safety**: History APIs remain accessible but require explicit user consent; orchestrator prompts instruct the model to avoid destructive actions.

### Orchestrator Mode
- When enabled, exposes `spawn_subagent` and `subagent_complete` tools.
- Orchestrator builds sub-agent histories that run tools independently, report progress, and return structured summaries.
- Supports up to four simultaneous helpers, each respecting the same navigation/safety guardrails.

### Agent Teams
- The Agent Teams panel lists every saved configuration, letting you tap rich pills to assign Main, Vision, Orchestrator, or Team roles with a single tap.
- Toggle Vision or Orchestrator pills to route screenshots and coordination duties while Team pills let multiple allied agents run in parallel.
- A built-in profile editor inside the Agent Library tab lets you click any card, update its provider/API/model/system prompt settings, and save immediately—no more bouncing back to general settings for simple edits.

### UI Enhancements
- Live/History tabs allow quick switching between the current conversation and saved sessions.
- Tab selection preserves user choices, and the panel displays a glowing status ring plus tool timeline entries.
- Thinking blocks render `<think>`/`<analysis>` snippets, and streaming updates show incremental thought-progress.

## Installation

1. Clone or download:
   ```bash
   git clone <repo-url>
   cd browser-ai
   ```
2. Ensure `icons/` contains `icon16.png`, `icon48.png`, `icon128.png` (optional but recommended).
3. Open `chrome://extensions`, enable Developer Mode, and load the unpacked `browser-ai` directory.
4. Pin the extension to the toolbar if desired.

## Configuration

1. Open the side panel via the toolbar icon.
2. Click the gear icon to open Settings.
3. Choose your provider (OpenAI, Anthropic, Custom) and paste the corresponding API key.
4. Configure model, temperature, timeout, and system prompt per profile.
5. Toggle screenshot tools only when pairing with a vision-capable profile or vision bridge.
6. Enable orchestrator mode to expose sub-agent tooling and pick an orchestrator profile if desired.
7. In the Agent Teams panel, tap the Main / Vision / Orchestrator / Team pills to assign the right profiles to each role. You can select multiple profiles for auxiliary duties to keep complex workflows readable.
8. Click any card to edit it directly in the Agent Library tab, then hit Save Profile to keep the change.
9. Save settings and switch profiles via the dropdown.

## Usage

- Ask the assistant to drive the browser: “Open example.com, find contact emails, and summarize the hero section.”
- Use Vision bridging: “Capture the modal, describe it with the vision profile, then continue filling the form.”
- Spawn a helper: “Start a sub-agent to collect pricing tiers on this page and summarize with subagent_complete.”
- Save history: toggle it on to store sessions locally, then switch to the History tab to reopen or review them.

## Billing & Account Service

Parchi includes an optional Stripe-backed billing/auth service under `server/`. Point the **Account API base URL** setting to your deployed service to enable device sign-in, Checkout, and the billing portal. See `docs/BILLING.md` for setup and environment variables.

## Architecture

```
sidepanel/    → UI (HTML/CSS/JS) with Warm Paper styling and live/history tabs
background.js → Service worker orchestrating AI calls, tool execution, security guards, and orchestrator helpers
ai/provider.js → OpenAI/Anthropic integration, tool formatting, vision descriptions, safety prompts
tools/browser-tools.js → Browser automation helpers, page glow, group-aware tab management, URL validation
content.js    → DOM helpers for highlighting, hover simulation, metadata
```

## Security & Privacy

- API keys are stored locally and only used for outbound requests to configured providers.
- The orchestrator/system prompts explicitly forbid installs, destructive history edits, or actions outside user-selected tabs.
- Navigation validates URLs and rejects unsafe schemes (`javascript:`, `data:`, `chrome:`).
- Screenshots opt-in and never transmit image data unless the vision profile is explicitly configured.
- Content scripts have no access beyond user tabs; no telemetry is collected.

## Testing

```bash
npm test         # Runs the full testing suite
npm run validate # Validates extension files and manifest
npm run test:unit # Unit tests

# Corepack-free alternative
node scripts/run-checks.mjs
```

> If `npm` fails with a Corepack signature error (Node 23+ bug), run `node scripts/run-checks.mjs` instead. It executes the same validation scripts without invoking Corepack. You can also run `corepack disable` or `corepack prepare npm@10.8.2 --activate` once to restore standard `npm` commands.

## Troubleshooting

- **Panel not opening**: reload via `chrome://extensions`, ensure it is enabled, and check console logs.
- **AI not responding**: verify API key, model name, provider limits, and extension permissions (tabs, storage, scripting).
- **Tools failing**: inspect the Console/Network tabs for script injection issues, ensure DOM selectors exist, or increase tool timeout.

## Future Ideas

- Visual selector (point, highlight, confirm).
- Workflow templates (multi-pass diaries).
- Native vision model selection UI.
- Traffic-safe DevTools Protocol integration.
- Export session history or transcripts.

## Contributing

Improvements welcome: more tests, additional tools, UI polish, safety audits, localization.

## License

MIT License – see `LICENSE`.

## Support

Create an issue or join discussions in this repository.
