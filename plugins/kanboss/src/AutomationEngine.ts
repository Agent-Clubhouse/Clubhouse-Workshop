import type { PluginAPI, Disposable } from '@clubhouse/plugin-types';
import type { Card, Board, AutomationRun } from './types';
import { BOARDS_KEY, cardsKey, AUTOMATION_RUNS_KEY } from './types';
import { kanBossState } from './state';
import { mutateStorage } from './storageQueue';

// ── Module-level engine state ───────────────────────────────────────────

let engineApi: PluginAPI | null = null;

// ── Helpers ─────────────────────────────────────────────────────────────

async function loadBoard(api: PluginAPI, boardId: string): Promise<Board | null> {
  const raw = await api.storage.projectLocal.read(BOARDS_KEY);
  const boards: Board[] = Array.isArray(raw) ? raw : [];
  return boards.find((b) => b.id === boardId) ?? null;
}

function cardsStor(api: PluginAPI, board: Board) {
  return board.config.gitHistory ? api.storage.project : api.storage.projectLocal;
}

async function loadCards(api: PluginAPI, board: Board): Promise<Card[]> {
  const raw = await cardsStor(api, board).read(cardsKey(board.id));
  return Array.isArray(raw) ? raw : [];
}

async function saveCards(api: PluginAPI, board: Board, cards: Card[]): Promise<void> {
  await cardsStor(api, board).write(cardsKey(board.id), cards);
}

async function loadRuns(api: PluginAPI): Promise<AutomationRun[]> {
  const raw = await api.storage.projectLocal.read(AUTOMATION_RUNS_KEY);
  return Array.isArray(raw) ? raw : [];
}

async function saveRuns(api: PluginAPI, runs: AutomationRun[]): Promise<void> {
  await api.storage.projectLocal.write(AUTOMATION_RUNS_KEY, runs);
}

function addHistory(card: Card, action: Card['history'][0]['action'], detail: string, agentId?: string): void {
  card.history.push({ action, timestamp: Date.now(), detail, agentId });
  card.updatedAt = Date.now();
}

// ── Trigger automation for a card ───────────────────────────────────────

export async function triggerAutomation(api: PluginAPI, card: Card, board: Board): Promise<void> {
  const state = board.states.find((s) => s.id === card.stateId);
  if (!state || !state.isAutomatic) return;

  const swimlane = board.swimlanes.find((l) => l.id === card.swimlaneId);
  if (!swimlane || !swimlane.managerAgentId) return;

  if (card.automationAttempts >= board.config.maxRetries) {
    return;
  }

  const prompt = [
    'You are working on a Kanban card task. Complete the following outcome:',
    '',
    `OUTCOME: ${state.automationPrompt}`,
    '',
    `CARD TITLE: ${card.title}`,
    `CARD DESCRIPTION: ${card.body}`,
    '',
    'Complete the work needed to satisfy the outcome above. Focus only on completing the task.',
    'When done, provide a summary of what you accomplished.',
  ].join('\n');

  try {
    const executionAgentId = await api.agents.runQuick(prompt);

    // Record run
    const configuredEvalAgent = swimlane.evaluationAgentId ?? swimlane.managerAgentId;
    await mutateStorage<AutomationRun>(api.storage.projectLocal, AUTOMATION_RUNS_KEY, (runs) => {
      runs.push({
        cardId: card.id,
        boardId: board.id,
        stateId: card.stateId,
        swimlaneId: card.swimlaneId,
        executionAgentId,
        evaluationAgentId: null,
        configuredEvaluationAgentId: configuredEvalAgent,
        phase: 'executing',
        attempt: card.automationAttempts + 1,
        startedAt: Date.now(),
      });
      return runs;
    });

    // Update card
    await mutateStorage<Card>(cardsStor(api, board), cardsKey(board.id), (cards) => {
      const idx = cards.findIndex((c) => c.id === card.id);
      if (idx !== -1) {
        cards[idx].automationAttempts++;
        addHistory(cards[idx], 'automation-started',
          `Automation attempt ${cards[idx].automationAttempts} started`, executionAgentId);
      }
      return cards;
    });

    kanBossState.triggerRefresh();
  } catch {
    api.logging.warn('KanBoss: Failed to spawn execution agent', { cardId: card.id });
  }
}

// ── Handle agent completion ─────────────────────────────────────────────

async function onAgentCompleted(api: PluginAPI, agentId: string, outcome: 'success' | 'error'): Promise<void> {
  // Read-only lookup to find the matching run and decide what to do.
  const allRuns = await loadRuns(api);
  const run = allRuns.find((r) =>
    (r.executionAgentId === agentId && r.phase === 'executing') ||
    (r.evaluationAgentId === agentId && r.phase === 'evaluating')
  );
  if (!run) return;

  const board = await loadBoard(api, run.boardId);
  if (!board) return;

  // Read-only snapshot of the card for building prompts.
  const cardSnapshot = (await loadCards(api, board)).find((c) => c.id === run.cardId);
  if (!cardSnapshot) return;

  const stor = cardsStor(api, board);
  const key = cardsKey(board.id);

  if (run.phase === 'executing') {
    if (outcome === 'error') {
      await mutateStorage<AutomationRun>(api.storage.projectLocal, AUTOMATION_RUNS_KEY, (runs) =>
        runs.filter((r) => r.executionAgentId !== agentId || r.phase !== 'executing'));
      await mutateStorage<Card>(stor, key, (cards) => {
        const idx = cards.findIndex((c) => c.id === run.cardId);
        if (idx !== -1) {
          addHistory(cards[idx], 'automation-failed', 'Execution agent errored', agentId);
          checkStuck(cards[idx], board);
        }
        return cards;
      });
      kanBossState.triggerRefresh();
      return;
    }

    // Execution succeeded — spawn evaluation agent
    const completed = api.agents.listCompleted();
    const info = completed.find((c) => c.id === agentId);

    const state = board.states.find((s) => s.id === run.stateId);
    if (!state) return;

    const evalCriteria = state.evaluationPrompt?.trim()
      ? state.evaluationPrompt
      : state.automationPrompt;

    const evalPrompt = [
      'Evaluate whether this outcome has been met:',
      '',
      `OUTCOME: ${evalCriteria}`,
      '',
      `CARD: ${cardSnapshot.title} — ${cardSnapshot.body}`,
      '',
      `AGENT SUMMARY: ${info?.summary ?? 'No summary available'}`,
      `FILES MODIFIED: ${info?.filesModified?.join(', ') ?? 'None'}`,
      '',
      'Respond with EXACTLY one of:',
      'RESULT: PASS',
      'RESULT: FAIL',
      '',
      'Followed by a brief explanation.',
    ].join('\n');

    try {
      const evalAgentId = await api.agents.runQuick(evalPrompt);
      await mutateStorage<AutomationRun>(api.storage.projectLocal, AUTOMATION_RUNS_KEY, (runs) =>
        runs.map((r) =>
          r.executionAgentId === agentId && r.phase === 'executing'
            ? { ...r, evaluationAgentId: evalAgentId, phase: 'evaluating' as const }
            : r
        ));
    } catch {
      await mutateStorage<AutomationRun>(api.storage.projectLocal, AUTOMATION_RUNS_KEY, (runs) =>
        runs.filter((r) => r.executionAgentId !== agentId || r.phase !== 'executing'));
      await mutateStorage<Card>(stor, key, (cards) => {
        const idx = cards.findIndex((c) => c.id === run.cardId);
        if (idx !== -1) {
          addHistory(cards[idx], 'automation-failed', 'Failed to spawn evaluation agent', agentId);
          checkStuck(cards[idx], board);
        }
        return cards;
      });
      kanBossState.triggerRefresh();
    }
    return;
  }

  // Phase: evaluating
  if (run.phase === 'evaluating') {
    const completed = api.agents.listCompleted();
    const info = completed.find((c) => c.id === agentId);

    const summary = info?.summary ?? '';
    const passed = summary.includes('RESULT: PASS');

    await mutateStorage<AutomationRun>(api.storage.projectLocal, AUTOMATION_RUNS_KEY, (runs) =>
      runs.filter((r) => r.evaluationAgentId !== agentId || r.phase !== 'evaluating'));

    if (passed) {
      const currentState = board.states.find((s) => s.id === cardSnapshot.stateId);
      if (!currentState) return;

      const sortedStates = [...board.states].sort((a, b) => a.order - b.order);
      const nextStateIdx = sortedStates.findIndex((s) => s.id === currentState.id) + 1;

      if (nextStateIdx < sortedStates.length) {
        const nextState = sortedStates[nextStateIdx];
        const updatedCards = await mutateStorage<Card>(stor, key, (cards) => {
          const idx = cards.findIndex((c) => c.id === run.cardId);
          if (idx !== -1) {
            cards[idx].stateId = nextState.id;
            cards[idx].automationAttempts = 0;
            addHistory(cards[idx], 'automation-succeeded',
              `Automation passed — moved to "${nextState.name}"`, agentId);
            addHistory(cards[idx], 'moved', `Moved from "${currentState.name}" to "${nextState.name}"`);
          }
          return cards;
        });
        kanBossState.triggerRefresh();

        // If next state is also automatic, trigger recursively
        if (nextState.isAutomatic) {
          const freshCard = updatedCards.find((c) => c.id === run.cardId);
          if (freshCard) {
            await triggerAutomation(api, freshCard, board);
          }
        }
      } else {
        await mutateStorage<Card>(stor, key, (cards) => {
          const idx = cards.findIndex((c) => c.id === run.cardId);
          if (idx !== -1) {
            addHistory(cards[idx], 'automation-succeeded', 'Automation passed (already at final state)', agentId);
          }
          return cards;
        });
        kanBossState.triggerRefresh();
      }
    } else {
      const reason = summary.replace(/RESULT:\s*FAIL\s*/i, '').trim() || 'Evaluation failed';
      const updatedCards = await mutateStorage<Card>(stor, key, (cards) => {
        const idx = cards.findIndex((c) => c.id === run.cardId);
        if (idx !== -1) {
          addHistory(cards[idx], 'automation-failed', `Automation failed: ${reason}`, agentId);
          checkStuck(cards[idx], board);
        }
        return cards;
      });
      kanBossState.triggerRefresh();

      // Retry if not stuck
      const updatedCard = updatedCards.find((c) => c.id === run.cardId);
      if (updatedCard && updatedCard.automationAttempts < board.config.maxRetries) {
        await triggerAutomation(api, updatedCard, board);
      }
    }
  }
}

function checkStuck(card: Card, board: Board): void {
  if (card.automationAttempts >= board.config.maxRetries) {
    addHistory(card, 'automation-stuck',
      `Card stuck after ${card.automationAttempts} attempts (max: ${board.config.maxRetries})`);
  }
}

// ── Initialize / Shutdown ───────────────────────────────────────────────

export function initAutomationEngine(api: PluginAPI): Disposable {
  engineApi = api;

  const statusSub = api.agents.onStatusChange((agentId, status, prevStatus) => {
    if (!engineApi) return;

    const isCompleted =
      (prevStatus === 'running' && status === 'sleeping') ||
      (prevStatus === 'running' && status === 'error');

    if (!isCompleted) return;

    const outcome = status === 'sleeping' ? 'success' as const : 'error' as const;
    onAgentCompleted(engineApi, agentId, outcome);
  });

  return statusSub;
}

export function shutdownAutomationEngine(): void {
  engineApi = null;
}
