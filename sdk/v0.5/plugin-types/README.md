# @clubhouse/plugin-types

TypeScript type definitions for the Clubhouse plugin API.

This is a **types-only** package — no runtime code. Install it as a dev dependency for autocomplete and type-checking when building Clubhouse plugins.

## Installation

```bash
npm install --save-dev @clubhouse/plugin-types
```

Or, if developing locally alongside the Workshop repo:

```json
{
  "devDependencies": {
    "@clubhouse/plugin-types": "file:../../sdk/plugin-types"
  }
}
```

## Usage

```ts
import type {
  PluginModule,
  PluginContext,
  PluginAPI,
  PanelProps,
} from "@clubhouse/plugin-types";

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Hello from my plugin!");
}

export function MainPanel({ api, ctx }: PanelProps) {
  return <div>My Plugin</div>;
}
```

## What's included

- **Manifest types** — `PluginManifest`, `PluginContributes`, `PluginScope`, `PluginPermission`
- **Module interface** — `PluginModule`, `PanelProps` (what your plugin exports)
- **Context & API** — `PluginContext`, `PluginAPI` and all sub-API interfaces
- **Supporting types** — `FileNode`, `GitStatus`, `AgentInfo`, `Disposable`, and more

## API version

This package version tracks the Clubhouse plugin API version. v0.5.x corresponds to API version 0.5.

## License

MIT
