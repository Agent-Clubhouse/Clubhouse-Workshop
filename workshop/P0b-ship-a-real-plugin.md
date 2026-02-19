# P0b — Ship a Real Plugin

> Build and ship the first plugin that someone else would actually want to install.

**Depends on:** Clubhouse P0a (app can load community plugins), Workshop P0a (types + hello world exist)

This is where the Workshop goes from "developer toolkit" to "place where useful things live." The plugin you ship here is also the best test of whether the API is actually good enough.

---

## Pick a plugin and build it

Choose one that:
- Is genuinely useful (not just a demo)
- Exercises 3-4 different APIs (proves the plugin surface is real)
- Is simple enough to ship quickly
- Serves as a reference implementation for other plugin authors

**Good candidates:**

### Option A: Code Review
- **Scope:** project
- **Permissions:** agents, git, files, notifications, storage
- **What it does:** Button that spawns a quick agent to review staged changes (or changes on the current branch). Shows the review in the plugin's tab. Stores review history in project-local storage.
- **Why it's good:** Demonstrates the most powerful API (agents), integrates with git, has real utility.

### Option B: Metrics / Agent Stats
- **Scope:** project
- **Permissions:** agents, storage, events
- **What it does:** Tracks agent runs — how many, how long, which models, tokens used (from completed quick agent data). Shows a dashboard in the plugin's tab.
- **Why it's good:** Demonstrates event subscriptions, storage patterns, data aggregation. Useful for anyone who wants to understand their agent usage.

### Option C: Snippets
- **Scope:** project
- **Permissions:** files, storage, commands, notifications
- **What it does:** Save and recall code snippets. Quick-save from file contents, tag and search, paste back into files.
- **Why it's good:** Demonstrates files API, commands (keyboard-triggered save/paste), storage. Simple and universally useful.

---

## Ship it

The plugin goes in `plugins/<plugin-name>/` with the same structure as hello-world.

**Commit the built `dist/main.js`** so users can install without building:

```bash
git clone https://github.com/Agent-Clubhouse/Clubhouse-Workshop.git
cp -r Clubhouse-Workshop/plugins/<plugin-name> ~/.clubhouse/plugins/
# Restart Clubhouse, enable in Settings > Plugins
```

Write a `README.md` in the plugin directory that covers:
- What it does (with a screenshot if possible)
- How to install (the 2-line copy command)
- How to use it
- What permissions it needs and why

---

## Definition of Done

1. At least one non-trivial plugin exists in `plugins/` that a real user would want
2. It installs and works by copying the folder — no build step required
3. It has a README with install instructions and usage guide
