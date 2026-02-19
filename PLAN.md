# Clubhouse Workshop — Plan

> The extensibility hub for Clubhouse. SDK, tooling, first-party plugins, and eventually a plugin registry.

This replaces the earlier `COMMUNITY_PLUGIN_DEV_PLAN.md` which was a dev notes dump focused on "how would a community plugin even work." This plan covers the full vision: what this repo becomes, what goes in it, and — critically — what changes the main Clubhouse app needs at each milestone to support it.

---

## What This Repo Is

**For plugin authors:** Everything you need to build, test, and distribute a Clubhouse plugin without touching the main app repo.

**For users:** A curated catalog of first-party plugins that showcase the plugin API, plus (eventually) a browsable registry of community plugins.

**For Clubhouse itself:** A forcing function. If first-party plugins ship here using the same API as community plugins, the API has to actually be good. No special-casing, no backdoors.

---

## Repo Structure

```
Clubhouse-Workshop/
  principles.md                          # Extensibility principles (keep)

  sdk/
    plugin-types/                        # @clubhouse/plugin-types
      package.json                       #   npm package — types only, no runtime
      index.d.ts                         #   Flattened from plugin-types.ts + shared types
      CHANGELOG.md                       #   Tracks API version changes

    plugin-testing/                      # @clubhouse/plugin-testing
      package.json                       #   npm package — test utilities
      src/
        mock-api.ts                      #   Full mock PluginAPI factory
        mock-context.ts                  #   Mock PluginContext factory
        test-harness.ts                  #   Load, activate, render plugins in a test env
        matchers.ts                      #   Custom assertions (e.g., expect(api.ui.showNotice).toHaveBeenCalledWithNotice(...))

  create-clubhouse-plugin/               # CLI scaffolding tool (npm create clubhouse-plugin)
    package.json
    src/
      index.ts                           #   Prompts for name/scope/permissions, copies template
    templates/
      basic/                             #   Minimal: activate + MainPanel
      with-sidebar/                      #   sidebar-content layout
      app-scoped/                        #   Rail item, cross-project
      agent-workflow/                    #   Spawns quick agents, shows status

  plugins/                               # First-party plugins (not built into the app)
    example-hello-world/                 #   Minimal working example — the "it works" test
    <more plugins as they're built>

  docs/
    getting-started.md                   #   End-to-end walkthrough
    api-reference.md                     #   Generated or hand-written API docs
    manifest-reference.md                #   Manifest format, fields, validation rules
    patterns.md                          #   Common patterns (agent workflows, storage, etc.)
    faq.md                               #   React access, debugging, common pitfalls

  registry/                              # Plugin catalog (P2+)
    registry.json                        #   Machine-readable list of plugins
    README.md                            #   How to submit a plugin
```

---

## Milestones

### P0 — A plugin author can build, install, and run a community plugin

**The bar:** Someone clones this repo, follows the getting-started guide, builds the hello-world example, installs it, and it works. No hacks, no caveats, no "you also need to do this weird thing."

#### What goes in this repo (P0)

1. **`sdk/plugin-types/`** — Extract types from `src/shared/plugin-types.ts` + `FileNode`/`GitStatus`/etc from `src/shared/types.ts` into a standalone `.d.ts` package. Publish as `@clubhouse/plugin-types` on npm (or at minimum, usable via `file:` link for now).

2. **`plugins/example-hello-world/`** — A minimal working plugin: manifest, `activate()`, `MainPanel` rendering "Hello from Workshop!", uses 2-3 API calls (logging, storage). This is the smoke test for the entire 3P plugin story.

3. **`docs/getting-started.md`** — Step-by-step: prerequisites, scaffold, build, install (symlink), enable, verify, iterate.

4. **`docs/manifest-reference.md`** — Manifest format with all fields, validation rules, permission descriptions.

#### Changes needed in Clubhouse (P0)

These are things that are broken or missing in the main app that block community plugins from working at all.

| # | Change | Why | Where |
|---|--------|-----|-------|
| 1 | **Expose React on globalThis** | Community plugins are ESM-imported outside webpack's module system. They cannot `import React from 'react'` because that resolves via Node/browser module resolution, not webpack. The app must do `globalThis.React = React; globalThis.ReactDOM = ReactDOM;` in the renderer entry so plugins can access it. Without this, plugins cannot render UI. | `src/renderer/index.tsx` |
| 2 | **Expose React hooks individually** | Plugins using esbuild with `--external:react` expect named exports. The globalThis shim works for `React.createElement` but not for `import { useState } from 'react'`. Either: (a) set up an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) in the HTML template pointing `react` to a shim module, or (b) provide a `react-shim.mjs` alongside the plugin loader that re-exports from globalThis. Option (a) is cleaner. | `src/renderer/index.html` or plugin loader |
| 3 | **Verify & fix the ESM loading path** | The dynamic import (`new Function('path', 'return import(path)')`) has never been tested with a real external plugin end-to-end. Need to verify: file:// URL resolution, source map support, error messages on load failure. Fix whatever's broken. | `src/renderer/plugins/plugin-loader.ts` |
| 4 | **Align API version** | The old dev plan references API `0.4`. The app's manifest validator now requires `0.5`. The types package must match whatever the app actually validates. Ensure the version in the types package, the example manifest, and the validator are all in sync. | `manifest-validator.ts`, types package |
| 5 | **Error boundary around plugin panels** | If a community plugin's `MainPanel` throws, it should show a fallback UI ("This plugin encountered an error") — not crash the entire app or silently disappear. The built-in plugin rendering path may already handle this, but it needs to be verified for community plugins. | `src/renderer/plugins/` rendering code |
| 6 | **Surface plugin activation errors in UI** | If `activate()` throws or the ESM import fails, the error should be visible in Settings > Plugins with the stack trace — not just a console.error. Users need to know *why* their plugin didn't load. | `plugin-loader.ts`, `plugin-store.ts` |

#### Verification

P0 is done when:
- `example-hello-world` builds with `npm run build`
- Symlinked into `~/.clubhouse/plugins/example-hello-world/`
- Enabled in Clubhouse Settings > Plugins
- Tab appears, renders UI, `activate()` runs, API calls work
- No hacks required beyond what the getting-started guide describes

---

### P1 — A plugin author can develop productively

**The bar:** The dev loop is fast. Types are on npm. Testing doesn't require the full app. Scaffolding gets you from zero to running in under a minute.

#### What goes in this repo (P1)

1. **`sdk/plugin-testing/`** — A testing library:
   - `createMockAPI()` returns a fully-stubbed `PluginAPI` with vi.fn() / jest.fn() on every method
   - `createMockContext()` returns a valid `PluginContext` with defaults
   - `renderPlugin(module, options?)` activates a plugin and renders its MainPanel in a test DOM
   - Published as `@clubhouse/plugin-testing` on npm

2. **`create-clubhouse-plugin/`** — CLI tool: `npm create clubhouse-plugin`
   - Prompts: plugin name, scope, which permissions, which layout
   - Generates: manifest.json, src/main.ts, package.json with esbuild, tsconfig, .gitignore
   - Includes the symlink setup command for immediate testing
   - Published as `create-clubhouse-plugin` on npm

3. **More first-party plugins** — At least 2-3 real plugins that demonstrate non-trivial use of the API:
   - One that uses `api.agents` to spawn quick agents (demonstrates the most powerful API)
   - One that's app-scoped with a rail item (demonstrates the other scope)
   - One that uses `api.terminal` or `api.process` (demonstrates system-level access)

4. **`docs/patterns.md`** — Common patterns: "how to spawn an agent and show its output," "how to persist state across sessions," "how to react to agent status changes," etc.

5. **`docs/api-reference.md`** — Full API reference with every method, its signature, what permissions it needs, and a short example.

#### Changes needed in Clubhouse (P1)

| # | Change | Why | Where |
|---|--------|-----|-------|
| 1 | **Hot-reload for community plugins** | Currently you must restart the app to pick up plugin changes. Watch `~/.clubhouse/plugins/` for file changes. When a plugin's files change: deactivate it, re-import the module (cache-bust with `?t=timestamp` on the import URL), re-activate. This is the single biggest DX improvement. | `plugin-loader.ts`, new file watcher service |
| 2 | **Plugin DevTools panel** | A section in Settings (or a separate panel) showing: all registered plugins, their activation state, permission violations, recent log entries, and a "Reload" button per plugin. Saves constant trips to the console. | New UI in Settings or standalone |
| 3 | **Plugin reload command** | Register a command (e.g., `plugin:reload <pluginId>`) that deactivates and reactivates a single plugin. Hot-reload triggers this automatically, but it's also useful manually. | Commands system, plugin-loader |
| 4 | **Structured activation errors** | When `activate()` throws, capture the error with stack trace and surface it as a structured object in the plugin store — not just console.error. The DevTools panel and Settings UI both read from this. | `plugin-loader.ts`, `plugin-store.ts` |
| 5 | **Dev mode flag** | If `manifest.json` contains `"dev": true`, enable extra behavior: verbose logging of API calls, permission check warnings (not just blocks), auto-reload on file change. Strip this flag from production installs. | `manifest-validator.ts`, `plugin-api-factory.ts` |

#### Verification

P1 is done when:
- `npm create clubhouse-plugin` scaffolds a working plugin from scratch
- `npm test` in a plugin repo runs meaningful tests using `@clubhouse/plugin-testing` with no Clubhouse app needed
- Editing a plugin's source and saving triggers automatic reload in the app
- 2+ non-trivial first-party plugins ship in `plugins/` and work correctly

---

### P2 — Users can discover and install plugins without leaving the app

**The bar:** A user opens Clubhouse, browses available plugins, clicks install, and the plugin is ready to use. No terminal, no git clone, no manual file copying.

#### What goes in this repo (P2)

1. **`registry/registry.json`** — A machine-readable catalog:
   ```json
   {
     "version": 1,
     "plugins": [
       {
         "id": "code-review",
         "name": "Code Review",
         "description": "AI-powered code review for your commits",
         "author": "Clubhouse",
         "official": true,
         "repo": "https://github.com/masra91/Clubhouse-Workshop",
         "path": "plugins/code-review",
         "latest": "1.0.0",
         "releases": {
           "1.0.0": {
             "api": 0.5,
             "asset": "https://github.com/masra91/Clubhouse-Workshop/releases/download/code-review-v1.0.0/code-review-v1.0.0.zip",
             "sha256": "abc123...",
             "permissions": ["files", "git", "agents", "notifications"]
           }
         }
       }
     ]
   }
   ```

2. **CI/CD for plugin releases** — GitHub Actions workflow:
   - On push to `plugins/<name>/`: build, test, validate manifest, create zip artifact
   - On tag `<plugin-id>-v*`: create GitHub Release with the zip attached
   - Auto-update `registry/registry.json` with the new release entry + sha256

3. **Community plugin submission process** — `registry/README.md` describes how third-party authors submit their plugins to the registry (PR with their entry, automated validation, review checklist).

#### Changes needed in Clubhouse (P2)

| # | Change | Why | Where |
|---|--------|-----|-------|
| 1 | **Workshop browser UI** | A new panel or section in Settings that fetches `registry.json` from this repo's GitHub releases (or raw URL), displays available plugins with name/description/author/permissions, and shows install/update/uninstall buttons. | New UI component, new IPC handler |
| 2 | **One-click install** | Download the zip from the release asset URL, verify sha256, extract to `~/.clubhouse/plugins/<id>/`, register the plugin. All from the UI — no terminal needed. | New main-process service: `plugin-installer.ts` |
| 3 | **Plugin update checking** | On app launch (or periodically), compare installed plugin versions against the registry. Show a badge/indicator when updates are available. "Update" button in Settings. | `plugin-installer.ts`, Settings UI |
| 4 | **Plugin detail view** | When clicking a plugin in the browser or Settings, show: full description, README (fetched from repo), permissions required, install size, version history. Users should know what they're installing. | Settings UI enhancement |
| 5 | **Registry URL configuration** | Allow users to configure additional registry URLs beyond the default Workshop one. This lets orgs host private plugin registries for internal tools. | App settings, `plugin-installer.ts` |

#### Verification

P2 is done when:
- First-party plugins have automated releases producing zip artifacts
- `registry.json` is auto-maintained by CI
- A user can browse, install, update, and uninstall plugins entirely from within Clubhouse
- The flow works end-to-end with no terminal commands

---

### P3 — The ecosystem is self-sustaining

**The bar:** Third-party authors publish plugins. Users find them. Trust is established through transparency, not gatekeeping.

This milestone is more directional than prescriptive — the right specifics will depend on what we learn from P0-P2.

#### What goes in this repo (P3)

1. **Community plugins in the registry** — Third-party plugins listed alongside official ones, with clear labeling (`official: true` vs omitted).

2. **Plugin quality guidelines** — Documentation on what makes a good plugin: permission minimality, error handling, accessibility, performance, testing expectations.

3. **Automated validation in CI** — PRs adding community plugins to the registry run automated checks: manifest valid, permissions justified, no obvious security issues (e.g., `files.external` without clear reason), builds successfully.

#### Changes needed in Clubhouse (P3)

| # | Change | Why |
|---|--------|-----|
| 1 | **Trust indicators in UI** | Show `official` badge, permission summary, install count (if tracked). Users should understand what a plugin can do before installing. |
| 2 | **Permission consent on install** | When installing a plugin that requires powerful permissions (`terminal`, `process`, `files.external`), show a confirmation dialog listing what it can access. Not a block — just informed consent. |
| 3 | **Plugin isolation improvements** | Investigate stronger sandboxing: running community plugins in a separate renderer/webview, limiting IPC surface. This is a big architectural decision — may not be worth the complexity if the permission system is sufficient. |
| 4 | **Telemetry hooks (opt-in)** | Anonymous install/usage counts so plugin authors (and the registry) know what's popular. Strictly opt-in. |

---

## Migration from Existing Docs

- **`principles.md`** — Stays as-is. It's the foundation.
- **`COMMUNITY_PLUGIN_DEV_PLAN.md`** — Archive or delete. The useful content migrates into:
  - Build/React guidance → `docs/getting-started.md`
  - API surface tables → `docs/api-reference.md`
  - Manifest rules → `docs/manifest-reference.md`
  - Testing patterns → incorporated into `sdk/plugin-testing/` README
  - Gaps & action items → absorbed into the P0/P1 changes above

---

## First-Party Plugin Ideas

These exist to (1) prove the API works, (2) give users useful tools, and (3) serve as reference implementations for plugin authors.

| Plugin | Scope | Key APIs | Why it's a good showcase |
|--------|-------|----------|------------------------|
| **Hello World** | project | logging, storage, ui | Minimal example. The "create-react-app" of Clubhouse plugins. |
| **Code Review** | project | agents, git, files, notifications | Spawns a quick agent to review staged changes. Shows agent workflow pattern. |
| **Standup** | app | agents, projects, storage | Cross-project daily summary. Shows app-scoped + multi-project pattern. |
| **Pomodoro** | app | notifications, storage, commands | Simple timer. Shows that plugins don't have to be about agents — they're about personal workflow. |
| **Snippets** | project | files, storage, commands | Save/recall code snippets. Shows storage + commands pattern. |
| **Metrics** | project | agents, storage | Track agent usage, tokens, time. Shows event subscription + data aggregation pattern. |

Start with Hello World (P0) and Code Review (P1). The rest emerge naturally as the API gets exercised.

---

## Open Questions

1. **npm scope** — Is `@clubhouse` available on npm, or do we need a different scope? (`@clubhouse-app`? `@clubhouse-ide`?)

2. **React version contract** — The app bundles React 19. Should the types package declare this as a peer dependency? What happens when the app upgrades React?

3. **Plugin-to-plugin communication** — The current API has no mechanism for plugins to talk to each other. Is this intentional? Some ecosystems benefit from this (e.g., a "git" plugin exposing helpers to other plugins). Probably premature to add, but worth noting.

4. **Offline support** — Should the Workshop browser work offline with a cached registry? Probably yes, since Clubhouse is a desktop app and people work on planes.

5. **Versioning the registry format** — `registry.json` has a `version` field. What's the upgrade path when we need to change the schema?

---

## Sequencing Summary

```
P0  "It works"          → Plugin author can build & run a community plugin
                           Ship: types package, hello-world plugin, getting-started docs
                           App:  React global, ESM fix, error boundaries, version alignment

P1  "It's pleasant"     → Dev loop is fast, tooling exists, real plugins ship
                           Ship: testing lib, scaffolding CLI, 2-3 first-party plugins, full docs
                           App:  Hot-reload, dev tools panel, structured errors, dev mode

P2  "It's discoverable" → Users find and install plugins without leaving the app
                           Ship: registry, CI/CD for releases, community submission process
                           App:  Workshop browser, one-click install, update checking

P3  "It's trustworthy"  → Ecosystem has trust signals and scales beyond first-party
                           Ship: community listings, quality guidelines, automated validation
                           App:  Trust badges, permission consent, isolation improvements
```
