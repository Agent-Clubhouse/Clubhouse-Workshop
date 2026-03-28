/**
 * Shared module-level state for the KanBoss plugin.
 *
 * SidebarPanel and MainPanel are rendered in separate React trees,
 * so we use a lightweight pub/sub to coordinate the selected board
 * and dialog visibility.
 */

import type { Board, Priority } from './types';

export interface FilterState {
  searchQuery: string;
  priorityFilter: Priority | 'all';
  labelFilter: string | 'all'; // label ID or 'all'
  stuckOnly: boolean;
}

export function filtersEqual(a: FilterState, b: FilterState): boolean {
  return (
    a.searchQuery === b.searchQuery &&
    a.priorityFilter === b.priorityFilter &&
    a.labelFilter === b.labelFilter &&
    a.stuckOnly === b.stuckOnly
  );
}

function boardsEqual(a: Board[], b: Board[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].updatedAt !== b[i].updatedAt) return false;
    if (JSON.stringify(a[i].config) !== JSON.stringify(b[i].config)) return false;
  }
  return true;
}

export const kanBossState = {
  selectedBoardId: null as string | null,
  boards: [] as Board[],
  refreshCount: 0,

  // Dialog state
  editingCardId: null as string | null,   // null=closed, 'new'=creating, cardId=editing
  editingStateId: null as string | null,  // target state for new card
  editingSwimlaneId: null as string | null, // target swimlane for new card
  configuringBoard: false,

  // Card selection state (multi-select)
  selectedCardIds: new Set<string>(),
  lastSelectedCardId: null as string | null, // for shift-click range selection

  // Keyboard shortcut signals (consumed by BoardView)
  pendingDeleteIds: [] as string[],
  selectAllRequested: false,

  // Filter state
  filter: {
    searchQuery: '',
    priorityFilter: 'all',
    labelFilter: 'all',
    stuckOnly: false,
  } as FilterState,

  listeners: new Set<() => void>(),

  selectBoard(id: string | null): void {
    this.selectedBoardId = id;
    this.editingCardId = null;
    this.configuringBoard = false;
    this.selectedCardIds.clear();
    this.notify();
  },

  setBoards(boards: Board[]): void {
    if (boardsEqual(this.boards, boards)) return;
    this.boards = boards;
    this.notify();
  },

  openNewCard(stateId: string, swimlaneId: string): void {
    this.editingCardId = 'new';
    this.editingStateId = stateId;
    this.editingSwimlaneId = swimlaneId;
    this.notify();
  },

  openEditCard(cardId: string): void {
    this.editingCardId = cardId;
    this.editingStateId = null;
    this.editingSwimlaneId = null;
    this.notify();
  },

  closeCardDialog(): void {
    this.editingCardId = null;
    this.editingStateId = null;
    this.editingSwimlaneId = null;
    this.notify();
  },

  openBoardConfig(): void {
    this.configuringBoard = true;
    this.notify();
  },

  closeBoardConfig(): void {
    this.configuringBoard = false;
    this.notify();
  },

  toggleCardSelection(cardId: string): void {
    if (this.selectedCardIds.has(cardId)) {
      this.selectedCardIds.delete(cardId);
    } else {
      this.selectedCardIds.add(cardId);
    }
    this.lastSelectedCardId = cardId;
    this.notify();
  },

  selectCardRange(cardId: string, orderedCardIds: string[]): void {
    const lastId = this.lastSelectedCardId;
    if (!lastId) {
      this.selectedCardIds.add(cardId);
      this.lastSelectedCardId = cardId;
      this.notify();
      return;
    }
    const startIdx = orderedCardIds.indexOf(lastId);
    const endIdx = orderedCardIds.indexOf(cardId);
    if (startIdx === -1 || endIdx === -1) {
      this.selectedCardIds.add(cardId);
      this.lastSelectedCardId = cardId;
      this.notify();
      return;
    }
    const lo = Math.min(startIdx, endIdx);
    const hi = Math.max(startIdx, endIdx);
    for (let i = lo; i <= hi; i++) {
      this.selectedCardIds.add(orderedCardIds[i]);
    }
    this.lastSelectedCardId = cardId;
    this.notify();
  },

  selectCard(cardId: string): void {
    this.selectedCardIds.clear();
    this.selectedCardIds.add(cardId);
    this.lastSelectedCardId = cardId;
    this.notify();
  },

  clearSelection(): void {
    if (this.selectedCardIds.size === 0) return;
    this.selectedCardIds.clear();
    this.lastSelectedCardId = null;
    this.notify();
  },

  setFilter(updates: Partial<FilterState>): void {
    this.filter = { ...this.filter, ...updates };
    this.notify();
  },

  clearFilter(): void {
    this.filter = { searchQuery: '', priorityFilter: 'all', labelFilter: 'all', stuckOnly: false };
    this.notify();
  },

  triggerRefresh(): void {
    this.refreshCount++;
    this.notify();
  },

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  },

  notify(): void {
    for (const fn of this.listeners) {
      fn();
    }
  },

  switchProject(): void {
    this.reset();
  },

  reset(): void {
    this.selectedBoardId = null;
    this.boards = [];
    this.refreshCount = 0;
    this.editingCardId = null;
    this.editingStateId = null;
    this.editingSwimlaneId = null;
    this.configuringBoard = false;
    this.selectedCardIds.clear();
    this.lastSelectedCardId = null;
    this.pendingDeleteIds = [];
    this.selectAllRequested = false;
    this.filter = { searchQuery: '', priorityFilter: 'all', labelFilter: 'all', stuckOnly: false };
    this.listeners.clear();
  },
};
