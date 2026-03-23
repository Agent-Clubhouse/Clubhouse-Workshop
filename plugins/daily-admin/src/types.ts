// ── Schedule ────────────────────────────────────────────────────────────

export interface ScheduleBlock {
  id: string;
  time: string;       // "HH:MM" 24h format
  event: string;
  detail: string;
  people: string;
  actionItems: string;
}

// ── To-Dos ──────────────────────────────────────────────────────────────

export type TodoState = 'to-do' | 'done' | 'carried-fwd' | 'cancelled';

export interface Todo {
  id: string;
  task: string;
  detail: string;
  linked: string;
  dueDate: string | null;  // "YYYY-MM-DD" or null
  state: TodoState;
}

// ── Reminders ───────────────────────────────────────────────────────────

export interface Reminder {
  id: string;
  text: string;
  dismissed: boolean;
}

// ── Daily Note ──────────────────────────────────────────────────────────

export interface DailyNote {
  date: string;            // "YYYY-MM-DD"
  schedule: ScheduleBlock[];
  todos: Todo[];
  reminders: Reminder[];
}

// ── Helpers ─────────────────────────────────────────────────────────────

let idCounter = 0;
export function generateId(): string {
  return `${Date.now()}-${++idCounter}`;
}

export function todayKey(): string {
  return formatDate(new Date());
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function isOverdue(todo: Todo, today: string): boolean {
  return todo.dueDate != null && todo.dueDate < today && (todo.state === 'to-do' || todo.state === 'carried-fwd');
}

export function createEmptyNote(date: string): DailyNote {
  return { date, schedule: [], todos: [], reminders: [] };
}

/**
 * Carry forward incomplete todos from a previous note into a new note.
 * Items with state 'to-do' or 'carried-fwd' are copied with state set to 'carried-fwd'.
 * Items with state 'done' or 'cancelled' are not carried forward.
 */
export function carryForward(previousNote: DailyNote, newNote: DailyNote): DailyNote {
  const carried = previousNote.todos
    .filter((t) => t.state === 'to-do' || t.state === 'carried-fwd')
    .map((t) => ({ ...t, id: generateId(), state: 'carried-fwd' as TodoState }));

  return {
    ...newNote,
    todos: [...carried, ...newNote.todos],
  };
}

/**
 * Sort schedule blocks by time.
 */
export function sortSchedule(blocks: ScheduleBlock[]): ScheduleBlock[] {
  return [...blocks].sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Get the current time block based on schedule.
 * Returns the last block whose time is <= now.
 */
export function currentBlock(schedule: ScheduleBlock[], now: Date): ScheduleBlock | null {
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const sorted = sortSchedule(schedule);
  let current: ScheduleBlock | null = null;
  for (const block of sorted) {
    if (block.time <= nowTime) current = block;
    else break;
  }
  return current;
}
