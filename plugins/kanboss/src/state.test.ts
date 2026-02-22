import { describe, it, expect, beforeEach } from 'vitest';
import { kanBossState } from './state';

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
});
