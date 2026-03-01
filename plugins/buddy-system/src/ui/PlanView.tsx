// ---------------------------------------------------------------------------
// PlanView — Displays the group plan with deliverables and status
// ---------------------------------------------------------------------------

import type { BuddyGroup, Deliverable, GroupMember } from "../types";

const React = globalThis.React;

interface PlanViewProps {
  group: BuddyGroup;
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

function findMember(group: BuddyGroup, memberId: string): GroupMember | undefined {
  return group.members.find(m => m.id === memberId);
}

export function PlanView({ group }: PlanViewProps) {
  if (!group.plan) return null;

  const { plan } = group;
  const completedCount = plan.deliverables.filter(d => d.status === "complete").length;
  const totalCount = plan.deliverables.length;

  return (
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
        Plan ({completedCount}/{totalCount} complete)
      </h3>

      {/* Summary */}
      <div style={{
        fontSize: 13,
        color: "var(--text-primary)",
        fontFamily: "var(--font-family)",
        background: "var(--bg-surface)",
        padding: "10px 14px",
        borderRadius: 6,
        lineHeight: 1.5,
        marginBottom: 12,
      }}>
        {plan.summary.length > 300 ? `${plan.summary.slice(0, 300)}...` : plan.summary}
      </div>

      {/* Deliverables */}
      {plan.deliverables.map(d => {
        const assignee = findMember(group, d.assigneeId);
        return (
          <div
            key={d.id}
            style={{
              padding: "10px 14px",
              marginBottom: 4,
              borderRadius: 6,
              border: "1px solid var(--border-primary)",
              background: d.status === "complete" ? "var(--bg-success)" : "var(--bg-primary)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}>
                  {d.id.toUpperCase()}
                </span>
                <span style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-family)",
                }}>
                  {d.title}
                </span>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 500,
                color: deliverableStatusColor(d.status),
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}>
                {deliverableStatusLabel(d.status)}
              </span>
            </div>
            <div style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              marginTop: 4,
              fontFamily: "var(--font-family)",
            }}>
              {assignee
                ? `→ ${assignee.agentName} (${assignee.projectName})`
                : `→ unassigned`}
              {d.dependencies?.length
                ? ` · depends on ${d.dependencies.join(", ")}`
                : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
