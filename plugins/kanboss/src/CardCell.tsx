const React = globalThis.React;
const { useState, useCallback, useRef } = React;

import type { Card, BoardState, Label } from './types';
import { PRIORITY_CONFIG, PRIORITY_RANK, isCardStuck, isCardAutomating } from './types';
import { kanBossState } from './state';
import * as S from './styles';

const MAX_VISIBLE = 5;

export interface CardCellProps {
  cards: Card[];
  stateId: string;
  swimlaneId: string;
  isLastState: boolean;
  allStates: BoardState[];
  boardLabels: Label[];
  wipLimit: number;
  onMoveCard: (cardId: string, targetStateId: string, targetSwimlaneId?: string) => void;
  onDeleteCard: (cardId: string) => void;
  onClearRetries: (cardId: string) => void;
  onManualAdvance: (cardId: string) => void;
}

// ── Move dropdown ───────────────────────────────────────────────────────

function MoveButton({ card, allStates, onMove }: {
  card: Card;
  allStates: BoardState[];
  onMove: (cardId: string, targetStateId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const otherStates = allStates.filter((s) => s.id !== card.stateId);

  return (
    <div style={{ position: 'relative', zIndex: open ? 50 : 1 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title="Move card"
        style={{
          fontSize: 10,
          color: S.color.textTertiary,
          padding: '0 4px',
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        {'\u2192'}
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 20,
          background: S.color.bgSecondary,
          border: `1px solid ${S.color.border}`,
          borderRadius: 10,
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          padding: '4px 0',
          minWidth: 120,
          zIndex: 50,
        }}>
          {otherStates.map((state) => (
            <button
              key={state.id}
              onClick={(e) => { e.stopPropagation(); onMove(card.id, state.id); setOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '5px 10px',
                fontSize: 11,
                color: S.color.text,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: S.font.family,
              }}
            >
              {state.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card tile ───────────────────────────────────────────────────────────

function CardTile({ card, allStates, boardLabels, onMoveCard, onDeleteCard, onClearRetries, onManualAdvance }: {
  card: Card;
  allStates: BoardState[];
  boardLabels: Label[];
  onMoveCard: (cardId: string, targetStateId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onClearRetries: (cardId: string) => void;
  onManualAdvance: (cardId: string) => void;
}) {
  const stuck = isCardStuck(card);
  const automating = !stuck && isCardAutomating(card);
  const hasRetries = !stuck && !automating && card.automationAttempts > 0;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const config = PRIORITY_CONFIG[card.priority];

  const cardLabels = card.labels
    .map((lid) => boardLabels.find((l) => l.id === lid))
    .filter(Boolean) as Label[];

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-kanboss-card', card.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => kanBossState.openEditCard(card.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      style={{
        position: 'relative',
        background: S.color.bgSecondary,
        border: `1px solid ${stuck ? S.color.textError : automating ? S.color.accent : S.color.border}`,
        borderRadius: 10,
        padding: '8px 10px',
        cursor: 'grab',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: stuck
          ? `0 0 8px rgba(248, 113, 113, 0.3)`
          : automating
          ? `0 0 8px rgba(139, 92, 246, 0.3)`
          : '0 1px 3px rgba(0,0,0,0.15)',
        fontFamily: S.font.family,
        ...(automating ? {
          animation: 'kanboss-pulse 2s ease-in-out infinite',
        } : {}),
      }}
    >
      {/* Priority + Labels row */}
      {(!config.hidden || cardLabels.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {!config.hidden && (
            <span style={{
              fontSize: 10,
              padding: '1px 8px',
              borderRadius: 99,
              fontWeight: 500,
              background: `${config.color}20`,
              color: config.color,
            }}>
              {config.label}
            </span>
          )}
          {cardLabels.map((label) => (
            <span key={label.id} style={{
              fontSize: 10,
              padding: '1px 8px',
              borderRadius: 99,
              fontWeight: 500,
              background: `${label.color}20`,
              color: label.color,
            }}>
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Title + move button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <span style={{
          flex: 1,
          minWidth: 0,
          fontSize: 11,
          color: S.color.text,
          fontWeight: 500,
          lineHeight: 1.4,
        }}>
          {card.title}
        </span>
        <MoveButton card={card} allStates={allStates} onMove={onMoveCard} />
      </div>

      {/* Body preview */}
      {card.body && (
        <div style={{
          fontSize: 10,
          color: S.color.textTertiary,
          marginTop: 4,
          lineHeight: 1.5,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as never,
        }}>
          {card.body}
        </div>
      )}

      {/* Automation progress indicator */}
      {automating && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 6,
          paddingTop: 6,
          borderTop: `1px solid ${S.color.border}`,
        }}>
          <span style={{
            fontSize: 9,
            padding: '2px 8px',
            borderRadius: 99,
            background: S.color.accentBg,
            color: S.color.accent,
            fontWeight: 600,
          }}>
            {'\u2699'} Automating...
          </span>
          <span style={{ fontSize: 9, color: S.color.textTertiary }}>
            Attempt {card.automationAttempts}
          </span>
        </div>
      )}

      {/* Stuck actions */}
      {stuck && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 6,
            paddingTop: 6,
            borderTop: `1px solid ${S.color.border}`,
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onClearRetries(card.id); }}
            title="Reset retry counter so automation can try again"
            style={{
              fontSize: 9,
              padding: '2px 8px',
              borderRadius: 99,
              background: S.color.bgTertiary,
              color: S.color.textSecondary,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Clear Retries
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onManualAdvance(card.id); }}
            title="Manually advance to next state"
            style={{
              fontSize: 9,
              padding: '2px 8px',
              borderRadius: 99,
              background: 'rgba(34, 197, 94, 0.15)',
              color: S.color.textSuccess,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Advance {'\u2192'}
          </button>
        </div>
      )}

      {/* Status badges — top-right corner */}
      {stuck && (
        <div style={{
          position: 'absolute',
          top: -6,
          right: -6,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '2px 8px',
          borderRadius: 99,
          fontSize: 8,
          fontWeight: 700,
          color: '#fff',
          background: S.color.textError,
        }}>
          {'!'} Stuck
        </div>
      )}
      {hasRetries && card.automationAttempts === 1 && (
        <div style={{
          position: 'absolute',
          top: -6,
          right: -6,
          padding: '2px 8px',
          borderRadius: 99,
          fontSize: 8,
          fontWeight: 700,
          color: '#fff',
          background: S.color.textSuccess,
        }}>
          1st Attempt
        </div>
      )}
      {hasRetries && card.automationAttempts > 1 && (
        <div style={{
          position: 'absolute',
          top: -6,
          right: -6,
          padding: '2px 8px',
          borderRadius: 99,
          fontSize: 8,
          fontWeight: 700,
          color: '#fff',
          background: '#eab308',
        }}>
          Retry: {card.automationAttempts - 1}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu(null); }}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: contextMenu.x,
              top: contextMenu.y,
              background: S.color.bgSecondary,
              border: `1px solid ${S.color.border}`,
              borderRadius: 10,
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              padding: '4px 0',
              zIndex: 50,
              minWidth: 130,
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); kanBossState.openEditCard(card.id); setContextMenu(null); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 12px',
                fontSize: 11,
                color: S.color.text,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: S.font.family,
              }}
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteCard(card.id); setContextMenu(null); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 12px',
                fontSize: 11,
                color: S.color.textError,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: S.font.family,
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── CardCell ────────────────────────────────────────────────────────────

export function CardCell({ cards, stateId, swimlaneId, isLastState, allStates, boardLabels, wipLimit, onMoveCard, onDeleteCard, onClearRetries, onManualAdvance }: CardCellProps) {
  const [expanded, setExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  // Sort cards by priority (critical first, none last)
  const sorted = [...cards].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4));

  const overWip = wipLimit > 0 && sorted.length > wipLimit;
  const atWip = wipLimit > 0 && sorted.length === wipLimit;

  const handleAdd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    kanBossState.openNewCard(stateId, swimlaneId);
  }, [stateId, swimlaneId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const cardId = e.dataTransfer.getData('application/x-kanboss-card');
    if (cardId) onMoveCard(cardId, stateId, swimlaneId);
  }, [onMoveCard, stateId, swimlaneId]);

  const dropProps = {
    onDragOver: handleDragOver,
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  // Last state: collapse to "N done" badge by default
  if (isLastState && sorted.length > 0 && !expanded) {
    return (
      <div
        {...dropProps}
        style={{
          flex: 1,
          padding: 8,
          minHeight: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
          ...(isDragOver ? {
            background: 'rgba(59, 130, 246, 0.1)',
            boxShadow: 'inset 0 0 0 1px rgba(59, 130, 246, 0.3)',
            borderRadius: 10,
          } : {}),
        }}
      >
        <button
          onClick={() => setExpanded(true)}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            borderRadius: 99,
            background: 'rgba(34, 197, 94, 0.15)',
            color: S.color.textSuccess,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {sorted.length} done
        </button>
      </div>
    );
  }

  // Determine visible cards
  const visibleCards = expanded || sorted.length <= MAX_VISIBLE ? sorted : sorted.slice(0, MAX_VISIBLE);
  const hiddenCount = sorted.length - visibleCards.length;

  return (
    <div
      {...dropProps}
      style={{
        flex: 1,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 60,
        transition: 'background 0.2s',
        ...(overWip ? { background: 'rgba(248, 113, 113, 0.05)' } : {}),
        ...(isDragOver ? {
          background: 'rgba(59, 130, 246, 0.1)',
          boxShadow: 'inset 0 0 0 1px rgba(59, 130, 246, 0.3)',
          borderRadius: 10,
        } : {}),
      }}
    >
      {/* WIP limit indicator */}
      {wipLimit > 0 && (
        <div style={{
          fontSize: 9,
          color: overWip ? S.color.textError : atWip ? '#eab308' : S.color.textTertiary,
          textAlign: 'right',
          fontWeight: overWip ? 600 : 400,
        }}>
          {sorted.length}/{wipLimit}
        </div>
      )}

      {/* Cards */}
      {visibleCards.map((card) => (
        <CardTile
          key={card.id}
          card={card}
          allStates={allStates}
          boardLabels={boardLabels}
          onMoveCard={onMoveCard}
          onDeleteCard={onDeleteCard}
          onClearRetries={onClearRetries}
          onManualAdvance={onManualAdvance}
        />
      ))}

      {/* "+N more" pill */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            width: '100%',
            textAlign: 'center',
            fontSize: 10,
            color: S.color.textTertiary,
            padding: '2px 0',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          +{hiddenCount} more
        </button>
      )}

      {/* Collapse button for expanded last-state */}
      {isLastState && expanded && (
        <button
          onClick={() => setExpanded(false)}
          style={{
            width: '100%',
            textAlign: 'center',
            fontSize: 10,
            color: S.color.textTertiary,
            padding: '2px 0',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Collapse
        </button>
      )}

      {/* + Add button */}
      <button
        onClick={handleAdd}
        style={{
          width: '100%',
          textAlign: 'center',
          fontSize: 10,
          color: S.color.textTertiary,
          padding: '2px 0',
          marginTop: 2,
          borderRadius: 8,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        + Add
      </button>
    </div>
  );
}
