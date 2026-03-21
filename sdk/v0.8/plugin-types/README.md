# @clubhouse/plugin-types v0.8

TypeScript type definitions for the Clubhouse plugin SDK.

## Installation

```bash
npm install @clubhouse/plugin-types@0.8.0
```

Or reference directly in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@clubhouse/plugin-types": ["./node_modules/@clubhouse/plugin-types"]
    }
  }
}
```

## What's new in v0.8

- **Canvas API** — register and query canvas widget types via `api.canvas` (requires `canvas` permission)
- **Window API** — programmatic window/tab title management via `api.window`
- **Canvas widget declarations** — declare widget types in `contributes.canvasWidgets`
- **Tab/rail title override** — `contributes.tab.title` and `contributes.railItem.title` for custom window titles
- **Annex permission** — `annex` permission for remote control compatibility
- **Session transcripts** — `api.agents.listSessions()`, `readSessionTranscript()`, and `getSessionSummary()` for reading agent conversation history

See [CHANGELOG.md](./CHANGELOG.md) for the full list of changes and migration notes.

## Usage

```typescript
import type { PluginAPI, PluginContext, PluginModule } from "@clubhouse/plugin-types";

export function activate(ctx: PluginContext, api: PluginAPI) {
  api.ui.showNotice("Hello from my plugin!");
}
```

## License

MIT
