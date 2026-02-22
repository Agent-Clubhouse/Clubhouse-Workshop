// src/main.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var React = globalThis.React;
var { useState, useEffect, useCallback, useRef, useMemo } = React;
var issueState = {
  selectedIssueNumber: null,
  creatingNew: false,
  issues: [],
  page: 1,
  hasMore: false,
  loading: false,
  needsRefresh: false,
  stateFilter: "open",
  searchQuery: "",
  listeners: /* @__PURE__ */ new Set(),
  setSelectedIssue(num) {
    this.selectedIssueNumber = num;
    this.creatingNew = false;
    this.notify();
  },
  setCreatingNew(val) {
    this.creatingNew = val;
    if (val) this.selectedIssueNumber = null;
    this.notify();
  },
  setIssues(issues) {
    this.issues = issues;
    this.notify();
  },
  appendIssues(issues) {
    this.issues = [...this.issues, ...issues];
    this.notify();
  },
  setLoading(loading) {
    this.loading = loading;
    this.notify();
  },
  setStateFilter(filter) {
    this.stateFilter = filter;
    this.page = 1;
    this.issues = [];
    this.requestRefresh();
  },
  setSearchQuery(query) {
    this.searchQuery = query;
    this.notify();
  },
  // Command-triggered actions (consumed by MainPanel)
  pendingAction: null,
  triggerAction(action) {
    if (this.selectedIssueNumber === null) return;
    this.pendingAction = action;
    this.notify();
  },
  consumeAction() {
    const action = this.pendingAction;
    this.pendingAction = null;
    return action;
  },
  requestRefresh() {
    this.needsRefresh = true;
    this.notify();
  },
  subscribe(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  },
  notify() {
    for (const fn of this.listeners) fn();
  },
  reset() {
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
  }
};
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
  if (!hex) return "#888";
  return hex.startsWith("#") ? hex : `#${hex}`;
}
async function detectRepo(api) {
  try {
    const r = await api.process.exec("gh", [
      "repo",
      "view",
      "--json",
      "nameWithOwner",
      "-q",
      ".nameWithOwner"
    ]);
    return r.stdout.trim() || null;
  } catch {
    return null;
  }
}
async function fetchLabels(api, repo) {
  try {
    const r = await api.process.exec("gh", [
      "label",
      "list",
      "--repo",
      repo,
      "--json",
      "name",
      "-q",
      ".[].name",
      "--limit",
      "200"
    ]);
    return r.stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
async function loadTemplates(api) {
  try {
    const nodes = await api.files.readTree(".github/ISSUE_TEMPLATE", { depth: 1 });
    const templates = [];
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
function parseTemplate(content, filename) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const body = fmMatch[2].trim();
    const name = extractYamlValue(fm, "name") || filename;
    const description = extractYamlValue(fm, "description") || "";
    const title = extractYamlValue(fm, "title") || "";
    const labelsStr = extractYamlValue(fm, "labels");
    const labels = labelsStr ? labelsStr.split(",").map((l) => l.trim()).filter(Boolean) : [];
    return { name, description, title, body, labels, filename };
  }
  return {
    name: filename.replace(/\.(md|yml|yaml)$/, "").replace(/[-_]/g, " "),
    description: "",
    title: "",
    body: content,
    labels: [],
    filename
  };
}
function extractYamlValue(yaml, key) {
  const match = yaml.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m"));
  return match ? match[1] : null;
}
var pluginApi = null;
function activate(ctx, api) {
  pluginApi = api;
  api.logging.info("GitHub Issue Tracker activated");
  ctx.subscriptions.push(
    api.commands.register("github-issues.refresh", () => {
      issueState.requestRefresh();
    })
  );
  ctx.subscriptions.push(
    api.commands.register("github-issues.create", () => {
      issueState.setCreatingNew(true);
    })
  );
  ctx.subscriptions.push(
    api.commands.register("github-issues.assignAgent", () => {
      if (!issueState.selectedIssueNumber) {
        api.ui.showError("Select an issue first");
        return;
      }
      issueState.triggerAction("assignAgent");
    })
  );
  ctx.subscriptions.push(
    api.commands.register("github-issues.toggleState", () => {
      if (!issueState.selectedIssueNumber) {
        api.ui.showError("Select an issue first");
        return;
      }
      issueState.triggerAction("toggleState");
    })
  );
  ctx.subscriptions.push(
    api.commands.register("github-issues.viewInBrowser", () => {
      if (!issueState.selectedIssueNumber) {
        api.ui.showError("Select an issue first");
        return;
      }
      issueState.triggerAction("viewInBrowser");
    })
  );
}
function deactivate() {
  pluginApi = null;
  issueState.reset();
}
function LabelPicker({
  available,
  selected,
  onChange
}) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(
    () => available.filter((l) => l.toLowerCase().includes(filter.toLowerCase())),
    [available, filter]
  );
  const toggle = (label) => {
    if (selected.includes(label)) {
      onChange(selected.filter((l) => l !== label));
    } else {
      onChange([...selected, label]);
    }
  };
  return /* @__PURE__ */ jsxs("div", { style: { position: "relative" }, children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          padding: "4px 8px",
          border: "1px solid var(--border-color, #333)",
          borderRadius: "6px",
          background: "var(--input-bg, #1a1a2e)",
          minHeight: "30px",
          cursor: "text",
          alignItems: "center"
        },
        onClick: () => setOpen(true),
        children: [
          selected.map((label) => /* @__PURE__ */ jsxs(
            "span",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "1px 6px",
                borderRadius: "10px",
                background: "var(--accent-bg, #2a2a4a)",
                color: "var(--text-primary, #e0e0e0)",
                fontSize: "11px"
              },
              children: [
                label,
                /* @__PURE__ */ jsx(
                  "span",
                  {
                    style: { cursor: "pointer", opacity: 0.7, lineHeight: 1 },
                    onClick: (e) => {
                      e.stopPropagation();
                      toggle(label);
                    },
                    children: "\xD7"
                  }
                )
              ]
            },
            label
          )),
          /* @__PURE__ */ jsx(
            "input",
            {
              value: filter,
              onChange: (e) => {
                setFilter(e.target.value);
                setOpen(true);
              },
              onFocus: () => setOpen(true),
              placeholder: selected.length ? "" : "Search labels\u2026",
              style: {
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--text-primary, #e0e0e0)",
                fontSize: "12px",
                flex: 1,
                minWidth: "60px",
                fontFamily: "var(--font-family)"
              }
            }
          )
        ]
      }
    ),
    open && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          style: { position: "fixed", inset: 0, zIndex: 99 },
          onClick: () => {
            setOpen(false);
            setFilter("");
          }
        }
      ),
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: "180px",
            overflowY: "auto",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "6px",
            background: "var(--dropdown-bg, #1e1e3a)",
            zIndex: 100,
            marginTop: "2px"
          },
          children: filtered.length === 0 ? /* @__PURE__ */ jsx("div", { style: { padding: "6px 10px", color: "var(--text-secondary, #888)", fontSize: "12px" }, children: filter ? "No matching labels" : "No labels available" }) : filtered.map((label) => /* @__PURE__ */ jsxs(
            "div",
            {
              onClick: () => toggle(label),
              style: {
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: "12px",
                color: "var(--text-primary, #e0e0e0)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: selected.includes(label) ? "var(--accent-bg, #2a2a4a)" : "transparent"
              },
              children: [
                /* @__PURE__ */ jsx("span", { style: { width: "14px", textAlign: "center", fontSize: "10px" }, children: selected.includes(label) ? "\u2713" : "" }),
                label
              ]
            },
            label
          ))
        }
      )
    ] })
  ] });
}
function buildAgentPrompt(issue) {
  const labels = issue.labels.map((l) => l.name).join(", ");
  return [
    "Review and prepare a fix for the following GitHub issue:",
    "",
    `GitHub Issue #${issue.number}: ${issue.title}`,
    "",
    issue.body || "(no description)",
    "",
    labels ? `Labels: ${labels}` : "",
    `Author: ${issue.author.login}`,
    `State: ${issue.state}`
  ].filter(Boolean).join("\n");
}
function statusBadgeStyle(status) {
  const base = {
    fontSize: "9px",
    padding: "1px 4px",
    borderRadius: "3px",
    display: "inline-block"
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
  onClose
}) {
  const [instructions, setInstructions] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [durableAgents, setDurableAgents] = useState([]);
  const [defaultLoaded, setDefaultLoaded] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const overlayRef = useRef(null);
  const AgentAvatar = api.widgets.AgentAvatar;
  useEffect(() => {
    const agents = api.agents.list().filter((a) => a.kind === "durable");
    setDurableAgents(agents);
    api.storage.projectLocal.read("defaultAgentInstructions").then((saved) => {
      if (typeof saved === "string" && saved.length > 0) {
        setInstructions(saved);
      }
      setDefaultLoaded(true);
    }).catch(() => {
      setDefaultLoaded(true);
    });
  }, [api]);
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (overlayRef.current && e.target === overlayRef.current) onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  const buildMission = useCallback(() => {
    const ctx = buildAgentPrompt(issue);
    if (instructions.trim()) return `${ctx}

Additional instructions:
${instructions.trim()}`;
    return ctx;
  }, [issue, instructions]);
  const persistDefault = useCallback(async () => {
    if (saveAsDefault && instructions.trim()) {
      await api.storage.projectLocal.write("defaultAgentInstructions", instructions.trim());
    } else if (!saveAsDefault) {
    }
  }, [api, saveAsDefault, instructions]);
  const handleConfirm = useCallback(async () => {
    const agent = durableAgents.find((a) => a.id === selectedAgentId);
    if (!agent) return;
    if (agent.status === "running") {
      const ok = await api.ui.showConfirm(
        `"${agent.name}" is currently running. Assigning this issue will interrupt its current work. Continue?`
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
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref: overlayRef,
      style: {
        position: "absolute",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)"
      },
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            background: "var(--panel-bg, #1e1e2e)",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "8px",
            padding: "16px",
            width: "320px",
            maxHeight: "80vh",
            overflow: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
          },
          children: [
            /* @__PURE__ */ jsx("div", { style: { fontSize: "14px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)", marginBottom: "4px" }, children: "Assign to Agent" }),
            /* @__PURE__ */ jsxs("div", { style: { fontSize: "10px", color: "var(--text-secondary, #888)", marginBottom: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
              "#",
              issue.number,
              " ",
              issue.title
            ] }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                value: instructions,
                onChange: (e) => setInstructions(e.target.value),
                placeholder: "Additional instructions (optional)",
                rows: 3,
                autoFocus: true,
                style: {
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: "12px",
                  background: "var(--input-bg, #1a1a2e)",
                  border: "1px solid var(--border-color, #333)",
                  borderRadius: "4px",
                  color: "var(--text-primary, #e0e0e0)",
                  resize: "none",
                  fontFamily: "var(--font-family)",
                  boxSizing: "border-box"
                }
              }
            ),
            /* @__PURE__ */ jsx("div", { style: { marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }, children: durableAgents.length === 0 ? /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", color: "var(--text-secondary, #888)", textAlign: "center", padding: "16px 0" }, children: "No durable agents found" }) : durableAgents.map((agent) => {
              const isSelected = selectedAgentId === agent.id;
              return /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => setSelectedAgentId((prev) => prev === agent.id ? null : agent.id),
                  style: {
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    fontSize: "12px",
                    color: "var(--text-primary, #e0e0e0)",
                    borderRadius: "4px",
                    border: isSelected ? "1px solid var(--accent-color, #4a6cf7)" : "1px solid transparent",
                    background: isSelected ? "rgba(74,108,247,0.1)" : "transparent",
                    cursor: "pointer",
                    fontFamily: "var(--font-family)"
                  },
                  children: [
                    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "6px" }, children: [
                      /* @__PURE__ */ jsx(AgentAvatar, { agentId: agent.id, size: "sm", showStatusRing: true }),
                      /* @__PURE__ */ jsx("span", { style: { fontWeight: 500 }, children: agent.name }),
                      /* @__PURE__ */ jsx("span", { style: statusBadgeStyle(agent.status), children: agent.status })
                    ] }),
                    /* @__PURE__ */ jsx("div", { style: { fontSize: "10px", color: "var(--text-secondary, #888)", marginTop: "2px", paddingLeft: "22px" }, children: agent.status === "running" ? "Will interrupt current work" : "Assign issue to this agent" })
                  ]
                },
                agent.id
              );
            }) }),
            /* @__PURE__ */ jsxs(
              "div",
              {
                style: {
                  marginTop: "12px",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--border-color, #333)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                },
                children: [
                  defaultLoaded && /* @__PURE__ */ jsxs(
                    "label",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                        userSelect: "none"
                      },
                      children: [
                        /* @__PURE__ */ jsx(
                          "input",
                          {
                            type: "checkbox",
                            checked: saveAsDefault,
                            onChange: (e) => setSaveAsDefault(e.target.checked)
                          }
                        ),
                        /* @__PURE__ */ jsx("span", { style: { fontSize: "10px", color: "var(--text-secondary, #888)" }, children: "Save as default" })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "6px", marginLeft: "auto" }, children: [
                    /* @__PURE__ */ jsx("button", { onClick: onClose, style: btnSecondarySmall, children: "Cancel" }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: handleConfirm,
                        disabled: !selectedAgentId,
                        style: {
                          ...btnPrimarySmall,
                          opacity: selectedAgentId ? 1 : 0.4,
                          cursor: selectedAgentId ? "pointer" : "default"
                        },
                        children: "Confirm"
                      }
                    )
                  ] })
                ]
              }
            )
          ]
        }
      )
    }
  );
}
function SidebarPanel({ api }) {
  const [issues, setIssues] = useState(issueState.issues);
  const [selected, setSelected] = useState(issueState.selectedIssueNumber);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(issueState.hasMore);
  const [error, setError] = useState(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [stateFilter, setStateFilter] = useState(issueState.stateFilter);
  const [searchQuery, setSearchQuery] = useState(issueState.searchQuery);
  const mountedRef = useRef(true);
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
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, []);
  const fetchIssues = useCallback(async (page, append) => {
    issueState.setLoading(true);
    setError(null);
    try {
      const perPage = 30;
      const fetchCount = page * perPage + 1;
      const fields = "number,title,labels,createdAt,updatedAt,author,url,state";
      const r = await api.process.exec("gh", [
        "issue",
        "list",
        "--json",
        fields,
        "--limit",
        String(fetchCount),
        "--state",
        issueState.stateFilter
      ]);
      if (!mountedRef.current) return;
      if (r.exitCode !== 0 || !r.stdout.trim()) {
        setError("Failed to load issues. Is the gh CLI installed and authenticated?");
        return;
      }
      const all = JSON.parse(r.stdout);
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
  useEffect(() => {
    if (issueState.issues.length === 0) fetchIssues(1, false);
  }, [fetchIssues]);
  useEffect(() => {
    if (needsRefresh) {
      issueState.needsRefresh = false;
      fetchIssues(1, false);
    }
  }, [needsRefresh, fetchIssues]);
  const filteredIssues = useMemo(() => {
    if (!searchQuery.trim()) return issues;
    const q = searchQuery.toLowerCase();
    return issues.filter(
      (i) => i.title.toLowerCase().includes(q) || `#${i.number}`.includes(q)
    );
  }, [issues, searchQuery]);
  const handleSearchChange = useCallback((val) => {
    issueState.setSearchQuery(val);
  }, []);
  const handleStateFilterChange = useCallback((val) => {
    issueState.setStateFilter(val);
  }, []);
  if (error) {
    return /* @__PURE__ */ jsx("div", { style: { ...sidebarContainer, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ jsxs("div", { style: { padding: "16px", textAlign: "center" }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", color: "var(--text-error, #f87171)", marginBottom: "8px" }, children: "Could not load issues" }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: "11px", color: "var(--text-secondary, #888)", marginBottom: "12px" }, children: error }),
      /* @__PURE__ */ jsx("button", { onClick: () => fetchIssues(1, false), style: btnSecondarySmall, children: "Retry" })
    ] }) });
  }
  return /* @__PURE__ */ jsxs("div", { style: sidebarContainer, children: [
    /* @__PURE__ */ jsxs("div", { style: sidebarHeader, children: [
      /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)" }, children: "Issues" }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "4px" }, children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => fetchIssues(1, false),
            disabled: loading,
            title: "Refresh issues",
            style: sidebarHeaderBtn,
            children: "\u21BB"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => issueState.setCreatingNew(true),
            title: "Create a new issue",
            style: sidebarHeaderBtn,
            children: "+ New"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { padding: "6px 8px", borderBottom: "1px solid var(--border-color, #222)", display: "flex", gap: "6px", alignItems: "center" }, children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: searchQuery,
          onChange: (e) => handleSearchChange(e.target.value),
          placeholder: "Filter\\u2026",
          style: {
            flex: 1,
            padding: "4px 6px",
            fontSize: "11px",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "4px",
            background: "var(--input-bg, #1a1a2e)",
            color: "var(--text-primary, #e0e0e0)",
            fontFamily: "var(--font-family)",
            outline: "none"
          }
        }
      ),
      /* @__PURE__ */ jsxs(
        "select",
        {
          value: stateFilter,
          onChange: (e) => handleStateFilterChange(e.target.value),
          style: {
            padding: "4px 4px",
            fontSize: "11px",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "4px",
            background: "var(--input-bg, #1a1a2e)",
            color: "var(--text-primary, #e0e0e0)",
            fontFamily: "var(--font-family)",
            cursor: "pointer"
          },
          children: [
            /* @__PURE__ */ jsx("option", { value: "open", children: "Open" }),
            /* @__PURE__ */ jsx("option", { value: "closed", children: "Closed" })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { style: { flex: 1, overflowY: "auto" }, children: loading && issues.length === 0 ? /* @__PURE__ */ jsxs("div", { style: { padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--text-secondary, #888)" }, children: [
      "Loading issues",
      "\u2026"
    ] }) : filteredIssues.length === 0 ? /* @__PURE__ */ jsx("div", { style: { padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--text-secondary, #888)" }, children: searchQuery ? "No matching issues" : `No ${stateFilter} issues` }) : /* @__PURE__ */ jsxs("div", { style: { padding: "2px 0" }, children: [
      filteredIssues.map((issue) => /* @__PURE__ */ jsxs(
        "div",
        {
          onClick: () => issueState.setSelectedIssue(issue.number),
          style: {
            padding: "8px 10px",
            cursor: "pointer",
            background: issue.number === selected ? "var(--item-active-bg, #2a2a4a)" : "transparent"
          },
          children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }, children: [
              /* @__PURE__ */ jsxs("span", { style: { fontSize: "10px", color: "var(--text-secondary, #888)", flexShrink: 0 }, children: [
                "#",
                issue.number
              ] }),
              /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", color: "var(--text-primary, #e0e0e0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: issue.title })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", flexWrap: "wrap" }, children: [
              issue.labels.slice(0, 3).map((label) => /* @__PURE__ */ jsx(
                "span",
                {
                  style: {
                    fontSize: "9px",
                    padding: "0 5px",
                    borderRadius: "10px",
                    backgroundColor: `${labelColor(label.color)}22`,
                    color: labelColor(label.color),
                    border: `1px solid ${labelColor(label.color)}44`,
                    flexShrink: 0
                  },
                  children: label.name
                },
                label.name
              )),
              /* @__PURE__ */ jsx("span", { style: { fontSize: "10px", color: "var(--text-secondary, #888)", marginLeft: "auto", flexShrink: 0 }, children: relativeTime(issue.updatedAt) })
            ] })
          ]
        },
        issue.number
      )),
      hasMore && !searchQuery && /* @__PURE__ */ jsx("div", { style: { padding: "8px", textAlign: "center" }, children: /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => fetchIssues(issueState.page + 1, true),
          disabled: loading,
          style: btnSecondarySmall,
          children: loading ? "Loading\u2026" : "Load more"
        }
      ) })
    ] }) })
  ] });
}
function MainPanel({ api }) {
  const [selected, setSelected] = useState(issueState.selectedIssueNumber);
  const [creatingNew, setCreatingNew] = useState(issueState.creatingNew);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [detailVersion, setDetailVersion] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newLabels, setNewLabels] = useState([]);
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [availableLabels, setAvailableLabels] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editLabels, setEditLabels] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const handleToggleStateRef = useRef(null);
  const handleViewInBrowserRef = useRef(null);
  useEffect(() => {
    const unsub = issueState.subscribe(() => {
      setSelected(issueState.selectedIssueNumber);
      setCreatingNew(issueState.creatingNew);
      const action = issueState.consumeAction();
      if (action === "assignAgent") setShowAgentDialog(true);
      if (action === "toggleState") handleToggleStateRef.current?.();
      if (action === "viewInBrowser") handleViewInBrowserRef.current?.();
    });
    return unsub;
  }, []);
  useEffect(() => {
    if (!creatingNew) return;
    Promise.all([loadTemplates(api), fetchLabels(api, "")]).then(([t, l]) => {
      setTemplates(t);
      if (l.length === 0) {
        detectRepo(api).then((repo) => {
          if (repo) fetchLabels(api, repo).then(setAvailableLabels);
        });
      } else {
        setAvailableLabels(l);
      }
    });
    detectRepo(api).then((repo) => {
      if (repo) fetchLabels(api, repo).then(setAvailableLabels);
    });
  }, [creatingNew, api]);
  useEffect(() => {
    if (selected === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setEditing(false);
    const fields = "number,title,state,url,createdAt,updatedAt,author,labels,body,comments,assignees";
    api.process.exec("gh", ["issue", "view", String(selected), "--json", fields]).then((r) => {
      if (cancelled) return;
      if (r.exitCode === 0 && r.stdout.trim()) {
        setDetail(JSON.parse(r.stdout));
      } else {
        setDetail(null);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setDetail(null);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selected, api, detailVersion]);
  const refreshDetail = useCallback(() => setDetailVersion((v) => v + 1), []);
  const applyTemplate = useCallback((templateName) => {
    setSelectedTemplate(templateName);
    if (!templateName) return;
    const tpl = templates.find((t) => t.name === templateName);
    if (!tpl) return;
    if (tpl.title) setNewTitle(tpl.title);
    setNewBody(tpl.body);
    if (tpl.labels.length > 0) {
      const valid = tpl.labels.filter((l) => availableLabels.includes(l));
      setNewLabels((prev) => [.../* @__PURE__ */ new Set([...prev, ...valid])]);
    }
  }, [templates, availableLabels]);
  const startEditing = useCallback(() => {
    if (!detail) return;
    setEditTitle(detail.title);
    setEditBody(detail.body || "");
    setEditLabels(detail.labels.map((l) => l.name).join(", "));
    setEditing(true);
  }, [detail]);
  const saveEdit = useCallback(async () => {
    if (!detail) return;
    const args = ["issue", "edit", String(detail.number)];
    if (editTitle.trim() !== detail.title) args.push("--title", editTitle.trim());
    if (editBody !== (detail.body || "")) args.push("--body", editBody);
    const oldLabels = new Set(detail.labels.map((l) => l.name));
    const newLabelSet = new Set(editLabels.split(",").map((l) => l.trim()).filter(Boolean));
    for (const l of newLabelSet) {
      if (!oldLabels.has(l)) args.push("--add-label", l);
    }
    for (const l of oldLabels) {
      if (!newLabelSet.has(l)) args.push("--remove-label", l);
    }
    if (args.length === 3) {
      setEditing(false);
      return;
    }
    const r = await api.process.exec("gh", args, { timeout: 3e4 });
    if (r.exitCode === 0) {
      api.ui.showNotice("Issue updated");
      setEditing(false);
      refreshDetail();
      issueState.requestRefresh();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to update issue");
    }
  }, [detail, editTitle, editBody, editLabels, api, refreshDetail]);
  const handleAddComment = useCallback(async () => {
    if (!detail || !commentBody.trim()) return;
    const r = await api.process.exec("gh", [
      "issue",
      "comment",
      String(detail.number),
      "--body",
      commentBody.trim()
    ], { timeout: 3e4 });
    if (r.exitCode === 0) {
      api.ui.showNotice("Comment added");
      setCommentBody("");
      refreshDetail();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to add comment");
    }
  }, [detail, commentBody, api, refreshDetail]);
  const handleToggleState = useCallback(async () => {
    if (!detail) return;
    const isOpen2 = detail.state === "OPEN" || detail.state === "open";
    const cmd = isOpen2 ? "close" : "reopen";
    const r = await api.process.exec("gh", ["issue", cmd, String(detail.number)], { timeout: 3e4 });
    if (r.exitCode === 0) {
      api.ui.showNotice(`Issue ${isOpen2 ? "closed" : "reopened"}`);
      refreshDetail();
      issueState.requestRefresh();
    } else {
      api.ui.showError(r.stderr.trim() || `Failed to ${cmd} issue`);
    }
  }, [detail, api, refreshDetail]);
  handleToggleStateRef.current = handleToggleState;
  handleViewInBrowserRef.current = detail ? () => api.ui.openExternalUrl(detail.url) : null;
  const handleAddAssignee = useCallback(async () => {
    if (!detail) return;
    const login = await api.ui.showInput("GitHub username to assign:");
    if (!login) return;
    const r = await api.process.exec("gh", [
      "issue",
      "edit",
      String(detail.number),
      "--add-assignee",
      login.trim()
    ], { timeout: 3e4 });
    if (r.exitCode === 0) {
      api.ui.showNotice(`Assigned ${login.trim()}`);
      refreshDetail();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to add assignee");
    }
  }, [detail, api, refreshDetail]);
  const handleRemoveAssignee = useCallback(async (login) => {
    if (!detail) return;
    const r = await api.process.exec("gh", [
      "issue",
      "edit",
      String(detail.number),
      "--remove-assignee",
      login
    ], { timeout: 3e4 });
    if (r.exitCode === 0) {
      api.ui.showNotice(`Removed ${login}`);
      refreshDetail();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to remove assignee");
    }
  }, [detail, api, refreshDetail]);
  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const args = ["issue", "create", "--title", newTitle.trim(), "--body", newBody.trim()];
    for (const l of newLabels) args.push("--label", l);
    const r = await api.process.exec("gh", args, { timeout: 3e4 });
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
  if (creatingNew) {
    return /* @__PURE__ */ jsxs("div", { style: mainContainer, children: [
      /* @__PURE__ */ jsx("div", { style: mainHeader, children: /* @__PURE__ */ jsx("span", { style: { fontSize: "13px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)" }, children: "New Issue" }) }),
      /* @__PURE__ */ jsx("div", { style: { flex: 1, overflowY: "auto", padding: "16px" }, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "14px" }, children: [
        templates.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: formLabel, children: "Template" }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: selectedTemplate,
              onChange: (e) => applyTemplate(e.target.value),
              style: formInput,
              children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "Blank issue" }),
                templates.map((t) => /* @__PURE__ */ jsxs("option", { value: t.name, children: [
                  t.name,
                  t.description ? ` \u2014 ${t.description}` : ""
                ] }, t.filename))
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: formLabel, children: "Title" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: newTitle,
              onChange: (e) => setNewTitle(e.target.value),
              placeholder: "Issue title",
              style: formInput,
              autoFocus: true
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: formLabel, children: "Body" }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              value: newBody,
              onChange: (e) => setNewBody(e.target.value),
              placeholder: "Describe the issue\\u2026",
              rows: 10,
              style: { ...formInput, resize: "vertical" }
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: formLabel, children: "Labels" }),
          availableLabels.length > 0 ? /* @__PURE__ */ jsx(
            LabelPicker,
            {
              available: availableLabels,
              selected: newLabels,
              onChange: setNewLabels
            }
          ) : /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: newLabels.join(", "),
              onChange: (e) => setNewLabels(e.target.value.split(",").map((l) => l.trim()).filter(Boolean)),
              placeholder: "bug, enhancement, \\u2026",
              style: formInput
            }
          )
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { style: mainFooter, children: [
        /* @__PURE__ */ jsx("button", { onClick: handleCancelCreate, disabled: creating, style: btnSecondarySmall, children: "Cancel" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleCreate,
            disabled: creating || !newTitle.trim(),
            style: {
              ...btnPrimarySmall,
              opacity: creating || !newTitle.trim() ? 0.5 : 1
            },
            children: creating ? "Creating\u2026" : "Create Issue"
          }
        )
      ] })
    ] });
  }
  if (selected === null) {
    return /* @__PURE__ */ jsx("div", { style: { ...mainContainer, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", color: "var(--text-secondary, #888)" }, children: "Select an issue to view details" }) });
  }
  if (loading) {
    return /* @__PURE__ */ jsx("div", { style: { ...mainContainer, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ jsxs("span", { style: { fontSize: "12px", color: "var(--text-secondary, #888)" }, children: [
      "Loading issue",
      "\u2026"
    ] }) });
  }
  if (!detail) {
    return /* @__PURE__ */ jsx("div", { style: { ...mainContainer, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", color: "var(--text-secondary, #888)" }, children: "Failed to load issue details" }) });
  }
  const isOpen = detail.state === "OPEN" || detail.state === "open";
  const stateBadge = {
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "10px",
    cursor: "pointer",
    border: "1px solid",
    ...isOpen ? { background: "rgba(64,200,100,0.1)", color: "#4ade80", borderColor: "rgba(64,200,100,0.3)" } : { background: "rgba(168,85,247,0.1)", color: "#c084fc", borderColor: "rgba(168,85,247,0.3)" }
  };
  return /* @__PURE__ */ jsxs("div", { style: { ...mainContainer, position: "relative" }, children: [
    /* @__PURE__ */ jsxs("div", { style: { ...mainHeader, gap: "8px" }, children: [
      editing ? /* @__PURE__ */ jsx("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: editTitle,
          onChange: (e) => setEditTitle(e.target.value),
          style: { ...formInput, fontSize: "13px" }
        }
      ) }) : /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "6px" }, children: [
        /* @__PURE__ */ jsxs("span", { style: { fontSize: "12px", color: "var(--text-secondary, #888)", flexShrink: 0 }, children: [
          "#",
          detail.number
        ] }),
        /* @__PURE__ */ jsx("span", { style: { fontSize: "13px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: detail.title })
      ] }),
      editing ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("button", { onClick: saveEdit, style: { ...btnPrimarySmall, flexShrink: 0 }, children: "Save" }),
        /* @__PURE__ */ jsx("button", { onClick: () => setEditing(false), style: { ...btnSecondarySmall, flexShrink: 0 }, children: "Cancel" })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("button", { onClick: startEditing, style: { ...btnSecondarySmall, flexShrink: 0 }, children: "Edit" }),
        /* @__PURE__ */ jsx("button", { onClick: () => api.ui.openExternalUrl(detail.url), style: { ...btnSecondarySmall, flexShrink: 0 }, children: "View in Browser" }),
        /* @__PURE__ */ jsx("button", { onClick: () => setShowAgentDialog(true), style: { ...btnPrimarySmall, flexShrink: 0 }, children: "Assign to Agent" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", padding: "8px 16px", borderBottom: "1px solid var(--border-color, #222)", background: "var(--panel-bg-alt, rgba(0,0,0,0.15))" }, children: [
      /* @__PURE__ */ jsx("button", { onClick: handleToggleState, style: stateBadge, title: isOpen ? "Close issue" : "Reopen issue", children: detail.state }),
      /* @__PURE__ */ jsxs("span", { style: { fontSize: "10px", color: "var(--text-secondary, #888)" }, children: [
        "by ",
        detail.author.login
      ] }),
      /* @__PURE__ */ jsxs("span", { style: { fontSize: "10px", color: "var(--text-secondary, #888)" }, children: [
        "opened ",
        relativeTime(detail.createdAt)
      ] }),
      editing ? /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: editLabels,
          onChange: (e) => setEditLabels(e.target.value),
          placeholder: "Labels (comma separated)",
          style: { fontSize: "10px", padding: "2px 6px", background: "var(--input-bg, #1a1a2e)", border: "1px solid var(--border-color, #333)", borderRadius: "4px", color: "var(--text-primary, #e0e0e0)", fontFamily: "var(--font-family)", outline: "none" }
        }
      ) : detail.labels.map((label) => /* @__PURE__ */ jsx(
        "span",
        {
          style: {
            fontSize: "9px",
            padding: "0 5px",
            borderRadius: "10px",
            backgroundColor: `${labelColor(label.color)}22`,
            color: labelColor(label.color),
            border: `1px solid ${labelColor(label.color)}44`
          },
          children: label.name
        },
        label.name
      )),
      detail.assignees.map((a) => /* @__PURE__ */ jsxs(
        "span",
        {
          style: {
            fontSize: "10px",
            padding: "1px 6px",
            background: "var(--item-active-bg, #2a2a4a)",
            color: "var(--text-secondary, #aaa)",
            borderRadius: "4px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px"
          },
          children: [
            a.login,
            /* @__PURE__ */ jsx(
              "span",
              {
                onClick: () => handleRemoveAssignee(a.login),
                style: { cursor: "pointer", opacity: 0.7 },
                title: `Remove ${a.login}`,
                children: "\xD7"
              }
            )
          ]
        },
        a.login
      )),
      /* @__PURE__ */ jsx("button", { onClick: handleAddAssignee, style: { ...btnSecondarySmall, fontSize: "10px", padding: "1px 6px" }, children: "+ Assignee" })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, overflowY: "auto" }, children: [
      editing ? /* @__PURE__ */ jsx("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border-color, #222)" }, children: /* @__PURE__ */ jsx(
        "textarea",
        {
          value: editBody,
          onChange: (e) => setEditBody(e.target.value),
          placeholder: "Issue body\\u2026",
          rows: 10,
          style: { ...formInput, resize: "vertical" }
        }
      ) }) : detail.body ? /* @__PURE__ */ jsx("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border-color, #222)" }, children: /* @__PURE__ */ jsx("pre", { style: preStyle, children: detail.body }) }) : /* @__PURE__ */ jsx("div", { style: { padding: "12px 16px", fontSize: "12px", color: "var(--text-secondary, #888)", fontStyle: "italic", borderBottom: "1px solid var(--border-color, #222)" }, children: "No description provided." }),
      detail.comments.length > 0 && /* @__PURE__ */ jsxs("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border-color, #222)" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)", marginBottom: "12px" }, children: [
          detail.comments.length,
          " comment",
          detail.comments.length === 1 ? "" : "s"
        ] }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: "10px" }, children: detail.comments.map((comment, i) => /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              border: "1px solid var(--border-color, #222)",
              borderRadius: "6px",
              overflow: "hidden"
            },
            children: [
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", background: "var(--panel-bg-alt, rgba(0,0,0,0.15))", borderBottom: "1px solid var(--border-color, #222)" }, children: [
                /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)" }, children: comment.author.login }),
                /* @__PURE__ */ jsx("span", { style: { fontSize: "10px", color: "var(--text-secondary, #888)" }, children: relativeTime(comment.createdAt) })
              ] }),
              /* @__PURE__ */ jsx("div", { style: { padding: "8px 10px" }, children: /* @__PURE__ */ jsx("pre", { style: preStyle, children: comment.body }) })
            ]
          },
          i
        )) })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { padding: "12px 16px" }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)", marginBottom: "8px" }, children: "Add a comment" }),
        /* @__PURE__ */ jsx(
          "textarea",
          {
            value: commentBody,
            onChange: (e) => setCommentBody(e.target.value),
            placeholder: "Write a comment\\u2026",
            rows: 3,
            style: { ...formInput, resize: "vertical" }
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: "8px" }, children: /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleAddComment,
            disabled: !commentBody.trim(),
            style: {
              ...btnPrimarySmall,
              opacity: commentBody.trim() ? 1 : 0.5
            },
            children: "Comment"
          }
        ) })
      ] })
    ] }),
    showAgentDialog && detail && /* @__PURE__ */ jsx(
      SendToAgentDialog,
      {
        api,
        issue: detail,
        onClose: () => setShowAgentDialog(false)
      }
    )
  ] });
}
var sidebarContainer = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  fontFamily: "var(--font-family)",
  background: "var(--sidebar-bg, #181825)"
};
var sidebarHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border-color, #222)"
};
var sidebarHeaderBtn = {
  padding: "2px 8px",
  fontSize: "12px",
  color: "var(--text-secondary, #888)",
  background: "transparent",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontFamily: "var(--font-family)"
};
var mainContainer = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  fontFamily: "var(--font-family)",
  background: "var(--panel-bg, #1e1e2e)"
};
var mainHeader = {
  display: "flex",
  alignItems: "center",
  padding: "8px 16px",
  borderBottom: "1px solid var(--border-color, #222)",
  background: "var(--sidebar-bg, #181825)",
  flexShrink: 0
};
var mainFooter = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  padding: "10px 16px",
  borderTop: "1px solid var(--border-color, #222)",
  background: "var(--sidebar-bg, #181825)",
  flexShrink: 0
};
var formLabel = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--text-secondary, #aaa)",
  marginBottom: "4px"
};
var formInput = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border-color, #333)",
  background: "var(--input-bg, #1a1a2e)",
  color: "var(--text-primary, #e0e0e0)",
  fontSize: "13px",
  fontFamily: "var(--font-family)",
  boxSizing: "border-box",
  outline: "none"
};
var preStyle = {
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "13px",
  lineHeight: 1.6,
  color: "var(--text-primary, #e0e0e0)",
  margin: 0
};
var btnPrimarySmall = {
  padding: "4px 12px",
  fontSize: "12px",
  fontWeight: 500,
  borderRadius: "4px",
  border: "none",
  background: "var(--accent-color, #4a6cf7)",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "var(--font-family)"
};
var btnSecondarySmall = {
  padding: "4px 12px",
  fontSize: "12px",
  borderRadius: "4px",
  border: "1px solid var(--border-color, #333)",
  background: "transparent",
  color: "var(--text-primary, #e0e0e0)",
  cursor: "pointer",
  fontFamily: "var(--font-family)"
};
export {
  MainPanel,
  SidebarPanel,
  activate,
  deactivate
};
