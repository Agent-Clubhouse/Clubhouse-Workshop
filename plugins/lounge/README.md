# Lounge

A Teams-style agent browser for [Clubhouse](https://github.com/Agent-Clubhouse/Clubhouse). Browse and manage AI agents across all projects from a single sidebar, organized into customizable circles.

## Features

- **Agent browser sidebar** — agents grouped by project with inline content view
- **Custom circles** — create, rename, and delete categories with emoji icons
- **Drag-and-drop** — move agents between circles and reorder circles
- **Context menus** — right-click agents to move them, right-click circles to rename/delete
- **Persistent config** — circle assignments, emojis, and order saved across sessions
- **Smart grouping** — auto-groups by project, hides empty project categories, auto-deletes empty custom circles

## Install

Copy the plugin to your Clubhouse plugins directory:

```bash
cp -r plugins/lounge ~/.clubhouse/plugins/
```

Or symlink for development:

```bash
ln -s "$(pwd)/plugins/lounge" ~/.clubhouse/plugins/lounge
```

Then enable it in **Settings → Plugins**.

## Development

```bash
cd plugins/lounge
npm install
npm run build       # Build dist/main.js
npm run watch       # Rebuild on changes
npm run typecheck   # Type-check with tsc
npm test            # Run tests
```

## Permissions

| Permission | Why |
|---|---|
| `agents` | List agents across all projects |
| `projects` | Access project metadata for grouping |
| `navigation` | Navigate to agents when selected |
| `widgets` | Render shared UI components |
| `commands` | Register command palette entries |
| `storage` | Persist circle configuration globally |
