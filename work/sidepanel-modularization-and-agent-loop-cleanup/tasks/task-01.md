# Task 01 — Extract settings controller

## Objective
Move all settings/profile/config management out of `panel.ts` into `sidepanel/settings.ts` with a clear controller interface, keeping storage and UI behavior unchanged.

## Files Involved
- `sidepanel/settings.ts` (new)
- `sidepanel/panel.ts` (remove settings methods; wire controller)
- `sidepanel/state.ts` (share settings-related state)
- `tests/unit/run-unit-tests.ts` (new tests for settings helpers)

## Changes
- Create `SettingsController` with:
  - `init()` to wire settings listeners.
  - `loadSettings()`, `saveSettings()`, `persistAllSettings()`.
  - Profile CRUD (`createNewConfig`, `deleteConfig`, `switchConfig`, `editProfile`).
  - Form collection helpers (`collectProfileEditorData`, `collectToolPermissions`).
- Keep storage keys identical to current usage.
- Return events/callbacks for `onSettingsChanged` / `onProfileChanged` to update chat model display.
- Ensure system prompt defaults and custom endpoint validation remain in settings module.

## Tests
- Unit tests for:
  - `collectToolPermissions()` mapping.
  - profile normalization defaults.
  - `toggleCustomEndpoint()` validation behavior (pure logic path).

## Validation
- `npm run test:unit`
- `npm run build`

## Acceptance Criteria
- `panel.ts` no longer contains settings/profile CRUD logic.
- Settings UI behavior is unchanged (save/cancel, profile switching).
- Unit tests cover new settings helpers at 100% coverage.