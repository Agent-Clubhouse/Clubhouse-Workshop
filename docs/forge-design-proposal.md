# Forge — Conversational Plugin Builder for Clubhouse

**Status:** Proposal (Draft)
**Author:** fuzzy-coyote
**Date:** 2026-02-25
**Reviewers:** Main app dev team

---

## Executive Summary

Forge is an **app-level Clubhouse plugin** that lets users build bespoke local plugins through a guided, conversational experience — without pulling down the Workshop repo, understanding build tooling, or writing boilerplate from scratch.

The user describes what they want in natural language. Forge walks them through scoping decisions, generates the code, builds it, and installs it locally — all within the Clubhouse app. The result is a working plugin installed to `~/.clubhouse/plugins/`, ready to enable.

---

## 1. Motivation

Today, creating a Clubhouse plugin requires:
1. Cloning the Workshop repo (or running `npx create-clubhouse-plugin`)
2. Understanding Node.js, npm, esbuild, TypeScript
3. Knowing the manifest schema, API surface, and permission model
4. Running CLI commands to build and symlink into the plugins directory

This is fine for developers comfortable with the toolchain, but it's a significant barrier for users who just want a custom workflow tool. Forge aims to reduce this to: **open Forge → describe what you want → get a working plugin**.

---

## 2. User Experience

### 2.1 Entry Point

Forge lives in the **app sidebar rail** (app-scoped plugin). It's always available regardless of which project is open. Clicking the Forge rail icon opens a **sidebar-content layout**:

- **Sidebar (Explorer Panel):** Lists all plugins the user has created via Forge, organized as a project list. Each entry shows name, version, and build status.
- **Main Panel:** Context-sensitive content depending on what's selected — either the conversational builder for new plugins, or a detail/version view for existing ones.

### 2.2 Creating a New Plugin (The Core Flow)

The main panel presents a **step-by-step guided builder** (not a freeform chat). Each step collects a specific decision:

```
┌─────────────────────────────────────────────────────────┐
│  Forge — Plugin Builder                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1 of 5: What should your plugin do?               │
│                                                         │
│  Describe what you want in a sentence or two:           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ I want a plugin that shows a list of my recent  │    │
│  │ git branches and lets me switch between them    │    │
│  │ quickly with a keyboard shortcut.               │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  [Next →]                                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Steps:**

| Step | Purpose | UI |
|------|---------|-----|
| 1. **Describe** | User describes plugin in natural language | Text area |
| 2. **Refine** | AI parses description, proposes name, scope, features, permissions. User confirms/adjusts | Summary card with editable fields |
| 3. **Customize** | Optional: icon selection, settings schema, command palette entries | Form fields |
| 4. **Preview** | AI generates code; Forge shows manifest + source preview | Code preview with syntax highlighting |
| 5. **Build & Install** | Forge builds, validates, and installs locally | Progress log with terminal output |

After step 5, the plugin appears in the sidebar explorer and is available in Clubhouse Settings → Plugins.

### 2.3 Managing Existing Plugins

Selecting a plugin in the sidebar explorer shows:

- **Overview:** Name, version, description, scope, permissions
- **Source:** Read-only view of the generated `src/main.tsx`
- **Versions:** History of builds (stored as snapshots in Forge's workspace)
- **Actions:** Rebuild, Edit (re-enter the builder), Uninstall, Export (save project to a chosen directory)

### 2.4 Editing / Iterating

Users can re-enter the builder for an existing plugin. Forge loads the previous configuration and presents the same step flow, pre-populated. The user can modify their description, adjust settings, or ask for specific changes. Forge regenerates the code, builds, and installs — creating a new version entry.

---

## 3. Architecture

### 3.1 High-Level Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Clubhouse App                           │
│                                                              │
│  ┌──────────────┐     ┌───────────────────────────────────┐  │
│  │  Forge Rail   │────▶│  Forge Plugin (app-scoped)        │  │
│  │  Icon         │     │                                   │  │
│  └──────────────┘     │  ┌─────────┐   ┌──────────────┐  │  │
│                       │  │ Sidebar │   │  Main Panel   │  │  │
│                       │  │ (list)  │   │  (builder/    │  │  │
│                       │  │         │   │   detail)     │  │  │
│                       │  └─────────┘   └──────┬───────┘  │  │
│                       │                       │          │  │
│                       └───────────────────────┼──────────┘  │
│                                               │              │
│              ┌────────────────────────────────┼──────┐       │
│              │           Plugin API           │      │       │
│              │  ┌─────────┐ ┌──────────┐ ┌───┴───┐  │       │
│              │  │ storage │ │ process  │ │agents │  │       │
│              │  │ (global)│ │ (npm,    │ │(quick)│  │       │
│              │  │         │ │  esbuild)│ │       │  │       │
│              │  └─────────┘ └──────────┘ └───────┘  │       │
│              │  ┌─────────┐ ┌──────────┐ ┌───────┐  │       │
│              │  │ files   │ │ terminal │ │  ui   │  │       │
│              │  │(external)│ │(build    │ │       │  │       │
│              │  │         │ │  output) │ │       │  │       │
│              │  └─────────┘ └──────────┘ └───────┘  │       │
│              └──────────────────────────────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  ~/.clubhouse/                                        │    │
│  │  ├── forge/                   ← Forge workspace       │    │
│  │  │   ├── plugins.json         ← Plugin registry       │    │
│  │  │   ├── sdk-bundle/          ← Embedded SDK types    │    │
│  │  │   └── projects/                                    │    │
│  │  │       ├── branch-switcher/ ← One dir per plugin    │    │
│  │  │       │   ├── manifest.json                        │    │
│  │  │       │   ├── package.json                         │    │
│  │  │       │   ├── src/main.tsx                         │    │
│  │  │       │   ├── dist/main.js                         │    │
│  │  │       │   └── node_modules/                        │    │
│  │  │       └── my-timer/                                │    │
│  │  │           └── ...                                  │    │
│  │  └── plugins/                 ← Installed plugins     │    │
│  │      ├── branch-switcher/     ← Built output copied   │    │
│  │      │   ├── manifest.json                            │    │
│  │      │   └── dist/main.js                             │    │
│  │      └── ...                                          │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Workspace Strategy: One Project Per Plugin

Each plugin created through Forge gets its own self-contained project directory under `~/.clubhouse/forge/projects/{plugin-id}/`. This is the simplest, most robust approach:

**Advantages:**
- Clean isolation — each plugin has its own `node_modules/`, build output, and version history
- No dependency conflicts between plugins
- Simple to export (zip the directory) or import
- Easy to reason about — one directory = one plugin

**Trade-offs:**
- Disk usage: each project duplicates `node_modules/` (~15-20 MB for esbuild + typescript + vitest)
- Initial `npm install` takes a few seconds per plugin

**Mitigation:** Forge could pre-seed a shared `node_modules/` template and hardlink or symlink common dependencies. However, this is a v2 optimization — start simple.

### 3.3 SDK Type Distribution

Forge-created plugins need `@clubhouse/plugin-types` for TypeScript type-checking. Two options:

**Option A: Bundle SDK types inside Forge (Recommended)**
- Forge ships with a copy of the latest SDK types in its own assets
- During project creation, Forge copies types into `~/.clubhouse/forge/sdk/` once
- Each plugin's `package.json` references them via `file:../../sdk/plugin-types`
- Forge can update the bundled SDK when the app updates

**Option B: Download from registry**
- Forge fetches SDK types from GitHub/npm at project creation time
- Requires network access; more complex failure modes

Option A is simpler and works offline. The SDK types package is small (~20 KB).

### 3.4 No Git (For Now)

The user mentioned git as a likely need, but for v1, Forge should **not require git**:

- Version history is managed by Forge itself (snapshot copies in storage)
- The generated plugins are small (single-file + manifest) — full VCS is overkill
- Requiring git adds a system dependency that may not be installed
- Users who want git can export their Forge project and put it in their own repo

Version tracking: Forge stores version metadata in `~/.clubhouse/forge/plugins.json` and optionally keeps snapshot copies of previous builds.

---

## 4. API Surface Usage

### 4.1 Required Permissions

| Permission | Purpose |
|-----------|---------|
| `storage` | Store plugin registry, build metadata, user preferences |
| `files` | Read generated source for preview display |
| `files.external` | Read/write files in `~/.clubhouse/forge/` workspace |
| `process` | Run `npm install`, `npm run build`, `esbuild` |
| `terminal` | Show live build output to user (npm install progress, build errors) |
| `agents` | AI code generation via quick agents |
| `notifications` | Build success/failure toasts, confirmation dialogs |
| `logging` | Debug logging |
| `commands` | Register "Create New Plugin" keyboard shortcut |
| `theme` | Respect user's color theme |
| `badges` | Show notification badge when build completes |

**Sensitive permissions:** `files.external`, `process`, `terminal` — these require explicit user approval. This is appropriate: Forge is a powerful tool that creates and installs code.

### 4.2 Manifest Configuration

```json
{
  "id": "forge",
  "name": "Forge",
  "version": "0.1.0",
  "description": "Build custom Clubhouse plugins through guided conversation",
  "author": "Clubhouse Workshop",
  "engine": { "api": 0.6 },
  "scope": "app",
  "main": "./dist/main.js",
  "permissions": [
    "storage", "files", "files.external", "process", "terminal",
    "agents", "notifications", "logging", "commands", "theme", "badges"
  ],
  "allowedCommands": ["npm", "npx", "node", "esbuild"],
  "externalRoots": [
    { "settingKey": "forgeWorkspace", "root": "forge-workspace" }
  ],
  "contributes": {
    "railItem": {
      "label": "Forge",
      "icon": "...",
      "position": "top"
    },
    "commands": [
      { "id": "forge.new", "title": "Forge: New Plugin", "defaultBinding": "Meta+Shift+N" }
    ],
    "settings": [
      {
        "key": "forgeWorkspace",
        "type": "directory",
        "label": "Forge Workspace",
        "description": "Directory where Forge stores plugin projects",
        "default": "~/.clubhouse/forge"
      }
    ],
    "storage": { "scope": "global" },
    "help": {
      "topics": [
        {
          "id": "overview",
          "title": "Forge",
          "content": "# Forge\n\nBuild custom Clubhouse plugins through guided conversation.\n\n## How it works\n\n1. Open Forge from the sidebar\n2. Click \"New Plugin\" and describe what you want\n3. Forge generates the code, builds it, and installs it\n4. Enable your new plugin in Settings > Plugins"
        }
      ]
    }
  }
}
```

### 4.3 Key API Usage Patterns

**AI Code Generation (Quick Agents):**

```tsx
const systemPrompt = `
You are a Clubhouse plugin code generator.
You will receive a description of a plugin and a set of configuration choices.
Generate a complete, working plugin following the Clubhouse SDK patterns.

SDK Documentation:
${EMBEDDED_SDK_DOCS}

Template Patterns:
${EMBEDDED_TEMPLATES}

Rules:
- Use globalThis.React, never import React
- Export activate, deactivate, and panel components
- Use inline styles with CSS custom properties for theming
- Include useTheme hook
- Register all declared commands in activate()
- Handle errors in async operations
`;

const result = await api.agents.runQuick(
  `Generate a Clubhouse plugin based on this specification:\n${JSON.stringify(spec)}`,
  { systemPrompt, model: "auto" }
);
```

**File Operations (External Root):**

```tsx
const forge = api.files.forRoot("forgeWorkspace");

// Create project directory
await forge.mkdir(`projects/${pluginId}`);
await forge.mkdir(`projects/${pluginId}/src`);
await forge.mkdir(`projects/${pluginId}/dist`);

// Write generated files
await forge.writeFile(`projects/${pluginId}/manifest.json`, manifestJson);
await forge.writeFile(`projects/${pluginId}/package.json`, packageJson);
await forge.writeFile(`projects/${pluginId}/src/main.tsx`, generatedCode);
```

**Build Pipeline (Process API):**

```tsx
const projectDir = `${workspacePath}/projects/${pluginId}`;

// Install dependencies
const install = await api.process.exec("npm", ["install"], {
  cwd: projectDir,
  timeout: 60000
});

if (install.exitCode !== 0) {
  api.ui.showError(`npm install failed: ${install.stderr}`);
  return;
}

// Build
const build = await api.process.exec("npm", ["run", "build"], {
  cwd: projectDir,
  timeout: 30000
});

if (build.exitCode !== 0) {
  api.ui.showError(`Build failed: ${build.stderr}`);
  return;
}
```

**Local Installation (Process API):**

```tsx
const installDir = `${homeDir}/.clubhouse/plugins/${pluginId}`;

// Copy manifest + dist to install directory
await api.process.exec("mkdir", ["-p", installDir]);
await api.process.exec("cp", [
  `${projectDir}/manifest.json`, installDir
]);
await api.process.exec("cp", ["-r",
  `${projectDir}/dist`, installDir
]);
```

---

## 5. The AI Generation Layer

### 5.1 How Code Generation Works

Forge does **not** use a freeform chat interface. Instead, it uses a structured, step-based flow where each step collects specific decisions. The AI is invoked at two key points:

1. **Step 2 (Refine):** After the user describes their plugin, a quick agent analyzes the description and proposes: name, scope, permissions, features, UI layout, and commands. This is a structured extraction task with a JSON schema output.

2. **Step 4 (Generate):** After all decisions are confirmed, a quick agent generates the full plugin source code. The system prompt includes embedded SDK documentation, template examples, and the confirmed spec.

This approach is more reliable than open-ended conversation because:
- The AI has constrained, well-defined tasks
- The user reviews and adjusts structured output (not free text)
- Generation failures are recoverable (re-run with same spec)
- The spec is a complete, unambiguous input to code generation

### 5.2 System Prompt Strategy

The generation agent's system prompt should include:

1. **SDK type definitions** (embedded, ~600 lines) — the complete `index.d.ts`
2. **Template examples** (2-3 working plugins as reference)
3. **Manifest schema** (all valid fields and values)
4. **Build constraints** (external:react, globalThis.React, ESM, etc.)
5. **The user's confirmed spec** (name, scope, permissions, features, commands)

Total prompt size: ~3,000-4,000 tokens of context. Well within limits.

### 5.3 Output Parsing

The quick agent returns a string. Forge should instruct the agent to output structured content with clear delimiters:

```
===MANIFEST===
{ ... }
===MAIN_TSX===
import type { ... } from "@clubhouse/plugin-types";
...
===USE_THEME===
...
===END===
```

Forge parses these sections and writes each to the appropriate file. If parsing fails, Forge shows an error and offers to retry.

### 5.4 Fallback: Template-Only Mode

If the user has no AI agent available (no API key configured, etc.), Forge should fall back to a **template-only mode**: the same step flow, but step 4 generates code from templates + string interpolation rather than AI. This produces simpler but functional plugins.

---

## 6. Technical Challenges & Mitigations

### 6.1 Process API Limitations

**Challenge:** The `process.exec()` API runs commands but the current type signature doesn't include a `cwd` option — it only has `timeout`.

```ts
export interface ProcessExecOptions {
  timeout?: number;
}
```

**Impact:** Forge needs to run `npm install` and `npm run build` in a specific project directory. Without `cwd`, it would need to use `cd <dir> && npm install` as a single shell command, or use the terminal API instead.

**Mitigation options:**
1. **Use terminal API for builds** — `api.terminal.spawn(sessionId, cwd)` accepts a `cwd` parameter. Forge can spawn a terminal in the project directory, write commands to it, and capture output. This also gives the user live build output.
2. **Shell wrapper** — Run `sh -c "cd /path && npm install"` via process.exec.
3. **App change (recommended):** Add `cwd` to `ProcessExecOptions`. This is a small, backwards-compatible API addition.

**Recommendation:** Use the terminal API for v1 (no app changes required), and propose adding `cwd` to `ProcessExecOptions` for a future API version.

### 6.2 External File Access Scope

**Challenge:** `api.files.forRoot()` provides a `FilesAPI` scoped to an external root, but the root path comes from a user-configurable setting (`externalRoots` → `settingKey`). This is good for user control but means the path is not guaranteed.

**Mitigation:** Forge initializes the workspace on first activation. If the setting is empty or the directory doesn't exist, Forge creates it with a default path (`~/.clubhouse/forge/`) and informs the user.

### 6.3 Plugin Reload Without App Restart

**Challenge:** After Forge installs a plugin to `~/.clubhouse/plugins/`, the user currently needs to restart Clubhouse or navigate to Settings → Plugins to pick it up. This breaks the "magic" of the conversational flow.

**Impact:** High — this is one of the most important UX moments (seeing your plugin appear).

**Mitigation options:**
1. **Manual reload** (v1): Show a notification: "Plugin installed! Go to Settings → Plugins to enable it." Adequate but not delightful.
2. **App change (recommended):** Expose a `plugins.reload()` or `plugins.refresh()` method in the API. The main app already has plugin discovery logic — it just needs to be triggerable from a plugin.
3. **Hub refresh workaround:** `api.hub.refresh()` might trigger enough of a reload cycle, but this is not its intended purpose and may not pick up new plugin directories.

**Recommendation:** Ship v1 with option 1. Propose `plugins.reload()` for the app API roadmap.

### 6.4 Node.js / npm as a System Dependency

**Challenge:** Forge needs `npm` and `node` to install dependencies and build plugins. These are system-level dependencies that may not be installed on every user's machine.

**Mitigation:**
- **Prerequisite check:** On first activation, Forge runs `node --version` and `npm --version` via `api.process.exec()`. If either is missing, show a clear message explaining the requirement and linking to Node.js installation instructions.
- **Version requirements:** Node >= 18, npm >= 8 (for workspaces support, though we don't need it for v1).
- **Future option:** Bundle a minimal build pipeline that doesn't need npm (embed esbuild as a WASM binary or pre-built binary). This is a significant effort and not recommended for v1.

### 6.5 Quick Agent Reliability for Code Generation

**Challenge:** `api.agents.runQuick()` returns a string result. The quality and format of generated code depends on the model's adherence to the system prompt. Code may have bugs, missing imports, or incorrect API usage.

**Mitigation:**
1. **TypeScript validation:** After generation, run `npx tsc --noEmit` in the project directory. If it fails, show errors and offer to regenerate.
2. **Build validation:** If the build fails, show errors and offer to regenerate or manually edit.
3. **Embedded examples:** The system prompt includes 2-3 complete, working plugin examples to ground the model.
4. **Structured spec:** The input to the code generator is a fully specified JSON object, not ambiguous natural language. This reduces hallucination.
5. **Template fallback:** If generation fails twice, offer to use a template with the user's configuration applied (no AI-generated logic, just boilerplate).

### 6.6 Plugin ID Conflicts

**Challenge:** User-created plugins might have IDs that conflict with official plugins or other installed plugins.

**Mitigation:**
- Forge prefixes all plugin IDs with `forge-` (e.g., `forge-branch-switcher`)
- Before installation, check `~/.clubhouse/plugins/` for existing directories with the same ID
- Show a warning if a conflict is detected

---

## 7. Proposed Main App Changes

These are changes that would significantly improve Forge but are **not blockers for v1**. Forge can ship with workarounds.

### 7.1 Priority 1 — High Impact, Low Effort

| Change | Description | Effort |
|--------|-------------|--------|
| **`ProcessExecOptions.cwd`** | Add `cwd?: string` to process exec options | Small |
| **`plugins.reload()`** | New API method to trigger plugin re-discovery | Small |
| **`plugins.list()`** | New API method to list installed plugins + status | Small |

### 7.2 Priority 2 — Nice to Have

| Change | Description | Effort |
|--------|-------------|--------|
| **Plugin hot-reload** | Auto-detect changes in `~/.clubhouse/plugins/` and reload | Medium |
| **`plugins.enable(id)`** | Programmatically enable a newly installed plugin | Small |
| **`process.exec` stdin** | Allow passing stdin data to process commands | Medium |

### 7.3 Priority 3 — Future Enhancements

| Change | Description | Effort |
|--------|-------------|--------|
| **Plugin workspace API** | First-class support for managing plugin projects (create, build, install) as an app-level concept | Large |
| **Conversational agent widget** | A reusable chat-like UI component for multi-turn agent interactions within plugins | Large |
| **Template registry** | Allow Forge to fetch community templates from the plugin registry | Medium |

---

## 8. Data Model

### 8.1 Forge Plugin Registry (`plugins.json`)

Stored in `api.storage.global` under key `forge-registry`:

```json
{
  "version": 1,
  "plugins": [
    {
      "id": "forge-branch-switcher",
      "name": "Branch Switcher",
      "description": "Quick git branch switching with keyboard shortcut",
      "scope": "project",
      "createdAt": "2026-02-25T10:30:00Z",
      "updatedAt": "2026-02-25T11:45:00Z",
      "currentVersion": "0.2.0",
      "installed": true,
      "spec": {
        "description": "A plugin that shows recent git branches and lets me switch...",
        "scope": "project",
        "layout": "sidebar-content",
        "permissions": ["logging", "storage", "git", "commands", "theme"],
        "commands": [
          { "id": "branch-switcher.switch", "title": "Switch Branch", "defaultBinding": "Meta+Shift+B" }
        ],
        "features": ["List recent branches", "Switch on selection", "Show current branch"]
      },
      "versions": [
        {
          "version": "0.1.0",
          "builtAt": "2026-02-25T10:35:00Z",
          "method": "ai-generated"
        },
        {
          "version": "0.2.0",
          "builtAt": "2026-02-25T11:45:00Z",
          "method": "ai-generated",
          "changes": "Added keyboard shortcut support"
        }
      ]
    }
  ]
}
```

### 8.2 Project Directory Structure

```
~/.clubhouse/forge/
├── sdk/                          ← SDK types (copied from Forge plugin assets)
│   └── plugin-types/
│       ├── index.d.ts
│       └── package.json
├── plugin-testing/               ← Test utilities (optional, for v2)
│   └── ...
└── projects/
    └── forge-branch-switcher/
        ├── manifest.json
        ├── package.json
        ├── tsconfig.json
        ├── .gitignore
        ├── src/
        │   ├── main.tsx
        │   └── use-theme.ts
        ├── dist/
        │   └── main.js
        └── node_modules/         ← Created by npm install
```

---

## 9. UI Wireframes

### 9.1 Sidebar (Explorer Panel)

```
┌───────────────────────┐
│  ⚒ FORGE              │
│                       │
│  [+ New Plugin]       │
│                       │
│  ▾ My Plugins         │
│    ● Branch Switcher  │  ← green dot = installed
│      v0.2.0           │
│    ○ PR Dashboard     │  ← hollow = not installed
│      v0.1.0           │
│    ● Quick Notes      │
│      v0.1.0           │
│                       │
│                       │
│                       │
│                       │
│                       │
└───────────────────────┘
```

### 9.2 Main Panel — New Plugin (Step 1)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  ⚒ Create a New Plugin                                   │
│  ─────────────────────                                   │
│                                                          │
│  ① Describe  ② Refine  ③ Customize  ④ Preview  ⑤ Build  │
│  ━━━━━━━━━━                                              │
│                                                          │
│  What should your plugin do?                             │
│                                                          │
│  Describe it in a few sentences — what problem does      │
│  it solve, what does it show, what actions can it do?    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │                                                  │    │
│  │                                                  │    │
│  │                                                  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  💡 Examples:                                            │
│  • "A timer that tracks how long I spend on each branch" │
│  • "A panel that shows all TODO comments in my code"     │
│  • "A quick agent that generates commit messages"        │
│                                                          │
│                                    [Next →]              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 9.3 Main Panel — Step 2 (AI Refinement)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  ⚒ Create a New Plugin                                   │
│  ─────────────────────                                   │
│                                                          │
│  ① Describe  ② Refine  ③ Customize  ④ Preview  ⑤ Build  │
│              ━━━━━━━━                                    │
│                                                          │
│  Based on your description, here's what I recommend:     │
│                                                          │
│  Name:        [Branch Switcher          ]                │
│  Plugin ID:   forge-branch-switcher                      │
│  Scope:       (●) project  ( ) app  ( ) dual             │
│  Layout:      (●) sidebar-content  ( ) full              │
│                                                          │
│  Features:                                               │
│  ☑ List recent git branches in sidebar                   │
│  ☑ Switch branches on click                              │
│  ☑ Show current branch indicator                         │
│  ☑ Keyboard shortcut for quick switch                    │
│  ☐ Branch search/filter                                  │
│                                                          │
│  Permissions:                                            │
│  logging, storage, git, commands, theme, notifications   │
│                                                          │
│                              [← Back]  [Next →]          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 9.4 Main Panel — Step 5 (Build & Install)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  ⚒ Create a New Plugin                                   │
│  ─────────────────────                                   │
│                                                          │
│  ① Describe  ② Refine  ③ Customize  ④ Preview  ⑤ Build  │
│                                               ━━━━━━━   │
│                                                          │
│  Building Branch Switcher...                             │
│                                                          │
│  ✓ Generated project files                               │
│  ✓ npm install (3.2s)                                    │
│  ✓ TypeScript check passed                               │
│  ✓ esbuild bundle (0.4s)                                 │
│  ✓ Installed to ~/.clubhouse/plugins/forge-branch-switcher│
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  ✓ Branch Switcher v0.1.0 is ready!              │    │
│  │                                                  │    │
│  │  Enable it: Settings → Plugins → Branch Switcher │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│                    [Open Settings]  [Done]                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 9.5 Main Panel — Plugin Detail View

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Branch Switcher                            v0.2.0       │
│  ─────────────────                                       │
│                                                          │
│  Quick git branch switching with keyboard shortcut       │
│                                                          │
│  Scope: project │ Layout: sidebar-content                │
│  Permissions: logging, storage, git, commands, theme     │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐   │
│  │ Overview │ │  Source  │ │ Versions │ │  Actions  │   │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘   │
│                                                          │
│  ▾ Version History                                       │
│                                                          │
│  v0.2.0  — Feb 25, 2026 11:45 AM                        │
│    Added keyboard shortcut support                       │
│    [Installed ✓]                                         │
│                                                          │
│  v0.1.0  — Feb 25, 2026 10:35 AM                        │
│    Initial version                                       │
│    [Install this version]                                │
│                                                          │
│                                                          │
│  [Edit Plugin]  [Rebuild]  [Export]  [Uninstall]         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 10. Scope & Phasing

### Phase 1 — MVP (Target: v0.1.0)

**In scope:**
- App-scoped plugin with sidebar + main panel
- 5-step guided builder (describe → refine → customize → preview → build)
- AI-powered description analysis and code generation
- npm install + esbuild build via terminal API
- Local installation to `~/.clubhouse/plugins/`
- Plugin explorer sidebar listing created plugins
- Plugin detail view with version history
- Rebuild and uninstall actions
- Template-only fallback mode (no AI)

**Out of scope for v1:**
- Git version control for projects
- Plugin export/import
- Custom icon uploads
- Multi-file plugins (all generated code in single `main.tsx`)
- Test generation
- Plugin update notifications
- Community template sharing

### Phase 2 — Enhanced Generation

- Multi-file plugin support (separate files for components, utils)
- Test generation (`src/main.test.tsx`)
- Smarter AI iteration (user can describe changes to existing plugin)
- Plugin preview/sandbox (render plugin in an isolated frame before installing)

### Phase 3 — Ecosystem

- Export plugin as zip/tarball for sharing
- Import plugins from zip/tarball
- Community template gallery
- Plugin dependency management
- Integration with Workshop repo for publishing

---

## 11. Risks & Open Questions

### 11.1 Open Questions

1. **App-scoped + sidebar-content layout:** The current manifest schema has `railItem` for app-scoped plugins but `tab.layout: "sidebar-content"` only applies to project-scoped tabs. **Can an app-scoped plugin have a sidebar-content layout?** If not, Forge would need to implement its own sidebar/content split within a single MainPanel (which is entirely doable but worth confirming).

2. **`externalRoots` behavior:** Does `api.files.forRoot()` resolve `~` in paths? Does it create the directory if it doesn't exist? Need to test against the actual app implementation.

3. **`process.exec` working directory:** The current type definition only has `timeout` in options. Does the actual implementation support `cwd`? If not, what's the recommended pattern for running commands in a specific directory?

4. **Quick agent output format:** Does `api.agents.runQuick()` return just the agent's final text output as a string? Or does it return structured data? This affects how Forge parses generated code.

5. **Plugin reload mechanism:** Is there any existing way to trigger plugin re-discovery without restarting the app? Even an internal/undocumented one?

6. **`allowedCommands` enforcement:** How does the app enforce `allowedCommands`? Is it an allowlist applied to `process.exec`? Does it also apply to terminal API commands?

### 11.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI generates broken code | Medium | Medium | TypeScript validation + template fallback |
| npm install fails (network, permissions) | Low | High | Clear error messages + prerequisite checks |
| Node.js not installed on user machine | Medium | Blocker | Prerequisite check on activation with install guide |
| Plugin ID conflicts with future official plugins | Low | Medium | `forge-` prefix convention |
| Generated plugins have security issues | Low | Medium | Sandbox enforcement by main app; no escalation beyond declared permissions |
| Workspace directory permissions issues | Low | Medium | Use standard user directories (`~/.clubhouse/`) |
| Large disk usage from many plugin projects | Low | Low | Cleanup tools + shared node_modules (v2) |

---

## 12. Alternatives Considered

### 12.1 Freeform Chat Interface

**Rejected.** A chat interface is more flexible but less reliable. Users would need to know what to ask for, and the AI would need to handle ambiguous multi-turn conversations about plugin architecture. The structured step flow is more predictable and produces better results.

### 12.2 VS Code Extension-Style Marketplace

**Out of scope.** Forge is about personal, local plugins — not publishing and distribution. The existing registry handles public plugins. Forge fills the gap for bespoke, one-off workflow tools.

### 12.3 Forge as a Main App Feature (Not a Plugin)

**Rejected for now.** Building Forge as a plugin proves that the plugin API is powerful enough to build complex tools. It also means Forge can ship independently of main app release cycles. If Forge proves valuable, parts of it could be promoted to built-in app features later.

### 12.4 Using Durable Agents Instead of Quick Agents

**Considered but deferred.** Durable agents persist and can be resumed, which would enable true multi-turn conversations. However, they're heavier-weight and designed for project-scoped work. Quick agents are simpler and sufficient for the structured generation tasks Forge needs. A future version could explore using durable agents for more complex plugin building sessions.

---

## 13. Success Criteria

For the MVP to be considered successful:

1. A non-developer Clubhouse user can create a working plugin from a natural language description in under 5 minutes
2. Generated plugins build successfully on first attempt ≥ 80% of the time
3. The build → install → enable cycle completes without leaving the Clubhouse app (except for the enable step in Settings, unless plugin reload API is available)
4. Users can iterate on their plugins (modify description → regenerate → rebuild) without manual file editing
5. The entire workflow works offline except for the AI generation step

---

## 14. Appendix: SDK Capabilities Reference

For reference, these are the v0.6 APIs most relevant to Forge's implementation:

| API | Method | Forge Usage |
|-----|--------|-------------|
| `api.storage.global` | `read/write/list` | Plugin registry, build metadata |
| `api.files.forRoot()` | `readFile/writeFile/mkdir/readTree` | Manage workspace project files |
| `api.process.exec()` | `exec("npm", [...])` | Build pipeline |
| `api.terminal.spawn()` | `spawn(id, cwd)` | Live build output |
| `api.terminal.onData()` | `onData(id, cb)` | Capture build output |
| `api.terminal.ShellTerminal` | React component | Render build terminal |
| `api.agents.runQuick()` | `runQuick(prompt, opts)` | AI code generation |
| `api.ui.showNotice()` | `showNotice(msg)` | Success/failure messages |
| `api.ui.showConfirm()` | `showConfirm(msg)` | Overwrite confirmations |
| `api.ui.showInput()` | `showInput(prompt)` | Quick text input |
| `api.commands.registerWithHotkey()` | `registerWithHotkey(...)` | "New Plugin" shortcut |
| `api.theme.getCurrent()` | `getCurrent()` | Theme-aware UI |
| `api.badges.set()` | `set({...})` | Build completion notification |
| `api.logging.*` | `info/warn/error` | Debug logging |
