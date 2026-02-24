// src/use-theme.ts
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function mapThemeToCSS(theme) {
  const c = theme.colors;
  const onAccent = theme.type === "dark" ? "#ffffff" : "#000000";
  return {
    // Text
    "--text-primary": c.text,
    "--text-secondary": c.subtext1,
    "--text-tertiary": c.subtext0,
    "--text-muted": c.surface2,
    "--text-error": c.error,
    "--text-success": c.success,
    "--text-warning": c.warning,
    "--text-info": c.info,
    "--text-accent": c.accent,
    "--text-on-badge": onAccent,
    "--text-on-accent": onAccent,
    // Backgrounds
    "--bg-primary": c.base,
    "--bg-secondary": c.mantle,
    "--bg-tertiary": c.crust,
    "--bg-surface": c.surface0,
    "--bg-surface-hover": c.surface1,
    "--bg-surface-raised": c.surface2,
    "--bg-active": c.surface1,
    "--bg-error": hexToRgba(c.error, 0.1),
    "--bg-error-subtle": hexToRgba(c.error, 0.05),
    "--bg-success": hexToRgba(c.success, 0.15),
    "--bg-warning": hexToRgba(c.warning, 0.15),
    "--bg-info": hexToRgba(c.info, 0.1),
    "--bg-accent": hexToRgba(c.accent, 0.15),
    "--bg-overlay": "rgba(0, 0, 0, 0.5)",
    // Borders
    "--border-primary": c.surface0,
    "--border-secondary": c.surface1,
    "--border-error": hexToRgba(c.error, 0.3),
    "--border-info": hexToRgba(c.info, 0.3),
    "--border-accent": hexToRgba(c.accent, 0.3),
    // Shadows & overlays
    "--shadow": "rgba(0, 0, 0, 0.3)",
    "--shadow-light": "rgba(0, 0, 0, 0.15)",
    "--shadow-heavy": "rgba(0, 0, 0, 0.5)",
    "--shadow-menu": "rgba(0, 0, 0, 0.3)",
    "--shadow-color": "rgba(0, 0, 0, 0.5)",
    "--overlay": "rgba(0, 0, 0, 0.5)",
    "--glow-error": hexToRgba(c.error, 0.3),
    "--glow-accent": hexToRgba(c.accent, 0.3),
    // Fonts
    "--font-family": "system-ui, -apple-system, sans-serif",
    "--font-mono": "ui-monospace, monospace",
    // Color aliases (file icons, labels, etc.)
    "--color-blue": c.info,
    "--color-green": c.success,
    "--color-yellow": c.warning,
    "--color-orange": c.warning,
    "--color-red": c.error,
    "--color-purple": c.accent,
    "--color-cyan": c.info
  };
}
function useTheme(themeApi) {
  const React2 = globalThis.React;
  const [theme, setTheme] = React2.useState(() => themeApi.getCurrent());
  React2.useEffect(() => {
    setTheme(themeApi.getCurrent());
    const disposable = themeApi.onDidChange((t) => setTheme(t));
    return () => disposable.dispose();
  }, [themeApi]);
  const style = React2.useMemo(
    () => mapThemeToCSS(theme),
    [theme]
  );
  return { style, themeType: theme.type };
}

// src/state.ts
function createStandupState() {
  const state = {
    history: [],
    selectedId: null,
    generating: false,
    generatingDates: [],
    listeners: /* @__PURE__ */ new Set(),
    setHistory(entries) {
      state.history = entries;
      state.notify();
    },
    setSelectedId(id) {
      state.selectedId = id;
      state.notify();
    },
    setGenerating(val) {
      state.generating = val;
      state.notify();
    },
    setGeneratingDates(dates) {
      state.generatingDates = dates;
      state.notify();
    },
    getSelected() {
      if (!state.selectedId) return null;
      return state.history.find((e) => e.id === state.selectedId) ?? null;
    },
    subscribe(fn) {
      state.listeners.add(fn);
      return () => {
        state.listeners.delete(fn);
      };
    },
    notify() {
      for (const fn of state.listeners) fn();
    }
  };
  return state;
}

// src/main.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var React = globalThis.React;
var { useState, useEffect, useCallback, useRef } = React;
var HISTORY_KEY = "standupHistory";
var MAX_HISTORY = 90;
var DEFAULT_PROMPT = "You are a concise standup report generator. Given git activity data, produce a brief daily standup in first person with sections: **Done** (what was accomplished), **Next** (what's planned based on context), **Blockers** (any potential issues). Keep each section to 3-5 bullet points max. Be specific about what changed \u2014 reference file names, features, and fixes.";
var standupState = createStandupState();
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
async function saveHistory(api, history) {
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await api.storage.global.write(HISTORY_KEY, history);
}
function toDateStr(d) {
  return d.toISOString().split("T")[0];
}
function getMissingDates(history, lookbackDays) {
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const existingDates = new Set(history.map((e) => e.date));
  const missing = [];
  for (let i = 0; i < lookbackDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    if (!existingDates.has(ds)) {
      missing.push(ds);
    }
  }
  return missing;
}
async function gatherGitData(api, projectPath, sinceDate, untilDate) {
  const sections = [];
  try {
    const logResult = await api.process.exec("git", [
      "-C",
      projectPath,
      "log",
      "--all",
      `--since=${sinceDate}`,
      `--until=${untilDate}`,
      "--format=%h %an %ad %s",
      "--date=short"
    ]);
    if (logResult.exitCode === 0 && logResult.stdout.trim()) {
      sections.push("## Commits\n" + logResult.stdout.trim());
    }
  } catch {
  }
  try {
    const branchResult = await api.process.exec("git", [
      "-C",
      projectPath,
      "branch",
      "-v",
      "--no-color"
    ]);
    if (branchResult.exitCode === 0 && branchResult.stdout.trim()) {
      sections.push("## Local Branches\n" + branchResult.stdout.trim());
    }
  } catch {
  }
  try {
    const diffStatResult = await api.process.exec("git", [
      "-C",
      projectPath,
      "log",
      "--all",
      `--since=${sinceDate}`,
      `--until=${untilDate}`,
      "--stat",
      "--format="
    ]);
    if (diffStatResult.exitCode === 0 && diffStatResult.stdout.trim()) {
      sections.push("## Files Changed\n" + diffStatResult.stdout.trim());
    }
  } catch {
  }
  try {
    const prResult = await api.process.exec("gh", [
      "pr",
      "list",
      "--state",
      "merged",
      "--author",
      "@me",
      "--json",
      "number,title,mergedAt,headRefName",
      "--limit",
      "20"
    ]);
    if (prResult.exitCode === 0 && prResult.stdout.trim()) {
      const prs = JSON.parse(prResult.stdout);
      const since = new Date(sinceDate);
      const until = new Date(untilDate);
      const filtered = prs.filter((pr) => {
        const merged = new Date(pr.mergedAt);
        return merged >= since && merged < until;
      });
      if (filtered.length > 0) {
        const lines = filtered.map(
          (pr) => `#${pr.number} ${pr.title} (${pr.headRefName})`
        );
        sections.push("## Merged PRs\n" + lines.join("\n"));
      }
    }
  } catch {
  }
  return sections.length > 0 ? sections.join("\n\n") : "No git activity found for this date range.";
}
async function generateStandups(api) {
  standupState.setGenerating(true);
  try {
    const activeProject = api.projects.getActive();
    if (!activeProject) {
      api.ui.showError("No active project. Open a project first.");
      return;
    }
    const lookbackDays = api.settings.get("lookbackDays") ?? 7;
    const history = await loadHistory(api);
    const missing = getMissingDates(history, lookbackDays);
    if (missing.length === 0) {
      api.ui.showNotice("All standups are up to date!");
      return;
    }
    standupState.setGeneratingDates([...missing]);
    const orchestrator = api.settings.get("orchestrator") || void 0;
    const model = api.settings.get("model") || void 0;
    const freeAgentMode = api.settings.get("freeAgentMode") ?? false;
    const systemPrompt = api.settings.get("prompt") || DEFAULT_PROMPT;
    const newEntries = [];
    for (const dateStr of missing) {
      const nextDay = new Date(dateStr);
      nextDay.setDate(nextDay.getDate() + 1);
      const untilStr = toDateStr(nextDay);
      standupState.setGeneratingDates(missing.filter((d) => !newEntries.some((e) => e.date === d)));
      const gitData = await gatherGitData(api, activeProject.path, dateStr, untilStr);
      if (gitData === "No git activity found for this date range.") {
        continue;
      }
      const prompt = `Generate a standup report for ${dateStr}.

Project: ${activeProject.name}

${gitData}`;
      const output = await api.agents.runQuick(prompt, {
        systemPrompt,
        orchestrator,
        model,
        freeAgentMode
      });
      const entry = {
        id: `${dateStr}-${Date.now()}`,
        date: dateStr,
        summary: output.split("\n").find((l) => l.trim().length > 0)?.slice(0, 120) ?? dateStr,
        output,
        projectName: activeProject.name
      };
      newEntries.push(entry);
    }
    if (newEntries.length === 0) {
      api.ui.showNotice("No git activity found for missing dates.");
      return;
    }
    const merged = [...newEntries, ...history];
    merged.sort((a, b) => b.date.localeCompare(a.date));
    await saveHistory(api, merged);
    const updated = await loadHistory(api);
    standupState.setHistory(updated);
    standupState.setSelectedId(newEntries[0].id);
    api.ui.showNotice(`Generated ${newEntries.length} standup(s)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    api.ui.showError(`Standup failed: ${msg}`);
  } finally {
    standupState.setGenerating(false);
    standupState.setGeneratingDates([]);
  }
}
function activate(ctx, api) {
  api.logging.info("Standup plugin activated");
  ctx.subscriptions.push(
    api.commands.register("standup.generate", () => {
      generateStandups(api);
    })
  );
}
function deactivate() {
}
function SidebarPanel({ api }) {
  const { style: themeStyle } = useTheme(api.theme);
  const [history, setHistory] = useState(standupState.history);
  const [selectedId, setSelectedId] = useState(standupState.selectedId);
  const [generating, setGenerating] = useState(standupState.generating);
  const [generatingDates, setGeneratingDates] = useState(standupState.generatingDates);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    loadHistory(api).then((h) => {
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
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [api]);
  const handleGenerate = useCallback(() => {
    generateStandups(api);
  }, [api]);
  const formatDate = (dateStr) => {
    const d = /* @__PURE__ */ new Date(dateStr + "T12:00:00");
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const entryDate = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
    if (entryDate.getTime() === today.getTime()) return "Today";
    if (entryDate.getTime() === yesterday.getTime()) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };
  return /* @__PURE__ */ jsxs("div", { style: {
    ...themeStyle,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    fontFamily: "var(--font-family, sans-serif)"
  }, children: [
    /* @__PURE__ */ jsxs("div", { style: {
      padding: "12px 14px",
      borderBottom: "1px solid var(--border-primary, #333)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexShrink: 0
    }, children: [
      /* @__PURE__ */ jsx("span", { style: { fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }, children: "Standups" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleGenerate,
          disabled: generating,
          style: {
            background: "var(--bg-accent, #2563eb33)",
            color: "var(--text-accent, #60a5fa)",
            border: "1px solid var(--border-accent, #2563eb55)",
            borderRadius: 4,
            padding: "4px 10px",
            fontSize: 12,
            cursor: generating ? "wait" : "pointer",
            opacity: generating ? 0.6 : 1
          },
          children: generating ? "Generating..." : "Generate"
        }
      )
    ] }),
    generating && generatingDates.length > 0 && /* @__PURE__ */ jsxs("div", { style: {
      padding: "8px 14px",
      fontSize: 11,
      color: "var(--text-tertiary, #666)",
      borderBottom: "1px solid var(--border-primary, #333)"
    }, children: [
      "Generating ",
      generatingDates.length,
      " standup(s)..."
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, overflow: "auto" }, children: [
      history.length === 0 && !generating && /* @__PURE__ */ jsxs("div", { style: {
        padding: "24px 14px",
        textAlign: "center",
        color: "var(--text-tertiary, #666)",
        fontSize: 13
      }, children: [
        "No standups yet.",
        "\n",
        "Click Generate to create one."
      ] }),
      history.map((entry) => /* @__PURE__ */ jsxs(
        "div",
        {
          onClick: () => standupState.setSelectedId(entry.id),
          style: {
            padding: "10px 14px",
            cursor: "pointer",
            borderBottom: "1px solid var(--border-primary, #222)",
            background: selectedId === entry.id ? "var(--bg-active, #333)" : "transparent"
          },
          children: [
            /* @__PURE__ */ jsx("div", { style: {
              fontSize: 13,
              fontWeight: selectedId === entry.id ? 600 : 400,
              color: "var(--text-primary)"
            }, children: formatDate(entry.date) }),
            /* @__PURE__ */ jsx("div", { style: {
              fontSize: 11,
              color: "var(--text-tertiary, #666)",
              marginTop: 2
            }, children: entry.projectName })
          ]
        },
        entry.id
      ))
    ] })
  ] });
}
function MainPanel({ api }) {
  const { style: themeStyle } = useTheme(api.theme);
  const [selected, setSelected] = useState(standupState.getSelected());
  const [generating, setGenerating] = useState(standupState.generating);
  useEffect(() => {
    const unsub = standupState.subscribe(() => {
      setSelected(standupState.getSelected());
      setGenerating(standupState.generating);
    });
    return unsub;
  }, []);
  if (generating && !selected) {
    return /* @__PURE__ */ jsx("div", { style: {
      ...themeStyle,
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-family, sans-serif)",
      color: "var(--text-tertiary, #666)"
    }, children: /* @__PURE__ */ jsxs("div", { style: { textAlign: "center" }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 14, marginBottom: 8 }, children: "Generating standup..." }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12 }, children: "Gathering git data and summarizing" })
    ] }) });
  }
  if (!selected) {
    return /* @__PURE__ */ jsx("div", { style: {
      ...themeStyle,
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-family, sans-serif)",
      color: "var(--text-tertiary, #666)"
    }, children: /* @__PURE__ */ jsxs("div", { style: { textAlign: "center" }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 14, marginBottom: 8 }, children: "No standup selected" }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12 }, children: "Click Generate or select a date from the sidebar" })
    ] }) });
  }
  const dateDisplay = (/* @__PURE__ */ new Date(selected.date + "T12:00:00")).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  return /* @__PURE__ */ jsx("div", { style: {
    ...themeStyle,
    height: "100%",
    overflow: "auto",
    fontFamily: "var(--font-family, sans-serif)"
  }, children: /* @__PURE__ */ jsxs("div", { style: { padding: 24, maxWidth: 720 }, children: [
    /* @__PURE__ */ jsxs("div", { style: { marginBottom: 20 }, children: [
      /* @__PURE__ */ jsx("h2", { style: {
        margin: 0,
        fontSize: 18,
        fontWeight: 600,
        color: "var(--text-primary)"
      }, children: dateDisplay }),
      /* @__PURE__ */ jsx("div", { style: {
        fontSize: 12,
        color: "var(--text-tertiary, #666)",
        marginTop: 4
      }, children: selected.projectName })
    ] }),
    /* @__PURE__ */ jsx("div", { style: {
      whiteSpace: "pre-wrap",
      fontFamily: "var(--font-family, sans-serif)",
      fontSize: 14,
      lineHeight: 1.7,
      color: "var(--text-primary)"
    }, children: selected.output })
  ] }) });
}
function SettingsPanel({ api }) {
  const { style: themeStyle } = useTheme(api.theme);
  const [orchestrator, setOrchestrator] = useState(api.settings.get("orchestrator") ?? "");
  const [model, setModel] = useState(api.settings.get("model") ?? "");
  const [freeAgent, setFreeAgent] = useState(api.settings.get("freeAgentMode") ?? false);
  const [prompt, setPrompt] = useState(api.settings.get("prompt") ?? DEFAULT_PROMPT);
  const [lookback, setLookback] = useState(api.settings.get("lookbackDays") ?? 7);
  const [orchestrators, setOrchestrators] = useState([]);
  const [models, setModels] = useState([]);
  useEffect(() => {
    try {
      const orchs = api.agents.listOrchestrators();
      setOrchestrators(orchs.map((o) => ({ id: o.id, displayName: o.displayName })));
    } catch {
    }
  }, [api]);
  useEffect(() => {
    api.agents.getModelOptions(void 0, orchestrator || void 0).then((opts) => {
      setModels(opts);
    }).catch(() => {
    });
  }, [api, orchestrator]);
  const inputStyle = {
    width: "100%",
    padding: "6px 10px",
    fontSize: 13,
    background: "var(--bg-surface, #1a1a1a)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-primary, #333)",
    borderRadius: 4,
    outline: "none",
    boxSizing: "border-box"
  };
  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text-primary)",
    marginBottom: 4
  };
  const descStyle = {
    fontSize: 11,
    color: "var(--text-tertiary, #666)",
    marginBottom: 6
  };
  const groupStyle = { marginBottom: 20 };
  return /* @__PURE__ */ jsxs("div", { style: {
    ...themeStyle,
    padding: 24,
    fontFamily: "var(--font-family, sans-serif)",
    height: "100%",
    overflow: "auto"
  }, children: [
    /* @__PURE__ */ jsx("h2", { style: { margin: "0 0 20px 0", fontSize: 16, color: "var(--text-primary)" }, children: "Standup Settings" }),
    /* @__PURE__ */ jsxs("div", { style: groupStyle, children: [
      /* @__PURE__ */ jsx("label", { style: labelStyle, children: "Orchestrator" }),
      /* @__PURE__ */ jsx("div", { style: descStyle, children: "Agent orchestrator to use (leave empty for default)" }),
      /* @__PURE__ */ jsxs(
        "select",
        {
          value: orchestrator,
          onChange: (e) => {
            setOrchestrator(e.target.value);
            api.settings.set("orchestrator", e.target.value || void 0);
          },
          style: inputStyle,
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Default" }),
            orchestrators.map((o) => /* @__PURE__ */ jsx("option", { value: o.id, children: o.displayName }, o.id))
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { style: groupStyle, children: [
      /* @__PURE__ */ jsx("label", { style: labelStyle, children: "Model" }),
      /* @__PURE__ */ jsx("div", { style: descStyle, children: "Model for the quick agent (leave empty for default)" }),
      /* @__PURE__ */ jsxs(
        "select",
        {
          value: model,
          onChange: (e) => {
            setModel(e.target.value);
            api.settings.set("model", e.target.value || void 0);
          },
          style: inputStyle,
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Default" }),
            models.map((m) => /* @__PURE__ */ jsx("option", { value: m.id, children: m.label }, m.id))
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { style: groupStyle, children: [
      /* @__PURE__ */ jsxs("label", { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }, children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: freeAgent,
            onChange: (e) => {
              setFreeAgent(e.target.checked);
              api.settings.set("freeAgentMode", e.target.checked);
            }
          }
        ),
        /* @__PURE__ */ jsx("span", { style: { fontSize: 13, color: "var(--text-primary)" }, children: "Free Agent Mode" })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { ...descStyle, marginTop: 4 }, children: "Allow the agent to use tools and run commands" })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: groupStyle, children: [
      /* @__PURE__ */ jsx("label", { style: labelStyle, children: "Lookback Days" }),
      /* @__PURE__ */ jsx("div", { style: descStyle, children: "Max days to backfill when generating standups for missed days" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "number",
          min: 1,
          max: 30,
          value: lookback,
          onChange: (e) => {
            const val = parseInt(e.target.value, 10);
            if (val > 0 && val <= 30) {
              setLookback(val);
              api.settings.set("lookbackDays", val);
            }
          },
          style: { ...inputStyle, width: 80 }
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { style: groupStyle, children: [
      /* @__PURE__ */ jsx("label", { style: labelStyle, children: "System Prompt" }),
      /* @__PURE__ */ jsx("div", { style: descStyle, children: "Custom instructions for the standup agent" }),
      /* @__PURE__ */ jsx(
        "textarea",
        {
          value: prompt,
          onChange: (e) => {
            setPrompt(e.target.value);
            api.settings.set("prompt", e.target.value);
          },
          rows: 6,
          style: {
            ...inputStyle,
            resize: "vertical",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
            lineHeight: 1.5
          }
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => {
            setPrompt(DEFAULT_PROMPT);
            api.settings.set("prompt", DEFAULT_PROMPT);
          },
          style: {
            marginTop: 6,
            background: "transparent",
            color: "var(--text-tertiary, #666)",
            border: "1px solid var(--border-primary, #333)",
            borderRadius: 4,
            padding: "4px 10px",
            fontSize: 11,
            cursor: "pointer"
          },
          children: "Reset to default"
        }
      )
    ] })
  ] });
}
export {
  MainPanel,
  SettingsPanel,
  SidebarPanel,
  activate,
  deactivate,
  gatherGitData,
  getMissingDates,
  loadHistory,
  toDateStr
};
