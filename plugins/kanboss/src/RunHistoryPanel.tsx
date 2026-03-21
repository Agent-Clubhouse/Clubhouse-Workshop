const React = globalThis.React;
const { useEffect, useState, useCallback } = React;

import type { PluginAPI } from '@clubhouse/plugin-types';
import type { RunHistoryEntry } from './types';
import { RUN_HISTORY_KEY, RUN_OUTCOME_CONFIG } from './types';
import { kanBossState } from './state';
import * as S from './styles';

interface RunHistoryPanelProps {
  api: PluginAPI;
  boardId: string;
  onClose: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function formatDuration(start: number, end: number): string {
  const secs = Math.round((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}

function OutcomeBadge({ outcome }: { outcome: RunHistoryEntry['outcome'] }) {
  const cfg = RUN_OUTCOME_CONFIG[outcome];
  return (
    <span style={{
      fontSize: 10,
      padding: '2px 8px',
      borderRadius: 99,
      fontWeight: 600,
      background: `${cfg.color}20`,
      color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function RunEntry({ entry }: { entry: RunHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '10px 12px',
        background: S.color.bgSecondary,
        border: `1px solid ${S.color.border}`,
        borderRadius: 10,
        cursor: 'pointer',
        fontFamily: S.font.family,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <OutcomeBadge outcome={entry.outcome} />
        <span style={{
          flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500,
          color: S.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {entry.cardTitle}
        </span>
        <span style={{ fontSize: 10, color: S.color.textTertiary, flexShrink: 0 }}>
          {formatTime(entry.completedAt)}
        </span>
      </div>

      {/* Subtitle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 10, color: S.color.textTertiary }}>
          {entry.stateName}
        </span>
        <span style={{ fontSize: 10, color: S.color.textTertiary }}>
          Attempt {entry.attempt}
        </span>
        <span style={{ fontSize: 10, color: S.color.textTertiary }}>
          {formatDuration(entry.startedAt, entry.completedAt)}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${S.color.border}` }}>
          {entry.agentSummary && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: S.color.textSecondary, marginBottom: 4 }}>
                Agent Summary
              </div>
              <div style={{
                fontSize: 11, color: S.color.text, lineHeight: 1.5,
                padding: 8, borderRadius: 8, background: S.color.bg,
                maxHeight: 120, overflowY: 'auto',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                fontFamily: S.font.mono,
              }}>
                {entry.agentSummary}
              </div>
            </div>
          )}
          {entry.filesModified.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 500, color: S.color.textSecondary, marginBottom: 4 }}>
                Files Modified ({entry.filesModified.length})
              </div>
              <div style={{
                fontSize: 10, color: S.color.textTertiary, lineHeight: 1.6,
                fontFamily: S.font.mono,
              }}>
                {entry.filesModified.map((f, i) => (
                  <div key={i}>{f}</div>
                ))}
              </div>
            </div>
          )}
          {!entry.agentSummary && entry.filesModified.length === 0 && (
            <div style={{ fontSize: 11, color: S.color.textTertiary, fontStyle: 'italic' }}>
              No details available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RunHistoryPanel({ api, boardId, onClose }: RunHistoryPanelProps) {
  const [entries, setEntries] = useState<RunHistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadHistory = useCallback(async () => {
    const raw = await api.storage.projectLocal.read(RUN_HISTORY_KEY);
    const all: RunHistoryEntry[] = Array.isArray(raw) ? raw : [];
    const boardEntries = all
      .filter((e) => e.boardId === boardId)
      .sort((a, b) => b.completedAt - a.completedAt);
    setEntries(boardEntries);
    setLoaded(true);
  }, [api, boardId]);

  useEffect(() => {
    loadHistory();
    const unsub = kanBossState.subscribe(() => {
      loadHistory();
    });
    return unsub;
  }, [loadHistory]);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div
        style={{ ...S.dialogWide, maxWidth: 560, maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: `1px solid ${S.color.border}`,
          fontFamily: S.font.family,
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: S.color.text }}>
            Automation History
          </span>
          <button
            onClick={onClose}
            style={{ color: S.color.textTertiary, fontSize: 18, border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            {'\u00D7'}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!loaded && (
            <div style={{ fontSize: 12, color: S.color.textTertiary, textAlign: 'center', padding: 32 }}>
              Loading...
            </div>
          )}
          {loaded && entries.length === 0 && (
            <div style={{ fontSize: 12, color: S.color.textTertiary, textAlign: 'center', padding: 32 }}>
              No automation runs yet for this board.
            </div>
          )}
          {entries.map((entry) => (
            <RunEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}
