import { describe, it, expect } from 'vitest';
import { generateId, isCardStuck, isCardAutomating, subtaskProgress, dueDateStatus, formatDueDate, PRIORITY_CONFIG, PRIORITY_RANK, LABEL_COLORS } from './types';
import type { Card } from './types';

describe('generateId', () => {
  it('produces unique IDs with the given prefix', () => {
    const id1 = generateId('card');
    const id2 = generateId('card');
    expect(id1).toMatch(/^card_/);
    expect(id2).toMatch(/^card_/);
    expect(id1).not.toBe(id2);
  });

  it('accepts different prefixes', () => {
    expect(generateId('board')).toMatch(/^board_/);
    expect(generateId('state')).toMatch(/^state_/);
  });
});

function makeCard(history: Card['history'], overrides: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    boardId: 'b1',
    title: 'Test',
    body: '',
    priority: 'none',
    labels: [],
    stateId: 's1',
    swimlaneId: 'l1',
    history,
    automationAttempts: 3,
    dueDate: null,
    subtasks: [],
    assigneeAgentId: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('isCardStuck', () => {
  it('returns true when last relevant action is automation-stuck', () => {
    const card = makeCard([
      { action: 'created', timestamp: 1, detail: '' },
      { action: 'automation-stuck', timestamp: 2, detail: '' },
    ]);
    expect(isCardStuck(card)).toBe(true);
  });

  it('returns false when card was moved after getting stuck', () => {
    const card = makeCard([
      { action: 'automation-stuck', timestamp: 1, detail: '' },
      { action: 'moved', timestamp: 2, detail: '' },
    ]);
    expect(isCardStuck(card)).toBe(false);
  });

  it('returns false for card with no stuck history', () => {
    const card = makeCard([{ action: 'created', timestamp: 1, detail: '' }]);
    expect(isCardStuck(card)).toBe(false);
  });
});

describe('isCardAutomating', () => {
  it('returns true when last relevant action is automation-started', () => {
    const card = makeCard([
      { action: 'created', timestamp: 1, detail: '' },
      { action: 'automation-started', timestamp: 2, detail: '' },
    ]);
    expect(isCardAutomating(card)).toBe(true);
  });

  it('returns false after automation succeeded', () => {
    const card = makeCard([
      { action: 'automation-started', timestamp: 1, detail: '' },
      { action: 'automation-succeeded', timestamp: 2, detail: '' },
    ]);
    expect(isCardAutomating(card)).toBe(false);
  });

  it('returns false after automation failed', () => {
    const card = makeCard([
      { action: 'automation-started', timestamp: 1, detail: '' },
      { action: 'automation-failed', timestamp: 2, detail: '' },
    ]);
    expect(isCardAutomating(card)).toBe(false);
  });
});

describe('PRIORITY_CONFIG', () => {
  it('has entries for all priority levels', () => {
    expect(PRIORITY_CONFIG.none).toBeDefined();
    expect(PRIORITY_CONFIG.low).toBeDefined();
    expect(PRIORITY_CONFIG.medium).toBeDefined();
    expect(PRIORITY_CONFIG.high).toBeDefined();
    expect(PRIORITY_CONFIG.critical).toBeDefined();
  });

  it('none is hidden', () => {
    expect(PRIORITY_CONFIG.none.hidden).toBe(true);
  });

  it('uses CSS custom properties with fallbacks for visible priorities', () => {
    const cssVarPattern = /^var\(--[\w-]+,\s*.+\)$/;
    expect(PRIORITY_CONFIG.low.color).toMatch(cssVarPattern);
    expect(PRIORITY_CONFIG.medium.color).toMatch(cssVarPattern);
    expect(PRIORITY_CONFIG.high.color).toMatch(cssVarPattern);
    expect(PRIORITY_CONFIG.critical.color).toMatch(cssVarPattern);
  });
});

describe('PRIORITY_RANK', () => {
  it('ranks critical highest (0) and none lowest (4)', () => {
    expect(PRIORITY_RANK.critical).toBe(0);
    expect(PRIORITY_RANK.none).toBe(4);
  });
});

describe('LABEL_COLORS', () => {
  it('provides at least 6 colors', () => {
    expect(LABEL_COLORS.length).toBeGreaterThanOrEqual(6);
  });
});

describe('subtaskProgress', () => {
  it('returns zero for card with no subtasks', () => {
    const card = makeCard([]);
    expect(subtaskProgress(card)).toEqual({ done: 0, total: 0 });
  });

  it('counts completed and total subtasks', () => {
    const card = makeCard([], {
      subtasks: [
        { id: 's1', title: 'A', completed: true },
        { id: 's2', title: 'B', completed: false },
        { id: 's3', title: 'C', completed: true },
      ],
    });
    expect(subtaskProgress(card)).toEqual({ done: 2, total: 3 });
  });

  it('handles missing subtasks field gracefully', () => {
    const card = makeCard([]);
    // Simulate legacy card without subtasks
    delete (card as unknown as Record<string, unknown>).subtasks;
    expect(subtaskProgress(card)).toEqual({ done: 0, total: 0 });
  });
});

describe('dueDateStatus', () => {
  const now = new Date('2026-03-20T12:00:00Z').getTime();

  it('returns none when dueDate is null', () => {
    const card = makeCard([]);
    expect(dueDateStatus(card, now)).toBe('none');
  });

  it('returns overdue when due date is in the past', () => {
    const card = makeCard([], { dueDate: now - 1000 });
    expect(dueDateStatus(card, now)).toBe('overdue');
  });

  it('returns due-soon when within 24 hours', () => {
    const card = makeCard([], { dueDate: now + 12 * 60 * 60 * 1000 }); // +12h
    expect(dueDateStatus(card, now)).toBe('due-soon');
  });

  it('returns upcoming when more than 24 hours away', () => {
    const card = makeCard([], { dueDate: now + 48 * 60 * 60 * 1000 }); // +48h
    expect(dueDateStatus(card, now)).toBe('upcoming');
  });

  it('returns due-soon at exactly 23h59m remaining', () => {
    const card = makeCard([], { dueDate: now + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 });
    expect(dueDateStatus(card, now)).toBe('due-soon');
  });
});

describe('formatDueDate', () => {
  it('returns a short date string', () => {
    const ts = new Date('2026-03-20T00:00:00').getTime();
    const result = formatDueDate(ts);
    expect(result).toContain('Mar');
    expect(result).toContain('20');
  });
});
