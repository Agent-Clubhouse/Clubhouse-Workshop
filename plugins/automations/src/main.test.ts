import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { activate, deactivate, MainPanel } from './main';
import * as automationsModule from './main';
import { createMockContext, createMockAPI } from '@clubhouse/plugin-testing';
import type { PluginAPI, PluginContext, ScopedStorage } from '@clubhouse/plugin-types';
import type { Automation, RunRecord } from './types';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeAutomation(overrides?: Partial<Automation>): Automation {
  return {
    id: 'auto-1',
    name: 'Test Auto',
    cronExpression: '* * * * *', // every minute
    orchestrator: '',
    model: '',
    freeAgentMode: false,
    prompt: 'do stuff',
    enabled: true,
    createdAt: 1000,
    missedRunPolicy: 'ignore',
    lastRunAt: null,
    worktree: '',
    ...overrides,
  };
}

function makeRunRecord(overrides?: Partial<RunRecord>): RunRecord {
  return {
    agentId: 'agent-1',
    automationId: 'auto-1',
    startedAt: 1000,
    status: 'running',
    summary: null,
    exitCode: null,
    completedAt: null,
    ...overrides,
  };
}

/** Create a mock ScopedStorage backed by a real Map for read/write/delete/list. */
function createMapStorage(): ScopedStorage & { _data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    _data: data,
    read: vi.fn(async (key: string) => data.get(key)),
    write: vi.fn(async (key: string, value: unknown) => { data.set(key, value); }),
    delete: vi.fn(async (key: string) => { data.delete(key); }),
    list: vi.fn(async () => [...data.keys()]),
  };
}

// ── activate() ───────────────────────────────────────────────────────

describe('automations plugin activate()', () => {
  let ctx: PluginContext;
  let api: PluginAPI;
  let registerSpy: ReturnType<typeof vi.fn>;
  let onStatusChangeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ctx = createMockContext({ pluginId: 'automations' });
    registerSpy = vi.fn(() => ({ dispose: vi.fn() }));
    onStatusChangeSpy = vi.fn(() => ({ dispose: vi.fn() }));
    api = createMockAPI({
      commands: { register: registerSpy, execute: vi.fn() },
      agents: {
        ...createMockAPI().agents,
        onStatusChange: onStatusChangeSpy,
      },
    });
  });

  it('registers a create command', () => {
    activate(ctx, api);
    expect(registerSpy).toHaveBeenCalledWith('create', expect.any(Function));
  });

  it('subscribes to onStatusChange', () => {
    activate(ctx, api);
    expect(onStatusChangeSpy).toHaveBeenCalledTimes(1);
    expect(onStatusChangeSpy).toHaveBeenCalledWith(expect.any(Function));
  });

  it('pushes exactly 5 disposables to ctx.subscriptions (statusChange, interval, create, refresh, run-now)', () => {
    activate(ctx, api);
    expect(ctx.subscriptions).toHaveLength(5);
    for (const sub of ctx.subscriptions) {
      expect(typeof sub.dispose).toBe('function');
    }
  });

  it('registers a refresh command', () => {
    activate(ctx, api);
    expect(registerSpy).toHaveBeenCalledWith('refresh', expect.any(Function));
  });

  it('sets up a timer (interval disposable clears it)', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    activate(ctx, api);
    ctx.subscriptions[1].dispose();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('does not call agents.runQuick during activation', () => {
    const runQuickSpy = vi.fn();
    api = createMockAPI({
      commands: { register: registerSpy, execute: vi.fn() },
      agents: {
        ...createMockAPI().agents,
        onStatusChange: onStatusChangeSpy,
        runQuick: runQuickSpy,
      },
    });
    activate(ctx, api);
    expect(runQuickSpy).not.toHaveBeenCalled();
  });

  it('does not read storage during activation', () => {
    const readSpy = vi.fn();
    api = createMockAPI({
      commands: { register: registerSpy, execute: vi.fn() },
      agents: {
        ...createMockAPI().agents,
        onStatusChange: onStatusChangeSpy,
      },
      storage: {
        ...createMockAPI().storage,
        projectLocal: {
          ...createMockAPI().storage.projectLocal,
          read: readSpy,
        },
      },
    });
    activate(ctx, api);
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('calling activate twice registers two independent subscription sets', () => {
    activate(ctx, api);
    activate(ctx, api);
    expect(registerSpy).toHaveBeenCalledTimes(6); // create, refresh, run-now × 2
    expect(onStatusChangeSpy).toHaveBeenCalledTimes(2);
    expect(ctx.subscriptions).toHaveLength(10);
  });

  it('works without project context', () => {
    const appCtx = createMockContext({ pluginId: 'automations', projectId: undefined, projectPath: undefined });
    expect(() => activate(appCtx, api)).not.toThrow();
    expect(appCtx.subscriptions).toHaveLength(5);
  });
});

// ── Cron tick behavior ──────────────────────────────────────────────

describe('automations cron tick', () => {
  let ctx: PluginContext;
  let storage: ReturnType<typeof createMapStorage>;
  let runQuickSpy: ReturnType<typeof vi.fn>;
  let onStatusChangeSpy: ReturnType<typeof vi.fn>;
  let api: PluginAPI;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = createMockContext({ pluginId: 'automations' });
    storage = createMapStorage();
    runQuickSpy = vi.fn().mockResolvedValue('spawned-agent-1');
    onStatusChangeSpy = vi.fn(() => ({ dispose: vi.fn() }));
    api = createMockAPI({
      commands: { register: vi.fn(() => ({ dispose: vi.fn() })), execute: vi.fn() },
      agents: {
        ...createMockAPI().agents,
        runQuick: runQuickSpy,
        onStatusChange: onStatusChangeSpy,
      },
      storage: {
        ...createMockAPI().storage,
        projectLocal: storage,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires runQuick for an enabled automation whose cron matches', async () => {
    const auto = makeAutomation({ cronExpression: '* * * * *', enabled: true });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledTimes(1);
    expect(runQuickSpy).toHaveBeenCalledWith('do stuff', { model: undefined, orchestrator: undefined, freeAgentMode: undefined, projectId: undefined });
  });

  it('passes model option when set', async () => {
    const auto = makeAutomation({ model: 'fast-model' });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledWith('do stuff', { model: 'fast-model', orchestrator: undefined, freeAgentMode: undefined, projectId: undefined });
  });

  it('skips disabled automations', async () => {
    const auto = makeAutomation({ enabled: false });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).not.toHaveBeenCalled();
  });

  it('skips automations whose cron does not match', async () => {
    vi.setSystemTime(new Date(2026, 1, 15, 10, 30));
    const auto = makeAutomation({ cronExpression: '0 9 * * *' }); // 9 AM only
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).not.toHaveBeenCalled();
  });

  it('prevents re-firing within the same minute', async () => {
    vi.setSystemTime(new Date(2026, 1, 15, 10, 30, 0));
    const auto = makeAutomation({
      lastRunAt: new Date(2026, 1, 15, 10, 30, 5).getTime(), // already ran this minute
    });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).not.toHaveBeenCalled();
  });

  it('fires again in a new minute even after same-minute guard', async () => {
    vi.setSystemTime(new Date(2026, 1, 15, 10, 30, 0));
    const auto = makeAutomation({
      lastRunAt: new Date(2026, 1, 15, 10, 29, 0).getTime(), // ran last minute
    });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledTimes(1);
  });

  it('records a run in storage after firing', async () => {
    const auto = makeAutomation();
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs).toHaveLength(1);
    expect(runs[0].agentId).toBe('spawned-agent-1');
    expect(runs[0].automationId).toBe('auto-1');
    expect(runs[0].status).toBe('running');
    expect(runs[0].summary).toBeNull();
    expect(runs[0].completedAt).toBeNull();
  });

  it('updates lastRunAt on the automation after firing', async () => {
    const auto = makeAutomation();
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    const automations = storage._data.get('automations') as Automation[];
    expect(automations[0].lastRunAt).toBeTypeOf('number');
    expect(automations[0].lastRunAt).toBeGreaterThan(0);
  });

  it('caps run records at 50', async () => {
    const auto = makeAutomation();
    const existingRuns = Array.from({ length: 50 }, (_, i) =>
      makeRunRecord({ agentId: `old-${i}`, status: 'completed' }),
    );
    storage._data.set('automations', [auto]);
    storage._data.set('runs:auto-1', existingRuns);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs).toHaveLength(50);
    expect(runs[0].agentId).toBe('spawned-agent-1');
  });

  it('survives runQuick rejection without crashing', async () => {
    runQuickSpy.mockRejectedValue(new Error('spawn failed'));
    const auto = makeAutomation();
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(storage._data.has('runs:auto-1')).toBe(false);
  });

  it('handles storage returning undefined (no automations key yet)', async () => {
    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).not.toHaveBeenCalled();
  });

  it('passes orchestrator option when set', async () => {
    const auto = makeAutomation({ orchestrator: 'claude-code' });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledWith('do stuff', { model: undefined, orchestrator: 'claude-code', freeAgentMode: undefined, projectId: undefined });
  });

  it('passes freeAgentMode when enabled', async () => {
    const auto = makeAutomation({ freeAgentMode: true });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledWith('do stuff', { model: undefined, orchestrator: undefined, freeAgentMode: true, projectId: undefined });
  });

  it('passes all options when orchestrator, model, and freeAgentMode are set', async () => {
    const auto = makeAutomation({ orchestrator: 'claude-code', model: 'opus', freeAgentMode: true });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledWith('do stuff', { model: 'opus', orchestrator: 'claude-code', freeAgentMode: true, projectId: undefined });
  });

  it('passes projectId when worktree is set', async () => {
    const auto = makeAutomation({ worktree: 'project-2' });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledWith('do stuff', { model: undefined, orchestrator: undefined, freeAgentMode: undefined, projectId: 'project-2' });
  });

  it('does not pass projectId when worktree is empty string', async () => {
    const auto = makeAutomation({ worktree: '' });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledWith('do stuff', { model: undefined, orchestrator: undefined, freeAgentMode: undefined, projectId: undefined });
  });

  it('does not pass projectId when worktree is undefined (backwards compat)', async () => {
    const auto = makeAutomation();
    delete (auto as any).worktree;
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledWith('do stuff', { model: undefined, orchestrator: undefined, freeAgentMode: undefined, projectId: undefined });
  });

  it('passes all options including projectId when all fields are set', async () => {
    const auto = makeAutomation({ orchestrator: 'claude-code', model: 'opus', freeAgentMode: true, worktree: 'project-x' });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledWith('do stuff', { model: 'opus', orchestrator: 'claude-code', freeAgentMode: true, projectId: 'project-x' });
  });

  it('handles storage returning non-array data gracefully', async () => {
    storage._data.set('automations', 'corrupted');
    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).not.toHaveBeenCalled();
  });

  it('fires multiple automations in one tick if both match', async () => {
    const auto1 = makeAutomation({ id: 'a1', prompt: 'first' });
    const auto2 = makeAutomation({ id: 'a2', prompt: 'second' });
    storage._data.set('automations', [auto1, auto2]);
    runQuickSpy.mockResolvedValueOnce('agent-a1').mockResolvedValueOnce('agent-a2');

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledTimes(2);
    expect(runQuickSpy).toHaveBeenCalledWith('first', { model: undefined, orchestrator: undefined, freeAgentMode: undefined, projectId: undefined });
    expect(runQuickSpy).toHaveBeenCalledWith('second', { model: undefined, orchestrator: undefined, freeAgentMode: undefined, projectId: undefined });
  });
});

// ── onStatusChange callback behavior ────────────────────────────────

describe('automations onStatusChange tracking', () => {
  let ctx: PluginContext;
  let storage: ReturnType<typeof createMapStorage>;
  let statusChangeCallback: (agentId: string, status: string, prevStatus: string) => void;
  let runQuickSpy: ReturnType<typeof vi.fn>;
  let listCompletedSpy: ReturnType<typeof vi.fn>;
  let api: PluginAPI;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = createMockContext({ pluginId: 'automations' });
    storage = createMapStorage();
    runQuickSpy = vi.fn().mockResolvedValue('spawned-agent-1');
    listCompletedSpy = vi.fn().mockReturnValue([]);

    api = createMockAPI({
      commands: { register: vi.fn(() => ({ dispose: vi.fn() })), execute: vi.fn() },
      agents: {
        ...createMockAPI().agents,
        runQuick: runQuickSpy,
        listCompleted: listCompletedSpy,
        onStatusChange: vi.fn((cb) => {
          statusChangeCallback = cb;
          return { dispose: vi.fn() };
        }),
      },
      storage: {
        ...createMockAPI().storage,
        projectLocal: storage,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function fireAndComplete(agentId: string, automationId: string) {
    const auto = makeAutomation({ id: automationId });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    return statusChangeCallback;
  }

  it('updates run record to completed on running→sleeping', async () => {
    listCompletedSpy.mockReturnValue([
      { id: 'spawned-agent-1', summary: 'Did the thing', exitCode: 0 },
    ]);
    await fireAndComplete('spawned-agent-1', 'auto-1');

    statusChangeCallback('spawned-agent-1', 'sleeping', 'running');

    await vi.advanceTimersByTimeAsync(0);

    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs[0].status).toBe('completed');
    expect(runs[0].summary).toBe('Did the thing');
    expect(runs[0].exitCode).toBe(0);
    expect(runs[0].completedAt).toBeTypeOf('number');
  });

  it('updates run record to failed on running→error', async () => {
    listCompletedSpy.mockReturnValue([
      { id: 'spawned-agent-1', summary: null, exitCode: 1 },
    ]);
    await fireAndComplete('spawned-agent-1', 'auto-1');

    statusChangeCallback('spawned-agent-1', 'error', 'running');
    await vi.advanceTimersByTimeAsync(0);

    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs[0].status).toBe('failed');
    expect(runs[0].exitCode).toBe(1);
  });

  it('ignores agents not tracked in pendingRuns', async () => {
    activate(ctx, api);
    statusChangeCallback('unknown-agent', 'sleeping', 'running');
    await vi.advanceTimersByTimeAsync(0);

    expect(storage.write).not.toHaveBeenCalled();
  });

  it('ignores non-completion transitions (e.g. sleeping→running)', async () => {
    await fireAndComplete('spawned-agent-1', 'auto-1');

    (storage.write as ReturnType<typeof vi.fn>).mockClear();

    statusChangeCallback('spawned-agent-1', 'running', 'sleeping');
    await vi.advanceTimersByTimeAsync(0);

    expect(storage.write).not.toHaveBeenCalled();
  });

  it('handles missing summary in listCompleted gracefully (null fallback)', async () => {
    listCompletedSpy.mockReturnValue([]);
    await fireAndComplete('spawned-agent-1', 'auto-1');

    statusChangeCallback('spawned-agent-1', 'sleeping', 'running');
    await vi.advanceTimersByTimeAsync(0);

    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs[0].summary).toBeNull();
    expect(runs[0].exitCode).toBeNull();
  });

  it('updates lastRunAt on the automation after completion', async () => {
    listCompletedSpy.mockReturnValue([
      { id: 'spawned-agent-1', summary: 'done', exitCode: 0 },
    ]);
    await fireAndComplete('spawned-agent-1', 'auto-1');

    const beforeLastRunAt = (storage._data.get('automations') as Automation[])[0].lastRunAt;

    statusChangeCallback('spawned-agent-1', 'sleeping', 'running');
    await vi.advanceTimersByTimeAsync(0);

    const afterLastRunAt = (storage._data.get('automations') as Automation[])[0].lastRunAt;
    expect(afterLastRunAt).toBeTypeOf('number');
    expect(afterLastRunAt!).toBeGreaterThanOrEqual(beforeLastRunAt!);
  });

  it('removes agent from pendingRuns after completion (no double-processing)', async () => {
    listCompletedSpy.mockReturnValue([
      { id: 'spawned-agent-1', summary: 'done', exitCode: 0 },
    ]);
    await fireAndComplete('spawned-agent-1', 'auto-1');

    statusChangeCallback('spawned-agent-1', 'sleeping', 'running');
    await vi.advanceTimersByTimeAsync(0);

    (storage.write as ReturnType<typeof vi.fn>).mockClear();

    statusChangeCallback('spawned-agent-1', 'sleeping', 'running');
    await vi.advanceTimersByTimeAsync(0);

    expect(storage.write).not.toHaveBeenCalled();
  });
});

// ── Missed-run catch-up behavior ─────────────────────────────────────

describe('automations missed-run catch-up', () => {
  let ctx: PluginContext;
  let storage: ReturnType<typeof createMapStorage>;
  let runQuickSpy: ReturnType<typeof vi.fn>;
  let onStatusChangeSpy: ReturnType<typeof vi.fn>;
  let api: PluginAPI;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = createMockContext({ pluginId: 'automations' });
    storage = createMapStorage();
    runQuickSpy = vi.fn().mockResolvedValue('spawned-agent-1');
    onStatusChangeSpy = vi.fn(() => ({ dispose: vi.fn() }));
    api = createMockAPI({
      commands: { register: vi.fn(() => ({ dispose: vi.fn() })), execute: vi.fn() },
      agents: {
        ...createMockAPI().agents,
        runQuick: runQuickSpy,
        onStatusChange: onStatusChangeSpy,
      },
      storage: {
        ...createMockAPI().storage,
        projectLocal: storage,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ignores missed runs when policy is "ignore"', async () => {
    // Set time to 10:30, but lastRunAt was 2 hours ago (8:30) — many missed hourly runs
    vi.setSystemTime(new Date(2026, 1, 15, 10, 30, 0));
    const auto = makeAutomation({
      cronExpression: '0 * * * *', // every hour
      missedRunPolicy: 'ignore',
      lastRunAt: new Date(2026, 1, 15, 8, 30, 0).getTime(),
    });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    // Should not fire because 10:30 doesn't match "0 * * * *"
    expect(runQuickSpy).not.toHaveBeenCalled();
  });

  it('fires once when policy is "run-once" with missed runs', async () => {
    vi.setSystemTime(new Date(2026, 1, 15, 10, 30, 0));
    const auto = makeAutomation({
      cronExpression: '0 * * * *', // every hour
      missedRunPolicy: 'run-once',
      lastRunAt: new Date(2026, 1, 15, 7, 0, 0).getTime(), // 3.5 hours ago → 3 missed
    });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledTimes(1);
  });

  it('fires up to missed count when policy is "run-all"', async () => {
    vi.setSystemTime(new Date(2026, 1, 15, 10, 30, 0));
    let callCount = 0;
    runQuickSpy.mockImplementation(() => Promise.resolve(`agent-${++callCount}`));
    const auto = makeAutomation({
      cronExpression: '0 * * * *', // every hour
      missedRunPolicy: 'run-all',
      lastRunAt: new Date(2026, 1, 15, 7, 0, 0).getTime(), // 3 missed: 8:00, 9:00, 10:00
    });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledTimes(3);
  });

  it('caps "run-all" at 10 catch-up runs', async () => {
    vi.setSystemTime(new Date(2026, 1, 15, 12, 0, 0));
    let callCount = 0;
    runQuickSpy.mockImplementation(() => Promise.resolve(`agent-${++callCount}`));
    const auto = makeAutomation({
      cronExpression: '*/5 * * * *', // every 5 min
      missedRunPolicy: 'run-all',
      lastRunAt: new Date(2026, 1, 15, 0, 0, 0).getTime(), // 12 hours ago → way more than 10
    });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).toHaveBeenCalledTimes(10);
  });

  it('does not catch up when there are no missed runs', async () => {
    vi.setSystemTime(new Date(2026, 1, 15, 10, 0, 15)); // 10:00:15
    const auto = makeAutomation({
      cronExpression: '0 * * * *',
      missedRunPolicy: 'run-once',
      lastRunAt: new Date(2026, 1, 15, 10, 0, 0).getTime(), // just ran at 10:00
    });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    // No missed runs, and current time (10:00) matches but same-minute guard blocks it
    expect(runQuickSpy).not.toHaveBeenCalled();
  });

  it('defaults to ignore when missedRunPolicy is not set (backwards compat)', async () => {
    vi.setSystemTime(new Date(2026, 1, 15, 10, 30, 0));
    const auto = makeAutomation({
      cronExpression: '0 * * * *',
      lastRunAt: new Date(2026, 1, 15, 7, 0, 0).getTime(),
    });
    // Simulate old data without missedRunPolicy
    delete (auto as any).missedRunPolicy;
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).not.toHaveBeenCalled();
  });

  it('skips catch-up for disabled automations', async () => {
    vi.setSystemTime(new Date(2026, 1, 15, 10, 30, 0));
    const auto = makeAutomation({
      cronExpression: '0 * * * *',
      missedRunPolicy: 'run-once',
      enabled: false,
      lastRunAt: new Date(2026, 1, 15, 7, 0, 0).getTime(),
    });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(runQuickSpy).not.toHaveBeenCalled();
  });
});

// ── Run Now command behavior ─────────────────────────────────────────

describe('automations run-now command', () => {
  let ctx: PluginContext;
  let storage: ReturnType<typeof createMapStorage>;
  let runQuickSpy: ReturnType<typeof vi.fn>;
  let registerSpy: ReturnType<typeof vi.fn>;
  let runNowCallback: (automationId?: string) => Promise<void>;
  let api: PluginAPI;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = createMockContext({ pluginId: 'automations' });
    storage = createMapStorage();
    runQuickSpy = vi.fn().mockResolvedValue('manual-agent-1');

    registerSpy = vi.fn((name: string, cb: any) => {
      if (name === 'run-now') runNowCallback = cb;
      return { dispose: vi.fn() };
    });

    api = createMockAPI({
      commands: { register: registerSpy, execute: vi.fn() },
      agents: {
        ...createMockAPI().agents,
        runQuick: runQuickSpy,
        onStatusChange: vi.fn(() => ({ dispose: vi.fn() })),
      },
      storage: {
        ...createMockAPI().storage,
        projectLocal: storage,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers a run-now command', () => {
    activate(ctx, api);
    expect(registerSpy).toHaveBeenCalledWith('run-now', expect.any(Function));
  });

  it('fires the automation when run-now is invoked', async () => {
    const auto = makeAutomation({ enabled: true });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await runNowCallback('auto-1');

    expect(runQuickSpy).toHaveBeenCalledTimes(1);
    expect(runQuickSpy).toHaveBeenCalledWith('do stuff', { model: undefined, orchestrator: undefined, freeAgentMode: undefined, projectId: undefined });
  });

  it('works even when automation is disabled', async () => {
    const auto = makeAutomation({ enabled: false });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await runNowCallback('auto-1');

    expect(runQuickSpy).toHaveBeenCalledTimes(1);
  });

  it('records a run in storage', async () => {
    const auto = makeAutomation();
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await runNowCallback('auto-1');

    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs).toHaveLength(1);
    expect(runs[0].agentId).toBe('manual-agent-1');
    expect(runs[0].status).toBe('running');
  });

  it('updates lastRunAt after run-now', async () => {
    const auto = makeAutomation({ lastRunAt: null });
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await runNowCallback('auto-1');

    const automations = storage._data.get('automations') as Automation[];
    expect(automations[0].lastRunAt).toBeTypeOf('number');
  });

  it('does nothing when automationId is not provided', async () => {
    activate(ctx, api);
    await runNowCallback(undefined);
    expect(runQuickSpy).not.toHaveBeenCalled();
  });

  it('does nothing when automationId is not found', async () => {
    storage._data.set('automations', []);
    activate(ctx, api);
    await runNowCallback('nonexistent');
    expect(runQuickSpy).not.toHaveBeenCalled();
  });

  it('survives runQuick rejection', async () => {
    runQuickSpy.mockRejectedValue(new Error('spawn failed'));
    const auto = makeAutomation();
    storage._data.set('automations', [auto]);

    activate(ctx, api);
    await expect(runNowCallback('auto-1')).resolves.not.toThrow();
  });
});

// ── deactivate() ─────────────────────────────────────────────────────

describe('automations plugin deactivate()', () => {
  it('is a no-op function', () => {
    expect(() => deactivate()).not.toThrow();
  });

  it('returns void', () => {
    expect(deactivate()).toBeUndefined();
  });

  it('can be called multiple times', () => {
    deactivate();
    deactivate();
    deactivate();
  });
});

// ── MainPanel (component contract) ───────────────────────────────────

describe('automations plugin MainPanel', () => {
  it('is exported as a function', () => {
    expect(typeof MainPanel).toBe('function');
  });

  it('conforms to PluginModule.MainPanel shape (accepts { api })', () => {
    expect(MainPanel.length).toBeLessThanOrEqual(1);
  });
});

// ── API assumptions ──────────────────────────────────────────────────

describe('automations plugin API assumptions', () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockAPI();
  });

  describe('storage.projectLocal', () => {
    it('read exists and returns a promise', () => {
      expect(typeof api.storage.projectLocal.read).toBe('function');
      expect(api.storage.projectLocal.read('key')).toBeInstanceOf(Promise);
    });

    it('read resolves to undefined for missing keys', async () => {
      const val = await api.storage.projectLocal.read('nonexistent');
      expect(val).toBeUndefined();
      expect(Array.isArray(val)).toBe(false);
    });

    it('write exists and returns a promise', () => {
      expect(typeof api.storage.projectLocal.write).toBe('function');
      expect(api.storage.projectLocal.write('key', 'val')).toBeInstanceOf(Promise);
    });

    it('write accepts JSON-serializable arrays', async () => {
      const data = [makeAutomation()];
      await expect(api.storage.projectLocal.write('automations', data)).resolves.not.toThrow();
    });

    it('delete exists and returns a promise', () => {
      expect(typeof api.storage.projectLocal.delete).toBe('function');
      expect(api.storage.projectLocal.delete('key')).toBeInstanceOf(Promise);
    });
  });

  describe('agents.runQuick', () => {
    it('exists and is callable', () => {
      expect(typeof api.agents.runQuick).toBe('function');
    });

    it('returns a promise resolving to a string (agentId)', async () => {
      const result = await api.agents.runQuick('mission');
      expect(typeof result).toBe('string');
    });

    it('accepts optional model option', async () => {
      await expect(api.agents.runQuick('mission', { model: 'fast' })).resolves.toBeDefined();
    });

    it('accepts undefined model', async () => {
      await expect(api.agents.runQuick('mission', { model: undefined })).resolves.toBeDefined();
    });
  });

  describe('agents.onStatusChange', () => {
    it('exists and returns a Disposable', () => {
      const d = api.agents.onStatusChange(() => {});
      expect(typeof d.dispose).toBe('function');
    });

    it('dispose does not throw', () => {
      const d = api.agents.onStatusChange(() => {});
      expect(() => d.dispose()).not.toThrow();
    });
  });

  describe('agents.listCompleted', () => {
    it('exists and returns an array', () => {
      expect(Array.isArray(api.agents.listCompleted())).toBe(true);
    });
  });

  describe('agents.getModelOptions', () => {
    it('exists and returns a promise', () => {
      expect(api.agents.getModelOptions()).toBeInstanceOf(Promise);
    });

    it('resolves to an array of { id: string, label: string }', async () => {
      const opts = await api.agents.getModelOptions();
      expect(Array.isArray(opts)).toBe(true);
    });

    it('accepts optional orchestrator parameter', async () => {
      const opts = await api.agents.getModelOptions(undefined, 'claude-code');
      expect(Array.isArray(opts)).toBe(true);
    });
  });

  describe('agents.listOrchestrators', () => {
    it('exists and returns an array', () => {
      const result = api.agents.listOrchestrators();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('agents.checkOrchestratorAvailability', () => {
    it('exists and returns a promise', () => {
      expect(api.agents.checkOrchestratorAvailability('test')).toBeInstanceOf(Promise);
    });

    it('resolves to an object with available boolean', async () => {
      const result = await api.agents.checkOrchestratorAvailability('test');
      expect(typeof result.available).toBe('boolean');
    });
  });

  describe('projects.list', () => {
    it('exists and returns an array', () => {
      expect(typeof api.projects.list).toBe('function');
      expect(Array.isArray(api.projects.list())).toBe(true);
    });
  });

  describe('commands.register', () => {
    it('returns a Disposable', () => {
      const d = api.commands.register('create', () => {});
      expect(typeof d.dispose).toBe('function');
    });
  });

  describe('navigation.focusAgent', () => {
    it('exists and is callable', () => {
      expect(typeof api.navigation.focusAgent).toBe('function');
    });

    it('accepts an agentId string', () => {
      expect(() => api.navigation.focusAgent('agent-123')).not.toThrow();
    });
  });

  describe('agents.kill', () => {
    it('exists and is callable', () => {
      expect(typeof api.agents.kill).toBe('function');
    });

    it('returns a promise', () => {
      expect(api.agents.kill('agent-123')).toBeInstanceOf(Promise);
    });
  });

  describe('widgets.QuickAgentGhost', () => {
    it('exists and is a component (function)', () => {
      expect(typeof api.widgets.QuickAgentGhost).toBe('function');
    });
  });

  describe('ui.showConfirm', () => {
    it('exists and is callable', () => {
      expect(typeof api.ui.showConfirm).toBe('function');
    });

    it('returns a promise', () => {
      expect(api.ui.showConfirm('message')).toBeInstanceOf(Promise);
    });

    it('resolves to a boolean', async () => {
      const result = await api.ui.showConfirm('Delete?');
      expect(typeof result).toBe('boolean');
    });
  });
});

// ── Plugin lifecycle integration ─────────────────────────────────────

describe('automations plugin lifecycle', () => {
  it('activate then deactivate does not throw', () => {
    const ctx = createMockContext({ pluginId: 'automations' });
    const api = createMockAPI();
    activate(ctx, api);
    deactivate();
  });

  it('subscriptions from activate are disposable', () => {
    const ctx = createMockContext({ pluginId: 'automations' });
    const disposeSpy = vi.fn();
    const api = createMockAPI({
      commands: { register: () => ({ dispose: disposeSpy }), execute: vi.fn() },
      agents: {
        ...createMockAPI().agents,
        onStatusChange: () => ({ dispose: disposeSpy }),
      },
    });
    activate(ctx, api);
    for (const sub of ctx.subscriptions) {
      sub.dispose();
    }
    // statusChange dispose + create command dispose + refresh command dispose + run-now dispose (interval uses clearInterval, not the spy)
    expect(disposeSpy).toHaveBeenCalledTimes(4);
  });

  it('subscriptions dispose is idempotent (double-dispose safe)', () => {
    const ctx = createMockContext({ pluginId: 'automations' });
    const disposeSpy = vi.fn();
    const api = createMockAPI({
      commands: { register: () => ({ dispose: disposeSpy }), execute: vi.fn() },
      agents: {
        ...createMockAPI().agents,
        onStatusChange: () => ({ dispose: disposeSpy }),
      },
    });
    activate(ctx, api);
    for (const sub of ctx.subscriptions) {
      sub.dispose();
      sub.dispose();
    }
    expect(disposeSpy).toHaveBeenCalledTimes(8);
  });

  it('interval stops firing after dispose', async () => {
    vi.useFakeTimers();
    const storage = createMapStorage();
    const runQuickSpy = vi.fn().mockResolvedValue('a1');
    storage._data.set('automations', [makeAutomation()]);
    const api = createMockAPI({
      commands: { register: vi.fn(() => ({ dispose: vi.fn() })), execute: vi.fn() },
      agents: {
        ...createMockAPI().agents,
        runQuick: runQuickSpy,
        onStatusChange: vi.fn(() => ({ dispose: vi.fn() })),
      },
      storage: { ...createMockAPI().storage, projectLocal: storage },
    });
    const ctx = createMockContext({ pluginId: 'automations' });

    activate(ctx, api);
    ctx.subscriptions[1].dispose();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(runQuickSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

// ── Module exports ───────────────────────────────────────────────────

describe('automations plugin module exports', () => {
  it('exports activate function', () => {
    expect(typeof automationsModule.activate).toBe('function');
  });

  it('exports deactivate function', () => {
    expect(typeof automationsModule.deactivate).toBe('function');
  });

  it('exports MainPanel component', () => {
    expect(typeof automationsModule.MainPanel).toBe('function');
  });

  it('does not export SidebarPanel (full layout, no sidebar)', () => {
    expect((automationsModule as any).SidebarPanel).toBeUndefined();
  });

  it('does not export HubPanel', () => {
    expect((automationsModule as any).HubPanel).toBeUndefined();
  });

  it('does not export SettingsPanel', () => {
    expect((automationsModule as any).SettingsPanel).toBeUndefined();
  });
});

// ── Fix B: broadened terminal status detection ───────────────────────
// Any transition TO 'sleeping' or 'error' counts as completion, regardless
// of what the previous status was.

describe('automations onStatusChange terminal-status detection (Fix B)', () => {
  let ctx: PluginContext;
  let storage: ReturnType<typeof createMapStorage>;
  let statusChangeCallback: (agentId: string, status: string, prevStatus: string) => void;
  let runQuickSpy: ReturnType<typeof vi.fn>;
  let listCompletedSpy: ReturnType<typeof vi.fn>;
  let api: PluginAPI;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = createMockContext({ pluginId: 'automations' });
    storage = createMapStorage();
    runQuickSpy = vi.fn().mockResolvedValue('spawned-agent-1');
    listCompletedSpy = vi.fn().mockReturnValue([]);

    api = createMockAPI({
      commands: { register: vi.fn(() => ({ dispose: vi.fn() })), execute: vi.fn() },
      agents: {
        ...createMockAPI().agents,
        runQuick: runQuickSpy,
        listCompleted: listCompletedSpy,
        onStatusChange: vi.fn((cb) => {
          statusChangeCallback = cb;
          return { dispose: vi.fn() };
        }),
      },
      storage: {
        ...createMockAPI().storage,
        projectLocal: storage,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function fireAgent() {
    const auto = makeAutomation({ id: 'auto-1' });
    storage._data.set('automations', [auto]);
    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);
  }

  it('treats creating→sleeping as completion (intermediate prevStatus is ignored)', async () => {
    listCompletedSpy.mockReturnValue([
      { id: 'spawned-agent-1', summary: 'Done', exitCode: 0 },
    ]);
    await fireAgent();

    statusChangeCallback('spawned-agent-1', 'sleeping', 'creating');
    await vi.advanceTimersByTimeAsync(0);

    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs[0].status).toBe('completed');
    expect(runs[0].summary).toBe('Done');
  });

  it('treats creating→error as failure', async () => {
    await fireAgent();

    statusChangeCallback('spawned-agent-1', 'error', 'creating');
    await vi.advanceTimersByTimeAsync(0);

    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs[0].status).toBe('failed');
  });

  it('does not treat creating→running as completion (non-terminal status)', async () => {
    await fireAgent();

    (storage.write as ReturnType<typeof vi.fn>).mockClear();
    statusChangeCallback('spawned-agent-1', 'running', 'creating');
    await vi.advanceTimersByTimeAsync(0);

    expect(storage.write).not.toHaveBeenCalled();
  });
});

// ── Fix A: stale run reconciliation ─────────────────────────────────
// On each cron tick, stale 'running' records are cross-checked against the
// live agent list and updated to their correct terminal status.

describe('automations stale run reconciliation (Fix A)', () => {
  let ctx: PluginContext;
  let storage: ReturnType<typeof createMapStorage>;
  let runQuickSpy: ReturnType<typeof vi.fn>;
  let listSpy: ReturnType<typeof vi.fn>;
  let listCompletedSpy: ReturnType<typeof vi.fn>;
  let statusChangeCallback: (agentId: string, status: string, prevStatus: string) => void;
  let api: PluginAPI;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = createMockContext({ pluginId: 'automations' });
    storage = createMapStorage();
    runQuickSpy = vi.fn().mockResolvedValue('new-agent-1');
    listSpy = vi.fn().mockReturnValue([]);
    listCompletedSpy = vi.fn().mockReturnValue([]);

    api = createMockAPI({
      commands: { register: vi.fn(() => ({ dispose: vi.fn() })), execute: vi.fn() },
      agents: {
        ...createMockAPI().agents,
        runQuick: runQuickSpy,
        list: listSpy,
        listCompleted: listCompletedSpy,
        onStatusChange: vi.fn((cb) => {
          statusChangeCallback = cb;
          return { dispose: vi.fn() };
        }),
      },
      storage: {
        ...createMockAPI().storage,
        projectLocal: storage,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks stale running record as completed when agent is in listCompleted', async () => {
    const auto = makeAutomation({ id: 'auto-1', enabled: false });
    const staleRun = makeRunRecord({ agentId: 'stale-agent-1', status: 'running' });
    storage._data.set('automations', [auto]);
    storage._data.set('runs:auto-1', [staleRun]);

    listSpy.mockReturnValue([]);
    listCompletedSpy.mockReturnValue([
      { id: 'stale-agent-1', summary: 'Did the thing', exitCode: 0 },
    ]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs[0].status).toBe('completed');
    expect(runs[0].summary).toBe('Did the thing');
    expect(runs[0].exitCode).toBe(0);
    expect(runs[0].completedAt).toBeTypeOf('number');
  });

  it('marks stale running record as failed when agent is not found anywhere', async () => {
    const auto = makeAutomation({ id: 'auto-1', enabled: false });
    const staleRun = makeRunRecord({ agentId: 'stale-agent-1', status: 'running' });
    storage._data.set('automations', [auto]);
    storage._data.set('runs:auto-1', [staleRun]);

    listSpy.mockReturnValue([]);
    listCompletedSpy.mockReturnValue([]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs[0].status).toBe('failed');
    expect(runs[0].completedAt).toBeTypeOf('number');
  });

  it('marks stale running record as completed when agent in active list with sleeping status', async () => {
    const auto = makeAutomation({ id: 'auto-1', enabled: false });
    const staleRun = makeRunRecord({ agentId: 'stale-agent-1', status: 'running' });
    storage._data.set('automations', [auto]);
    storage._data.set('runs:auto-1', [staleRun]);

    listSpy.mockReturnValue([
      { id: 'stale-agent-1', name: 'Done', kind: 'quick', status: 'sleeping', color: '#fff', projectId: 'test', exitCode: 0 },
    ]);
    listCompletedSpy.mockReturnValue([
      { id: 'stale-agent-1', summary: 'Summary here', exitCode: 0 },
    ]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs[0].status).toBe('completed');
    expect(runs[0].summary).toBe('Summary here');
  });

  it('marks stale running record as failed when agent in active list with error status', async () => {
    const auto = makeAutomation({ id: 'auto-1', enabled: false });
    const staleRun = makeRunRecord({ agentId: 'stale-agent-1', status: 'running' });
    storage._data.set('automations', [auto]);
    storage._data.set('runs:auto-1', [staleRun]);

    listSpy.mockReturnValue([
      { id: 'stale-agent-1', name: 'Errored', kind: 'quick', status: 'error', color: '#fff', projectId: 'test' },
    ]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs[0].status).toBe('failed');
    expect(runs[0].completedAt).toBeTypeOf('number');
  });

  it('does not write to storage when there are no stale runs', async () => {
    const auto = makeAutomation({ id: 'auto-1', enabled: false });
    storage._data.set('automations', [auto]);
    // No run records at all

    activate(ctx, api);
    (storage.write as ReturnType<typeof vi.fn>).mockClear();
    await vi.advanceTimersByTimeAsync(30_000);

    // Disabled automation → no cron fire, no reconciliation writes
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('re-populates pendingRuns for genuinely still-running agents', async () => {
    const auto = makeAutomation({ id: 'auto-1', enabled: false });
    const activeRun = makeRunRecord({ agentId: 'active-agent-1', status: 'running' });
    storage._data.set('automations', [auto]);
    storage._data.set('runs:auto-1', [activeRun]);

    // Agent is genuinely still running
    listSpy.mockReturnValue([
      { id: 'active-agent-1', name: 'Active', kind: 'quick', status: 'running', color: '#fff', projectId: 'test' },
    ]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    // Run should remain 'running' (not erroneously changed)
    const runsDuring = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runsDuring[0].status).toBe('running');

    // After the agent completes, the onStatusChange callback should update
    // the record because pendingRuns was re-populated by reconciliation.
    listCompletedSpy.mockReturnValue([
      { id: 'active-agent-1', summary: 'Finally done', exitCode: 0 },
    ]);
    statusChangeCallback('active-agent-1', 'sleeping', 'running');
    await vi.advanceTimersByTimeAsync(0);

    const runsAfter = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runsAfter[0].status).toBe('completed');
    expect(runsAfter[0].summary).toBe('Finally done');
  });

  it('reconciles multiple stale runs across multiple automations', async () => {
    const auto1 = makeAutomation({ id: 'auto-1', enabled: false });
    const auto2 = makeAutomation({ id: 'auto-2', enabled: false });
    storage._data.set('automations', [auto1, auto2]);
    storage._data.set('runs:auto-1', [makeRunRecord({ agentId: 'stale-a1', automationId: 'auto-1', status: 'running' })]);
    storage._data.set('runs:auto-2', [makeRunRecord({ agentId: 'stale-a2', automationId: 'auto-2', status: 'running' })]);

    listSpy.mockReturnValue([]);
    listCompletedSpy.mockReturnValue([
      { id: 'stale-a1', summary: 'Done 1', exitCode: 0 },
      { id: 'stale-a2', summary: 'Done 2', exitCode: 0 },
    ]);

    activate(ctx, api);
    await vi.advanceTimersByTimeAsync(30_000);

    expect((storage._data.get('runs:auto-1') as RunRecord[])[0].status).toBe('completed');
    expect((storage._data.get('runs:auto-2') as RunRecord[])[0].status).toBe('completed');
  });

  it('does not reconcile a run that is already completed', async () => {
    const auto = makeAutomation({ id: 'auto-1', enabled: false });
    const completedRun = makeRunRecord({ agentId: 'old-agent', status: 'completed', completedAt: 999 });
    storage._data.set('automations', [auto]);
    storage._data.set('runs:auto-1', [completedRun]);

    activate(ctx, api);
    (storage.write as ReturnType<typeof vi.fn>).mockClear();
    await vi.advanceTimersByTimeAsync(30_000);

    // Already-completed run must not be touched
    expect(storage.write).not.toHaveBeenCalled();
    const runs = storage._data.get('runs:auto-1') as RunRecord[];
    expect(runs[0].completedAt).toBe(999);
  });
});
