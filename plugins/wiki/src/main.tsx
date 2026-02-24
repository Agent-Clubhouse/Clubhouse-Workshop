const React = globalThis.React;

import type { PluginContext, PluginAPI, PanelProps } from '@clubhouse/plugin-types';
import { wikiState } from './state';
import { WikiTree } from './WikiTree';
import { WikiViewer } from './WikiViewer';
import { useTheme } from './use-theme';

export function activate(ctx: PluginContext, api: PluginAPI): void {
  const disposable = api.commands.register('refresh', () => {
    wikiState.triggerRefresh();
  });
  ctx.subscriptions.push(disposable);
}

export function deactivate(): void {
  wikiState.reset();
}

export function SidebarPanel({ api }: PanelProps) {
  const { style: themeStyle } = useTheme(api.theme);
  return (
    <div style={{ ...themeStyle, height: '100%' }}>
      <WikiTree api={api} />
    </div>
  );
}

export function MainPanel({ api }: PanelProps) {
  const { style: themeStyle } = useTheme(api.theme);
  return (
    <div style={{ ...themeStyle }}>
      <WikiViewer api={api} />
    </div>
  );
}
