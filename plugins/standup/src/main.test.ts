import { describe, it, expect, vi } from 'vitest';
import { activate } from './main';
import { createMockContext, createMockAPI } from '@clubhouse/plugin-testing';
import type { ScopedStorage } from '@clubhouse/plugin-types';
import manifest from '../manifest.json';

// ── Constants (must match main.tsx) ──────────────────────────────────

const HISTORY_KEY = 'standupHistory';
const MAX_HISTORY = 30;

// ── Helpers ──────────────────────────────────────────────────────────

function createSpyStorage(): ScopedStorage & { _data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    _data: data,
    read: vi.fn(async (key: string) => data.get(key)),
    write: vi.fn(async (key: string, value: unknown) => { data.set(key, value); }),
    delete: vi.fn(async (key: string) => { data.delete(key); }),
    list: vi.fn(async () => [...data.keys()]),
  };
}

// loadHistory and saveEntry are not exported, so we replicate the logic
// here for unit-level testing of the storage contract.

async function loadHistoryViaStorage(storage: ScopedStorage): Promise<unknown[]> {
  const raw = await storage.read(HISTORY_KEY);
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(raw)) return raw;
  return [];
}

async function saveEntryViaStorage(storage: ScopedStorage, entry: unknown): Promise<void> {
  const history = await loadHistoryViaStorage(storage);
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await storage.write(HISTORY_KEY, history);
}

// ── Manifest tests ───────────────────────────────────────────────────

describe('standup plugin manifest', () => {
  it('has correct id', () => {
    expect(manifest.id).toBe('standup');
  });

  it('is app-scoped', () => {
    expect(manifest.scope).toBe('app');
  });

  it('targets API v0.5', () => {
    expect(manifest.engine.api).toBe(0.5);
  });

  it('declares required permissions', () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['storage', 'agents', 'commands', 'notifications']),
    );
  });

  it('only requests permissions from the allowed set', () => {
    const allowed = new Set([
      'logging', 'storage', 'notifications', 'files', 'git',
      'agents', 'commands', 'process', 'projects', 'navigation', 'widgets',
    ]);
    for (const perm of manifest.permissions) {
      expect(allowed.has(perm)).toBe(true);
    }
  });

  it('contributes a rail item', () => {
    expect(manifest.contributes?.railItem).toBeDefined();
    expect(manifest.contributes!.railItem!.label).toBe('Standup');
    expect(manifest.contributes!.railItem!.position).toBe('top');
  });

  it('contributes the generate command', () => {
    const cmds = manifest.contributes?.commands;
    expect(cmds).toBeDefined();
    const ids = cmds!.map((c: { id: string }) => c.id);
    expect(ids).toContain('standup.generate');
  });

  it('contributes help topics', () => {
    expect(manifest.contributes?.help).toBeDefined();
    expect(manifest.contributes!.help!.topics!.length).toBeGreaterThan(0);
  });

  it('has a rail item icon (SVG string)', () => {
    expect(manifest.contributes!.railItem!.icon).toContain('<svg');
  });

  it('specifies main entry point', () => {
    expect(manifest.main).toBe('./dist/main.js');
  });
});

// ── activate() ───────────────────────────────────────────────────────

describe('activate()', () => {
  it('registers the standup.generate command', () => {
    const ctx = createMockContext({ pluginId: 'standup' });
    const api = createMockAPI();

    activate(ctx, api);

    expect(api.commands.register).toHaveBeenCalledWith(
      'standup.generate',
      expect.any(Function),
    );
  });

  it('adds one subscription for cleanup', () => {
    const ctx = createMockContext({ pluginId: 'standup' });
    const api = createMockAPI();

    activate(ctx, api);

    expect(ctx.subscriptions).toHaveLength(1);
  });

  it('logs activation message', () => {
    const ctx = createMockContext({ pluginId: 'standup' });
    const api = createMockAPI();

    activate(ctx, api);

    expect(api.logging.info).toHaveBeenCalledWith('Standup plugin activated');
  });
});

// ── Storage: loadHistory ─────────────────────────────────────────────

describe('loadHistory', () => {
  it('returns empty array when storage has no data', async () => {
    const storage = createSpyStorage();
    const result = await loadHistoryViaStorage(storage);
    expect(result).toEqual([]);
  });

  it('parses JSON string from storage', async () => {
    const entries = [{ id: '1', date: '2025-01-01', summary: 'test' }];
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, JSON.stringify(entries));

    const result = await loadHistoryViaStorage(storage);
    expect(result).toEqual(entries);
  });

  it('returns array directly when storage contains array', async () => {
    const entries = [{ id: '1', date: '2025-01-01', summary: 'test' }];
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, entries);

    const result = await loadHistoryViaStorage(storage);
    expect(result).toEqual(entries);
  });

  it('returns empty array for invalid JSON string', async () => {
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, 'not-valid-json');

    const result = await loadHistoryViaStorage(storage);
    expect(result).toEqual([]);
  });

  it('returns empty array for non-array non-string values', async () => {
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, 123);

    const result = await loadHistoryViaStorage(storage);
    expect(result).toEqual([]);
  });

  it('returns empty array for null value', async () => {
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, null);

    const result = await loadHistoryViaStorage(storage);
    expect(result).toEqual([]);
  });
});

// ── Storage: saveEntry ───────────────────────────────────────────────

describe('saveEntry', () => {
  it('prepends entry to history', async () => {
    const storage = createSpyStorage();
    const existing = [{ id: 'old', date: '2025-01-01' }];
    storage._data.set(HISTORY_KEY, existing);

    await saveEntryViaStorage(storage, { id: 'new', date: '2025-01-02' });

    const saved = storage._data.get(HISTORY_KEY) as unknown[];
    expect(saved[0]).toEqual({ id: 'new', date: '2025-01-02' });
    expect(saved[1]).toEqual({ id: 'old', date: '2025-01-01' });
  });

  it('limits history to MAX_HISTORY entries', async () => {
    const storage = createSpyStorage();
    const existing = Array.from({ length: MAX_HISTORY }, (_, i) => ({ id: `entry-${i}` }));
    storage._data.set(HISTORY_KEY, existing);

    await saveEntryViaStorage(storage, { id: 'newest' });

    const saved = storage._data.get(HISTORY_KEY) as unknown[];
    expect(saved).toHaveLength(MAX_HISTORY);
    expect(saved[0]).toEqual({ id: 'newest' });
  });

  it('saves to empty storage', async () => {
    const storage = createSpyStorage();
    await saveEntryViaStorage(storage, { id: 'first' });

    const saved = storage._data.get(HISTORY_KEY) as unknown[];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual({ id: 'first' });
  });

  it('writes to storage after save', async () => {
    const storage = createSpyStorage();
    await saveEntryViaStorage(storage, { id: 'entry' });

    expect(storage.write).toHaveBeenCalledWith(HISTORY_KEY, expect.any(Array));
  });
});
