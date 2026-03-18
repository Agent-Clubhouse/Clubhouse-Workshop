export type MissedRunPolicy = 'ignore' | 'run-once' | 'run-all';

export interface Automation {
  id: string;
  name: string;
  cronExpression: string;
  orchestrator: string;
  model: string;
  freeAgentMode: boolean;
  prompt: string;
  enabled: boolean;
  missedRunPolicy: MissedRunPolicy;
  createdAt: number;
  lastRunAt: number | null;
  /** Target project/worktree ID. Empty string or undefined means active project. */
  worktree?: string;
}

export type RunStatus = 'running' | 'completed' | 'failed';

export interface RunRecord {
  agentId: string;
  automationId: string;
  startedAt: number;
  status: RunStatus;
  summary: string | null;
  exitCode: number | null;
  completedAt: number | null;
}
