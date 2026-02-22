// ── KanBoss data models ─────────────────────────────────────────────────

export type Priority = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type HistoryAction =
  | 'created'
  | 'moved'
  | 'edited'
  | 'priority-changed'
  | 'automation-started'
  | 'automation-succeeded'
  | 'automation-failed'
  | 'automation-stuck';

export interface HistoryEntry {
  action: HistoryAction;
  timestamp: number;
  detail: string;
  agentId?: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Card {
  id: string;
  boardId: string;
  title: string;
  body: string;
  priority: Priority;
  labels: string[]; // label IDs
  stateId: string;
  swimlaneId: string;
  history: HistoryEntry[];
  automationAttempts: number;
  createdAt: number;
  updatedAt: number;
}

export interface BoardState {
  id: string;
  name: string;
  order: number;
  isAutomatic: boolean;
  automationPrompt: string;
  evaluationPrompt: string; // separate from execution prompt
  wipLimit: number; // 0 = unlimited
}

export interface Swimlane {
  id: string;
  name: string;
  order: number;
  managerAgentId: string | null;
  evaluationAgentId: string | null; // null = same as manager agent
}

export interface BoardConfig {
  maxRetries: number;
  zoomLevel: number;
  gitHistory: boolean;
}

export interface Board {
  id: string;
  name: string;
  states: BoardState[];
  swimlanes: Swimlane[];
  labels: Label[];
  config: BoardConfig;
  createdAt: number;
  updatedAt: number;
}

export interface AutomationRun {
  cardId: string;
  boardId: string;
  stateId: string;
  swimlaneId: string;
  executionAgentId: string;
  evaluationAgentId: string | null;
  configuredEvaluationAgentId: string | null; // from swimlane config; null = same as manager
  phase: 'executing' | 'evaluating';
  attempt: number;
  startedAt: number;
}

// ── Storage keys ────────────────────────────────────────────────────────

export const BOARDS_KEY = 'boards';
export const cardsKey = (boardId: string): string => `cards:${boardId}`;
export const AUTOMATION_RUNS_KEY = 'automation-runs';

// ── Priority display config ─────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; hidden?: boolean }> = {
  none:     { label: 'None',     color: '', hidden: true },
  low:      { label: 'Low',      color: 'var(--text-info, #3b82f6)' },
  medium:   { label: 'Medium',   color: 'var(--text-warning, #eab308)' },
  high:     { label: 'High',     color: '#f97316' },
  critical: { label: 'Critical', color: 'var(--text-error, #ef4444)' },
};

// Priority sort order: critical first, none last
export const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

// ── Default label colors ────────────────────────────────────────────────

export const LABEL_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#ef4444', // red
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#eab308', // yellow
];

// ── Helpers ─────────────────────────────────────────────────────────────

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isCardStuck(card: Card): boolean {
  for (let i = card.history.length - 1; i >= 0; i--) {
    if (card.history[i].action === 'automation-stuck') return true;
    if (card.history[i].action === 'moved') return false;
  }
  return false;
}

export function isCardAutomating(card: Card): boolean {
  for (let i = card.history.length - 1; i >= 0; i--) {
    const a = card.history[i].action;
    if (a === 'automation-started') return true;
    if (a === 'automation-succeeded' || a === 'automation-failed' || a === 'automation-stuck' || a === 'moved') return false;
  }
  return false;
}
