# Code Review Plugin

AI-powered code review for your staged changes or branch diff. Spawns a quick agent to analyze your code and provide constructive feedback.

## What it does

- **Review staged changes** — analyzes your `git add`-ed changes before you commit
- **Review branch** — analyzes all changes on your current branch relative to main
- **Streaming output** — see the review as it's generated, not just at the end
- **Review history** — past reviews are stored per-project and accessible in the Review tab

## Install

```bash
git clone https://github.com/masra91/Clubhouse-Workshop.git
cp -r Clubhouse-Workshop/plugins/code-review ~/.clubhouse/plugins/
```

Then in Clubhouse: **Settings > Plugins > Code Review > Enable**.

## Usage

1. Stage some changes: `git add .`
2. Open the **Review** tab
3. Click **Review Staged Changes**
4. Wait for the agent to complete — you'll see output streaming in real time
5. The completed review is saved to history

You can also click **Review Branch** to review all changes on your current branch compared to main.

## Permissions

| Permission | Why |
|---|---|
| `logging` | Log plugin lifecycle events |
| `storage` | Persist review history across sessions |
| `notifications` | Show completion notifications |
| `files` | Read project files for context |
| `git` | Read staged changes, branch diff, current branch name |
| `agents` | Spawn a quick agent to perform the review |
| `commands` | Register "Review Staged Changes" and "Review Branch" commands |

## Settings

| Setting | Description | Default |
|---|---|---|
| Review model | Which model to use (`auto`, `fast`, `thorough`) | `auto` |
