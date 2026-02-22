const React = globalThis.React;

import type { PluginContext, PluginAPI, PanelProps } from '@clubhouse/plugin-types';
import { kanBossState } from './state';
import { BoardSidebar } from './BoardSidebar';
import { BoardView } from './BoardView';
import { initAutomationEngine, shutdownAutomationEngine } from './AutomationEngine';

// ── activate() ──────────────────────────────────────────────────────────

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info('KanBoss plugin activated');

  // Register commands
  const refreshCmd = api.commands.register('refresh', () => {
    kanBossState.triggerRefresh();
  });
  ctx.subscriptions.push(refreshCmd);

  const newBoardCmd = api.commands.register('new-board', async () => {
    const name = await api.ui.showInput('Board name', 'New Board');
    if (!name) return;
    kanBossState.triggerRefresh();
  });
  ctx.subscriptions.push(newBoardCmd);

  // Initialize automation engine
  const automationSub = initAutomationEngine(api);
  ctx.subscriptions.push(automationSub);
}

// ── deactivate() ────────────────────────────────────────────────────────

export function deactivate(): void {
  shutdownAutomationEngine();
  kanBossState.reset();
}

// ── Panels ──────────────────────────────────────────────────────────────

export function SidebarPanel({ api }: PanelProps) {
  return <BoardSidebar api={api} />;
}

export function MainPanel({ api }: PanelProps) {
  return <BoardView api={api} />;
}
