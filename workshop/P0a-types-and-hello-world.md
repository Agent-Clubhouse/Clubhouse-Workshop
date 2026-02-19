# P0a — Types Package and Hello World Plugin

> The minimum this repo needs so that someone can build and install a community plugin.

**Depends on:** Clubhouse P0a (the app can actually load community plugins)

---

## 1. SDK: `@clubhouse/plugin-types`

**Path:** `sdk/plugin-types/`

**What it is:** A types-only npm package. No runtime code. Plugin authors install it as a dev dependency for autocomplete and type-checking.

**Contents:**
```
sdk/plugin-types/
  package.json          # name: @clubhouse/plugin-types, version matches API version
  index.d.ts            # All exported types
  CHANGELOG.md
  README.md             # What this is, how to use it
```

**`index.d.ts` contains:**
- `PluginManifest` — manifest shape
- `PluginModule` — what a plugin exports (activate, deactivate, panels)
- `PluginContext` — the ctx passed to activate
- `PluginAPI` — the full API object with all sub-APIs
- `PluginContributes`, `PluginCommandDeclaration`, `PluginSettingDeclaration`, etc.
- All sub-API interfaces: `FilesAPI`, `GitAPI`, `AgentsAPI`, `TerminalAPI`, `StorageAPI`, `UIAPI`, `CommandsAPI`, `EventsAPI`, `SettingsAPI`, `NavigationAPI`, `WidgetsAPI`, `LoggingAPI`, `ProcessAPI`, `ProjectAPI`, `ProjectsAPI`, `HubAPI`
- Supporting types: `FileNode`, `GitStatus`, `GitCommit`, `AgentInfo`, `CompletedQuickAgentInfo`, `ModelOption`, `DirectoryEntry`, `FileStatInfo`, `ProcessExecResult`, `Disposable`, `ScopedStorage`

**Source of truth:** Extracted from `Clubhouse/src/shared/plugin-types.ts` and `Clubhouse/src/shared/types.ts`. The extraction should be scripted so it can be re-run when the API changes.

**Publishing:** npm (if `@clubhouse` scope is available) or `@clubhouse-app/plugin-types`. For P0a, a `file:` link from the example plugin is fine — npm publishing can come later.

---

## 2. Hello World plugin

**Path:** `plugins/example-hello-world/`

**What it is:** The minimal working community plugin. It proves the entire 3P plugin story works end-to-end. It's also the thing new plugin authors copy as a starting point.

**Structure:**
```
plugins/example-hello-world/
  manifest.json
  package.json
  tsconfig.json
  src/
    main.ts
  dist/
    main.js              # Built output (committed so people can install without building)
  README.md              # What this is, how to install it
```

**`manifest.json`:**
```json
{
  "id": "example-hello-world",
  "name": "Hello World",
  "version": "0.1.0",
  "description": "A minimal example plugin for Clubhouse.",
  "author": "Clubhouse Workshop",
  "engine": { "api": 0.5 },
  "scope": "project",
  "main": "./dist/main.js",
  "permissions": ["logging", "storage", "notifications"],
  "contributes": {
    "tab": {
      "label": "Hello",
      "icon": "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><circle cx='12' cy='12' r='10'/><path d='M8 14s1.5 2 4 2 4-2 4-2'/><line x1='9' y1='9' x2='9.01' y2='9'/><line x1='15' y1='9' x2='15.01' y2='9'/></svg>",
      "layout": "full"
    },
    "help": {
      "topics": [
        {
          "id": "overview",
          "title": "Hello World",
          "content": "# Hello World Plugin\n\nA minimal example plugin from the Clubhouse Workshop."
        }
      ]
    }
  }
}
```

**`src/main.ts` demonstrates:**
- `activate(ctx, api)` — logs a message, reads a value from storage, registers a command
- `deactivate()` — logs cleanup
- `MainPanel` — renders a simple UI showing:
  - "Hello from Workshop!" heading
  - A counter (stored in `api.storage.projectLocal`) to prove storage works
  - A button that calls `api.ui.showNotice()` to prove UI API works

**`package.json` scripts:**
- `build` — esbuild bundle (ESM, external react, browser platform)
- `watch` — esbuild watch mode
- `typecheck` — tsc --noEmit

**The built `dist/main.js` should be committed** so that someone can install the plugin without needing to build it themselves. (Clone repo → copy folder → done.)

---

## 3. Getting Started docs

**Path:** `docs/getting-started.md`

**Covers:**
1. Prerequisites (Node.js, Clubhouse installed)
2. Install the hello-world plugin:
   ```bash
   git clone https://github.com/masra91/Clubhouse-Workshop.git
   cp -r Clubhouse-Workshop/plugins/example-hello-world ~/.clubhouse/plugins/
   ```
3. Enable it: Settings > Plugins > Hello World > Enable
4. Verify: Open a project, see the Hello tab, click the button
5. Build your own:
   - Copy the example, rename the folder and manifest ID
   - `npm install && npm run build`
   - Symlink for development: `ln -s $(pwd) ~/.clubhouse/plugins/my-plugin`
   - Edit, build, restart (or hot-reload if P1 is done)
6. Next steps: link to manifest reference, API reference, patterns

---

## 4. Manifest Reference docs

**Path:** `docs/manifest-reference.md`

**Covers every manifest field:**
- `id` — format rules, uniqueness
- `name`, `version`, `description`, `author`
- `engine.api` — current version, what happens if mismatched
- `scope` — `project` / `app` / `dual`, what each means, what APIs are available
- `main` — path resolution, ESM requirements
- `permissions` — every permission with a description of what it grants
- `contributes.tab` — label, icon (SVG format), layout options
- `contributes.railItem` — label, icon, position
- `contributes.commands` — declaring commands
- `contributes.settings` — declaring user-configurable settings
- `contributes.storage` — storage scope declarations
- `contributes.help` — required, format
- `settingsPanel` — declarative vs custom
- `externalRoots` — required when using `files.external`
- `allowedCommands` — required when using `process`

---

## Definition of Done

1. `sdk/plugin-types/` exists with a complete `index.d.ts` matching the app's current API v0.5
2. `plugins/example-hello-world/` builds, installs, and runs in Clubhouse
3. `docs/getting-started.md` walks someone from zero to running plugin in under 5 minutes
4. `docs/manifest-reference.md` documents every manifest field
