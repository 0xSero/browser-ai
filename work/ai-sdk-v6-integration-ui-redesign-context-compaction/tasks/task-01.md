# Task 01 — Add AI SDK v6 dependencies + bundling pipeline

## Objective
Introduce AI SDK v6 dependencies and update the build pipeline so extension code can import AI SDK modules reliably.

## Files Involved
- `package.json` — add AI SDK v6 packages and bundler (e.g., esbuild)
- `package-lock.json` — lockfile updates
- `scripts/build.mjs` — extend build to bundle background + sidepanel with dependencies
- `tsconfig.json` — adjust module/target settings if needed for bundling

## Changes
- Install AI SDK v6 packages (core + providers + UI utilities):
  - `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, and UI utilities needed for UI message streams.
- Add a bundler (esbuild/rollup) step that:
  - Bundles `background.ts` and `sidepanel/panel.ts` into `dist/` with external deps embedded.
  - Preserves ESM output compatible with Chrome extension service worker and sidepanel.
- Update `scripts/build.mjs` to call the bundler before copying assets.
- Ensure source maps or debug-friendly outputs for development.

## Tests
- No new unit tests required here; validate via build + extension load.

## Validation
- `npm run build`
- Load `dist/` in Chrome extensions and confirm no missing-module errors.

## Acceptance Criteria
- AI SDK v6 packages are available to extension code without runtime import failures.
- Build pipeline outputs bundled JS in `dist/` with UI assets intact.
