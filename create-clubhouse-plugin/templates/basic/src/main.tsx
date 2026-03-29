import type { PluginContext, PluginAPI, PanelProps } from "@clubhouse/plugin-types";

const React = globalThis.React;

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Plugin activated!");
}

export function deactivate(): void {}

export function MainPanel({ api }: PanelProps) {
  const projectName = api.project.name();

  return (
    <div style={{ padding: 24, fontFamily: "var(--font-family, sans-serif)" }}>
      <h2 style={{ marginTop: 0 }}>My Plugin</h2>
      <p>Project: <strong>{projectName}</strong></p>
      <p style={{ fontSize: 12, color: "var(--text-secondary, #888)" }}>
        Edit src/main.tsx to get started.
      </p>
    </div>
  );
}
