# P1 — Tooling, Testing Library, and More Plugins

> Make it easy for other people to build their own plugins. Ship more first-party plugins to exercise and validate the API.

**Depends on:** Workshop P0a/P0b, Clubhouse P0a. Clubhouse P1 (hot-reload) is nice but not blocking.

---

## 1. Testing library: `@clubhouse/plugin-testing`

**Path:** `sdk/plugin-testing/`

**What it is:** An npm package that gives plugin authors test utilities so they can test their plugins without running Clubhouse.

**Core exports:**

### `createMockAPI(overrides?): PluginAPI`
Returns a fully-stubbed `PluginAPI` where every method is a `vi.fn()` / `jest.fn()`. Plugin authors can:
```ts
const api = createMockAPI();
activate(ctx, api);
expect(api.logging.info).toHaveBeenCalledWith('Plugin activated!');
```

Override specific implementations:
```ts
const api = createMockAPI({
  storage: {
    projectLocal: {
      read: vi.fn().mockResolvedValue('{"count": 5}'),
    },
  },
});
```

### `createMockContext(overrides?): PluginContext`
Returns a valid `PluginContext` with sensible defaults:
```ts
const ctx = createMockContext({ pluginId: 'my-plugin', projectPath: '/tmp/test-project' });
```

### `renderPlugin(module, options?): RenderResult`
Activates a plugin module and renders its MainPanel in a test DOM (using `@testing-library/react` under the hood):
```ts
const result = renderPlugin(myPlugin, { projectId: 'test', projectPath: '/tmp/test' });
expect(result.getByText('Hello')).toBeTruthy();
```

### `createMockAgents(agents: Partial<AgentInfo>[]): void`
Pre-populates the mock agents API with test data, so plugins that render agent lists can be tested.

**Peer dependencies:** `vitest` or `jest`, `@testing-library/react`, `react`

---

## 2. Scaffolding CLI: `create-clubhouse-plugin`

**Path:** `create-clubhouse-plugin/`

**Usage:**
```bash
npm create clubhouse-plugin
# or
npx create-clubhouse-plugin
```

**Interactive prompts:**
1. Plugin name → generates ID (lowercased, hyphenated)
2. Scope: project / app / dual
3. Layout: full / sidebar-content (if project-scoped)
4. Permissions: checklist of available permissions
5. Include example agent workflow? (adds a quick-agent demo if agents permission selected)

**Generates:**
```
my-plugin/
  manifest.json       # Filled in from prompts
  package.json        # With build/watch/test/typecheck scripts
  tsconfig.json       # Configured with paths to @clubhouse/plugin-types
  src/
    main.ts           # activate, deactivate, MainPanel skeleton
  .gitignore          # dist/, node_modules/
  README.md           # Template with install instructions
```

**The generated plugin should build and run immediately** — `npm install && npm run build`, symlink, enable, done.

**Templates** (stored in `create-clubhouse-plugin/templates/`):
- `basic` — MainPanel with a heading. Minimal.
- `with-sidebar` — Sidebar + main content layout
- `app-scoped` — Rail item, cross-project, uses projects API
- `agent-workflow` — Spawns a quick agent, shows results

---

## 3. More first-party plugins

Ship 2-3 more plugins in `plugins/`. Priorities:

| Plugin | Scope | Key Pattern | Why |
|--------|-------|-------------|-----|
| **One app-scoped plugin** | app | Rail item, projects API, cross-project view | Proves app-scoped plugins work. No example of this exists yet. |
| **One agent-heavy plugin** | project | agents.runQuick, onStatusChange, widgets | The agents API is the most powerful and unique thing about Clubhouse plugins. Need a reference implementation. |
| **One simple utility** | project | commands, storage, ui | Shows that plugins don't have to be complex. A small tool that fills a gap. |

Each plugin follows the same pattern: `plugins/<name>/` with manifest, source, built dist, and README.

---

## 4. Full documentation

**Path:** `docs/`

### `api-reference.md`
Every method on `PluginAPI`, organized by sub-API:
- Method signature
- Required permission
- Available in which scopes
- Return type
- Short example
- Edge cases / gotchas

### `patterns.md`
Cookbook-style recipes:
- "Spawn a quick agent and display its output"
- "Persist state across sessions"
- "React to agent status changes"
- "Register a command that users can trigger"
- "Show a confirmation dialog before a destructive action"
- "Use external roots to access files outside the project"
- "Use process API to run a CLI tool"

### `faq.md`
- "Why can't I `import React from 'react'`?"
- "My plugin doesn't appear in Settings"
- "How do I debug my plugin?"
- "Can my plugin access other plugins?"
- "How do I update my plugin for a new API version?"

---

## Definition of Done

1. `npm create clubhouse-plugin` scaffolds a working plugin from scratch
2. `@clubhouse/plugin-testing` is published (or usable via file link) and the example plugins use it in their tests
3. 2-3 additional first-party plugins ship in `plugins/` and work correctly
4. `docs/api-reference.md`, `docs/patterns.md`, and `docs/faq.md` exist and are accurate
