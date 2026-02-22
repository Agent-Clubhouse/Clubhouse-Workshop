const React = globalThis.React;
const { useState, useCallback, useEffect } = React;

import type { Card, Priority, HistoryEntry, Label } from './types';
import { cardsKey, generateId, PRIORITY_CONFIG } from './types';
import { kanBossState } from './state';
import * as S from './styles';

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'critical'];

interface CardDialogProps {
  api: import('@clubhouse/plugin-types').PluginAPI;
  boardId: string;
  boardLabels: Label[];
}

// ── History entry display ───────────────────────────────────────────────

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const time = new Date(entry.timestamp).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
      <span style={{ fontSize: 10, color: S.color.textTertiary, flexShrink: 0, width: 96 }}>{time}</span>
      <span style={{ fontSize: 10, color: S.color.textSecondary }}>{entry.detail}</span>
    </div>
  );
}

// ── CardDialog ──────────────────────────────────────────────────────────

export function CardDialog({ api, boardId, boardLabels }: CardDialogProps) {
  const currentBoard = kanBossState.boards.find((b) => b.id === boardId);
  const storage = currentBoard?.config.gitHistory ? api.storage.project : api.storage.projectLocal;
  const isNew = kanBossState.editingCardId === 'new';
  const cardId = isNew ? null : kanBossState.editingCardId;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<Priority>('none');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(isNew);

  // Load existing card data
  useEffect(() => {
    if (isNew || !cardId) {
      setTitle('');
      setBody('');
      setPriority('none');
      setSelectedLabels([]);
      setHistory([]);
      setLoaded(true);
      return;
    }
    (async () => {
      const raw = await storage.read(cardsKey(boardId));
      const cards: Card[] = Array.isArray(raw) ? raw : [];
      const card = cards.find((c) => c.id === cardId);
      if (card) {
        setTitle(card.title);
        setBody(card.body);
        setPriority(card.priority);
        setSelectedLabels(card.labels || []);
        setHistory(card.history);
      }
      setLoaded(true);
    })();
  }, [cardId, isNew, boardId, storage]);

  // ── Toggle label ─────────────────────────────────────────────────────
  const toggleLabel = useCallback((labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId) ? prev.filter((l) => l !== labelId) : [...prev, labelId]
    );
  }, []);

  // ── Save ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!title.trim()) return;

    const raw = await storage.read(cardsKey(boardId));
    const cards: Card[] = Array.isArray(raw) ? raw : [];
    const now = Date.now();

    if (isNew) {
      const newCard: Card = {
        id: generateId('card'),
        boardId,
        title: title.trim(),
        body,
        priority,
        labels: selectedLabels,
        stateId: kanBossState.editingStateId!,
        swimlaneId: kanBossState.editingSwimlaneId!,
        history: [{ action: 'created', timestamp: now, detail: `Created "${title.trim()}"` }],
        automationAttempts: 0,
        createdAt: now,
        updatedAt: now,
      };
      cards.push(newCard);
    } else if (cardId) {
      const idx = cards.findIndex((c) => c.id === cardId);
      if (idx !== -1) {
        const card = cards[idx];
        const changes: string[] = [];
        if (card.title !== title.trim()) changes.push('title');
        if (card.body !== body) changes.push('body');
        if (card.priority !== priority) {
          changes.push('priority');
          card.history.push({
            action: 'priority-changed',
            timestamp: now,
            detail: `Priority changed from ${card.priority} to ${priority}`,
          });
        }
        if (JSON.stringify(card.labels) !== JSON.stringify(selectedLabels)) changes.push('labels');
        if (changes.length > 0) {
          card.history.push({
            action: 'edited',
            timestamp: now,
            detail: `Edited: ${changes.join(', ')}`,
          });
        }
        card.title = title.trim();
        card.body = body;
        card.priority = priority;
        card.labels = selectedLabels;
        card.updatedAt = now;
        cards[idx] = card;
      }
    }

    await storage.write(cardsKey(boardId), cards);
    kanBossState.closeCardDialog();
    kanBossState.triggerRefresh();
  }, [title, body, priority, selectedLabels, isNew, cardId, boardId, storage]);

  // ── Delete ──────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!cardId) return;
    const ok = await api.ui.showConfirm('Delete this card? This cannot be undone.');
    if (!ok) return;

    const raw = await storage.read(cardsKey(boardId));
    const cards: Card[] = Array.isArray(raw) ? raw : [];
    const next = cards.filter((c) => c.id !== cardId);
    await storage.write(cardsKey(boardId), next);
    kanBossState.closeCardDialog();
    kanBossState.triggerRefresh();
  }, [api, cardId, boardId, storage]);

  const handleCancel = useCallback(() => {
    kanBossState.closeCardDialog();
  }, []);

  if (!loaded) return null;

  return (
    <div style={S.overlay} onClick={handleCancel}>
      <div style={{ ...S.dialog, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${S.color.border}`,
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: S.color.text, fontFamily: S.font.family }}>
            {isNew ? 'New Card' : 'Edit Card'}
          </span>
          <button
            onClick={handleCancel}
            style={{
              color: S.color.textTertiary,
              fontSize: 18,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {'\u00D7'}
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, fontFamily: S.font.family }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: S.color.textSecondary, marginBottom: 4 }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title..."
              autoFocus
              style={S.baseInput}
            />
          </div>

          {/* Body */}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: S.color.textSecondary, marginBottom: 4 }}>Description</label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Description..."
              style={{ ...S.baseInput, resize: 'vertical' }}
            />
          </div>

          {/* Priority */}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: S.color.textSecondary, marginBottom: 4 }}>Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              style={S.baseInput}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
              ))}
            </select>
          </div>

          {/* Labels */}
          {boardLabels.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 11, color: S.color.textSecondary, marginBottom: 6 }}>Labels</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {boardLabels.map((label) => {
                  const isSelected = selectedLabels.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => toggleLabel(label.id)}
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 99,
                        border: `1px solid ${isSelected ? label.color : S.color.border}`,
                        background: isSelected ? `${label.color}20` : 'transparent',
                        color: isSelected ? label.color : S.color.textSecondary,
                        cursor: 'pointer',
                        fontWeight: isSelected ? 500 : 400,
                        fontFamily: S.font.family,
                      }}
                    >
                      {label.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* History (edit mode only) */}
        {!isNew && history.length > 0 && (
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: S.color.textSecondary, marginBottom: 6, fontFamily: S.font.family }}>History</div>
            <div style={{
              maxHeight: 128,
              overflowY: 'auto',
              border: `1px solid ${S.color.border}`,
              borderRadius: 8,
              padding: 8,
              background: S.color.bgSecondary,
            }}>
              {[...history].reverse().map((entry, i) => (
                <HistoryItem key={i} entry={entry} />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderTop: `1px solid ${S.color.border}`,
          fontFamily: S.font.family,
        }}>
          {!isNew ? (
            <button onClick={handleDelete} style={S.dangerButton}>Delete</button>
          ) : (
            <div />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handleCancel} style={S.baseButton}>Cancel</button>
            <button onClick={handleSave} style={S.accentButton}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
