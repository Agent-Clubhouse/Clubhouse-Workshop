# Theme API Integration Report

**Date:** 2026-02-23
**Author:** fuzzy-coyote (agent)
**PR:** fuzzy-coyote/theme-api-sdk-update

## Summary

The v0.6 SDK snapshot has been updated to include the `ThemeAPI` and `SoundsAPI` that exist in the Clubhouse main app. All 9 built-in plugins have been updated to use the ThemeAPI for dynamic theming.

## What Was Done

### SDK v0.6 Updates
- Added `ThemeAPI`, `ThemeInfo`, `SoundsAPI`, `PluginSoundPackDeclaration` type definitions
- Added `sounds` and `theme` to the `PluginPermission` union type
- Added `sounds` and `theme` to the composite `PluginAPI` interface
- Added `PluginContributes.sounds` manifest declaration
- Updated `permissions.json` to include `sounds` and `theme` for v0.6
- Updated `plugin-testing` mock API with `createMockTheme()` and `createMockSounds()`

### Plugin Updates (all 9 plugins)
- Bumped `engine.api` from `0.5` to `0.6` in all manifests
- Added `theme` permission to all manifests
- Updated `package.json` devDependencies from `sdk/v0.5` to `sdk/v0.6`
- Created `use-theme.ts` hook in each plugin that maps `ThemeInfo` colors to CSS custom properties
- Wired `useTheme(api.theme)` into all `MainPanel` and `SidebarPanel` root elements

## CSS Variable Naming Mismatch (Action Needed)

### The Problem

The Clubhouse main app's `applyTheme()` function (in `src/renderer/themes/apply-theme.ts`) sets CSS custom properties on `document.documentElement` using the `--ctp-` prefix (Catppuccin naming convention):

```
--ctp-base, --ctp-mantle, --ctp-crust, --ctp-text, --ctp-subtext0, ...
--hljs-keyword, --hljs-string, ...
```

However, all built-in plugins reference CSS custom properties with a **different naming scheme**:

```
--text-primary, --text-secondary, --text-tertiary
--bg-primary, --bg-secondary, --bg-tertiary
--border-primary, --border-secondary
--text-error, --text-success, --text-warning, --text-accent
```

**These variable names do not match.** Prior to this PR, plugins were always using their hardcoded fallback values (e.g., `var(--text-primary, #e4e4e7)` always resolved to `#e4e4e7`). Themes had no effect on plugin UI.

### The Fix (This PR)

This PR bridges the gap by having each plugin call `api.theme.getCurrent()` and `api.theme.onDidChange()` to get the actual theme colors, then maps them to CSS custom properties on the plugin's root `<div>`:

| ThemeInfo Color | CSS Variable Set |
|---|---|
| `colors.text` | `--text-primary` |
| `colors.subtext1` | `--text-secondary` |
| `colors.subtext0` | `--text-tertiary` |
| `colors.error` | `--text-error` |
| `colors.success` | `--text-success` |
| `colors.warning` | `--text-warning` |
| `colors.info` | `--text-info` |
| `colors.accent` | `--text-accent` |
| `colors.base` | `--bg-primary` |
| `colors.mantle` | `--bg-secondary` |
| `colors.crust` | `--bg-tertiary` |
| `colors.surface0` | `--bg-surface`, `--border-primary` |
| `colors.surface1` | `--bg-active`, `--bg-surface-hover`, `--border-secondary` |
| `colors.surface2` | `--bg-surface-raised` |

Derived colors (backgrounds with alpha) are computed from the base colors using `rgba()`.

### Recommendation for Main App Team

**Option A (Recommended): Add a plugin CSS variable compatibility layer**

In `applyTheme()`, after setting the `--ctp-*` variables, also set the `--text-primary`, `--bg-primary`, etc. variables that plugins expect. This would:
- Allow plugins to use `var(--text-primary)` without needing the ThemeAPI at all
- Provide a zero-JS fallback for simple plugins
- Make the CSS variable approach work natively without each plugin running a `useTheme` hook

Example addition to `applyTheme()`:
```typescript
// Plugin compatibility layer
style.setProperty('--text-primary', theme.colors.text);
style.setProperty('--text-secondary', theme.colors.subtext1);
style.setProperty('--bg-primary', theme.colors.base);
// ... etc
```

**Option B: Document ThemeAPI as the canonical approach**

If adding CSS variables is undesirable, document that plugins **must** use `api.theme.getCurrent()` and `api.theme.onDidChange()` for theming, and that CSS custom properties are not provided by the host. The `use-theme.ts` hook pattern from this PR can be included in the plugin scaffold template.

### Additional Notes

- The `SoundsAPI` was also missing from the v0.6 SDK and has been added. No plugins currently use it.
- The `theme` API gating in `plugin-api-factory.ts` uses `true` for scope check, meaning it's available to all scopes (project, app, dual). This is correct since theme is a read-only, non-destructive API.
- Theme subscription cleanup is handled via the `ctx.subscriptions` pattern (Disposable returned by `onDidChange`).

## Files Changed

### SDK
- `sdk/v0.6/plugin-types/index.d.ts` — Added ThemeAPI, SoundsAPI, related types
- `sdk/v0.6/plugin-types/CHANGELOG.md` — Updated changelog
- `sdk/v0.6/plugin-testing/src/mock-api.ts` — Added mock implementations
- `sdk/versions.json` — Updated version notes
- `sdk/permissions.json` — Added sounds, theme permissions

### Plugins (all 9)
- `plugins/*/manifest.json` — Bumped API, added theme permission
- `plugins/*/package.json` — Updated SDK references to v0.6
- `plugins/*/src/use-theme.ts` — New file: useTheme hook
- `plugins/*/src/main.tsx` — Wired useTheme into root components
