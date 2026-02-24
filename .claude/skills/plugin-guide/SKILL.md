---
name: plugin-guide
description: Explain how Clubhouse plugins work, answer questions about the plugin SDK, API, architecture, or development workflow. Use when someone asks about how plugins work, what APIs are available, how the manifest works, or any conceptual question about plugin development.
---

# Clubhouse Plugin Guide

You are a knowledgeable, friendly guide to the Clubhouse plugin system. When developers ask questions about how plugins work, answer clearly using the reference material below. Keep explanations approachable — use plain language and examples.

## How to answer questions

1. **Answer the specific question first** — don't dump the entire reference
2. **Include a code example** when it helps
3. **Link to docs** when there's more detail: point to the [wiki](https://github.com/Agent-Clubhouse/Clubhouse-Workshop/wiki)
4. **Be honest about limitations** — if something isn't supported yet, say so

## Plugin Architecture Overview

Plugins are ES modules loaded by Clubhouse at runtime. The lifecycle:

1. **Manifest validation** — Clubhouse reads `manifest.json`, checks API version, permissions, and structure
2. **Module loading** — Dynamic `import()` of the built `dist/main.js`
3. **Activation** — `activate(ctx, api)` is called with a context object and the sandboxed API
4. **Panel rendering** — If the plugin exports `MainPanel`, `SidebarPanel`, etc., they are rendered in the UI
5. **Deactivation** — `deactivate()` is called on unload; all subscriptions auto-disposed

### Key constraints

- **React access**: Use `globalThis.React`, not `import React from 'react'`
- **Module format**: ES modules only (built with `--format=esm`)
- **React bundling**: Must use `--external:react` — the app provides React
- **Runtime environment**: Electron renderer (browser-like, no direct Node.js APIs)
- **Styling**: Inline styles only; use CSS custom properties for theming
- **Bundle size**: Keep under 100KB

## Three Plugin Scopes

| Scope | When loaded | Where it appears | API access |
|---|---|---|---|
| **project** | When a project is open | Project tab bar | `api.project`, `api.git`, project-scoped storage |
| **app** | At app startup | Sidebar rail | `api.projects` (all projects), global storage |
| **dual** | At app startup | Both tab and rail | Everything |

Most plugins should be **project** scoped.

## The Plugin API (`PluginAPI`)

The API is a single object with these sub-APIs:

| Sub-API | Permission | Purpose |
|---|---|---|
| `api.context` | (none) | Current mode, project ID/path |
| `api.logging` | `logging` | Debug, info, warn, error, fatal logging |
| `api.storage` | `storage` | Key-value storage (projectLocal, project, global) |
| `api.files` | `files` | Read/write project files |
| `api.project` | (none) | Project file access and metadata |
| `api.projects` | `projects` | List all projects (app/dual scope) |
| `api.git` | `git` | Status, log, diff, currentBranch |
| `api.agents` | `agents` | List, runQuick, kill, resume, onStatusChange |
| `api.terminal` | `terminal` | Spawn shells, read/write, ShellTerminal component |
| `api.process` | `process` | Execute allowed CLI commands |
| `api.ui` | `notifications` | Notices, errors, confirms, input dialogs |
| `api.commands` | `commands` | Register/execute commands |
| `api.events` | `events` | Subscribe to file:change and other events |
| `api.settings` | `settings` | Read plugin settings, watch for changes |
| `api.navigation` | `navigation` | Focus agents, switch tabs |
| `api.widgets` | `widgets` | AgentTerminal, SleepingAgent, AgentAvatar, etc. |
| `api.hub` | (none) | Refresh the hub |
| `api.badges` | `badges` | Set/clear badge indicators on tabs |

## Multi-Version SDK

The SDK uses a versioned directory structure to support multiple API versions simultaneously:

```
sdk/
  versions.json          # Lifecycle metadata — source of truth for version info
  v0.6/
    plugin-types/        # Type definitions for API v0.6
    plugin-testing/      # Test utilities for API v0.6
```

### `sdk/versions.json`

Central metadata file tracking all API versions:
- `latest` — default version for new plugins
- `minimum` — oldest supported version; plugins below this fail validation
- `versions` — map of version entries with `status`, `released`, `deprecated`, `removalTarget`, `sdkPath`

### Version lifecycle

`active` → `deprecated` → `removed`

- **active** — fully supported, new plugins can target it
- **deprecated** — still works, but CI will warn; has a `removalTarget` date
- **removed** — SDK files deleted, historical record stays in versions.json

### Version management skills

- `/create-version-snapshot` — generate a new SDK version from Clubhouse source
- `/deprecate-version` — mark a version for phase-out
- `/delete-version` — remove deprecated version files
- `/migrate-plugin` — migrate a plugin between versions

### Referencing the SDK

In-repo plugins use `file:` paths pointing to the specific version:
```json
"@clubhouse/plugin-types": "file:../../sdk/v0.6/plugin-types"
```

The `engine.api` field in `manifest.json` must match a version in `sdk/versions.json`.

## Manifest Structure

Every plugin needs a `manifest.json` with these required fields. The `engine.api` value should reference a valid version from `sdk/versions.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "What it does",
  "author": "Your Name",
  "engine": { "api": 0.6 },
  "scope": "project",
  "main": "./dist/main.js",
  "permissions": ["logging", "storage"],
  "contributes": {
    "tab": { "label": "My Tab", "icon": "<svg>...</svg>", "layout": "full" },
    "help": { "topics": [{ "id": "overview", "title": "My Plugin", "content": "..." }] }
  }
}
```

## Official status

All plugins in the Clubhouse Workshop repository are automatically considered official. The `official` field is no longer used in plugin manifests — the release pipeline sets `"official": true` in the registry for all Workshop plugins.

## Permissions (15 total)

`logging`, `storage`, `notifications`, `files`, `files.external`, `git`, `agents`, `terminal`, `process`, `commands`, `events`, `settings`, `navigation`, `widgets`, `projects`, `badges`

Plugins can only call APIs they've declared permissions for. Undeclared calls are blocked at runtime.

## Storage Scopes

| Scope | Visibility | Use for |
|---|---|---|
| `projectLocal` | Per-user, per-project, gitignored | Caches, UI state, drafts |
| `project` | Per-project, committed | Shared team config |
| `global` | Per-user, all projects | User preferences, history |

All methods are async: `read(key)`, `write(key, value)`, `delete(key)`, `list()`.

## Plugin Module Exports

| Export | Required | Description |
|---|---|---|
| `activate(ctx, api)` | Yes | Setup: register commands, subscribe to events |
| `deactivate()` | No | Cleanup (usually empty — subscriptions auto-dispose) |
| `MainPanel({ api })` | No | Main UI component |
| `SidebarPanel({ api })` | No | Sidebar component (sidebar-content layout) |
| `SettingsPanel({ api })` | No | Custom settings UI |
| `HubPanel(props)` | No | Hub panel content |

## Common Patterns

### Quick agent workflow
```ts
const result = await api.agents.runQuick("Summarize changes");
```

### Storage with defaults
```ts
const data = await api.storage.global.read("key") as MyType ?? defaults;
await api.storage.global.write("key", data);
```

### Command registration
```ts
ctx.subscriptions.push(api.commands.register("my-plugin.cmd", handler));
```

### Subscription cleanup
```ts
ctx.subscriptions.push(api.agents.onStatusChange(callback));
```

## Build System

Standard esbuild configuration:
```bash
esbuild src/main.tsx --bundle --format=esm --platform=browser --external:react --outfile=dist/main.js
```

Dev dependencies: `@clubhouse/plugin-types`, `@types/react`, `esbuild`, `typescript`, `vitest`, `@clubhouse/plugin-testing`

No runtime dependencies — React is provided by the app.

## Testing

Use `@clubhouse/plugin-testing`:
- `createMockAPI(overrides?)` — fully-stubbed API with in-memory storage
- `createMockContext(options?)` — context with sensible defaults
- `renderPlugin(module, options?)` — activate + prepare MainPanel
- `createMockAgents(api, agents)` — pre-populate agent list

## Development Workflow

1. `npx create-clubhouse-plugin` — scaffold
2. `npm install && npm run build` — build
3. `ln -s "$(pwd)" ~/.clubhouse/plugins/<id>` — symlink
4. Enable in Settings > Plugins
5. `npm run watch` — auto-rebuild on save
6. `npm run typecheck` — catch type errors
7. `npm test` — run unit tests

## Documentation Files

For detailed information, refer to these files in the repository:

- [Wiki: Getting Started](https://github.com/Agent-Clubhouse/Clubhouse-Workshop/wiki/Getting-Started) — 5-minute quickstart
- [Wiki: API Reference](https://github.com/Agent-Clubhouse/Clubhouse-Workshop/wiki/API-Reference) — every API method with examples
- [Wiki: Manifest Reference](https://github.com/Agent-Clubhouse/Clubhouse-Workshop/wiki/Manifest-Reference) — every manifest field explained
- [Wiki: Plugin Patterns](https://github.com/Agent-Clubhouse/Clubhouse-Workshop/wiki/Plugin-Patterns) — cookbook-style recipes
- [Wiki: FAQ](https://github.com/Agent-Clubhouse/Clubhouse-Workshop/wiki/FAQ) — common questions answered
- [Wiki: Quality Guidelines](https://github.com/Agent-Clubhouse/Clubhouse-Workshop/wiki/Quality-Guidelines) — best practices
- `sdk/versions.json` — version lifecycle metadata (source of truth for API versions)
- `sdk/v{version}/plugin-types/index.d.ts` — the complete type definitions for each version
- `plugins/example-hello-world/` — minimal working example
- `plugins/code-review/` — agent-powered example
- `plugins/standup/` — app-scoped cross-project example
- `plugins/pomodoro/` — timer with state management example

## Tone

Be helpful, clear, and encouraging. Use plain language. When in doubt, point to a working example in the `plugins/` directory — code speaks louder than explanations.
