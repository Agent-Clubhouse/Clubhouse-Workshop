import { describe, it, expect, beforeEach } from 'vitest';
import { kanBossState, filtersEqual } from './state';

describe('kanBossState', () => {
  beforeEach(() => {
    kanBossState.reset();
  });

  it('starts with null selectedBoardId', () => {
    expect(kanBossState.selectedBoardId).toBeNull();
  });

  it('selectBoard sets id and closes dialogs', () => {
    kanBossState.editingCardId = 'some-card';
    kanBossState.configuringBoard = true;

    kanBossState.selectBoard('board-1');

    expect(kanBossState.selectedBoardId).toBe('board-1');
    expect(kanBossState.editingCardId).toBeNull();
    expect(kanBossState.configuringBoard).toBe(false);
  });

  it('setBoards updates boards array', () => {
    const boards = [{ id: 'b1', name: 'Test' } as any];
    kanBossState.setBoards(boards);
    expect(kanBossState.boards).toEqual(boards);
  });

  it('openNewCard sets editing state', () => {
    kanBossState.openNewCard('state-1', 'lane-1');
    expect(kanBossState.editingCardId).toBe('new');
    expect(kanBossState.editingStateId).toBe('state-1');
    expect(kanBossState.editingSwimlaneId).toBe('lane-1');
  });

  it('openEditCard sets editing card id', () => {
    kanBossState.openEditCard('card-123');
    expect(kanBossState.editingCardId).toBe('card-123');
    expect(kanBossState.editingStateId).toBeNull();
    expect(kanBossState.editingSwimlaneId).toBeNull();
  });

  it('closeCardDialog clears all editing state', () => {
    kanBossState.openNewCard('state-1', 'lane-1');
    kanBossState.closeCardDialog();

    expect(kanBossState.editingCardId).toBeNull();
    expect(kanBossState.editingStateId).toBeNull();
    expect(kanBossState.editingSwimlaneId).toBeNull();
  });

  it('openBoardConfig and closeBoardConfig toggle configuringBoard', () => {
    kanBossState.openBoardConfig();
    expect(kanBossState.configuringBoard).toBe(true);

    kanBossState.closeBoardConfig();
    expect(kanBossState.configuringBoard).toBe(false);
  });

  it('triggerRefresh increments refreshCount', () => {
    expect(kanBossState.refreshCount).toBe(0);
    kanBossState.triggerRefresh();
    expect(kanBossState.refreshCount).toBe(1);
    kanBossState.triggerRefresh();
    expect(kanBossState.refreshCount).toBe(2);
  });

  it('subscribe notifies listeners on changes', () => {
    let callCount = 0;
    kanBossState.subscribe(() => { callCount++; });

    kanBossState.triggerRefresh();
    expect(callCount).toBe(1);

    kanBossState.selectBoard('b1');
    expect(callCount).toBe(2);
  });

  it('unsubscribe stops notifications', () => {
    let callCount = 0;
    const unsub = kanBossState.subscribe(() => { callCount++; });

    kanBossState.triggerRefresh();
    expect(callCount).toBe(1);

    unsub();
    kanBossState.triggerRefresh();
    expect(callCount).toBe(1);
  });

  it('setFilter updates filter state', () => {
    kanBossState.setFilter({ searchQuery: 'test', stuckOnly: true });
    expect(kanBossState.filter.searchQuery).toBe('test');
    expect(kanBossState.filter.stuckOnly).toBe(true);
    expect(kanBossState.filter.priorityFilter).toBe('all');
  });

  it('clearFilter resets all filters', () => {
    kanBossState.setFilter({ searchQuery: 'test', stuckOnly: true, priorityFilter: 'high' });
    kanBossState.clearFilter();

    expect(kanBossState.filter.searchQuery).toBe('');
    expect(kanBossState.filter.stuckOnly).toBe(false);
    expect(kanBossState.filter.priorityFilter).toBe('all');
    expect(kanBossState.filter.labelFilter).toBe('all');
  });

  it('reset clears everything', () => {
    kanBossState.selectBoard('b1');
    kanBossState.triggerRefresh();
    kanBossState.setFilter({ searchQuery: 'hello' });

    kanBossState.reset();

    expect(kanBossState.selectedBoardId).toBeNull();
    expect(kanBossState.refreshCount).toBe(0);
    expect(kanBossState.filter.searchQuery).toBe('');
    expect(kanBossState.listeners.size).toBe(0);
  });

  it('setBoards skips notify when boards are unchanged', () => {
    const boards = [
      { id: 'b1', name: 'Board 1', updatedAt: 1000 },
      { id: 'b2', name: 'Board 2', updatedAt: 2000 },
    ] as any[];
    kanBossState.setBoards(boards);

    let callCount = 0;
    kanBossState.subscribe(() => { callCount++; });

    // Same boards again — should not notify
    kanBossState.setBoards([
      { id: 'b1', name: 'Board 1', updatedAt: 1000 },
      { id: 'b2', name: 'Board 2', updatedAt: 2000 },
    ] as any[]);
    expect(callCount).toBe(0);

    // Different boards — should notify
    kanBossState.setBoards([
      { id: 'b1', name: 'Board 1', updatedAt: 3000 },
      { id: 'b2', name: 'Board 2', updatedAt: 2000 },
    ] as any[]);
    expect(callCount).toBe(1);
  });

  it('setBoards notifies when board count changes', () => {
    kanBossState.setBoards([{ id: 'b1', updatedAt: 1000 }] as any[]);

    let callCount = 0;
    kanBossState.subscribe(() => { callCount++; });

    kanBossState.setBoards([
      { id: 'b1', updatedAt: 1000 },
      { id: 'b2', updatedAt: 2000 },
    ] as any[]);
    expect(callCount).toBe(1);
  });

  it('switchProject resets all state', () => {
    kanBossState.selectBoard('b1');
    kanBossState.setBoards([{ id: 'b1', updatedAt: 1 }] as any[]);
    kanBossState.triggerRefresh();
    const listener = () => {};
    kanBossState.subscribe(listener);

    kanBossState.switchProject();

    expect(kanBossState.selectedBoardId).toBeNull();
    expect(kanBossState.boards).toEqual([]);
    expect(kanBossState.refreshCount).toBe(0);
    expect(kanBossState.listeners.size).toBe(0);
  });

  it('single subscriber fires exactly once per notify', () => {
    let callCount = 0;
    kanBossState.subscribe(() => { callCount++; });

    kanBossState.selectBoard('b1');
    expect(callCount).toBe(1);

    kanBossState.triggerRefresh();
    expect(callCount).toBe(2);

    kanBossState.setFilter({ searchQuery: 'x' });
    expect(callCount).toBe(3);
  });

  it('multiple subscribers each fire exactly once per notify', () => {
    let count1 = 0;
    let count2 = 0;
    kanBossState.subscribe(() => { count1++; });
    kanBossState.subscribe(() => { count2++; });

    kanBossState.selectBoard('b1');
    expect(count1).toBe(1);
    expect(count2).toBe(1);

    kanBossState.triggerRefresh();
    expect(count1).toBe(2);
    expect(count2).toBe(2);
  });

  it('duplicate subscribe of same function does not double-fire', () => {
    let callCount = 0;
    const listener = () => { callCount++; };

    kanBossState.subscribe(listener);
    kanBossState.subscribe(listener);

    kanBossState.triggerRefresh();
    // Set stores unique listeners, so same reference only fires once
    expect(callCount).toBe(1);
  });

  it('selectedBoardId is immediately readable in subscriber (regression: stale ref bug)', () => {
    // The BoardView subscriber must be able to read the updated selectedBoardId
    // synchronously during notification. Previously, loadBoard read from a React
    // state ref that lagged behind, so the board never loaded.
    const observedIds: (string | null)[] = [];

    kanBossState.subscribe(() => {
      observedIds.push(kanBossState.selectedBoardId);
    });

    kanBossState.selectBoard('board-1');
    kanBossState.selectBoard('board-2');
    kanBossState.selectBoard(null);

    expect(observedIds).toEqual(['board-1', 'board-2', null]);
  });

  it('unsubscribing one listener does not affect others', () => {
    let count1 = 0;
    let count2 = 0;
    const unsub1 = kanBossState.subscribe(() => { count1++; });
    kanBossState.subscribe(() => { count2++; });

    kanBossState.triggerRefresh();
    expect(count1).toBe(1);
    expect(count2).toBe(1);

    unsub1();
    kanBossState.triggerRefresh();
    expect(count1).toBe(1); // no longer fires
    expect(count2).toBe(2); // still fires
  });
});

describe('filtersEqual', () => {
  const base = { searchQuery: '', priorityFilter: 'all' as const, labelFilter: 'all' as const, stuckOnly: false };

  it('returns true for identical filters', () => {
    expect(filtersEqual(base, { ...base })).toBe(true);
  });

  it('returns false when searchQuery differs', () => {
    expect(filtersEqual(base, { ...base, searchQuery: 'test' })).toBe(false);
  });

  it('returns false when priorityFilter differs', () => {
    expect(filtersEqual(base, { ...base, priorityFilter: 'high' })).toBe(false);
  });

  it('returns false when labelFilter differs', () => {
    expect(filtersEqual(base, { ...base, labelFilter: 'lbl-1' })).toBe(false);
  });

  it('returns false when stuckOnly differs', () => {
    expect(filtersEqual(base, { ...base, stuckOnly: true })).toBe(false);
  });
});
