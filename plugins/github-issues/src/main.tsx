import type {
  PluginContext,
  PluginAPI,
  PanelProps,
  AgentInfo,
} from "@clubhouse/plugin-types";
import { relativeTime, labelColor, extractYamlValue } from "./helpers";

const React = globalThis.React;
const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IssueListItem {
  number: number;
  title: string;
  state: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: { login: string };
  labels: Array<{ name: string; color: string }>;
}

interface IssueDetail extends IssueListItem {
  body: string;
  comments: Array<{ author: { login: string }; body: string; createdAt: string }>;
  assignees: Array<{ login: string }>;
}

interface IssueTemplate {
  name: string;
  description: string;
  title: string;
  body: string;
  labels: string[];
  filename: string;
}

// ---------------------------------------------------------------------------
// Shared state (coordinates SidebarPanel and MainPanel across React trees)
// ---------------------------------------------------------------------------

const issueState = {
  selectedIssueNumber: null as number | null,
  creatingNew: false,
  issues: [] as IssueListItem[],
  page: 1,
  hasMore: false,
  loading: false,
  needsRefresh: false,
  stateFilter: "open" as "open" | "closed",
  searchQuery: "",
  listeners: new Set<() => void>(),

  setSelectedIssue(num: number | null): void {
    this.selectedIssueNumber = num;
    this.creatingNew = false;
    this.notify();
  },

  setCreatingNew(val: boolean): void {
    this.creatingNew = val;
    if (val) this.selectedIssueNumber = null;
    this.notify();
  },

  setIssues(issues: IssueListItem[]): void {
    this.issues = issues;
    this.notify();
  },

  appendIssues(issues: IssueListItem[]): void {
    this.issues = [...this.issues, ...issues];
    this.notify();
  },

  setLoading(loading: boolean): void {
    this.loading = loading;
    this.notify();
  },

  setStateFilter(filter: "open" | "closed"): void {
    this.stateFilter = filter;
    this.page = 1;
    this.issues = [];
    this.requestRefresh();
  },

  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.notify();
  },

  // Command-triggered actions (consumed by MainPanel)
  pendingAction: null as "assignAgent" | "toggleState" | "viewInBrowser" | null,

  triggerAction(action: "assignAgent" | "toggleState" | "viewInBrowser"): void {
    if (this.selectedIssueNumber === null) return;
    this.pendingAction = action;
    this.notify();
  },

  consumeAction(): "assignAgent" | "toggleState" | "viewInBrowser" | null {
    const action = this.pendingAction;
    this.pendingAction = null;
    return action;
  },

  requestRefresh(): void {
    this.needsRefresh = true;
    this.notify();
  },

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  },

  notify(): void {
    for (const fn of this.listeners) fn();
  },

  reset(): void {
    this.selectedIssueNumber = null;
    this.creatingNew = false;
    this.issues = [];
    this.page = 1;
    this.hasMore = false;
    this.loading = false;
    this.needsRefresh = false;
    this.pendingAction = null;
    this.stateFilter = "open";
    this.searchQuery = "";
    this.listeners.clear();
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// relativeTime, labelColor, and extractYamlValue imported from ./helpers

// ---------------------------------------------------------------------------
// Markdown renderer (lightweight GFM-subset → JSX, no external deps)
// ---------------------------------------------------------------------------

/** Parse inline markdown (bold, italic, code, links, strikethrough, images). */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Regex order matters: image before link, bold before italic
  const inlineRe =
    /!\[([^\]]*)\]\(([^)]+)\)|(\[([^\]]+)\]\(([^)]+)\))|(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)|(~~[^~]+~~)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const m = match[0];

    if (m.startsWith("![")) {
      // Image: ![alt](src)
      const alt = match[1];
      const src = match[2];
      nodes.push(
        <img key={match.index} src={src} alt={alt} style={{ maxWidth: "100%", borderRadius: "4px", margin: "4px 0" }} />,
      );
    } else if (m.startsWith("[")) {
      // Link: [text](url)
      const linkText = match[4];
      const href = match[5];
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

/** Lightweight Markdown component rendering GFM-subset to JSX. */
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

      // Fenced code block
      if (line.startsWith("```")) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        result.push(
          <pre key={result.length} style={codeBlockStyle}>
            <code>{codeLines.join("\n")}</code>
          </pre>,
        );
        continue;
      }

      // Blank line
      if (!line.trim()) {
        i++;
        continue;
      }

      // Heading
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

      // Horizontal rule
      if (/^[-*_]{3,}\s*$/.test(line)) {
        result.push(
          <hr
            key={result.length}
            style={{ border: "none", borderTop: "1px solid var(--border-primary, #3f3f46)", margin: "12px 0" }}
          />,
        );
        i++;
        continue;
      }

      // Blockquote
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

      // Unordered list
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

      // Ordered list
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

      // Task list (checkbox)
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

      // Regular paragraph — collect consecutive non-blank, non-special lines
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

async function detectRepo(api: PluginAPI): Promise<string | null> {
  try {
    const r = await api.process.exec("gh", [
      "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner",
    ]);
    return r.stdout.trim() || null;
  } catch {
    return null;
  }
}

async function fetchLabels(api: PluginAPI, repo: string): Promise<string[]> {
  try {
    const r = await api.process.exec("gh", [
      "label", "list", "--repo", repo, "--json", "name", "-q", ".[].name", "--limit", "200",
    ]);
    return r.stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

async function loadTemplates(api: PluginAPI): Promise<IssueTemplate[]> {
  try {
    const nodes = await api.files.readTree(".github/ISSUE_TEMPLATE", { depth: 1 });
    const templates: IssueTemplate[] = [];
    for (const node of nodes) {
      if (node.isDirectory) continue;
      if (!/\.(md|yml|yaml)$/.test(node.name)) continue;
      const content = await api.files.readFile(node.path);
      const template = parseTemplate(content, node.name);
      if (template) templates.push(template);
    }
    return templates;
  } catch {
    return [];
  }
}

function parseTemplate(content: string, filename: string): IssueTemplate | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const body = fmMatch[2].trim();
    const name = extractYamlValue(fm, "name") || filename;
    const description = extractYamlValue(fm, "description") || "";
    const title = extractYamlValue(fm, "title") || "";
    const labelsStr = extractYamlValue(fm, "labels");
    const labels = labelsStr ? labelsStr.split(",").map(l => l.trim()).filter(Boolean) : [];
    return { name, description, title, body, labels, filename };
  }
  return {
    name: filename.replace(/\.(md|yml|yaml)$/, "").replace(/[-_]/g, " "),
    description: "",
    title: "",
    body: content,
    labels: [],
    filename,
  };
}

// extractYamlValue imported from ./helpers

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let pluginApi: PluginAPI | null = null;

export function activate(ctx: PluginContext, api: PluginAPI): void {
  pluginApi = api;
  api.logging.info("GitHub Issue Tracker activated");

  ctx.subscriptions.push(
    api.commands.register("github-issues.refresh", () => {
      issueState.requestRefresh();
    }),
  );
  ctx.subscriptions.push(
    api.commands.register("github-issues.create", () => {
      issueState.setCreatingNew(true);
    }),
  );
  ctx.subscriptions.push(
    api.commands.register("github-issues.assignAgent", () => {
      if (!issueState.selectedIssueNumber) {
        api.ui.showError("Select an issue first");
        return;
      }
      issueState.triggerAction("assignAgent");
    }),
  );
  ctx.subscriptions.push(
    api.commands.register("github-issues.toggleState", () => {
      if (!issueState.selectedIssueNumber) {
        api.ui.showError("Select an issue first");
        return;
      }
      issueState.triggerAction("toggleState");
    }),
  );
  ctx.subscriptions.push(
    api.commands.register("github-issues.viewInBrowser", () => {
      if (!issueState.selectedIssueNumber) {
        api.ui.showError("Select an issue first");
        return;
      }
      issueState.triggerAction("viewInBrowser");
    }),
  );
}

export function deactivate(): void {
  pluginApi = null;
  issueState.reset();
}

// ---------------------------------------------------------------------------
// Label Picker (searchable multi-select validated against repo labels)
// ---------------------------------------------------------------------------

function LabelPicker({
  available,
  selected,
  onChange,
}: {
  available: string[];
  selected: string[];
  onChange: (labels: string[]) => void;
}) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => available.filter(l => l.toLowerCase().includes(filter.toLowerCase())),
    [available, filter],
  );

  const toggle = (label: string) => {
    if (selected.includes(label)) {
      onChange(selected.filter(l => l !== label));
    } else {
      onChange([...selected, label]);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          padding: "4px 8px",
          border: "1px solid var(--border-primary, #3f3f46)",
          borderRadius: "6px",
          background: "var(--bg-secondary, #27272a)",
          minHeight: "30px",
          cursor: "text",
          alignItems: "center",
        }}
        onClick={() => setOpen(true)}
      >
        {selected.map(label => (
          <span
            key={label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "1px 6px",
              borderRadius: "10px",
              background: "var(--bg-accent, rgba(139,92,246,0.15))",
              color: "var(--text-primary, #e4e4e7)",
              fontSize: "11px",
            }}
          >
            {label}
            <span
              style={{ cursor: "pointer", opacity: 0.7, lineHeight: 1 }}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                toggle(label);
              }}
            >
              {"\u00d7"}
            </span>
          </span>
        ))}
        <input
          value={filter}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setFilter((e.target as HTMLInputElement).value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length ? "" : "Search labels\u2026"}
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text-primary, #e4e4e7)",
            fontSize: "12px",
            flex: 1,
            minWidth: "60px",
            fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
          }}
        />
      </div>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onClick={() => { setOpen(false); setFilter(""); }}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              maxHeight: "180px",
              overflowY: "auto",
              border: "1px solid var(--border-primary, #3f3f46)",
              borderRadius: "6px",
              background: "var(--bg-primary, #18181b)",
              zIndex: 100,
              marginTop: "2px",
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: "6px 10px", color: "var(--text-secondary, #a1a1aa)", fontSize: "12px" }}>
                {filter ? "No matching labels" : "No labels available"}
              </div>
            ) : (
              filtered.map(label => (
                <div
                  key={label}
                  onClick={() => toggle(label)}
                  style={{
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: "var(--text-primary, #e4e4e7)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: selected.includes(label) ? "var(--bg-accent, rgba(139,92,246,0.15))" : "transparent",
                  }}
                >
                  <span style={{ width: "14px", textAlign: "center", fontSize: "10px" }}>
                    {selected.includes(label) ? "\u2713" : ""}
                  </span>
                  {label}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SendToAgentDialog
// ---------------------------------------------------------------------------

function buildAgentPrompt(issue: IssueDetail): string {
  const labels = issue.labels.map(l => l.name).join(", ");
  return [
    "Review and prepare a fix for the following GitHub issue:",
    "",
    `GitHub Issue #${issue.number}: ${issue.title}`,
    "",
    issue.body || "(no description)",
    "",
    labels ? `Labels: ${labels}` : "",
    `Author: ${issue.author.login}`,
    `State: ${issue.state}`,
  ].filter(Boolean).join("\n");
}

function statusBadgeStyle(status: AgentInfo["status"]): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: "9px",
    padding: "1px 4px",
    borderRadius: "3px",
    display: "inline-block",
  };
  switch (status) {
    case "sleeping":
      return { ...base, background: "rgba(64,200,100,0.15)", color: "#4ade80" };
    case "running":
      return { ...base, background: "rgba(234,179,8,0.15)", color: "#facc15" };
    case "error":
      return { ...base, background: "rgba(239,68,68,0.15)", color: "#f87171" };
    default:
      return base;
  }
}

function SendToAgentDialog({
  api,
  issue,
  onClose,
}: {
  api: PluginAPI;
  issue: IssueDetail;
  onClose: () => void;
}) {
  const [instructions, setInstructions] = useState("");
  // Save as default is ALWAYS unchecked initially, even when defaults are loaded
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [durableAgents, setDurableAgents] = useState<AgentInfo[]>([]);
  const [defaultLoaded, setDefaultLoaded] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const AgentAvatar = api.widgets.AgentAvatar;

  // Load agents and saved default instructions
  useEffect(() => {
    const agents = api.agents.list().filter(a => a.kind === "durable");
    setDurableAgents(agents);

    api.storage.projectLocal.read("defaultAgentInstructions").then(saved => {
      if (typeof saved === "string" && saved.length > 0) {
        setInstructions(saved);
        // NOTE: intentionally NOT setting saveAsDefault=true here.
        // Default is loaded but we don't assume the user wants to overwrite.
      }
      setDefaultLoaded(true);
    }).catch(() => {
      setDefaultLoaded(true);
    });
  }, [api]);

  // Close on overlay click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (overlayRef.current && e.target === overlayRef.current) onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const buildMission = useCallback((): string => {
    const ctx = buildAgentPrompt(issue);
    if (instructions.trim()) return `${ctx}\n\nAdditional instructions:\n${instructions.trim()}`;
    return ctx;
  }, [issue, instructions]);

  const persistDefault = useCallback(async () => {
    if (saveAsDefault && instructions.trim()) {
      await api.storage.projectLocal.write("defaultAgentInstructions", instructions.trim());
    } else if (!saveAsDefault) {
      // Only clear if they explicitly unchecked (which is the default state)
      // Don't delete existing defaults just because the checkbox wasn't checked
    }
  }, [api, saveAsDefault, instructions]);

  const handleConfirm = useCallback(async () => {
    const agent = durableAgents.find(a => a.id === selectedAgentId);
    if (!agent) return;

    if (agent.status === "running") {
      const ok = await api.ui.showConfirm(
        `"${agent.name}" is currently running. Assigning this issue will interrupt its current work. Continue?`,
      );
      if (!ok) return;
      await api.agents.kill(agent.id);
    }

    const mission = buildMission();
    try {
      await persistDefault();
      await api.agents.resume(agent.id, { mission });
      api.ui.showNotice(`Agent "${agent.name}" assigned to issue #${issue.number}`);
    } catch {
      api.ui.showError(`Failed to assign agent to issue #${issue.number}`);
    }
    onClose();
  }, [durableAgents, selectedAgentId, api, issue, buildMission, persistDefault, onClose]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          background: "var(--bg-primary, #18181b)",
          border: "1px solid var(--border-primary, #3f3f46)",
          borderRadius: "8px",
          padding: "16px",
          width: "320px",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Title */}
        <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)", marginBottom: "4px" }}>
          Assign to Agent
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary, #a1a1aa)", marginBottom: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          #{issue.number} {issue.title}
        </div>

        {/* Instructions */}
        <textarea
          value={instructions}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setInstructions((e.target as HTMLTextAreaElement).value)
          }
          placeholder="Additional instructions (optional)"
          rows={3}
          autoFocus
          style={{
            width: "100%",
            padding: "6px 8px",
            fontSize: "12px",
            background: "var(--bg-secondary, #27272a)",
            border: "1px solid var(--border-primary, #3f3f46)",
            borderRadius: "4px",
            color: "var(--text-primary, #e4e4e7)",
            resize: "none",
            fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
            boxSizing: "border-box",
          }}
        />

        {/* Agent list */}
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {durableAgents.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--text-secondary, #a1a1aa)", textAlign: "center", padding: "16px 0" }}>
              No durable agents found
            </div>
          ) : (
            durableAgents.map(agent => {
              const isSelected = selectedAgentId === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(prev => prev === agent.id ? null : agent.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    fontSize: "12px",
                    color: "var(--text-primary, #e4e4e7)",
                    borderRadius: "4px",
                    border: isSelected ? "1px solid var(--text-accent, #8b5cf6)" : "1px solid transparent",
                    background: isSelected ? "rgba(74,108,247,0.1)" : "transparent",
                    cursor: "pointer",
                    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <AgentAvatar agentId={agent.id} size="sm" showStatusRing />
                    <span style={{ fontWeight: 500 }}>{agent.name}</span>
                    <span style={statusBadgeStyle(agent.status)}>{agent.status}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-secondary, #a1a1aa)", marginTop: "2px", paddingLeft: "22px" }}>
                    {agent.status === "running" ? "Will interrupt current work" : "Assign issue to this agent"}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Bottom bar: Save as default + action buttons */}
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid var(--border-primary, #3f3f46)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {defaultLoaded && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={saveAsDefault}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSaveAsDefault((e.target as HTMLInputElement).checked)
                }
              />
              <span style={{ fontSize: "10px", color: "var(--text-secondary, #a1a1aa)" }}>
                Save as default
              </span>
            </label>
          )}
          <div style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
            <button onClick={onClose} style={btnSecondarySmall}>
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedAgentId}
              style={{
                ...btnPrimarySmall,
                opacity: selectedAgentId ? 1 : 0.4,
                cursor: selectedAgentId ? "pointer" : "default",
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarPanel (issue list with search + open/closed toggle)
// ---------------------------------------------------------------------------

export function SidebarPanel({ api }: PanelProps) {
  const [issues, setIssues] = useState<IssueListItem[]>(issueState.issues);
  const [selected, setSelected] = useState<number | null>(issueState.selectedIssueNumber);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(issueState.hasMore);
  const [error, setError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [stateFilter, setStateFilter] = useState(issueState.stateFilter);
  const [searchQuery, setSearchQuery] = useState(issueState.searchQuery);
  const mountedRef = useRef(true);

  // Subscribe to shared state
  useEffect(() => {
    mountedRef.current = true;
    const unsub = issueState.subscribe(() => {
      if (!mountedRef.current) return;
      setIssues([...issueState.issues]);
      setSelected(issueState.selectedIssueNumber);
      setLoading(issueState.loading);
      setHasMore(issueState.hasMore);
      setNeedsRefresh(issueState.needsRefresh);
      setStateFilter(issueState.stateFilter);
      setSearchQuery(issueState.searchQuery);
    });
    return () => { mountedRef.current = false; unsub(); };
  }, []);

  // Fetch issues
  const fetchIssues = useCallback(async (page: number, append: boolean) => {
    issueState.setLoading(true);
    setError(null);
    try {
      const perPage = 30;
      const fetchCount = page * perPage + 1;
      const fields = "number,title,labels,createdAt,updatedAt,author,url,state";
      const r = await api.process.exec("gh", [
        "issue", "list", "--json", fields, "--limit", String(fetchCount),
        "--state", issueState.stateFilter,
      ]);
      if (!mountedRef.current) return;
      if (r.exitCode !== 0 || !r.stdout.trim()) {
        setError("Failed to load issues. Is the gh CLI installed and authenticated?");
        return;
      }
      const all: IssueListItem[] = JSON.parse(r.stdout);
      const start = (page - 1) * perPage;
      const sliced = all.slice(start, start + perPage);
      const hasMoreResult = all.length > start + perPage;
      if (append) {
        issueState.appendIssues(sliced);
      } else {
        issueState.setIssues(sliced);
      }
      issueState.page = page;
      issueState.hasMore = hasMoreResult;
      setHasMore(hasMoreResult);
    } catch {
      if (!mountedRef.current) return;
      setError("Failed to load issues. Is the gh CLI installed and authenticated?");
    } finally {
      issueState.setLoading(false);
    }
  }, [api]);

  // Initial fetch
  useEffect(() => {
    if (issueState.issues.length === 0) fetchIssues(1, false);
  }, [fetchIssues]);

  // React to refresh requests
  useEffect(() => {
    if (needsRefresh) {
      issueState.needsRefresh = false;
      fetchIssues(1, false);
    }
  }, [needsRefresh, fetchIssues]);

  // Filter issues by search query (client-side: title, number, and labels)
  const filteredIssues = useMemo(() => {
    if (!searchQuery.trim()) return issues;
    const q = searchQuery.toLowerCase();
    return issues.filter(
      i =>
        i.title.toLowerCase().includes(q) ||
        `#${i.number}`.includes(q) ||
        i.labels.some(l => l.name.toLowerCase().includes(q)),
    );
  }, [issues, searchQuery]);

  const handleSearchChange = useCallback((val: string) => {
    issueState.setSearchQuery(val);
  }, []);

  const handleStateFilterChange = useCallback((val: "open" | "closed") => {
    issueState.setStateFilter(val);
  }, []);

  // Error state
  if (error) {
    return (
      <div style={{ ...sidebarContainer, justifyContent: "center", alignItems: "center" }}>
        <div style={{ padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--text-error, #f87171)", marginBottom: "8px" }}>
            Could not load issues
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary, #a1a1aa)", marginBottom: "12px" }}>
            {error}
          </div>
          <button onClick={() => fetchIssues(1, false)} style={btnSecondarySmall}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={sidebarContainer}>
      {/* Header */}
      <div style={sidebarHeader}>
        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)" }}>
          Issues
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            onClick={() => fetchIssues(1, false)}
            disabled={loading}
            title="Refresh issues"
            style={sidebarHeaderBtn}
          >
            {"\u21bb"}
          </button>
          <button
            onClick={() => issueState.setCreatingNew(true)}
            title="Create a new issue"
            style={sidebarHeaderBtn}
          >
            + New
          </button>
        </div>
      </div>

      {/* Search + state filter */}
      <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-primary, #3f3f46)", display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleSearchChange((e.target as HTMLInputElement).value)
          }
          placeholder="Filter..."
          style={{
            flex: 1,
            padding: "4px 6px",
            fontSize: "11px",
            border: "1px solid var(--border-primary, #3f3f46)",
            borderRadius: "4px",
            background: "var(--bg-secondary, #27272a)",
            color: "var(--text-primary, #e4e4e7)",
            fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
            outline: "none",
          }}
        />
        <select
          value={stateFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            handleStateFilterChange((e.target as HTMLSelectElement).value as "open" | "closed")
          }
          style={{
            padding: "4px 4px",
            fontSize: "11px",
            border: "1px solid var(--border-primary, #3f3f46)",
            borderRadius: "4px",
            background: "var(--bg-secondary, #27272a)",
            color: "var(--text-primary, #e4e4e7)",
            fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
            cursor: "pointer",
          }}
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Issue list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && issues.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--text-secondary, #a1a1aa)" }}>
            Loading issues{"\u2026"}
          </div>
        ) : filteredIssues.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--text-secondary, #a1a1aa)" }}>
            {searchQuery ? "No matching issues" : `No ${stateFilter} issues`}
          </div>
        ) : (
          <div style={{ padding: "2px 0" }}>
            {filteredIssues.map(issue => (
              <div
                key={issue.number}
                onClick={() => issueState.setSelectedIssue(issue.number)}
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                  background: issue.number === selected ? "var(--bg-active, #3f3f46)" : "transparent",
                }}
              >
                {/* Top row: number + title */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                  <span style={{ fontSize: "10px", color: "var(--text-secondary, #a1a1aa)", flexShrink: 0 }}>
                    #{issue.number}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-primary, #e4e4e7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {issue.title}
                  </span>
                </div>
                {/* Bottom row: labels + time */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", flexWrap: "wrap" }}>
                  {issue.labels.slice(0, 3).map(label => (
                    <span
                      key={label.name}
                      style={{
                        fontSize: "9px",
                        padding: "0 5px",
                        borderRadius: "10px",
                        backgroundColor: `${labelColor(label.color)}22`,
                        color: labelColor(label.color),
                        border: `1px solid ${labelColor(label.color)}44`,
                        flexShrink: 0,
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                  <span style={{ fontSize: "10px", color: "var(--text-secondary, #a1a1aa)", marginLeft: "auto", flexShrink: 0 }}>
                    {relativeTime(issue.updatedAt)}
                  </span>
                </div>
              </div>
            ))}
            {/* Load more */}
            {hasMore && !searchQuery && (
              <div style={{ padding: "8px", textAlign: "center" }}>
                <button
                  onClick={() => fetchIssues(issueState.page + 1, true)}
                  disabled={loading}
                  style={btnSecondarySmall}
                >
                  {loading ? "Loading\u2026" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MainPanel (detail view + create form)
// ---------------------------------------------------------------------------

export function MainPanel({ api }: PanelProps) {
  const [selected, setSelected] = useState<number | null>(issueState.selectedIssueNumber);
  const [creatingNew, setCreatingNew] = useState(issueState.creatingNew);
  const [detail, setDetail] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [detailVersion, setDetailVersion] = useState(0);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newLabels, setNewLabels] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [templates, setTemplates] = useState<IssueTemplate[]>([]);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editLabels, setEditLabels] = useState("");

  // Comment form state
  const [commentBody, setCommentBody] = useState("");

  // Refs for command-triggered actions (stable references for the state subscriber)
  const handleToggleStateRef = useRef<(() => void) | null>(null);
  const handleViewInBrowserRef = useRef<(() => void) | null>(null);

  // Subscribe to shared state
  useEffect(() => {
    const unsub = issueState.subscribe(() => {
      setSelected(issueState.selectedIssueNumber);
      setCreatingNew(issueState.creatingNew);

      // Handle command-triggered actions
      const action = issueState.consumeAction();
      if (action === "assignAgent") setShowAgentDialog(true);
      if (action === "toggleState") handleToggleStateRef.current?.();
      if (action === "viewInBrowser") handleViewInBrowserRef.current?.();
    });
    return unsub;
  }, []);

  // Load templates and labels when entering create mode
  useEffect(() => {
    if (!creatingNew) return;
    Promise.all([loadTemplates(api), fetchLabels(api, "")]).then(([t, l]) => {
      setTemplates(t);
      // If fetchLabels with empty repo failed, try detecting
      if (l.length === 0) {
        detectRepo(api).then(repo => {
          if (repo) fetchLabels(api, repo).then(setAvailableLabels);
        });
      } else {
        setAvailableLabels(l);
      }
    });
    // Also try to detect repo for labels
    detectRepo(api).then(repo => {
      if (repo) fetchLabels(api, repo).then(setAvailableLabels);
    });
  }, [creatingNew, api]);

  // Fetch detail when selection changes
  useEffect(() => {
    if (selected === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setEditing(false);
    const fields = "number,title,state,url,createdAt,updatedAt,author,labels,body,comments,assignees";
    api.process.exec("gh", ["issue", "view", String(selected), "--json", fields])
      .then(r => {
        if (cancelled) return;
        if (r.exitCode === 0 && r.stdout.trim()) {
          setDetail(JSON.parse(r.stdout) as IssueDetail);
        } else {
          setDetail(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setDetail(null); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [selected, api, detailVersion]);

  const refreshDetail = useCallback(() => setDetailVersion(v => v + 1), []);

  // -- Template application ------------------------------------------------

  const applyTemplate = useCallback((templateName: string) => {
    setSelectedTemplate(templateName);
    if (!templateName) return;
    const tpl = templates.find(t => t.name === templateName);
    if (!tpl) return;
    if (tpl.title) setNewTitle(tpl.title);
    setNewBody(tpl.body);
    if (tpl.labels.length > 0) {
      const valid = tpl.labels.filter(l => availableLabels.includes(l));
      setNewLabels(prev => [...new Set([...prev, ...valid])]);
    }
  }, [templates, availableLabels]);

  // -- Edit handlers -------------------------------------------------------

  const startEditing = useCallback(() => {
    if (!detail) return;
    setEditTitle(detail.title);
    setEditBody(detail.body || "");
    setEditLabels(detail.labels.map(l => l.name).join(", "));
    setEditing(true);
  }, [detail]);

  const saveEdit = useCallback(async () => {
    if (!detail) return;
    const args: string[] = ["issue", "edit", String(detail.number)];
    if (editTitle.trim() !== detail.title) args.push("--title", editTitle.trim());
    if (editBody !== (detail.body || "")) args.push("--body", editBody);

    const oldLabels = new Set(detail.labels.map(l => l.name));
    const newLabelSet = new Set(editLabels.split(",").map(l => l.trim()).filter(Boolean));
    for (const l of newLabelSet) { if (!oldLabels.has(l)) args.push("--add-label", l); }
    for (const l of oldLabels) { if (!newLabelSet.has(l)) args.push("--remove-label", l); }

    if (args.length === 3) { setEditing(false); return; }

    const r = await api.process.exec("gh", args, { timeout: 30000 });
    if (r.exitCode === 0) {
      api.ui.showNotice("Issue updated");
      setEditing(false);
      refreshDetail();
      issueState.requestRefresh();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to update issue");
    }
  }, [detail, editTitle, editBody, editLabels, api, refreshDetail]);

  // -- Comment handler -----------------------------------------------------

  const handleAddComment = useCallback(async () => {
    if (!detail || !commentBody.trim()) return;
    const r = await api.process.exec("gh", [
      "issue", "comment", String(detail.number), "--body", commentBody.trim(),
    ], { timeout: 30000 });
    if (r.exitCode === 0) {
      api.ui.showNotice("Comment added");
      setCommentBody("");
      refreshDetail();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to add comment");
    }
  }, [detail, commentBody, api, refreshDetail]);

  // -- Close / Reopen handler ----------------------------------------------

  const handleToggleState = useCallback(async () => {
    if (!detail) return;
    const isOpen = detail.state === "OPEN" || detail.state === "open";
    const cmd = isOpen ? "close" : "reopen";
    const r = await api.process.exec("gh", ["issue", cmd, String(detail.number)], { timeout: 30000 });
    if (r.exitCode === 0) {
      api.ui.showNotice(`Issue ${isOpen ? "closed" : "reopened"}`);
      refreshDetail();
      issueState.requestRefresh();
    } else {
      api.ui.showError(r.stderr.trim() || `Failed to ${cmd} issue`);
    }
  }, [detail, api, refreshDetail]);

  // Keep refs current for command-triggered actions
  handleToggleStateRef.current = handleToggleState;
  handleViewInBrowserRef.current = detail ? () => api.ui.openExternalUrl(detail.url) : null;

  // -- Assignee handlers ---------------------------------------------------

  const handleAddAssignee = useCallback(async () => {
    if (!detail) return;
    const login = await api.ui.showInput("GitHub username to assign:");
    if (!login) return;
    const r = await api.process.exec("gh", [
      "issue", "edit", String(detail.number), "--add-assignee", login.trim(),
    ], { timeout: 30000 });
    if (r.exitCode === 0) {
      api.ui.showNotice(`Assigned ${login.trim()}`);
      refreshDetail();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to add assignee");
    }
  }, [detail, api, refreshDetail]);

  const handleRemoveAssignee = useCallback(async (login: string) => {
    if (!detail) return;
    const r = await api.process.exec("gh", [
      "issue", "edit", String(detail.number), "--remove-assignee", login,
    ], { timeout: 30000 });
    if (r.exitCode === 0) {
      api.ui.showNotice(`Removed ${login}`);
      refreshDetail();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to remove assignee");
    }
  }, [detail, api, refreshDetail]);

  // -- Create form handlers ------------------------------------------------

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const args = ["issue", "create", "--title", newTitle.trim(), "--body", newBody.trim()];
    for (const l of newLabels) args.push("--label", l);

    const r = await api.process.exec("gh", args, { timeout: 30000 });
    setCreating(false);
    if (r.exitCode === 0) {
      api.ui.showNotice(`Issue created: ${r.stdout.trim()}`);
      setNewTitle("");
      setNewBody("");
      setNewLabels([]);
      setSelectedTemplate("");
      issueState.setCreatingNew(false);
      issueState.requestRefresh();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to create issue");
    }
  }, [newTitle, newBody, newLabels, api]);

  const handleCancelCreate = useCallback(() => {
    setNewTitle("");
    setNewBody("");
    setNewLabels([]);
    setSelectedTemplate("");
    issueState.setCreatingNew(false);
  }, []);

  // ── Create form view ────────────────────────────────────────────────

  if (creatingNew) {
    return (
      <div style={mainContainer}>
        <div style={mainHeader}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)" }}>
            New Issue
          </span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Template selector */}
            {templates.length > 0 && (
              <div>
                <label style={formLabel}>Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    applyTemplate((e.target as HTMLSelectElement).value)
                  }
                  style={formInput}
                >
                  <option value="">Blank issue</option>
                  {templates.map(t => (
                    <option key={t.filename} value={t.name}>
                      {t.name}{t.description ? ` \u2014 ${t.description}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Title */}
            <div>
              <label style={formLabel}>Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewTitle((e.target as HTMLInputElement).value)
                }
                placeholder="Issue title"
                style={formInput}
                autoFocus
              />
            </div>

            {/* Body */}
            <div>
              <label style={formLabel}>Body</label>
              <textarea
                value={newBody}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setNewBody((e.target as HTMLTextAreaElement).value)
                }
                placeholder="Describe the issue\u2026"
                rows={10}
                style={{ ...formInput, resize: "vertical" as const }}
              />
            </div>

            {/* Labels (validated picker) */}
            <div>
              <label style={formLabel}>Labels</label>
              {availableLabels.length > 0 ? (
                <LabelPicker
                  available={availableLabels}
                  selected={newLabels}
                  onChange={setNewLabels}
                />
              ) : (
                <input
                  type="text"
                  value={newLabels.join(", ")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewLabels((e.target as HTMLInputElement).value.split(",").map(l => l.trim()).filter(Boolean))
                  }
                  placeholder="bug, enhancement, \u2026"
                  style={formInput}
                />
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={mainFooter}>
          <button onClick={handleCancelCreate} disabled={creating} style={btnSecondarySmall}>
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !newTitle.trim()}
            style={{
              ...btnPrimarySmall,
              opacity: creating || !newTitle.trim() ? 0.5 : 1,
            }}
          >
            {creating ? "Creating\u2026" : "Create Issue"}
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────

  if (selected === null) {
    return (
      <div style={{ ...mainContainer, justifyContent: "center", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--text-secondary, #a1a1aa)" }}>
          Select an issue to view details
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ ...mainContainer, justifyContent: "center", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--text-secondary, #a1a1aa)" }}>
          Loading issue{"\u2026"}
        </span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ ...mainContainer, justifyContent: "center", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--text-secondary, #a1a1aa)" }}>
          Failed to load issue details
        </span>
      </div>
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────

  const isOpen = detail.state === "OPEN" || detail.state === "open";
  const stateBadge: React.CSSProperties = {
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "10px",
    cursor: "pointer",
    border: "1px solid",
    ...(isOpen
      ? { background: "rgba(64,200,100,0.1)", color: "#4ade80", borderColor: "rgba(64,200,100,0.3)" }
      : { background: "rgba(168,85,247,0.1)", color: "#c084fc", borderColor: "rgba(168,85,247,0.3)" }),
  };

  return (
    <div style={{ ...mainContainer, position: "relative" }}>
      {/* Header bar */}
      <div style={{ ...mainHeader, gap: "8px" }}>
        {editing ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              type="text"
              value={editTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEditTitle((e.target as HTMLInputElement).value)
              }
              style={{ ...formInput, fontSize: "13px" }}
            />
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-secondary, #a1a1aa)", flexShrink: 0 }}>
              #{detail.number}
            </span>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {detail.title}
            </span>
          </div>
        )}

        {editing ? (
          <>
            <button onClick={saveEdit} style={{ ...btnPrimarySmall, flexShrink: 0 }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ ...btnSecondarySmall, flexShrink: 0 }}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={startEditing} style={{ ...btnSecondarySmall, flexShrink: 0 }}>Edit</button>
            <button onClick={() => api.ui.openExternalUrl(detail.url)} style={{ ...btnSecondarySmall, flexShrink: 0 }}>
              View in Browser
            </button>
            <button onClick={() => setShowAgentDialog(true)} style={{ ...btnPrimarySmall, flexShrink: 0 }}>
              Assign to Agent
            </button>
          </>
        )}
      </div>

      {/* Metadata row */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", padding: "8px 16px", borderBottom: "1px solid var(--border-primary, #3f3f46)", background: "var(--bg-secondary, #27272a)" }}>
        <button onClick={handleToggleState} style={stateBadge} title={isOpen ? "Close issue" : "Reopen issue"}>
          {detail.state}
        </button>
        <span style={{ fontSize: "10px", color: "var(--text-secondary, #a1a1aa)" }}>
          by {detail.author.login}
        </span>
        <span style={{ fontSize: "10px", color: "var(--text-secondary, #a1a1aa)" }}>
          opened {relativeTime(detail.createdAt)}
        </span>

        {editing ? (
          <input
            type="text"
            value={editLabels}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEditLabels((e.target as HTMLInputElement).value)
            }
            placeholder="Labels (comma separated)"
            style={{ fontSize: "10px", padding: "2px 6px", background: "var(--bg-secondary, #27272a)", border: "1px solid var(--border-primary, #3f3f46)", borderRadius: "4px", color: "var(--text-primary, #e4e4e7)", fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)", outline: "none" }}
          />
        ) : (
          detail.labels.map(label => (
            <span
              key={label.name}
              style={{
                fontSize: "9px",
                padding: "0 5px",
                borderRadius: "10px",
                backgroundColor: `${labelColor(label.color)}22`,
                color: labelColor(label.color),
                border: `1px solid ${labelColor(label.color)}44`,
              }}
            >
              {label.name}
            </span>
          ))
        )}

        {/* Assignees */}
        {detail.assignees.map(a => (
          <span
            key={a.login}
            style={{
              fontSize: "10px",
              padding: "1px 6px",
              background: "var(--bg-active, #3f3f46)",
              color: "var(--text-secondary, #a1a1aa)",
              borderRadius: "4px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {a.login}
            <span
              onClick={() => handleRemoveAssignee(a.login)}
              style={{ cursor: "pointer", opacity: 0.7 }}
              title={`Remove ${a.login}`}
            >
              {"\u00d7"}
            </span>
          </span>
        ))}
        <button onClick={handleAddAssignee} style={{ ...btnSecondarySmall, fontSize: "10px", padding: "1px 6px" }}>
          + Assignee
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Body */}
        {editing ? (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-primary, #3f3f46)" }}>
            <textarea
              value={editBody}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setEditBody((e.target as HTMLTextAreaElement).value)
              }
              placeholder="Issue body\u2026"
              rows={10}
              style={{ ...formInput, resize: "vertical" as const }}
            />
          </div>
        ) : detail.body ? (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-primary, #3f3f46)" }}>
            <Markdown source={detail.body} />
          </div>
        ) : (
          <div style={{ padding: "12px 16px", fontSize: "12px", color: "var(--text-secondary, #a1a1aa)", fontStyle: "italic", borderBottom: "1px solid var(--border-primary, #3f3f46)" }}>
            No description provided.
          </div>
        )}

        {/* Comments */}
        {detail.comments.length > 0 && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-primary, #3f3f46)" }}>
            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)", marginBottom: "12px" }}>
              {detail.comments.length} comment{detail.comments.length === 1 ? "" : "s"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {detail.comments.map((comment, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid var(--border-primary, #3f3f46)",
                    borderRadius: "6px",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", background: "var(--bg-secondary, #27272a)", borderBottom: "1px solid var(--border-primary, #3f3f46)" }}>
                    <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)" }}>
                      {comment.author.login}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--text-secondary, #a1a1aa)" }}>
                      {relativeTime(comment.createdAt)}
                    </span>
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <Markdown source={comment.body} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add comment */}
        <div style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)", marginBottom: "8px" }}>
            Add a comment
          </div>
          <textarea
            value={commentBody}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setCommentBody((e.target as HTMLTextAreaElement).value)
            }
            placeholder="Write a comment\u2026"
            rows={3}
            style={{ ...formInput, resize: "vertical" as const }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              onClick={handleAddComment}
              disabled={!commentBody.trim()}
              style={{
                ...btnPrimarySmall,
                opacity: commentBody.trim() ? 1 : 0.5,
              }}
            >
              Comment
            </button>
          </div>
        </div>
      </div>

      {/* Agent dialog overlay */}
      {showAgentDialog && detail && (
        <SendToAgentDialog
          api={api}
          issue={detail}
          onClose={() => setShowAgentDialog(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const sidebarContainer: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
  background: "var(--bg-primary, #18181b)",
};

const sidebarHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border-primary, #3f3f46)",
};

const sidebarHeaderBtn: React.CSSProperties = {
  padding: "2px 8px",
  fontSize: "12px",
  color: "var(--text-secondary, #a1a1aa)",
  background: "transparent",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
};

const mainContainer: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
  background: "var(--bg-primary, #18181b)",
};

const mainHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "8px 16px",
  borderBottom: "1px solid var(--border-primary, #3f3f46)",
  background: "var(--bg-primary, #18181b)",
  flexShrink: 0,
};

const mainFooter: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  padding: "10px 16px",
  borderTop: "1px solid var(--border-primary, #3f3f46)",
  background: "var(--bg-primary, #18181b)",
  flexShrink: 0,
};

const formLabel: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--text-secondary, #a1a1aa)",
  marginBottom: "4px",
};

const formInput: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border-primary, #3f3f46)",
  background: "var(--bg-secondary, #27272a)",
  color: "var(--text-primary, #e4e4e7)",
  fontSize: "13px",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
  boxSizing: "border-box",
  outline: "none",
};

const btnPrimarySmall: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: "12px",
  fontWeight: 500,
  borderRadius: "4px",
  border: "none",
  background: "var(--text-accent, #8b5cf6)",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
};

const btnSecondarySmall: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: "12px",
  borderRadius: "4px",
  border: "1px solid var(--border-primary, #3f3f46)",
  background: "transparent",
  color: "var(--text-primary, #e4e4e7)",
  cursor: "pointer",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
};
