/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { createMockAPI } from '@clubhouse/plugin-testing';
import type { PluginAPI } from '@clubhouse/plugin-types';
import type { Board, Card } from './types';
import { BOARDS_KEY, cardsKey } from './types';
import { kanBossState } from './state';
import { _resetMutexes } from './storageQueue';
import { BoardView } from './BoardView';

// ── Test Helpers ───────────────────────────────────────────────────────

function makeBoard(overrides?: Partial<Board>): Board {
  return {
    id: 'board-1',
    name: 'Test Board',
    states: [
      {
        id: 'state-todo', name: 'To Do', order: 0,
        isAutomatic: false, automationPrompt: '', evaluationPrompt: '',
        wipLimit: 0, executionAgentId: null, evaluationAgentId: null,
      },
      {
        id: 'state-doing', name: 'In Progress', order: 1,
        isAutomatic: true, automationPrompt: 'Do the work', evaluationPrompt: '',
        wipLimit: 0, executionAgentId: null, evaluationAgentId: null,
      },
      {
        id: 'state-done', name: 'Done', order: 2,
        isAutomatic: false, automationPrompt: '', evaluationPrompt: '',
        wipLimit: 0, executionAgentId: null, evaluationAgentId: null,
      },
    ],
    swimlanes: [
      { id: 'lane-1', name: 'Default', order: 0, managerAgentId: null, evaluationAgentId: null },
    ],
    labels: [],
    config: { maxRetries: 3, zoomLevel: 1, gitHistory: false },
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
    body: 'Card description',
    priority: 'medium',
    labels: [],
    stateId: 'state-todo',
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

async function seedAndSelect(api: PluginAPI, board: Board, cards: Card[]): Promise<void> {
  await api.storage.projectLocal.write(BOARDS_KEY, [board]);
  await api.storage.projectLocal.write(cardsKey(board.id), cards);
  kanBossState.selectBoard(board.id);
  kanBossState.setBoards([board]);
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('BoardView', () => {
  let api: PluginAPI;

  beforeEach(() => {
    _resetMutexes();
    kanBossState.reset();
    api = createMockAPI();
  });

  afterEach(() => {
    cleanup();
  });

  // ── No board selected ────────────────────────────────────────────────

  describe('no board selected', () => {
    it('renders empty state message', () => {
      render(<BoardView api={api} />);
      expect(screen.getByText('Select a board to get started')).toBeTruthy();
    });
  });

  // ── Board loaded ─────────────────────────────────────────────────────

  describe('board loaded', () => {
    it('renders board name in toolbar', async () => {
      const board = makeBoard();
      await seedAndSelect(api, board, []);

      render(<BoardView api={api} />);

      // Board data is loaded asynchronously; wait for it
      const boardName = await screen.findByText('Test Board');
      expect(boardName).toBeTruthy();
    });

    it('renders state column headers', async () => {
      const board = makeBoard();
      await seedAndSelect(api, board, []);

      render(<BoardView api={api} />);

      expect(await screen.findByText('To Do')).toBeTruthy();
      expect(screen.getByText('In Progress')).toBeTruthy();
      expect(screen.getByText('Done')).toBeTruthy();
    });

    it('renders swimlane labels', async () => {
      const board = makeBoard();
      await seedAndSelect(api, board, []);

      render(<BoardView api={api} />);

      expect(await screen.findByText('Default')).toBeTruthy();
    });

    it('shows auto badge on automatic states', async () => {
      const board = makeBoard();
      await seedAndSelect(api, board, []);

      render(<BoardView api={api} />);

      // The "In Progress" state is automatic and should show "auto" badge
      await screen.findByText('Test Board');
      expect(screen.getByText(/auto/)).toBeTruthy();
    });

    it('renders cards in the board', async () => {
      const board = makeBoard();
      const cards = [
        makeCard({ id: 'c1', title: 'First Card', stateId: 'state-todo' }),
        makeCard({ id: 'c2', title: 'Second Card', stateId: 'state-doing' }),
      ];
      await seedAndSelect(api, board, cards);

      render(<BoardView api={api} />);

      expect(await screen.findByText('First Card')).toBeTruthy();
      expect(screen.getByText('Second Card')).toBeTruthy();
    });
  });

  // ── Empty board ──────────────────────────────────────────────────────

  describe('empty board', () => {
    it('renders with no cards without crashing', async () => {
      const board = makeBoard();
      await seedAndSelect(api, board, []);

      const { container } = render(<BoardView api={api} />);

      await screen.findByText('Test Board');
      // Board should render its grid even with no cards
      expect(container.querySelector('div')).toBeTruthy();
    });
  });

  // ── Multiple swimlanes ──────────────────────────────────────────────

  describe('multiple swimlanes', () => {
    it('renders all swimlane rows', async () => {
      const board = makeBoard({
        swimlanes: [
          { id: 'lane-1', name: 'Frontend', order: 0, managerAgentId: null, evaluationAgentId: null },
          { id: 'lane-2', name: 'Backend', order: 1, managerAgentId: null, evaluationAgentId: null },
        ],
      });
      await seedAndSelect(api, board, []);

      render(<BoardView api={api} />);

      expect(await screen.findByText('Frontend')).toBeTruthy();
      expect(screen.getByText('Backend')).toBeTruthy();
    });
  });
});
