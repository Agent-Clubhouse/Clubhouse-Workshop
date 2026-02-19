# Clubhouse Workshop

**Build plugins for Clubhouse in minutes.** This repo has everything you need: an SDK with full TypeScript types, a scaffolding CLI, example plugins, and docs to guide you from zero to published.

Whether you're a seasoned developer or just getting started, you're in the right place. Welcome!

---

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/masra91/Clubhouse-Workshop.git
cd Clubhouse-Workshop
```

### 2. Try an example plugin

The fastest way to see a plugin in action — no build step needed:

```bash
# Copy the hello-world example to your plugins folder
cp -r plugins/example-hello-world ~/.clubhouse/plugins/
```

Then open Clubhouse, go to **Settings > Plugins**, find **Hello World**, and toggle it on. You'll see a new **Hello** tab in any project.

### 3. Build your own

```bash
# Scaffold a new plugin interactively
npx create-clubhouse-plugin
```

This walks you through naming your plugin, choosing a scope, picking permissions, and selecting a starter template. When it's done:

```bash
cd my-plugin
npm install
npm run build
```

Link it for development:

```bash
ln -s "$(pwd)" ~/.clubhouse/plugins/my-plugin
```

Enable it in **Settings > Plugins** — that's it!

---

## What's in this repo

```
Clubhouse-Workshop/
  sdk/
    plugin-types/         TypeScript types for the plugin API
    plugin-testing/       Mocks & test harness for unit testing
  create-clubhouse-plugin/  Scaffolding CLI (npx create-clubhouse-plugin)
  plugins/
    example-hello-world/  Minimal starter — counter, storage, notifications
    code-review/          AI-powered code review via quick agents
    standup/              Cross-project standup generator (app-scoped)
    pomodoro/             Focus timer with session tracking
  docs/                   Detailed guides and references
  registry/               Plugin registry catalog
```

---

## Documentation

| Guide | What you'll learn |
|---|---|
| [Getting Started](docs/getting-started.md) | Install, build, and run your first plugin in 5 minutes |
| [Scaffolding Guide](https://github.com/masra91/Clubhouse-Workshop/wiki/Scaffolding-Guide) | Use the CLI to generate any type of plugin |
| [API Reference](https://github.com/masra91/Clubhouse-Workshop/wiki/API-Reference) | Every method on the plugin API with examples |
| [Manifest Reference](https://github.com/masra91/Clubhouse-Workshop/wiki/Manifest-Reference) | Every field in `manifest.json` explained |
| [Plugin Patterns](https://github.com/masra91/Clubhouse-Workshop/wiki/Plugin-Patterns) | Recipes for agents, storage, commands, and more |
| [FAQ](https://github.com/masra91/Clubhouse-Workshop/wiki/FAQ) | Common questions answered |
| [Quality Guidelines](https://github.com/masra91/Clubhouse-Workshop/wiki/Quality-Guidelines) | Best practices for reliable, trustworthy plugins |

---

## Claude Code Skills

If you're using [Claude Code](https://claude.com/claude-code), this repo ships with built-in skills that make plugin development even easier. Just open the repo in Claude Code and use:

| Skill | What it does |
|---|---|
| `/scaffold-plugin` | Interactively walks you through creating a new plugin — picks scope, permissions, and generates all the files with working starter code |
| `/plugin-guide` | Answers questions about the plugin system — architecture, API, manifest, patterns. Ask "how do agents work?" and it knows the answer |

`/scaffold-plugin` is great for beginners — it asks what you want to build and does the rest. `/plugin-guide` loads automatically when you ask Claude questions about the Clubhouse plugin system, so you can just ask naturally.

These skills live in `.claude/skills/` and work automatically when you open this repo.

---

## Plugin Architecture at a Glance

Plugins are **ES modules** that Clubhouse loads at runtime. Each plugin has:

- **`manifest.json`** — declares identity, permissions, and UI contributions
- **`dist/main.js`** — your bundled code (built with esbuild)
- **`activate(ctx, api)`** — entry point called when the plugin loads
- **Panel components** — React components for your plugin's UI

```
                  ┌──────────────────────────┐
                  │       Clubhouse App       │
                  │                           │
  ┌───────────┐   │  ┌─────────────────────┐  │
  │ manifest  │──▶│  │  Plugin Loader       │  │
  │  .json    │   │  │  ─ validate manifest │  │
  └───────────┘   │  │  ─ check permissions │  │
                  │  │  ─ import(main.js)   │  │
  ┌───────────┐   │  └────────┬────────────┘  │
  │ dist/     │──▶│           │               │
  │  main.js  │   │  ┌────────▼────────────┐  │
  └───────────┘   │  │  activate(ctx, api)  │  │
                  │  │  MainPanel({ api })  │  │
                  │  │  SidebarPanel, etc.  │  │
                  │  └─────────────────────┘  │
                  └──────────────────────────┘
```

Plugins access Clubhouse through a sandboxed `PluginAPI` — only methods you've declared permissions for are available. React is provided by the app via `globalThis.React` (no need to bundle it).

---

## Scaffolding Templates

The `create-clubhouse-plugin` CLI offers four templates:

| Template | Best for | What you get |
|---|---|---|
| **basic** | Simple tools, displays, dashboards | A `MainPanel` with logging and storage |
| **with-sidebar** | List/detail interfaces | `SidebarPanel` + `MainPanel` side by side |
| **app-scoped** | Cross-project tools | Rail item with access to all projects |
| **agent-workflow** | AI-powered features | Quick agent spawning with status display |

---

## Example Plugins

Each example is a complete, working plugin you can install immediately or use as a starting point.

### Hello World
The simplest possible plugin. A counter that persists across sessions, a command, and a notification. **Start here.**
```bash
cp -r plugins/example-hello-world ~/.clubhouse/plugins/
```

### Code Review
Spawn an AI agent to review your staged changes or branch diff. Stores review history.
```bash
cp -r plugins/code-review ~/.clubhouse/plugins/
```

### Standup
App-scoped plugin that generates daily standup summaries across all your projects.
```bash
cp -r plugins/standup ~/.clubhouse/plugins/
```

### Pomodoro
Focus timer with 25-minute work / 5-minute break cycles. Tracks session history.
```bash
cp -r plugins/pomodoro ~/.clubhouse/plugins/
```

---

## Development Workflow

```bash
# Create your plugin
npx create-clubhouse-plugin

# Install deps and build
cd my-plugin && npm install && npm run build

# Link for live development
ln -s "$(pwd)" ~/.clubhouse/plugins/my-plugin

# Watch for changes (rebuilds on save)
npm run watch

# Type-check your code
npm run typecheck

# Run tests
npm test
```

After making changes, restart Clubhouse (or use plugin reload) to pick them up.

### Debugging

1. **Plugin logs** — Settings > Plugins > [Your Plugin] > Logs
2. **DevTools** — View > Toggle Developer Tools (console.log works)
3. **Dev mode** — Set `"dev": true` in your manifest for verbose API logging
4. **Source maps** — Add `--sourcemap` to your esbuild command

---

## Testing Your Plugin

The `@clubhouse/plugin-testing` package provides everything you need:

```ts
import { createMockAPI, createMockContext, renderPlugin } from "@clubhouse/plugin-testing";
import * as myPlugin from "../src/main";

test("activate registers commands", async () => {
  const api = createMockAPI();
  const ctx = createMockContext();
  await myPlugin.activate(ctx, api);
  expect(ctx.subscriptions.length).toBeGreaterThan(0);
});
```

See the [Testing section](https://github.com/masra91/Clubhouse-Workshop/wiki/API-Reference#testing) in the API Reference for more.

---

## Building on This

This repo is designed to be forked. Take it, make it yours, and build something great.

1. Fork the repo
2. Build your plugin
3. Ship it

Want your plugin in the official registry? Open a PR back to this upstream repo — see [Contributing a Plugin](registry/CONTRIBUTING.md) for the process.

Found a bug or have a suggestion? [Open an issue](https://github.com/masra91/Clubhouse-Workshop/issues) — we appreciate the heads-up.

---

## Resources

- [Plugin Types SDK](sdk/plugin-types/) — `@clubhouse/plugin-types`
- [Testing Utilities](sdk/plugin-testing/) — `@clubhouse/plugin-testing`
- [Plugin Registry](registry/) — Machine-readable plugin catalog
- [Design Principles](principles.md) — The philosophy behind the plugin system

---

## License

[MIT](LICENSE)
