const React = globalThis.React;
const { useState, useCallback } = React;

import type { BoardState, Priority } from './types';
import { PRIORITY_CONFIG } from './types';
import { kanBossState } from './state';
import * as S from './styles';

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'critical'];

interface BatchActionsBarProps {
  selectionCount: number;
  states: BoardState[];
  onBatchMove: (targetStateId: string) => void;
  onBatchPriority: (priority: Priority) => void;
  onBatchDelete: () => void;
}

function DropdownButton({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: '4px 10px',
          fontSize: 11,
          color: S.color.text,
          background: S.color.bgTertiary,
          border: `1px solid ${S.color.border}`,
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: S.font.family,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {label} <span style={{ fontSize: 9 }}>{'\u25BC'}</span>
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: S.color.bgSecondary,
            border: `1px solid ${S.color.border}`,
            borderRadius: 10,
            boxShadow: `0 10px 25px ${S.color.shadow}`,
            padding: '4px 0',
            minWidth: 140,
            zIndex: 50,
          }}>
            {React.Children.map(children, (child: React.ReactElement) =>
              React.cloneElement(child, { onClick: (...args: unknown[]) => { child.props.onClick?.(...args); setOpen(false); } })
            )}
          </div>
        </>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
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
};

export function BatchActionsBar({ selectionCount, states, onBatchMove, onBatchPriority, onBatchDelete }: BatchActionsBarProps) {
  const handleClear = useCallback(() => {
    kanBossState.clearSelection();
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 16px',
      background: S.color.accentBg,
      borderBottom: `1px solid ${S.color.border}`,
      fontFamily: S.font.family,
      fontSize: 11,
      flexShrink: 0,
    }}>
      {/* Selection count */}
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: S.color.accent,
        padding: '2px 8px',
        borderRadius: 99,
        background: `${S.color.accent}20`,
      }}>
        {selectionCount} selected
      </span>

      {/* Move To */}
      <DropdownButton label="Move To">
        {states.map((state) => (
          <button
            key={state.id}
            onClick={() => onBatchMove(state.id)}
            style={menuItemStyle}
          >
            {state.name}
          </button>
        ))}
      </DropdownButton>

      {/* Set Priority */}
      <DropdownButton label="Set Priority">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            onClick={() => onBatchPriority(p)}
            style={{
              ...menuItemStyle,
              color: PRIORITY_CONFIG[p].color || S.color.text,
            }}
          >
            {PRIORITY_CONFIG[p].label}
          </button>
        ))}
      </DropdownButton>

      {/* Delete */}
      <button
        onClick={onBatchDelete}
        style={{
          padding: '4px 10px',
          fontSize: 11,
          color: S.color.textError,
          background: 'transparent',
          border: `1px solid ${S.color.borderError}`,
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: S.font.family,
        }}
      >
        Delete
      </button>

      <div style={{ flex: 1 }} />

      {/* Clear selection */}
      <button
        onClick={handleClear}
        style={{
          padding: '4px 10px',
          fontSize: 11,
          color: S.color.textTertiary,
          background: 'transparent',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: S.font.family,
        }}
      >
        Clear
      </button>
    </div>
  );
}
