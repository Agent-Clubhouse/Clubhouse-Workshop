import type { PluginContext, PluginAPI, PanelProps } from "@clubhouse/plugin-types";

const React = globalThis.React;
const { useState, useEffect } = React;

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("App-scoped plugin activated!");
}

export function deactivate(): void {}

export function MainPanel({ api }: PanelProps) {
  const [projects, setProjects] = useState<Array<{ id: string; name: string; path: string }>>([]);

  useEffect(() => {
    setProjects(api.projects.list());
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>All Projects</h2>
      {projects.length === 0 && <p>No projects open.</p>}
      {projects.map((p) => (
        <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border, #333)" }}>
          <strong>{p.name}</strong>
          <div style={{ fontSize: 12, color: "var(--text-secondary, #888)" }}>{p.path}</div>
        </div>
      ))}
    </div>
  );
}
