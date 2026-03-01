// ---------------------------------------------------------------------------
// AddMemberDialog — Inline dialog for adding an agent to a buddy group
// ---------------------------------------------------------------------------

import type { PluginAPI, AgentInfo, ProjectInfo } from "@clubhouse/plugin-types";

const React = globalThis.React;
const { useState, useEffect, useMemo, useCallback } = React;

interface AddMemberDialogProps {
  api: PluginAPI;
  existingAgentIds: string[];
  onAdd: (agent: AgentInfo, project: ProjectInfo, context: string) => void;
  onCancel: () => void;
}

export function AddMemberDialog({ api, existingAgentIds, onAdd, onCancel }: AddMemberDialogProps) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [context, setContext] = useState("");

  useEffect(() => {
    const allAgents = api.agents.list();
    // Only show durable agents not already in the group
    const eligible = allAgents.filter(
      a => a.kind === "durable" && !existingAgentIds.includes(a.id)
    );
    setAgents(eligible);
    setProjects(api.projects.list());
    if (eligible.length > 0) setSelectedAgentId(eligible[0].id);
  }, [api, existingAgentIds]);

  const selectedAgent = useMemo(
    () => agents.find(a => a.id === selectedAgentId),
    [agents, selectedAgentId],
  );

  const selectedProject = useMemo(
    () => projects.find(p => p.id === selectedAgent?.projectId),
    [projects, selectedAgent],
  );

  const handleAdd = useCallback(() => {
    if (selectedAgent && selectedProject) {
      onAdd(selectedAgent, selectedProject, context);
    }
  }, [selectedAgent, selectedProject, context, onAdd]);

  return (
    <div style={{
      padding: 16,
      border: "1px solid var(--border-accent)",
      borderRadius: 8,
      background: "var(--bg-secondary)",
      marginBottom: 8,
    }}>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-primary)",
        marginBottom: 12,
        fontFamily: "var(--font-family)",
      }}>
        Add Member
      </div>

      {agents.length === 0 ? (
        <div style={{
          fontSize: 12,
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-family)",
          marginBottom: 12,
        }}>
          No eligible durable agents found. Start a durable agent in a project first.
        </div>
      ) : (
        <>
          {/* Agent select */}
          <label style={{
            display: "block",
            fontSize: 11,
            color: "var(--text-secondary)",
            marginBottom: 4,
            fontFamily: "var(--font-family)",
          }}>
            Agent
          </label>
          <select
            value={selectedAgentId}
            onChange={e => setSelectedAgentId(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 4,
              border: "1px solid var(--border-primary)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-family)",
              marginBottom: 10,
            }}
          >
            {agents.map(a => {
              const proj = projects.find(p => p.id === a.projectId);
              return (
                <option key={a.id} value={a.id}>
                  {a.name} ({proj?.name ?? a.projectId})
                </option>
              );
            })}
          </select>

          {/* Context */}
          <label style={{
            display: "block",
            fontSize: 11,
            color: "var(--text-secondary)",
            marginBottom: 4,
            fontFamily: "var(--font-family)",
          }}>
            Context (role and project info)
          </label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="e.g. Backend API agent, handles auth endpoints"
            rows={2}
            style={{
              width: "100%",
              padding: "6px 8px",
              fontSize: 12,
              borderRadius: 4,
              border: "1px solid var(--border-primary)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-family)",
              resize: "vertical",
              marginBottom: 12,
              boxSizing: "border-box",
            }}
          />
        </>
      )}

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            borderRadius: 4,
            border: "1px solid var(--border-primary)",
            background: "var(--bg-primary)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontFamily: "var(--font-family)",
          }}
        >
          Cancel
        </button>
        {agents.length > 0 && (
          <button
            onClick={handleAdd}
            disabled={!selectedAgent}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 4,
              border: "1px solid var(--border-accent)",
              background: "var(--bg-accent)",
              color: "var(--text-accent)",
              cursor: selectedAgent ? "pointer" : "not-allowed",
              opacity: selectedAgent ? 1 : 0.5,
              fontFamily: "var(--font-family)",
            }}
          >
            Add Member
          </button>
        )}
      </div>
    </div>
  );
}
