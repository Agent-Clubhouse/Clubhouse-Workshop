// standup v0.1.0 — pre-built for direct installation
// Source: src/main.tsx | Build: esbuild --bundle --format=esm --external:react

const React = globalThis.React;
const { useState, useEffect, useCallback } = React;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const HISTORY_KEY = "standupHistory";
const MAX_HISTORY = 30;

async function loadHistory(api) {
  const raw = await api.storage.global.read(HISTORY_KEY);
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(raw)) return raw;
  return [];
}

async function saveEntry(api, entry) {
  const history = await loadHistory(api);
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await api.storage.global.write(HISTORY_KEY, history);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function activate(ctx, api) {
  api.logging.info("Standup plugin activated");

  ctx.subscriptions.push(
    api.commands.register("standup.generate", () => {
      api.ui.showNotice("Open the Standup panel to generate");
    })
  );
}

export function deactivate() {}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function MainPanel({ api }) {
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState(null);

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
      const projects = api.projects.list();
      const projectNames = projects.map((p) => p.name);

      const prompt = "You are writing a daily standup summary. The user has " + projects.length + " project(s) open: " + projectNames.join(", ") + ".\n\nSummarize what was accomplished recently across these projects. Format the standup as:\n\n**Yesterday:** What was completed\n**Today:** What is planned (infer from context)\n**Blockers:** Any potential issues\n\nKeep it brief — 3-5 bullet points per section. Write in first person.";

      const output = await api.agents.runQuick(prompt);

      const entry = {
        id: String(Date.now()),
        date: new Date().toISOString().split("T")[0],
        summary: output.split("\n")[0].slice(0, 100),
        output: output,
        projects: projectNames,
      };

      await saveEntry(api, entry);
      const updated = await loadHistory(api);
      setHistory(updated);
      setSelected(entry);

      api.ui.showNotice("Standup generated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      api.ui.showError("Failed: " + msg);
    } finally {
      setRunning(false);
    }
  }, []);

  const styles = {
    container: { padding: 24, fontFamily: "var(--font-family, sans-serif)", height: "100%", overflow: "auto" },
    output: { whiteSpace: "pre-wrap", fontFamily: "var(--font-mono, monospace)", fontSize: 13, lineHeight: 1.6, padding: 16, background: "var(--bg-secondary, #1a1a1a)", borderRadius: 6 },
    historyItem: { padding: "8px 12px", cursor: "pointer", borderRadius: 4, marginBottom: 4, fontSize: 13 },
    meta: { fontSize: 12, color: "var(--text-tertiary, #666)" },
  };

  return React.createElement("div", { style: styles.container },
    React.createElement("h2", { style: { marginTop: 0 } }, "Standup"),

    React.createElement("button", { onClick: generate, disabled: running, style: { cursor: "pointer" } },
      running ? "Generating..." : "Generate Today's Standup"
    ),

    selected && !running && React.createElement("div", { style: { marginTop: 16 } },
      React.createElement("div", { style: styles.meta },
        selected.date + " \u00b7 " + selected.projects.join(", ")
      ),
      React.createElement("div", { style: Object.assign({}, styles.output, { marginTop: 8 }) }, selected.output)
    ),

    history.length > 1 && React.createElement("div", { style: { marginTop: 24 } },
      React.createElement("h3", null, "Past Standups"),
      history.map(function(entry) {
        return React.createElement("div", {
          key: entry.id,
          style: Object.assign({}, styles.historyItem, {
            background: selected && selected.id === entry.id ? "var(--bg-active, #333)" : "transparent"
          }),
          onClick: function() { setSelected(entry); }
        },
          React.createElement("div", null, entry.date),
          React.createElement("div", { style: styles.meta }, entry.projects.join(", "))
        );
      })
    )
  );
}
