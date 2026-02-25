export interface Automation {
  id: string;
  name: string;
  cronExpression: string;
  orchestrator: string;
  model: string;
  freeAgentMode: boolean;
  prompt: string;
  enabled: boolean;
  createdAt: number;
  lastRunAt: number | null;
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
