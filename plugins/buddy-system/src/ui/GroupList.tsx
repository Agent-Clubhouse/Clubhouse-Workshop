// ---------------------------------------------------------------------------
// GroupList — Shows all buddy groups with create/delete actions
// ---------------------------------------------------------------------------

import type { PluginAPI } from "@clubhouse/plugin-types";
import type { BuddyGroup } from "../types";

const React = globalThis.React;

interface GroupListProps {
  api: PluginAPI;
  groups: BuddyGroup[];
  onSelect: (group: BuddyGroup) => void;
  onCreate: () => void;
  onDelete: (groupId: string) => void;
}

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

export function GroupList({ groups, onSelect, onCreate, onDelete }: GroupListProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 20px 12px",
        borderBottom: "1px solid var(--border-primary)",
      }}>
        <h2 style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-primary)",
          fontFamily: "var(--font-family)",
        }}>
          Buddy Groups
        </h2>
        <button
          onClick={onCreate}
          style={{
            background: "var(--bg-accent)",
            color: "var(--text-accent)",
            border: "1px solid var(--border-accent)",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "var(--font-family)",
          }}
        >
          + New Group
        </button>
      </div>

      {/* Group list */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 12px" }}>
        {groups.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "48px 24px",
            color: "var(--text-tertiary)",
            fontSize: 14,
            fontFamily: "var(--font-family)",
          }}>
            No buddy groups yet. Create one to get started.
          </div>
        )}
        {groups.map(group => (
          <div
            key={group.id}
            onClick={() => onSelect(group)}
            style={{
              padding: "14px 16px",
              marginBottom: 6,
              borderRadius: 8,
              border: "1px solid var(--border-primary)",
              cursor: "pointer",
              background: "var(--bg-primary)",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-surface-hover)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-primary)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
              }}>
                {group.name}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: statusColor(group.status),
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>
                  {STATUS_LABELS[group.status] ?? group.status}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(group.id); }}
                  title="Delete group"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "2px 4px",
                    lineHeight: 1,
                    borderRadius: 4,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-error)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                >
                  x
                </button>
              </div>
            </div>
            <div style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              marginTop: 4,
              fontFamily: "var(--font-family)",
            }}>
              {group.members.length} member{group.members.length !== 1 ? "s" : ""}
              {group.mission ? ` · ${group.mission.slice(0, 60)}${group.mission.length > 60 ? "..." : ""}` : " · No work assigned"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
