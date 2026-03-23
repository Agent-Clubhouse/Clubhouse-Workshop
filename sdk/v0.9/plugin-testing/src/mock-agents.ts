import type { AgentInfo, PluginAPI } from "@clubhouse/plugin-types";

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

const defaults: AgentInfo = {
  id: "agent-1",
  name: "Agent 1",
  kind: "durable",
  status: "running",
  color: "#4A9EFF",
  projectId: "test-project",
};

/**
 * Pre-populates a mock API's agents with test data.
 *
 * ```ts
 * const api = createMockAPI();
 * createMockAgents(api, [
 *   { id: "a1", name: "Research Agent", status: "running" },
 *   { id: "a2", name: "Review Agent", status: "sleeping" },
 * ]);
 * const agents = api.agents.list();
 * // agents.length === 2
 * ```
 */
export function createMockAgents(
  api: PluginAPI,
  agents: DeepPartial<AgentInfo>[],
): void {
  const fullAgents: AgentInfo[] = agents.map((partial, i) => ({
    ...defaults,
    id: `agent-${i + 1}`,
    name: `Agent ${i + 1}`,
    ...partial,
  })) as AgentInfo[];

  // Override list() to return these agents (SYNC)
  (api.agents.list as { mockReturnValue?: (val: unknown) => void }).mockReturnValue?.(fullAgents);
}
