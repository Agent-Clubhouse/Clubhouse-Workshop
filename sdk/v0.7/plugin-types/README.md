# @clubhouse/plugin-types v0.7

TypeScript type definitions for the Clubhouse plugin SDK.

## Installation

```bash
npm install @clubhouse/plugin-types@0.7.0
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

## What's new in v0.7

- **Plugin themes** — ship color themes via `contributes.themes` in your manifest
- **Global dialogs** — register modal dialogs via `contributes.globalDialog` with keyboard bindings
- **Manifest agent config** — auto-inject skills, templates, and MCP servers via `contributes.agentConfig`
- **File watching** — `api.files.watch(glob, callback)` with the `files.watch` permission
- **Typed sound events** — `SoundEvent` union, `ALL_SOUND_EVENTS` constant, and `SupportedAudioExtension` for compile-time sound pack validation
- **Pack plugins** — headless manifest-only plugins with `kind: 'pack'`
- **Dialog panels** — export a `DialogPanel` component for global modal overlays

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
