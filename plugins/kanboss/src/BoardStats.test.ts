import { describe, it, expect } from 'vitest';
import { computeBoardStats } from './boardStatsUtils';
import type { Card, Board } from './types';

function makeBoard(states: { id: string; name: string; order: number }[]): Board {
  return {
    id: 'b1',
    name: 'Test Board',
    states: states.map((s) => ({
      ...s,
      isAutomatic: false,
      automationPrompt: '',
      evaluationPrompt: '',
      wipLimit: 0,
      executionAgentId: null,
      evaluationAgentId: null,
    })),
    swimlanes: [{ id: 'lane1', name: 'Default', order: 0, managerAgentId: null, evaluationAgentId: null }],
    labels: [],
    config: { maxRetries: 3, zoomLevel: 1.0, gitHistory: false },
    createdAt: 0,
    updatedAt: 0,
  };
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    boardId: 'b1',
    title: 'Test',
    body: '',
    priority: 'none',
    labels: [],
    stateId: 's1',
    swimlaneId: 'lane1',
    history: [{ action: 'created', timestamp: 1, detail: '' }],
    automationAttempts: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const board = makeBoard([
  { id: 's1', name: 'Todo', order: 0 },
  { id: 's2', name: 'In Progress', order: 1 },
  { id: 's3', name: 'Done', order: 2 },
]);

describe('computeBoardStats', () => {
  it('returns zero counts for an empty card list', () => {
    const stats = computeBoardStats([], board);
    expect(stats.totalCards).toBe(0);
    expect(stats.stuckCount).toBe(0);
    expect(stats.stuckRatio).toBe(0);
    expect(stats.automationTotal).toBe(0);
    expect(isNaN(stats.automationSuccessRate)).toBe(true);
    expect(stats.cardsPerState).toHaveLength(3);
    stats.cardsPerState.forEach((s) => expect(s.count).toBe(0));
  });

  it('counts cards per state correctly', () => {
    const cards = [
      makeCard({ id: 'c1', stateId: 's1' }),
      makeCard({ id: 'c2', stateId: 's1' }),
      makeCard({ id: 'c3', stateId: 's2' }),
      makeCard({ id: 'c4', stateId: 's3' }),
    ];
    const stats = computeBoardStats(cards, board);
    expect(stats.totalCards).toBe(4);
    expect(stats.cardsPerState[0]).toEqual({ stateId: 's1', stateName: 'Todo', count: 2 });
    expect(stats.cardsPerState[1]).toEqual({ stateId: 's2', stateName: 'In Progress', count: 1 });
    expect(stats.cardsPerState[2]).toEqual({ stateId: 's3', stateName: 'Done', count: 1 });
  });

  it('orders states by order field', () => {
    const reversed = makeBoard([
      { id: 'sa', name: 'A', order: 2 },
      { id: 'sb', name: 'B', order: 0 },
      { id: 'sc', name: 'C', order: 1 },
    ]);
    const stats = computeBoardStats([], reversed);
    expect(stats.cardsPerState.map((s) => s.stateName)).toEqual(['B', 'C', 'A']);
  });

  it('computes priority breakdown', () => {
    const cards = [
      makeCard({ id: 'c1', priority: 'critical' }),
      makeCard({ id: 'c2', priority: 'critical' }),
      makeCard({ id: 'c3', priority: 'low' }),
      makeCard({ id: 'c4', priority: 'none' }),
    ];
    const stats = computeBoardStats(cards, board);
    const critical = stats.priorityBreakdown.find((p) => p.priority === 'critical');
    const low = stats.priorityBreakdown.find((p) => p.priority === 'low');
    const none = stats.priorityBreakdown.find((p) => p.priority === 'none');
    const medium = stats.priorityBreakdown.find((p) => p.priority === 'medium');

    expect(critical?.count).toBe(2);
    expect(low?.count).toBe(1);
    expect(none?.count).toBe(1);
    expect(medium?.count).toBe(0);
  });

  it('counts stuck cards and computes ratio', () => {
    const cards = [
      makeCard({ id: 'c1', history: [{ action: 'automation-stuck', timestamp: 1, detail: '' }] }),
      makeCard({ id: 'c2', history: [{ action: 'automation-stuck', timestamp: 1, detail: '' }] }),
      makeCard({ id: 'c3', history: [{ action: 'created', timestamp: 1, detail: '' }] }),
      makeCard({ id: 'c4', history: [{ action: 'created', timestamp: 1, detail: '' }] }),
    ];
    const stats = computeBoardStats(cards, board);
    expect(stats.stuckCount).toBe(2);
    expect(stats.stuckRatio).toBe(0.5);
  });

  it('returns stuckRatio of 0 for empty card list', () => {
    const stats = computeBoardStats([], board);
    expect(stats.stuckRatio).toBe(0);
  });

  it('computes automation success rate from history', () => {
    const cards = [
      makeCard({
        id: 'c1',
        history: [
          { action: 'automation-succeeded', timestamp: 1, detail: '' },
          { action: 'automation-succeeded', timestamp: 2, detail: '' },
          { action: 'automation-failed', timestamp: 3, detail: '' },
        ],
      }),
      makeCard({
        id: 'c2',
        history: [
          { action: 'automation-succeeded', timestamp: 1, detail: '' },
        ],
      }),
    ];
    const stats = computeBoardStats(cards, board);
    expect(stats.automationSuccesses).toBe(3);
    expect(stats.automationTotal).toBe(4);
    expect(stats.automationSuccessRate).toBe(0.75);
  });

  it('returns NaN success rate when no automation history', () => {
    const cards = [makeCard({ id: 'c1' })];
    const stats = computeBoardStats(cards, board);
    expect(isNaN(stats.automationSuccessRate)).toBe(true);
    expect(stats.automationTotal).toBe(0);
  });

  it('returns 100% success rate when all automations succeeded', () => {
    const cards = [
      makeCard({
        id: 'c1',
        history: [
          { action: 'automation-succeeded', timestamp: 1, detail: '' },
          { action: 'automation-succeeded', timestamp: 2, detail: '' },
        ],
      }),
    ];
    const stats = computeBoardStats(cards, board);
    expect(stats.automationSuccessRate).toBe(1);
  });
});
