// src/main.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var React = globalThis.React;
var { useState, useEffect, useCallback } = React;
var HISTORY_KEY = "standupHistory";
var MAX_HISTORY = 30;
async function loadHistory(api) {
  const raw = await api.storage.global.read(HISTORY_KEY);
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
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
function activate(ctx, api) {
  api.logging.info("Standup plugin activated");
  ctx.subscriptions.push(
    api.commands.register("standup.generate", () => {
      api.ui.showNotice("Open the Standup panel to generate");
    })
  );
}
function deactivate() {
}
function MainPanel({ api }) {
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    loadHistory(api).then((h) => {
      setHistory(h);
      if (h.length > 0) setSelected(h[0]);
    });
  }, [api]);
  const generate = useCallback(async () => {
    setRunning(true);
    setSelected(null);
    try {
      const projects = api.projects.list();
      const projectNames = projects.map((p) => p.name);
      const prompt = `You are writing a daily standup summary. The user has ${projects.length} project(s) open: ${projectNames.join(", ")}.

Summarize what was accomplished recently across these projects. Format the standup as:

**Yesterday:** What was completed
**Today:** What is planned (infer from context)
**Blockers:** Any potential issues

Keep it brief \u2014 3-5 bullet points per section. Write in first person.`;
      const output = await api.agents.runQuick(prompt);
      const entry = {
        id: `${Date.now()}`,
        date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        summary: output.split("\n")[0].slice(0, 100),
        output,
        projects: projectNames
      };
      await saveEntry(api, entry);
      const updated = await loadHistory(api);
      setHistory(updated);
      setSelected(entry);
      api.ui.showNotice("Standup generated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      api.ui.showError(`Failed: ${msg}`);
    } finally {
      setRunning(false);
    }
  }, [api]);
  const styles = {
    container: { padding: 24, fontFamily: "var(--font-family, sans-serif)", height: "100%", overflow: "auto" },
    output: { whiteSpace: "pre-wrap", fontFamily: "var(--font-mono, monospace)", fontSize: 13, lineHeight: 1.6, padding: 16, background: "var(--bg-secondary, #1a1a1a)", borderRadius: 6 },
    historyItem: { padding: "8px 12px", cursor: "pointer", borderRadius: 4, marginBottom: 4, fontSize: 13 },
    meta: { fontSize: 12, color: "var(--text-tertiary, #666)" }
  };
  return /* @__PURE__ */ jsxs("div", { style: styles.container, children: [
    /* @__PURE__ */ jsx("h2", { style: { marginTop: 0 }, children: "Standup" }),
    /* @__PURE__ */ jsx("button", { onClick: generate, disabled: running, style: { cursor: "pointer" }, children: running ? "Generating..." : "Generate Today's Standup" }),
    selected && !running && /* @__PURE__ */ jsxs("div", { style: { marginTop: 16 }, children: [
      /* @__PURE__ */ jsxs("div", { style: styles.meta, children: [
        selected.date,
        " \xB7 ",
        selected.projects.join(", ")
      ] }),
      /* @__PURE__ */ jsx("div", { style: { ...styles.output, marginTop: 8 }, children: selected.output })
    ] }),
    history.length > 1 && /* @__PURE__ */ jsxs("div", { style: { marginTop: 24 }, children: [
      /* @__PURE__ */ jsx("h3", { children: "Past Standups" }),
      history.map((entry) => /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            ...styles.historyItem,
            background: selected?.id === entry.id ? "var(--bg-active, #333)" : "transparent"
          },
          onClick: () => setSelected(entry),
          children: [
            /* @__PURE__ */ jsx("div", { children: entry.date }),
            /* @__PURE__ */ jsx("div", { style: styles.meta, children: entry.projects.join(", ") })
          ]
        },
        entry.id
      ))
    ] })
  ] });
}
export {
  MainPanel,
  activate,
  deactivate
};
