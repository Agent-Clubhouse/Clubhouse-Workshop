import type {
  PluginContext,
  PluginAPI,
  PanelProps,
} from "@clubhouse/plugin-types";
import {
  relativeTime,
  labelColor,
  labelColorAlpha,
  isSafeUrl,
  filterIssues,
  parseSeverityFromTitle,
  formatTitle,
  severityColor,
  typeColor,
  SEVERITIES,
  REPORT_TYPES,
  REPO,
} from "./helpers";
import type { Severity, ReportType, IssueListItem } from "./helpers";
import { createBugReportState } from "./state";
import type { ViewMode } from "./state";

const React = globalThis.React;
const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IssueDetail extends IssueListItem {
  body: string;
  comments: Array<{ author: { login: string }; body: string; createdAt: string }>;
  assignees: Array<{ login: string }>;
}

// ---------------------------------------------------------------------------
// Shared state (coordinates SidebarPanel and MainPanel across React trees)
// ---------------------------------------------------------------------------

const reportState = createBugReportState();

// ---------------------------------------------------------------------------
// Markdown renderer (lightweight GFM-subset → JSX, no external deps)
// Reused from github-issues plugin pattern
// ---------------------------------------------------------------------------

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const inlineRe =
    /!\[([^\]]*)\]\(([^)]+)\)|(\[([^\]]+)\]\(([^)]+)\))|(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)|(~~[^~]+~~)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const m = match[0];

    if (m.startsWith("![")) {
      const alt = match[1];
      const src = match[2];
      if (isSafeUrl(src)) {
        nodes.push(
          <img key={match.index} src={src} alt={alt} style={{ maxWidth: "100%", borderRadius: "4px", margin: "4px 0" }} />,
        );
      } else {
        nodes.push(
          <span key={match.index} style={{ color: "var(--text-secondary, #a1a1aa)", fontSize: "12px" }}>[image blocked: unsafe URL]</span>,
        );
      }
    } else if (m.startsWith("[")) {
      const linkText = match[4];
      const href = match[5];
      if (isSafeUrl(href)) {
        nodes.push(
          <a
            key={match.index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-accent, #8b5cf6)", textDecoration: "underline" }}
          >
            {linkText}
          </a>,
        );
      } else {
        nodes.push(<span key={match.index}>{linkText}</span>);
      }
    } else if (m.startsWith("`")) {
      nodes.push(
        <code
          key={match.index}
          style={{
            background: "var(--bg-secondary, #27272a)",
            padding: "1px 5px",
            borderRadius: "3px",
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            fontSize: "0.9em",
          }}
        >
          {m.slice(1, -1)}
        </code>,
      );
    } else if (m.startsWith("**") || m.startsWith("__")) {
      nodes.push(<strong key={match.index}>{renderInline(m.slice(2, -2))}</strong>);
    } else if (m.startsWith("~~")) {
      nodes.push(<del key={match.index}>{renderInline(m.slice(2, -2))}</del>);
    } else if (m.startsWith("*") || m.startsWith("_")) {
      nodes.push(<em key={match.index}>{renderInline(m.slice(1, -1))}</em>);
    }
    last = match.index + m.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Markdown({ source }: { source: string }) {
  const elements = useMemo(() => {
    const lines = source.split("\n");
    const result: React.ReactNode[] = [];
    let i = 0;

    const codeBlockStyle: React.CSSProperties = {
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
      color: "var(--text-primary, #e4e4e7)",
    };

    const blockquoteStyle: React.CSSProperties = {
      borderLeft: "3px solid var(--border-primary, #3f3f46)",
      paddingLeft: "12px",
      margin: "8px 0",
      color: "var(--text-secondary, #a1a1aa)",
    };

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith("```")) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        result.push(
          <pre key={result.length} style={codeBlockStyle}>
            <code>{codeLines.join("\n")}</code>
          </pre>,
        );
        continue;
      }

      if (!line.trim()) { i++; continue; }

      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const sizes: Record<number, string> = { 1: "1.5em", 2: "1.3em", 3: "1.15em", 4: "1em", 5: "0.95em", 6: "0.9em" };
        result.push(
          <div
            key={result.length}
            style={{
              fontSize: sizes[level] || "1em",
              fontWeight: 600,
              margin: "12px 0 6px",
              color: "var(--text-primary, #e4e4e7)",
              borderBottom: level <= 2 ? "1px solid var(--border-primary, #3f3f46)" : undefined,
              paddingBottom: level <= 2 ? "4px" : undefined,
            }}
          >
            {renderInline(headingMatch[2])}
          </div>,
        );
        i++;
        continue;
      }

      if (/^[-*_]{3,}\s*$/.test(line)) {
        result.push(
          <hr key={result.length} style={{ border: "none", borderTop: "1px solid var(--border-primary, #3f3f46)", margin: "12px 0" }} />,
        );
        i++;
        continue;
      }

      if (line.startsWith("> ") || line === ">") {
        const quoteLines: string[] = [];
        while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) {
          quoteLines.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        result.push(
          <blockquote key={result.length} style={blockquoteStyle}>
            <Markdown source={quoteLines.join("\n")} />
          </blockquote>,
        );
        continue;
      }

      if (/^\s*[-*+]\s/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
          i++;
        }
        result.push(
          <ul key={result.length} style={{ margin: "6px 0", paddingLeft: "20px" }}>
            {items.map((item, idx) => (
              <li key={idx} style={{ marginBottom: "2px" }}>{renderInline(item)}</li>
            ))}
          </ul>,
        );
        continue;
      }

      if (/^\s*\d+[.)]\s/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
          i++;
        }
        result.push(
          <ol key={result.length} style={{ margin: "6px 0", paddingLeft: "20px" }}>
            {items.map((item, idx) => (
              <li key={idx} style={{ marginBottom: "2px" }}>{renderInline(item)}</li>
            ))}
          </ol>,
        );
        continue;
      }

      if (/^\s*[-*]\s\[[ x]\]/.test(line)) {
        const items: { checked: boolean; text: string }[] = [];
        while (i < lines.length && /^\s*[-*]\s\[[ x]\]/.test(lines[i])) {
          const checked = lines[i].includes("[x]");
          const text = lines[i].replace(/^\s*[-*]\s\[[ x]\]\s*/, "");
          items.push({ checked, text });
          i++;
        }
        result.push(
          <ul key={result.length} style={{ margin: "6px 0", paddingLeft: "20px", listStyle: "none" }}>
            {items.map((item, idx) => (
              <li key={idx} style={{ marginBottom: "2px" }}>
                <input type="checkbox" checked={item.checked} readOnly style={{ marginRight: "6px" }} />
                {renderInline(item.text)}
              </li>
            ))}
          </ul>,
        );
        continue;
      }

      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].startsWith("```") &&
        !lines[i].match(/^#{1,6}\s/) &&
        !/^[-*_]{3,}\s*$/.test(lines[i]) &&
        !lines[i].startsWith("> ") &&
        lines[i] !== ">" &&
        !/^\s*[-*+]\s/.test(lines[i]) &&
        !/^\s*\d+[.)]\s/.test(lines[i])
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length > 0) {
        result.push(
          <p key={result.length} style={{ margin: "6px 0", lineHeight: 1.6 }}>
            {renderInline(paraLines.join("\n"))}
          </p>,
        );
      }
    }

    return result;
  }, [source]);

  return (
    <div
      style={{
        fontSize: "13px",
        color: "var(--text-primary, #e4e4e7)",
        fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
        wordWrap: "break-word",
        overflowWrap: "break-word",
      }}
    >
      {elements}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GitHub helpers
// ---------------------------------------------------------------------------

async function checkGhAuth(api: PluginAPI): Promise<string | null> {
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

const ISSUE_FIELDS = "number,title,state,url,createdAt,updatedAt,author,labels";
const PER_PAGE = 30;

async function fetchIssues(
  api: PluginAPI,
  page: number,
  author?: string,
): Promise<{ items: IssueListItem[]; hasMore: boolean }> {
  const args = [
    "issue", "list",
    "--repo", REPO,
    "--json", ISSUE_FIELDS,
    "--limit", String(PER_PAGE + 1),
    "--state", "all",
    "--sort", "created",
    "--order", "desc",
  ];
  if (author) {
    args.push("--author", author);
  }
  if (page > 1) {
    // gh doesn't support offset natively; fetch enough to skip
    args[args.indexOf(String(PER_PAGE + 1))] = String((PER_PAGE * page) + 1);
  }

  const r = await api.process.exec("gh", args);
  let items: IssueListItem[] = JSON.parse(r.stdout);

  // Handle pagination offset
  if (page > 1) {
    items = items.slice(PER_PAGE * (page - 1));
  }

  const hasMore = items.length > PER_PAGE;
  if (hasMore) items = items.slice(0, PER_PAGE);

  return { items, hasMore };
}

async function fetchIssueDetail(api: PluginAPI, num: number): Promise<IssueDetail> {
  const r = await api.process.exec("gh", [
    "issue", "view", String(num),
    "--repo", REPO,
    "--json", "number,title,state,url,createdAt,updatedAt,author,labels,body,comments,assignees",
  ]);
  return JSON.parse(r.stdout);
}

async function createIssue(
  api: PluginAPI,
  title: string,
  body: string,
  label: ReportType,
  severity: Severity,
): Promise<number> {
  const fullTitle = formatTitle(severity, title);
  const r = await api.process.exec("gh", [
    "issue", "create",
    "--repo", REPO,
    "--title", fullTitle,
    "--body", body,
    "--label", label,
  ]);
  // gh outputs the issue URL, extract the number
  const urlMatch = r.stdout.trim().match(/\/issues\/(\d+)/);
  if (urlMatch) return parseInt(urlMatch[1], 10);
  throw new Error("Failed to parse created issue number");
}

async function addComment(api: PluginAPI, num: number, body: string): Promise<void> {
  await api.process.exec("gh", [
    "issue", "comment", String(num),
    "--repo", REPO,
    "--body", body,
  ]);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let pluginApi: PluginAPI | null = null;

export function activate(ctx: PluginContext, api: PluginAPI): void {
  pluginApi = api;
  api.logging.info("Bug Report plugin activated");

  ctx.subscriptions.push(
    api.commands.register("bug-report.refresh", () => {
      reportState.requestRefresh();
    }),
  );
  ctx.subscriptions.push(
    api.commands.register("bug-report.create", () => {
      reportState.setCreatingNew(true);
    }),
  );
  ctx.subscriptions.push(
    api.commands.register("bug-report.viewInBrowser", () => {
      if (!reportState.selectedIssueNumber) {
        api.ui.showError("Select a report first");
        return;
      }
      const issue = [...reportState.issues, ...reportState.myIssues].find(
        i => i.number === reportState.selectedIssueNumber,
      );
      if (issue?.url) {
        api.ui.openExternalUrl(issue.url);
      }
    }),
  );
}

export function deactivate(): void {
  pluginApi = null;
  reportState.reset();
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = {
  sidebar: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
    fontSize: "13px",
    color: "var(--text-primary, #e4e4e7)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px 8px",
    borderBottom: "1px solid var(--border-primary, #3f3f46)",
  },
  headerTitle: {
    fontSize: "14px",
    fontWeight: 600,
  },
  newBtn: {
    padding: "3px 10px",
    fontSize: "12px",
    border: "1px solid var(--border-primary, #3f3f46)",
    borderRadius: "6px",
    background: "var(--bg-accent, rgba(139,92,246,0.15))",
    color: "var(--text-primary, #e4e4e7)",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid var(--border-primary, #3f3f46)",
  },
  tab: (active: boolean) => ({
    flex: 1,
    padding: "8px 12px",
    textAlign: "center" as const,
    fontSize: "12px",
    cursor: "pointer",
    borderBottom: active ? "2px solid var(--text-accent, #8b5cf6)" : "2px solid transparent",
    color: active ? "var(--text-primary, #e4e4e7)" : "var(--text-secondary, #a1a1aa)",
    background: "transparent",
    border: "none",
    borderBottomWidth: "2px",
    borderBottomStyle: "solid" as const,
    borderBottomColor: active ? "var(--text-accent, #8b5cf6)" : "transparent",
    fontFamily: "inherit",
  }),
  search: {
    padding: "8px 14px",
    borderBottom: "1px solid var(--border-primary, #3f3f46)",
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
    boxSizing: "border-box" as const,
  },
  list: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "4px 0",
  },
  issueRow: (selected: boolean) => ({
    padding: "8px 14px",
    cursor: "pointer",
    borderLeft: selected ? "3px solid var(--text-accent, #8b5cf6)" : "3px solid transparent",
    background: selected ? "var(--bg-active, rgba(139,92,246,0.08))" : "transparent",
  }),
  issueTitle: {
    fontSize: "12px",
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  issueMeta: {
    fontSize: "11px",
    color: "var(--text-tertiary, #71717a)",
    marginTop: "2px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  labelBadge: (color: string) => ({
    display: "inline-block",
    padding: "0 5px",
    borderRadius: "10px",
    fontSize: "10px",
    lineHeight: "16px",
    background: labelColorAlpha(color, "22"),
    color: labelColor(color),
    border: `1px solid ${labelColorAlpha(color, "44")}`,
  }),
  main: {
    height: "100%",
    overflow: "auto",
    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
    fontSize: "13px",
    color: "var(--text-primary, #e4e4e7)",
    padding: "16px 20px",
  },
  formGroup: {
    marginBottom: "14px",
  },
  formLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    marginBottom: "4px",
    color: "var(--text-secondary, #a1a1aa)",
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
    boxSizing: "border-box" as const,
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
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
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
    fontFamily: "inherit",
  },
  btnSecondary: {
    padding: "7px 16px",
    fontSize: "13px",
    border: "1px solid var(--border-primary, #3f3f46)",
    borderRadius: "6px",
    background: "transparent",
    color: "var(--text-primary, #e4e4e7)",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  severityOption: (active: boolean, sev: Severity) => ({
    padding: "5px 12px",
    borderRadius: "6px",
    border: active ? `2px solid ${severityColor(sev)}` : "2px solid var(--border-primary, #3f3f46)",
    background: active ? `${severityColor(sev)}22` : "transparent",
    color: active ? severityColor(sev) : "var(--text-secondary, #a1a1aa)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: active ? 600 : 400,
    fontFamily: "inherit",
  }),
  typeOption: (active: boolean, type: ReportType) => ({
    padding: "5px 16px",
    borderRadius: "6px",
    border: active ? `2px solid ${typeColor(type)}` : "2px solid var(--border-primary, #3f3f46)",
    background: active ? `${typeColor(type)}22` : "transparent",
    color: active ? typeColor(type) : "var(--text-secondary, #a1a1aa)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: active ? 600 : 400,
    fontFamily: "inherit",
    textTransform: "capitalize" as const,
  }),
  severityBadge: (sev: Severity) => ({
    display: "inline-block",
    padding: "1px 6px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: 700,
    background: `${severityColor(sev)}22`,
    color: severityColor(sev),
    border: `1px solid ${severityColor(sev)}44`,
  }),
  stateBadge: (state: string) => ({
    display: "inline-block",
    padding: "1px 8px",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: 500,
    background: state === "OPEN" || state === "open" ? "rgba(64,200,100,0.15)" : "rgba(139,92,246,0.15)",
    color: state === "OPEN" || state === "open" ? "#4ade80" : "#a78bfa",
  }),
  commentBox: {
    borderTop: "1px solid var(--border-primary, #3f3f46)",
    padding: "12px 0",
    marginTop: "8px",
  },
  comment: {
    padding: "10px 0",
    borderBottom: "1px solid var(--border-primary, #3f3f46)",
  },
  commentAuthor: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-primary, #e4e4e7)",
  },
  commentTime: {
    fontSize: "11px",
    color: "var(--text-tertiary, #71717a)",
    marginLeft: "8px",
  },
  empty: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "var(--text-secondary, #a1a1aa)",
    textAlign: "center" as const,
    padding: "24px",
    gap: "12px",
  },
  loadMore: {
    padding: "8px",
    textAlign: "center" as const,
    cursor: "pointer",
    fontSize: "12px",
    color: "var(--text-accent, #8b5cf6)",
  },
  spinner: {
    padding: "16px",
    textAlign: "center" as const,
    color: "var(--text-secondary, #a1a1aa)",
    fontSize: "12px",
  },
  errorBox: {
    padding: "24px",
    textAlign: "center" as const,
    color: "var(--text-secondary, #a1a1aa)",
  },
};

// ---------------------------------------------------------------------------
// SidebarPanel
// ---------------------------------------------------------------------------

export function SidebarPanel({ api }: PanelProps) {
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => reportState.subscribe(rerender), [rerender]);

  // Check GH auth on mount
  useEffect(() => {
    if (reportState.ghAuthed === null) {
      checkGhAuth(api).then(username => {
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

  // Fetch issues when refresh is requested
  useEffect(() => {
    if (!reportState.needsRefresh || !reportState.ghAuthed || reportState.loading) return;
    reportState.needsRefresh = false;

    const load = async () => {
      reportState.setLoading(true);
      try {
        // Fetch both my issues and all issues in parallel
        const [myResult, allResult] = await Promise.all([
          reportState.ghUsername
            ? fetchIssues(api, 1, reportState.ghUsername)
            : Promise.resolve({ items: [], hasMore: false }),
          fetchIssues(api, reportState.page),
        ]);

        if (reportState.page === 1) {
          reportState.setMyIssues(myResult.items);
          reportState.setIssues(allResult.items);
        } else {
          reportState.appendIssues(allResult.items);
        }
        reportState.hasMore = allResult.hasMore;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        api.logging.error(`Failed to fetch issues: ${msg}`);
      } finally {
        reportState.setLoading(false);
      }
    };

    load();
  }, [api, reportState.needsRefresh, reportState.ghAuthed, reportState.loading]);

  // Not authed
  if (reportState.ghAuthed === false) {
    return (
      <div style={S.sidebar}>
        <div style={S.header}>
          <span style={S.headerTitle}>Bug Report</span>
        </div>
        <div style={S.errorBox}>
          <div style={{ marginBottom: "12px" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 9v3m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div style={{ fontSize: "13px", fontWeight: 500 }}>GitHub CLI not authenticated</div>
          <div style={{ fontSize: "12px", marginTop: "4px" }}>
            Run <code style={{ background: "var(--bg-secondary, #27272a)", padding: "1px 5px", borderRadius: "3px" }}>gh auth login</code> in your terminal
          </div>
          <button
            style={{ ...S.btnSecondary, marginTop: "12px" }}
            onClick={() => {
              reportState.ghAuthed = null;
              checkGhAuth(api).then(username => {
                if (username) {
                  reportState.setGhUsername(username);
                  reportState.setGhAuthed(true);
                  reportState.requestRefresh();
                } else {
                  reportState.setGhAuthed(false);
                }
              });
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading initial auth check
  if (reportState.ghAuthed === null) {
    return (
      <div style={S.sidebar}>
        <div style={S.header}>
          <span style={S.headerTitle}>Bug Report</span>
        </div>
        <div style={S.spinner}>Checking GitHub authentication...</div>
      </div>
    );
  }

  const displayIssues = reportState.viewMode === "my-reports"
    ? reportState.myIssues
    : reportState.issues;
  const filtered = filterIssues(displayIssues, reportState.searchQuery);

  return (
    <div style={S.sidebar}>
      <div style={S.header}>
        <span style={S.headerTitle}>Bug Report</span>
        <button style={S.newBtn} onClick={() => reportState.setCreatingNew(true)}>
          + New Report
        </button>
      </div>

      {/* View mode tabs */}
      <div style={S.tabs}>
        <button
          style={S.tab(reportState.viewMode === "my-reports")}
          onClick={() => reportState.setViewMode("my-reports")}
        >
          My Reports
        </button>
        <button
          style={S.tab(reportState.viewMode === "all-recent")}
          onClick={() => reportState.setViewMode("all-recent")}
        >
          All Recent
        </button>
      </div>

      {/* Search */}
      <div style={S.search}>
        <input
          style={S.searchInput}
          placeholder="Filter by title, #number, or label..."
          value={reportState.searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            reportState.setSearchQuery((e.target as HTMLInputElement).value)
          }
        />
      </div>

      {/* Issue list */}
      <div style={S.list}>
        {reportState.loading && displayIssues.length === 0 ? (
          <div style={S.spinner}>Loading reports...</div>
        ) : filtered.length === 0 ? (
          <div style={{ ...S.spinner, color: "var(--text-tertiary, #71717a)" }}>
            {reportState.searchQuery
              ? "No matching reports"
              : reportState.viewMode === "my-reports"
                ? "You haven\u2019t filed any reports yet"
                : "No reports found"}
          </div>
        ) : (
          <>
            {filtered.map(issue => {
              const { severity } = parseSeverityFromTitle(issue.title);
              return (
                <div
                  key={issue.number}
                  style={S.issueRow(reportState.selectedIssueNumber === issue.number)}
                  onClick={() => reportState.setSelectedIssue(issue.number)}
                >
                  <div style={S.issueTitle}>
                    {severity && (
                      <span style={{ ...S.severityBadge(severity), marginRight: "6px" }}>{severity}</span>
                    )}
                    {parseSeverityFromTitle(issue.title).cleanTitle}
                  </div>
                  <div style={S.issueMeta}>
                    <span>#{issue.number}</span>
                    <span>{relativeTime(issue.createdAt)}</span>
                    <span>{issue.author.login}</span>
                    {issue.labels.map(l => (
                      <span key={l.name} style={S.labelBadge(l.color)}>{l.name}</span>
                    ))}
                  </div>
                </div>
              );
            })}
            {reportState.viewMode === "all-recent" && reportState.hasMore && !reportState.loading && (
              <div
                style={S.loadMore}
                onClick={() => {
                  reportState.page++;
                  reportState.requestRefresh();
                }}
              >
                Load more...
              </div>
            )}
            {reportState.loading && displayIssues.length > 0 && (
              <div style={S.spinner}>Loading...</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report Form
// ---------------------------------------------------------------------------

function ReportForm({ api, onCreated }: { api: PluginAPI; onCreated: (num: number) => void }) {
  const [reportType, setReportType] = useState<ReportType>("bug");
  const [severity, setSeverity] = useState<Severity>("MEDIUM");
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      api.ui.showError(`Failed to file report: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }, [api, title, description, reportType, severity, canSubmit, onCreated]);

  return (
    <div>
      <h2 style={{ marginTop: 0, marginBottom: "16px", fontSize: "18px" }}>File a Report</h2>

      {/* Type selector */}
      <div style={S.formGroup}>
        <label style={S.formLabel}>Type</label>
        <div style={{ display: "flex", gap: "8px" }}>
          {REPORT_TYPES.map(t => (
            <button
              key={t}
              style={S.typeOption(reportType === t, t)}
              onClick={() => setReportType(t)}
            >
              {t === "bug" ? "Bug" : "Enhancement"}
            </button>
          ))}
        </div>
      </div>

      {/* Severity selector */}
      <div style={S.formGroup}>
        <label style={S.formLabel}>Severity</label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {SEVERITIES.map(s => (
            <button
              key={s}
              style={S.severityOption(severity === s, s)}
              onClick={() => setSeverity(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div style={S.formGroup}>
        <label style={S.formLabel}>Title</label>
        <input
          style={S.input}
          placeholder="Brief summary of the issue..."
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle((e.target as HTMLInputElement).value)}
        />
        {title.trim() && (
          <div style={{ fontSize: "11px", color: "var(--text-tertiary, #71717a)", marginTop: "4px" }}>
            Will be filed as: <strong>{formatTitle(severity, title.trim())}</strong>
          </div>
        )}
      </div>

      {/* Description */}
      <div style={S.formGroup}>
        <label style={S.formLabel}>Description</label>
        <textarea
          style={S.textarea}
          placeholder={reportType === "bug"
            ? "Steps to reproduce:\n1. \n2. \n3. \n\nExpected behavior:\n\nActual behavior:\n\nAdditional context:"
            : "Describe the feature or improvement you'd like to see..."}
          value={description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription((e.target as HTMLTextAreaElement).value)}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          style={{ ...S.btnPrimary, opacity: canSubmit ? 1 : 0.5 }}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? "Filing..." : "File Report"}
        </button>
        <button
          style={S.btnSecondary}
          onClick={() => reportState.setCreatingNew(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Issue Detail View
// ---------------------------------------------------------------------------

function IssueDetailView({ api, issueNumber }: { api: PluginAPI; issueNumber: number }) {
  const [detail, setDetail] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDetail(null);
    fetchIssueDetail(api, issueNumber)
      .then(d => { setDetail(d); setLoading(false); })
      .catch(err => {
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
      // Refresh the detail
      const updated = await fetchIssueDetail(api, issueNumber);
      setDetail(updated);
      api.ui.showNotice("Comment added");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      api.ui.showError(`Failed to add comment: ${msg}`);
    } finally {
      setCommenting(false);
    }
  }, [api, issueNumber, newComment, commenting]);

  if (loading) {
    return <div style={S.spinner}>Loading report details...</div>;
  }

  if (error) {
    return (
      <div style={S.errorBox}>
        <div style={{ color: "var(--red, #e5534b)", marginBottom: "8px" }}>Failed to load report</div>
        <div style={{ fontSize: "12px" }}>{error}</div>
      </div>
    );
  }

  if (!detail) return null;

  const { severity, cleanTitle } = parseSeverityFromTitle(detail.title);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span style={{ fontSize: "14px", color: "var(--text-tertiary, #71717a)" }}>#{detail.number}</span>
          <span style={S.stateBadge(detail.state)}>{detail.state}</span>
          {severity && <span style={S.severityBadge(severity)}>{severity}</span>}
        </div>
        <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "18px" }}>{cleanTitle}</h2>
        <div style={{ fontSize: "12px", color: "var(--text-tertiary, #71717a)", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <span>by {detail.author.login}</span>
          <span>{relativeTime(detail.createdAt)}</span>
          {detail.labels.map(l => (
            <span key={l.name} style={S.labelBadge(l.color)}>{l.name}</span>
          ))}
          <a
            href={detail.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-accent, #8b5cf6)", textDecoration: "none", fontSize: "12px" }}
          >
            View on GitHub
          </a>
        </div>
      </div>

      {/* Body */}
      {detail.body ? (
        <div style={{ marginBottom: "16px" }}>
          <Markdown source={detail.body} />
        </div>
      ) : (
        <div style={{ marginBottom: "16px", color: "var(--text-tertiary, #71717a)", fontStyle: "italic" }}>
          No description provided.
        </div>
      )}

      {/* Comments */}
      {detail.comments.length > 0 && (
        <div style={S.commentBox}>
          <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
            Comments ({detail.comments.length})
          </div>
          {detail.comments.map((c, idx) => (
            <div key={idx} style={S.comment}>
              <div>
                <span style={S.commentAuthor}>{c.author.login}</span>
                <span style={S.commentTime}>{relativeTime(c.createdAt)}</span>
              </div>
              <div style={{ marginTop: "4px" }}>
                <Markdown source={c.body} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add comment */}
      <div style={{ marginTop: "16px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--text-secondary, #a1a1aa)" }}>
          Add a comment
        </div>
        <textarea
          style={{ ...S.textarea, minHeight: "80px" }}
          placeholder="Leave a comment..."
          value={newComment}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComment((e.target as HTMLTextAreaElement).value)}
        />
        <button
          style={{ ...S.btnPrimary, marginTop: "8px", opacity: newComment.trim() && !commenting ? 1 : 0.5 }}
          onClick={handleAddComment}
          disabled={!newComment.trim() || commenting}
        >
          {commenting ? "Posting..." : "Comment"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MainPanel
// ---------------------------------------------------------------------------

export function MainPanel({ api }: PanelProps) {
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => reportState.subscribe(rerender), [rerender]);

  const handleCreated = useCallback((num: number) => {
    reportState.setCreatingNew(false);
    reportState.setSelectedIssue(num);
    reportState.requestRefresh();
  }, []);

  if (reportState.ghAuthed === false || reportState.ghAuthed === null) {
    return (
      <div style={S.main}>
        <div style={S.empty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ fontSize: "14px" }}>Authenticate with GitHub to file bug reports</div>
          <div style={{ fontSize: "12px" }}>
            Run <code style={{ background: "var(--bg-secondary, #27272a)", padding: "1px 5px", borderRadius: "3px" }}>gh auth login</code> to get started
          </div>
        </div>
      </div>
    );
  }

  if (reportState.creatingNew) {
    return (
      <div style={S.main}>
        <ReportForm api={api} onCreated={handleCreated} />
      </div>
    );
  }

  if (reportState.selectedIssueNumber) {
    return (
      <div style={S.main}>
        <IssueDetailView api={api} issueNumber={reportState.selectedIssueNumber} />
      </div>
    );
  }

  return (
    <div style={S.main}>
      <div style={S.empty}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div style={{ fontSize: "14px" }}>Help improve Clubhouse</div>
        <div style={{ fontSize: "12px", maxWidth: "300px" }}>
          File a bug report or feature request to the Clubhouse project. Select an existing report from the sidebar or create a new one.
        </div>
        <button
          style={{ ...S.btnPrimary, marginTop: "8px" }}
          onClick={() => reportState.setCreatingNew(true)}
        >
          File a Report
        </button>
      </div>
    </div>
  );
}
