// ---------------------------------------------------------------------------
// Buddy System — Main entry point
// All JSX must live in this single file (esbuild creates duplicate
// react/jsx-runtime imports per .tsx file, which breaks the plugin runtime).
// ---------------------------------------------------------------------------

import type {
  PluginContext,
  PluginAPI,
  PanelProps,
  AgentInfo,
  ProjectInfo,
} from "@clubhouse/plugin-types";
import type { BuddyGroup, GroupMember, Deliverable, MemberStatus } from "./types";
import { createGroupStore, type GroupStore } from "./state/groups";
import { createSharedDirectory, type SharedDirectory } from "./orchestration/shared-dir";
import { createPlanner, type PlannerOrchestrator } from "./orchestration/planner";
import { createGroupMonitor, type GroupMonitor, type MonitorEvent } from "./orchestration/monitor";
import { createConfigInjector, type ConfigInjector } from "./config/injector";
import { useTheme } from "./use-theme";

const React = globalThis.React;
const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let groupStore: GroupStore | null = null;
let sharedDir: SharedDirectory | null = null;
let planner: PlannerOrchestrator | null = null;
let monitor: GroupMonitor | null = null;
let injector: ConfigInjector | null = null;
let monitorListeners: Array<(groupId: string, event: MonitorEvent) => void> = [];

function onMonitorEvent(groupId: string, event: MonitorEvent): void {
  for (const listener of monitorListeners) {
    listener(groupId, event);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Buddy System plugin activated");

  groupStore = createGroupStore(api.storage.global);
  sharedDir = createSharedDirectory(api.files);
  injector = createConfigInjector(api.agentConfig);
  planner = createPlanner(api, groupStore, sharedDir, injector);
  monitor = createGroupMonitor(api, groupStore, sharedDir, onMonitorEvent);

  const createCmd = api.commands.register("buddy-system.new-group", async () => {
    if (!groupStore) return;
    try {
      const group = await groupStore.create();
      api.ui.showNotice(`Created buddy group: ${group.name}`);
    } catch (err) {
      api.ui.showError(`Failed to create group: ${err}`);
    }
  });
  ctx.subscriptions.push(createCmd);

  const assignCmd = api.commands.register("buddy-system.assign-work", () => {
    api.ui.showNotice("Assign Work: Open the Buddy Groups panel to assign work to a group.");
  });
  ctx.subscriptions.push(assignCmd);

  ctx.subscriptions.push({ dispose: () => monitor?.stopAll() });
}

export function deactivate(): void {
  monitor?.stopAll();
  groupStore = null;
  sharedDir = null;
  planner = null;
  monitor = null;
  injector = null;
  monitorListeners = [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  planning: "Planning",
  executing: "Executing",
  complete: "Complete",
  archived: "Archived",
};

function statusColor(status: string): string {
  switch (status) {
    case "executing": return "var(--text-info)";
    case "planning": return "var(--text-warning)";
    case "complete": return "var(--text-success)";
    case "archived": return "var(--text-muted)";
    default: return "var(--text-secondary)";
  }
}

function memberStatusIcon(status: string): string {
  switch (status) {
    case "working": return "\u25cf";
    case "blocked": return "!";
    case "done": return "\u2713";
    case "error": return "\u2717";
    case "creating": return "\u2026";
    default: return "\u25cb";
  }
}

function memberStatusColor(status: string): string {
  switch (status) {
    case "working": return "var(--text-info)";
    case "blocked": return "var(--text-warning)";
    case "done": return "var(--text-success)";
    case "error": return "var(--text-error)";
    default: return "var(--text-muted)";
  }
}

function deliverableStatusColor(status: string): string {
  switch (status) {
    case "in-progress": return "var(--text-info)";
    case "review": return "var(--text-warning)";
    case "complete": return "var(--text-success)";
    case "blocked": return "var(--text-error)";
    default: return "var(--text-muted)";
  }
}

function deliverableStatusLabel(status: string): string {
  switch (status) {
    case "in-progress": return "Working";
    case "review": return "Review";
    case "complete": return "Done";
    case "blocked": return "Blocked";
    default: return "Pending";
  }
}

// ---------------------------------------------------------------------------
// MemberCard
// ---------------------------------------------------------------------------

function MemberCard({ api, member, onRemove, onSetLeader }: {
  api: PluginAPI;
  member: GroupMember;
  onRemove: (id: string) => void;
  onSetLeader: (id: string) => void;
}) {
  const { AgentAvatar } = api.widgets;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 6,
      border: "1px solid var(--border-primary)",
      background: member.isLeader ? "var(--bg-accent)" : "var(--bg-primary)",
      marginBottom: 4,
    }}>
      <AgentAvatar agentId={member.agentId} size="sm" showStatusRing />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {member.isLeader && <span title="Group leader" style={{ fontSize: 12 }}>&#9733;</span>}
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-family)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {member.agentName}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-family)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {member.projectName}
        </div>
      </div>
      <span title={member.status} style={{ fontSize: 13, color: memberStatusColor(member.status), fontWeight: 600 }}>
        {memberStatusIcon(member.status)}
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        {!member.isLeader && (
          <button onClick={() => onSetLeader(member.id)} title="Make leader" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11, padding: "2px 4px", borderRadius: 4 }}>
            &#9733;
          </button>
        )}
        <button onClick={() => onRemove(member.id)} title="Remove member" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, padding: "2px 4px", borderRadius: 4 }}>
          x
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddMemberDialog
// ---------------------------------------------------------------------------

function AddMemberDialog({ api, existingAgentIds, onAdd, onCancel }: {
  api: PluginAPI;
  existingAgentIds: string[];
  onAdd: (agent: AgentInfo, project: ProjectInfo, context: string) => void;
  onCancel: () => void;
}) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [context, setContext] = useState("");

  useEffect(() => {
    const allAgents = api.agents.list();
    const eligible = allAgents.filter(a => a.kind === "durable" && !existingAgentIds.includes(a.id));
    setAgents(eligible);
    setProjects(api.projects.list());
    if (eligible.length > 0) setSelectedAgentId(eligible[0].id);
  }, [api, existingAgentIds]);

  const selectedAgent = useMemo(() => agents.find(a => a.id === selectedAgentId), [agents, selectedAgentId]);
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedAgent?.projectId), [projects, selectedAgent]);

  const handleAdd = useCallback(() => {
    if (selectedAgent && selectedProject) onAdd(selectedAgent, selectedProject, context);
  }, [selectedAgent, selectedProject, context, onAdd]);

  return (
    <div style={{ padding: 16, border: "1px solid var(--border-accent)", borderRadius: 8, background: "var(--bg-secondary)", marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12, fontFamily: "var(--font-family)" }}>Add Member</div>
      {agents.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-family)", marginBottom: 12 }}>
          No eligible durable agents found. Start a durable agent in a project first.
        </div>
      ) : (
        <>
          <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4, fontFamily: "var(--font-family)" }}>Agent</label>
          <select value={selectedAgentId} onChange={e => setSelectedAgentId(e.target.value)} style={{ width: "100%", padding: "6px 8px", fontSize: 13, borderRadius: 4, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "var(--font-family)", marginBottom: 10 }}>
            {agents.map(a => {
              const proj = projects.find(p => p.id === a.projectId);
              return <option key={a.id} value={a.id}>{a.name} ({proj?.name ?? a.projectId})</option>;
            })}
          </select>
          <label style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4, fontFamily: "var(--font-family)" }}>Context</label>
          <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. Backend API agent" rows={2} style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "var(--font-family)", resize: "vertical", marginBottom: 12, boxSizing: "border-box" }} />
        </>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "6px 14px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border-primary)", background: "var(--bg-primary)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-family)" }}>Cancel</button>
        {agents.length > 0 && (
          <button onClick={handleAdd} disabled={!selectedAgent} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 500, borderRadius: 4, border: "1px solid var(--border-accent)", background: "var(--bg-accent)", color: "var(--text-accent)", cursor: selectedAgent ? "pointer" : "not-allowed", opacity: selectedAgent ? 1 : 0.5, fontFamily: "var(--font-family)" }}>Add Member</button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MissionInput
// ---------------------------------------------------------------------------

function MissionInput({ onSubmit, disabled, hasLeader, memberCount }: {
  onSubmit: (mission: string) => void;
  disabled: boolean;
  hasLeader: boolean;
  memberCount: number;
}) {
  const [text, setText] = useState("");
  const canSubmit = text.trim().length > 0 && hasLeader && memberCount >= 1 && !disabled;

  let hint = "";
  if (memberCount === 0) hint = "Add at least one member before assigning work.";
  else if (!hasLeader) hint = "Designate a group leader before assigning work.";
  else if (disabled) hint = "Group is already planning or executing.";

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-family)" }}>Assign Work</h3>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Describe what you want this group to accomplish..." rows={4} disabled={disabled} style={{ width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border-primary)", background: disabled ? "var(--bg-surface)" : "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "var(--font-family)", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5, opacity: disabled ? 0.6 : 1 }} />
      {hint && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "var(--font-family)" }}>{hint}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={() => { if (canSubmit) { onSubmit(text.trim()); setText(""); } }} disabled={!canSubmit} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: "1px solid var(--border-accent)", background: canSubmit ? "var(--bg-accent)" : "var(--bg-surface)", color: canSubmit ? "var(--text-accent)" : "var(--text-muted)", cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: "var(--font-family)" }}>Start Mission</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlanView
// ---------------------------------------------------------------------------

function PlanView({ group }: { group: BuddyGroup }) {
  if (!group.plan) return null;
  const { plan } = group;
  const completedCount = plan.deliverables.filter(d => d.status === "complete").length;

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-family)" }}>
        Plan ({completedCount}/{plan.deliverables.length} complete)
      </h3>
      <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-family)", background: "var(--bg-surface)", padding: "10px 14px", borderRadius: 6, lineHeight: 1.5, marginBottom: 12 }}>
        {plan.summary.length > 300 ? `${plan.summary.slice(0, 300)}...` : plan.summary}
      </div>
      {plan.deliverables.map(d => {
        const assignee = group.members.find(m => m.id === d.assigneeId);
        return (
          <div key={d.id} style={{ padding: "10px 14px", marginBottom: 4, borderRadius: 6, border: "1px solid var(--border-primary)", background: d.status === "complete" ? "var(--bg-success)" : "var(--bg-primary)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{d.id.toUpperCase()}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-family)" }}>{d.title}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: deliverableStatusColor(d.status), textTransform: "uppercase", letterSpacing: "0.03em" }}>{deliverableStatusLabel(d.status)}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "var(--font-family)" }}>
              {assignee ? `\u2192 ${assignee.agentName} (${assignee.projectName})` : "\u2192 unassigned"}
              {d.dependencies?.length ? ` \u00b7 depends on ${d.dependencies.join(", ")}` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupList
// ---------------------------------------------------------------------------

function GroupList({ api, groups, onSelect, onCreate, onDelete }: {
  api: PluginAPI;
  groups: BuddyGroup[];
  onSelect: (g: BuddyGroup) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid var(--border-primary)" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-family)" }}>Buddy Groups</h2>
        <button onClick={onCreate} style={{ background: "var(--bg-accent)", color: "var(--text-accent)", border: "1px solid var(--border-accent)", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-family)" }}>+ New Group</button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 12px" }}>
        {groups.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-tertiary)", fontSize: 14, fontFamily: "var(--font-family)" }}>
            No buddy groups yet. Create one to get started.
          </div>
        )}
        {groups.map(group => (
          <div key={group.id} onClick={() => onSelect(group)} style={{ padding: "14px 16px", marginBottom: 6, borderRadius: 8, border: "1px solid var(--border-primary)", cursor: "pointer", background: "var(--bg-primary)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{group.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: statusColor(group.status), textTransform: "uppercase", letterSpacing: "0.05em" }}>{STATUS_LABELS[group.status] ?? group.status}</span>
                <button onClick={e => { e.stopPropagation(); onDelete(group.id); }} title="Delete group" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: "2px 4px", lineHeight: 1, borderRadius: 4 }}>x</button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, fontFamily: "var(--font-family)" }}>
              {group.members.length} member{group.members.length !== 1 ? "s" : ""}{group.mission ? ` \u00b7 ${group.mission.slice(0, 60)}${group.mission.length > 60 ? "..." : ""}` : " \u00b7 No work assigned"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupDetail
// ---------------------------------------------------------------------------

function GroupDetail({ api, group, store, plannerRef, onBack, onGroupUpdated }: {
  api: PluginAPI;
  group: BuddyGroup;
  store: GroupStore;
  plannerRef: PlannerOrchestrator | null;
  onBack: () => void;
  onGroupUpdated: (g: BuddyGroup) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(group.name);
  const [showAddMember, setShowAddMember] = useState(false);
  const isActive = group.status === "planning" || group.status === "executing";

  const handleRename = useCallback(async () => {
    if (nameInput.trim() && nameInput.trim() !== group.name) {
      const updated = await store.rename(group.id, nameInput.trim());
      onGroupUpdated(updated);
    }
    setEditing(false);
  }, [group, nameInput, store, onGroupUpdated]);

  const handleRemoveMember = useCallback(async (memberId: string) => {
    const confirmed = await api.ui.showConfirm("Remove this member from the group?");
    if (!confirmed) return;
    const updated = await store.removeMember(group.id, memberId);
    onGroupUpdated(updated);
  }, [api, group.id, store, onGroupUpdated]);

  const handleSetLeader = useCallback(async (memberId: string) => {
    const updated = await store.setLeader(group.id, memberId);
    onGroupUpdated(updated);
  }, [group.id, store, onGroupUpdated]);

  const handleAddMember = useCallback(async (agent: AgentInfo, project: ProjectInfo, context: string) => {
    const updated = await store.addMember(group.id, {
      agentId: agent.id, agentName: agent.name,
      projectId: project.id, projectName: project.name, context,
    });
    onGroupUpdated(updated);
    setShowAddMember(false);
  }, [group.id, store, onGroupUpdated]);

  const handleAssignMission = useCallback(async (mission: string) => {
    if (!plannerRef) { api.ui.showError("Orchestration not available"); return; }
    try {
      group.mission = mission;
      await store.save(group);
      onGroupUpdated({ ...group });
      const updated = await plannerRef.startPlanning(group);
      onGroupUpdated(updated);
      api.ui.showNotice(`Mission assigned to ${group.name}. Leader is planning...`);
    } catch (err) {
      api.logging.error("Failed to start planning", { error: String(err) });
      api.ui.showError(`Failed to start mission: ${err}`);
    }
  }, [api, group, store, plannerRef, onGroupUpdated]);

  const handleApprovePlan = useCallback(async () => {
    if (!plannerRef) return;
    try {
      let updated = await plannerRef.processPlan(group);
      onGroupUpdated(updated);
      updated = await plannerRef.startExecution(updated);
      onGroupUpdated(updated);
      api.ui.showNotice(`Execution started for ${group.name}`);
    } catch (err) {
      api.logging.error("Failed to approve plan", { error: String(err) });
      api.ui.showError(`Failed to start execution: ${err}`);
    }
  }, [api, group, plannerRef, onGroupUpdated]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 12px", borderBottom: "1px solid var(--border-primary)" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 16, padding: "0 4px", fontFamily: "var(--font-family)" }}>&larr;</button>
        {editing ? (
          <input value={nameInput} onChange={e => setNameInput(e.target.value)} onBlur={handleRename} onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setNameInput(group.name); setEditing(false); } }} autoFocus style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)", background: "var(--bg-surface)", border: "1px solid var(--border-accent)", borderRadius: 4, padding: "2px 8px", outline: "none" }} />
        ) : (
          <h2 onClick={() => { setNameInput(group.name); setEditing(true); }} title="Click to rename" style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)", cursor: "text" }}>{group.name}</h2>
        )}
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "3px 8px", borderRadius: 4, background: "var(--bg-surface)" }}>{STATUS_LABELS[group.status] ?? group.status}</span>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
        {/* Members */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-family)" }}>Members ({group.members.length})</h3>
            {!isActive && (
              <button onClick={() => setShowAddMember(true)} style={{ background: "none", border: "1px solid var(--border-primary)", color: "var(--text-secondary)", borderRadius: 4, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-family)" }}>+ Add</button>
            )}
          </div>
          {showAddMember && <AddMemberDialog api={api} existingAgentIds={group.members.map(m => m.agentId)} onAdd={handleAddMember} onCancel={() => setShowAddMember(false)} />}
          {group.members.length === 0 && !showAddMember && (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-family)", padding: "12px 0" }}>No members yet. Add durable agents from your projects.</div>
          )}
          {group.members.map(m => <MemberCard key={m.id} api={api} member={m} onRemove={handleRemoveMember} onSetLeader={handleSetLeader} />)}
        </div>

        {/* Mission input (idle only) */}
        {group.status === "idle" && <MissionInput onSubmit={handleAssignMission} disabled={isActive} hasLeader={!!group.leaderId} memberCount={group.members.length} />}

        {/* Active mission */}
        {group.mission && group.status !== "idle" && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-family)" }}>Mission</h3>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-family)", background: "var(--bg-surface)", padding: "12px 14px", borderRadius: 6, lineHeight: 1.5 }}>{group.mission}</div>
          </div>
        )}

        {/* Plan approval */}
        {group.status === "planning" && !group.plan && (
          <div style={{ padding: 16, borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-info)", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-family)", marginBottom: 8 }}>The group leader is creating a plan. Once ready, click below to approve.</div>
            <button onClick={handleApprovePlan} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: "1px solid var(--border-accent)", background: "var(--bg-accent)", color: "var(--text-accent)", cursor: "pointer", fontFamily: "var(--font-family)" }}>Check for Plan & Approve</button>
          </div>
        )}

        <PlanView group={group} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MainPanel
// ---------------------------------------------------------------------------

export function MainPanel({ api }: PanelProps) {
  const { style: themeStyle } = useTheme(api.theme);
  const [groups, setGroups] = useState<BuddyGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const storeRef = useRef(groupStore);
  const plannerRef = useRef(planner);

  useEffect(() => {
    if (!storeRef.current) {
      storeRef.current = createGroupStore(api.storage.global);
    }
    if (!plannerRef.current && storeRef.current) {
      const sd = sharedDir ?? createSharedDirectory(api.files);
      const inj = injector ?? createConfigInjector(api.agentConfig);
      plannerRef.current = createPlanner(api, storeRef.current, sd, inj);
    }
  }, [api]);

  const loadGroups = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const allGroups = await store.loadAll();
    setGroups(allGroups);
    setLoaded(true);
    for (const g of allGroups) {
      if (g.status === "planning" || g.status === "executing") monitor?.start(g.id);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  useEffect(() => {
    const handleEvent = async (groupId: string, event: MonitorEvent) => {
      const store = storeRef.current;
      if (!store) return;
      if (event.type === "status-updated") {
        const group = await store.get(groupId);
        if (!group) return;
        const member = group.members.find(m => m.id === event.memberId);
        if (member) member.status = event.status.status as MemberStatus;
        if (event.status.status === "done" && member?.assignmentId && group.plan) {
          const d = group.plan.deliverables.find(x => x.id === member.assignmentId);
          if (d) d.status = "complete";
        }
        if (event.status.status === "working" && member?.assignmentId && group.plan) {
          const d = group.plan.deliverables.find(x => x.id === member.assignmentId);
          if (d && d.status === "pending") d.status = "in-progress";
        }
        await store.save(group);
        setGroups(prev => prev.map(g => g.id === groupId ? group : g));
      }
      if (event.type === "all-done") {
        const group = await store.get(groupId);
        if (group) {
          group.status = "complete";
          await store.save(group);
          setGroups(prev => prev.map(g => g.id === groupId ? group : g));
          monitor?.stop(groupId);
          api.ui.showNotice(`Buddy group "${group.name}" completed!`);
          api.badges.set({ key: `complete-${groupId}`, type: "dot", target: { appPlugin: true } });
        }
      }
      if (event.type === "plan-detected") {
        api.badges.set({ key: `plan-${groupId}`, type: "dot", target: { appPlugin: true } });
      }
    };
    monitorListeners.push(handleEvent);
    return () => { monitorListeners = monitorListeners.filter(l => l !== handleEvent); };
  }, [api]);

  const store = storeRef.current;
  if (!loaded || !store) {
    return (
      <div style={{ ...themeStyle, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-tertiary)", fontSize: 14, fontFamily: "var(--font-family)" }}>Loading...</span>
      </div>
    );
  }

  const handleCreate = async () => {
    try {
      const group = await store.create();
      setGroups(prev => [...prev, group]);
      api.ui.showNotice(`Created: ${group.name}`);
    } catch (err) {
      api.ui.showError(`Failed to create group: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleDelete = async (groupId: string) => {
    try {
      const confirmed = await api.ui.showConfirm("Delete this buddy group?");
      if (!confirmed) return;
      monitor?.stop(groupId);
      await store.remove(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
      if (selectedGroupId === groupId) setSelectedGroupId(null);
    } catch (err) {
      api.ui.showError(`Failed to delete group: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleGroupUpdated = (updated: BuddyGroup) => {
    setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
    if (updated.status === "planning" || updated.status === "executing") monitor?.start(updated.id);
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div style={{ ...themeStyle, height: "100%", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {selectedGroup ? (
        <GroupDetail api={api} group={selectedGroup} store={store} plannerRef={plannerRef.current} onBack={() => setSelectedGroupId(null)} onGroupUpdated={handleGroupUpdated} />
      ) : (
        <GroupList api={api} groups={groups} onSelect={g => setSelectedGroupId(g.id)} onCreate={handleCreate} onDelete={handleDelete} />
      )}
    </div>
  );
}
