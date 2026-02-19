# Plugin Quality Guidelines

Recommendations for building plugins that are reliable, performant, and trustworthy. These are not hard requirements — they're what makes a good plugin.

## Permission minimality

Request only the permissions your plugin actually uses. Every permission you declare is visible to users before they enable your plugin. Excessive permissions erode trust.

**Do:**
```json
"permissions": ["logging", "storage", "git"]
```

**Don't:**
```json
"permissions": ["logging", "storage", "files", "git", "agents", "terminal", "process", "commands", "events", "settings", "navigation", "widgets"]
```

If you need `files.external` or `process`, explain why in your README.

## Error handling

Unhandled exceptions in your plugin can degrade the user's experience. While Clubhouse wraps plugin panels in error boundaries, prevention is better than recovery.

```ts
// Do: handle errors from API calls
try {
  const result = await api.agents.runQuick({ prompt });
  setOutput(result.output);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  api.logging.error("Agent failed:", msg);
  api.ui.showNotice({ message: `Failed: ${msg}`, type: "error" });
}

// Don't: let errors propagate unhandled
const result = await api.agents.runQuick({ prompt }); // throws → crashes panel
```

## Cleanup

Push every disposable to `ctx.subscriptions`. They are automatically disposed when the plugin deactivates. Don't leak event listeners, intervals, or other resources.

```ts
export function activate(ctx: PluginContext, api: PluginAPI) {
  // Good: pushed to subscriptions
  ctx.subscriptions.push(
    api.commands.register("my.cmd", () => {}),
    api.events.on("agent:statusChange", () => {}),
  );

  // Also good: custom cleanup
  const interval = setInterval(poll, 60000);
  ctx.subscriptions.push({ dispose: () => clearInterval(interval) });
}
```

## Storage hygiene

| Scope | Use for |
|---|---|
| `projectLocal` | Caches, UI state, draft data — ephemeral, per-user |
| `project` | Shared configuration, team-visible data |
| `global` | User preferences, cross-project settings |

- Don't store large blobs in key-value storage. If you need to persist large data, use `api.files`.
- Clean up stale data. If you store timestamped entries (like review history), cap the list length.
- Serialize consistently. Always `JSON.stringify`/`JSON.parse` — don't store raw objects.

## Accessibility

- Use semantic HTML (`<button>`, `<h2>`, `<ul>`) instead of styled `<div>` elements
- Use Clubhouse's CSS custom properties (`var(--text-secondary)`, `var(--bg-secondary)`) for consistent theming
- Ensure interactive elements are keyboard-accessible
- Provide meaningful labels for icon-only buttons

## Performance

- **Don't block activation.** Keep `activate()` fast — defer expensive operations.
- **Don't poll when events are available.** Use `api.events.on()` instead of `setInterval`.
- **Don't fetch on every render.** Cache data and invalidate on relevant events.
- **Don't bundle large dependencies.** Use the app's React. Keep your bundle small.

## Testing

Include unit tests for your plugin logic. Use `@clubhouse/plugin-testing` for API mocks.

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

## Documentation

- Include `contributes.help` topics in your manifest — this is required.
- Write a `README.md` covering: what it does, how to install, how to use, what permissions it needs and why.
- If your plugin has settings, document what each setting does.

## Security

- Never store secrets (API keys, tokens) in plugin storage — it's not encrypted.
- If you make network requests, document where and why.
- Don't execute user-provided strings as code.
- If you use `process` permission, limit `allowedCommands` to the minimum set.
