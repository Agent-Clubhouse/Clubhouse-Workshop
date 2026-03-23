import { describe, it, expect } from 'vitest';
import {
  formatDate, formatTime, isOverdue, createEmptyNote,
  carryForward, sortSchedule, currentBlock, todayKey, generateId,
} from './types';
import type { Todo, ScheduleBlock, DailyNote } from './types';

describe('generateId', () => {
  it('returns unique ids', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });
});

describe('formatDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 2, 22))).toBe('2026-03-22');
  });

  it('pads single-digit month and day', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('todayKey', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatTime', () => {
  it('formats 24h time to 12h', () => {
    expect(formatTime('09:00')).toBe('9:00 AM');
    expect(formatTime('13:30')).toBe('1:30 PM');
    expect(formatTime('00:00')).toBe('12:00 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
  });
});

describe('isOverdue', () => {
  const today = '2026-03-22';

  it('returns true for past due to-do', () => {
    const todo: Todo = { id: '1', task: 'x', detail: '', linked: '', dueDate: '2026-03-20', state: 'to-do' };
    expect(isOverdue(todo, today)).toBe(true);
  });

  it('returns true for past due carried-fwd', () => {
    const todo: Todo = { id: '1', task: 'x', detail: '', linked: '', dueDate: '2026-03-21', state: 'carried-fwd' };
    expect(isOverdue(todo, today)).toBe(true);
  });

  it('returns false for done items even if past due', () => {
    const todo: Todo = { id: '1', task: 'x', detail: '', linked: '', dueDate: '2026-03-20', state: 'done' };
    expect(isOverdue(todo, today)).toBe(false);
  });

  it('returns false for items due today', () => {
    const todo: Todo = { id: '1', task: 'x', detail: '', linked: '', dueDate: '2026-03-22', state: 'to-do' };
    expect(isOverdue(todo, today)).toBe(false);
  });

  it('returns false for items with no due date', () => {
    const todo: Todo = { id: '1', task: 'x', detail: '', linked: '', dueDate: null, state: 'to-do' };
    expect(isOverdue(todo, today)).toBe(false);
  });
});

describe('createEmptyNote', () => {
  it('creates a note with empty arrays', () => {
    const note = createEmptyNote('2026-03-22');
    expect(note.date).toBe('2026-03-22');
    expect(note.schedule).toEqual([]);
    expect(note.todos).toEqual([]);
    expect(note.reminders).toEqual([]);
  });
});

describe('carryForward', () => {
  it('carries to-do and carried-fwd items to new note', () => {
    const prev: DailyNote = {
      date: '2026-03-21',
      schedule: [],
      todos: [
        { id: '1', task: 'A', detail: '', linked: '', dueDate: null, state: 'to-do' },
        { id: '2', task: 'B', detail: '', linked: '', dueDate: null, state: 'done' },
        { id: '3', task: 'C', detail: '', linked: '', dueDate: null, state: 'carried-fwd' },
        { id: '4', task: 'D', detail: '', linked: '', dueDate: null, state: 'cancelled' },
      ],
      reminders: [],
    };
    const newNote = createEmptyNote('2026-03-22');
    const result = carryForward(prev, newNote);

    expect(result.todos).toHaveLength(2);
    expect(result.todos[0].task).toBe('A');
    expect(result.todos[0].state).toBe('carried-fwd');
    expect(result.todos[1].task).toBe('C');
    expect(result.todos[1].state).toBe('carried-fwd');
  });

  it('assigns new ids to carried items', () => {
    const prev: DailyNote = {
      date: '2026-03-21',
      schedule: [],
      todos: [{ id: 'old-id', task: 'A', detail: '', linked: '', dueDate: null, state: 'to-do' }],
      reminders: [],
    };
    const result = carryForward(prev, createEmptyNote('2026-03-22'));
    expect(result.todos[0].id).not.toBe('old-id');
  });

  it('preserves existing todos in new note', () => {
    const prev: DailyNote = {
      date: '2026-03-21',
      schedule: [],
      todos: [{ id: '1', task: 'Carried', detail: '', linked: '', dueDate: null, state: 'to-do' }],
      reminders: [],
    };
    const newNote: DailyNote = {
      date: '2026-03-22',
      schedule: [],
      todos: [{ id: '2', task: 'Existing', detail: '', linked: '', dueDate: null, state: 'to-do' }],
      reminders: [],
    };
    const result = carryForward(prev, newNote);
    expect(result.todos).toHaveLength(2);
    expect(result.todos[1].task).toBe('Existing');
  });

  it('returns unchanged note when no items to carry', () => {
    const prev: DailyNote = {
      date: '2026-03-21',
      schedule: [],
      todos: [{ id: '1', task: 'Done', detail: '', linked: '', dueDate: null, state: 'done' }],
      reminders: [],
    };
    const newNote = createEmptyNote('2026-03-22');
    const result = carryForward(prev, newNote);
    expect(result.todos).toHaveLength(0);
  });
});

describe('sortSchedule', () => {
  it('sorts blocks by time', () => {
    const blocks: ScheduleBlock[] = [
      { id: '1', time: '13:00', event: 'Lunch', detail: '', people: '', actionItems: '' },
      { id: '2', time: '09:00', event: 'Standup', detail: '', people: '', actionItems: '' },
      { id: '3', time: '10:30', event: 'Review', detail: '', people: '', actionItems: '' },
    ];
    const sorted = sortSchedule(blocks);
    expect(sorted.map((b) => b.time)).toEqual(['09:00', '10:30', '13:00']);
  });

  it('does not mutate original array', () => {
    const blocks: ScheduleBlock[] = [
      { id: '1', time: '13:00', event: 'B', detail: '', people: '', actionItems: '' },
      { id: '2', time: '09:00', event: 'A', detail: '', people: '', actionItems: '' },
    ];
    sortSchedule(blocks);
    expect(blocks[0].time).toBe('13:00');
  });
});

describe('currentBlock', () => {
  const schedule: ScheduleBlock[] = [
    { id: '1', time: '09:00', event: 'Morning', detail: '', people: '', actionItems: '' },
    { id: '2', time: '12:00', event: 'Lunch', detail: '', people: '', actionItems: '' },
    { id: '3', time: '14:00', event: 'Afternoon', detail: '', people: '', actionItems: '' },
  ];

  it('returns the current block', () => {
    const now = new Date(2026, 2, 22, 13, 30);
    expect(currentBlock(schedule, now)?.event).toBe('Lunch');
  });

  it('returns null before first block', () => {
    const now = new Date(2026, 2, 22, 8, 0);
    expect(currentBlock(schedule, now)).toBeNull();
  });

  it('returns last block after all blocks', () => {
    const now = new Date(2026, 2, 22, 18, 0);
    expect(currentBlock(schedule, now)?.event).toBe('Afternoon');
  });

  it('returns null for empty schedule', () => {
    expect(currentBlock([], new Date())).toBeNull();
  });
});

describe('manifest', () => {
  it('targets API version 0.7', async () => {
    const manifest = await import('../manifest.json');
    expect(manifest.engine.api).toBe(0.7);
  });

  it('has app scope', async () => {
    const manifest = await import('../manifest.json');
    expect(manifest.scope).toBe('app');
  });

  it('contributes a rail item', async () => {
    const manifest = await import('../manifest.json');
    expect(manifest.contributes.railItem).toBeDefined();
    expect(manifest.contributes.railItem.position).toBe('bottom');
  });
});
