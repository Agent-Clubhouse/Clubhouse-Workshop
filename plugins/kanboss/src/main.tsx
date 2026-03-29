const React = globalThis.React;

import type { PluginContext, PluginAPI, PanelProps } from '@clubhouse/plugin-types';
import { kanBossState } from './state';
import { BoardSidebar } from './BoardSidebar';
import { BoardView } from './BoardView';
import { initAutomationEngine, shutdownAutomationEngine } from './AutomationEngine';
import { registerKeyboardShortcuts } from './KeyboardShortcuts';
import { useTheme } from './use-theme';

// ── activate() ──────────────────────────────────────────────────────────

export function activate(ctx: PluginContext, api: PluginAPI): void {
  kanBossState.switchProject();
  api.logging.info('KanBoss plugin activated');

  // Register commands
  const refreshCmd = api.commands.register('refresh', () => {
    kanBossState.triggerRefresh();
  });
  ctx.subscriptions.push(refreshCmd);

  // Initialize automation engine
  const automationSub = initAutomationEngine(api);
  ctx.subscriptions.push(automationSub);

  // Register keyboard shortcuts
  const shortcutsSub = registerKeyboardShortcuts(api);
  ctx.subscriptions.push(shortcutsSub);
}

// ── deactivate() ────────────────────────────────────────────────────────

export function deactivate(): void {
  shutdownAutomationEngine();
  kanBossState.reset();
}

// ── Panels ──────────────────────────────────────────────────────────────

export function SidebarPanel({ api }: PanelProps) {
  const { style: themeStyle } = useTheme(api.theme);
  return (
    <div style={{ ...themeStyle, height: '100%' }}>
      <BoardSidebar api={api} />
    </div>
  );
}

export function MainPanel({ api }: PanelProps) {
  const { style: themeStyle } = useTheme(api.theme);
  return (
    <div style={{ ...themeStyle }}>
      <BoardView api={api} />
    </div>
  );
}
