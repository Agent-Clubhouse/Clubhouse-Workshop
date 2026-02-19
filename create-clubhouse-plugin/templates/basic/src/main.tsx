import type { PluginContext, PluginAPI, PanelProps } from "@clubhouse/plugin-types";

const React = globalThis.React;

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Plugin activated!");
}

export function deactivate(): void {}

export function MainPanel({ api }: PanelProps) {
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>My Plugin</h2>
      <p>Edit src/main.tsx to get started.</p>
    </div>
  );
}
