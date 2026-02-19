// src/main.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var React = globalThis.React;
var { useState, useEffect, useCallback } = React;
var HISTORY_KEY = "reviewHistory";
var MAX_HISTORY = 20;
async function loadHistory(api) {
  const raw = await api.storage.projectLocal.read(HISTORY_KEY);
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
async function saveReview(api, entry) {
  const history = await loadHistory(api);
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await api.storage.projectLocal.write(HISTORY_KEY, history);
}
function buildStagedPrompt(diff) {
  return `You are a senior code reviewer. Review the following staged git diff. Be concise, constructive, and specific. Organize your feedback by file. Call out bugs, security issues, and style problems. If everything looks good, say so.

\`\`\`diff
${diff}
\`\`\``;
}
function buildBranchPrompt(diff, branch) {
  return `You are a senior code reviewer. Review all changes on the branch "${branch}" shown in the diff below. Be concise, constructive, and specific. Organize your feedback by file. Call out bugs, security issues, and style problems. If everything looks good, say so.

\`\`\`diff
${diff}
\`\`\``;
}
function activate(ctx, api) {
  api.logging.info("Code Review plugin activated");
  ctx.subscriptions.push(
    api.commands.register("code-review.reviewStaged", async () => {
      api.ui.showNotice("Open the Review tab to see results");
    })
  );
  ctx.subscriptions.push(
    api.commands.register("code-review.reviewBranch", async () => {
      api.ui.showNotice("Open the Review tab to see results");
    })
  );
}
function deactivate() {
}
function MainPanel({ api }) {
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    loadHistory(api).then(setHistory);
  }, []);
  const runReview = useCallback(
    async (mode) => {
      setRunning(true);
      setError(null);
      setSelectedReview(null);
      try {
        let diff;
        let branch = "";
        if (mode === "staged") {
          diff = await api.git.diff("", true);
          if (!diff.trim()) {
            setError("No staged changes found. Stage some changes with `git add` first.");
            setRunning(false);
            return;
          }
        } else {
          branch = await api.git.currentBranch();
          const result = await api.process.exec("git", ["diff", "main...HEAD"]);
          diff = result.stdout;
          if (!diff.trim()) {
            setError(`No changes found on branch "${branch}" relative to main.`);
            setRunning(false);
            return;
          }
        }
        const maxDiffLength = 5e4;
        const truncated = diff.length > maxDiffLength;
        const trimmedDiff = truncated ? diff.slice(0, maxDiffLength) + "\n\n[... diff truncated ...]" : diff;
        const prompt = mode === "staged" ? buildStagedPrompt(trimmedDiff) : buildBranchPrompt(trimmedDiff, branch);
        const output = await api.agents.runQuick(prompt);
        const entry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          mode,
          summary: output.slice(0, 200).split("\n")[0],
          output
        };
        await saveReview(api, entry);
        const updated = await loadHistory(api);
        setHistory(updated);
        setSelectedReview(entry);
        api.ui.showNotice("Review complete");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Review failed: ${message}`);
        api.logging.error("Review failed", { error: message });
      } finally {
        setRunning(false);
      }
    },
    []
  );
  const styles = {
    container: { padding: 24, fontFamily: "var(--font-family, sans-serif)", height: "100%", overflow: "auto" },
    header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
    button: { cursor: "pointer" },
    error: { padding: 12, background: "var(--bg-error, #2a1515)", borderRadius: 6, color: "var(--text-error, #f87171)", marginBottom: 16 },
    output: { whiteSpace: "pre-wrap", fontFamily: "var(--font-mono, monospace)", fontSize: 13, lineHeight: 1.6, padding: 16, background: "var(--bg-secondary, #1a1a1a)", borderRadius: 6, overflow: "auto" },
    historyItem: { padding: "8px 12px", cursor: "pointer", borderRadius: 4, marginBottom: 4, fontSize: 13 },
    meta: { fontSize: 12, color: "var(--text-tertiary, #666)", marginTop: 4 }
  };
  return /* @__PURE__ */ jsxs("div", { style: styles.container, children: [
    /* @__PURE__ */ jsx("h2", { style: { marginTop: 0 }, children: "Code Review" }),
    /* @__PURE__ */ jsxs("div", { style: styles.header, children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          style: styles.button,
          onClick: () => runReview("staged"),
          disabled: running,
          children: running ? "Reviewing\u2026" : "Review Staged Changes"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          style: styles.button,
          onClick: () => runReview("branch"),
          disabled: running,
          children: running ? "Reviewing\u2026" : "Review Branch"
        }
      )
    ] }),
    error && /* @__PURE__ */ jsx("div", { style: styles.error, children: error }),
    selectedReview && !running && /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsxs("div", { style: styles.meta, children: [
        selectedReview.mode === "staged" ? "Staged changes" : "Branch",
        " review"
      ] }),
      /* @__PURE__ */ jsx("div", { style: { ...styles.output, marginTop: 8 }, children: selectedReview.output })
    ] }),
    history.length > 0 && !running && /* @__PURE__ */ jsxs("div", { style: { marginTop: 24 }, children: [
      /* @__PURE__ */ jsx("h3", { children: "History" }),
      history.map((entry) => /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            ...styles.historyItem,
            background: selectedReview?.id === entry.id ? "var(--bg-active, #333)" : "transparent"
          },
          onClick: () => setSelectedReview(entry),
          children: [
            /* @__PURE__ */ jsx("div", { children: entry.summary || "(no summary)" }),
            /* @__PURE__ */ jsxs("div", { style: styles.meta, children: [
              new Date(entry.timestamp).toLocaleString(),
              " \xB7 ",
              entry.mode
            ] })
          ]
        },
        entry.id
      ))
    ] }),
    history.length === 0 && !running && !selectedReview && /* @__PURE__ */ jsx("p", { style: { color: "var(--text-secondary, #888)" }, children: 'No reviews yet. Stage some changes and click "Review Staged Changes" to get started.' })
  ] });
}
export {
  MainPanel,
  activate,
  deactivate
};
