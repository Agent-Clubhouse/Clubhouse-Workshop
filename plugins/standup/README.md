# Standup Plugin

AI-generated daily standup summaries across all your projects. Spawns a quick agent to analyze recent git activity and produce a structured standup report.

## What it does

- **Generate standup** — creates a daily summary of yesterday's work, today's plan, and blockers
- **Multi-project awareness** — pulls context from all open projects in your workspace
- **Streaming output** — see the standup as it's generated, not just at the end
- **Standup history** — past standups are stored globally and browsable from the Standup panel (up to 30 entries)

## Install

```bash
git clone https://github.com/masra91/Clubhouse-Workshop.git
cp -r Clubhouse-Workshop/.clubhouse/agents/nimble-corgi/plugins/standup ~/.clubhouse/plugins/
```

Then in Clubhouse: **Settings > Plugins > Standup > Enable**.

## Usage

1. Click the **Standup** item in the sidebar rail
2. Click **Generate Today's Standup**
3. Wait for the agent to complete — you'll see output streaming in real time
4. The completed standup is saved to history

You can also browse past standups by clicking any entry in the **Past Standups** list.

## Permissions

| Permission | Why |
|---|---|
| `logging` | Log plugin lifecycle events |
| `storage` | Persist standup history across sessions |
| `notifications` | Show completion and error notifications |
| `agents` | Spawn a quick agent to generate the standup summary |
| `projects` | List open projects to provide context to the agent |
| `git` | Read recent git activity for standup context |

## Commands

| Command | Description |
|---|---|
| `standup.generate` | Generate a new standup (also available via the panel button) |
