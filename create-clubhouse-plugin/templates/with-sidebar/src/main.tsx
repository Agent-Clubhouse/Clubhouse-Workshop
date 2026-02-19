import type { PluginContext, PluginAPI, PanelProps } from "@clubhouse/plugin-types";

const React = globalThis.React;
const { useState } = React;

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Plugin activated!");
}

export function deactivate(): void {}

export function SidebarPanel({ api }: PanelProps) {
  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>Navigation</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        <li style={{ padding: "4px 0", cursor: "pointer" }}>Item 1</li>
        <li style={{ padding: "4px 0", cursor: "pointer" }}>Item 2</li>
        <li style={{ padding: "4px 0", cursor: "pointer" }}>Item 3</li>
      </ul>
    </div>
  );
}

export function MainPanel({ api }: PanelProps) {
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Content</h2>
      <p>Select an item in the sidebar to see content here.</p>
    </div>
  );
}
