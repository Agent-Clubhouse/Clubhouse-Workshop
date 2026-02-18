# Patterns

Cookbook-style recipes for common plugin tasks.

---

## Spawn a quick agent and display its output

The most common agent workflow: send a mission string, await the result, show it.

```tsx
const React = globalThis.React;
const { useState, useCallback } = React;

export function MainPanel({ api }: PanelProps) {
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setOutput("");

    const result = await api.agents.runQuick(
      "Summarize the recent changes in this project"
    );

    setOutput(result);
    setRunning(false);
  }, []);

  return (
    <div>
      <button onClick={run} disabled={running}>
        {running ? "Running..." : "Summarize"}
      </button>
      {output && <pre>{output}</pre>}
    </div>
  );
}
```

> **Note:** `runQuick` returns a `Promise<string>` with the full output. There is no streaming or `onOutput` callback.

---

## Persist state across sessions

Use `api.storage` to save data that survives app restarts. Storage reads return `unknown` and writes accept `unknown`, so you can store structured data directly without serializing to JSON strings.

```tsx
const SETTINGS_KEY = "myPluginSettings";

interface MySettings {
  theme: string;
  autoRun: boolean;
}

const defaults: MySettings = { theme: "dark", autoRun: false };

// Load
async function loadSettings(api: PluginAPI): Promise<MySettings> {
  const raw = await api.storage.global.read(SETTINGS_KEY);
  if (!raw) return defaults;
  return { ...defaults, ...(raw as Partial<MySettings>) };
}

// Save
async function saveSettings(api: PluginAPI, settings: MySettings): Promise<void> {
  await api.storage.global.write(SETTINGS_KEY, settings);
}

// List all keys
async function listAllKeys(api: PluginAPI): Promise<string[]> {
  return await api.storage.global.list();
}
```

### Which storage scope to use

| Scope | Use for |
|---|---|
| `projectLocal` | Per-project ephemeral data (draft state, UI preferences, caches) |
| `project` | Per-project shared data (team-visible configuration) |
| `global` | Cross-project user preferences (settings, history) |

---

## React to agent status changes

Subscribe to all agent status changes and update your UI. The callback receives `(agentId, status, prevStatus)` as separate arguments.

```tsx
export function activate(ctx: PluginContext, api: PluginAPI) {
  const sub = api.agents.onStatusChange((agentId, status, prevStatus) => {
    api.logging.info(`Agent ${agentId}: ${prevStatus} -> ${status}`);

    if (status === "completed") {
      api.ui.showNotice(`Agent ${agentId} finished`);
    }
  });

  ctx.subscriptions.push(sub);
}
```

---

## Register a command that users can trigger

Declare the command in the manifest, then register a handler in `activate()`:

**manifest.json:**
```json
{
  "contributes": {
    "commands": [
      { "id": "my-plugin.runLint", "title": "Run Lint", "keybinding": "Ctrl+Shift+L" }
    ]
  }
}
```

**main.ts:**
```ts
export function activate(ctx: PluginContext, api: PluginAPI) {
  const sub = api.commands.register("my-plugin.runLint", async () => {
    const result = await api.process.exec("eslint", ["src/", "--fix"]);
    if (result.exitCode === 0) {
      api.ui.showNotice("Lint passed!");
    } else {
      api.ui.showError("Lint failed");
    }
  });

  ctx.subscriptions.push(sub);
}
```

---

## Show a confirmation dialog before a destructive action

`showConfirm` takes a plain string message and returns a boolean.

```ts
async function deleteFile(api: PluginAPI, path: string) {
  const confirmed = await api.ui.showConfirm(
    `Are you sure you want to delete "${path}"? This cannot be undone.`
  );

  if (!confirmed) return;

  await api.files.delete(path);
  api.ui.showNotice(`Deleted ${path}`);
}
```

---

## Use external roots to access files outside the project

Use `api.files.forRoot()` to get a file access object scoped to a declared external root.

**manifest.json:**
```json
{
  "permissions": ["files", "files.external"],
  "externalRoots": ["~/.config/my-tool"]
}
```

**main.ts:**
```ts
const configFiles = api.files.forRoot("~/.config/my-tool");
const config = await configFiles.readFile("config.json");
const parsed = JSON.parse(config);

parsed.lastRun = new Date().toISOString();
await configFiles.writeFile(
  "config.json",
  JSON.stringify(parsed, null, 2)
);
```

The app enforces that external file access stays within declared roots.

---

## Use process API to run a CLI tool

The `options` parameter only supports `{ timeout?: number }`. There is no `cwd` or `env` option.

**manifest.json:**
```json
{
  "permissions": ["process"],
  "allowedCommands": ["prettier", "eslint"]
}
```

**main.ts:**
```ts
const result = await api.process.exec("prettier", ["--write", "src/main.ts"], {
  timeout: 10000,
});

if (result.exitCode !== 0) {
  api.logging.error("Prettier failed", { stderr: result.stderr });
}
```

Only commands listed in `allowedCommands` can be executed. Anything else is rejected.

---

## Use shared widget components

Clubhouse provides shared UI components via `api.widgets`. These are pre-built React components, not a registration API.

```tsx
export function MainPanel({ api }: PanelProps) {
  const { AgentTerminal, AgentAvatar, SleepingAgent } = api.widgets;

  const agents = api.agents.list();
  const activeAgent = agents.find(a => a.status === "running");

  if (!activeAgent) {
    return <SleepingAgent />;
  }

  return (
    <div>
      <AgentAvatar agentId={activeAgent.id} />
      <AgentTerminal agentId={activeAgent.id} />
    </div>
  );
}
```

---

## Watch for settings changes

Use `settings.onChange` to react when the user changes plugin settings.

```ts
export function activate(ctx: PluginContext, api: PluginAPI) {
  // Read initial value
  const model = api.settings.get("model", "auto");
  api.logging.info("Starting with model", { model });

  // Watch for changes
  ctx.subscriptions.push(
    api.settings.onChange((settings) => {
      api.logging.info("Settings changed", { settings });
    })
  );
}
```

---

## Clean up subscriptions properly

Push every disposable to `ctx.subscriptions`. They are automatically disposed when the plugin deactivates.

```ts
export function activate(ctx: PluginContext, api: PluginAPI) {
  // Commands
  ctx.subscriptions.push(
    api.commands.register("my-plugin.run", () => { ... })
  );

  // Agent status listeners
  ctx.subscriptions.push(
    api.agents.onStatusChange((agentId, status, prevStatus) => { ... })
  );

  // Settings watchers
  ctx.subscriptions.push(
    api.settings.onChange((settings) => { ... })
  );
}

// deactivate() is only needed for cleanup that ctx.subscriptions can't handle
// (e.g., closing a network connection, flushing a buffer)
export function deactivate() {
  // Usually empty
}
```
