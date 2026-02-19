# Pomodoro Plugin

A simple Pomodoro timer that follows the classic technique: 25 minutes of focused work, then a 5-minute break. Tracks completed sessions per day across restarts.

## What it does

- **25-minute work timer** -- start a focused work session with a single click
- **5-minute break timer** -- take a timed break between sessions
- **Session tracking** -- counts completed pomodoros per day, persisted across restarts (last 30 days)
- **Notifications** -- alerts you when a work session or break ends

## Install

```bash
git clone https://github.com/Agent-Clubhouse/Clubhouse-Workshop.git
cp -r Clubhouse-Workshop/plugins/pomodoro ~/.clubhouse/plugins/
```

Then in Clubhouse: **Settings > Plugins > Pomodoro > Enable**.

## Usage

1. Click the **Pomodoro** icon in the sidebar rail (bottom section)
2. Click **Start Work (25m)** to begin a focus session
3. When the timer reaches zero you will receive a notification -- time for a break
4. Click **Start Break (5m)** to begin a break, or start another work session right away
5. Click **Stop** at any time to cancel the running timer and return to the idle state
6. Your completed session count for today is displayed at the bottom of the panel

## Permissions

| Permission | Why |
|---|---|
| `logging` | Log plugin lifecycle events |
| `storage` | Persist session history across restarts |
| `notifications` | Show alerts when a timer completes |
| `commands` | Register "Start Pomodoro" and "Stop Pomodoro" commands |
| `widgets` | Display the timer panel in the sidebar rail |
