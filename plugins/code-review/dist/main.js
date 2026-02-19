// code-review v0.1.0 — pre-built for direct installation
// Source: src/main.tsx | Build: esbuild --bundle --format=esm --external:react

const React = globalThis.React;
const { useState, useEffect, useCallback } = React;

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const HISTORY_KEY = "reviewHistory";
const MAX_HISTORY = 20;

async function loadHistory(api) {
  const raw = await api.storage.projectLocal.read(HISTORY_KEY);
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
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

// ---------------------------------------------------------------------------
// Review prompts
// ---------------------------------------------------------------------------

function buildStagedPrompt(diff) {
  return "You are a senior code reviewer. Review the following staged git diff. Be concise, constructive, and specific. Organize your feedback by file. Call out bugs, security issues, and style problems. If everything looks good, say so.\n\n```diff\n" + diff + "\n```";
}

function buildBranchPrompt(diff, branch) {
  return 'You are a senior code reviewer. Review all changes on the branch "' + branch + '" shown in the diff below. Be concise, constructive, and specific. Organize your feedback by file. Call out bugs, security issues, and style problems. If everything looks good, say so.\n\n```diff\n' + diff + "\n```";
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function activate(ctx, api) {
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

export function deactivate() {}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function MainPanel({ api }) {
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadHistory(api).then(setHistory);
  }, []);

  const runReview = useCallback(async (mode) => {
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
          setError('No changes found on branch "' + branch + '" relative to main.');
          setRunning(false);
          return;
        }
      }

      const maxDiffLength = 50000;
      const truncated = diff.length > maxDiffLength;
      const trimmedDiff = truncated ? diff.slice(0, maxDiffLength) + "\n\n[... diff truncated ...]" : diff;

      const prompt = mode === "staged"
        ? buildStagedPrompt(trimmedDiff)
        : buildBranchPrompt(trimmedDiff, branch);

      const output = await api.agents.runQuick(prompt);

      const entry = {
        id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        timestamp: new Date().toISOString(),
        mode: mode,
        summary: output.slice(0, 200).split("\n")[0],
        output: output,
      };

      await saveReview(api, entry);
      const updated = await loadHistory(api);
      setHistory(updated);
      setSelectedReview(entry);

      api.ui.showNotice("Review complete");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError("Review failed: " + message);
      api.logging.error("Review failed", { error: message });
    } finally {
      setRunning(false);
    }
  }, []);

  const styles = {
    container: { padding: 24, fontFamily: "var(--font-family, sans-serif)", height: "100%", overflow: "auto" },
    header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
    button: { cursor: "pointer" },
    error: { padding: 12, background: "var(--bg-error, #2a1515)", borderRadius: 6, color: "var(--text-error, #f87171)", marginBottom: 16 },
    output: { whiteSpace: "pre-wrap", fontFamily: "var(--font-mono, monospace)", fontSize: 13, lineHeight: 1.6, padding: 16, background: "var(--bg-secondary, #1a1a1a)", borderRadius: 6, overflow: "auto" },
    historyItem: { padding: "8px 12px", cursor: "pointer", borderRadius: 4, marginBottom: 4, fontSize: 13 },
    meta: { fontSize: 12, color: "var(--text-tertiary, #666)", marginTop: 4 },
  };

  return React.createElement("div", { style: styles.container },
    React.createElement("h2", { style: { marginTop: 0 } }, "Code Review"),

    React.createElement("div", { style: styles.header },
      React.createElement("button", { style: styles.button, onClick: function() { runReview("staged"); }, disabled: running },
        running ? "Reviewing\u2026" : "Review Staged Changes"
      ),
      React.createElement("button", { style: styles.button, onClick: function() { runReview("branch"); }, disabled: running },
        running ? "Reviewing\u2026" : "Review Branch"
      )
    ),

    error && React.createElement("div", { style: styles.error }, error),

    selectedReview && !running && React.createElement("div", null,
      React.createElement("div", { style: styles.meta },
        (selectedReview.mode === "staged" ? "Staged changes" : "Branch") + " review"
      ),
      React.createElement("div", { style: Object.assign({}, styles.output, { marginTop: 8 }) }, selectedReview.output)
    ),

    history.length > 0 && !running && React.createElement("div", { style: { marginTop: 24 } },
      React.createElement("h3", null, "History"),
      history.map(function(entry) {
        return React.createElement("div", {
          key: entry.id,
          style: Object.assign({}, styles.historyItem, {
            background: selectedReview && selectedReview.id === entry.id ? "var(--bg-active, #333)" : "transparent"
          }),
          onClick: function() { setSelectedReview(entry); }
        },
          React.createElement("div", null, entry.summary || "(no summary)"),
          React.createElement("div", { style: styles.meta },
            new Date(entry.timestamp).toLocaleString() + " \u00b7 " + entry.mode
          )
        );
      })
    ),

    history.length === 0 && !running && !selectedReview && React.createElement("p", { style: { color: "var(--text-secondary, #888)" } },
      'No reviews yet. Stage some changes and click "Review Staged Changes" to get started.'
    )
  );
}
