import type {
  PluginContext,
  PluginAPI,
  PanelProps,
  AgentInfo,
} from "@clubhouse/plugin-types";

const React = globalThis.React;
const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkItemListItem {
  id: number;
  title: string;
  state: string;
  workItemType: string;
  assignedTo: string;
  changedDate: string;
  tags: string;
  priority: number;
  areaPath: string;
  iterationPath: string;
}

interface WorkItemDetail extends WorkItemListItem {
  description: string;
  url: string;
  createdBy: string;
  createdDate: string;
  reason: string;
  comments: Array<{ author: string; body: string; createdDate: string }>;
}

interface AdoConfig {
  organization: string;
  project: string;
  team: string;
  defaultWorkItemType: string;
  areaPath: string;
  iterationPath: string;
  queryPath: string;
}

// ---------------------------------------------------------------------------
// Shared state (coordinates SidebarPanel and MainPanel across React trees)
// ---------------------------------------------------------------------------

const workItemState = {
  selectedId: null as number | null,
  creatingNew: false,
  items: [] as WorkItemListItem[],
  loading: false,
  needsRefresh: false,
  stateFilter: "" as string,
  typeFilter: "" as string,
  searchQuery: "",
  listeners: new Set<() => void>(),

  setSelectedItem(id: number | null): void {
    this.selectedId = id;
    this.creatingNew = false;
    this.notify();
  },

  setCreatingNew(val: boolean): void {
    this.creatingNew = val;
    if (val) this.selectedId = null;
    this.notify();
  },

  setItems(items: WorkItemListItem[]): void {
    this.items = items;
    this.notify();
  },

  setLoading(loading: boolean): void {
    this.loading = loading;
    this.notify();
  },

  setStateFilter(filter: string): void {
    this.stateFilter = filter;
    this.requestRefresh();
  },

  setTypeFilter(filter: string): void {
    this.typeFilter = filter;
    this.requestRefresh();
  },

  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.notify();
  },

  pendingAction: null as "assignAgent" | "toggleState" | "viewInBrowser" | null,

  triggerAction(action: "assignAgent" | "toggleState" | "viewInBrowser"): void {
    if (this.selectedId === null) return;
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
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  const diffMo = Math.floor(diffD / 30);
  return `${diffMo}mo ago`;
}

function getConfig(api: PluginAPI): AdoConfig {
  return {
    organization: (api.settings.get<string>("organization") || "").replace(/\/+$/, ""),
    project: api.settings.get<string>("project") || "",
    team: api.settings.get<string>("team") || "",
    defaultWorkItemType: api.settings.get<string>("defaultWorkItemType") || "Task",
    areaPath: api.settings.get<string>("areaPath") || "",
    iterationPath: api.settings.get<string>("iterationPath") || "",
    queryPath: api.settings.get<string>("queryPath") || "",
  };
}

function baseArgs(config: AdoConfig): string[] {
  const args: string[] = [];
  if (config.organization) args.push("--org", config.organization);
  if (config.project) args.push("--project", config.project);
  return args;
}

function typeColor(type: string): string {
  switch (type.toLowerCase()) {
    case "bug": return "#cc293d";
    case "task": return "#f2cb1d";
    case "user story": return "#009ccc";
    case "product backlog item": return "#009ccc";
    case "feature": return "#773b93";
    case "epic": return "#ff7b00";
    case "issue": return "#009ccc";
    case "impediment": return "#cc293d";
    default: return "#888";
  }
}

function stateColor(state: string): { bg: string; fg: string; border: string } {
  const s = state.toLowerCase();
  if (s === "new" || s === "to do" || s === "proposed")
    return { bg: "rgba(180,180,180,0.1)", fg: "#b4b4b4", border: "rgba(180,180,180,0.3)" };
  if (s === "active" || s === "in progress" || s === "committed" || s === "doing")
    return { bg: "rgba(0,122,204,0.1)", fg: "#007acc", border: "rgba(0,122,204,0.3)" };
  if (s === "resolved" || s === "done")
    return { bg: "rgba(64,200,100,0.1)", fg: "#4ade80", border: "rgba(64,200,100,0.3)" };
  if (s === "closed" || s === "removed")
    return { bg: "rgba(168,85,247,0.1)", fg: "#c084fc", border: "rgba(168,85,247,0.3)" };
  return { bg: "rgba(180,180,180,0.1)", fg: "#b4b4b4", border: "rgba(180,180,180,0.3)" };
}

function priorityLabel(p: number): string {
  switch (p) {
    case 1: return "Critical";
    case 2: return "High";
    case 3: return "Medium";
    case 4: return "Low";
    default: return "";
  }
}

function buildWorkItemUrl(config: AdoConfig, id: number): string {
  return `${config.organization}/${encodeURIComponent(config.project)}/_workitems/edit/${id}`;
}

/** Parse the output of `az boards work-item show` into our detail type. */
function parseWorkItemDetail(raw: Record<string, unknown>, config: AdoConfig): WorkItemDetail {
  const fields = raw.fields as Record<string, unknown> | undefined;
  if (!fields) {
    return {
      id: (raw.id as number) || 0,
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
      comments: [],
    };
  }
  const assignedToField = fields["System.AssignedTo"];
  const assignedTo = typeof assignedToField === "object" && assignedToField !== null
    ? (assignedToField as Record<string, string>).displayName || (assignedToField as Record<string, string>).uniqueName || ""
    : typeof assignedToField === "string" ? assignedToField : "";
  const createdByField = fields["System.CreatedBy"];
  const createdBy = typeof createdByField === "object" && createdByField !== null
    ? (createdByField as Record<string, string>).displayName || (createdByField as Record<string, string>).uniqueName || ""
    : typeof createdByField === "string" ? createdByField : "";

  return {
    id: (raw.id as number) || 0,
    title: (fields["System.Title"] as string) || "",
    state: (fields["System.State"] as string) || "",
    workItemType: (fields["System.WorkItemType"] as string) || "",
    assignedTo,
    changedDate: (fields["System.ChangedDate"] as string) || "",
    tags: (fields["System.Tags"] as string) || "",
    priority: (fields["Microsoft.VSTS.Common.Priority"] as number) || 0,
    areaPath: (fields["System.AreaPath"] as string) || "",
    iterationPath: (fields["System.IterationPath"] as string) || "",
    description: (fields["System.Description"] as string) || "",
    url: buildWorkItemUrl(config, (raw.id as number) || 0),
    createdBy,
    createdDate: (fields["System.CreatedDate"] as string) || "",
    reason: (fields["System.Reason"] as string) || "",
    comments: [],
  };
}

/** Parse WIQL query results (list of IDs) and fetch work item details. */
async function fetchWorkItemsByIds(
  api: PluginAPI,
  config: AdoConfig,
  ids: number[],
): Promise<WorkItemListItem[]> {
  if (ids.length === 0) return [];

  // az boards work-item show supports single ID; batch via comma-separated IDs
  const batchSize = 50;
  const results: WorkItemListItem[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const args = [
      "boards", "work-item", "show",
      "--id", batch.join(","),
      "--output", "json",
      ...baseArgs(config),
    ];
    const r = await api.process.exec("az", args, { timeout: 30000 });
    if (r.exitCode !== 0 || !r.stdout.trim()) continue;

    const parsed = JSON.parse(r.stdout);
    // Single ID returns object, multiple returns array
    const items: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];

    for (const raw of items) {
      const fields = raw.fields as Record<string, unknown> | undefined;
      if (!fields) continue;
      const assignedToField = fields["System.AssignedTo"];
      const assignedTo = typeof assignedToField === "object" && assignedToField !== null
        ? (assignedToField as Record<string, string>).displayName || ""
        : typeof assignedToField === "string" ? assignedToField : "";

      results.push({
        id: (raw.id as number) || 0,
        title: (fields["System.Title"] as string) || "",
        state: (fields["System.State"] as string) || "",
        workItemType: (fields["System.WorkItemType"] as string) || "",
        assignedTo,
        changedDate: (fields["System.ChangedDate"] as string) || "",
        tags: (fields["System.Tags"] as string) || "",
        priority: (fields["Microsoft.VSTS.Common.Priority"] as number) || 0,
        areaPath: (fields["System.AreaPath"] as string) || "",
        iterationPath: (fields["System.IterationPath"] as string) || "",
      });
    }
  }

  return results;
}

/** Fetch work item comments using az devops CLI. */
async function fetchComments(
  api: PluginAPI,
  config: AdoConfig,
  workItemId: number,
): Promise<Array<{ author: string; body: string; createdDate: string }>> {
  // The az CLI doesn't have a direct comments command for work items.
  // Work item history/discussion is accessed via System.History field on updates.
  // We use the REST API via `az rest` to get comments.
  const url = `${config.organization}/${encodeURIComponent(config.project)}/_apis/wit/workItems/${workItemId}/comments?api-version=7.1-preview.4`;
  const r = await api.process.exec("az", ["rest", "--method", "get", "--url", url, "--output", "json"], { timeout: 30000 });
  if (r.exitCode !== 0 || !r.stdout.trim()) return [];
  try {
    const data = JSON.parse(r.stdout);
    const comments: Array<{ author: string; body: string; createdDate: string }> = [];
    if (data.comments && Array.isArray(data.comments)) {
      for (const c of data.comments) {
        comments.push({
          author: c.createdBy?.displayName || c.createdBy?.uniqueName || "Unknown",
          body: c.text || "",
          createdDate: c.createdDate || "",
        });
      }
    }
    return comments;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let pluginApi: PluginAPI | null = null;

export function activate(ctx: PluginContext, api: PluginAPI): void {
  pluginApi = api;
  api.logging.info("Azure DevOps Work Items activated");

  ctx.subscriptions.push(
    api.commands.register("ado-work-items.refresh", () => {
      workItemState.requestRefresh();
    }),
  );
  ctx.subscriptions.push(
    api.commands.register("ado-work-items.create", () => {
      workItemState.setCreatingNew(true);
    }),
  );
  ctx.subscriptions.push(
    api.commands.register("ado-work-items.assignAgent", () => {
      if (!workItemState.selectedId) {
        api.ui.showError("Select a work item first");
        return;
      }
      workItemState.triggerAction("assignAgent");
    }),
  );
  ctx.subscriptions.push(
    api.commands.register("ado-work-items.toggleState", () => {
      if (!workItemState.selectedId) {
        api.ui.showError("Select a work item first");
        return;
      }
      workItemState.triggerAction("toggleState");
    }),
  );
  ctx.subscriptions.push(
    api.commands.register("ado-work-items.viewInBrowser", () => {
      if (!workItemState.selectedId) {
        api.ui.showError("Select a work item first");
        return;
      }
      workItemState.triggerAction("viewInBrowser");
    }),
  );
}

export function deactivate(): void {
  pluginApi = null;
  workItemState.reset();
}

// ---------------------------------------------------------------------------
// SendToAgentDialog
// ---------------------------------------------------------------------------

function buildAgentPrompt(item: WorkItemDetail): string {
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
    item.description ? stripHtml(item.description) : "(no description)",
  ].filter(Boolean).join("\n");
}

/** Strip HTML tags for plain-text display. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  item,
  onClose,
}: {
  api: PluginAPI;
  item: WorkItemDetail;
  onClose: () => void;
}) {
  const [instructions, setInstructions] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [durableAgents, setDurableAgents] = useState<AgentInfo[]>([]);
  const [defaultLoaded, setDefaultLoaded] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const AgentAvatar = api.widgets.AgentAvatar;

  useEffect(() => {
    const agents = api.agents.list().filter(a => a.kind === "durable");
    setDurableAgents(agents);

    api.storage.projectLocal.read("defaultAgentInstructions").then(saved => {
      if (typeof saved === "string" && saved.length > 0) {
        setInstructions(saved);
      }
      setDefaultLoaded(true);
    }).catch(() => {
      setDefaultLoaded(true);
    });
  }, [api]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (overlayRef.current && e.target === overlayRef.current) onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const buildMission = useCallback((): string => {
    const ctx = buildAgentPrompt(item);
    if (instructions.trim()) return `${ctx}\n\nAdditional instructions:\n${instructions.trim()}`;
    return ctx;
  }, [item, instructions]);

  const persistDefault = useCallback(async () => {
    if (saveAsDefault && instructions.trim()) {
      await api.storage.projectLocal.write("defaultAgentInstructions", instructions.trim());
    }
  }, [api, saveAsDefault, instructions]);

  const handleConfirm = useCallback(async () => {
    const agent = durableAgents.find(a => a.id === selectedAgentId);
    if (!agent) return;

    if (agent.status === "running") {
      const ok = await api.ui.showConfirm(
        `"${agent.name}" is currently running. Assigning this work item will interrupt its current work. Continue?`,
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
          background: "var(--panel-bg, #1e1e2e)",
          border: "1px solid var(--border-color, #333)",
          borderRadius: "8px",
          padding: "16px",
          width: "320px",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)", marginBottom: "4px" }}>
          Assign to Agent
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary, #888)", marginBottom: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          #{item.id} {item.title}
        </div>

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
            background: "var(--input-bg, #1a1a2e)",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "4px",
            color: "var(--text-primary, #e0e0e0)",
            resize: "none",
            fontFamily: "var(--font-family)",
            boxSizing: "border-box",
          }}
        />

        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {durableAgents.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--text-secondary, #888)", textAlign: "center", padding: "16px 0" }}>
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
                    color: "var(--text-primary, #e0e0e0)",
                    borderRadius: "4px",
                    border: isSelected ? "1px solid var(--accent-color, #4a6cf7)" : "1px solid transparent",
                    background: isSelected ? "rgba(74,108,247,0.1)" : "transparent",
                    cursor: "pointer",
                    fontFamily: "var(--font-family)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <AgentAvatar agentId={agent.id} size="sm" showStatusRing />
                    <span style={{ fontWeight: 500 }}>{agent.name}</span>
                    <span style={statusBadgeStyle(agent.status)}>{agent.status}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-secondary, #888)", marginTop: "2px", paddingLeft: "22px" }}>
                    {agent.status === "running" ? "Will interrupt current work" : "Assign work item to this agent"}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid var(--border-color, #333)",
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
              <span style={{ fontSize: "10px", color: "var(--text-secondary, #888)" }}>
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
// StatePickerDialog — lets user pick the next state for a work item
// ---------------------------------------------------------------------------

function StatePickerDialog({
  api,
  item,
  config,
  onClose,
  onStateChanged,
}: {
  api: PluginAPI;
  item: WorkItemDetail;
  config: AdoConfig;
  onClose: () => void;
  onStateChanged: () => void;
}) {
  const [states, setStates] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Determine available states based on work item type
    // Common states across process templates
    const commonStates: Record<string, string[]> = {
      "bug": ["New", "Active", "Resolved", "Closed"],
      "task": ["New", "Active", "Closed"],
      "user story": ["New", "Active", "Resolved", "Closed"],
      "product backlog item": ["New", "Approved", "Committed", "Done"],
      "feature": ["New", "Active", "Resolved", "Closed"],
      "epic": ["New", "Active", "Resolved", "Closed"],
      "issue": ["To Do", "Doing", "Done"],
      "impediment": ["Open", "Closed"],
    };
    const key = item.workItemType.toLowerCase();
    const available = commonStates[key] || ["New", "Active", "Resolved", "Closed"];
    setStates(available.filter(s => s !== item.state));
    setLoadingStates(false);
  }, [item]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (overlayRef.current && e.target === overlayRef.current) onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSelectState = useCallback(async (newState: string) => {
    const args = [
      "boards", "work-item", "update",
      "--id", String(item.id),
      "--state", newState,
      "--output", "json",
      ...baseArgs(config),
    ];
    const r = await api.process.exec("az", args, { timeout: 30000 });
    if (r.exitCode === 0) {
      api.ui.showNotice(`Work item #${item.id} moved to "${newState}"`);
      onStateChanged();
    } else {
      api.ui.showError(r.stderr.trim() || `Failed to change state to "${newState}"`);
    }
    onClose();
  }, [item, config, api, onClose, onStateChanged]);

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
          background: "var(--panel-bg, #1e1e2e)",
          border: "1px solid var(--border-color, #333)",
          borderRadius: "8px",
          padding: "16px",
          width: "260px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)", marginBottom: "4px" }}>
          Change State
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary, #888)", marginBottom: "12px" }}>
          Current: {item.state}
        </div>

        {loadingStates ? (
          <div style={{ fontSize: "12px", color: "var(--text-secondary, #888)", textAlign: "center", padding: "8px" }}>
            Loading{"\u2026"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {states.map(s => {
              const colors = stateColor(s);
              return (
                <button
                  key={s}
                  onClick={() => handleSelectState(s)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 10px",
                    fontSize: "12px",
                    color: colors.fg,
                    borderRadius: "4px",
                    border: `1px solid ${colors.border}`,
                    background: colors.bg,
                    cursor: "pointer",
                    fontFamily: "var(--font-family)",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnSecondarySmall}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfigWarning — shown when org/project not configured
// ---------------------------------------------------------------------------

function ConfigWarning() {
  return (
    <div style={{ ...sidebarContainer, justifyContent: "center", alignItems: "center" }}>
      <div style={{ padding: "16px", textAlign: "center" }}>
        <div style={{ fontSize: "12px", color: "var(--text-error, #f87171)", marginBottom: "8px" }}>
          Plugin not configured
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-secondary, #888)", marginBottom: "12px", lineHeight: 1.5 }}>
          Open the plugin settings and configure your Azure DevOps Organization URL and Project name.
          The Azure CLI must also be installed with the azure-devops extension.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarPanel
// ---------------------------------------------------------------------------

export function SidebarPanel({ api }: PanelProps) {
  const [items, setItems] = useState<WorkItemListItem[]>(workItemState.items);
  const [selected, setSelected] = useState<number | null>(workItemState.selectedId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [stateFilter, setStateFilter] = useState(workItemState.stateFilter);
  const [typeFilter, setTypeFilter] = useState(workItemState.typeFilter);
  const [searchQuery, setSearchQuery] = useState(workItemState.searchQuery);
  const mountedRef = useRef(true);

  const config = getConfig(api);

  // Subscribe to shared state
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
    return () => { mountedRef.current = false; unsub(); };
  }, []);

  // Fetch work items
  const fetchItems = useCallback(async () => {
    if (!config.organization || !config.project) return;

    workItemState.setLoading(true);
    setError(null);
    try {
      let ids: number[] = [];

      if (config.queryPath) {
        // Use saved query
        const args = [
          "boards", "query",
          "--path", config.queryPath,
          "--output", "json",
          ...baseArgs(config),
        ];
        const r = await api.process.exec("az", args, { timeout: 30000 });
        if (!mountedRef.current) return;
        if (r.exitCode !== 0 || !r.stdout.trim()) {
          setError("Failed to execute saved query. Check the query path in settings.");
          workItemState.setLoading(false);
          return;
        }
        const parsed = JSON.parse(r.stdout);
        ids = (parsed as Array<Record<string, unknown>>).map(
          (wi) => (wi.id as number) || 0,
        ).filter(Boolean);
      } else {
        // Build WIQL query
        const conditions: string[] = [
          `[System.TeamProject] = '${config.project}'`,
        ];
        if (workItemState.stateFilter) {
          conditions.push(`[System.State] = '${workItemState.stateFilter}'`);
        }
        if (workItemState.typeFilter) {
          conditions.push(`[System.WorkItemType] = '${workItemState.typeFilter}'`);
        }
        if (config.areaPath) {
          conditions.push(`[System.AreaPath] UNDER '${config.areaPath}'`);
        }
        if (config.iterationPath) {
          conditions.push(`[System.IterationPath] UNDER '${config.iterationPath}'`);
        }

        const wiql = `SELECT [System.Id] FROM WorkItems WHERE ${conditions.join(" AND ")} ORDER BY [System.ChangedDate] DESC`;

        const args = [
          "boards", "query",
          "--wiql", wiql,
          "--output", "json",
          ...baseArgs(config),
        ];
        const r = await api.process.exec("az", args, { timeout: 30000 });
        if (!mountedRef.current) return;
        if (r.exitCode !== 0 || !r.stdout.trim()) {
          setError("Failed to query work items. Is the Azure CLI installed and authenticated?");
          workItemState.setLoading(false);
          return;
        }
        const parsed = JSON.parse(r.stdout);
        ids = (parsed as Array<Record<string, unknown>>).map(
          (wi) => (wi.id as number) || 0,
        ).filter(Boolean);
      }

      // Limit to 50 for performance
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

  // Initial fetch
  useEffect(() => {
    if (workItemState.items.length === 0 && config.organization && config.project) {
      fetchItems();
    }
  }, [fetchItems]);

  // React to refresh requests
  useEffect(() => {
    if (needsRefresh) {
      workItemState.needsRefresh = false;
      fetchItems();
    }
  }, [needsRefresh, fetchItems]);

  // Re-fetch on settings change
  useEffect(() => {
    const unsub = api.settings.onChange(() => {
      workItemState.requestRefresh();
    });
    return () => unsub.dispose();
  }, [api]);

  // Filter items by search query (client-side)
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      i => i.title.toLowerCase().includes(q) || `#${i.id}`.includes(q),
    );
  }, [items, searchQuery]);

  // Collect unique states and types for filter dropdowns
  const availableStates = useMemo(() => {
    const states = new Set(items.map(i => i.state));
    return Array.from(states).sort();
  }, [items]);

  const availableTypes = useMemo(() => {
    const types = new Set(items.map(i => i.workItemType));
    return Array.from(types).sort();
  }, [items]);

  if (!config.organization || !config.project) {
    return <ConfigWarning />;
  }

  if (error) {
    return (
      <div style={{ ...sidebarContainer, justifyContent: "center", alignItems: "center" }}>
        <div style={{ padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--text-error, #f87171)", marginBottom: "8px" }}>
            Could not load work items
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary, #888)", marginBottom: "12px" }}>
            {error}
          </div>
          <button onClick={() => fetchItems()} style={btnSecondarySmall}>
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
        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)" }}>
          Work Items
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            onClick={() => fetchItems()}
            disabled={loading}
            title="Refresh work items"
            style={sidebarHeaderBtn}
          >
            {"\u21bb"}
          </button>
          <button
            onClick={() => workItemState.setCreatingNew(true)}
            title="Create a new work item"
            style={sidebarHeaderBtn}
          >
            + New
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-color, #222)", display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            workItemState.setSearchQuery((e.target as HTMLInputElement).value)
          }
          placeholder="Filter\u2026"
          style={{
            flex: 1,
            minWidth: "60px",
            padding: "4px 6px",
            fontSize: "11px",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "4px",
            background: "var(--input-bg, #1a1a2e)",
            color: "var(--text-primary, #e0e0e0)",
            fontFamily: "var(--font-family)",
            outline: "none",
          }}
        />
        <select
          value={stateFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            workItemState.setStateFilter((e.target as HTMLSelectElement).value)
          }
          style={filterSelect}
        >
          <option value="">All States</option>
          {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            workItemState.setTypeFilter((e.target as HTMLSelectElement).value)
          }
          style={filterSelect}
        >
          <option value="">All Types</option>
          {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Work item list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && items.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--text-secondary, #888)" }}>
            Loading work items{"\u2026"}
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--text-secondary, #888)" }}>
            {searchQuery ? "No matching work items" : "No work items found"}
          </div>
        ) : (
          <div style={{ padding: "2px 0" }}>
            {filteredItems.map(item => (
              <div
                key={item.id}
                onClick={() => workItemState.setSelectedItem(item.id)}
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                  background: item.id === selected ? "var(--item-active-bg, #2a2a4a)" : "transparent",
                }}
              >
                {/* Top row: type indicator + ID + title */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                  <span
                    style={{
                      width: "3px",
                      height: "14px",
                      borderRadius: "2px",
                      background: typeColor(item.workItemType),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: "10px", color: "var(--text-secondary, #888)", flexShrink: 0 }}>
                    #{item.id}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-primary, #e0e0e0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </span>
                </div>
                {/* Bottom row: type + state + time */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", paddingLeft: "9px" }}>
                  <span style={{ fontSize: "9px", color: typeColor(item.workItemType), flexShrink: 0 }}>
                    {item.workItemType}
                  </span>
                  {(() => {
                    const colors = stateColor(item.state);
                    return (
                      <span
                        style={{
                          fontSize: "9px",
                          padding: "0 5px",
                          borderRadius: "10px",
                          backgroundColor: colors.bg,
                          color: colors.fg,
                          border: `1px solid ${colors.border}`,
                          flexShrink: 0,
                        }}
                      >
                        {item.state}
                      </span>
                    );
                  })()}
                  {item.assignedTo && (
                    <span style={{ fontSize: "9px", color: "var(--text-secondary, #666)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.assignedTo}
                    </span>
                  )}
                  <span style={{ fontSize: "10px", color: "var(--text-secondary, #888)", marginLeft: "auto", flexShrink: 0 }}>
                    {relativeTime(item.changedDate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MainPanel
// ---------------------------------------------------------------------------

export function MainPanel({ api }: PanelProps) {
  const [selected, setSelected] = useState<number | null>(workItemState.selectedId);
  const [creatingNew, setCreatingNew] = useState(workItemState.creatingNew);
  const [detail, setDetail] = useState<WorkItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [showStateDialog, setShowStateDialog] = useState(false);
  const [detailVersion, setDetailVersion] = useState(0);

  const config = getConfig(api);

  // Create form state
  const [newType, setNewType] = useState(config.defaultWorkItemType || "Task");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAreaPath, setNewAreaPath] = useState(config.areaPath || "");
  const [newIterationPath, setNewIterationPath] = useState(config.iterationPath || "");
  const [newPriority, setNewPriority] = useState("3");
  const [newTags, setNewTags] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editTags, setEditTags] = useState("");

  // Comment form state
  const [commentBody, setCommentBody] = useState("");

  // Refs for command-triggered actions
  const handleToggleStateRef = useRef<(() => void) | null>(null);
  const handleViewInBrowserRef = useRef<(() => void) | null>(null);

  // Subscribe to shared state
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

  // Fetch detail when selection changes
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
        "boards", "work-item", "show",
        "--id", String(selected),
        "--output", "json",
        ...baseArgs(config),
      ];
      const r = await api.process.exec("az", args, { timeout: 30000 });
      if (cancelled) return;
      if (r.exitCode === 0 && r.stdout.trim()) {
        const raw = JSON.parse(r.stdout) as Record<string, unknown>;
        const parsed = parseWorkItemDetail(raw, config);

        // Fetch comments
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
      if (!cancelled) { setDetail(null); setLoading(false); }
    });

    return () => { cancelled = true; };
  }, [selected, api, detailVersion, config.organization, config.project]);

  const refreshDetail = useCallback(() => setDetailVersion(v => v + 1), []);

  // -- Edit handlers -------------------------------------------------------

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
    const args: string[] = [
      "boards", "work-item", "update",
      "--id", String(detail.id),
      "--output", "json",
      ...baseArgs(config),
    ];

    const fields: string[] = [];
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

    // Check if anything actually changed
    const baseArgCount = 5 + baseArgs(config).length; // boards, work-item, update, --id, N, --output, json + base
    if (args.length <= baseArgCount + 2) { // +2 for --output json
      setEditing(false);
      return;
    }

    const r = await api.process.exec("az", args, { timeout: 30000 });
    if (r.exitCode === 0) {
      api.ui.showNotice("Work item updated");
      setEditing(false);
      refreshDetail();
      workItemState.requestRefresh();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to update work item");
    }
  }, [detail, editTitle, editDescription, editAssignedTo, editTags, api, config, refreshDetail]);

  // -- Comment handler -----------------------------------------------------

  const handleAddComment = useCallback(async () => {
    if (!detail || !commentBody.trim()) return;
    const args = [
      "boards", "work-item", "update",
      "--id", String(detail.id),
      "--discussion", commentBody.trim(),
      "--output", "json",
      ...baseArgs(config),
    ];
    const r = await api.process.exec("az", args, { timeout: 30000 });
    if (r.exitCode === 0) {
      api.ui.showNotice("Comment added");
      setCommentBody("");
      refreshDetail();
    } else {
      api.ui.showError(r.stderr.trim() || "Failed to add comment");
    }
  }, [detail, commentBody, api, config, refreshDetail]);

  // -- State change handler ------------------------------------------------

  const handleToggleState = useCallback(() => {
    if (!detail) return;
    setShowStateDialog(true);
  }, [detail]);

  // Keep refs current
  handleToggleStateRef.current = handleToggleState;
  handleViewInBrowserRef.current = detail ? () => api.ui.openExternalUrl(detail.url) : null;

  // -- Create form handlers ------------------------------------------------

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const args = [
      "boards", "work-item", "create",
      "--type", newType,
      "--title", newTitle.trim(),
      "--output", "json",
      ...baseArgs(config),
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

    const fields: string[] = [];
    if (newPriority) {
      fields.push(`Microsoft.VSTS.Common.Priority=${newPriority}`);
    }
    if (newTags.trim()) {
      fields.push(`System.Tags=${newTags.trim()}`);
    }
    if (fields.length > 0) {
      args.push("--fields", ...fields);
    }

    const r = await api.process.exec("az", args, { timeout: 30000 });
    setCreating(false);
    if (r.exitCode === 0) {
      let createdId = "";
      try {
        const parsed = JSON.parse(r.stdout);
        createdId = ` #${parsed.id}`;
      } catch { /* ignore */ }
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

  // ── Create form view ────────────────────────────────────────────────

  if (creatingNew) {
    return (
      <div style={mainContainer}>
        <div style={mainHeader}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)" }}>
            New Work Item
          </span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Type */}
            <div>
              <label style={formLabel}>Type</label>
              <select
                value={newType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setNewType((e.target as HTMLSelectElement).value)
                }
                style={formInput}
              >
                <option value="Epic">Epic</option>
                <option value="Feature">Feature</option>
                <option value="User Story">User Story</option>
                <option value="Product Backlog Item">Product Backlog Item</option>
                <option value="Bug">Bug</option>
                <option value="Task">Task</option>
                <option value="Issue">Issue</option>
                <option value="Impediment">Impediment</option>
              </select>
            </div>

            {/* Title */}
            <div>
              <label style={formLabel}>Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewTitle((e.target as HTMLInputElement).value)
                }
                placeholder="Work item title"
                style={formInput}
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label style={formLabel}>Description</label>
              <textarea
                value={newDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setNewDescription((e.target as HTMLTextAreaElement).value)
                }
                placeholder="Describe the work item\u2026"
                rows={8}
                style={{ ...formInput, resize: "vertical" as const }}
              />
            </div>

            {/* Area Path */}
            <div>
              <label style={formLabel}>Area Path</label>
              <input
                type="text"
                value={newAreaPath}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewAreaPath((e.target as HTMLInputElement).value)
                }
                placeholder={config.areaPath || config.project}
                style={formInput}
              />
            </div>

            {/* Iteration Path */}
            <div>
              <label style={formLabel}>Iteration Path</label>
              <input
                type="text"
                value={newIterationPath}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewIterationPath((e.target as HTMLInputElement).value)
                }
                placeholder={config.iterationPath || config.project}
                style={formInput}
              />
            </div>

            {/* Priority */}
            <div>
              <label style={formLabel}>Priority</label>
              <select
                value={newPriority}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setNewPriority((e.target as HTMLSelectElement).value)
                }
                style={formInput}
              >
                <option value="1">1 - Critical</option>
                <option value="2">2 - High</option>
                <option value="3">3 - Medium</option>
                <option value="4">4 - Low</option>
              </select>
            </div>

            {/* Tags */}
            <div>
              <label style={formLabel}>Tags</label>
              <input
                type="text"
                value={newTags}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewTags((e.target as HTMLInputElement).value)
                }
                placeholder="Tag1; Tag2; Tag3"
                style={formInput}
              />
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
            {creating ? "Creating\u2026" : "Create Work Item"}
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────

  if (selected === null) {
    return (
      <div style={{ ...mainContainer, justifyContent: "center", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--text-secondary, #888)" }}>
          Select a work item to view details
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ ...mainContainer, justifyContent: "center", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--text-secondary, #888)" }}>
          Loading work item{"\u2026"}
        </span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ ...mainContainer, justifyContent: "center", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--text-secondary, #888)" }}>
          Failed to load work item details
        </span>
      </div>
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────

  const sc = stateColor(detail.state);
  const stateBadge: React.CSSProperties = {
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "10px",
    cursor: "pointer",
    border: `1px solid ${sc.border}`,
    background: sc.bg,
    color: sc.fg,
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
            <span
              style={{
                width: "3px",
                height: "16px",
                borderRadius: "2px",
                background: typeColor(detail.workItemType),
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "12px", color: "var(--text-secondary, #888)", flexShrink: 0 }}>
              #{detail.id}
            </span>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", padding: "8px 16px", borderBottom: "1px solid var(--border-color, #222)", background: "var(--panel-bg-alt, rgba(0,0,0,0.15))" }}>
        <button onClick={() => setShowStateDialog(true)} style={stateBadge} title="Change state">
          {detail.state}
        </button>
        <span style={{ fontSize: "10px", color: typeColor(detail.workItemType), fontWeight: 500 }}>
          {detail.workItemType}
        </span>
        {detail.priority > 0 && (
          <span style={{ fontSize: "10px", color: "var(--text-secondary, #888)" }}>
            P{detail.priority} ({priorityLabel(detail.priority)})
          </span>
        )}
        <span style={{ fontSize: "10px", color: "var(--text-secondary, #888)" }}>
          by {detail.createdBy}
        </span>
        <span style={{ fontSize: "10px", color: "var(--text-secondary, #888)" }}>
          created {relativeTime(detail.createdDate)}
        </span>

        {/* Assigned To */}
        {editing ? (
          <input
            type="text"
            value={editAssignedTo}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEditAssignedTo((e.target as HTMLInputElement).value)
            }
            placeholder="Assigned to"
            style={{ fontSize: "10px", padding: "2px 6px", background: "var(--input-bg, #1a1a2e)", border: "1px solid var(--border-color, #333)", borderRadius: "4px", color: "var(--text-primary, #e0e0e0)", fontFamily: "var(--font-family)", outline: "none" }}
          />
        ) : detail.assignedTo ? (
          <span style={{ fontSize: "10px", padding: "1px 6px", background: "var(--item-active-bg, #2a2a4a)", color: "var(--text-secondary, #aaa)", borderRadius: "4px" }}>
            {detail.assignedTo}
          </span>
        ) : null}

        {/* Area + Iteration paths */}
        {detail.areaPath && (
          <span style={{ fontSize: "9px", color: "var(--text-secondary, #666)" }}>
            Area: {detail.areaPath}
          </span>
        )}
        {detail.iterationPath && (
          <span style={{ fontSize: "9px", color: "var(--text-secondary, #666)" }}>
            Iter: {detail.iterationPath}
          </span>
        )}

        {/* Tags */}
        {editing ? (
          <input
            type="text"
            value={editTags}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEditTags((e.target as HTMLInputElement).value)
            }
            placeholder="Tags (semicolon separated)"
            style={{ fontSize: "10px", padding: "2px 6px", background: "var(--input-bg, #1a1a2e)", border: "1px solid var(--border-color, #333)", borderRadius: "4px", color: "var(--text-primary, #e0e0e0)", fontFamily: "var(--font-family)", outline: "none" }}
          />
        ) : detail.tags ? (
          detail.tags.split(";").map(tag => tag.trim()).filter(Boolean).map(tag => (
            <span
              key={tag}
              style={{
                fontSize: "9px",
                padding: "0 5px",
                borderRadius: "10px",
                backgroundColor: "rgba(100,100,200,0.15)",
                color: "#8888cc",
                border: "1px solid rgba(100,100,200,0.3)",
              }}
            >
              {tag}
            </span>
          ))
        ) : null}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Description */}
        {editing ? (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color, #222)" }}>
            <textarea
              value={editDescription}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setEditDescription((e.target as HTMLTextAreaElement).value)
              }
              placeholder="Work item description\u2026"
              rows={10}
              style={{ ...formInput, resize: "vertical" as const }}
            />
          </div>
        ) : detail.description ? (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color, #222)" }}>
            <pre style={preStyle}>{stripHtml(detail.description)}</pre>
          </div>
        ) : (
          <div style={{ padding: "12px 16px", fontSize: "12px", color: "var(--text-secondary, #888)", fontStyle: "italic", borderBottom: "1px solid var(--border-color, #222)" }}>
            No description provided.
          </div>
        )}

        {/* Discussion / Comments */}
        {detail.comments.length > 0 && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color, #222)" }}>
            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)", marginBottom: "12px" }}>
              {detail.comments.length} comment{detail.comments.length === 1 ? "" : "s"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {detail.comments.map((comment, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid var(--border-color, #222)",
                    borderRadius: "6px",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", background: "var(--panel-bg-alt, rgba(0,0,0,0.15))", borderBottom: "1px solid var(--border-color, #222)" }}>
                    <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)" }}>
                      {comment.author}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--text-secondary, #888)" }}>
                      {relativeTime(comment.createdDate)}
                    </span>
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <pre style={preStyle}>{stripHtml(comment.body)}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add comment */}
        <div style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary, #e0e0e0)", marginBottom: "8px" }}>
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
          item={detail}
          onClose={() => setShowAgentDialog(false)}
        />
      )}

      {/* State picker dialog */}
      {showStateDialog && detail && (
        <StatePickerDialog
          api={api}
          item={detail}
          config={config}
          onClose={() => setShowStateDialog(false)}
          onStateChanged={() => {
            refreshDetail();
            workItemState.requestRefresh();
          }}
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
  fontFamily: "var(--font-family)",
  background: "var(--sidebar-bg, #181825)",
};

const sidebarHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border-color, #222)",
};

const sidebarHeaderBtn: React.CSSProperties = {
  padding: "2px 8px",
  fontSize: "12px",
  color: "var(--text-secondary, #888)",
  background: "transparent",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontFamily: "var(--font-family)",
};

const mainContainer: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  fontFamily: "var(--font-family)",
  background: "var(--panel-bg, #1e1e2e)",
};

const mainHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "8px 16px",
  borderBottom: "1px solid var(--border-color, #222)",
  background: "var(--sidebar-bg, #181825)",
  flexShrink: 0,
};

const mainFooter: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  padding: "10px 16px",
  borderTop: "1px solid var(--border-color, #222)",
  background: "var(--sidebar-bg, #181825)",
  flexShrink: 0,
};

const formLabel: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--text-secondary, #aaa)",
  marginBottom: "4px",
};

const formInput: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border-color, #333)",
  background: "var(--input-bg, #1a1a2e)",
  color: "var(--text-primary, #e0e0e0)",
  fontSize: "13px",
  fontFamily: "var(--font-family)",
  boxSizing: "border-box",
  outline: "none",
};

const filterSelect: React.CSSProperties = {
  padding: "4px 4px",
  fontSize: "10px",
  border: "1px solid var(--border-color, #333)",
  borderRadius: "4px",
  background: "var(--input-bg, #1a1a2e)",
  color: "var(--text-primary, #e0e0e0)",
  fontFamily: "var(--font-family)",
  cursor: "pointer",
};

const preStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "13px",
  lineHeight: 1.6,
  color: "var(--text-primary, #e0e0e0)",
  margin: 0,
};

const btnPrimarySmall: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: "12px",
  fontWeight: 500,
  borderRadius: "4px",
  border: "none",
  background: "var(--accent-color, #4a6cf7)",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "var(--font-family)",
};

const btnSecondarySmall: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: "12px",
  borderRadius: "4px",
  border: "1px solid var(--border-color, #333)",
  background: "transparent",
  color: "var(--text-primary, #e0e0e0)",
  cursor: "pointer",
  fontFamily: "var(--font-family)",
};
