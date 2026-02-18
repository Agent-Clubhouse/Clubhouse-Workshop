# Getting Started with Clubhouse Plugins

Build, install, and run your first Clubhouse plugin in under 5 minutes.

## Prerequisites

- [Clubhouse](https://github.com/masra91/Clubhouse) installed and running
- [Node.js](https://nodejs.org/) 18+ (for building plugins from source)

## 1. Install the example plugin

The fastest way to see a plugin in action:

```bash
# Clone the Workshop repo
git clone https://github.com/masra91/Clubhouse-Workshop.git

# Copy the hello-world plugin to your plugins directory
cp -r Clubhouse-Workshop/plugins/example-hello-world ~/.clubhouse/plugins/
```

The plugin ships with a pre-built `dist/main.js`, so no build step is needed.

## 2. Enable it

1. Open Clubhouse
2. Go to **Settings > Plugins**
3. Find **Hello World** in the list
4. Toggle it **on**

## 3. Verify it works

1. Open any project
2. You should see a **Hello** tab
3. Click the tab — you'll see a counter and some buttons
4. Click **Increment** — the counter goes up and a notification appears
5. Restart Clubhouse — the counter value is still there (it's persisted in storage)

If the tab doesn't appear, check the Settings > Plugins panel for error messages.

## 4. Build your own plugin

### Copy and rename

The easiest way to start is to copy the example:

```bash
cp -r Clubhouse-Workshop/plugins/example-hello-world my-plugin
cd my-plugin
```

Edit `manifest.json`:
- Change `id` to your plugin's unique identifier (e.g., `my-cool-plugin`)
- Change `name`, `description`, `author`
- Adjust `permissions` to what you actually need
- Update `contributes.tab.label` to your tab's name

### Install dependencies

```bash
npm install
```

This installs `esbuild` (bundler), `typescript`, and `@clubhouse/plugin-types` (for autocomplete).

### Develop with a symlink

Instead of copying files every time you change something, symlink your plugin directory:

```bash
# Remove the copied version if you installed it earlier
rm -rf ~/.clubhouse/plugins/my-plugin

# Create a symlink instead
ln -s "$(pwd)" ~/.clubhouse/plugins/my-plugin
```

Now edits to your source are reflected immediately (after building).

### Build

```bash
# One-time build
npm run build

# Or watch for changes (rebuilds on save)
npm run watch
```

After building, restart Clubhouse (or use the plugin reload command if available) to pick up changes.

### Type-checking

```bash
npm run typecheck
```

This runs `tsc --noEmit` to check your TypeScript without producing output files. The actual bundling is handled by esbuild.

## 5. Plugin structure

Every plugin has the same basic structure:

```
my-plugin/
  manifest.json      # Metadata, permissions, contributions
  package.json       # Build scripts, dependencies
  tsconfig.json      # TypeScript config
  src/
    main.tsx         # Your plugin source code
  dist/
    main.js          # Built output (this is what Clubhouse loads)
```

### manifest.json

The manifest tells Clubhouse everything it needs to know about your plugin before loading it. See the [Manifest Reference](./manifest-reference.md) for every field.

### src/main.tsx

Your plugin must export at least an `activate` function. It can optionally export `deactivate`, `MainPanel`, `SidebarPanel`, and `SettingsPanel`.

```tsx
import type { PluginContext, PluginAPI, PanelProps } from "@clubhouse/plugin-types";

const React = globalThis.React;

export function activate(ctx: PluginContext, api: PluginAPI) {
  api.logging.info("My plugin activated!");
}

export function MainPanel({ api }: PanelProps) {
  return <div>Hello from my plugin!</div>;
}
```

**Important:** Plugins run outside webpack's module system. You cannot `import React from 'react'`. Instead, access React from `globalThis.React` — Clubhouse exposes it there for plugins.

### Build config

The `package.json` build script uses esbuild:

```bash
esbuild src/main.tsx --bundle --format=esm --platform=browser --external:react --outfile=dist/main.js
```

Key flags:
- `--format=esm` — Clubhouse loads plugins as ES modules
- `--external:react` — Don't bundle React; use the app's copy via globalThis
- `--platform=browser` — The plugin runs in Electron's renderer process

## 6. Permissions

Plugins declare which APIs they need in `manifest.json`. Clubhouse enforces this — if your plugin tries to use an API it didn't request, the call is blocked.

Request only what you need. Users can see what permissions a plugin requires before enabling it.

See the [Manifest Reference](./manifest-reference.md#permissions) for the full list.

## Next steps

- [Manifest Reference](./manifest-reference.md) — every manifest field explained
- [API Reference](./api-reference.md) — every method on the plugin API
- [Patterns](./patterns.md) — common recipes (agent workflows, storage, commands)
- [FAQ](./faq.md) — answers to common questions
