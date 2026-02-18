import type {
  PluginContext,
  PluginAPI,
  PanelProps,
} from "@clubhouse/plugin-types";

const React = globalThis.React;
const { useState, useEffect, useCallback } = React;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StandupEntry {
  id: string;
  date: string;
  summary: string;
  output: string;
  projects: string[];
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const HISTORY_KEY = "standupHistory";
const MAX_HISTORY = 30;

async function loadHistory(api: PluginAPI): Promise<StandupEntry[]> {
  const raw = await api.storage.global.read(HISTORY_KEY);
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(raw)) return raw as StandupEntry[];
  return [];
}

async function saveEntry(api: PluginAPI, entry: StandupEntry): Promise<void> {
  const history = await loadHistory(api);
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await api.storage.global.write(HISTORY_KEY, history);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Standup plugin activated");

  ctx.subscriptions.push(
    api.commands.register("standup.generate", () => {
      api.ui.showNotice("Open the Standup panel to generate");
    })
  );
}

export function deactivate(): void {}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function MainPanel({ api }: PanelProps) {
  const [history, setHistory] = useState<StandupEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<StandupEntry | null>(null);

  useEffect(() => {
    loadHistory(api).then((h) => {
      setHistory(h);
      if (h.length > 0) setSelected(h[0]);
    });
  }, []);

  const generate = useCallback(async () => {
    setRunning(true);
    setSelected(null);

    try {
      // Gather recent commits from all projects
      const projects = api.projects.list();
      const projectNames = projects.map((p) => p.name);

      // Build a prompt that asks the agent to summarize recent work
      const prompt = `You are writing a daily standup summary. The user has ${projects.length} project(s) open: ${projectNames.join(", ")}.

Summarize what was accomplished recently across these projects. Format the standup as:

**Yesterday:** What was completed
**Today:** What is planned (infer from context)
**Blockers:** Any potential issues

Keep it brief — 3-5 bullet points per section. Write in first person.`;

      const output = await api.agents.runQuick(prompt);

      const entry: StandupEntry = {
        id: `${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        summary: output.split("\n")[0].slice(0, 100),
        output,
        projects: projectNames,
      };

      await saveEntry(api, entry);
      const updated = await loadHistory(api);
      setHistory(updated);
      setSelected(entry);

      api.ui.showNotice("Standup generated");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      api.ui.showError(`Failed: ${msg}`);
    } finally {
      setRunning(false);
    }
  }, []);

  const styles = {
    container: { padding: 24, fontFamily: "var(--font-family, sans-serif)", height: "100%", overflow: "auto" } as const,
    output: { whiteSpace: "pre-wrap" as const, fontFamily: "var(--font-mono, monospace)", fontSize: 13, lineHeight: 1.6, padding: 16, background: "var(--bg-secondary, #1a1a1a)", borderRadius: 6 } as const,
    historyItem: { padding: "8px 12px", cursor: "pointer", borderRadius: 4, marginBottom: 4, fontSize: 13 } as const,
    meta: { fontSize: 12, color: "var(--text-tertiary, #666)" } as const,
  };

  return (
    <div style={styles.container}>
      <h2 style={{ marginTop: 0 }}>Standup</h2>

      <button onClick={generate} disabled={running} style={{ cursor: "pointer" }}>
        {running ? "Generating..." : "Generate Today's Standup"}
      </button>

      {selected && !running && (
        <div style={{ marginTop: 16 }}>
          <div style={styles.meta}>
            {selected.date} · {selected.projects.join(", ")}
          </div>
          <div style={{ ...styles.output, marginTop: 8 }}>{selected.output}</div>
        </div>
      )}

      {history.length > 1 && (
        <div style={{ marginTop: 24 }}>
          <h3>Past Standups</h3>
          {history.map((entry) => (
            <div
              key={entry.id}
              style={{
                ...styles.historyItem,
                background: selected?.id === entry.id ? "var(--bg-active, #333)" : "transparent",
              }}
              onClick={() => setSelected(entry)}
            >
              <div>{entry.date}</div>
              <div style={styles.meta}>{entry.projects.join(", ")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
