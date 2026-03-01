// ---------------------------------------------------------------------------
// MemberCard — Displays a single group member with status and actions
// ---------------------------------------------------------------------------

import type { PluginAPI } from "@clubhouse/plugin-types";
import type { GroupMember } from "../types";

const React = globalThis.React;

interface MemberCardProps {
  api: PluginAPI;
  member: GroupMember;
  onRemove: (memberId: string) => void;
  onSetLeader: (memberId: string) => void;
}

function memberStatusIcon(status: string): string {
  switch (status) {
    case "working": return "●";
    case "blocked": return "!";
    case "done": return "✓";
    case "error": return "✗";
    case "creating": return "…";
    default: return "○";
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

export function MemberCard({ api, member, onRemove, onSetLeader }: MemberCardProps) {
  const { AgentAvatar } = api.widgets;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 6,
      border: "1px solid var(--border-primary)",
      background: member.isLeader ? "var(--bg-accent)" : "var(--bg-primary)",
      marginBottom: 4,
    }}>
      {/* Avatar */}
      <AgentAvatar agentId={member.agentId} size="sm" showStatusRing />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {member.isLeader && (
            <span title="Group leader" style={{ fontSize: 12 }}>&#9733;</span>
          )}
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            fontFamily: "var(--font-family)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {member.agentName}
          </span>
        </div>
        <div style={{
          fontSize: 11,
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-family)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {member.projectName}
        </div>
      </div>

      {/* Status */}
      <span
        title={member.status}
        style={{
          fontSize: 13,
          color: memberStatusColor(member.status),
          fontWeight: 600,
        }}
      >
        {memberStatusIcon(member.status)}
      </span>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4 }}>
        {!member.isLeader && (
          <button
            onClick={() => onSetLeader(member.id)}
            title="Make leader"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 11,
              padding: "2px 4px",
              borderRadius: 4,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-accent)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
          >
            &#9733;
          </button>
        )}
        <button
          onClick={() => onRemove(member.id)}
          title="Remove member"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 12,
            padding: "2px 4px",
            borderRadius: 4,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-error)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
        >
          x
        </button>
      </div>
    </div>
  );
}
