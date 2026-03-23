import type { Card, Board, Priority } from './types';
import { PRIORITY_CONFIG, isCardStuck } from './types';

// ── Stat types ──────────────────────────────────────────────────────────

export interface CardsPerState {
  stateId: string;
  stateName: string;
  count: number;
}

export interface PriorityBreakdown {
  priority: Priority;
  label: string;
  color: string;
  count: number;
}

export interface BoardStatsData {
  totalCards: number;
  cardsPerState: CardsPerState[];
  priorityBreakdown: PriorityBreakdown[];
  stuckCount: number;
  stuckRatio: number;
  automationSuccessRate: number; // 0-1, NaN if no automation history
  automationTotal: number;
  automationSuccesses: number;
}

// ── Pure computation ────────────────────────────────────────────────────

export function computeBoardStats(cards: Card[], board: Board): BoardStatsData {
  const sortedStates = [...board.states].sort((a, b) => a.order - b.order);

  const cardsPerState: CardsPerState[] = sortedStates.map((state) => ({
    stateId: state.id,
    stateName: state.name,
    count: cards.filter((c) => c.stateId === state.id).length,
  }));

  const priorities: Priority[] = ['critical', 'high', 'medium', 'low', 'none'];
  const priorityBreakdown: PriorityBreakdown[] = priorities.map((p) => ({
    priority: p,
    label: PRIORITY_CONFIG[p].label,
    color: PRIORITY_CONFIG[p].color,
    count: cards.filter((c) => c.priority === p).length,
  }));

  const stuckCount = cards.filter(isCardStuck).length;
  const totalCards = cards.length;
  const stuckRatio = totalCards > 0 ? stuckCount / totalCards : 0;

  let automationSuccesses = 0;
  let automationTotal = 0;
  for (const card of cards) {
    for (const entry of card.history) {
      if (entry.action === 'automation-succeeded') {
        automationSuccesses++;
        automationTotal++;
      } else if (entry.action === 'automation-failed') {
        automationTotal++;
      }
    }
  }
  const automationSuccessRate = automationTotal > 0 ? automationSuccesses / automationTotal : NaN;

  return {
    totalCards,
    cardsPerState,
    priorityBreakdown,
    stuckCount,
    stuckRatio,
    automationSuccessRate,
    automationTotal,
    automationSuccesses,
  };
}
