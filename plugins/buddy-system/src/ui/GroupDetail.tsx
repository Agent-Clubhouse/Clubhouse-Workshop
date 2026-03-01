// ---------------------------------------------------------------------------
// GroupDetail — Single group view with members, status, and management
// ---------------------------------------------------------------------------

import type { PluginAPI, AgentInfo, ProjectInfo } from "@clubhouse/plugin-types";
import type { BuddyGroup } from "../types";
import type { GroupStore } from "../state/groups";
import { MemberCard } from "./MemberCard";
import { AddMemberDialog } from "./AddMemberDialog";

const React = globalThis.React;
const { useState, useCallback } = React;

interface GroupDetailProps {
  api: PluginAPI;
  group: BuddyGroup;
  store: GroupStore;
  onBack: () => void;
  onGroupUpdated: (group: BuddyGroup) => void;
}

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  planning: "Planning",
  executing: "Executing",
  complete: "Complete",
  archived: "Archived",
};

export function GroupDetail({ api, group, store, onBack, onGroupUpdated }: GroupDetailProps) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(group.name);
  const [showAddMember, setShowAddMember] = useState(false);

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

  const handleAddMember = useCallback(async (
    agent: AgentInfo,
    project: ProjectInfo,
    context: string,
  ) => {
    const updated = await store.addMember(group.id, {
      agentId: agent.id,
      agentName: agent.name,
      projectId: project.id,
      projectName: project.name,
      context,
    });
    onGroupUpdated(updated);
    setShowAddMember(false);
  }, [group.id, store, onGroupUpdated]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "16px 20px 12px",
        borderBottom: "1px solid var(--border-primary)",
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 16,
            padding: "0 4px",
            fontFamily: "var(--font-family)",
          }}
        >
          &larr;
        </button>

        {editing ? (
          <input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setNameInput(group.name); setEditing(false); } }}
            autoFocus
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-accent)",
              borderRadius: 4,
              padding: "2px 8px",
              outline: "none",
            }}
          />
        ) : (
          <h2
            onClick={() => { setNameInput(group.name); setEditing(true); }}
            title="Click to rename"
            style={{
              margin: 0,
              flex: 1,
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              cursor: "text",
            }}
          >
            {group.name}
          </h2>
        )}

        <span style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          padding: "3px 8px",
          borderRadius: 4,
          background: "var(--bg-surface)",
        }}>
          {STATUS_LABELS[group.status] ?? group.status}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
        {/* Members section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontFamily: "var(--font-family)",
            }}>
              Members ({group.members.length})
            </h3>
            <button
              onClick={() => setShowAddMember(true)}
              style={{
                background: "none",
                border: "1px solid var(--border-primary)",
                color: "var(--text-secondary)",
                borderRadius: 4,
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "var(--font-family)",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-accent)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-primary)"; }}
            >
              + Add
            </button>
          </div>

          {showAddMember && (
            <AddMemberDialog
              api={api}
              existingAgentIds={group.members.map(m => m.agentId)}
              onAdd={handleAddMember}
              onCancel={() => setShowAddMember(false)}
            />
          )}

          {group.members.length === 0 && !showAddMember && (
            <div style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-family)",
              padding: "12px 0",
            }}>
              No members yet. Add durable agents from your projects.
            </div>
          )}

          {group.members.map(member => (
            <MemberCard
              key={member.id}
              api={api}
              member={member}
              onRemove={handleRemoveMember}
              onSetLeader={handleSetLeader}
            />
          ))}
        </div>

        {/* Mission section (placeholder for Phase 2) */}
        {group.mission && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{
              margin: "0 0 8px 0",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontFamily: "var(--font-family)",
            }}>
              Mission
            </h3>
            <div style={{
              fontSize: 13,
              color: "var(--text-primary)",
              fontFamily: "var(--font-family)",
              background: "var(--bg-surface)",
              padding: "12px 14px",
              borderRadius: 6,
              lineHeight: 1.5,
            }}>
              {group.mission}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
