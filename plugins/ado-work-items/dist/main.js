// src/helpers.ts
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
function typeColor(type) {
  switch (type.toLowerCase()) {
    case "bug":
      return "var(--text-error, #cc293d)";
    case "task":
      return "var(--text-warning, #f2cb1d)";
    case "user story":
      return "var(--text-info, #009ccc)";
    case "product backlog item":
      return "var(--text-info, #009ccc)";
    case "feature":
      return "var(--text-accent, #773b93)";
    case "epic":
      return "var(--text-warning, #ff7b00)";
    case "issue":
      return "var(--text-info, #009ccc)";
    case "impediment":
      return "var(--text-error, #cc293d)";
    default:
      return "var(--text-tertiary, #888)";
  }
}
function stateColor(state) {
  const s = state.toLowerCase();
  if (s === "new" || s === "to do" || s === "proposed")
    return { bg: "var(--bg-secondary, rgba(180,180,180,0.1))", fg: "var(--text-secondary, #a1a1aa)", border: "var(--border-secondary, rgba(180,180,180,0.3))" };
  if (s === "active" || s === "in progress" || s === "committed" || s === "doing")
    return { bg: "var(--bg-accent, rgba(0,122,204,0.1))", fg: "var(--text-info, #3b82f6)", border: "var(--border-secondary, rgba(0,122,204,0.3))" };
  if (s === "resolved" || s === "done")
    return { bg: "var(--bg-accent, rgba(64,200,100,0.1))", fg: "var(--text-accent, #4ade80)", border: "var(--border-secondary, rgba(64,200,100,0.3))" };
  if (s === "closed" || s === "removed")
    return { bg: "var(--bg-tertiary, rgba(168,85,247,0.1))", fg: "var(--text-tertiary, #a1a1aa)", border: "var(--border-primary, rgba(168,85,247,0.3))" };
  return { bg: "var(--bg-secondary, rgba(180,180,180,0.1))", fg: "var(--text-secondary, #a1a1aa)", border: "var(--border-secondary, rgba(180,180,180,0.3))" };
}
function priorityLabel(p) {
  switch (p) {
    case 1:
      return "Critical";
    case 2:
      return "High";
    case 3:
      return "Medium";
    case 4:
      return "Low";
    default:
      return "";
  }
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
      return { ...base, background: "var(--bg-accent, rgba(64,200,100,0.15))", color: "var(--text-accent, #4ade80)" };
    case "running":
      return { ...base, background: "var(--bg-accent, rgba(234,179,8,0.15))", color: "var(--text-warning, #facc15)" };
    case "error":
      return { ...base, background: "var(--bg-error, rgba(239,68,68,0.15))", color: "var(--text-error, #f87171)" };
    default:
      return base;
  }
}
function escapeWiql(value) {
  return value.replace(/'/g, "''");
}
function stripHtml(html) {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n").replace(/<\/li>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// src/main.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var React = globalThis.React;
var { useState, useEffect, useCallback, useRef, useMemo } = React;
var workItemState = {
  selectedId: null,
  creatingNew: false,
  items: [],
  loading: false,
  needsRefresh: false,
  stateFilter: "",
  typeFilter: "",
  searchQuery: "",
  listeners: /* @__PURE__ */ new Set(),
  setSelectedItem(id) {
    this.selectedId = id;
    this.creatingNew = false;
    this.notify();
  },
  setCreatingNew(val) {
    this.creatingNew = val;
    if (val) this.selectedId = null;
    this.notify();
  },
  setItems(items) {
    this.items = items;
    this.notify();
  },
  setLoading(loading) {
    this.loading = loading;
    this.notify();
  },
  setStateFilter(filter) {
    this.stateFilter = filter;
    this.requestRefresh();
  },
  setTypeFilter(filter) {
    this.typeFilter = filter;
    this.requestRefresh();
  },
  setSearchQuery(query) {
    this.searchQuery = query;
    this.notify();
  },
  pendingAction: null,
  triggerAction(action) {
    if (this.selectedId === null) return;
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
    this.selectedId = null;
    this.creatingNew = false;
    this.items = [];
    this.loading = false;
    this.needsRefresh = false;
    this.pendingAction = null;
    this.stateFilter = "";
    this.typeFilter = "";
    this.searchQuery = "";
    this.listeners.clear();
  }
};
function getConfig(api) {
  return {
    organization: (api.settings.get("organization") || "").replace(/\/+$/, ""),
    project: api.settings.get("project") || "",
    team: api.settings.get("team") || "",
    defaultWorkItemType: api.settings.get("defaultWorkItemType") || "Task",
    areaPath: api.settings.get("areaPath") || "",
    iterationPath: api.settings.get("iterationPath") || "",
    queryPath: api.settings.get("queryPath") || ""
  };
}
function baseArgs(config) {
  const args = [];
  if (config.organization) args.push("--org", config.organization);
  if (config.project) args.push("--project", config.project);
  return args;
}
function buildWorkItemUrl(config, id) {
  return `${config.organization}/${encodeURIComponent(config.project)}/_workitems/edit/${id}`;
}
function parseWorkItemDetail(raw, config) {
  const fields = raw.fields;
  if (!fields) {
    return {
      id: raw.id || 0,
      title: "",
      state: "",
      workItemType: "",
      assignedTo: "",
      changedDate: "",
      tags: "",
      priority: 0,
      areaPath: "",
      iterationPath: "",
      description: "",
      url: "",
      createdBy: "",
      createdDate: "",
      reason: "",
      comments: []
    };
  }
  const assignedToField = fields["System.AssignedTo"];
  const assignedTo = typeof assignedToField === "object" && assignedToField !== null ? assignedToField.displayName || assignedToField.uniqueName || "" : typeof assignedToField === "string" ? assignedToField : "";
  const createdByField = fields["System.CreatedBy"];
  const createdBy = typeof createdByField === "object" && createdByField !== null ? createdByField.displayName || createdByField.uniqueName || "" : typeof createdByField === "string" ? createdByField : "";
  return {
    id: raw.id || 0,
    title: fields["System.Title"] || "",
    state: fields["System.State"] || "",
    workItemType: fields["System.WorkItemType"] || "",
    assignedTo,
    changedDate: fields["System.ChangedDate"] || "",
    tags: fields["System.Tags"] || "",
    priority: fields["Microsoft.VSTS.Common.Priority"] || 0,
    areaPath: fields["System.AreaPath"] || "",
    iterationPath: fields["System.IterationPath"] || "",
    description: fields["System.Description"] || "",
    url: buildWorkItemUrl(config, raw.id || 0),
    createdBy,
    createdDate: fields["System.CreatedDate"] || "",
    reason: fields["System.Reason"] || "",
    comments: []
  };
}
async function fetchWorkItemsByIds(api, config, ids) {
  if (ids.length === 0) return [];
  const batchSize = 50;
  const results = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const args = [
      "boards",
      "work-item",
      "show",
      "--id",
      batch.join(","),
      "--output",
      "json",
      ...baseArgs(config)
    ];
    const r = await api.process.exec("az", args, { timeout: 3e4 });
    if (r.exitCode !== 0 || !r.stdout.trim()) continue;
    const parsed = JSON.parse(r.stdout);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const raw of items) {
      const fields = raw.fields;
      if (!fields) continue;
      const assignedToField = fields["System.AssignedTo"];
      const assignedTo = typeof assignedToField === "object" && assignedToField !== null ? assignedToField.displayName || "" : typeof assignedToField === "string" ? assignedToField : "";
      results.push({
        id: raw.id || 0,
        title: fields["System.Title"] || "",
        state: fields["System.State"] || "",
        workItemType: fields["System.WorkItemType"] || "",
        assignedTo,
        changedDate: fields["System.ChangedDate"] || "",
        tags: fields["System.Tags"] || "",
        priority: fields["Microsoft.VSTS.Common.Priority"] || 0,
        areaPath: fields["System.AreaPath"] || "",
        iterationPath: fields["System.IterationPath"] || ""
      });
    }
  }
  return results;
}
async function fetchComments(api, config, workItemId) {
  const url = `${config.organization}/${encodeURIComponent(config.project)}/_apis/wit/workItems/${workItemId}/comments?api-version=7.1-preview.4`;
  const r = await api.process.exec("az", ["rest", "--method", "get", "--url", url, "--output", "json"], { timeout: 3e4 });
  if (r.exitCode !== 0 || !r.stdout.trim()) return [];
  try {
    const data = JSON.parse(r.stdout);
    const comments = [];
    if (data.comments && Array.isArray(data.comments)) {
      for (const c of data.comments) {
        comments.push({
          author: c.createdBy?.displayName || c.createdBy?.uniqueName || "Unknown",
          body: c.text || "",
          createdDate: c.createdDate || ""
        });
      }
    }
    return comments;
  } catch {
    return [];
  }
}
var pluginApi = null;
function activate(ctx, api) {
  pluginApi = api;
  api.logging.info("Azure DevOps Work Items activated");
  ctx.subscriptions.push(
    api.commands.register("ado-work-items.refresh", () => {
      workItemState.requestRefresh();
    })
  );
  ctx.subscriptions.push(
    api.commands.register("ado-work-items.create", () => {
      workItemState.setCreatingNew(true);
    })
  );
  ctx.subscriptions.push(
    api.commands.register("ado-work-items.assignAgent", () => {
      if (!workItemState.selectedId) {
        api.ui.showError("Select a work item first");
        return;
      }
      workItemState.triggerAction("assignAgent");
    })
  );
  ctx.subscriptions.push(
    api.commands.register("ado-work-items.toggleState", () => {
      if (!workItemState.selectedId) {
        api.ui.showError("Select a work item first");
        return;
      }
      workItemState.triggerAction("toggleState");
    })
  );
  ctx.subscriptions.push(
    api.commands.register("ado-work-items.viewInBrowser", () => {
      if (!workItemState.selectedId) {
        api.ui.showError("Select a work item first");
        return;
      }
      workItemState.triggerAction("viewInBrowser");
    })
  );
}
function deactivate() {
  pluginApi = null;
  workItemState.reset();
}
function buildAgentPrompt(item) {
  const tags = item.tags ? `Tags: ${item.tags}` : "";
  return [
    "Review and work on the following Azure DevOps work item:",
    "",
    `Work Item #${item.id}: ${item.title}`,
    `Type: ${item.workItemType}`,
    `State: ${item.state}`,
    `Priority: ${priorityLabel(item.priority) || String(item.priority)}`,
    item.assignedTo ? `Assigned To: ${item.assignedTo}` : "",
    item.areaPath ? `Area: ${item.areaPath}` : "",
    item.iterationPath ? `Iteration: ${item.iterationPath}` : "",
    tags,
    "",
    item.description ? stripHtml(item.description) : "(no description)"
  ].filter(Boolean).join("\n");
}
function SendToAgentDialog({
  api,
  item,
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
    const ctx = buildAgentPrompt(item);
    if (instructions.trim()) return `${ctx}

Additional instructions:
${instructions.trim()}`;
    return ctx;
  }, [item, instructions]);
  const persistDefault = useCallback(async () => {
    if (saveAsDefault && instructions.trim()) {
      await api.storage.projectLocal.write("defaultAgentInstructions", instructions.trim());
    }
  }, [api, saveAsDefault, instructions]);
  const handleConfirm = useCallback(async () => {
    const agent = durableAgents.find((a) => a.id === selectedAgentId);
    if (!agent) return;
    if (agent.status === "running") {
      const ok = await api.ui.showConfirm(
        `"${agent.name}" is currently running. Assigning this work item will interrupt its current work. Continue?`
      );
      if (!ok) return;
      await api.agents.kill(agent.id);
    }
    const mission = buildMission();
    try {
      await persistDefault();
      await api.agents.resume(agent.id, { mission });
      api.ui.showNotice(`Agent "${agent.name}" assigned to work item #${item.id}`);
    } catch {
      api.ui.showError(`Failed to assign agent to work item #${item.id}`);
    }
    onClose();
  }, [durableAgents, selectedAgentId, api, item, buildMission, persistDefault, onClose]);
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
            background: "var(--bg-primary, #18181b)",
            border: "1px solid var(--border-primary, #3f3f46)",
            borderRadius: "8px",
            padding: "16px",
            width: "320px",
            maxHeight: "80vh",
            overflow: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
          },
          children: [
            /* @__PURE__ */ jsx("div", { style: { fontSize: "14px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)", marginBottom: "4px" }, children: "Assign to Agent" }),
            /* @__PURE__ */ jsxs("div", { style: { fontSize: "10px", color: "var(--text-secondary, #a1a1aa)", marginBottom: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
              "#",
              item.id,
              " ",
              item.title
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
                  background: "var(--bg-secondary, #27272a)",
                  border: "1px solid var(--border-primary, #3f3f46)",
                  borderRadius: "4px",
                  color: "var(--text-primary, #e4e4e7)",
                  resize: "none",
                  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
                  boxSizing: "border-box"
                }
              }
            ),
            /* @__PURE__ */ jsx("div", { style: { marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }, children: durableAgents.length === 0 ? /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", color: "var(--text-secondary, #a1a1aa)", textAlign: "center", padding: "16px 0" }, children: "No durable agents found" }) : durableAgents.map((agent) => {
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
                    color: "var(--text-primary, #e4e4e7)",
                    borderRadius: "4px",
                    border: isSelected ? "1px solid var(--text-accent, #8b5cf6)" : "1px solid transparent",
                    background: isSelected ? "var(--bg-accent, rgba(139, 92, 246, 0.15))" : "transparent",
                    cursor: "pointer",
                    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)"
                  },
                  children: [
                    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "6px" }, children: [
                      /* @__PURE__ */ jsx(AgentAvatar, { agentId: agent.id, size: "sm", showStatusRing: true }),
                      /* @__PURE__ */ jsx("span", { style: { fontWeight: 500 }, children: agent.name }),
                      /* @__PURE__ */ jsx("span", { style: statusBadgeStyle(agent.status), children: agent.status })
                    ] }),
                    /* @__PURE__ */ jsx("div", { style: { fontSize: "10px", color: "var(--text-secondary, #a1a1aa)", marginTop: "2px", paddingLeft: "22px" }, children: agent.status === "running" ? "Will interrupt current work" : "Assign work item to this agent" })
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
                  borderTop: "1px solid var(--border-primary, #3f3f46)",
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
                        /* @__PURE__ */ jsx("span", { style: { fontSize: "10px", color: "var(--text-secondary, #a1a1aa)" }, children: "Save as default" })
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
function StatePickerDialog({
  api,
  item,
  config,
  onClose,
  onStateChanged
}) {
  const [states, setStates] = useState([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const overlayRef = useRef(null);
  useEffect(() => {
    const commonStates = {
      "bug": ["New", "Active", "Resolved", "Closed"],
      "task": ["New", "Active", "Closed"],
      "user story": ["New", "Active", "Resolved", "Closed"],
      "product backlog item": ["New", "Approved", "Committed", "Done"],
      "feature": ["New", "Active", "Resolved", "Closed"],
      "epic": ["New", "Active", "Resolved", "Closed"],
      "issue": ["To Do", "Doing", "Done"],
      "impediment": ["Open", "Closed"]
    };
    const key = item.workItemType.toLowerCase();
    const available = commonStates[key] || ["New", "Active", "Resolved", "Closed"];
    setStates(available.filter((s) => s !== item.state));
    setLoadingStates(false);
  }, [item]);
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
  const handleSelectState = useCallback(async (newState) => {
    const args = [
      "boards",
      "work-item",
      "update",
      "--id",
      String(item.id),
      "--state",
      newState,
      "--output",
      "json",
      ...baseArgs(config)
    ];
    const r = await api.process.exec("az", args, { timeout: 3e4 });
    if (r.exitCode === 0) {
      api.ui.showNotice(`Work item #${item.id} moved to "${newState}"`);
      onStateChanged();
    } else {
      api.ui.showError(r.stderr.trim() || `Failed to change state to "${newState}"`);
    }
    onClose();
  }, [item, config, api, onClose, onStateChanged]);
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
            background: "var(--bg-primary, #18181b)",
            border: "1px solid var(--border-primary, #3f3f46)",
            borderRadius: "8px",
            padding: "16px",
            width: "260px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
          },
          children: [
            /* @__PURE__ */ jsx("div", { style: { fontSize: "14px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)", marginBottom: "4px" }, children: "Change State" }),
            /* @__PURE__ */ jsxs("div", { style: { fontSize: "10px", color: "var(--text-secondary, #a1a1aa)", marginBottom: "12px" }, children: [
              "Current: ",
              item.state
            ] }),
            loadingStates ? /* @__PURE__ */ jsxs("div", { style: { fontSize: "12px", color: "var(--text-secondary, #a1a1aa)", textAlign: "center", padding: "8px" }, children: [
              "Loading",
              "\u2026"
            ] }) : /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: "4px" }, children: states.map((s) => {
              const colors = stateColor(s);
              return /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => handleSelectState(s),
                  style: {
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 10px",
                    fontSize: "12px",
                    color: colors.fg,
                    borderRadius: "4px",
                    border: `1px solid ${colors.border}`,
                    background: colors.bg,
                    cursor: "pointer",
                    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)"
                  },
                  children: s
                },
                s
              );
            }) }),
            /* @__PURE__ */ jsx("div", { style: { marginTop: "12px", display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ jsx("button", { onClick: onClose, style: btnSecondarySmall, children: "Cancel" }) })
          ]
        }
      )
    }
  );
}
function ConfigWarning() {
  return /* @__PURE__ */ jsx("div", { style: { ...sidebarContainer, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ jsxs("div", { style: { padding: "16px", textAlign: "center" }, children: [
    /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", color: "var(--text-error, #f87171)", marginBottom: "8px" }, children: "Plugin not configured" }),
    /* @__PURE__ */ jsx("div", { style: { fontSize: "11px", color: "var(--text-secondary, #a1a1aa)", marginBottom: "12px", lineHeight: 1.5 }, children: "Open the plugin settings and configure your Azure DevOps Organization URL and Project name. The Azure CLI must also be installed with the azure-devops extension." })
  ] }) });
}
function SidebarPanel({ api }) {
  const [items, setItems] = useState(workItemState.items);
  const [selected, setSelected] = useState(workItemState.selectedId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [stateFilter, setStateFilter] = useState(workItemState.stateFilter);
  const [typeFilter, setTypeFilter] = useState(workItemState.typeFilter);
  const [searchQuery, setSearchQuery] = useState(workItemState.searchQuery);
  const mountedRef = useRef(true);
  const config = getConfig(api);
  useEffect(() => {
    mountedRef.current = true;
    const unsub = workItemState.subscribe(() => {
      if (!mountedRef.current) return;
      setItems([...workItemState.items]);
      setSelected(workItemState.selectedId);
      setLoading(workItemState.loading);
      setNeedsRefresh(workItemState.needsRefresh);
      setStateFilter(workItemState.stateFilter);
      setTypeFilter(workItemState.typeFilter);
      setSearchQuery(workItemState.searchQuery);
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, []);
  const fetchItems = useCallback(async () => {
    if (!config.organization || !config.project) return;
    workItemState.setLoading(true);
    setError(null);
    try {
      let ids = [];
      if (config.queryPath) {
        const args = [
          "boards",
          "query",
          "--path",
          config.queryPath,
          "--output",
          "json",
          ...baseArgs(config)
        ];
        const r = await api.process.exec("az", args, { timeout: 3e4 });
        if (!mountedRef.current) return;
        if (r.exitCode !== 0 || !r.stdout.trim()) {
          setError("Failed to execute saved query. Check the query path in settings.");
          workItemState.setLoading(false);
          return;
        }
        const parsed = JSON.parse(r.stdout);
        ids = parsed.map(
          (wi) => wi.id || 0
        ).filter(Boolean);
      } else {
        const conditions = [
          `[System.TeamProject] = '${escapeWiql(config.project)}'`
        ];
        if (workItemState.stateFilter) {
          conditions.push(`[System.State] = '${escapeWiql(workItemState.stateFilter)}'`);
        }
        if (workItemState.typeFilter) {
          conditions.push(`[System.WorkItemType] = '${escapeWiql(workItemState.typeFilter)}'`);
        }
        if (config.areaPath) {
          conditions.push(`[System.AreaPath] UNDER '${escapeWiql(config.areaPath)}'`);
        }
        if (config.iterationPath) {
          conditions.push(`[System.IterationPath] UNDER '${escapeWiql(config.iterationPath)}'`);
        }
        const wiql = `SELECT [System.Id] FROM WorkItems WHERE ${conditions.join(" AND ")} ORDER BY [System.ChangedDate] DESC`;
        const args = [
          "boards",
          "query",
          "--wiql",
          wiql,
          "--output",
          "json",
          ...baseArgs(config)
        ];
        const r = await api.process.exec("az", args, { timeout: 3e4 });
        if (!mountedRef.current) return;
        if (r.exitCode !== 0 || !r.stdout.trim()) {
          setError("Failed to query work items. Is the Azure CLI installed and authenticated?");
          workItemState.setLoading(false);
          return;
        }
        const parsed = JSON.parse(r.stdout);
        ids = parsed.map(
          (wi) => wi.id || 0
        ).filter(Boolean);
      }
      ids = ids.slice(0, 50);
      if (ids.length === 0) {
        workItemState.setItems([]);
        workItemState.setLoading(false);
        return;
      }
      const results = await fetchWorkItemsByIds(api, config, ids);
      if (!mountedRef.current) return;
      workItemState.setItems(results);
    } catch {
      if (!mountedRef.current) return;
      setError("Failed to load work items. Is the Azure CLI installed and authenticated?");
    } finally {
      workItemState.setLoading(false);
    }
  }, [api, config.organization, config.project, config.areaPath, config.iterationPath, config.queryPath]);
  useEffect(() => {
    if (workItemState.items.length === 0 && config.organization && config.project) {
      fetchItems();
    }
  }, [fetchItems]);
  useEffect(() => {
    if (needsRefresh) {
      workItemState.needsRefresh = false;
      fetchItems();
    }
  }, [needsRefresh, fetchItems]);
  useEffect(() => {
    const unsub = api.settings.onChange(() => {
      workItemState.requestRefresh();
    });
    return () => unsub.dispose();
  }, [api]);
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (i) => i.title.toLowerCase().includes(q) || `#${i.id}`.includes(q)
    );
  }, [items, searchQuery]);
  const availableStates = useMemo(() => {
    const states = new Set(items.map((i) => i.state));
    return Array.from(states).sort();
  }, [items]);
  const availableTypes = useMemo(() => {
    const types = new Set(items.map((i) => i.workItemType));
    return Array.from(types).sort();
  }, [items]);
  if (!config.organization || !config.project) {
    return /* @__PURE__ */ jsx(ConfigWarning, {});
  }
  if (error) {
    return /* @__PURE__ */ jsx("div", { style: { ...sidebarContainer, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ jsxs("div", { style: { padding: "16px", textAlign: "center" }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", color: "var(--text-error, #f87171)", marginBottom: "8px" }, children: "Could not load work items" }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: "11px", color: "var(--text-secondary, #a1a1aa)", marginBottom: "12px" }, children: error }),
      /* @__PURE__ */ jsx("button", { onClick: () => fetchItems(), style: btnSecondarySmall, children: "Retry" })
    ] }) });
  }
  return /* @__PURE__ */ jsxs("div", { style: sidebarContainer, children: [
    /* @__PURE__ */ jsxs("div", { style: sidebarHeader, children: [
      /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)" }, children: "Work Items" }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "4px" }, children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => fetchItems(),
            disabled: loading,
            title: "Refresh work items",
            style: sidebarHeaderBtn,
            children: "\u21BB"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => workItemState.setCreatingNew(true),
            title: "Create a new work item",
            style: sidebarHeaderBtn,
            children: "+ New"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { padding: "6px 8px", borderBottom: "1px solid var(--border-primary, #3f3f46)", display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }, children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: searchQuery,
          onChange: (e) => workItemState.setSearchQuery(e.target.value),
          placeholder: "Filter\\u2026",
          style: {
            flex: 1,
            minWidth: "60px",
            padding: "4px 6px",
            fontSize: "11px",
            border: "1px solid var(--border-primary, #3f3f46)",
            borderRadius: "4px",
            background: "var(--bg-secondary, #27272a)",
            color: "var(--text-primary, #e4e4e7)",
            fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
            outline: "none"
          }
        }
      ),
      /* @__PURE__ */ jsxs(
        "select",
        {
          value: stateFilter,
          onChange: (e) => workItemState.setStateFilter(e.target.value),
          style: filterSelect,
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All States" }),
            availableStates.map((s) => /* @__PURE__ */ jsx("option", { value: s, children: s }, s))
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "select",
        {
          value: typeFilter,
          onChange: (e) => workItemState.setTypeFilter(e.target.value),
          style: filterSelect,
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All Types" }),
            availableTypes.map((t) => /* @__PURE__ */ jsx("option", { value: t, children: t }, t))
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { style: { flex: 1, overflowY: "auto" }, children: loading && items.length === 0 ? /* @__PURE__ */ jsxs("div", { style: { padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--text-secondary, #a1a1aa)" }, children: [
      "Loading work items",
      "\u2026"
    ] }) : filteredItems.length === 0 ? /* @__PURE__ */ jsx("div", { style: { padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--text-secondary, #a1a1aa)" }, children: searchQuery ? "No matching work items" : "No work items found" }) : /* @__PURE__ */ jsx("div", { style: { padding: "2px 0" }, children: filteredItems.map((item) => /* @__PURE__ */ jsxs(
      "div",
      {
        onClick: () => workItemState.setSelectedItem(item.id),
        style: {
          padding: "8px 10px",
          cursor: "pointer",
          background: item.id === selected ? "var(--bg-active, #3f3f46)" : "transparent"
        },
        children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }, children: [
            /* @__PURE__ */ jsx(
              "span",
              {
                style: {
                  width: "3px",
                  height: "14px",
                  borderRadius: "2px",
                  background: typeColor(item.workItemType),
                  flexShrink: 0
                }
              }
            ),
            /* @__PURE__ */ jsxs("span", { style: { fontSize: "10px", color: "var(--text-secondary, #a1a1aa)", flexShrink: 0 }, children: [
              "#",
              item.id
            ] }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", color: "var(--text-primary, #e4e4e7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: item.title })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", paddingLeft: "9px" }, children: [
            /* @__PURE__ */ jsx("span", { style: { fontSize: "9px", color: typeColor(item.workItemType), flexShrink: 0 }, children: item.workItemType }),
            (() => {
              const colors = stateColor(item.state);
              return /* @__PURE__ */ jsx(
                "span",
                {
                  style: {
                    fontSize: "9px",
                    padding: "0 5px",
                    borderRadius: "10px",
                    backgroundColor: colors.bg,
                    color: colors.fg,
                    border: `1px solid ${colors.border}`,
                    flexShrink: 0
                  },
                  children: item.state
                }
              );
            })(),
            item.assignedTo && /* @__PURE__ */ jsx("span", { style: { fontSize: "9px", color: "var(--text-tertiary, #71717a)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: item.assignedTo }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: "10px", color: "var(--text-secondary, #a1a1aa)", marginLeft: "auto", flexShrink: 0 }, children: relativeTime(item.changedDate) })
          ] })
        ]
      },
      item.id
    )) }) })
  ] });
}
function MainPanel({ api }) {
  const [selected, setSelected] = useState(workItemState.selectedId);
  const [creatingNew, setCreatingNew] = useState(workItemState.creatingNew);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [showStateDialog, setShowStateDialog] = useState(false);
  const [detailVersion, setDetailVersion] = useState(0);
  const config = getConfig(api);
  const [newType, setNewType] = useState(config.defaultWorkItemType || "Task");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAreaPath, setNewAreaPath] = useState(config.areaPath || "");
  const [newIterationPath, setNewIterationPath] = useState(config.iterationPath || "");
  const [newPriority, setNewPriority] = useState("3");
  const [newTags, setNewTags] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editTags, setEditTags] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const handleToggleStateRef = useRef(null);
  const handleViewInBrowserRef = useRef(null);
  useEffect(() => {
    const unsub = workItemState.subscribe(() => {
      setSelected(workItemState.selectedId);
      setCreatingNew(workItemState.creatingNew);
      const action = workItemState.consumeAction();
      if (action === "assignAgent") setShowAgentDialog(true);
      if (action === "toggleState") handleToggleStateRef.current?.();
      if (action === "viewInBrowser") handleViewInBrowserRef.current?.();
    });
    return unsub;
  }, []);
  useEffect(() => {
    if (selected === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setEditing(false);
    const fetchDetail = async () => {
      const args = [
        "boards",
        "work-item",
        "show",
        "--id",
        String(selected),
        "--output",
        "json",
        ...baseArgs(config)
      ];
      const r = await api.process.exec("az", args, { timeout: 3e4 });
      if (cancelled) return;
      if (r.exitCode === 0 && r.stdout.trim()) {
        const raw = JSON.parse(r.stdout);
        const parsed = parseWorkItemDetail(raw, config);
        const comments = await fetchComments(api, config, parsed.id);
        if (cancelled) return;
        parsed.comments = comments;
        setDetail(parsed);
      } else {
        setDetail(null);
      }
      setLoading(false);
    };
    fetchDetail().catch(() => {
      if (!cancelled) {
        setDetail(null);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selected, api, detailVersion, config.organization, config.project]);
  const refreshDetail = useCallback(() => setDetailVersion((v) => v + 1), []);
  const startEditing = useCallback(() => {
    if (!detail) return;
    setEditTitle(detail.title);
    setEditDescription(detail.description ? stripHtml(detail.description) : "");
    setEditAssignedTo(detail.assignedTo);
    setEditTags(detail.tags);
    setEditing(true);
  }, [detail]);
  const saveEdit = useCallback(async () => {
    if (!detail) return;
    const args = [
      "boards",
      "work-item",
      "update",
      "--id",
      String(detail.id),
      "--output",
      "json",
      ...baseArgs(config)
    ];
    const fields = [];
    if (editTitle.trim() !== detail.title) {
      args.push("--title", editTitle.trim());
    }
    if (editDescription !== stripHtml(detail.description || "")) {
      args.push("--description", editDescription);
    }
    if (editAssignedTo !== detail.assignedTo) {
      if (editAssignedTo.trim()) {
        fields.push(`System.AssignedTo=${editAssignedTo.trim()}`);
      } else {
        fields.push("System.AssignedTo=");
      }
    }
    if (editTags !== detail.tags) {
      fields.push(`System.Tags=${editTags}`);
    }
    if (fields.length > 0) {
      args.push("--fields", ...fields);
    }
    const baseArgCount = 5 + baseArgs(config).length;
    if (args.length <= baseArgCount + 2) {
      setEditing(false);
      return;
    }
    const r = await api.process.exec("az", args, { timeout: 3e4 });
    if (r.exitCode === 0) {
      api.ui.showNotice("Work item updated");
      setEditing(false);
      refreshDetail();
      workItemState.requestRefresh();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to update work item");
    }
  }, [detail, editTitle, editDescription, editAssignedTo, editTags, api, config, refreshDetail]);
  const handleAddComment = useCallback(async () => {
    if (!detail || !commentBody.trim()) return;
    const args = [
      "boards",
      "work-item",
      "update",
      "--id",
      String(detail.id),
      "--discussion",
      commentBody.trim(),
      "--output",
      "json",
      ...baseArgs(config)
    ];
    const r = await api.process.exec("az", args, { timeout: 3e4 });
    if (r.exitCode === 0) {
      api.ui.showNotice("Comment added");
      setCommentBody("");
      refreshDetail();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to add comment");
    }
  }, [detail, commentBody, api, config, refreshDetail]);
  const handleToggleState = useCallback(() => {
    if (!detail) return;
    setShowStateDialog(true);
  }, [detail]);
  handleToggleStateRef.current = handleToggleState;
  handleViewInBrowserRef.current = detail ? () => api.ui.openExternalUrl(detail.url) : null;
  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const args = [
      "boards",
      "work-item",
      "create",
      "--type",
      newType,
      "--title",
      newTitle.trim(),
      "--output",
      "json",
      ...baseArgs(config)
    ];
    if (newDescription.trim()) {
      args.push("--description", newDescription.trim());
    }
    if (newAreaPath.trim()) {
      args.push("--area", newAreaPath.trim());
    }
    if (newIterationPath.trim()) {
      args.push("--iteration", newIterationPath.trim());
    }
    const fields = [];
    if (newPriority) {
      fields.push(`Microsoft.VSTS.Common.Priority=${newPriority}`);
    }
    if (newTags.trim()) {
      fields.push(`System.Tags=${newTags.trim()}`);
    }
    if (fields.length > 0) {
      args.push("--fields", ...fields);
    }
    const r = await api.process.exec("az", args, { timeout: 3e4 });
    setCreating(false);
    if (r.exitCode === 0) {
      let createdId = "";
      try {
        const parsed = JSON.parse(r.stdout);
        createdId = ` #${parsed.id}`;
      } catch {
      }
      api.ui.showNotice(`Work item${createdId} created`);
      setNewTitle("");
      setNewDescription("");
      setNewTags("");
      setNewPriority("3");
      workItemState.setCreatingNew(false);
      workItemState.requestRefresh();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to create work item");
    }
  }, [newType, newTitle, newDescription, newAreaPath, newIterationPath, newPriority, newTags, api, config]);
  const handleCancelCreate = useCallback(() => {
    setNewTitle("");
    setNewDescription("");
    setNewTags("");
    setNewPriority("3");
    workItemState.setCreatingNew(false);
  }, []);
  if (creatingNew) {
    return /* @__PURE__ */ jsxs("div", { style: mainContainer, children: [
      /* @__PURE__ */ jsx("div", { style: mainHeader, children: /* @__PURE__ */ jsx("span", { style: { fontSize: "13px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)" }, children: "New Work Item" }) }),
      /* @__PURE__ */ jsx("div", { style: { flex: 1, overflowY: "auto", padding: "16px" }, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "14px" }, children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: formLabel, children: "Type" }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: newType,
              onChange: (e) => setNewType(e.target.value),
              style: formInput,
              children: [
                /* @__PURE__ */ jsx("option", { value: "Epic", children: "Epic" }),
                /* @__PURE__ */ jsx("option", { value: "Feature", children: "Feature" }),
                /* @__PURE__ */ jsx("option", { value: "User Story", children: "User Story" }),
                /* @__PURE__ */ jsx("option", { value: "Product Backlog Item", children: "Product Backlog Item" }),
                /* @__PURE__ */ jsx("option", { value: "Bug", children: "Bug" }),
                /* @__PURE__ */ jsx("option", { value: "Task", children: "Task" }),
                /* @__PURE__ */ jsx("option", { value: "Issue", children: "Issue" }),
                /* @__PURE__ */ jsx("option", { value: "Impediment", children: "Impediment" })
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
              placeholder: "Work item title",
              style: formInput,
              autoFocus: true
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: formLabel, children: "Description" }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              value: newDescription,
              onChange: (e) => setNewDescription(e.target.value),
              placeholder: "Describe the work item\\u2026",
              rows: 8,
              style: { ...formInput, resize: "vertical" }
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: formLabel, children: "Area Path" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: newAreaPath,
              onChange: (e) => setNewAreaPath(e.target.value),
              placeholder: config.areaPath || config.project,
              style: formInput
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: formLabel, children: "Iteration Path" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: newIterationPath,
              onChange: (e) => setNewIterationPath(e.target.value),
              placeholder: config.iterationPath || config.project,
              style: formInput
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: formLabel, children: "Priority" }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: newPriority,
              onChange: (e) => setNewPriority(e.target.value),
              style: formInput,
              children: [
                /* @__PURE__ */ jsx("option", { value: "1", children: "1 - Critical" }),
                /* @__PURE__ */ jsx("option", { value: "2", children: "2 - High" }),
                /* @__PURE__ */ jsx("option", { value: "3", children: "3 - Medium" }),
                /* @__PURE__ */ jsx("option", { value: "4", children: "4 - Low" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: formLabel, children: "Tags" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: newTags,
              onChange: (e) => setNewTags(e.target.value),
              placeholder: "Tag1; Tag2; Tag3",
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
            children: creating ? "Creating\u2026" : "Create Work Item"
          }
        )
      ] })
    ] });
  }
  if (selected === null) {
    return /* @__PURE__ */ jsx("div", { style: { ...mainContainer, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", color: "var(--text-secondary, #a1a1aa)" }, children: "Select a work item to view details" }) });
  }
  if (loading) {
    return /* @__PURE__ */ jsx("div", { style: { ...mainContainer, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ jsxs("span", { style: { fontSize: "12px", color: "var(--text-secondary, #a1a1aa)" }, children: [
      "Loading work item",
      "\u2026"
    ] }) });
  }
  if (!detail) {
    return /* @__PURE__ */ jsx("div", { style: { ...mainContainer, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", color: "var(--text-secondary, #a1a1aa)" }, children: "Failed to load work item details" }) });
  }
  const sc = stateColor(detail.state);
  const stateBadge = {
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "10px",
    cursor: "pointer",
    border: `1px solid ${sc.border}`,
    background: sc.bg,
    color: sc.fg
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
        /* @__PURE__ */ jsx(
          "span",
          {
            style: {
              width: "3px",
              height: "16px",
              borderRadius: "2px",
              background: typeColor(detail.workItemType),
              flexShrink: 0
            }
          }
        ),
        /* @__PURE__ */ jsxs("span", { style: { fontSize: "12px", color: "var(--text-secondary, #a1a1aa)", flexShrink: 0 }, children: [
          "#",
          detail.id
        ] }),
        /* @__PURE__ */ jsx("span", { style: { fontSize: "13px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: detail.title })
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
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", padding: "8px 16px", borderBottom: "1px solid var(--border-primary, #3f3f46)", background: "var(--bg-tertiary, #333338)" }, children: [
      /* @__PURE__ */ jsx("button", { onClick: () => setShowStateDialog(true), style: stateBadge, title: "Change state", children: detail.state }),
      /* @__PURE__ */ jsx("span", { style: { fontSize: "10px", color: typeColor(detail.workItemType), fontWeight: 500 }, children: detail.workItemType }),
      detail.priority > 0 && /* @__PURE__ */ jsxs("span", { style: { fontSize: "10px", color: "var(--text-secondary, #a1a1aa)" }, children: [
        "P",
        detail.priority,
        " (",
        priorityLabel(detail.priority),
        ")"
      ] }),
      /* @__PURE__ */ jsxs("span", { style: { fontSize: "10px", color: "var(--text-secondary, #a1a1aa)" }, children: [
        "by ",
        detail.createdBy
      ] }),
      /* @__PURE__ */ jsxs("span", { style: { fontSize: "10px", color: "var(--text-secondary, #a1a1aa)" }, children: [
        "created ",
        relativeTime(detail.createdDate)
      ] }),
      editing ? /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: editAssignedTo,
          onChange: (e) => setEditAssignedTo(e.target.value),
          placeholder: "Assigned to",
          style: { fontSize: "10px", padding: "2px 6px", background: "var(--bg-secondary, #27272a)", border: "1px solid var(--border-primary, #3f3f46)", borderRadius: "4px", color: "var(--text-primary, #e4e4e7)", fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)", outline: "none" }
        }
      ) : detail.assignedTo ? /* @__PURE__ */ jsx("span", { style: { fontSize: "10px", padding: "1px 6px", background: "var(--bg-active, #3f3f46)", color: "var(--text-secondary, #a1a1aa)", borderRadius: "4px" }, children: detail.assignedTo }) : null,
      detail.areaPath && /* @__PURE__ */ jsxs("span", { style: { fontSize: "9px", color: "var(--text-tertiary, #71717a)" }, children: [
        "Area: ",
        detail.areaPath
      ] }),
      detail.iterationPath && /* @__PURE__ */ jsxs("span", { style: { fontSize: "9px", color: "var(--text-tertiary, #71717a)" }, children: [
        "Iter: ",
        detail.iterationPath
      ] }),
      editing ? /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: editTags,
          onChange: (e) => setEditTags(e.target.value),
          placeholder: "Tags (semicolon separated)",
          style: { fontSize: "10px", padding: "2px 6px", background: "var(--bg-secondary, #27272a)", border: "1px solid var(--border-primary, #3f3f46)", borderRadius: "4px", color: "var(--text-primary, #e4e4e7)", fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)", outline: "none" }
        }
      ) : detail.tags ? detail.tags.split(";").map((tag) => tag.trim()).filter(Boolean).map((tag) => /* @__PURE__ */ jsx(
        "span",
        {
          style: {
            fontSize: "9px",
            padding: "0 5px",
            borderRadius: "10px",
            backgroundColor: "var(--bg-accent, rgba(139, 92, 246, 0.15))",
            color: "var(--text-accent, #8b5cf6)",
            border: "1px solid var(--border-secondary, #52525b)"
          },
          children: tag
        },
        tag
      )) : null
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, overflowY: "auto" }, children: [
      editing ? /* @__PURE__ */ jsx("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border-primary, #3f3f46)" }, children: /* @__PURE__ */ jsx(
        "textarea",
        {
          value: editDescription,
          onChange: (e) => setEditDescription(e.target.value),
          placeholder: "Work item description\\u2026",
          rows: 10,
          style: { ...formInput, resize: "vertical" }
        }
      ) }) : detail.description ? /* @__PURE__ */ jsx("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border-primary, #3f3f46)" }, children: /* @__PURE__ */ jsx("pre", { style: preStyle, children: stripHtml(detail.description) }) }) : /* @__PURE__ */ jsx("div", { style: { padding: "12px 16px", fontSize: "12px", color: "var(--text-secondary, #a1a1aa)", fontStyle: "italic", borderBottom: "1px solid var(--border-primary, #3f3f46)" }, children: "No description provided." }),
      detail.comments.length > 0 && /* @__PURE__ */ jsxs("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border-primary, #3f3f46)" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)", marginBottom: "12px" }, children: [
          detail.comments.length,
          " comment",
          detail.comments.length === 1 ? "" : "s"
        ] }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: "10px" }, children: detail.comments.map((comment, i) => /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              border: "1px solid var(--border-primary, #3f3f46)",
              borderRadius: "6px",
              overflow: "hidden"
            },
            children: [
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", background: "var(--bg-tertiary, #333338)", borderBottom: "1px solid var(--border-primary, #3f3f46)" }, children: [
                /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)" }, children: comment.author }),
                /* @__PURE__ */ jsx("span", { style: { fontSize: "10px", color: "var(--text-secondary, #a1a1aa)" }, children: relativeTime(comment.createdDate) })
              ] }),
              /* @__PURE__ */ jsx("div", { style: { padding: "8px 10px" }, children: /* @__PURE__ */ jsx("pre", { style: preStyle, children: stripHtml(comment.body) }) })
            ]
          },
          i
        )) })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { padding: "12px 16px" }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e4e4e7)", marginBottom: "8px" }, children: "Add a comment" }),
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
        item: detail,
        onClose: () => setShowAgentDialog(false)
      }
    ),
    showStateDialog && detail && /* @__PURE__ */ jsx(
      StatePickerDialog,
      {
        api,
        item: detail,
        config,
        onClose: () => setShowStateDialog(false),
        onStateChanged: () => {
          refreshDetail();
          workItemState.requestRefresh();
        }
      }
    )
  ] });
}
var sidebarContainer = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
  background: "var(--bg-secondary, #27272a)"
};
var sidebarHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border-primary, #3f3f46)"
};
var sidebarHeaderBtn = {
  padding: "2px 8px",
  fontSize: "12px",
  color: "var(--text-secondary, #a1a1aa)",
  background: "transparent",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)"
};
var mainContainer = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
  background: "var(--bg-primary, #18181b)"
};
var mainHeader = {
  display: "flex",
  alignItems: "center",
  padding: "8px 16px",
  borderBottom: "1px solid var(--border-primary, #3f3f46)",
  background: "var(--bg-secondary, #27272a)",
  flexShrink: 0
};
var mainFooter = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  padding: "10px 16px",
  borderTop: "1px solid var(--border-primary, #3f3f46)",
  background: "var(--bg-secondary, #27272a)",
  flexShrink: 0
};
var formLabel = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--text-secondary, #a1a1aa)",
  marginBottom: "4px"
};
var formInput = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border-primary, #3f3f46)",
  background: "var(--bg-secondary, #27272a)",
  color: "var(--text-primary, #e4e4e7)",
  fontSize: "13px",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
  boxSizing: "border-box",
  outline: "none"
};
var filterSelect = {
  padding: "4px 4px",
  fontSize: "10px",
  border: "1px solid var(--border-primary, #3f3f46)",
  borderRadius: "4px",
  background: "var(--bg-secondary, #27272a)",
  color: "var(--text-primary, #e4e4e7)",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
  cursor: "pointer"
};
var preStyle = {
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "13px",
  lineHeight: 1.6,
  color: "var(--text-primary, #e4e4e7)",
  margin: 0
};
var btnPrimarySmall = {
  padding: "4px 12px",
  fontSize: "12px",
  fontWeight: 500,
  borderRadius: "4px",
  border: "none",
  background: "var(--text-accent, #8b5cf6)",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)"
};
var btnSecondarySmall = {
  padding: "4px 12px",
  fontSize: "12px",
  borderRadius: "4px",
  border: "1px solid var(--border-primary, #3f3f46)",
  background: "transparent",
  color: "var(--text-primary, #e4e4e7)",
  cursor: "pointer",
  fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)"
};
export {
  MainPanel,
  SidebarPanel,
  activate,
  deactivate
};
