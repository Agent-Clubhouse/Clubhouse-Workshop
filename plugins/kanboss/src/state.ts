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

export const kanBossState = {
  selectedBoardId: null as string | null,
  boards: [] as Board[],
  refreshCount: 0,

  // Dialog state
  editingCardId: null as string | null,   // null=closed, 'new'=creating, cardId=editing
  editingStateId: null as string | null,  // target state for new card
  editingSwimlaneId: null as string | null, // target swimlane for new card
  configuringBoard: false,

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
    this.notify();
  },

  setBoards(boards: Board[]): void {
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

  reset(): void {
    this.selectedBoardId = null;
    this.boards = [];
    this.refreshCount = 0;
    this.editingCardId = null;
    this.editingStateId = null;
    this.editingSwimlaneId = null;
    this.configuringBoard = false;
    this.filter = { searchQuery: '', priorityFilter: 'all', labelFilter: 'all', stuckOnly: false };
    this.listeners.clear();
  },
};
