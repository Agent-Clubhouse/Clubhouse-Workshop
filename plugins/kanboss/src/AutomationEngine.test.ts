import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { createMockAPI } from '@clubhouse/plugin-testing';
import type { PluginAPI } from '@clubhouse/plugin-types';
import type { Card, Board, AutomationRun, RunHistoryEntry } from './types';
import { BOARDS_KEY, cardsKey, AUTOMATION_RUNS_KEY, RUN_HISTORY_KEY } from './types';
import { _resetMutexes } from './storageQueue';
import { kanBossState } from './state';
import {
  triggerAutomation,
  initAutomationEngine,
  shutdownAutomationEngine,
  resolveExecutionAgent,
  resolveEvaluationAgent,
} from './AutomationEngine';

// ── Test Helpers ───────────────────────────────────────────────────────

function makeBoard(overrides?: Partial<Board>): Board {
  return {
    id: 'board-1',
    name: 'Test Board',
    states: [
      {
        id: 'state-todo',
        name: 'To Do',
        order: 0,
        isAutomatic: false,
        automationPrompt: '',
        evaluationPrompt: '',
        wipLimit: 0,
        executionAgentId: null,
        evaluationAgentId: null,
      },
      {
        id: 'state-doing',
        name: 'Doing',
        order: 1,
        isAutomatic: true,
        automationPrompt: 'Implement the feature',
        evaluationPrompt: 'Verify the feature works',
        wipLimit: 0,
        executionAgentId: null,
        evaluationAgentId: null,
      },
      {
        id: 'state-done',
        name: 'Done',
        order: 2,
        isAutomatic: false,
        automationPrompt: '',
        evaluationPrompt: '',
        wipLimit: 0,
        executionAgentId: null,
        evaluationAgentId: null,
      },
    ],
    swimlanes: [
      {
        id: 'lane-1',
        name: 'Default',
        order: 0,
        managerAgentId: 'manager-agent',
        evaluationAgentId: null,
      },
    ],
    labels: [],
    config: {
      maxRetries: 3,
      zoomLevel: 1,
      gitHistory: false,
    },
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeCard(overrides?: Partial<Card>): Card {
  return {
    id: 'card-1',
    boardId: 'board-1',
    title: 'Test Card',
    body: 'Test description',
    priority: 'medium',
    labels: [],
    stateId: 'state-doing',
    swimlaneId: 'lane-1',
    history: [],
    automationAttempts: 0,
    dueDate: null,
    subtasks: [],
    assigneeAgentId: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeRun(overrides?: Partial<AutomationRun>): AutomationRun {
  return {
    cardId: 'card-1',
    boardId: 'board-1',
    stateId: 'state-doing',
    swimlaneId: 'lane-1',
    executionAgentId: 'exec-agent-1',
    evaluationAgentId: null,
    configuredEvaluationAgentId: 'manager-agent',
    phase: 'executing',
    attempt: 1,
    startedAt: 1000,
    ...overrides,
  };
}

async function seedStorage(api: PluginAPI, data: {
  boards?: Board[];
  cards?: { board: Board; cards: Card[] }[];
  runs?: AutomationRun[];
  history?: RunHistoryEntry[];
}): Promise<void> {
  const storage = api.storage.projectLocal;
  if (data.boards) {
    await storage.write(BOARDS_KEY, data.boards);
  }
  if (data.cards) {
    for (const { board, cards } of data.cards) {
      const stor = board.config.gitHistory ? api.storage.project : api.storage.projectLocal;
      await stor.write(cardsKey(board.id), cards);
    }
  }
  if (data.runs) {
    await storage.write(AUTOMATION_RUNS_KEY, data.runs);
  }
  if (data.history) {
    await storage.write(RUN_HISTORY_KEY, data.history);
  }
}

async function readRuns(api: PluginAPI): Promise<AutomationRun[]> {
  const raw = await api.storage.projectLocal.read(AUTOMATION_RUNS_KEY);
  return Array.isArray(raw) ? raw : [];
}

async function readCards(api: PluginAPI, board: Board): Promise<Card[]> {
  const stor = board.config.gitHistory ? api.storage.project : api.storage.projectLocal;
  const raw = await stor.read(cardsKey(board.id));
  return Array.isArray(raw) ? raw : [];
}

async function readHistory(api: PluginAPI): Promise<RunHistoryEntry[]> {
  const raw = await api.storage.projectLocal.read(RUN_HISTORY_KEY);
  return Array.isArray(raw) ? raw : [];
}

// ── Tests ──────────────────────────────────────────────────────────────

/**
 * The mock API from plugin-testing uses lightweight mock fns.
 * Wrap agent methods we need to spy on with vi.fn() so vitest
 * matchers like toHaveBeenCalled() work.
 */
function wrapAgentSpies(api: PluginAPI): void {
  const origRunQuick = api.agents.runQuick;
  api.agents.runQuick = vi.fn((...args: Parameters<typeof origRunQuick>) =>
    origRunQuick(...args));

  const origOnStatusChange = api.agents.onStatusChange;
  api.agents.onStatusChange = vi.fn((...args: Parameters<typeof origOnStatusChange>) =>
    origOnStatusChange(...args));

  const origListCompleted = api.agents.listCompleted;
  api.agents.listCompleted = vi.fn((...args: Parameters<typeof origListCompleted>) =>
    origListCompleted(...args));

  api.logging.warn = vi.fn();
  api.logging.error = vi.fn();
}

describe('AutomationEngine', () => {
  let api: PluginAPI;

  beforeEach(() => {
    _resetMutexes();
    kanBossState.reset();
    api = createMockAPI();
    wrapAgentSpies(api);
    shutdownAutomationEngine();
  });

  // ── resolveExecutionAgent ────────────────────────────────────────────

  describe('resolveExecutionAgent', () => {
    it('returns state executionAgentId when set', () => {
      const state = makeBoard().states[1];
      state.executionAgentId = 'state-exec';
      const swimlane = makeBoard().swimlanes[0];
      expect(resolveExecutionAgent(state, swimlane)).toBe('state-exec');
    });

    it('falls back to swimlane managerAgentId', () => {
      const state = makeBoard().states[1];
      const swimlane = makeBoard().swimlanes[0];
      expect(resolveExecutionAgent(state, swimlane)).toBe('manager-agent');
    });

    it('returns null when no agent is assigned', () => {
      const state = makeBoard().states[1];
      const swimlane = { ...makeBoard().swimlanes[0], managerAgentId: null };
      expect(resolveExecutionAgent(state, swimlane)).toBeNull();
    });
  });

  // ── resolveEvaluationAgent ───────────────────────────────────────────

  describe('resolveEvaluationAgent', () => {
    it('returns state evaluationAgentId when set', () => {
      const state = { ...makeBoard().states[1], evaluationAgentId: 'state-eval' };
      const swimlane = makeBoard().swimlanes[0];
      expect(resolveEvaluationAgent(state, swimlane)).toBe('state-eval');
    });

    it('falls back to swimlane evaluationAgentId', () => {
      const state = makeBoard().states[1];
      const swimlane = { ...makeBoard().swimlanes[0], evaluationAgentId: 'lane-eval' };
      expect(resolveEvaluationAgent(state, swimlane)).toBe('lane-eval');
    });

    it('falls back to swimlane managerAgentId', () => {
      const state = makeBoard().states[1];
      const swimlane = makeBoard().swimlanes[0];
      expect(resolveEvaluationAgent(state, swimlane)).toBe('manager-agent');
    });

    it('returns null when no agent is assigned', () => {
      const state = makeBoard().states[1];
      const swimlane = { ...makeBoard().swimlanes[0], managerAgentId: null };
      expect(resolveEvaluationAgent(state, swimlane)).toBeNull();
    });
  });

  // ── triggerAutomation ────────────────────────────────────────────────

  describe('triggerAutomation', () => {
    it('spawns agent and records run for automatic state', async () => {
      const board = makeBoard();
      const card = makeCard();
      (api.agents.runQuick as Mock).mockResolvedValue('spawned-agent');

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
      });

      await triggerAutomation(api, card, board);

      // Agent was spawned
      expect(api.agents.runQuick).toHaveBeenCalledOnce();
      const prompt = (api.agents.runQuick as Mock).mock.calls[0][0];
      expect(prompt).toContain('Implement the feature');
      expect(prompt).toContain('Test Card');

      // Run was recorded
      const runs = await readRuns(api);
      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({
        cardId: 'card-1',
        boardId: 'board-1',
        executionAgentId: 'spawned-agent',
        phase: 'executing',
        attempt: 1,
      });

      // Card was updated
      const cards = await readCards(api, board);
      expect(cards[0].automationAttempts).toBe(1);
      expect(cards[0].history).toHaveLength(1);
      expect(cards[0].history[0].action).toBe('automation-started');
    });

    it('does nothing for non-automatic state', async () => {
      const board = makeBoard();
      const card = makeCard({ stateId: 'state-todo' });

      await triggerAutomation(api, card, board);

      expect(api.agents.runQuick).not.toHaveBeenCalled();
    });

    it('does nothing when swimlane is missing', async () => {
      const board = makeBoard();
      const card = makeCard({ swimlaneId: 'nonexistent' });

      await triggerAutomation(api, card, board);

      expect(api.agents.runQuick).not.toHaveBeenCalled();
    });

    it('does nothing when no execution agent is assigned', async () => {
      const board = makeBoard({
        swimlanes: [{
          id: 'lane-1', name: 'Default', order: 0,
          managerAgentId: null, evaluationAgentId: null,
        }],
      });
      const card = makeCard();

      await triggerAutomation(api, card, board);

      expect(api.agents.runQuick).not.toHaveBeenCalled();
    });

    it('does nothing when maxRetries exceeded', async () => {
      const board = makeBoard();
      const card = makeCard({ automationAttempts: 3 });

      await triggerAutomation(api, card, board);

      expect(api.agents.runQuick).not.toHaveBeenCalled();
    });

    it('logs warning when agent spawn fails', async () => {
      const board = makeBoard();
      const card = makeCard();
      (api.agents.runQuick as Mock).mockRejectedValue(new Error('spawn failed'));

      await seedStorage(api, {
        cards: [{ board, cards: [card] }],
      });

      await triggerAutomation(api, card, board);

      expect(api.logging.warn).toHaveBeenCalledWith(
        'KanBoss: Failed to spawn execution agent',
        expect.objectContaining({ cardId: 'card-1' }),
      );

      // No run should be recorded
      const runs = await readRuns(api);
      expect(runs).toHaveLength(0);
    });

    it('uses project storage when gitHistory is enabled', async () => {
      const board = makeBoard({ config: { maxRetries: 3, zoomLevel: 1, gitHistory: true } });
      const card = makeCard();
      (api.agents.runQuick as Mock).mockResolvedValue('spawned-agent');

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
      });

      await triggerAutomation(api, card, board);

      // Card should be stored in project storage (not projectLocal)
      const projectCards = await api.storage.project.read(cardsKey('board-1'));
      expect(Array.isArray(projectCards) ? projectCards : []).toHaveLength(1);
    });
  });

  // ── initAutomationEngine / shutdownAutomationEngine ──────────────────

  describe('initAutomationEngine', () => {
    it('subscribes to agent status changes', () => {
      const sub = initAutomationEngine(api);
      expect(api.agents.onStatusChange).toHaveBeenCalledOnce();
      expect(sub).toBeDefined();
    });

    it('fires onAgentCompleted on running→sleeping transition', async () => {
      const board = makeBoard();
      const card = makeCard();
      const run = makeRun();

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      // Capture the status change callback
      let statusCallback: (agentId: string, status: string, prevStatus: string) => void = () => {};
      (api.agents.onStatusChange as Mock).mockImplementation((cb) => {
        statusCallback = cb;
        return () => {};
      });

      // Mock listCompleted for eval phase
      (api.agents.listCompleted as Mock).mockReturnValue([
        { id: 'exec-agent-1', summary: 'Did the work', filesModified: ['file.ts'] },
      ]);
      (api.agents.runQuick as Mock).mockResolvedValue('eval-agent-1');

      initAutomationEngine(api);

      // Trigger completion
      statusCallback('exec-agent-1', 'sleeping', 'running');

      // Give the async handler time to complete
      await vi.waitFor(async () => {
        const runs = await readRuns(api);
        expect(runs).toHaveLength(1);
        expect(runs[0].phase).toBe('evaluating');
      });
    });

    it('ignores non-completion transitions', async () => {
      let statusCallback: (agentId: string, status: string, prevStatus: string) => void = () => {};
      (api.agents.onStatusChange as Mock).mockImplementation((cb) => {
        statusCallback = cb;
        return () => {};
      });

      initAutomationEngine(api);

      // These should not trigger onAgentCompleted
      statusCallback('agent-1', 'running', 'creating');
      statusCallback('agent-1', 'sleeping', 'creating');

      // No runs to find, so nothing should change
      const runs = await readRuns(api);
      expect(runs).toHaveLength(0);
    });

    it('does nothing after shutdown', async () => {
      let statusCallback: (agentId: string, status: string, prevStatus: string) => void = () => {};
      (api.agents.onStatusChange as Mock).mockImplementation((cb) => {
        statusCallback = cb;
        return () => {};
      });

      initAutomationEngine(api);
      shutdownAutomationEngine();

      // Firing the callback should be a no-op since engineApi is null
      statusCallback('agent-1', 'sleeping', 'running');

      const runs = await readRuns(api);
      expect(runs).toHaveLength(0);
    });
  });

  // ── onAgentCompleted (via initAutomationEngine) ──────────────────────

  describe('onAgentCompleted — execution phase', () => {
    let statusCallback: (agentId: string, status: string, prevStatus: string) => void;

    beforeEach(() => {
      statusCallback = () => {};
      (api.agents.onStatusChange as Mock).mockImplementation((cb) => {
        statusCallback = cb;
        return () => {};
      });
    });

    it('spawns evaluation agent on successful execution', async () => {
      const board = makeBoard();
      const card = makeCard();
      const run = makeRun();

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      (api.agents.listCompleted as Mock).mockReturnValue([
        { id: 'exec-agent-1', summary: 'Work done', filesModified: ['a.ts'] },
      ]);
      (api.agents.runQuick as Mock).mockResolvedValue('eval-agent-1');

      initAutomationEngine(api);
      statusCallback('exec-agent-1', 'sleeping', 'running');

      await vi.waitFor(async () => {
        const runs = await readRuns(api);
        expect(runs).toHaveLength(1);
        expect(runs[0].phase).toBe('evaluating');
        expect(runs[0].evaluationAgentId).toBe('eval-agent-1');
      });

      // Eval prompt includes the execution agent's summary
      const evalPrompt = (api.agents.runQuick as Mock).mock.calls[0][0];
      expect(evalPrompt).toContain('Work done');
      expect(evalPrompt).toContain('a.ts');
    });

    it('uses automationPrompt as fallback when evaluationPrompt is empty', async () => {
      const board = makeBoard();
      board.states[1].evaluationPrompt = '';
      const card = makeCard();
      const run = makeRun();

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      (api.agents.listCompleted as Mock).mockReturnValue([]);
      (api.agents.runQuick as Mock).mockResolvedValue('eval-agent-1');

      initAutomationEngine(api);
      statusCallback('exec-agent-1', 'sleeping', 'running');

      await vi.waitFor(async () => {
        const runs = await readRuns(api);
        expect(runs[0]?.phase).toBe('evaluating');
      });

      const evalPrompt = (api.agents.runQuick as Mock).mock.calls[0][0];
      expect(evalPrompt).toContain('Implement the feature');
    });

    it('cleans up run and marks card failed on execution error', async () => {
      const board = makeBoard();
      const card = makeCard({ automationAttempts: 1 });
      const run = makeRun({ attempt: 1 });

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      initAutomationEngine(api);
      statusCallback('exec-agent-1', 'error', 'running');

      await vi.waitFor(async () => {
        const runs = await readRuns(api);
        expect(runs).toHaveLength(0);
      });

      const cards = await readCards(api, board);
      const failedHistory = cards[0].history.find((h) => h.action === 'automation-failed');
      expect(failedHistory).toBeDefined();
      expect(failedHistory!.detail).toBe('Execution agent errored');

      // Run history should have an entry
      const history = await readHistory(api);
      expect(history).toHaveLength(1);
      expect(history[0].outcome).toBe('failed');
    });

    it('marks card stuck when maxRetries exceeded on execution error', async () => {
      const board = makeBoard({ config: { maxRetries: 2, zoomLevel: 1, gitHistory: false } });
      const card = makeCard({ automationAttempts: 2 });
      const run = makeRun({ attempt: 2 });

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      initAutomationEngine(api);
      statusCallback('exec-agent-1', 'error', 'running');

      await vi.waitFor(async () => {
        const runs = await readRuns(api);
        expect(runs).toHaveLength(0);
      });

      const cards = await readCards(api, board);
      const stuckHistory = cards[0].history.find((h) => h.action === 'automation-stuck');
      expect(stuckHistory).toBeDefined();

      const history = await readHistory(api);
      expect(history[0].outcome).toBe('stuck');
    });

    it('handles eval agent spawn failure gracefully', async () => {
      const board = makeBoard();
      const card = makeCard();
      const run = makeRun();

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      (api.agents.listCompleted as Mock).mockReturnValue([]);
      (api.agents.runQuick as Mock).mockRejectedValue(new Error('spawn failed'));

      initAutomationEngine(api);
      statusCallback('exec-agent-1', 'sleeping', 'running');

      await vi.waitFor(async () => {
        const runs = await readRuns(api);
        expect(runs).toHaveLength(0);
      });

      const cards = await readCards(api, board);
      const failedHistory = cards[0].history.find((h) => h.action === 'automation-failed');
      expect(failedHistory).toBeDefined();
      expect(failedHistory!.detail).toBe('Failed to spawn evaluation agent');
    });

    it('ignores unrecognized agent IDs', async () => {
      const board = makeBoard();
      const card = makeCard();
      const run = makeRun();

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      initAutomationEngine(api);
      statusCallback('unknown-agent', 'sleeping', 'running');

      // Wait a tick then verify nothing changed
      await new Promise((r) => setTimeout(r, 50));

      const runs = await readRuns(api);
      expect(runs).toHaveLength(1);
      expect(runs[0].phase).toBe('executing');
    });
  });

  // ── onAgentCompleted — evaluation phase ──────────────────────────────

  describe('onAgentCompleted — evaluation phase', () => {
    let statusCallback: (agentId: string, status: string, prevStatus: string) => void;

    beforeEach(() => {
      statusCallback = () => {};
      (api.agents.onStatusChange as Mock).mockImplementation((cb) => {
        statusCallback = cb;
        return () => {};
      });
    });

    it('advances card to next state on PASS', async () => {
      const board = makeBoard();
      const card = makeCard({ automationAttempts: 1 });
      const run = makeRun({
        phase: 'evaluating',
        evaluationAgentId: 'eval-agent-1',
      });

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      (api.agents.listCompleted as Mock).mockReturnValue([
        { id: 'eval-agent-1', summary: 'RESULT: PASS — looks good' },
        { id: 'exec-agent-1', summary: 'Implemented feature', filesModified: ['src/main.ts'] },
      ]);

      initAutomationEngine(api);
      statusCallback('eval-agent-1', 'sleeping', 'running');

      await vi.waitFor(async () => {
        const cards = await readCards(api, board);
        expect(cards[0].stateId).toBe('state-done');
      });

      const cards = await readCards(api, board);
      expect(cards[0].automationAttempts).toBe(0);
      expect(cards[0].history.some((h) => h.action === 'automation-succeeded')).toBe(true);
      expect(cards[0].history.some((h) => h.action === 'moved')).toBe(true);

      // Run should be removed
      const runs = await readRuns(api);
      expect(runs).toHaveLength(0);

      // Run history entry should exist
      const history = await readHistory(api);
      expect(history).toHaveLength(1);
      expect(history[0].outcome).toBe('passed');
    });

    it('retries on FAIL when retries remain', async () => {
      const board = makeBoard();
      const card = makeCard({ automationAttempts: 1 });
      const run = makeRun({
        phase: 'evaluating',
        evaluationAgentId: 'eval-agent-1',
      });

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      (api.agents.listCompleted as Mock).mockReturnValue([
        { id: 'eval-agent-1', summary: 'RESULT: FAIL — not complete' },
      ]);
      // The retry will call runQuick again
      (api.agents.runQuick as Mock).mockResolvedValue('retry-agent');

      initAutomationEngine(api);
      statusCallback('eval-agent-1', 'sleeping', 'running');

      await vi.waitFor(async () => {
        // The retry should have spawned a new agent
        expect(api.agents.runQuick).toHaveBeenCalled();
      });

      const cards = await readCards(api, board);
      const failedHistory = cards[0].history.find((h) => h.action === 'automation-failed');
      expect(failedHistory).toBeDefined();
      expect(failedHistory!.detail).toContain('not complete');
    });

    it('marks stuck and does not retry when maxRetries exceeded', async () => {
      const board = makeBoard({ config: { maxRetries: 1, zoomLevel: 1, gitHistory: false } });
      const card = makeCard({ automationAttempts: 1 });
      const run = makeRun({
        phase: 'evaluating',
        evaluationAgentId: 'eval-agent-1',
        attempt: 1,
      });

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      (api.agents.listCompleted as Mock).mockReturnValue([
        { id: 'eval-agent-1', summary: 'RESULT: FAIL — broken' },
      ]);

      initAutomationEngine(api);
      statusCallback('eval-agent-1', 'sleeping', 'running');

      await vi.waitFor(async () => {
        const runs = await readRuns(api);
        expect(runs).toHaveLength(0);
      });

      const cards = await readCards(api, board);
      const stuckHistory = cards[0].history.find((h) => h.action === 'automation-stuck');
      expect(stuckHistory).toBeDefined();

      // Should NOT retry
      expect(api.agents.runQuick).not.toHaveBeenCalled();

      const history = await readHistory(api);
      expect(history[0].outcome).toBe('stuck');
    });

    it('handles card at final state gracefully', async () => {
      const board = makeBoard();
      // Card is already at the last state (state-done, order 2)
      const card = makeCard({ stateId: 'state-done', automationAttempts: 1 });
      // Make state-done automatic for this test
      board.states[2].isAutomatic = true;
      board.states[2].automationPrompt = 'Final check';
      const run = makeRun({
        stateId: 'state-done',
        phase: 'evaluating',
        evaluationAgentId: 'eval-agent-1',
      });

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      (api.agents.listCompleted as Mock).mockReturnValue([
        { id: 'eval-agent-1', summary: 'RESULT: PASS — all good' },
      ]);

      initAutomationEngine(api);
      statusCallback('eval-agent-1', 'sleeping', 'running');

      await vi.waitFor(async () => {
        const runs = await readRuns(api);
        expect(runs).toHaveLength(0);
      });

      const cards = await readCards(api, board);
      // Card should stay at final state
      expect(cards[0].stateId).toBe('state-done');
      const successHistory = cards[0].history.find((h) => h.action === 'automation-succeeded');
      expect(successHistory).toBeDefined();
      expect(successHistory!.detail).toContain('already at final state');
    });

    it('triggers chained automation when next state is automatic', async () => {
      // Create a board where the next state is also automatic
      const board = makeBoard();
      board.states[2] = {
        ...board.states[2],
        isAutomatic: true,
        automationPrompt: 'Review the implementation',
      };

      const card = makeCard({ automationAttempts: 1 });
      const run = makeRun({
        phase: 'evaluating',
        evaluationAgentId: 'eval-agent-1',
      });

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      (api.agents.listCompleted as Mock).mockReturnValue([
        { id: 'eval-agent-1', summary: 'RESULT: PASS' },
      ]);

      let runQuickCallCount = 0;
      (api.agents.runQuick as Mock).mockImplementation(async () => {
        runQuickCallCount++;
        return `chained-agent-${runQuickCallCount}`;
      });

      initAutomationEngine(api);
      statusCallback('eval-agent-1', 'sleeping', 'running');

      await vi.waitFor(async () => {
        // The chained automation should have spawned a new agent
        expect(runQuickCallCount).toBeGreaterThanOrEqual(1);
      });

      // Card should have been moved to state-done, then chained automation triggered
      const cards = await readCards(api, board);
      expect(cards[0].stateId).toBe('state-done');
    });
  });

  // ── Concurrent completions ───────────────────────────────────────────

  describe('concurrent completions', () => {
    it('handles two agents completing simultaneously without corruption', async () => {
      const board = makeBoard();
      const card1 = makeCard({ id: 'card-1' });
      const card2 = makeCard({ id: 'card-2' });
      const run1 = makeRun({ cardId: 'card-1', executionAgentId: 'exec-1' });
      const run2 = makeRun({ cardId: 'card-2', executionAgentId: 'exec-2' });

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card1, card2] }],
        runs: [run1, run2],
      });

      let statusCallback: (agentId: string, status: string, prevStatus: string) => void = () => {};
      (api.agents.onStatusChange as Mock).mockImplementation((cb) => {
        statusCallback = cb;
        return () => {};
      });

      (api.agents.listCompleted as Mock).mockReturnValue([]);
      let agentCounter = 0;
      (api.agents.runQuick as Mock).mockImplementation(async () => `eval-${++agentCounter}`);

      initAutomationEngine(api);

      // Fire both completions in rapid succession
      statusCallback('exec-1', 'sleeping', 'running');
      statusCallback('exec-2', 'sleeping', 'running');

      // Wait for both to process
      await vi.waitFor(async () => {
        const runs = await readRuns(api);
        // Both should transition to evaluating
        const evaluating = runs.filter((r) => r.phase === 'evaluating');
        expect(evaluating).toHaveLength(2);
      });

      // Both runs should have distinct evaluation agents
      const runs = await readRuns(api);
      const evalAgents = runs.map((r) => r.evaluationAgentId);
      expect(new Set(evalAgents).size).toBe(2);
    });
  });

  // ── checkStuck ───────────────────────────────────────────────────────

  describe('checkStuck (via execution error)', () => {
    it('does not add stuck history when below maxRetries', async () => {
      const board = makeBoard({ config: { maxRetries: 3, zoomLevel: 1, gitHistory: false } });
      const card = makeCard({ automationAttempts: 1 });
      const run = makeRun();

      await seedStorage(api, {
        boards: [board],
        cards: [{ board, cards: [card] }],
        runs: [run],
      });

      let statusCallback: (agentId: string, status: string, prevStatus: string) => void = () => {};
      (api.agents.onStatusChange as Mock).mockImplementation((cb) => {
        statusCallback = cb;
        return () => {};
      });

      initAutomationEngine(api);
      statusCallback('exec-agent-1', 'error', 'running');

      await vi.waitFor(async () => {
        const runs = await readRuns(api);
        expect(runs).toHaveLength(0);
      });

      const cards = await readCards(api, board);
      const stuckHistory = cards[0].history.find((h) => h.action === 'automation-stuck');
      expect(stuckHistory).toBeUndefined();
    });
  });
});
