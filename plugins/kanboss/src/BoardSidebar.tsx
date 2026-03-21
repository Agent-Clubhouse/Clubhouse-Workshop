const React = globalThis.React;
const { useEffect, useState, useCallback, useRef } = React;

import type { PluginAPI } from '@clubhouse/plugin-types';
import type { Board } from './types';
import { BOARDS_KEY, cardsKey, generateId } from './types';
import { kanBossState } from './state';
import { mutateStorage } from './storageQueue';
import { BOARD_TEMPLATES } from './templates';
import type { BoardTemplate } from './templates';
import * as S from './styles';

// ── Board factory ───────────────────────────────────────────────────────

function createBoardFromTemplate(name: string, gitHistory: boolean, template: BoardTemplate): Board {
  const now = Date.now();
  const { states, swimlanes } = template.create();
  return {
    id: generateId('board'),
    name,
    states,
    swimlanes,
    labels: [],
    config: { maxRetries: 3, zoomLevel: 1.0, gitHistory },
    createdAt: now,
    updatedAt: now,
  };
}

// ── Create Board Dialog ─────────────────────────────────────────────────

function CreateBoardDialog({ onSave, onCancel }: {
  onSave: (name: string, gitHistory: boolean, templateId: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [gitHistory, setGitHistory] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, gitHistory, selectedTemplate);
  }, [name, gitHistory, selectedTemplate, onSave]);

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={{ ...S.dialog, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px 8px', fontFamily: S.font.family }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: S.color.text, margin: 0 }}>Create Board</h2>
          <p style={{ fontSize: 11, color: S.color.textTertiary, marginTop: 4 }}>
            Choose a template and name your board.
          </p>
        </div>

        {/* Form */}
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: S.font.family }}>
          {/* Template picker */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: S.color.textSecondary, marginBottom: 6 }}>
              Template
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {BOARD_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 4,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1.5px solid ${isSelected ? S.color.accent : S.color.border}`,
                      background: isSelected ? S.color.accentBg : S.color.bgSecondary,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: S.font.family,
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{tmpl.icon}</span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: isSelected ? S.color.accent : S.color.text,
                      }}>
                        {tmpl.name}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: S.color.textTertiary, lineHeight: 1.4 }}>
                      {tmpl.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Board name */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: S.color.textSecondary, marginBottom: 4 }}>
              Board Name
            </label>
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. Sprint 14, Feature Work, Bug Triage..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              style={S.baseInput}
            />
          </div>

          {/* Git history */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: 10,
            borderRadius: 10,
            background: S.color.bgSecondary,
            border: `1px solid ${S.color.border}`,
          }}>
            <input
              type="checkbox"
              id="create-git-history"
              checked={gitHistory}
              onChange={(e) => setGitHistory(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <label htmlFor="create-git-history" style={{ cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: S.color.text }}>Enable git history</div>
              <div style={{ fontSize: 10, color: S.color.textTertiary, marginTop: 2, lineHeight: 1.5 }}>
                Store board data in a git-tracked location so it can be shared with your team.
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '12px 20px',
          borderTop: `1px solid ${S.color.border}`,
          fontFamily: S.font.family,
        }}>
          <button onClick={onCancel} style={S.baseButton}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            style={{ ...S.accentButton, opacity: name.trim() ? 1 : 0.4 }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BoardSidebar (SidebarPanel) ─────────────────────────────────────────

export function BoardSidebar({ api }: { api: PluginAPI }) {
  const boardsStorage = api.storage.projectLocal;
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardCounts, setCardCounts] = useState<Map<string, number>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;

  const loadBoards = useCallback(async () => {
    const raw = await boardsStorage.read(BOARDS_KEY);
    const list: Board[] = Array.isArray(raw) ? raw : [];
    setBoards(list);
    kanBossState.setBoards(list);

    const counts = new Map<string, number>();
    for (const board of list) {
      const cardsStor = board.config.gitHistory ? api.storage.project : api.storage.projectLocal;
      const cardsRaw = await cardsStor.read(cardsKey(board.id));
      const cards = Array.isArray(cardsRaw) ? cardsRaw : [];
      counts.set(board.id, cards.length);
    }
    setCardCounts(counts);
    if (!loadedRef.current) setLoaded(true);
  }, [boardsStorage, api]);

  const loadBoardsRef = useRef(loadBoards);
  loadBoardsRef.current = loadBoards;

  // ── Single subscription — initial load + refresh handling ───────────
  const refreshRef = useRef(kanBossState.refreshCount);
  useEffect(() => {
    loadBoardsRef.current();

    const unsub = kanBossState.subscribe(() => {
      setSelectedId(kanBossState.selectedBoardId);

      if (kanBossState.refreshCount !== refreshRef.current) {
        refreshRef.current = kanBossState.refreshCount;
        loadBoardsRef.current();
      }
    });
    return unsub;
  }, []);

  const handleCreate = useCallback(async (name: string, gitHistory: boolean, templateId: string) => {
    const template = BOARD_TEMPLATES.find((t) => t.id === templateId) ?? BOARD_TEMPLATES[0];
    const board = createBoardFromTemplate(name, gitHistory, template);
    const next = await mutateStorage<Board>(boardsStorage, BOARDS_KEY, (boards) => {
      boards.push(board);
      return boards;
    });
    const cardsStor = gitHistory ? api.storage.project : api.storage.projectLocal;
    await cardsStor.write(cardsKey(board.id), []);
    setBoards(next);
    kanBossState.setBoards(next);
    kanBossState.selectBoard(board.id);
    setSelectedId(board.id);
    setCardCounts((prev) => new Map(prev).set(board.id, 0));
    setShowCreateDialog(false);
  }, [boards, boardsStorage, api]);

  const handleDelete = useCallback(async (boardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const board = boards.find((b) => b.id === boardId);
    if (!board) return;
    const ok = await api.ui.showConfirm(`Delete board "${board.name}" and all its cards? This cannot be undone.`);
    if (!ok) return;

    const next = await mutateStorage<Board>(boardsStorage, BOARDS_KEY, (boards) =>
      boards.filter((b) => b.id !== boardId));
    const cardsStor = board.config.gitHistory ? api.storage.project : api.storage.projectLocal;
    await cardsStor.delete(cardsKey(boardId));
    setBoards(next);
    kanBossState.setBoards(next);

    if (selectedId === boardId) {
      const newSel = next.length > 0 ? next[0].id : null;
      kanBossState.selectBoard(newSel);
      setSelectedId(newSel);
    }
  }, [api, boards, boardsStorage, selectedId]);

  const handleReorder = useCallback(async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const updated = await mutateStorage<Board>(boardsStorage, BOARDS_KEY, (boards) => {
      if (fromIdx >= boards.length || toIdx >= boards.length) return boards;
      const result = [...boards];
      const [moved] = result.splice(fromIdx, 1);
      result.splice(toIdx, 0, moved);
      return result;
    });
    setBoards(updated);
    kanBossState.setBoards(updated);
  }, [boards, boardsStorage]);

  const handleSelect = useCallback((boardId: string) => {
    kanBossState.selectBoard(boardId);
    setSelectedId(boardId);
  }, []);

  if (!loaded) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: S.color.textTertiary,
        fontSize: 12,
        fontFamily: S.font.family,
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: S.color.bgSecondary, fontFamily: S.font.family }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: `1px solid ${S.color.border}`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: S.color.text }}>Boards</span>
        <button
          onClick={() => setShowCreateDialog(true)}
          title="Create new board"
          style={{
            padding: '2px 8px',
            fontSize: 12,
            color: S.color.textTertiary,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: 6,
          }}
        >
          + New
        </button>
      </div>

      {/* Board list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {boards.length === 0 ? (
          <div style={{ padding: '16px 12px', fontSize: 12, color: S.color.textTertiary, textAlign: 'center' }}>
            No boards yet
          </div>
        ) : (
          <div style={{ padding: '2px 0' }}>
            {boards.map((board, boardIdx) => (
              <div
                key={board.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('kanboss/board-idx', String(boardIdx))}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = e.dataTransfer.getData('kanboss/board-idx');
                  if (from !== '') handleReorder(parseInt(from), boardIdx);
                }}
                onClick={() => handleSelect(board.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  background: board.id === selectedId ? S.color.bgActive : 'transparent',
                  color: board.id === selectedId ? S.color.text : S.color.textSecondary,
                }}
              >
                <span style={{ color: S.color.textTertiary, fontSize: 10, userSelect: 'none', cursor: 'grab', flexShrink: 0 }}>
                  {'\u2261'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {board.name}
                  </div>
                </div>
                <span style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 6,
                  background: S.color.bgTertiary,
                  color: S.color.textTertiary,
                  flexShrink: 0,
                }}>
                  {cardCounts.get(board.id) ?? 0}
                </span>
                <button
                  onClick={(e) => handleDelete(board.id, e)}
                  title="Delete board"
                  style={{
                    color: S.color.textTertiary,
                    fontSize: 14,
                    opacity: board.id === selectedId ? 0.5 : 0,
                    transition: 'opacity 0.15s',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = board.id === selectedId ? '0.5' : '0'; }}
                >
                  {'\u00D7'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateDialog && (
        <CreateBoardDialog
          onSave={handleCreate}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}
