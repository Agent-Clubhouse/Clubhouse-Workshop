# Standup Plugin

AI-generated daily standup summaries from your project's git activity. Spawns a quick agent to analyze recent commits, branches, and merged PRs to produce a structured standup report.

## What it does

- **Generate standup** — creates a daily summary of yesterday's work, today's plan, and blockers
- **Backfill** — missed a few days? Click Generate and it fills in missing weekdays automatically
- **Standup history** — past standups are stored per-project and browsable from the sidebar panel (up to 90 entries)
- **Configurable** — choose orchestrator, model, and customize the system prompt in Settings

## Install

```bash
git clone https://github.com/Agent-Clubhouse/Clubhouse-Workshop.git
cp -r Clubhouse-Workshop/.clubhouse/agents/nimble-corgi/plugins/standup ~/.clubhouse/plugins/
```

Then in Clubhouse: **Settings > Plugins > Standup > Enable**.

## Usage

1. Open a project and click the **Standup** tab
2. Click **Generate** in the sidebar panel
3. Wait for the agent to complete — standups are generated for today and any missing recent weekdays
4. Browse past standups by clicking any date in the sidebar

## Permissions

| Permission | Why |
|---|---|
| `logging` | Log plugin lifecycle events |
| `storage` | Persist standup history per-project |
| `notifications` | Show completion and error notifications |
| `agents` | Spawn a quick agent to generate the standup summary |
| `projects` | List open projects to provide context to the agent |
| `git` | Read recent git activity for standup context |

## Commands

| Command | Description |
|---|---|
| `standup.generate` | Generate a new standup (also available via the panel button) |
