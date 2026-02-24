import { describe, it, expect, vi } from 'vitest';
import { activate, loadHistory, toDateStr, getMissingDates, gatherGitData } from './main';
import { createStandupState } from './state';
import { createMockContext, createMockAPI } from '@clubhouse/plugin-testing';
import type { ScopedStorage, PluginAPI } from '@clubhouse/plugin-types';
import manifest from '../manifest.json';

// ── Constants (must match main.tsx) ──────────────────────────────────

const HISTORY_KEY = 'standupHistory';
const MAX_HISTORY = 90;

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

function createApiWithStorage(storage: ScopedStorage): PluginAPI {
  return createMockAPI({
    storage: { projectLocal: storage },
  } as Parameters<typeof createMockAPI>[0]);
}

// ── Manifest tests ───────────────────────────────────────────────────

describe('standup plugin manifest', () => {
  it('has correct id', () => {
    expect(manifest.id).toBe('standup');
  });

  it('is project-scoped', () => {
    expect(manifest.scope).toBe('project');
  });

  it('targets API v0.6', () => {
    expect(manifest.engine.api).toBe(0.6);
  });

  it('declares required permissions', () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['storage', 'agents', 'commands', 'notifications', 'process', 'theme']),
    );
  });

  it('only requests permissions from the allowed set', () => {
    const allowed = new Set([
      'logging', 'storage', 'notifications', 'files', 'git',
      'agents', 'commands', 'process', 'projects', 'navigation', 'widgets',
      'sounds', 'theme',
    ]);
    for (const perm of manifest.permissions) {
      expect(allowed.has(perm)).toBe(true);
    }
  });

  it('contributes a tab with sidebar-content layout', () => {
    expect(manifest.contributes?.tab).toBeDefined();
    expect(manifest.contributes!.tab!.label).toBe('Standup');
    expect(manifest.contributes!.tab!.layout).toBe('sidebar-content');
  });

  it('contributes the generate command', () => {
    const cmds = manifest.contributes?.commands;
    expect(cmds).toBeDefined();
    const ids = cmds!.map((c: { id: string }) => c.id);
    expect(ids).toContain('standup.generate');
  });

  it('contributes settings declarations', () => {
    const settings = manifest.contributes?.settings;
    expect(settings).toBeDefined();
    const keys = settings!.map((s: { key: string }) => s.key);
    expect(keys).toContain('orchestrator');
    expect(keys).toContain('model');
    expect(keys).toContain('freeAgentMode');
    expect(keys).toContain('prompt');
    expect(keys).toContain('lookbackDays');
  });

  it('contributes help topics', () => {
    expect(manifest.contributes?.help).toBeDefined();
    expect(manifest.contributes!.help!.topics!.length).toBeGreaterThan(0);
  });

  it('has a tab icon (SVG string)', () => {
    expect(manifest.contributes!.tab!.icon).toContain('<svg');
  });

  it('specifies main entry point', () => {
    expect(manifest.main).toBe('./dist/main.js');
  });

  it('has custom settings panel', () => {
    expect(manifest.settingsPanel).toBe('custom');
  });

  it('allows git and gh commands', () => {
    expect(manifest.allowedCommands).toEqual(['git', 'gh']);
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

// ── State module ─────────────────────────────────────────────────────

describe('createStandupState', () => {
  it('initializes with empty history', () => {
    const state = createStandupState();
    expect(state.history).toEqual([]);
    expect(state.selectedId).toBeNull();
    expect(state.generating).toBe(false);
  });

  it('notifies listeners on setHistory', () => {
    const state = createStandupState();
    const listener = vi.fn();
    state.subscribe(listener);

    state.setHistory([{ id: '1', date: '2025-01-01', summary: 'test', output: 'test', projectName: 'proj' }]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(state.history).toHaveLength(1);
  });

  it('notifies listeners on setSelectedId', () => {
    const state = createStandupState();
    const listener = vi.fn();
    state.subscribe(listener);

    state.setSelectedId('abc');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(state.selectedId).toBe('abc');
  });

  it('getSelected returns the matching entry', () => {
    const state = createStandupState();
    const entry = { id: '1', date: '2025-01-01', summary: 'test', output: 'test output', projectName: 'proj' };
    state.setHistory([entry]);
    state.setSelectedId('1');

    expect(state.getSelected()).toEqual(entry);
  });

  it('getSelected returns null when no match', () => {
    const state = createStandupState();
    state.setSelectedId('nonexistent');
    expect(state.getSelected()).toBeNull();
  });

  it('unsubscribe stops notifications', () => {
    const state = createStandupState();
    const listener = vi.fn();
    const unsub = state.subscribe(listener);

    unsub();
    state.setGenerating(true);

    expect(listener).not.toHaveBeenCalled();
  });
});

// ── Storage: loadHistory ─────────────────────────────────────────────

describe('loadHistory', () => {
  it('returns empty array when storage has no data', async () => {
    const storage = createSpyStorage();
    const api = createApiWithStorage(storage);

    const result = await loadHistory(api);
    expect(result).toEqual([]);
  });

  it('parses JSON string from storage', async () => {
    const entries = [{ id: '1', date: '2025-01-01', summary: 'test', output: 'output', projectName: 'proj' }];
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, JSON.stringify(entries));

    const api = createApiWithStorage(storage);
    const result = await loadHistory(api);
    expect(result).toEqual(entries);
  });

  it('returns array directly when storage contains array', async () => {
    const entries = [{ id: '1', date: '2025-01-01', summary: 'test', output: 'output', projectName: 'proj' }];
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, entries);

    const api = createApiWithStorage(storage);
    const result = await loadHistory(api);
    expect(result).toEqual(entries);
  });

  it('returns empty array for invalid JSON string', async () => {
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, 'not-valid-json');

    const api = createApiWithStorage(storage);
    const result = await loadHistory(api);
    expect(result).toEqual([]);
  });

  it('returns empty array for non-array non-string values', async () => {
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, 123);

    const api = createApiWithStorage(storage);
    const result = await loadHistory(api);
    expect(result).toEqual([]);
  });
});

// ── Date helpers ─────────────────────────────────────────────────────

describe('toDateStr', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const d = new Date(2025, 5, 15); // June 15, 2025
    expect(toDateStr(d)).toBe('2025-06-15');
  });

  it('pads single-digit months and days', () => {
    const d = new Date(2025, 0, 5); // Jan 5
    expect(toDateStr(d)).toBe('2025-01-05');
  });
});

describe('getMissingDates', () => {
  it('returns weekdays that are not in history', () => {
    // Mock Date to a known Wednesday
    const realDate = globalThis.Date;
    const mockNow = new Date(2025, 0, 8, 12, 0, 0); // Wed Jan 8 2025

    vi.useFakeTimers();
    vi.setSystemTime(mockNow);

    const history = [{ id: '1', date: '2025-01-08', summary: '', output: '', projectName: '' }];
    const missing = getMissingDates(history, 3);

    // Jan 8 (Wed) is in history, Jan 7 (Tue) and Jan 6 (Mon) should be missing
    expect(missing).toContain('2025-01-07');
    expect(missing).toContain('2025-01-06');
    expect(missing).not.toContain('2025-01-08');

    vi.useRealTimers();
  });

  it('skips weekends', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 6, 12, 0, 0)); // Mon Jan 6 2025

    const missing = getMissingDates([], 4);

    // Jan 6 (Mon), Jan 5 (Sun - skip), Jan 4 (Sat - skip), Jan 3 (Fri)
    expect(missing).toContain('2025-01-06');
    expect(missing).toContain('2025-01-03');
    expect(missing).not.toContain('2025-01-05');
    expect(missing).not.toContain('2025-01-04');

    vi.useRealTimers();
  });

  it('returns empty when all dates are covered', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 8, 12, 0, 0)); // Wed Jan 8

    const history = [
      { id: '1', date: '2025-01-08', summary: '', output: '', projectName: '' },
      { id: '2', date: '2025-01-07', summary: '', output: '', projectName: '' },
      { id: '3', date: '2025-01-06', summary: '', output: '', projectName: '' },
    ];
    const missing = getMissingDates(history, 3);
    expect(missing).toEqual([]);

    vi.useRealTimers();
  });
});

// ── Git data gathering ───────────────────────────────────────────────

describe('gatherGitData', () => {
  it('includes commit log when git returns data', async () => {
    const api = createMockAPI({
      process: {
        exec: vi.fn()
          .mockResolvedValueOnce({ stdout: 'abc1234 Author 2025-01-08 fix bug', stderr: '', exitCode: 0 })
          .mockResolvedValueOnce({ stdout: '* main abc1234 fix bug', stderr: '', exitCode: 0 })
          .mockResolvedValueOnce({ stdout: ' 2 files changed, 10 insertions(+)', stderr: '', exitCode: 0 })
          .mockResolvedValueOnce({ stdout: '[]', stderr: '', exitCode: 0 }),
      },
    } as Parameters<typeof createMockAPI>[0]);

    const result = await gatherGitData(api, '/tmp/project', '2025-01-08', '2025-01-09');

    expect(result).toContain('## Commits');
    expect(result).toContain('abc1234');
  });

  it('includes merged PRs from gh CLI', async () => {
    const prs = JSON.stringify([
      { number: 42, title: 'Add feature', mergedAt: '2025-01-08T10:00:00Z', headRefName: 'feat-branch' },
    ]);

    const api = createMockAPI({
      process: {
        exec: vi.fn()
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
          .mockResolvedValueOnce({ stdout: prs, stderr: '', exitCode: 0 }),
      },
    } as Parameters<typeof createMockAPI>[0]);

    const result = await gatherGitData(api, '/tmp/project', '2025-01-08', '2025-01-09');

    expect(result).toContain('## Merged PRs');
    expect(result).toContain('#42');
    expect(result).toContain('Add feature');
  });

  it('returns no-activity message when nothing found', async () => {
    const api = createMockAPI({
      process: {
        exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
      },
    } as Parameters<typeof createMockAPI>[0]);

    const result = await gatherGitData(api, '/tmp/project', '2025-01-08', '2025-01-09');
    expect(result).toBe('No git activity found for this date range.');
  });

  it('handles git command failures gracefully', async () => {
    const api = createMockAPI({
      process: {
        exec: vi.fn().mockRejectedValue(new Error('command not found')),
      },
    } as Parameters<typeof createMockAPI>[0]);

    const result = await gatherGitData(api, '/tmp/project', '2025-01-08', '2025-01-09');
    expect(result).toBe('No git activity found for this date range.');
  });

  it('filters PRs by date range', async () => {
    const prs = JSON.stringify([
      { number: 1, title: 'In range', mergedAt: '2025-01-08T10:00:00Z', headRefName: 'a' },
      { number: 2, title: 'Out of range', mergedAt: '2025-01-10T10:00:00Z', headRefName: 'b' },
    ]);

    const api = createMockAPI({
      process: {
        exec: vi.fn()
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
          .mockResolvedValueOnce({ stdout: prs, stderr: '', exitCode: 0 }),
      },
    } as Parameters<typeof createMockAPI>[0]);

    const result = await gatherGitData(api, '/tmp/project', '2025-01-08', '2025-01-09');

    expect(result).toContain('#1');
    expect(result).not.toContain('#2');
  });
});
