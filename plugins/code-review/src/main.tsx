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

interface ReviewEntry {
  id: string;
  timestamp: string;
  mode: "staged" | "branch";
  summary: string;
  output: string;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const HISTORY_KEY = "reviewHistory";
const MAX_HISTORY = 20;

async function loadHistory(api: PluginAPI): Promise<ReviewEntry[]> {
  const raw = await api.storage.projectLocal.read(HISTORY_KEY);
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw as ReviewEntry[];
  return [];
}

async function saveReview(api: PluginAPI, entry: ReviewEntry): Promise<void> {
  const history = await loadHistory(api);
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await api.storage.projectLocal.write(HISTORY_KEY, history);
}

// ---------------------------------------------------------------------------
// Default branch detection
// ---------------------------------------------------------------------------

async function detectDefaultBranch(api: PluginAPI): Promise<string> {
  // 1. Check user-configured setting
  const configured = api.settings.get<string>("defaultBranch");
  if (configured) return configured;

  // 2. Auto-detect via git rev-parse
  try {
    const result = await api.process.exec("git", [
      "rev-parse",
      "--abbrev-ref",
      "origin/HEAD",
    ]);
    const branch = result.stdout.trim().replace(/^origin\//, "");
    if (branch && branch !== "HEAD") return branch;
  } catch {
    // rev-parse can fail if origin/HEAD is not set — fall through
  }

  // 3. Fallback
  return "main";
}

// ---------------------------------------------------------------------------
// Review prompts
// ---------------------------------------------------------------------------

function buildStagedPrompt(diff: string): string {
  return `You are a senior code reviewer. Review the following staged git diff. Be concise, constructive, and specific. Organize your feedback by file. Call out bugs, security issues, and style problems. If everything looks good, say so.

\`\`\`diff
${diff}
\`\`\``;
}

function buildBranchPrompt(diff: string, branch: string): string {
  return `You are a senior code reviewer. Review all changes on the branch "${branch}" shown in the diff below. Be concise, constructive, and specific. Organize your feedback by file. Call out bugs, security issues, and style problems. If everything looks good, say so.

\`\`\`diff
${diff}
\`\`\``;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Code Review plugin activated");

  ctx.subscriptions.push(
    api.commands.register("code-review.reviewStaged", async () => {
      // Command-triggered review — just notify, the panel handles the actual review
      api.ui.showNotice("Open the Review tab to see results");
    })
  );

  ctx.subscriptions.push(
    api.commands.register("code-review.reviewBranch", async () => {
      api.ui.showNotice("Open the Review tab to see results");
    })
  );
}

export function deactivate(): void {}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function MainPanel({ api }: PanelProps) {
  const [history, setHistory] = useState<ReviewEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ReviewEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    loadHistory(api).then(setHistory);
  }, [api]);

  const runReview = useCallback(
    async (mode: "staged" | "branch") => {
      setRunning(true);
      setError(null);
      setSelectedReview(null);

      try {
        // Get the diff
        let diff: string;
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
          const baseBranch = await detectDefaultBranch(api);
          const mergeBase = await api.process.exec("git", [
            "merge-base",
            "HEAD",
            `origin/${baseBranch}`,
          ]);
          const base = mergeBase.stdout.trim();
          const result = await api.process.exec("git", ["diff", `${base}...HEAD`]);
          diff = result.stdout;
          if (!diff.trim()) {
            setError(
              `No changes found on branch "${branch}" relative to ${baseBranch}.`
            );
            setRunning(false);
            return;
          }
        }

        // Truncate very large diffs to avoid blowing up the agent context
        const maxDiffLength = 50_000;
        const truncated = diff.length > maxDiffLength;
        const trimmedDiff = truncated ? diff.slice(0, maxDiffLength) + "\n\n[... diff truncated ...]" : diff;

        const prompt =
          mode === "staged"
            ? buildStagedPrompt(trimmedDiff)
            : buildBranchPrompt(trimmedDiff, branch);

        // Spawn a quick agent
        const output = await api.agents.runQuick(prompt);

        // Build review entry
        const entry: ReviewEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          mode,
          summary: output.slice(0, 200).split("\n")[0],
          output,
        };

        await saveReview(api, entry);
        const updated = await loadHistory(api);
        setHistory(updated);
        setSelectedReview(entry);

        api.ui.showNotice("Review complete");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Review failed: ${message}`);
        api.logging.error("Review failed", { error: message });
      } finally {
        setRunning(false);
      }
    },
    [api]
  );

  // -- Render ---------------------------------------------------------------

  const styles = {
    container: { padding: 24, fontFamily: "var(--font-family, sans-serif)", height: "100%", overflow: "auto" } as const,
    header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 } as const,
    button: { cursor: "pointer" } as const,
    error: { padding: 12, background: "var(--bg-error, #2a1515)", borderRadius: 6, color: "var(--text-error, #f87171)", marginBottom: 16 } as const,
    output: { whiteSpace: "pre-wrap" as const, fontFamily: "var(--font-mono, monospace)", fontSize: 13, lineHeight: 1.6, padding: 16, background: "var(--bg-secondary, #1a1a1a)", borderRadius: 6, overflow: "auto" } as const,
    historyItem: { padding: "8px 12px", cursor: "pointer", borderRadius: 4, marginBottom: 4, fontSize: 13 } as const,
    meta: { fontSize: 12, color: "var(--text-tertiary, #666)", marginTop: 4 } as const,
  };

  return (
    <div style={styles.container}>
      <h2 style={{ marginTop: 0 }}>Code Review</h2>

      <div style={styles.header}>
        <button
          style={styles.button}
          onClick={() => runReview("staged")}
          disabled={running}
        >
          {running ? "Reviewing…" : "Review Staged Changes"}
        </button>
        <button
          style={styles.button}
          onClick={() => runReview("branch")}
          disabled={running}
        >
          {running ? "Reviewing…" : "Review Branch"}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {selectedReview && !running && (
        <div>
          <div style={styles.meta}>
            {selectedReview.mode === "staged" ? "Staged changes" : "Branch"} review
          </div>
          <div style={{ ...styles.output, marginTop: 8 }}>{selectedReview.output}</div>
        </div>
      )}

      {history.length > 0 && !running && (
        <div style={{ marginTop: 24 }}>
          <h3>History</h3>
          {history.map((entry) => (
            <div
              key={entry.id}
              style={{
                ...styles.historyItem,
                background:
                  selectedReview?.id === entry.id
                    ? "var(--bg-active, #333)"
                    : "transparent",
              }}
              onClick={() => setSelectedReview(entry)}
            >
              <div>{entry.summary || "(no summary)"}</div>
              <div style={styles.meta}>
                {new Date(entry.timestamp).toLocaleString()}
                {" \u00b7 "}
                {entry.mode}
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length === 0 && !running && !selectedReview && (
        <p style={{ color: "var(--text-secondary, #888)" }}>
          No reviews yet. Stage some changes and click "Review Staged Changes" to get started.
        </p>
      )}
    </div>
  );
}
