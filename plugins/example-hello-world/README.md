# Hello World Plugin

A minimal example plugin for Clubhouse. This is the starting point for plugin authors — it demonstrates the basic plugin structure and a handful of API calls.

## What it does

- Renders a **Hello** tab with a persistent counter
- Stores the counter value in project-local storage (survives restarts)
- Registers a "Say Hello" command that triggers a notification
- Logs activation/deactivation lifecycle events

## Install

```bash
# Clone the Workshop repo (if you haven't already)
git clone https://github.com/masra91/Clubhouse-Workshop.git

# Copy the plugin into your Clubhouse plugins directory
cp -r Clubhouse-Workshop/plugins/example-hello-world ~/.clubhouse/plugins/
```

Then in Clubhouse: **Settings > Plugins > Hello World > Enable**.

## Develop

If you want to modify the plugin:

```bash
cd plugins/example-hello-world

# Install dependencies
npm install

# Build (outputs to dist/main.js)
npm run build

# Or watch for changes
npm run watch

# Symlink for development (instead of copying)
ln -s "$(pwd)" ~/.clubhouse/plugins/example-hello-world
```

## Permissions

| Permission | Why |
|---|---|
| `logging` | Log messages to the plugin console |
| `storage` | Persist the counter value across sessions |
| `notifications` | Show toast notifications when the button is clicked |

## Structure

```
example-hello-world/
  manifest.json     # Plugin metadata and declarations
  package.json      # Build scripts and dependencies
  tsconfig.json     # TypeScript configuration
  src/main.tsx      # Source code
  dist/main.js      # Pre-built output (install without building)
```
