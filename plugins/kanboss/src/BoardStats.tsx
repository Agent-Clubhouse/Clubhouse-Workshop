const React = globalThis.React;
const { useState, useMemo } = React;

import type { Card, Board } from './types';
import { computeBoardStats } from './boardStatsUtils';
import * as S from './styles';

// ── Tiny bar chart ──────────────────────────────────────────────────────

function MiniBar({ items, colorFn }: {
  items: { label: string; count: number }[];
  colorFn: (index: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: S.color.textTertiary, width: 70, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
          <div style={{ flex: 1, height: 10, background: S.color.bgTertiary, borderRadius: 4, overflow: 'hidden' }}>
            {item.count > 0 && (
              <div style={{
                width: `${(item.count / max) * 100}%`,
                height: '100%',
                background: colorFn(i),
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }} />
            )}
          </div>
          <span style={{ fontSize: 10, color: S.color.textSecondary, width: 20, flexShrink: 0 }}>
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Stat pill ───────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '6px 12px',
      borderRadius: 8,
      background: S.color.bgTertiary,
      minWidth: 60,
    }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: color || S.color.text }}>{value}</span>
      <span style={{ fontSize: 9, color: S.color.textTertiary, marginTop: 2 }}>{label}</span>
    </div>
  );
}

// ── State distribution colors ───────────────────────────────────────────

const STATE_COLORS = [
  'var(--text-info, #3b82f6)',
  'var(--text-warning, #eab308)',
  'var(--text-success, #22c55e)',
  'var(--text-accent, #8b5cf6)',
  'var(--text-error, #f87171)',
  '#06b6d4',
  '#ec4899',
  '#f97316',
];

// ── BoardStats component ────────────────────────────────────────────────

export function BoardStats({ cards, board }: { cards: Card[]; board: Board }) {
  const [expanded, setExpanded] = useState(false);

  const stats = useMemo(() => computeBoardStats(cards, board), [cards, board]);

  const successRateStr = isNaN(stats.automationSuccessRate)
    ? 'N/A'
    : `${Math.round(stats.automationSuccessRate * 100)}%`;

  const successRateColor = isNaN(stats.automationSuccessRate)
    ? S.color.textTertiary
    : stats.automationSuccessRate >= 0.8
    ? S.color.textSuccess
    : stats.automationSuccessRate >= 0.5
    ? S.color.textWarning
    : S.color.textError;

  const stuckColor = stats.stuckCount > 0 ? S.color.textError : S.color.textSuccess;

  return (
    <div style={{ borderBottom: `1px solid ${S.color.border}`, fontFamily: S.font.family }}>
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: S.font.family,
        }}
      >
        <span style={{ fontSize: 10, color: S.color.textTertiary, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
          {'\u25B6'}
        </span>
        <span style={{ fontSize: 11, color: S.color.textSecondary, fontWeight: 500 }}>Stats</span>

        {/* Inline summary when collapsed */}
        {!expanded && (
          <span style={{ fontSize: 10, color: S.color.textTertiary }}>
            {stats.totalCards} cards
            {stats.stuckCount > 0 && <span style={{ color: S.color.textError }}> &middot; {stats.stuckCount} stuck</span>}
            {!isNaN(stats.automationSuccessRate) && <span> &middot; {successRateStr} auto</span>}
          </span>
        )}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Summary pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatPill label="Total" value={String(stats.totalCards)} />
            <StatPill label="Stuck" value={String(stats.stuckCount)} color={stuckColor} />
            <StatPill label="Auto Rate" value={successRateStr} color={successRateColor} />
            {!isNaN(stats.automationSuccessRate) && (
              <StatPill
                label="Auto Runs"
                value={`${stats.automationSuccesses}/${stats.automationTotal}`}
              />
            )}
          </div>

          {/* Cards per state */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, color: S.color.textSecondary, marginBottom: 4 }}>
              Cards by State
            </div>
            <MiniBar
              items={stats.cardsPerState.map((s) => ({ label: s.stateName, count: s.count }))}
              colorFn={(i) => STATE_COLORS[i % STATE_COLORS.length]}
            />
          </div>

          {/* Priority breakdown */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, color: S.color.textSecondary, marginBottom: 4 }}>
              Priority Breakdown
            </div>
            <MiniBar
              items={stats.priorityBreakdown.filter((p) => p.count > 0).map((p) => ({ label: p.label, count: p.count }))}
              colorFn={(i) => {
                const visible = stats.priorityBreakdown.filter((p) => p.count > 0);
                return visible[i]?.color || S.color.textTertiary;
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
