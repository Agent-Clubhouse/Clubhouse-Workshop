import type { PluginAPI, Disposable } from '@clubhouse/plugin-types';
import { kanBossState } from './state';

// ── Shortcut definitions (exported for testing) ─────────────────────────

export interface ShortcutDef {
  id: string;
  title: string;
  binding: string;
  description: string;
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: 'new-card',        title: 'New Card',           binding: 'N',          description: 'Create a new card' },
  { id: 'delete-cards',    title: 'Delete Selected',    binding: 'Delete',     description: 'Delete selected cards' },
  { id: 'escape',          title: 'Escape',             binding: 'Escape',     description: 'Clear selection / close dialog' },
  { id: 'select-all',      title: 'Select All',         binding: 'Meta+A',     description: 'Select all visible cards' },
  { id: 'shortcuts-help',  title: 'Keyboard Shortcuts', binding: 'Shift+/',    description: 'Toggle shortcuts help' },
];

// ── State for help overlay ──────────────────────────────────────────────

let showHelp = false;
const helpListeners = new Set<() => void>();

export function getShowHelp(): boolean {
  return showHelp;
}

export function toggleHelp(): void {
  showHelp = !showHelp;
  for (const fn of helpListeners) fn();
}

export function subscribeHelp(fn: () => void): () => void {
  helpListeners.add(fn);
  return () => { helpListeners.delete(fn); };
}

// ── Register all shortcuts ──────────────────────────────────────────────

export function registerKeyboardShortcuts(api: PluginAPI): Disposable {
  const disposables: Disposable[] = [];

  // N — New card (only when a board is selected, opens in first state + first lane)
  disposables.push(
    api.commands.registerWithHotkey('kanboss.new-card', 'New Card', () => {
      if (!kanBossState.selectedBoardId) return;
      const board = kanBossState.boards.find((b) => b.id === kanBossState.selectedBoardId);
      if (!board || board.states.length === 0 || board.swimlanes.length === 0) return;

      // If a dialog is already open, don't override
      if (kanBossState.editingCardId !== null) return;

      const sortedStates = [...board.states].sort((a, b) => a.order - b.order);
      const sortedLanes = [...board.swimlanes].sort((a, b) => a.order - b.order);
      kanBossState.openNewCard(sortedStates[0].id, sortedLanes[0].id);
    }, 'N'),
  );

  // Delete / Backspace — Delete selected cards (handled via notifications)
  disposables.push(
    api.commands.registerWithHotkey('kanboss.delete-cards', 'Delete Selected Cards', async () => {
      const selected = kanBossState.selectedCardIds;
      if (selected.size === 0) return;

      const count = selected.size;
      const ok = await api.ui.showConfirm(`Delete ${count} selected card${count > 1 ? 's' : ''}? This cannot be undone.`);
      if (!ok) return;

      // Trigger a custom event — BoardView will handle the actual deletion
      kanBossState.pendingDeleteIds = [...selected];
      kanBossState.clearSelection();
      kanBossState.triggerRefresh();
    }, 'Delete'),
  );

  // Escape — Clear selection or close dialog
  disposables.push(
    api.commands.registerWithHotkey('kanboss.escape', 'Escape', () => {
      if (showHelp) {
        toggleHelp();
        return;
      }
      if (kanBossState.editingCardId !== null) {
        kanBossState.closeCardDialog();
        return;
      }
      if (kanBossState.configuringBoard) {
        kanBossState.closeBoardConfig();
        return;
      }
      if (kanBossState.selectedCardIds.size > 0) {
        kanBossState.clearSelection();
        return;
      }
    }, 'Escape', { global: true }),
  );

  // Ctrl/Meta+A — Select all visible cards
  disposables.push(
    api.commands.registerWithHotkey('kanboss.select-all', 'Select All Cards', () => {
      if (!kanBossState.selectedBoardId) return;
      if (kanBossState.editingCardId !== null || kanBossState.configuringBoard) return;

      // selectAll is handled by BoardView which has access to filtered cards
      kanBossState.selectAllRequested = true;
      kanBossState.notify();
    }, 'Meta+A'),
  );

  // ? — Toggle shortcuts help
  disposables.push(
    api.commands.registerWithHotkey('kanboss.shortcuts-help', 'Keyboard Shortcuts', () => {
      toggleHelp();
    }, 'Shift+/'),
  );

  return {
    dispose() {
      for (const d of disposables) d.dispose();
      showHelp = false;
      helpListeners.clear();
    },
  };
}
