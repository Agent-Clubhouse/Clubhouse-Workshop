# API Reference

Complete reference for the Clubhouse plugin API. Every method, its signature, required permission, and a short example.

The API object is passed to your `activate` function and to every panel component as `props.api`.

```ts
export function activate(ctx: PluginContext, api: PluginAPI) { ... }
export function MainPanel({ api }: PanelProps) { ... }
```

> **Note:** `PanelProps` contains only `{ api: PluginAPI }`. There is no `ctx` prop on panels.

---

## `api.context`

**No permission required.** Always available.

Provides context about the current plugin environment.

```ts
const ctx: PluginContextInfo = api.context;
// { mode: "project", projectId?: "abc123", projectPath?: "/Users/me/my-project" }
```

**`PluginContextInfo` fields:**

| Field | Type | Description |
|---|---|---|
| `mode` | string | The current mode (e.g., `"project"`) |
| `projectId` | string \| undefined | Current project ID, if in a project |
| `projectPath` | string \| undefined | Current project path, if in a project |

---

## `api.logging`

**Permission:** `logging`

Log messages to the plugin console. Visible in Settings > Plugins > [Your Plugin] > Logs.

All logging methods take `(msg: string, meta?: Record<string, unknown>)`.

### `logging.info(msg, meta?)`

```ts
api.logging.info("Plugin loaded", { itemCount: items.length });
```

### `logging.warn(msg, meta?)`

```ts
api.logging.warn("Deprecated API used", { method: "oldMethod" });
```

### `logging.error(msg, meta?)`

```ts
api.logging.error("Failed to load data", { error: error.message });
```

### `logging.debug(msg, meta?)`

```ts
api.logging.debug("Internal state", { count, phase });
```

### `logging.fatal(msg, meta?)`

```ts
api.logging.fatal("Unrecoverable error", { code: "INIT_FAIL" });
```

---

## `api.storage`

**Permission:** `storage`

Key-value storage scoped to different contexts. All methods are async.

### Storage scopes

| Scope | Access | Persists across |
|---|---|---|
| `storage.projectLocal` | This plugin + this project + this user | Sessions, restarts |
| `storage.project` | This plugin + this project (shared if project is shared) | Sessions, restarts |
| `storage.global` | This plugin, all projects, this user | Sessions, restarts, projects |

### `storage.[scope].read(key): Promise<unknown>`

Returns the stored value as-is. The return type is `unknown` -- you must validate/cast it yourself.

```ts
const data = await api.storage.projectLocal.read("myData");
const settings = data as MySettings ?? defaultValue;
```

### `storage.[scope].write(key, value): Promise<void>`

Stores any serializable value. The value type is `unknown` -- no need to stringify.

```ts
await api.storage.projectLocal.write("myData", { theme: "dark", autoRun: true });
```

### `storage.[scope].delete(key): Promise<void>`

```ts
await api.storage.projectLocal.delete("myData");
```

### `storage.[scope].list(): Promise<string[]>`

Returns all keys in the scope.

```ts
const allKeys = await api.storage.projectLocal.list();
```

---

## `api.files`

**Permission:** `files`

Read and write files within the project. All paths are relative to the project root unless absolute.

### `files.readFile(path): Promise<string>`

```ts
const content = await api.files.readFile("src/main.ts");
```

### `files.readBinary(path): Promise<Uint8Array>`

```ts
const binary = await api.files.readBinary("assets/logo.png");
```

### `files.writeFile(path, content): Promise<void>`

```ts
await api.files.writeFile("output.txt", "Hello world");
```

### `files.readTree(path?): Promise<FileNode>`

Returns the full file tree from the given path (default: project root).

```ts
const tree = await api.files.readTree();
// { name: "my-project", path: "/...", type: "directory", children: [...] }
```

### `files.stat(path): Promise<FileStatInfo>`

```ts
const info = await api.files.stat("package.json");
// { path: "package.json", size: 512, type: "file", modified: 1700000000, created: 1699000000 }
```

### `files.rename(oldPath, newPath): Promise<void>`

```ts
await api.files.rename("old-name.ts", "new-name.ts");
```

### `files.copy(src, dest): Promise<void>`

```ts
await api.files.copy("template.ts", "src/new-file.ts");
```

### `files.mkdir(path): Promise<void>`

```ts
await api.files.mkdir("src/components");
```

### `files.delete(path): Promise<void>`

```ts
await api.files.delete("temp/old-file.ts");
```

### `files.showInFolder(path): Promise<void>`

Opens the system file manager and highlights the file.

```ts
await api.files.showInFolder("dist/main.js");
```

### `files.forRoot(rootName): ExternalFiles`

**Permission:** `files.external`

Access files outside the project root. Requires `externalRoots` in the manifest. Returns a file access object scoped to the declared root.

```ts
const configFiles = api.files.forRoot("~/.config/my-tool");
const config = await configFiles.readFile("config.json");
await configFiles.writeFile("config.json", newConfig);
```

The app enforces that external file access stays within declared roots.

---

## `api.git`

**Permission:** `git`

Read-only access to the project's git repository.

### `git.status(): Promise<GitStatus[]>`

Returns an array of `GitStatus` objects, one per changed file.

```ts
const statuses = await api.git.status();
// [{ path: "src/main.ts", status: "modified", staged: true }]

statuses.forEach(entry => {
  console.log(`${entry.path}: ${entry.status} (staged: ${entry.staged})`);
});
```

**`GitStatus` fields:**

| Field | Type | Description |
|---|---|---|
| `path` | string | File path |
| `status` | string | Status (e.g., `"modified"`, `"added"`, `"deleted"`) |
| `staged` | boolean | Whether the change is staged |

### `git.log(limit?: number): Promise<GitCommit[]>`

Takes an optional number to limit results.

```ts
const commits = await api.git.log(10);
// [{ hash: "abc123", shortHash: "abc", subject: "fix: bug", author: "...", date: "..." }]
```

**`GitCommit` fields:**

| Field | Type | Description |
|---|---|---|
| `hash` | string | Full commit hash |
| `shortHash` | string | Abbreviated commit hash |
| `subject` | string | Commit subject line |
| `author` | string | Author name |
| `date` | string | Commit date |

### `git.diff(filePath: string, staged?: boolean): Promise<string>`

Returns the diff for a specific file. Pass `staged: true` to see staged changes.

```ts
// Unstaged changes for a file
const diff = await api.git.diff("src/main.ts");

// Staged changes for a file
const stagedDiff = await api.git.diff("src/main.ts", true);
```

### `git.currentBranch(): Promise<string>`

```ts
const branch = await api.git.currentBranch(); // "feature/my-branch"
```

---

## `api.agents`

**Permission:** `agents`

List agents, spawn quick agents, and react to status changes.

### `agents.list(): AgentInfo[]`

Synchronous. Returns an array of agent info objects.

```ts
const agents = api.agents.list();
agents.forEach(a => console.log(a.name, a.status));
```

### `agents.runQuick(mission, options?): Promise<string>`

Spawn a quick agent that runs a single mission and returns the result as a string. No streaming -- the promise resolves with the full output.

```ts
const result = await api.agents.runQuick("Summarize the recent changes in this project");
console.log(result); // The full output text
```

### `agents.onStatusChange(callback): Disposable`

Subscribe to status changes for all agents. The callback receives three arguments: `agentId`, `status`, and `prevStatus`.

```ts
const sub = api.agents.onStatusChange((agentId, status, prevStatus) => {
  console.log(`Agent ${agentId}: ${prevStatus} -> ${status}`);
});
ctx.subscriptions.push(sub);
```

---

## `api.terminal`

**Permission:** `terminal`

Full terminal control API for spawning and managing shell sessions.

### `terminal.spawn(options?): TerminalSession`

Creates a new terminal session.

```ts
const session = api.terminal.spawn();
```

### `terminal.write(sessionId, data): void`

Writes data to a terminal session.

```ts
api.terminal.write(session.id, "ls -la\n");
```

### `terminal.resize(sessionId, cols, rows): void`

Resizes a terminal session.

```ts
api.terminal.resize(session.id, 120, 40);
```

### `terminal.kill(sessionId): void`

Kills a terminal session.

```ts
api.terminal.kill(session.id);
```

### `terminal.getBuffer(sessionId): string`

Returns the current terminal buffer contents.

```ts
const buffer = api.terminal.getBuffer(session.id);
```

### `terminal.onData(sessionId, callback): Disposable`

Subscribe to terminal output data.

```ts
const sub = api.terminal.onData(session.id, (data) => {
  console.log("Terminal output:", data);
});
ctx.subscriptions.push(sub);
```

### `terminal.onExit(sessionId, callback): Disposable`

Subscribe to terminal session exit.

```ts
const sub = api.terminal.onExit(session.id, (exitCode) => {
  console.log("Terminal exited with code:", exitCode);
});
ctx.subscriptions.push(sub);
```

### `ShellTerminal` component

A React component for rendering an interactive terminal. Available via `api.widgets`.

```tsx
const { ShellTerminal } = api.widgets;

export function MainPanel({ api }: PanelProps) {
  return <ShellTerminal />;
}
```

---

## `api.process`

**Permission:** `process`

Execute specific CLI commands. Requires `allowedCommands` in the manifest -- only listed commands can be executed.

### `process.exec(command, args, options?): Promise<ProcessExecResult>`

The `options` parameter only accepts `{ timeout?: number }`. There is no `cwd` or `env` option.

```ts
const result = await api.process.exec("eslint", ["src/", "--format", "json"], {
  timeout: 30000,
});

if (result.exitCode === 0) {
  const report = JSON.parse(result.stdout);
}
```

---

## `api.ui`

**Permission:** `notifications`

Show notifications, confirmations, and input dialogs. All methods take plain string arguments.

### `ui.showNotice(message: string): void`

```ts
api.ui.showNotice("Operation completed");
```

### `ui.showError(message: string): void`

```ts
api.ui.showError("Something went wrong");
```

### `ui.showConfirm(message: string): Promise<boolean>`

Shows a confirmation dialog with a plain string message. Returns `true` if confirmed, `false` if cancelled.

```ts
const confirmed = await api.ui.showConfirm("Delete this file? This cannot be undone.");
if (confirmed) {
  // proceed with deletion
}
```

### `ui.showInput(prompt: string, defaultValue?: string): Promise<string | null>`

Shows an input dialog. Returns `null` if the user cancels.

```ts
const name = await api.ui.showInput("Enter a project name", "my-project");
if (name !== null) {
  api.logging.info("User entered", { name });
}
```

---

## `api.commands`

**Permission:** `commands`

Register and execute commands. Commands declared in the manifest must be registered in `activate()`.

### `commands.register(commandId, handler): Disposable`

```ts
const sub = api.commands.register("my-plugin.doThing", async () => {
  await doThing();
});
ctx.subscriptions.push(sub);
```

### `commands.execute(commandId, ...args): Promise<void>`

Execute a command registered by any plugin.

```ts
await api.commands.execute("my-plugin.doThing");
```

---

## `api.events`

**Permission:** `events`

Subscribe to app-wide events.

### `events.on(event, handler): Disposable`

```ts
const fileSub = api.events.on("file:change", (event) => {
  console.log(`File ${event.type}: ${event.path}`);
});
ctx.subscriptions.push(fileSub);
```

**Available events:**

| Event | Payload | Description |
|---|---|---|
| `file:change` | `{ path, type }` | A file is created, modified, or deleted |

> **Note:** For agent status changes, use `api.agents.onStatusChange()` instead of `api.events`.

---

## `api.settings`

**Permission:** `settings`

Read plugin settings declared in `contributes.settings`.

### `settings.get(key, defaultValue?)`

```ts
const model = api.settings.get("model", "auto");
const autoReview = api.settings.get("autoReview", false);
```

### `settings.getAll(): Record<string, unknown>`

Returns all settings as a key-value object.

```ts
const all = api.settings.getAll();
```

### `settings.onChange(callback): Disposable`

Subscribe to any settings change.

```ts
const sub = api.settings.onChange((settings) => {
  console.log("Settings changed:", settings);
});
ctx.subscriptions.push(sub);
```

---

## `api.navigation`

**Permission:** `navigation`

Navigate within Clubhouse.

### `navigation.focusAgent(agentId): void`

```ts
api.navigation.focusAgent("agent-123");
```

### `navigation.setExplorerTab(tabId): void`

```ts
api.navigation.setExplorerTab("files");
```

---

## `api.widgets`

Shared UI components provided by Clubhouse for use in plugin panels.

### Available components

| Component | Description |
|---|---|
| `AgentTerminal` | Renders an agent's terminal output |
| `SleepingAgent` | Displays the sleeping agent visual |
| `AgentAvatar` | Renders an agent's avatar |
| `QuickAgentGhost` | Ghost UI for quick agent interactions |
| `ShellTerminal` | Interactive shell terminal component |

```tsx
const { AgentTerminal, SleepingAgent, AgentAvatar } = api.widgets;

export function MainPanel({ api }: PanelProps) {
  return (
    <div>
      <AgentAvatar agentId="agent-123" />
      <AgentTerminal agentId="agent-123" />
    </div>
  );
}
```

---

## `api.project`

**No permission required.** Always available.

File access API for the current project.

### Properties

```ts
api.project.projectPath;  // "/Users/me/my-project"
api.project.projectId;    // "abc123"
```

### `project.readFile(path): Promise<string>`

```ts
const content = await api.project.readFile("src/main.ts");
```

### `project.writeFile(path, content): Promise<void>`

```ts
await api.project.writeFile("output.txt", "Hello world");
```

### `project.deleteFile(path): Promise<void>`

```ts
await api.project.deleteFile("temp/old-file.ts");
```

### `project.fileExists(path): Promise<boolean>`

```ts
if (await api.project.fileExists(".eslintrc.json")) { ... }
```

### `project.listDirectory(path): Promise<string[]>`

```ts
const entries = await api.project.listDirectory("src");
```

---

## `api.projects`

**Permission:** `projects`
**Scope:** `app` or `dual` only

Access all open projects.

### `projects.list(): ProjectInfo[]`

Synchronous. Returns an array of project info objects.

```ts
const projects = api.projects.list();
projects.forEach(p => console.log(p.id, p.path));
```

---

## `api.hub`

**No permission required.** Always available.

### `hub.refresh(): void`

Refreshes the hub.

```ts
api.hub.refresh();
```

---

## `api.badges`

**Permission:** `badges`

Manage badge indicators in the UI.

### `badges.set(options): void`

```ts
api.badges.set({ key: "errors", count: 3, variant: "error" });
```

### `badges.clear(key): void`

```ts
api.badges.clear("errors");
```

### `badges.clearAll(): void`

```ts
api.badges.clearAll();
```

---

## `PluginContext`

The context object passed to `activate()`. Used for managing subscriptions and accessing plugin settings.

```ts
export function activate(ctx: PluginContext, api: PluginAPI) {
  // ctx.subscriptions: Disposable[] -- push disposables here for automatic cleanup
  // ctx.settings: Record<string, unknown> -- plugin settings snapshot
  ctx.subscriptions.push(
    api.commands.register("my-plugin.run", () => { ... })
  );
}
```

| Field | Type | Description |
|---|---|---|
| `subscriptions` | `Disposable[]` | Push disposables here for automatic cleanup on deactivate |
| `settings` | `Record<string, unknown>` | Snapshot of plugin settings at activation time |
