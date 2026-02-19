# FAQ

## Why can't I `import React from 'react'`?

Clubhouse plugins are loaded as ES modules via dynamic `import()`, outside webpack's module system. When you write `import React from 'react'`, the browser/Node module resolver tries to find a `react` package — but the app's React is bundled by webpack and not available that way.

Instead, access React from the global:

```ts
const React = globalThis.React;
const { useState, useEffect, useCallback } = React;
```

And build with `--external:react` so esbuild doesn't try to bundle it:

```bash
esbuild src/main.tsx --bundle --format=esm --external:react --outfile=dist/main.js
```

## My plugin doesn't appear in Settings > Plugins

Check these in order:

1. **Is the plugin in the right directory?** It should be at `~/.clubhouse/plugins/<your-plugin-id>/` with a `manifest.json` at the root.

2. **Is the manifest valid JSON?** Open `manifest.json` and check for syntax errors (trailing commas, missing quotes).

3. **Does the API version match?** If your `engine.api` is higher than the app's current version, the plugin is rejected. Check that `engine.api` matches the app's supported versions.

4. **Is the `main` path correct?** The `main` field should point to a file that actually exists (e.g., `./dist/main.js`). Check that you've built the plugin.

5. **Check the logs.** Look at the developer console (View > Toggle Developer Tools) for error messages about plugin loading.

## How do I debug my plugin?

1. **Console logging:** Use `api.logging.info()` etc. Messages appear in Settings > Plugins > [Your Plugin] > Logs.

2. **Developer Tools:** Open the Electron DevTools (View > Toggle Developer Tools). Your plugin runs in the renderer process, so `console.log` and breakpoints work.

3. **Dev mode:** Set `"dev": true` in your manifest for verbose logging of all API calls.

4. **Source maps:** If you configure esbuild to emit source maps (`--sourcemap`), they'll work in DevTools for breakpoint debugging.

## Can my plugin access other plugins?

No. There is no plugin-to-plugin communication API. Each plugin operates independently with its own API instance.

If you need shared functionality, consider:
- Using the commands API: one plugin registers a command, another executes it
- Using storage: write to a known key that another plugin reads (but this creates a tight coupling)

Plugin-to-plugin communication may be added in a future API version if there's demand.

## How do I update my plugin for a new API version?

1. Check the `@clubhouse/plugin-types` [CHANGELOG](../sdk/plugin-types/CHANGELOG.md) for what changed.
2. Update your `devDependencies` to the new types version.
3. Run `npm run typecheck` — the compiler will flag breaking changes.
4. Update `engine.api` in your manifest to the new version.
5. Rebuild and test.

The app supports multiple API versions simultaneously (see [Principle 3](../principles.md#principle-3-explicit-support-no-silent-regression)), so you don't need to update immediately — your plugin will continue to work on the old version until it's dropped.

## What React version can I use?

Clubhouse bundles React 19. Your plugin uses the app's React — you don't bundle your own. Declare `@types/react` as a dev dependency for type-checking, but don't include `react` as a runtime dependency.

If the app upgrades React, your plugin gets the new version automatically. This is generally fine for minor/patch upgrades. For major React upgrades, the Clubhouse team will communicate the change and provide migration guidance.

## Can I use CSS files or CSS-in-JS?

Currently, plugins use inline styles. There's no mechanism to load external CSS files. If you need complex styling:

- **Inline styles** work everywhere and avoid class name conflicts
- **CSS custom properties** — use `var(--font-family)`, `var(--bg-secondary)`, etc. to match the app's theme
- **CSS-in-JS** libraries that generate inline styles (like the `style` prop) work fine
- Libraries that inject `<style>` tags may work but aren't officially supported

## How big can my plugin be?

There's no hard size limit, but keep it reasonable:

- The `dist/main.js` bundle is loaded into the renderer process at startup
- Large bundles slow down plugin activation
- Don't bundle heavy dependencies — use the app's React, don't include your own copy

Most plugins should be under 100KB bundled.

## Can I make network requests?

Yes, you can use `fetch()` in your plugin code. The plugin runs in Electron's renderer, which has full network access. However:

- There's no explicit "network" permission — this is currently unrestricted
- If your plugin makes network calls, mention it in your README so users know
- Community plugins that make unexpected network calls may be flagged during review

## Where does my plugin run?

Plugins run in Electron's **renderer process** (the same process as the main UI). This means:

- You have access to browser APIs (`fetch`, `localStorage`, `DOM`, etc.)
- You're on the main thread — avoid blocking operations
- You share the process with the rest of the app — an unhandled exception can cause issues (though error boundaries help)

You do **not** have direct access to Node.js APIs. Use `api.process`, `api.terminal`, and `api.files` for system access.
