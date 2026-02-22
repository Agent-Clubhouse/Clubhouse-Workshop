const React = globalThis.React;

import type { PluginContext, PluginAPI, PanelProps } from '@clubhouse/plugin-types';
import { wikiState } from './state';
import { WikiTree } from './WikiTree';
import { WikiViewer } from './WikiViewer';

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
  return <WikiTree api={api} />;
}

export function MainPanel({ api }: PanelProps) {
  return <WikiViewer api={api} />;
}
