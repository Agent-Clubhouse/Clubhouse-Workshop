/**
 * Serialized storage mutations for KanBoss.
 *
 * The plugin storage API has no compare-and-swap primitive. When multiple
 * callers (UI handlers + automation engine) perform read → modify → write
 * concurrently on the same key, one caller's writes silently overwrite the
 * other's changes.
 *
 * This module provides a per-key async mutex so that only one read-modify-write
 * cycle runs at a time for any given storage key. Callers pass an updater
 * function that receives the current value and returns the new value.
 */

import type { ScopedStorage } from '@clubhouse/plugin-types';

// ── Per-key mutex ────────────────────────────────────────────────────────

type MutexEntry = { tail: Promise<void> };

const mutexes = new Map<string, MutexEntry>();

function getMutex(storageRef: ScopedStorage, key: string): MutexEntry {
  // Combine the storage reference identity with the key so that different
  // ScopedStorage instances (project vs projectLocal) don't collide.
  const compositeKey = `${(storageRef as any).__id ?? 'default'}::${key}`;
  let entry = mutexes.get(compositeKey);
  if (!entry) {
    entry = { tail: Promise.resolve() };
    mutexes.set(compositeKey, entry);
  }
  return entry;
}

/**
 * Perform a serialized read → transform → write on a storage key.
 *
 * The `updater` receives the current stored array (or `[]` if missing) and
 * must return the new array to write. Only one updater runs at a time per
 * (storage, key) pair.
 *
 * Returns the value returned by the updater, so callers can use the result
 * for local state updates.
 */
export async function mutateStorage<T>(
  storage: ScopedStorage,
  key: string,
  updater: (current: T[]) => T[] | Promise<T[]>,
): Promise<T[]> {
  const mutex = getMutex(storage, key);

  let resolve!: () => void;
  const gate = new Promise<void>((r) => { resolve = r; });

  // Chain behind whatever is currently running for this key.
  const predecessor = mutex.tail;
  mutex.tail = gate;

  // Wait for the previous mutation to finish.
  await predecessor;

  try {
    const raw = await storage.read(key);
    const current: T[] = Array.isArray(raw) ? raw : [];
    const next = await updater(current);
    await storage.write(key, next);
    return next;
  } finally {
    resolve();
  }
}

/**
 * Reset internal mutex state. Intended for tests only.
 */
export function _resetMutexes(): void {
  mutexes.clear();
}
