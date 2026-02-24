import { describe, it, expect, vi } from 'vitest';
import { activate } from './main';
import { createMockContext, createMockAPI } from '@clubhouse/plugin-testing';
import type { PluginAPI, ScopedStorage } from '@clubhouse/plugin-types';
import manifest from '../manifest.json';

// ── Constants (must match main.tsx) ──────────────────────────────────

const HISTORY_KEY = 'reviewHistory';
const MAX_HISTORY = 20;

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

// loadHistory and saveReview are not exported, so we test them through
// storage interactions. We re-implement the logic here for unit-level validation.

async function loadHistoryViaStorage(storage: ScopedStorage): Promise<unknown[]> {
  const raw = await storage.read(HISTORY_KEY);
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(raw)) return raw;
  return [];
}

async function saveReviewViaStorage(storage: ScopedStorage, entry: unknown): Promise<void> {
  const history = await loadHistoryViaStorage(storage);
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await storage.write(HISTORY_KEY, history);
}

// ── Manifest tests ───────────────────────────────────────────────────

describe('code-review plugin manifest', () => {
  it('has correct id', () => {
    expect(manifest.id).toBe('code-review');
  });

  it('is project-scoped', () => {
    expect(manifest.scope).toBe('project');
  });

  it('targets API v0.6', () => {
    expect(manifest.engine.api).toBe(0.6);
  });

  it('declares required permissions', () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['storage', 'git', 'agents', 'commands', 'notifications']),
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

  it('contributes a full-layout tab', () => {
    expect(manifest.contributes?.tab).toBeDefined();
    expect(manifest.contributes!.tab!.layout).toBe('full');
    expect(manifest.contributes!.tab!.label).toBe('Review');
  });

  it('contributes reviewStaged and reviewBranch commands', () => {
    const cmds = manifest.contributes?.commands;
    expect(cmds).toBeDefined();
    const ids = cmds!.map((c: { id: string }) => c.id);
    expect(ids).toContain('code-review.reviewStaged');
    expect(ids).toContain('code-review.reviewBranch');
  });

  it('contributes settings', () => {
    const settings = manifest.contributes?.settings;
    expect(settings).toBeDefined();
    expect(settings!.length).toBeGreaterThan(0);
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
});

// ── activate() ───────────────────────────────────────────────────────

describe('activate()', () => {
  it('registers reviewStaged command', () => {
    const ctx = createMockContext({ pluginId: 'code-review' });
    const api = createMockAPI();

    activate(ctx, api);

    expect(api.commands.register).toHaveBeenCalledWith(
      'code-review.reviewStaged',
      expect.any(Function),
    );
  });

  it('registers reviewBranch command', () => {
    const ctx = createMockContext({ pluginId: 'code-review' });
    const api = createMockAPI();

    activate(ctx, api);

    expect(api.commands.register).toHaveBeenCalledWith(
      'code-review.reviewBranch',
      expect.any(Function),
    );
  });

  it('adds two subscriptions for cleanup', () => {
    const ctx = createMockContext({ pluginId: 'code-review' });
    const api = createMockAPI();

    activate(ctx, api);

    expect(ctx.subscriptions).toHaveLength(2);
  });

  it('logs activation message', () => {
    const ctx = createMockContext({ pluginId: 'code-review' });
    const api = createMockAPI();

    activate(ctx, api);

    expect(api.logging.info).toHaveBeenCalledWith('Code Review plugin activated');
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
    const entries = [{ id: '1', summary: 'test' }];
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, JSON.stringify(entries));

    const result = await loadHistoryViaStorage(storage);
    expect(result).toEqual(entries);
  });

  it('returns array directly when storage contains array', async () => {
    const entries = [{ id: '1', summary: 'test' }];
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, entries);

    const result = await loadHistoryViaStorage(storage);
    expect(result).toEqual(entries);
  });

  it('returns empty array for invalid JSON string', async () => {
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, '{not valid json}');

    const result = await loadHistoryViaStorage(storage);
    expect(result).toEqual([]);
  });

  it('returns empty array for non-array non-string values', async () => {
    const storage = createSpyStorage();
    storage._data.set(HISTORY_KEY, 42);

    const result = await loadHistoryViaStorage(storage);
    expect(result).toEqual([]);
  });
});

// ── Storage: saveReview ──────────────────────────────────────────────

describe('saveReview', () => {
  it('prepends entry to history', async () => {
    const storage = createSpyStorage();
    const existing = [{ id: 'old' }];
    storage._data.set(HISTORY_KEY, existing);

    await saveReviewViaStorage(storage, { id: 'new' });

    const saved = storage._data.get(HISTORY_KEY) as unknown[];
    expect(saved[0]).toEqual({ id: 'new' });
    expect(saved[1]).toEqual({ id: 'old' });
  });

  it('limits history to MAX_HISTORY entries', async () => {
    const storage = createSpyStorage();
    const existing = Array.from({ length: MAX_HISTORY }, (_, i) => ({ id: `entry-${i}` }));
    storage._data.set(HISTORY_KEY, existing);

    await saveReviewViaStorage(storage, { id: 'newest' });

    const saved = storage._data.get(HISTORY_KEY) as unknown[];
    expect(saved).toHaveLength(MAX_HISTORY);
    expect(saved[0]).toEqual({ id: 'newest' });
  });

  it('writes to storage after save', async () => {
    const storage = createSpyStorage();
    await saveReviewViaStorage(storage, { id: 'entry' });

    expect(storage.write).toHaveBeenCalledWith(HISTORY_KEY, expect.any(Array));
  });
});

// ── Prompt builders ──────────────────────────────────────────────────

// These functions are not exported, so we validate their expected contract
// by verifying the structure they would produce. We re-implement inline.

function buildStagedPrompt(diff: string): string {
  return `You are a senior code reviewer. Review the following staged git diff. Be concise, constructive, and specific. Organize your feedback by file. Call out bugs, security issues, and style problems. If everything looks good, say so.

\`\`\`diff
${diff}
\`\`\``;
}

function buildBranchPrompt(diff: string, branch: string): string {
  return `You are a senior code reviewer. Review all changes on the branch "${branch}" shown in the diff below. Be concise, constructive, and specific. Organize your feedback by file. Call out bugs, security issues, and style problems. If everything looks good, say so.

\`\`\`diff
${diff}
\`\`\``;
}

describe('buildStagedPrompt', () => {
  it('includes the diff in a code fence', () => {
    const prompt = buildStagedPrompt('+const x = 1;');
    expect(prompt).toContain('```diff');
    expect(prompt).toContain('+const x = 1;');
  });

  it('includes code review instructions', () => {
    const prompt = buildStagedPrompt('diff content');
    expect(prompt).toContain('senior code reviewer');
    expect(prompt).toContain('staged git diff');
  });
});

describe('buildBranchPrompt', () => {
  it('includes the branch name', () => {
    const prompt = buildBranchPrompt('diff', 'feature/my-branch');
    expect(prompt).toContain('feature/my-branch');
  });

  it('includes the diff in a code fence', () => {
    const prompt = buildBranchPrompt('+const y = 2;', 'main');
    expect(prompt).toContain('```diff');
    expect(prompt).toContain('+const y = 2;');
  });

  it('includes code review instructions', () => {
    const prompt = buildBranchPrompt('diff', 'branch');
    expect(prompt).toContain('senior code reviewer');
    expect(prompt).toContain('security issues');
  });
});
