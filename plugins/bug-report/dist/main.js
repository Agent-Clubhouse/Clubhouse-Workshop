// src/helpers.ts
var SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
var REPORT_TYPES = ["bug", "enhancement"];
var REPO = "Agent-Clubhouse/Clubhouse";
function severityColor(severity) {
  switch (severity) {
    case "CRITICAL":
      return "var(--red, #e5534b)";
    case "HIGH":
      return "var(--orange, #d29922)";
    case "MEDIUM":
      return "var(--yellow, #c69026)";
    case "LOW":
      return "var(--green, #57ab5a)";
  }
}
function typeColor(type) {
  switch (type) {
    case "bug":
      return "#d73a4a";
    case "enhancement":
      return "#a2eeef";
  }
}
function formatTitle(severity, title) {
  return `[${severity}] ${title}`;
}
function parseSeverityFromTitle(title) {
  const match = title.match(/^\[(LOW|MEDIUM|HIGH|CRITICAL)\]\s*(.*)/);
  if (match) {
    return { severity: match[1], cleanTitle: match[2] };
  }
  return { severity: null, cleanTitle: title };
}
function relativeTime(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 6e4);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  const diffMo = Math.floor(diffD / 30);
  return `${diffMo}mo ago`;
}
function labelColor(hex) {
  if (!hex) return "var(--text-tertiary, #888888)";
  return hex.startsWith("#") ? hex : `#${hex}`;
}
function labelColorAlpha(hex, alpha) {
  if (!hex) return `#888888${alpha}`;
  const color = hex.startsWith("#") ? hex : `#${hex}`;
  return `${color}${alpha}`;
}
function filterIssues(issues, query) {
  if (!query.trim()) return issues;
  const q = query.toLowerCase();
  return issues.filter(
    (i) => i.title.toLowerCase().includes(q) || `#${i.number}`.includes(q) || i.labels.some((l) => l.name.toLowerCase().includes(q))
  );
}
function isSafeUrl(url) {
  return /^https?:\/\//i.test(url);
}

// src/state.ts
function createBugReportState() {
  const state = {
    ghUsername: null,
    ghAuthed: null,
    selectedIssueNumber: null,
    creatingNew: false,
    issues: [],
    myIssues: [],
    page: 1,
    hasMore: false,
    loading: false,
    needsRefresh: false,
    viewMode: "my-reports",
    searchQuery: "",
    listeners: /* @__PURE__ */ new Set(),
    setGhUsername(username) {
      state.ghUsername = username;
      state.notify();
    },
    setGhAuthed(authed) {
      state.ghAuthed = authed;
      state.notify();
    },
    setSelectedIssue(num) {
      state.selectedIssueNumber = num;
      state.creatingNew = false;
      state.notify();
    },
    setCreatingNew(val) {
      state.creatingNew = val;
      if (val) state.selectedIssueNumber = null;
      state.notify();
    },
    setIssues(issues) {
      state.issues = issues;
      state.notify();
    },
    setMyIssues(issues) {
      state.myIssues = issues;
      state.notify();
    },
    appendIssues(issues) {
      state.issues = [...state.issues, ...issues];
      state.notify();
    },
    setLoading(loading) {
      state.loading = loading;
      state.notify();
    },
    setViewMode(mode) {
      state.viewMode = mode;
      state.page = 1;
      state.requestRefresh();
    },
    setSearchQuery(query) {
      state.searchQuery = query;
      state.notify();
    },
    requestRefresh() {
      state.needsRefresh = true;
      state.notify();
    },
    subscribe(fn) {
      state.listeners.add(fn);
      return () => {
        state.listeners.delete(fn);
      };
    },
    notify() {
      for (const fn of state.listeners) fn();
    },
    reset() {
      state.ghUsername = null;
      state.ghAuthed = null;
      state.selectedIssueNumber = null;
      state.creatingNew = false;
      state.issues = [];
      state.myIssues = [];
      state.page = 1;
      state.hasMore = false;
      state.loading = false;
      state.needsRefresh = false;
      state.viewMode = "my-reports";
      state.searchQuery = "";
      state.listeners.clear();
    }
  };
  return state;
}

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

// src/main.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var React = globalThis.React;
var { useState, useEffect, useCallback, useRef, useMemo } = React;
var reportState = createBugReportState();
function renderInline(text) {
  const nodes = [];
  const inlineRe = /!\[([^\]]*)\]\(([^)]+)\)|(\[([^\]]+)\]\(([^)]+)\))|(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)|(~~[^~]+~~)/g;
  let last = 0;
  let match;
  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const m = match[0];
    if (m.startsWith("![")) {
      const alt = match[1];
      const src = match[2];
      if (isSafeUrl(src)) {
        nodes.push(
          /* @__PURE__ */ jsx("img", { src, alt, style: { maxWidth: "100%", borderRadius: "4px", margin: "4px 0" } }, match.index)
        );
      } else {
        nodes.push(
          /* @__PURE__ */ jsx("span", { style: { color: "var(--text-secondary, #a1a1aa)", fontSize: "12px" }, children: "[image blocked: unsafe URL]" }, match.index)
        );
      }
    } else if (m.startsWith("[")) {
      const linkText = match[4];
      const href = match[5];
      if (isSafeUrl(href)) {
        nodes.push(
          /* @__PURE__ */ jsx(
            "a",
            {
              href,
              target: "_blank",
              rel: "noopener noreferrer",
              style: { color: "var(--text-accent, #8b5cf6)", textDecoration: "underline" },
              children: linkText
            },
            match.index
          )
        );
      } else {
        nodes.push(/* @__PURE__ */ jsx("span", { children: linkText }, match.index));
      }
    } else if (m.startsWith("`")) {
      nodes.push(
        /* @__PURE__ */ jsx(
          "code",
          {
            style: {
              background: "var(--bg-secondary, #27272a)",
              padding: "1px 5px",
              borderRadius: "3px",
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              fontSize: "0.9em"
            },
            children: m.slice(1, -1)
          },
          match.index
        )
      );
    } else if (m.startsWith("**") || m.startsWith("__")) {
      nodes.push(/* @__PURE__ */ jsx("strong", { children: renderInline(m.slice(2, -2)) }, match.index));
    } else if (m.startsWith("~~")) {
      nodes.push(/* @__PURE__ */ jsx("del", { children: renderInline(m.slice(2, -2)) }, match.index));
    } else if (m.startsWith("*") || m.startsWith("_")) {
      nodes.push(/* @__PURE__ */ jsx("em", { children: renderInline(m.slice(1, -1)) }, match.index));
    }
    last = match.index + m.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
function Markdown({ source }) {
  const elements = useMemo(() => {
    const lines = source.split("\n");
    const result = [];
    let i = 0;
    const codeBlockStyle = {
      background: "var(--bg-secondary, #27272a)",
      border: "1px solid var(--border-primary, #3f3f46)",
      borderRadius: "6px",
      padding: "10px 12px",
      overflowX: "auto",
      fontFamily: "var(--font-mono, ui-monospace, monospace)",
      fontSize: "12px",
      lineHeight: 1.5,
      margin: "8px 0",
      whiteSpace: "pre",
      color: "var(--text-primary, #e4e4e7)"
    };
    const blockquoteStyle = {
      borderLeft: "3px solid var(--border-primary, #3f3f46)",
      paddingLeft: "12px",
      margin: "8px 0",
      color: "var(--text-secondary, #a1a1aa)"
    };
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("```")) {
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        result.push(
          /* @__PURE__ */ jsx("pre", { style: codeBlockStyle, children: /* @__PURE__ */ jsx("code", { children: codeLines.join("\n") }) }, result.length)
        );
        continue;
      }
      if (!line.trim()) {
        i++;
        continue;
      }
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const sizes = { 1: "1.5em", 2: "1.3em", 3: "1.15em", 4: "1em", 5: "0.95em", 6: "0.9em" };
        result.push(
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                fontSize: sizes[level] || "1em",
                fontWeight: 600,
                margin: "12px 0 6px",
                color: "var(--text-primary, #e4e4e7)",
                borderBottom: level <= 2 ? "1px solid var(--border-primary, #3f3f46)" : void 0,
                paddingBottom: level <= 2 ? "4px" : void 0
              },
              children: renderInline(headingMatch[2])
            },
            result.length
          )
        );
        i++;
        continue;
      }
      if (/^[-*_]{3,}\s*$/.test(line)) {
        result.push(
          /* @__PURE__ */ jsx("hr", { style: { border: "none", borderTop: "1px solid var(--border-primary, #3f3f46)", margin: "12px 0" } }, result.length)
        );
        i++;
        continue;
      }
      if (line.startsWith("> ") || line === ">") {
        const quoteLines = [];
        while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) {
          quoteLines.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        result.push(
          /* @__PURE__ */ jsx("blockquote", { style: blockquoteStyle, children: /* @__PURE__ */ jsx(Markdown, { source: quoteLines.join("\n") }) }, result.length)
        );
        continue;
      }
      if (/^\s*[-*+]\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
          i++;
        }
        result.push(
          /* @__PURE__ */ jsx("ul", { style: { margin: "6px 0", paddingLeft: "20px" }, children: items.map((item, idx) => /* @__PURE__ */ jsx("li", { style: { marginBottom: "2px" }, children: renderInline(item) }, idx)) }, result.length)
        );
        continue;
      }
      if (/^\s*\d+[.)]\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
          i++;
        }
        result.push(
          /* @__PURE__ */ jsx("ol", { style: { margin: "6px 0", paddingLeft: "20px" }, children: items.map((item, idx) => /* @__PURE__ */ jsx("li", { style: { marginBottom: "2px" }, children: renderInline(item) }, idx)) }, result.length)
        );
        continue;
      }
      if (/^\s*[-*]\s\[[ x]\]/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s\[[ x]\]/.test(lines[i])) {
          const checked = lines[i].includes("[x]");
          const text = lines[i].replace(/^\s*[-*]\s\[[ x]\]\s*/, "");
          items.push({ checked, text });
          i++;
        }
        result.push(
          /* @__PURE__ */ jsx("ul", { style: { margin: "6px 0", paddingLeft: "20px", listStyle: "none" }, children: items.map((item, idx) => /* @__PURE__ */ jsxs("li", { style: { marginBottom: "2px" }, children: [
            /* @__PURE__ */ jsx("input", { type: "checkbox", checked: item.checked, readOnly: true, style: { marginRight: "6px" } }),
            renderInline(item.text)
          ] }, idx)) }, result.length)
        );
        continue;
      }
      const paraLines = [];
      while (i < lines.length && lines[i].trim() && !lines[i].startsWith("```") && !lines[i].match(/^#{1,6}\s/) && !/^[-*_]{3,}\s*$/.test(lines[i]) && !lines[i].startsWith("> ") && lines[i] !== ">" && !/^\s*[-*+]\s/.test(lines[i]) && !/^\s*\d+[.)]\s/.test(lines[i])) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length > 0) {
        result.push(
          /* @__PURE__ */ jsx("p", { style: { margin: "6px 0", lineHeight: 1.6 }, children: renderInline(paraLines.join("\n")) }, result.length)
        );
      }
    }
    return result;
  }, [source]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        fontSize: "13px",
        color: "var(--text-primary, #e4e4e7)",
        fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
        wordWrap: "break-word",
        overflowWrap: "break-word"
      },
      children: elements
    }
  );
}
async function checkGhAuth(api) {
  try {
    const r = await api.process.exec("gh", ["auth", "status"]);
    const output = r.stdout + r.stderr;
    if (output.includes("Logged in")) {
      const userResult = await api.process.exec("gh", ["api", "user", "-q", ".login"]);
      return userResult.stdout.trim() || null;
    }
    return null;
  } catch {
    return null;
  }
}
var ISSUE_FIELDS = "number,title,state,url,createdAt,updatedAt,author,labels";
var PER_PAGE = 30;
async function fetchIssues(api, page, author) {
  const args = [
    "issue",
    "list",
    "--repo",
    REPO,
    "--json",
    ISSUE_FIELDS,
    "--limit",
    String(PER_PAGE + 1),
    "--state",
    "all",
    "--sort",
    "created",
    "--order",
    "desc"
  ];
  if (author) {
    args.push("--author", author);
  }
  if (page > 1) {
    args[args.indexOf(String(PER_PAGE + 1))] = String(PER_PAGE * page + 1);
  }
  const r = await api.process.exec("gh", args);
  let items = JSON.parse(r.stdout);
  if (page > 1) {
    items = items.slice(PER_PAGE * (page - 1));
  }
  const hasMore = items.length > PER_PAGE;
  if (hasMore) items = items.slice(0, PER_PAGE);
  return { items, hasMore };
}
async function fetchIssueDetail(api, num) {
  const r = await api.process.exec("gh", [
    "issue",
    "view",
    String(num),
    "--repo",
    REPO,
    "--json",
    "number,title,state,url,createdAt,updatedAt,author,labels,body,comments,assignees"
  ]);
  return JSON.parse(r.stdout);
}
async function createIssue(api, title, body, label, severity) {
  const fullTitle = formatTitle(severity, title);
  const r = await api.process.exec("gh", [
    "issue",
    "create",
    "--repo",
    REPO,
    "--title",
    fullTitle,
    "--body",
    body,
    "--label",
    label
  ]);
  const urlMatch = r.stdout.trim().match(/\/issues\/(\d+)/);
  if (urlMatch) return parseInt(urlMatch[1], 10);
  throw new Error("Failed to parse created issue number");
}
async function addComment(api, num, body) {
  await api.process.exec("gh", [
    "issue",
    "comment",
    String(num),
    "--repo",
    REPO,
    "--body",
    body
  ]);
}
var pluginApi = null;
function activate(ctx, api) {
  pluginApi = api;
  api.logging.info("Bug Report plugin activated");
  ctx.subscriptions.push(
    api.commands.register("bug-report.refresh", () => {
      reportState.requestRefresh();
    })
  );
  ctx.subscriptions.push(
    api.commands.register("bug-report.create", () => {
      reportState.setCreatingNew(true);
    })
  );
  ctx.subscriptions.push(
    api.commands.register("bug-report.viewInBrowser", () => {
      if (!reportState.selectedIssueNumber) {
        api.ui.showError("Select a report first");
        return;
      }
      const issue = [...reportState.issues, ...reportState.myIssues].find(
        (i) => i.number === reportState.selectedIssueNumber
      );
      if (issue?.url) {
        api.ui.openExternalUrl(issue.url);
      }
    })
  );
}
function deactivate() {
  pluginApi = null;
  reportState.reset();
}
var S = {
  sidebar: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
    fontSize: "13px",
    color: "var(--text-primary, #e4e4e7)"
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px 8px",
    borderBottom: "1px solid var(--border-primary, #3f3f46)"
  },
  headerTitle: {
    fontSize: "14px",
    fontWeight: 600
  },
  newBtn: {
    padding: "3px 10px",
    fontSize: "12px",
    border: "1px solid var(--border-primary, #3f3f46)",
    borderRadius: "6px",
    background: "var(--bg-accent, rgba(139,92,246,0.15))",
    color: "var(--text-primary, #e4e4e7)",
    cursor: "pointer",
    fontFamily: "inherit"
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid var(--border-primary, #3f3f46)"
  },
  tab: (active) => ({
    flex: 1,
    padding: "8px 12px",
    textAlign: "center",
    fontSize: "12px",
    cursor: "pointer",
    borderBottom: active ? "2px solid var(--text-accent, #8b5cf6)" : "2px solid transparent",
    color: active ? "var(--text-primary, #e4e4e7)" : "var(--text-secondary, #a1a1aa)",
    background: "transparent",
    border: "none",
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    borderBottomColor: active ? "var(--text-accent, #8b5cf6)" : "transparent",
    fontFamily: "inherit"
  }),
  search: {
    padding: "8px 14px",
    borderBottom: "1px solid var(--border-primary, #3f3f46)"
  },
  searchInput: {
    width: "100%",
    padding: "5px 8px",
    border: "1px solid var(--border-primary, #3f3f46)",
    borderRadius: "6px",
    background: "var(--bg-secondary, #27272a)",
    color: "var(--text-primary, #e4e4e7)",
    fontSize: "12px",
    outline: "none",
    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
    boxSizing: "border-box"
  },
  list: {
    flex: 1,
    overflowY: "auto",
    padding: "4px 0"
  },
  issueRow: (selected) => ({
    padding: "8px 14px",
    cursor: "pointer",
    borderLeft: selected ? "3px solid var(--text-accent, #8b5cf6)" : "3px solid transparent",
    background: selected ? "var(--bg-active, rgba(139,92,246,0.08))" : "transparent"
  }),
  issueTitle: {
    fontSize: "12px",
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  issueMeta: {
    fontSize: "11px",
    color: "var(--text-tertiary, #71717a)",
    marginTop: "2px",
    display: "flex",
    alignItems: "center",
    gap: "6px"
  },
  labelBadge: (color) => ({
    display: "inline-block",
    padding: "0 5px",
    borderRadius: "10px",
    fontSize: "10px",
    lineHeight: "16px",
    background: labelColorAlpha(color, "22"),
    color: labelColor(color),
    border: `1px solid ${labelColorAlpha(color, "44")}`
  }),
  main: {
    height: "100%",
    overflow: "auto",
    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
    fontSize: "13px",
    color: "var(--text-primary, #e4e4e7)",
    padding: "16px 20px"
  },
  formGroup: {
    marginBottom: "14px"
  },
  formLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    marginBottom: "4px",
    color: "var(--text-secondary, #a1a1aa)"
  },
  input: {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid var(--border-primary, #3f3f46)",
    borderRadius: "6px",
    background: "var(--bg-secondary, #27272a)",
    color: "var(--text-primary, #e4e4e7)",
    fontSize: "13px",
    outline: "none",
    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
    boxSizing: "border-box"
  },
  textarea: {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid var(--border-primary, #3f3f46)",
    borderRadius: "6px",
    background: "var(--bg-secondary, #27272a)",
    color: "var(--text-primary, #e4e4e7)",
    fontSize: "13px",
    outline: "none",
    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
    minHeight: "120px",
    resize: "vertical",
    boxSizing: "border-box"
  },
  btnPrimary: {
    padding: "7px 16px",
    fontSize: "13px",
    fontWeight: 600,
    border: "none",
    borderRadius: "6px",
    background: "var(--text-accent, #8b5cf6)",
    color: "#fff",
    cursor: "pointer",
    fontFamily: "inherit"
  },
  btnSecondary: {
    padding: "7px 16px",
    fontSize: "13px",
    border: "1px solid var(--border-primary, #3f3f46)",
    borderRadius: "6px",
    background: "transparent",
    color: "var(--text-primary, #e4e4e7)",
    cursor: "pointer",
    fontFamily: "inherit"
  },
  severityOption: (active, sev) => ({
    padding: "5px 12px",
    borderRadius: "6px",
    border: active ? `2px solid ${severityColor(sev)}` : "2px solid var(--border-primary, #3f3f46)",
    background: active ? `${severityColor(sev)}22` : "transparent",
    color: active ? severityColor(sev) : "var(--text-secondary, #a1a1aa)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: active ? 600 : 400,
    fontFamily: "inherit"
  }),
  typeOption: (active, type) => ({
    padding: "5px 16px",
    borderRadius: "6px",
    border: active ? `2px solid ${typeColor(type)}` : "2px solid var(--border-primary, #3f3f46)",
    background: active ? `${typeColor(type)}22` : "transparent",
    color: active ? typeColor(type) : "var(--text-secondary, #a1a1aa)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: active ? 600 : 400,
    fontFamily: "inherit",
    textTransform: "capitalize"
  }),
  severityBadge: (sev) => ({
    display: "inline-block",
    padding: "1px 6px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: 700,
    background: `${severityColor(sev)}22`,
    color: severityColor(sev),
    border: `1px solid ${severityColor(sev)}44`
  }),
  stateBadge: (state) => ({
    display: "inline-block",
    padding: "1px 8px",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: 500,
    background: state === "OPEN" || state === "open" ? "rgba(64,200,100,0.15)" : "rgba(139,92,246,0.15)",
    color: state === "OPEN" || state === "open" ? "#4ade80" : "#a78bfa"
  }),
  commentBox: {
    borderTop: "1px solid var(--border-primary, #3f3f46)",
    padding: "12px 0",
    marginTop: "8px"
  },
  comment: {
    padding: "10px 0",
    borderBottom: "1px solid var(--border-primary, #3f3f46)"
  },
  commentAuthor: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-primary, #e4e4e7)"
  },
  commentTime: {
    fontSize: "11px",
    color: "var(--text-tertiary, #71717a)",
    marginLeft: "8px"
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "var(--text-secondary, #a1a1aa)",
    textAlign: "center",
    padding: "24px",
    gap: "12px"
  },
  loadMore: {
    padding: "8px",
    textAlign: "center",
    cursor: "pointer",
    fontSize: "12px",
    color: "var(--text-accent, #8b5cf6)"
  },
  spinner: {
    padding: "16px",
    textAlign: "center",
    color: "var(--text-secondary, #a1a1aa)",
    fontSize: "12px"
  },
  errorBox: {
    padding: "24px",
    textAlign: "center",
    color: "var(--text-secondary, #a1a1aa)"
  }
};
function SidebarPanel({ api }) {
  const { style: themeStyle } = useTheme(api.theme);
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => reportState.subscribe(rerender), [rerender]);
  useEffect(() => {
    if (reportState.ghAuthed === null) {
      checkGhAuth(api).then((username) => {
        if (username) {
          reportState.setGhUsername(username);
          reportState.setGhAuthed(true);
          reportState.requestRefresh();
        } else {
          reportState.setGhAuthed(false);
        }
      });
    }
  }, [api]);
  useEffect(() => {
    if (!reportState.needsRefresh || !reportState.ghAuthed || reportState.loading) return;
    reportState.needsRefresh = false;
    const load = async () => {
      reportState.setLoading(true);
      try {
        const [myResult, allResult] = await Promise.all([
          reportState.ghUsername ? fetchIssues(api, 1, reportState.ghUsername) : Promise.resolve({ items: [], hasMore: false }),
          fetchIssues(api, reportState.page)
        ]);
        if (reportState.page === 1) {
          reportState.setMyIssues(myResult.items);
          reportState.setIssues(allResult.items);
        } else {
          reportState.appendIssues(allResult.items);
        }
        reportState.hasMore = allResult.hasMore;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        api.logging.error(`Failed to fetch issues: ${msg}`);
      } finally {
        reportState.setLoading(false);
      }
    };
    load();
  }, [api, reportState.needsRefresh, reportState.ghAuthed, reportState.loading]);
  if (reportState.ghAuthed === false) {
    return /* @__PURE__ */ jsxs("div", { style: { ...themeStyle, ...S.sidebar }, children: [
      /* @__PURE__ */ jsx("div", { style: S.header, children: /* @__PURE__ */ jsx("span", { style: S.headerTitle, children: "Bug Report" }) }),
      /* @__PURE__ */ jsxs("div", { style: S.errorBox, children: [
        /* @__PURE__ */ jsx("div", { style: { marginBottom: "12px" }, children: /* @__PURE__ */ jsx("svg", { width: "32", height: "32", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsx("path", { d: "M12 9v3m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" }) }) }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: "13px", fontWeight: 500 }, children: "GitHub CLI not authenticated" }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: "12px", marginTop: "4px" }, children: [
          "Run ",
          /* @__PURE__ */ jsx("code", { style: { background: "var(--bg-secondary, #27272a)", padding: "1px 5px", borderRadius: "3px" }, children: "gh auth login" }),
          " in your terminal"
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            style: { ...S.btnSecondary, marginTop: "12px" },
            onClick: () => {
              reportState.ghAuthed = null;
              checkGhAuth(api).then((username) => {
                if (username) {
                  reportState.setGhUsername(username);
                  reportState.setGhAuthed(true);
                  reportState.requestRefresh();
                } else {
                  reportState.setGhAuthed(false);
                }
              });
            },
            children: "Retry"
          }
        )
      ] })
    ] });
  }
  if (reportState.ghAuthed === null) {
    return /* @__PURE__ */ jsxs("div", { style: { ...themeStyle, ...S.sidebar }, children: [
      /* @__PURE__ */ jsx("div", { style: S.header, children: /* @__PURE__ */ jsx("span", { style: S.headerTitle, children: "Bug Report" }) }),
      /* @__PURE__ */ jsx("div", { style: S.spinner, children: "Checking GitHub authentication..." })
    ] });
  }
  const displayIssues = reportState.viewMode === "my-reports" ? reportState.myIssues : reportState.issues;
  const filtered = filterIssues(displayIssues, reportState.searchQuery);
  return /* @__PURE__ */ jsxs("div", { style: { ...themeStyle, ...S.sidebar }, children: [
    /* @__PURE__ */ jsxs("div", { style: S.header, children: [
      /* @__PURE__ */ jsx("span", { style: S.headerTitle, children: "Bug Report" }),
      /* @__PURE__ */ jsx("button", { style: S.newBtn, onClick: () => reportState.setCreatingNew(true), children: "+ New Report" })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: S.tabs, children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          style: S.tab(reportState.viewMode === "my-reports"),
          onClick: () => reportState.setViewMode("my-reports"),
          children: "My Reports"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          style: S.tab(reportState.viewMode === "all-recent"),
          onClick: () => reportState.setViewMode("all-recent"),
          children: "All Recent"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { style: S.search, children: /* @__PURE__ */ jsx(
      "input",
      {
        style: S.searchInput,
        placeholder: "Filter by title, #number, or label...",
        value: reportState.searchQuery,
        onChange: (e) => reportState.setSearchQuery(e.target.value)
      }
    ) }),
    /* @__PURE__ */ jsx("div", { style: S.list, children: reportState.loading && displayIssues.length === 0 ? /* @__PURE__ */ jsx("div", { style: S.spinner, children: "Loading reports..." }) : filtered.length === 0 ? /* @__PURE__ */ jsx("div", { style: { ...S.spinner, color: "var(--text-tertiary, #71717a)" }, children: reportState.searchQuery ? "No matching reports" : reportState.viewMode === "my-reports" ? "You haven\u2019t filed any reports yet" : "No reports found" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      filtered.map((issue) => {
        const { severity } = parseSeverityFromTitle(issue.title);
        return /* @__PURE__ */ jsxs(
          "div",
          {
            style: S.issueRow(reportState.selectedIssueNumber === issue.number),
            onClick: () => reportState.setSelectedIssue(issue.number),
            children: [
              /* @__PURE__ */ jsxs("div", { style: S.issueTitle, children: [
                severity && /* @__PURE__ */ jsx("span", { style: { ...S.severityBadge(severity), marginRight: "6px" }, children: severity }),
                parseSeverityFromTitle(issue.title).cleanTitle
              ] }),
              /* @__PURE__ */ jsxs("div", { style: S.issueMeta, children: [
                /* @__PURE__ */ jsxs("span", { children: [
                  "#",
                  issue.number
                ] }),
                /* @__PURE__ */ jsx("span", { children: relativeTime(issue.createdAt) }),
                /* @__PURE__ */ jsx("span", { children: issue.author.login }),
                issue.labels.map((l) => /* @__PURE__ */ jsx("span", { style: S.labelBadge(l.color), children: l.name }, l.name))
              ] })
            ]
          },
          issue.number
        );
      }),
      reportState.viewMode === "all-recent" && reportState.hasMore && !reportState.loading && /* @__PURE__ */ jsx(
        "div",
        {
          style: S.loadMore,
          onClick: () => {
            reportState.page++;
            reportState.requestRefresh();
          },
          children: "Load more..."
        }
      ),
      reportState.loading && displayIssues.length > 0 && /* @__PURE__ */ jsx("div", { style: S.spinner, children: "Loading..." })
    ] }) })
  ] });
}
function ReportForm({ api, onCreated }) {
  const [reportType, setReportType] = useState("bug");
  const [severity, setSeverity] = useState("MEDIUM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = title.trim().length > 0 && !submitting;
  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const num = await createIssue(api, title.trim(), description.trim(), reportType, severity);
      api.ui.showNotice(`Report #${num} filed successfully`);
      onCreated(num);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      api.ui.showError(`Failed to file report: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }, [api, title, description, reportType, severity, canSubmit, onCreated]);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h2", { style: { marginTop: 0, marginBottom: "16px", fontSize: "18px" }, children: "File a Report" }),
    /* @__PURE__ */ jsxs("div", { style: S.formGroup, children: [
      /* @__PURE__ */ jsx("label", { style: S.formLabel, children: "Type" }),
      /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: "8px" }, children: REPORT_TYPES.map((t) => /* @__PURE__ */ jsx(
        "button",
        {
          style: S.typeOption(reportType === t, t),
          onClick: () => setReportType(t),
          children: t === "bug" ? "Bug" : "Enhancement"
        },
        t
      )) })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: S.formGroup, children: [
      /* @__PURE__ */ jsx("label", { style: S.formLabel, children: "Severity" }),
      /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" }, children: SEVERITIES.map((s) => /* @__PURE__ */ jsx(
        "button",
        {
          style: S.severityOption(severity === s, s),
          onClick: () => setSeverity(s),
          children: s
        },
        s
      )) })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: S.formGroup, children: [
      /* @__PURE__ */ jsx("label", { style: S.formLabel, children: "Title" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          style: S.input,
          placeholder: "Brief summary of the issue...",
          value: title,
          onChange: (e) => setTitle(e.target.value)
        }
      ),
      title.trim() && /* @__PURE__ */ jsxs("div", { style: { fontSize: "11px", color: "var(--text-tertiary, #71717a)", marginTop: "4px" }, children: [
        "Will be filed as: ",
        /* @__PURE__ */ jsx("strong", { children: formatTitle(severity, title.trim()) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: S.formGroup, children: [
      /* @__PURE__ */ jsx("label", { style: S.formLabel, children: "Description" }),
      /* @__PURE__ */ jsx(
        "textarea",
        {
          style: S.textarea,
          placeholder: reportType === "bug" ? "Steps to reproduce:\n1. \n2. \n3. \n\nExpected behavior:\n\nActual behavior:\n\nAdditional context:" : "Describe the feature or improvement you'd like to see...",
          value: description,
          onChange: (e) => setDescription(e.target.value)
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px" }, children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          style: { ...S.btnPrimary, opacity: canSubmit ? 1 : 0.5 },
          onClick: handleSubmit,
          disabled: !canSubmit,
          children: submitting ? "Filing..." : "File Report"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          style: S.btnSecondary,
          onClick: () => reportState.setCreatingNew(false),
          children: "Cancel"
        }
      )
    ] })
  ] });
}
function IssueDetailView({ api, issueNumber }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  useEffect(() => {
    setLoading(true);
    setError(null);
    setDetail(null);
    fetchIssueDetail(api, issueNumber).then((d) => {
      setDetail(d);
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    });
  }, [api, issueNumber]);
  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || commenting) return;
    setCommenting(true);
    try {
      await addComment(api, issueNumber, newComment.trim());
      setNewComment("");
      const updated = await fetchIssueDetail(api, issueNumber);
      setDetail(updated);
      api.ui.showNotice("Comment added");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      api.ui.showError(`Failed to add comment: ${msg}`);
    } finally {
      setCommenting(false);
    }
  }, [api, issueNumber, newComment, commenting]);
  if (loading) {
    return /* @__PURE__ */ jsx("div", { style: S.spinner, children: "Loading report details..." });
  }
  if (error) {
    return /* @__PURE__ */ jsxs("div", { style: S.errorBox, children: [
      /* @__PURE__ */ jsx("div", { style: { color: "var(--red, #e5534b)", marginBottom: "8px" }, children: "Failed to load report" }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: "12px" }, children: error })
    ] });
  }
  if (!detail) return null;
  const { severity, cleanTitle } = parseSeverityFromTitle(detail.title);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { style: { marginBottom: "16px" }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }, children: [
        /* @__PURE__ */ jsxs("span", { style: { fontSize: "14px", color: "var(--text-tertiary, #71717a)" }, children: [
          "#",
          detail.number
        ] }),
        /* @__PURE__ */ jsx("span", { style: S.stateBadge(detail.state), children: detail.state }),
        severity && /* @__PURE__ */ jsx("span", { style: S.severityBadge(severity), children: severity })
      ] }),
      /* @__PURE__ */ jsx("h2", { style: { marginTop: 0, marginBottom: "8px", fontSize: "18px" }, children: cleanTitle }),
      /* @__PURE__ */ jsxs("div", { style: { fontSize: "12px", color: "var(--text-tertiary, #71717a)", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }, children: [
        /* @__PURE__ */ jsxs("span", { children: [
          "by ",
          detail.author.login
        ] }),
        /* @__PURE__ */ jsx("span", { children: relativeTime(detail.createdAt) }),
        detail.labels.map((l) => /* @__PURE__ */ jsx("span", { style: S.labelBadge(l.color), children: l.name }, l.name)),
        /* @__PURE__ */ jsx(
          "a",
          {
            href: detail.url,
            target: "_blank",
            rel: "noopener noreferrer",
            style: { color: "var(--text-accent, #8b5cf6)", textDecoration: "none", fontSize: "12px" },
            children: "View on GitHub"
          }
        )
      ] })
    ] }),
    detail.body ? /* @__PURE__ */ jsx("div", { style: { marginBottom: "16px" }, children: /* @__PURE__ */ jsx(Markdown, { source: detail.body }) }) : /* @__PURE__ */ jsx("div", { style: { marginBottom: "16px", color: "var(--text-tertiary, #71717a)", fontStyle: "italic" }, children: "No description provided." }),
    detail.comments.length > 0 && /* @__PURE__ */ jsxs("div", { style: S.commentBox, children: [
      /* @__PURE__ */ jsxs("div", { style: { fontSize: "13px", fontWeight: 600, marginBottom: "8px" }, children: [
        "Comments (",
        detail.comments.length,
        ")"
      ] }),
      detail.comments.map((c, idx) => /* @__PURE__ */ jsxs("div", { style: S.comment, children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { style: S.commentAuthor, children: c.author.login }),
          /* @__PURE__ */ jsx("span", { style: S.commentTime, children: relativeTime(c.createdAt) })
        ] }),
        /* @__PURE__ */ jsx("div", { style: { marginTop: "4px" }, children: /* @__PURE__ */ jsx(Markdown, { source: c.body }) })
      ] }, idx))
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { marginTop: "16px" }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--text-secondary, #a1a1aa)" }, children: "Add a comment" }),
      /* @__PURE__ */ jsx(
        "textarea",
        {
          style: { ...S.textarea, minHeight: "80px" },
          placeholder: "Leave a comment...",
          value: newComment,
          onChange: (e) => setNewComment(e.target.value)
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          style: { ...S.btnPrimary, marginTop: "8px", opacity: newComment.trim() && !commenting ? 1 : 0.5 },
          onClick: handleAddComment,
          disabled: !newComment.trim() || commenting,
          children: commenting ? "Posting..." : "Comment"
        }
      )
    ] })
  ] });
}
function MainPanel({ api }) {
  const { style: themeStyle } = useTheme(api.theme);
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => reportState.subscribe(rerender), [rerender]);
  const handleCreated = useCallback((num) => {
    reportState.setCreatingNew(false);
    reportState.setSelectedIssue(num);
    reportState.requestRefresh();
  }, []);
  if (reportState.ghAuthed === false || reportState.ghAuthed === null) {
    return /* @__PURE__ */ jsx("div", { style: { ...themeStyle, ...S.main }, children: /* @__PURE__ */ jsxs("div", { style: S.empty, children: [
      /* @__PURE__ */ jsxs("svg", { width: "48", height: "48", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: [
        /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }),
        /* @__PURE__ */ jsx("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
        /* @__PURE__ */ jsx("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: "14px" }, children: "Authenticate with GitHub to file bug reports" }),
      /* @__PURE__ */ jsxs("div", { style: { fontSize: "12px" }, children: [
        "Run ",
        /* @__PURE__ */ jsx("code", { style: { background: "var(--bg-secondary, #27272a)", padding: "1px 5px", borderRadius: "3px" }, children: "gh auth login" }),
        " to get started"
      ] })
    ] }) });
  }
  if (reportState.creatingNew) {
    return /* @__PURE__ */ jsx("div", { style: { ...themeStyle, ...S.main }, children: /* @__PURE__ */ jsx(ReportForm, { api, onCreated: handleCreated }) });
  }
  if (reportState.selectedIssueNumber) {
    return /* @__PURE__ */ jsx("div", { style: { ...themeStyle, ...S.main }, children: /* @__PURE__ */ jsx(IssueDetailView, { api, issueNumber: reportState.selectedIssueNumber }) });
  }
  return /* @__PURE__ */ jsx("div", { style: { ...themeStyle, ...S.main }, children: /* @__PURE__ */ jsxs("div", { style: S.empty, children: [
    /* @__PURE__ */ jsxs("svg", { width: "48", height: "48", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: [
      /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }),
      /* @__PURE__ */ jsx("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
      /* @__PURE__ */ jsx("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { fontSize: "14px" }, children: "Help improve Clubhouse" }),
    /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", maxWidth: "300px" }, children: "File a bug report or feature request to the Clubhouse project. Select an existing report from the sidebar or create a new one." }),
    /* @__PURE__ */ jsx(
      "button",
      {
        style: { ...S.btnPrimary, marginTop: "8px" },
        onClick: () => reportState.setCreatingNew(true),
        children: "File a Report"
      }
    )
  ] }) });
}
export {
  MainPanel,
  SidebarPanel,
  activate,
  deactivate
};
