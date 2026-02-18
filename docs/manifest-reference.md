# Manifest Reference

Every Clubhouse plugin must have a `manifest.json` in its root directory. This file declares the plugin's identity, permissions, and contributions.

## Full example

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A useful Clubhouse plugin.",
  "author": "Your Name",
  "engine": { "api": 0.5 },
  "scope": "project",
  "main": "./dist/main.js",
  "permissions": ["logging", "storage", "files"],
  "contributes": {
    "tab": {
      "label": "My Tab",
      "icon": "<svg>...</svg>",
      "layout": "full"
    },
    "commands": [
      { "id": "my-plugin.doThing", "title": "Do the Thing" }
    ],
    "help": {
      "topics": [
        { "id": "overview", "title": "My Plugin", "content": "# My Plugin\n\nHelp text here." }
      ]
    }
  }
}
```

## Fields

### `id` (required)

A unique identifier for the plugin.

- Must be lowercase, alphanumeric, with hyphens only (e.g., `my-plugin`, `code-review`)
- Must not conflict with any built-in or other installed plugin
- Cannot be changed after first install without users losing their stored data

### `name` (required)

Human-readable display name. Shown in Settings > Plugins and the tab bar.

### `version` (required)

Semantic version string (e.g., `1.0.0`, `0.1.0`).

Used for update checking in the registry. Follow [semver](https://semver.org/): bump major for breaking changes, minor for features, patch for fixes.

### `description` (required)

A short description of what the plugin does. Shown in Settings > Plugins and the registry browser.

### `author` (required)

The plugin author's name or organization.

### `engine` (required)

```json
{ "api": 0.5 }
```

Declares which Clubhouse plugin API version this plugin targets.

- If the app's API version is lower than what the plugin requires, the plugin is rejected at load time with a clear message
- If the app's API version is higher (but still compatible), the plugin loads normally
- The app maintains a list of supported API versions; unsupported versions are rejected

### `scope` (required)

One of: `"project"`, `"app"`, or `"dual"`.

| Scope | Meaning | Loaded when | API access |
|---|---|---|---|
| `project` | Lives inside a project tab | A project is open | `project` API available, `projects` API unavailable |
| `app` | Lives in the app rail (sidebar) | App starts | `projects` API available, `project` scoped to active project |
| `dual` | Can operate in both contexts | App starts | Both APIs available |

Most plugins should be `project`-scoped. Use `app` scope only when you need cross-project functionality (e.g., a standup summary across all projects).

### `main` (required)

Relative path to the built entry point. Must be an ES module.

```json
"main": "./dist/main.js"
```

The file must export at least an `activate` function. See [Plugin Module](#plugin-module-exports) below.

### `permissions` (required)

An array of permission strings declaring which APIs the plugin needs.

| Permission | Grants access to | Notes |
|---|---|---|
| `logging` | `api.logging` | Log messages to the plugin console |
| `storage` | `api.storage` | Read/write key-value storage |
| `notifications` | `api.ui.showNotice`, `api.ui.showConfirm` | Show toasts and confirmation dialogs |
| `files` | `api.files` (project-scoped) | Read/write files within the project |
| `files.external` | `api.files.external` | Read/write files outside the project root. Requires `externalRoots` |
| `git` | `api.git` | Read git status, log, diff, branches |
| `agents` | `api.agents` | List agents, spawn quick agents, subscribe to status changes |
| `terminal` | `api.terminal` | Run shell commands, create terminal sessions |
| `process` | `api.process` | Execute specific CLI commands. Requires `allowedCommands` |
| `commands` | `api.commands` | Register and execute commands |
| `events` | `api.events` | Subscribe to app-wide events |
| `settings` | `api.settings` | Read plugin settings, react to changes |
| `navigation` | `api.navigation` | Open files, focus agents, switch tabs |
| `widgets` | `api.widgets` | Register status bar or toolbar widgets |
| `projects` | `api.projects` | List and access multiple projects (requires `app` or `dual` scope) |

**Request only what you need.** Users can see the permission list before enabling a plugin, and excessive permissions reduce trust.

### `contributes` (required)

Declares what the plugin contributes to the Clubhouse UI.

#### `contributes.tab`

Adds a tab to the project view.

```json
"tab": {
  "label": "My Tab",
  "icon": "<svg width='18' height='18' ...>...</svg>",
  "layout": "full"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | string | yes | Tab label displayed in the tab bar |
| `icon` | string | yes | Inline SVG string (18x18, `currentColor` stroke). Used in the tab bar |
| `layout` | string | no | `"full"` (default) or `"sidebar-content"`. Full uses `MainPanel` only. Sidebar-content renders `SidebarPanel` on the left and `MainPanel` on the right |

#### `contributes.railItem`

Adds an item to the app sidebar rail. Only for `app` or `dual` scoped plugins.

```json
"railItem": {
  "label": "My App View",
  "icon": "<svg width='18' height='18' ...>...</svg>",
  "position": "bottom"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | string | yes | Tooltip and accessibility label |
| `icon` | string | yes | Inline SVG string |
| `position` | string | no | `"top"` (default) or `"bottom"` |

#### `contributes.commands`

Declares commands that the plugin will register.

```json
"commands": [
  {
    "id": "my-plugin.doThing",
    "title": "Do the Thing",
    "keybinding": "Ctrl+Shift+D"
  }
]
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique command ID. Convention: `pluginId.commandName` |
| `title` | string | yes | Human-readable title shown in the command palette |
| `keybinding` | string | no | Default keyboard shortcut |

Declared commands must be registered in `activate()` via `api.commands.register()`.

#### `contributes.settings`

Declares user-configurable settings for the plugin.

```json
"settings": [
  {
    "id": "autoReview",
    "title": "Auto-review on commit",
    "description": "Automatically run a code review when you commit",
    "type": "boolean",
    "default": false
  },
  {
    "id": "model",
    "title": "Review model",
    "type": "select",
    "default": "auto",
    "options": [
      { "label": "Auto", "value": "auto" },
      { "label": "Fast", "value": "fast" },
      { "label": "Thorough", "value": "thorough" }
    ]
  }
]
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Setting key, used with `api.settings.get(key)` |
| `title` | string | yes | Display label |
| `description` | string | no | Help text shown below the setting |
| `type` | string | yes | One of: `"string"`, `"number"`, `"boolean"`, `"select"` |
| `default` | any | no | Default value |
| `options` | array | no | Required for `"select"` type. Each entry has `label` and `value` |

#### `contributes.help` (required)

Every plugin must declare at least one help topic.

```json
"help": {
  "topics": [
    {
      "id": "overview",
      "title": "My Plugin",
      "content": "# My Plugin\n\nMarkdown help content here."
    }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `topics` | array | yes | At least one topic |
| `topics[].id` | string | yes | Unique topic ID within the plugin |
| `topics[].title` | string | yes | Topic title |
| `topics[].content` | string | yes | Markdown content |

### `settingsPanel`

Optional. Name of a custom settings panel component exported from the module.

```json
"settingsPanel": "SettingsPanel"
```

If omitted, Clubhouse auto-generates a settings UI from `contributes.settings`. If provided, the named export is rendered instead, giving the plugin full control over its settings UI.

### `externalRoots`

Required when using the `files.external` permission. An array of absolute paths (or `~`-prefixed paths) that the plugin is allowed to access outside the project root.

```json
"externalRoots": ["~/.config/my-tool", "/usr/local/share/data"]
```

The app enforces these boundaries — `api.files.external.readFile()` rejects paths not under a declared root.

### `allowedCommands`

Required when using the `process` permission. An array of command names the plugin is allowed to execute.

```json
"allowedCommands": ["eslint", "prettier", "git"]
```

`api.process.exec()` rejects any command not in this list. This prevents plugins from running arbitrary executables.

### `dev`

Optional boolean. Enables development-mode behavior:

```json
"dev": true
```

When `true`:
- Verbose logging of all API calls
- Permission check warnings (not just blocks) for undeclared permissions
- Auto-reload when the plugin's files change (requires Clubhouse P1)

Strip this flag before publishing.

## Plugin module exports

The file referenced by `main` must be an ES module exporting at least `activate`:

| Export | Type | Required | Description |
|---|---|---|---|
| `activate` | `(ctx, api) => void \| Promise<void>` | yes | Called when the plugin is enabled. Set up state, register commands, subscribe to events |
| `deactivate` | `() => void \| Promise<void>` | no | Called when the plugin is disabled. Clean up anything not pushed to `ctx.subscriptions` |
| `MainPanel` | `(props: PanelProps) => ReactElement` | no | Rendered in the plugin's tab (or the main area in sidebar-content layout) |
| `SidebarPanel` | `(props: PanelProps) => ReactElement` | no | Rendered in the sidebar when layout is `"sidebar-content"` |
| `SettingsPanel` | `(props: PanelProps) => ReactElement` | no | Custom settings UI (see `settingsPanel` field above) |
