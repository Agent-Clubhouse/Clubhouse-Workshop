import type { ScopedStorage } from '@clubhouse/plugin-types';
import type { DailyNote } from './types';
import { createEmptyNote, carryForward, formatDate } from './types';

const NOTES_KEY = 'daily-notes';

export interface NotesStore {
  [date: string]: DailyNote;
}

export async function loadNotes(storage: ScopedStorage): Promise<NotesStore> {
  const data = await storage.read(NOTES_KEY);
  return (data as NotesStore) ?? {};
}

export async function saveNotes(storage: ScopedStorage, notes: NotesStore): Promise<void> {
  await storage.write(NOTES_KEY, notes);
}

export async function loadNote(storage: ScopedStorage, date: string): Promise<DailyNote> {
  const notes = await loadNotes(storage);
  return notes[date] ?? createEmptyNote(date);
}

export async function saveNote(storage: ScopedStorage, note: DailyNote): Promise<void> {
  const notes = await loadNotes(storage);
  notes[note.date] = note;
  await saveNotes(storage, notes);
}

/**
 * Ensure today's note exists with carry-forward from yesterday.
 * Returns the note for today (created or existing).
 */
export async function ensureToday(storage: ScopedStorage, today: string): Promise<DailyNote> {
  const notes = await loadNotes(storage);

  if (notes[today]) return notes[today];

  // Find the most recent previous note for carry-forward
  const dates = Object.keys(notes).filter((d) => d < today).sort();
  const previousDate = dates.length > 0 ? dates[dates.length - 1] : null;

  let note = createEmptyNote(today);
  if (previousDate) {
    note = carryForward(notes[previousDate], note);
  }

  notes[today] = note;
  await saveNotes(storage, notes);
  return note;
}

/**
 * Get the most recent N dates that have notes.
 */
export async function recentDates(storage: ScopedStorage, limit: number): Promise<string[]> {
  const notes = await loadNotes(storage);
  return Object.keys(notes).sort().reverse().slice(0, limit);
}

/**
 * Find the previous day's date string from a given date.
 */
export function previousDay(date: string): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}
