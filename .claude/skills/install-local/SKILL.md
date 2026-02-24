---
name: install-local
description: Build a plugin locally and install it to the user's Clubhouse plugins directory for testing without publishing. Use when someone wants to test a plugin locally, install a dev build, or try a plugin before publishing.
argument-hint: "[plugin-name]"
---

# Install a Plugin Locally

Build a plugin from the repository and copy it to the local Clubhouse plugins directory so the user can test it without publishing to the marketplace.

## Step 1: Identify the plugin

If a plugin name was provided via `$ARGUMENTS`, use it. Otherwise, list available plugins and ask which one to install:

1. List directories in `plugins/`
2. Show each plugin's name and version from `manifest.json`

```
Available plugins:
  example-hello-world  — Hello World v1.0.0
  code-review          — Code Review v1.0.0
  pomodoro             — Pomodoro v1.0.0
  ...
```

## Step 2: Determine the install directory

Detect the user's platform and determine the correct Clubhouse plugins directory:

| Platform | Directory |
|----------|-----------|
| macOS (`darwin`) | `~/.clubhouse/plugins/` |
| Linux | `~/.clubhouse/plugins/` |
| Windows | `%APPDATA%\clubhouse\plugins\` (via `$APPDATA` env var) |

Create the directory if it doesn't exist.

## Step 3: Build the plugin

Run the build from the plugin directory:

```bash
cd plugins/{plugin-name}
npm install
npm run build
```

If the build fails, show the error output and stop. Do not install a broken build.

If `npm run typecheck` is available, run it first as a sanity check. If typecheck fails, warn the user but let them choose whether to proceed anyway.

## Step 4: Copy to the install directory

Copy the required files to `{install-dir}/{plugin-id}/`:

**Required files:**
- `manifest.json`
- `dist/` directory (the built output)

**Optional files (copy if they exist):**
- `README.md`
- `sounds/` directory (for plugins with sound packs)
- `assets/` directory (for plugins with static assets)

Do NOT copy:
- `node_modules/`
- `src/`
- `package.json`
- `tsconfig.json`
- `.gitignore`
- Any other development files

If the plugin is already installed at that location, warn the user and ask if they want to overwrite it. Then proceed on confirmation.

## Step 5: Confirm success

After copying, verify the install by checking that `manifest.json` and `dist/main.js` exist in the target directory.

Report:

```
Installed {plugin-name} v{version} to {install-dir}/{plugin-id}/

Files installed:
  manifest.json
  dist/main.js
  [any other files copied]

To use it: restart Clubhouse or reload plugins via Settings > Plugins.
To uninstall: rm -rf {install-dir}/{plugin-id}/
```

## Error handling

- If the plugin directory doesn't exist in `plugins/`, list available plugins and ask again
- If `npm install` fails, suggest checking Node.js version and network connectivity
- If `npm run build` fails, show the build errors — these need to be fixed before installing
- If the target directory can't be written to, suggest checking permissions
