const React = globalThis.React;
const { useEffect, useState, useCallback, useRef } = React;

import type { PluginAPI } from '@clubhouse/plugin-types';
import type { Board, Card } from './types';
import { BOARDS_KEY, cardsKey, isCardStuck } from './types';
import { kanBossState, filtersEqual, type FilterState } from './state';
import { CardCell } from './CardCell';
import { CardDialog } from './CardDialog';
import { BoardConfigDialog } from './BoardConfigDialog';
import { FilterBar } from './FilterBar';
import { triggerAutomation } from './AutomationEngine';
import { mutateStorage } from './storageQueue';
import * as S from './styles';

function cardsStorage(api: PluginAPI, board: Board) {
  return board.config.gitHistory ? api.storage.project : api.storage.projectLocal;
}

function applyFilter(cards: Card[], filter: FilterState): Card[] {
  let result = cards;

  if (filter.searchQuery) {
    const q = filter.searchQuery.toLowerCase();
    result = result.filter((c) => c.title.toLowerCase().includes(q) || c.body.toLowerCase().includes(q));
  }

  if (filter.priorityFilter !== 'all') {
    result = result.filter((c) => c.priority === filter.priorityFilter);
  }

  if (filter.labelFilter !== 'all') {
    result = result.filter((c) => c.labels.includes(filter.labelFilter));
  }

  if (filter.stuckOnly) {
    result = result.filter(isCardStuck);
  }

  return result;
}

// ── Inline keyframes for automation pulse ────────────────────────────────

const PULSE_STYLE = `
@keyframes kanboss-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
`;

export function BoardView({ api }: { api: PluginAPI }) {
  const boardsStorage = api.storage.projectLocal;

  const [board, setBoard] = useState<Board | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [filter, setFilter] = useState<FilterState>(kanBossState.filter);

  // ── Subscribe to state ────────────────────────────────────────────────
  const loadBoardRef = useRef<(() => void) | null>(null);
  const refreshRef2 = useRef(kanBossState.refreshCount);

  useEffect(() => {
    const unsub = kanBossState.subscribe(() => {
      setSelectedBoardId(kanBossState.selectedBoardId);
      setShowCardDialog(kanBossState.editingCardId !== null);
      setShowConfigDialog(kanBossState.configuringBoard);
      setFilter(prev => filtersEqual(prev, kanBossState.filter) ? prev : { ...kanBossState.filter });

      if (kanBossState.refreshCount !== refreshRef2.current) {
        refreshRef2.current = kanBossState.refreshCount;
        loadBoardRef.current?.();
      }
    });
    setSelectedBoardId(kanBossState.selectedBoardId);
    return unsub;
  }, []);

  // ── Load board + cards ────────────────────────────────────────────────
  const loadBoard = useCallback(async () => {
    if (!selectedBoardId) {
      setBoard(null);
      setCards([]);
      return;
    }
    const raw = await boardsStorage.read(BOARDS_KEY);
    const boards: Board[] = Array.isArray(raw) ? raw : [];
    const found = boards.find((b) => b.id === selectedBoardId) ?? null;
    setBoard(found);
    if (found) {
      setZoomLevel(found.config.zoomLevel);
      const cardsStor = cardsStorage(api, found);
      const cardsRaw = await cardsStor.read(cardsKey(found.id));
      setCards(Array.isArray(cardsRaw) ? cardsRaw : []);
    } else {
      setCards([]);
    }
  }, [selectedBoardId, boardsStorage, api]);

  loadBoardRef.current = loadBoard;

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // ── Zoom controls ─────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoomLevel);
  zoomRef.current = zoomLevel;

  const adjustZoom = useCallback(async (delta: number) => {
    if (!board) return;
    const newZoom = Math.max(0.5, Math.min(2.0, Math.round((zoomLevel + delta) * 20) / 20));
    setZoomLevel(newZoom);

    await mutateStorage<Board>(boardsStorage, BOARDS_KEY, (boards) => {
      const idx = boards.findIndex((b) => b.id === board.id);
      if (idx !== -1) {
        boards[idx].config.zoomLevel = newZoom;
      }
      return boards;
    });
  }, [board, zoomLevel, boardsStorage]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const cur = zoomRef.current;
      const next = Math.max(0.5, Math.min(2.0, Math.round((cur + delta) * 100) / 100));
      if (next !== cur) adjustZoom(next - cur);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [adjustZoom]);

  // ── Move card ─────────────────────────────────────────────────────────
  const handleMoveCard = useCallback(async (cardId: string, targetStateId: string, targetSwimlaneId?: string) => {
    if (!board) return;

    let movedCard: Card | null = null;
    let toStateAutomatic = false;

    const updated = await mutateStorage<Card>(cardsStorage(api, board), cardsKey(board.id), (allCards) => {
      const idx = allCards.findIndex((c) => c.id === cardId);
      if (idx === -1) return allCards;

      const card = allCards[idx];
      const stateChanged = card.stateId !== targetStateId;
      const laneChanged = targetSwimlaneId != null && card.swimlaneId !== targetSwimlaneId;

      if (!stateChanged && !laneChanged) return allCards;

      const fromState = board.states.find((s) => s.id === card.stateId);
      const toState = board.states.find((s) => s.id === targetStateId);
      if (!fromState || !toState) return allCards;

      const fromLane = laneChanged ? board.swimlanes.find((l) => l.id === card.swimlaneId) : null;
      const toLane = laneChanged && targetSwimlaneId ? board.swimlanes.find((l) => l.id === targetSwimlaneId) : null;

      card.stateId = targetStateId;
      if (targetSwimlaneId) card.swimlaneId = targetSwimlaneId;
      card.automationAttempts = 0;
      card.updatedAt = Date.now();

      let detail = '';
      if (stateChanged) detail = `Moved from "${fromState.name}" to "${toState.name}"`;
      if (laneChanged && fromLane && toLane) {
        detail += detail ? `, lane "${fromLane.name}" \u2192 "${toLane.name}"` : `Moved to lane "${toLane.name}"`;
      }

      card.history.push({ action: 'moved', timestamp: Date.now(), detail });
      allCards[idx] = card;

      if (stateChanged && toState.isAutomatic) {
        movedCard = card;
        toStateAutomatic = true;
      }

      return allCards;
    });

    setCards([...updated]);
    kanBossState.triggerRefresh();

    if (toStateAutomatic && movedCard) {
      await triggerAutomation(api, movedCard, board);
    }
  }, [board, api]);

  // ── Delete card ───────────────────────────────────────────────────────
  const handleDeleteCard = useCallback(async (cardId: string) => {
    if (!board) return;
    const updated = await mutateStorage<Card>(cardsStorage(api, board), cardsKey(board.id), (allCards) =>
      allCards.filter((c) => c.id !== cardId));
    setCards(updated);
    kanBossState.triggerRefresh();
  }, [board, api]);

  // ── Clear retries ─────────────────────────────────────────────────────
  const handleClearRetries = useCallback(async (cardId: string) => {
    if (!board) return;
    let clearedCard: Card | null = null;

    const updated = await mutateStorage<Card>(cardsStorage(api, board), cardsKey(board.id), (allCards) => {
      const idx = allCards.findIndex((c) => c.id === cardId);
      if (idx === -1) return allCards;

      allCards[idx].automationAttempts = 0;
      allCards[idx].updatedAt = Date.now();
      allCards[idx].history.push({
        action: 'edited',
        timestamp: Date.now(),
        detail: 'Retries cleared \u2014 automation can retry',
      });

      const state = board.states.find((s) => s.id === allCards[idx].stateId);
      if (state?.isAutomatic) {
        clearedCard = allCards[idx];
      }

      return allCards;
    });

    setCards([...updated]);
    kanBossState.triggerRefresh();

    if (clearedCard) {
      await triggerAutomation(api, clearedCard, board);
    }
  }, [board, api]);

  // ── Manual advance ────────────────────────────────────────────────────
  const handleManualAdvance = useCallback(async (cardId: string) => {
    if (!board) return;

    const updated = await mutateStorage<Card>(cardsStorage(api, board), cardsKey(board.id), (allCards) => {
      const idx = allCards.findIndex((c) => c.id === cardId);
      if (idx === -1) return allCards;

      const card = allCards[idx];
      const sortedStates = [...board.states].sort((a, b) => a.order - b.order);
      const curIdx = sortedStates.findIndex((s) => s.id === card.stateId);
      if (curIdx === -1 || curIdx >= sortedStates.length - 1) return allCards;

      const nextState = sortedStates[curIdx + 1];
      const fromState = sortedStates[curIdx];

      card.stateId = nextState.id;
      card.automationAttempts = 0;
      card.updatedAt = Date.now();
      card.history.push({
        action: 'moved',
        timestamp: Date.now(),
        detail: `Manually advanced from "${fromState.name}" to "${nextState.name}"`,
      });

      allCards[idx] = card;
      return allCards;
    });

    setCards([...updated]);
    kanBossState.triggerRefresh();
  }, [board, api]);

  // ── No board selected ─────────────────────────────────────────────────
  if (!board) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: S.color.textTertiary,
        fontSize: 12,
        height: '100%',
        fontFamily: S.font.family,
      }}>
        Select a board to get started
      </div>
    );
  }

  const filteredCards = applyFilter(cards, filter);
  const sortedStates = [...board.states].sort((a, b) => a.order - b.order);
  const sortedLanes = [...board.swimlanes].sort((a, b) => a.order - b.order);
  const lastStateId = sortedStates.length > 0 ? sortedStates[sortedStates.length - 1].id : null;
  const gridCols = `140px repeat(${sortedStates.length}, minmax(220px, 1fr))`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: S.color.bg, fontFamily: S.font.family }}>
      {/* Inject keyframe animation */}
      <style dangerouslySetInnerHTML={{ __html: PULSE_STYLE }} />

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        borderBottom: `1px solid ${S.color.border}`,
        background: S.color.bgSecondary,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: S.color.text }}>{board.name}</span>
        <div style={{ flex: 1 }} />

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => adjustZoom(-0.1)}
            disabled={zoomLevel <= 0.5}
            style={{
              padding: '2px 6px',
              fontSize: 12,
              color: S.color.textTertiary,
              background: S.color.bgTertiary,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              opacity: zoomLevel <= 0.5 ? 0.3 : 1,
            }}
          >
            -
          </button>
          <span style={{ fontSize: 10, color: S.color.textTertiary, width: 40, textAlign: 'center' }}>
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => adjustZoom(0.1)}
            disabled={zoomLevel >= 2.0}
            style={{
              padding: '2px 6px',
              fontSize: 12,
              color: S.color.textTertiary,
              background: S.color.bgTertiary,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              opacity: zoomLevel >= 2.0 ? 0.3 : 1,
            }}
          >
            +
          </button>
        </div>

        {/* Config button */}
        <button
          onClick={() => kanBossState.openBoardConfig()}
          title="Board settings"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color: S.color.textTertiary,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {'\u2699'}
        </button>
      </div>

      {/* Filter bar */}
      <FilterBar filter={filter} labels={board.labels || []} />

      {/* Grid container */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto' }}>
        <div style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left',
          minWidth: `${140 + sortedStates.length * 220}px`,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: gridCols,
            gap: 1,
            borderRadius: 12,
            overflow: 'hidden',
            background: `${S.color.border}50`,
          }}>
            {/* Header row — empty corner */}
            <div style={{ background: S.color.bgSecondary, padding: 8 }} />

            {/* State headers */}
            {sortedStates.map((state) => {
              const colCards = filteredCards.filter((c) => c.stateId === state.id);
              const overWip = state.wipLimit > 0 && colCards.length > state.wipLimit;
              return (
                <div
                  key={`header-${state.id}`}
                  style={{
                    background: S.color.bgSecondary,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    ...(overWip ? { borderBottom: `2px solid ${S.color.textError}` } : {}),
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: S.color.text }}>{state.name}</span>
                    {state.isAutomatic && (
                      <span style={{
                        fontSize: 9,
                        padding: '1px 6px',
                        borderRadius: 99,
                        background: S.color.accentBg,
                        color: S.color.accent,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}>
                        {'\u2699'} auto
                      </span>
                    )}
                    {state.wipLimit > 0 && (
                      <span style={{
                        fontSize: 9,
                        color: overWip ? S.color.textError : S.color.textTertiary,
                        fontWeight: overWip ? 600 : 400,
                      }}>
                        {colCards.length}/{state.wipLimit}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Swimlane rows */}
            {sortedLanes.flatMap((lane, laneIndex) => {
              const laneAgents = api.agents.list();
              const managerAgent = lane.managerAgentId
                ? laneAgents.find((a) => a.id === lane.managerAgentId)
                : null;

              const evenBg = S.color.bgSecondary;
              const oddBg = S.color.bg;
              const laneBg = laneIndex % 2 === 0 ? evenBg : oddBg;
              const cellBg = laneIndex % 2 === 0 ? S.color.bg : `${S.color.bgSecondary}80`;

              return [
                // Swimlane label
                <div
                  key={`lane-${lane.id}`}
                  style={{
                    background: laneBg,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 500, color: S.color.text }}>{lane.name}</span>
                  {managerAgent && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <span style={{ fontSize: 9, color: S.color.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {managerAgent.name}
                      </span>
                    </div>
                  )}
                </div>,

                // Card cells
                ...sortedStates.map((state) => {
                  const cellCards = filteredCards.filter(
                    (c) => c.stateId === state.id && c.swimlaneId === lane.id,
                  );
                  return (
                    <div
                      key={`cell-${lane.id}-${state.id}`}
                      style={{ background: cellBg, display: 'flex', flexDirection: 'column' }}
                    >
                      <CardCell
                        cards={cellCards}
                        stateId={state.id}
                        swimlaneId={lane.id}
                        isLastState={state.id === lastStateId}
                        allStates={sortedStates}
                        boardLabels={board.labels || []}
                        wipLimit={state.wipLimit}
                        onMoveCard={handleMoveCard}
                        onDeleteCard={handleDeleteCard}
                        onClearRetries={handleClearRetries}
                        onManualAdvance={handleManualAdvance}
                      />
                    </div>
                  );
                }),
              ];
            })}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showCardDialog && <CardDialog api={api} boardId={board.id} boardLabels={board.labels || []} />}
      {showConfigDialog && <BoardConfigDialog api={api} board={board} />}
    </div>
  );
}
