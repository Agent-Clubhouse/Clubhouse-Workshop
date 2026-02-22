# @clubhouse/plugin-types v0.6

TypeScript type definitions for the Clubhouse plugin API v0.6.

## Installation

```bash
npm install @clubhouse/plugin-types@0.6.0 --save-dev
```

## What's new in v0.6

- **Agent Config API** — Plugins can now inject skills, agent templates, instructions, permission rules, and MCP server configurations into project agents
- **Keyboard bindings** — Commands can declare default hotkeys and manage bindings at runtime
- **Extended navigation** — Pop out agents into separate windows, toggle sidebar and accessory panels

## Usage

```ts
import type { PluginAPI, PluginContext, PluginModule } from "@clubhouse/plugin-types";

export function activate(ctx: PluginContext, api: PluginAPI) {
  // Use the new agent config API
  await api.agentConfig.injectSkill("my-skill", skillContent);

  // Register a command with a keyboard binding
  ctx.subscriptions.push(
    api.commands.registerWithHotkey(
      "my-plugin.doThing",
      "Do Thing",
      () => { /* handler */ },
      "Meta+Shift+D",
    ),
  );
}
```

## Manifest

Plugins targeting v0.6 should set:

```json
{
  "engine": { "api": 0.6 }
}
```

See the [CHANGELOG](./CHANGELOG.md) for the full list of additions and migration notes.
