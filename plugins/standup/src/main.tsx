import type {
  PluginContext,
  PluginAPI,
  PanelProps,
} from "@clubhouse/plugin-types";

import { useTheme } from './use-theme';
import { createStandupState } from './state';
import type { StandupEntry } from './state';

const React = globalThis.React;
const { useState, useEffect, useCallback, useRef } = React;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HISTORY_KEY = "standupHistory";
const MAX_HISTORY = 90;

const DEFAULT_PROMPT =
  "You are a concise standup report generator. Given git activity data, produce a brief daily standup in first person with sections: **Done** (what was accomplished), **Next** (what's planned based on context), **Blockers** (any potential issues). Keep each section to 3-5 bullet points max. Be specific about what changed — reference file names, features, and fixes.";

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

const standupState = createStandupState();

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

export async function loadHistory(api: PluginAPI): Promise<StandupEntry[]> {
  const raw = await api.storage.projectLocal.read(HISTORY_KEY);
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(raw)) return raw as StandupEntry[];
  return [];
}

async function saveHistory(api: PluginAPI, history: StandupEntry[]): Promise<void> {
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await api.storage.projectLocal.write(HISTORY_KEY, history);
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function getMissingDates(history: StandupEntry[], lookbackDays: number): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingDates = new Set(history.map(e => e.date));
  const missing: string[] = [];

  for (let i = 0; i < lookbackDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    // Skip weekends (Sat=6, Sun=0)
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    if (!existingDates.has(ds)) {
      missing.push(ds);
    }
  }

  return missing;
}

// ---------------------------------------------------------------------------
// Git data gathering
// ---------------------------------------------------------------------------

export async function gatherGitData(
  api: PluginAPI,
  projectPath: string,
  sinceDate: string,
  untilDate: string,
): Promise<string> {
  const sections: string[] = [];

  // Commits in date range (all branches)
  try {
    const logResult = await api.process.exec("git", [
      "-C", projectPath,
      "log", "--all",
      `--since=${sinceDate}`,
      `--until=${untilDate}`,
      "--format=%h %an %ad %s",
      "--date=short",
    ]);
    if (logResult.exitCode === 0 && logResult.stdout.trim()) {
      sections.push("## Commits\n" + logResult.stdout.trim());
    }
  } catch { /* git not available */ }

  // Local branches
  try {
    const branchResult = await api.process.exec("git", [
      "-C", projectPath,
      "branch", "-v", "--no-color",
    ]);
    if (branchResult.exitCode === 0 && branchResult.stdout.trim()) {
      sections.push("## Local Branches\n" + branchResult.stdout.trim());
    }
  } catch { /* ignore */ }

  // Files changed in date range (summary)
  try {
    const diffStatResult = await api.process.exec("git", [
      "-C", projectPath,
      "log", "--all",
      `--since=${sinceDate}`,
      `--until=${untilDate}`,
      "--stat", "--format=",
    ]);
    if (diffStatResult.exitCode === 0 && diffStatResult.stdout.trim()) {
      sections.push("## Files Changed\n" + diffStatResult.stdout.trim());
    }
  } catch { /* ignore */ }

  // Merged PRs via gh CLI (best-effort)
  try {
    const prResult = await api.process.exec("gh", [
      "pr", "list",
      "--state", "merged",
      "--author", "@me",
      "--json", "number,title,mergedAt,headRefName",
      "--limit", "20",
    ]);
    if (prResult.exitCode === 0 && prResult.stdout.trim()) {
      const prs = JSON.parse(prResult.stdout);
      const since = new Date(sinceDate);
      const until = new Date(untilDate);
      const filtered = prs.filter((pr: { mergedAt: string }) => {
        const merged = new Date(pr.mergedAt);
        return merged >= since && merged < until;
      });
      if (filtered.length > 0) {
        const lines = filtered.map((pr: { number: number; title: string; headRefName: string }) =>
          `#${pr.number} ${pr.title} (${pr.headRefName})`
        );
        sections.push("## Merged PRs\n" + lines.join("\n"));
      }
    }
  } catch { /* gh CLI not available */ }

  return sections.length > 0
    ? sections.join("\n\n")
    : "No git activity found for this date range.";
}

// ---------------------------------------------------------------------------
// Agent lifecycle helpers
// ---------------------------------------------------------------------------

const AGENT_TIMEOUT_MS = 120_000;

/**
 * Wait for a quick agent to finish and return its summary.
 * Subscribes to onStatusChange, resolves when the agent transitions
 * from 'running' to 'sleeping' (success) or 'error' (failure).
 */
export function waitForAgent(
  api: PluginAPI,
  agentId: string,
): Promise<{ summary: string | null; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      sub.dispose();
      reject(new Error(
        "Agent timed out. The AI agent did not finish within 2 minutes. " +
        "Try again or check Settings to choose a faster model."
      ));
    }, AGENT_TIMEOUT_MS);

    const sub = api.agents.onStatusChange((id, status, prevStatus) => {
      if (id !== agentId) return;

      const isDone =
        (prevStatus === "running" && status === "sleeping") ||
        (prevStatus === "running" && status === "error");

      if (!isDone) return;

      clearTimeout(timeout);
      sub.dispose();

      const completed = api.agents.listCompleted();
      const info = completed.find((c) => c.id === agentId);

      if (status === "error") {
        reject(new Error(
          info?.summary
            ? `Agent error: ${info.summary}`
            : "The AI agent encountered an error while generating the standup. Check your model and orchestrator settings."
        ));
        return;
      }

      resolve({
        summary: info?.summary ?? null,
        exitCode: info?.exitCode ?? 0,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Generate standups
// ---------------------------------------------------------------------------

async function generateStandups(api: PluginAPI): Promise<void> {
  standupState.setGenerating(true);

  try {
    const activeProject = api.projects.getActive();
    if (!activeProject) {
      api.ui.showError("No active project. Open a project to generate standups.");
      return;
    }

    const lookbackDays = (api.settings.get<number>("lookbackDays") ?? 7);
    const history = await loadHistory(api);
    const missing = getMissingDates(history, lookbackDays);

    if (missing.length === 0) {
      api.ui.showNotice("All standups are up to date!");
      return;
    }

    standupState.setGeneratingDates([...missing]);

    const orchestrator = api.settings.get<string>("orchestrator") || undefined;
    const model = api.settings.get<string>("model") || undefined;
    const freeAgentMode = api.settings.get<boolean>("freeAgentMode") ?? false;
    const systemPrompt = api.settings.get<string>("prompt") || DEFAULT_PROMPT;

    // Verify orchestrator availability if one is configured
    if (orchestrator) {
      try {
        const check = await api.agents.checkOrchestratorAvailability(orchestrator);
        if (!check.available) {
          api.ui.showError(
            `Orchestrator "${orchestrator}" is not available${check.error ? `: ${check.error}` : ""}. ` +
            "Check your Standup settings or clear the orchestrator selection."
          );
          return;
        }
      } catch {
        api.logging.warn("Could not verify orchestrator availability, proceeding anyway");
      }
    }

    const newEntries: StandupEntry[] = [];

    for (const dateStr of missing) {
      const nextDay = new Date(dateStr);
      nextDay.setDate(nextDay.getDate() + 1);
      const untilStr = toDateStr(nextDay);

      // Update progress
      standupState.setGeneratingDates(missing.filter(d => !newEntries.some(e => e.date === d)));

      const gitData = await gatherGitData(api, activeProject.path, dateStr, untilStr);

      if (gitData === "No git activity found for this date range.") {
        continue;
      }

      const prompt = `Generate a standup report for ${dateStr}.\n\nProject: ${activeProject.name}\n\n${gitData}`;

      let output: string;
      try {
        const agentId = await api.agents.runQuick(prompt, {
          systemPrompt,
          orchestrator,
          model,
          freeAgentMode,
        });

        const result = await waitForAgent(api, agentId);

        if (!result.summary) {
          api.logging.warn(`Agent produced no summary for ${dateStr}, skipping`);
          continue;
        }

        if (result.exitCode !== 0) {
          api.logging.warn(`Agent exited with code ${result.exitCode} for ${dateStr}`);
        }

        output = result.summary;
      } catch (agentErr: unknown) {
        const agentMsg = agentErr instanceof Error ? agentErr.message : String(agentErr);
        api.logging.error(`Agent failed for ${dateStr}: ${agentMsg}`);
        api.ui.showError(`Failed to generate standup for ${dateStr}: ${agentMsg}`);
        continue;
      }

      const entry: StandupEntry = {
        id: `${dateStr}-${Date.now()}`,
        date: dateStr,
        summary: output.split("\n").find(l => l.trim().length > 0)?.slice(0, 120) ?? dateStr,
        output,
        projectName: activeProject.name,
      };

      newEntries.push(entry);
    }

    if (newEntries.length === 0) {
      api.ui.showNotice("No git activity found for missing dates.");
      return;
    }

    // Merge new entries into history, sorted by date desc
    const merged = [...newEntries, ...history];
    merged.sort((a, b) => b.date.localeCompare(a.date));
    await saveHistory(api, merged);

    const updated = await loadHistory(api);
    standupState.setHistory(updated);
    standupState.setSelectedId(newEntries[0].id);

    api.ui.showNotice(`Generated ${newEntries.length} standup(s)`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    api.ui.showError(`Standup generation failed: ${msg}`);
    api.logging.error(`Standup generation error: ${msg}`);
  } finally {
    standupState.setGenerating(false);
    standupState.setGeneratingDates([]);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Standup plugin activated");

  ctx.subscriptions.push(
    api.commands.register("standup.generate", () => {
      generateStandups(api);
    })
  );
}

export function deactivate(): void {}

// ---------------------------------------------------------------------------
// SidebarPanel — standup history list
// ---------------------------------------------------------------------------

export function SidebarPanel({ api }: PanelProps) {
  const { style: themeStyle } = useTheme(api.theme);
  const [history, setHistory] = useState<StandupEntry[]>(standupState.history);
  const [selectedId, setSelectedId] = useState<string | null>(standupState.selectedId);
  const [generating, setGenerating] = useState(standupState.generating);
  const [generatingDates, setGeneratingDates] = useState<string[]>(standupState.generatingDates);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Load history on mount
    loadHistory(api).then(h => {
      standupState.setHistory(h);
      if (h.length > 0 && !standupState.selectedId) {
        standupState.setSelectedId(h[0].id);
      }
    });

    const unsub = standupState.subscribe(() => {
      if (!mountedRef.current) return;
      setHistory([...standupState.history]);
      setSelectedId(standupState.selectedId);
      setGenerating(standupState.generating);
      setGeneratingDates([...standupState.generatingDates]);
    });
    return () => { mountedRef.current = false; unsub(); };
  }, [api]);

  const handleGenerate = useCallback(() => {
    generateStandups(api);
  }, [api]);

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr + "T12:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const entryDate = new Date(dateStr + "T00:00:00");

    if (entryDate.getTime() === today.getTime()) return "Today";
    if (entryDate.getTime() === yesterday.getTime()) return "Yesterday";

    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <div style={{
      ...themeStyle,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      fontFamily: "var(--font-family, sans-serif)",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 14px",
        borderBottom: "1px solid var(--border-primary, #333)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>Standups</span>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: "var(--bg-accent, #2563eb33)",
            color: "var(--text-accent, #60a5fa)",
            border: "1px solid var(--border-accent, #2563eb55)",
            borderRadius: 4,
            padding: "4px 10px",
            fontSize: 12,
            cursor: generating ? "wait" : "pointer",
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? "Generating..." : "Generate"}
        </button>
      </div>

      {/* Generating progress */}
      {generating && generatingDates.length > 0 && (
        <div style={{
          padding: "8px 14px",
          fontSize: 11,
          color: "var(--text-tertiary, #666)",
          borderBottom: "1px solid var(--border-primary, #333)",
        }}>
          Generating {generatingDates.length} standup(s)...
        </div>
      )}

      {/* History list */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {history.length === 0 && !generating && (
          <div style={{
            padding: "24px 14px",
            textAlign: "center",
            color: "var(--text-tertiary, #666)",
            fontSize: 13,
          }}>
            No standups yet.{"\n"}Click Generate to create one.
          </div>
        )}
        {history.map(entry => (
          <div
            key={entry.id}
            onClick={() => standupState.setSelectedId(entry.id)}
            style={{
              padding: "10px 14px",
              cursor: "pointer",
              borderBottom: "1px solid var(--border-primary, #222)",
              background: selectedId === entry.id
                ? "var(--bg-active, #333)"
                : "transparent",
            }}
          >
            <div style={{
              fontSize: 13,
              fontWeight: selectedId === entry.id ? 600 : 400,
              color: "var(--text-primary)",
            }}>
              {formatDate(entry.date)}
            </div>
            <div style={{
              fontSize: 11,
              color: "var(--text-tertiary, #666)",
              marginTop: 2,
            }}>
              {entry.projectName}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MainPanel — selected standup content
// ---------------------------------------------------------------------------

export function MainPanel({ api }: PanelProps) {
  const { style: themeStyle } = useTheme(api.theme);
  const [selected, setSelected] = useState<StandupEntry | null>(standupState.getSelected());
  const [generating, setGenerating] = useState(standupState.generating);

  useEffect(() => {
    const unsub = standupState.subscribe(() => {
      setSelected(standupState.getSelected());
      setGenerating(standupState.generating);
    });
    return unsub;
  }, []);

  if (generating && !selected) {
    return (
      <div style={{
        ...themeStyle,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-family, sans-serif)",
        color: "var(--text-tertiary, #666)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Generating standup...</div>
          <div style={{ fontSize: 12 }}>Gathering git data and summarizing</div>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div style={{
        ...themeStyle,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-family, sans-serif)",
        color: "var(--text-tertiary, #666)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>No standup selected</div>
          <div style={{ fontSize: 12 }}>Click Generate or select a date from the sidebar</div>
        </div>
      </div>
    );
  }

  const dateDisplay = new Date(selected.date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{
      ...themeStyle,
      height: "100%",
      overflow: "auto",
      fontFamily: "var(--font-family, sans-serif)",
    }}>
      <div style={{ padding: 24, maxWidth: 720 }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}>
            {dateDisplay}
          </h2>
          <div style={{
            fontSize: 12,
            color: "var(--text-tertiary, #666)",
            marginTop: 4,
          }}>
            {selected.projectName}
          </div>
        </div>

        {/* Content */}
        <div style={{
          whiteSpace: "pre-wrap",
          fontFamily: "var(--font-family, sans-serif)",
          fontSize: 14,
          lineHeight: 1.7,
          color: "var(--text-primary)",
        }}>
          {selected.output}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsPanel — orchestrator, model, free agent, prompt, lookback
// ---------------------------------------------------------------------------

export function SettingsPanel({ api }: PanelProps) {
  const { style: themeStyle } = useTheme(api.theme);
  const [orchestrator, setOrchestrator] = useState(api.settings.get<string>("orchestrator") ?? "");
  const [model, setModel] = useState(api.settings.get<string>("model") ?? "");
  const [freeAgent, setFreeAgent] = useState(api.settings.get<boolean>("freeAgentMode") ?? false);
  const [prompt, setPrompt] = useState(api.settings.get<string>("prompt") ?? DEFAULT_PROMPT);
  const [lookback, setLookback] = useState(api.settings.get<number>("lookbackDays") ?? 7);

  // Dynamic options from API
  const [orchestrators, setOrchestrators] = useState<Array<{ id: string; displayName: string }>>([]);
  const [models, setModels] = useState<Array<{ id: string; label: string }>>([]);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const orchs = api.agents.listOrchestrators();
      setOrchestrators(orchs.map(o => ({ id: o.id, displayName: o.displayName })));
      setSettingsError(null);
    } catch (err) {
      api.logging.warn("Could not load orchestrator list: " + (err instanceof Error ? err.message : String(err)));
      setSettingsError("Could not load orchestrators. The agents system may not be ready yet — try reopening settings.");
    }
  }, [api]);

  useEffect(() => {
    api.agents.getModelOptions(undefined, orchestrator || undefined).then(opts => {
      setModels(opts);
    }).catch((err) => {
      api.logging.warn("Could not load model options: " + (err instanceof Error ? err.message : String(err)));
    });
  }, [api, orchestrator]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    fontSize: 13,
    background: "var(--bg-surface, #1a1a1a)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-primary, #333)",
    borderRadius: 4,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text-primary)",
    marginBottom: 4,
  };

  const descStyle: React.CSSProperties = {
    fontSize: 11,
    color: "var(--text-tertiary, #666)",
    marginBottom: 6,
  };

  const groupStyle: React.CSSProperties = { marginBottom: 20 };

  return (
    <div style={{
      ...themeStyle,
      padding: 24,
      fontFamily: "var(--font-family, sans-serif)",
      height: "100%",
      overflow: "auto",
    }}>
      <h2 style={{ margin: "0 0 20px 0", fontSize: 16, color: "var(--text-primary)" }}>
        Standup Settings
      </h2>

      {settingsError && (
        <div style={{
          padding: "10px 14px",
          marginBottom: 20,
          background: "var(--bg-error, rgba(248,113,113,0.1))",
          border: "1px solid var(--border-error, rgba(248,113,113,0.3))",
          borderRadius: 6,
          color: "var(--text-error, #f87171)",
          fontSize: 12,
          lineHeight: 1.5,
        }}>
          {settingsError}
        </div>
      )}

      <div style={groupStyle}>
        <label style={labelStyle}>Orchestrator</label>
        <div style={descStyle}>Agent orchestrator to use (leave empty for default)</div>
        <select
          value={orchestrator}
          onChange={e => {
            setOrchestrator(e.target.value);
            api.settings.set("orchestrator", e.target.value || undefined);
          }}
          style={inputStyle}
        >
          <option value="">Default</option>
          {orchestrators.map(o => (
            <option key={o.id} value={o.id}>{o.displayName}</option>
          ))}
        </select>
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>Model</label>
        <div style={descStyle}>Model for the quick agent (leave empty for default)</div>
        <select
          value={model}
          onChange={e => {
            setModel(e.target.value);
            api.settings.set("model", e.target.value || undefined);
          }}
          style={inputStyle}
        >
          <option value="">Default</option>
          {models.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div style={groupStyle}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={freeAgent}
            onChange={e => {
              setFreeAgent(e.target.checked);
              api.settings.set("freeAgentMode", e.target.checked);
            }}
          />
          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>Free Agent Mode</span>
        </label>
        <div style={{ ...descStyle, marginTop: 4 }}>Allow the agent to use tools and run commands</div>
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>Lookback Days</label>
        <div style={descStyle}>Max days to backfill when generating standups for missed days</div>
        <input
          type="number"
          min={1}
          max={30}
          value={lookback}
          onChange={e => {
            const val = parseInt(e.target.value, 10);
            if (val > 0 && val <= 30) {
              setLookback(val);
              api.settings.set("lookbackDays", val);
            }
          }}
          style={{ ...inputStyle, width: 80 }}
        />
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>System Prompt</label>
        <div style={descStyle}>Custom instructions for the standup agent</div>
        <textarea
          value={prompt}
          onChange={e => {
            setPrompt(e.target.value);
            api.settings.set("prompt", e.target.value);
          }}
          rows={6}
          style={{
            ...inputStyle,
            resize: "vertical",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={() => {
            setPrompt(DEFAULT_PROMPT);
            api.settings.set("prompt", DEFAULT_PROMPT);
          }}
          style={{
            marginTop: 6,
            background: "transparent",
            color: "var(--text-tertiary, #666)",
            border: "1px solid var(--border-primary, #333)",
            borderRadius: 4,
            padding: "4px 10px",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}
