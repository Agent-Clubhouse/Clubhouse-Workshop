import { describe, it, expect, beforeEach } from 'vitest';
import { loadNote, saveNote, ensureToday, previousDay } from './storage';
import type { DailyNote } from './types';

// Simple in-memory mock of ScopedStorage
function createMockStorage() {
  const data: Record<string, unknown> = {};
  return {
    read: async (key: string) => data[key] ?? null,
    write: async (key: string, value: unknown) => { data[key] = value; },
    delete: async (key: string) => { delete data[key]; },
    list: async () => Object.keys(data),
  };
}

describe('loadNote', () => {
  it('returns empty note when none exists', async () => {
    const storage = createMockStorage();
    const note = await loadNote(storage, '2026-03-22');
    expect(note.date).toBe('2026-03-22');
    expect(note.schedule).toEqual([]);
    expect(note.todos).toEqual([]);
  });

  it('returns saved note', async () => {
    const storage = createMockStorage();
    const note: DailyNote = {
      date: '2026-03-22',
      schedule: [{ id: '1', time: '09:00', event: 'Standup', detail: '', people: '', actionItems: '' }],
      todos: [],
      reminders: [],
    };
    await saveNote(storage, note);
    const loaded = await loadNote(storage, '2026-03-22');
    expect(loaded.schedule).toHaveLength(1);
    expect(loaded.schedule[0].event).toBe('Standup');
  });
});

describe('saveNote', () => {
  it('persists note to storage', async () => {
    const storage = createMockStorage();
    const note: DailyNote = {
      date: '2026-03-22',
      schedule: [],
      todos: [{ id: '1', task: 'Test', detail: '', linked: '', dueDate: null, state: 'to-do' }],
      reminders: [],
    };
    await saveNote(storage, note);
    const loaded = await loadNote(storage, '2026-03-22');
    expect(loaded.todos).toHaveLength(1);
    expect(loaded.todos[0].task).toBe('Test');
  });

  it('overwrites existing note for same date', async () => {
    const storage = createMockStorage();
    await saveNote(storage, { date: '2026-03-22', schedule: [], todos: [], reminders: [] });
    await saveNote(storage, {
      date: '2026-03-22',
      schedule: [{ id: '1', time: '10:00', event: 'Updated', detail: '', people: '', actionItems: '' }],
      todos: [],
      reminders: [],
    });
    const loaded = await loadNote(storage, '2026-03-22');
    expect(loaded.schedule[0].event).toBe('Updated');
  });
});

describe('ensureToday', () => {
  it('creates new note if none exists', async () => {
    const storage = createMockStorage();
    const note = await ensureToday(storage, '2026-03-22');
    expect(note.date).toBe('2026-03-22');
    expect(note.todos).toEqual([]);
  });

  it('returns existing note without modifying it', async () => {
    const storage = createMockStorage();
    await saveNote(storage, {
      date: '2026-03-22',
      schedule: [],
      todos: [{ id: '1', task: 'Existing', detail: '', linked: '', dueDate: null, state: 'to-do' }],
      reminders: [],
    });
    const note = await ensureToday(storage, '2026-03-22');
    expect(note.todos).toHaveLength(1);
    expect(note.todos[0].task).toBe('Existing');
  });

  it('carries forward incomplete todos from previous day', async () => {
    const storage = createMockStorage();
    await saveNote(storage, {
      date: '2026-03-21',
      schedule: [],
      todos: [
        { id: '1', task: 'Carry me', detail: '', linked: '', dueDate: null, state: 'to-do' },
        { id: '2', task: 'Done item', detail: '', linked: '', dueDate: null, state: 'done' },
      ],
      reminders: [],
    });
    const note = await ensureToday(storage, '2026-03-22');
    expect(note.todos).toHaveLength(1);
    expect(note.todos[0].task).toBe('Carry me');
    expect(note.todos[0].state).toBe('carried-fwd');
  });

  it('finds most recent previous note even if not yesterday', async () => {
    const storage = createMockStorage();
    await saveNote(storage, {
      date: '2026-03-18',
      schedule: [],
      todos: [{ id: '1', task: 'Old todo', detail: '', linked: '', dueDate: null, state: 'to-do' }],
      reminders: [],
    });
    const note = await ensureToday(storage, '2026-03-22');
    expect(note.todos).toHaveLength(1);
    expect(note.todos[0].task).toBe('Old todo');
  });
});

describe('previousDay', () => {
  it('returns the day before', () => {
    expect(previousDay('2026-03-22')).toBe('2026-03-21');
  });

  it('handles month boundaries', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
  });

  it('handles year boundaries', () => {
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
  });
});
