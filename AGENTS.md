# Repository Guidelines

## Project Structure & Module Organization

- `manifest.json`: Manifest V3 configuration and permissions.
- `background.js`: Service worker; orchestrates AI calls, tool execution, safety guards, and sub-agents.
- `content.js`: Content script utilities (DOM helpers, highlighting, page metadata).
- `sidepanel/`: Side panel UI (`panel.html`, `panel.css`, `panel.js`).
- `ai/`: LLM provider adapters and request/response shaping (`ai/provider.js`).
- `tools/`: Browser automation tools and tool schemas (`tools/browser-tools.js`).
- `tests/`: Node-based validation + unit tests; `tests/integration/test-page.html` is a manual smoke-test page.
- `docs/`: Reference docs (API specification, testing guide, quick start).

## Build, Test, and Development Commands

- `npm test`: Runs the full suite (extension validation + unit tests).
- `npm run validate`: Checks `manifest.json`, required files/dirs, and basic JS sanity.
- `npm run test:unit`: Runs unit tests only.
- `npm run build`: Alias for validation (no bundling/packaging step).
- `npm run dev`: Reminder for local workflow (load unpacked extension in Chrome).

Local run workflow:
1. Open `chrome://extensions` → enable Developer Mode → “Load unpacked” → select repo root.
2. Use the side panel and (optionally) open `tests/integration/test-page.html` to exercise tools.

## Coding Style & Naming Conventions

- JavaScript (ES modules; see `package.json` `"type": "module"`), 2-space indentation, semicolons, single quotes.
- Keep entry points simple (`background.js`, `content.js`, `sidepanel/panel.js`) and put shared logic in `ai/` or `tools/`.
- When adding a new tool: implement the method and register it in `tools/browser-tools.js` (`initializeTools()` + `getToolDefinitions()`), then update `docs/API_SPECIFICATION.md`.

## Testing Guidelines

- Tests are lightweight Node scripts (no Jest/Mocha). Prefer adding assertions to `tests/unit/run-unit-tests.js`.
- Before opening a PR: run `npm test` and do a manual smoke test by loading the extension in Chrome.

## Commit & Pull Request Guidelines

- Follow the repo’s common commit subjects: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...` (optionally add a scope like `feat(sidepanel): ...`).
- PRs should include: a clear description, how you tested (`npm test` + manual steps), and screenshots for any `sidepanel/` UI changes.
- If you change `manifest.json` permissions, call it out explicitly in the PR description.

## Security & Configuration Tips

- Never commit API keys or test credentials; runtime settings live in `chrome.storage.local`.
- Be conservative with new permissions/host permissions and explain the user-facing need.
