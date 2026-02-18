import type {
  PluginContext,
  PluginAPI,
  PanelProps,
} from "@clubhouse/plugin-types";

const React = globalThis.React;
const { useState, useCallback } = React;

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Agent workflow plugin activated!");
}

export function deactivate(): void {}

export function MainPanel({ api }: PanelProps) {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");

  const run = useCallback(async () => {
    if (!prompt.trim() || running) return;

    setRunning(true);
    setOutput("");

    try {
      const result = await api.agents.runQuick(prompt.trim());
      setOutput(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      api.ui.showNotice(`Agent failed: ${msg}`);
    } finally {
      setRunning(false);
    }
  }, [prompt, running]);

  return (
    <div style={{ padding: 24, fontFamily: "var(--font-family, sans-serif)" }}>
      <h2 style={{ marginTop: 0 }}>Quick Agent</h2>

      <textarea
        value={prompt}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
        placeholder="Enter a prompt for the agent..."
        rows={4}
        style={{
          width: "100%",
          fontFamily: "inherit",
          fontSize: 14,
          padding: 8,
          borderRadius: 4,
          border: "1px solid var(--border, #333)",
          background: "var(--bg-input, #1a1a1a)",
          color: "inherit",
          resize: "vertical",
        }}
        disabled={running}
      />

      <button
        onClick={run}
        disabled={running || !prompt.trim()}
        style={{ marginTop: 8, cursor: "pointer" }}
      >
        {running ? "Running..." : "Run Agent"}
      </button>

      {output && (
        <pre
          style={{
            marginTop: 16,
            padding: 16,
            background: "var(--bg-secondary, #1a1a1a)",
            borderRadius: 6,
            whiteSpace: "pre-wrap",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 13,
            lineHeight: 1.6,
            overflow: "auto",
          }}
        >
          {output}
        </pre>
      )}
    </div>
  );
}
