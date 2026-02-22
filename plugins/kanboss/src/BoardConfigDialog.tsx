const React = globalThis.React;
const { useState, useCallback, useEffect } = React;

import type { PluginAPI, AgentInfo } from '@clubhouse/plugin-types';
import type { Board, BoardState, Swimlane, Label } from './types';
import { BOARDS_KEY, generateId, LABEL_COLORS } from './types';
import { kanBossState } from './state';
import * as S from './styles';

interface BoardConfigDialogProps {
  api: PluginAPI;
  board: Board;
}

type ConfigTab = 'states' | 'swimlanes' | 'labels' | 'settings';

export function BoardConfigDialog({ api, board }: BoardConfigDialogProps) {
  const storage = api.storage.projectLocal;
  const [tab, setTab] = useState<ConfigTab>('states');

  // Local copies for editing
  const [states, setStates] = useState<BoardState[]>([...board.states]);
  const [swimlanes, setSwimlanes] = useState<Swimlane[]>([...board.swimlanes]);
  const [labels, setLabels] = useState<Label[]>([...(board.labels || [])]);
  const [maxRetries, setMaxRetries] = useState(board.config.maxRetries);
  const [gitHistory, setGitHistory] = useState(board.config.gitHistory ?? false);
  const [durableAgents, setDurableAgents] = useState<AgentInfo[]>([]);

  useEffect(() => {
    const agents = api.agents.list().filter((a) => a.kind === 'durable');
    setDurableAgents(agents);
  }, [api]);

  // ── State management ────────────────────────────────────────────────
  const addState = useCallback(() => {
    const order = states.length;
    setStates([...states, {
      id: generateId('state'),
      name: `State ${order + 1}`,
      order,
      isAutomatic: false,
      automationPrompt: '',
      evaluationPrompt: '',
      wipLimit: 0,
    }]);
  }, [states]);

  const removeState = useCallback((stateId: string) => {
    if (states.length <= 1) return;
    const filtered = states.filter((s) => s.id !== stateId);
    setStates(filtered.map((s, i) => ({ ...s, order: i })));
  }, [states]);

  const updateState = useCallback((stateId: string, updates: Partial<BoardState>) => {
    setStates(states.map((s) => s.id === stateId ? { ...s, ...updates } : s));
  }, [states]);

  const moveState = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const result = [...states];
    const [moved] = result.splice(fromIdx, 1);
    result.splice(toIdx, 0, moved);
    setStates(result.map((s, i) => ({ ...s, order: i })));
  }, [states]);

  // ── Swimlane management ─────────────────────────────────────────────
  const addSwimlane = useCallback(() => {
    const order = swimlanes.length;
    setSwimlanes([...swimlanes, {
      id: generateId('lane'),
      name: `Swimlane ${order + 1}`,
      order,
      managerAgentId: null,
      evaluationAgentId: null,
    }]);
  }, [swimlanes]);

  const removeSwimlane = useCallback((laneId: string) => {
    if (swimlanes.length <= 1) return;
    const filtered = swimlanes.filter((l) => l.id !== laneId);
    setSwimlanes(filtered.map((l, i) => ({ ...l, order: i })));
  }, [swimlanes]);

  const updateSwimlane = useCallback((laneId: string, updates: Partial<Swimlane>) => {
    setSwimlanes(swimlanes.map((l) => l.id === laneId ? { ...l, ...updates } : l));
  }, [swimlanes]);

  const moveSwimlane = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const result = [...swimlanes];
    const [moved] = result.splice(fromIdx, 1);
    result.splice(toIdx, 0, moved);
    setSwimlanes(result.map((l, i) => ({ ...l, order: i })));
  }, [swimlanes]);

  // ── Label management ──────────────────────────────────────────────
  const addLabel = useCallback(() => {
    const usedColors = labels.map((l) => l.color);
    const nextColor = LABEL_COLORS.find((c) => !usedColors.includes(c)) || LABEL_COLORS[0];
    setLabels([...labels, {
      id: generateId('label'),
      name: `Label ${labels.length + 1}`,
      color: nextColor,
    }]);
  }, [labels]);

  const removeLabel = useCallback((labelId: string) => {
    setLabels(labels.filter((l) => l.id !== labelId));
  }, [labels]);

  const updateLabel = useCallback((labelId: string, updates: Partial<Label>) => {
    setLabels(labels.map((l) => l.id === labelId ? { ...l, ...updates } : l));
  }, [labels]);

  // ── Save ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const raw = await storage.read(BOARDS_KEY);
    const boards: Board[] = Array.isArray(raw) ? raw : [];
    const idx = boards.findIndex((b) => b.id === board.id);
    if (idx !== -1) {
      boards[idx] = {
        ...boards[idx],
        states,
        swimlanes,
        labels,
        config: { ...boards[idx].config, maxRetries, gitHistory },
        updatedAt: Date.now(),
      };
      await storage.write(BOARDS_KEY, boards);
      kanBossState.setBoards(boards);
    }
    kanBossState.closeBoardConfig();
    kanBossState.triggerRefresh();
  }, [storage, board.id, states, swimlanes, labels, maxRetries, gitHistory]);

  const handleCancel = useCallback(() => {
    kanBossState.closeBoardConfig();
  }, []);

  // ── Tab button helper ───────────────────────────────────────────────
  const tabBtn = (id: ConfigTab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      style={{
        padding: '6px 12px',
        fontSize: 12,
        borderRadius: '8px 8px 0 0',
        border: tab === id ? `1px solid ${S.color.border}` : 'none',
        borderBottom: tab === id ? `1px solid ${S.color.bg}` : 'none',
        marginBottom: tab === id ? -1 : 0,
        background: tab === id ? S.color.bg : 'transparent',
        color: tab === id ? S.color.text : S.color.textTertiary,
        cursor: 'pointer',
        fontFamily: S.font.family,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={S.overlay} onClick={handleCancel}>
      <div style={S.dialogWide} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${S.color.border}`,
          fontFamily: S.font.family,
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: S.color.text }}>
            Board Settings: {board.name}
          </span>
          <button
            onClick={handleCancel}
            style={{ color: S.color.textTertiary, fontSize: 18, border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            {'\u00D7'}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 16px 0', background: S.color.bgSecondary }}>
          {tabBtn('states', 'States')}
          {tabBtn('swimlanes', 'Swimlanes')}
          {tabBtn('labels', 'Labels')}
          {tabBtn('settings', 'Settings')}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, fontFamily: S.font.family }}>

          {/* ── States tab ──────────────────────────────────────────────── */}
          {tab === 'states' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {states.map((state, idx) => (
                <div
                  key={state.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('kanboss/state-idx', String(idx))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = e.dataTransfer.getData('kanboss/state-idx');
                    if (from !== '') moveState(parseInt(from), idx);
                  }}
                  style={{
                    padding: 12,
                    background: S.color.bgSecondary,
                    border: `1px solid ${S.color.border}`,
                    borderRadius: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {/* Name row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: S.color.textTertiary, cursor: 'grab', fontSize: 12, userSelect: 'none' }} title="Drag to reorder">{'\u2261'}</span>
                    <input
                      type="text"
                      value={state.name}
                      onChange={(e) => updateState(state.id, { name: e.target.value })}
                      style={{ ...S.baseInput, flex: 1 }}
                    />
                    {/* WIP limit */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <label style={{ fontSize: 10, color: S.color.textTertiary, whiteSpace: 'nowrap' }}>WIP</label>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={state.wipLimit}
                        onChange={(e) => updateState(state.id, { wipLimit: Math.max(0, parseInt(e.target.value) || 0) })}
                        style={{ ...S.baseInput, width: 50, textAlign: 'center' }}
                        title="WIP limit (0 = unlimited)"
                      />
                    </div>
                    {states.length > 1 && (
                      <button
                        onClick={() => removeState(state.id)}
                        title="Remove state"
                        style={{ color: S.color.textTertiary, fontSize: 14, border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 4px' }}
                      >
                        {'\u00D7'}
                      </button>
                    )}
                  </div>

                  {/* Automatic toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={state.isAutomatic}
                      onChange={(e) => updateState(state.id, { isAutomatic: e.target.checked })}
                    />
                    <span style={{ fontSize: 11, color: S.color.textSecondary }}>Automatic</span>
                  </label>

                  {/* Automation prompts */}
                  {state.isAutomatic && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: S.color.textSecondary, marginBottom: 4 }}>
                          Execution Prompt
                        </label>
                        <textarea
                          rows={2}
                          value={state.automationPrompt}
                          onChange={(e) => updateState(state.id, { automationPrompt: e.target.value })}
                          placeholder="Describe the work the agent should complete..."
                          style={{ ...S.baseInput, fontFamily: S.font.mono, fontSize: 11, resize: 'vertical' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: S.color.textSecondary, marginBottom: 4 }}>
                          Evaluation Prompt <span style={{ color: S.color.textTertiary }}>(optional — defaults to execution prompt)</span>
                        </label>
                        <textarea
                          rows={2}
                          value={state.evaluationPrompt}
                          onChange={(e) => updateState(state.id, { evaluationPrompt: e.target.value })}
                          placeholder="Describe the criteria for evaluating success..."
                          style={{ ...S.baseInput, fontFamily: S.font.mono, fontSize: 11, resize: 'vertical' }}
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}
              <button
                onClick={addState}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  fontSize: 12,
                  color: S.color.textTertiary,
                  border: `1px dashed ${S.color.border}`,
                  borderRadius: 10,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: S.font.family,
                }}
              >
                + Add State
              </button>
            </div>
          )}

          {/* ── Swimlanes tab ───────────────────────────────────────────── */}
          {tab === 'swimlanes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {swimlanes.map((lane, laneIdx) => (
                <div
                  key={lane.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('kanboss/lane-idx', String(laneIdx))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = e.dataTransfer.getData('kanboss/lane-idx');
                    if (from !== '') moveSwimlane(parseInt(from), laneIdx);
                  }}
                  style={{
                    padding: 12,
                    background: S.color.bgSecondary,
                    border: `1px solid ${S.color.border}`,
                    borderRadius: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {/* Name row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: S.color.textTertiary, cursor: 'grab', fontSize: 12, userSelect: 'none' }} title="Drag to reorder">{'\u2261'}</span>
                    <input
                      type="text"
                      value={lane.name}
                      onChange={(e) => updateSwimlane(lane.id, { name: e.target.value })}
                      style={{ ...S.baseInput, flex: 1 }}
                    />
                    {swimlanes.length > 1 && (
                      <button
                        onClick={() => removeSwimlane(lane.id)}
                        title="Remove swimlane"
                        style={{ color: S.color.textTertiary, fontSize: 14, border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 4px' }}
                      >
                        {'\u00D7'}
                      </button>
                    )}
                  </div>

                  {/* Agent assignment */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: S.color.textSecondary, marginBottom: 4 }}>Manager Agent</label>
                      <select
                        value={lane.managerAgentId ?? ''}
                        onChange={(e) => updateSwimlane(lane.id, { managerAgentId: e.target.value || null })}
                        style={S.baseInput}
                      >
                        <option value="">None (manual only)</option>
                        {durableAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: S.color.textSecondary, marginBottom: 4 }}>Evaluation Agent</label>
                      <select
                        value={lane.evaluationAgentId ?? ''}
                        onChange={(e) => updateSwimlane(lane.id, { evaluationAgentId: e.target.value || null })}
                        style={S.baseInput}
                      >
                        <option value="">Same as manager</option>
                        {durableAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={addSwimlane}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  fontSize: 12,
                  color: S.color.textTertiary,
                  border: `1px dashed ${S.color.border}`,
                  borderRadius: 10,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: S.font.family,
                }}
              >
                + Add Swimlane
              </button>
            </div>
          )}

          {/* ── Labels tab ──────────────────────────────────────────────── */}
          {tab === 'labels' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {labels.length === 0 && (
                <div style={{ fontSize: 12, color: S.color.textTertiary, textAlign: 'center', padding: 16 }}>
                  No labels yet. Add labels to categorize your cards.
                </div>
              )}
              {labels.map((label) => (
                <div
                  key={label.id}
                  style={{
                    padding: 12,
                    background: S.color.bgSecondary,
                    border: `1px solid ${S.color.border}`,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  {/* Color picker */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {LABEL_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateLabel(label.id, { color: c })}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: c,
                          border: label.color === c ? `2px solid ${S.color.text}` : '2px solid transparent',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                  {/* Name */}
                  <input
                    type="text"
                    value={label.name}
                    onChange={(e) => updateLabel(label.id, { name: e.target.value })}
                    style={{ ...S.baseInput, flex: 1 }}
                  />
                  {/* Preview */}
                  <span style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: `${label.color}20`,
                    color: label.color,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {label.name || 'Preview'}
                  </span>
                  {/* Remove */}
                  <button
                    onClick={() => removeLabel(label.id)}
                    title="Remove label"
                    style={{ color: S.color.textTertiary, fontSize: 14, border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 4px' }}
                  >
                    {'\u00D7'}
                  </button>
                </div>
              ))}
              <button
                onClick={addLabel}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  fontSize: 12,
                  color: S.color.textTertiary,
                  border: `1px dashed ${S.color.border}`,
                  borderRadius: 10,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: S.font.family,
                }}
              >
                + Add Label
              </button>
            </div>
          )}

          {/* ── Settings tab ────────────────────────────────────────────── */}
          {tab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: S.color.textSecondary, marginBottom: 4 }}>Max Retries</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(Math.max(1, Math.min(10, parseInt(e.target.value) || 3)))}
                  style={{ ...S.baseInput, width: 80, textAlign: 'center' }}
                />
                <p style={{ fontSize: 10, color: S.color.textTertiary, marginTop: 4 }}>
                  Number of times automation will retry before marking a card as stuck.
                </p>
              </div>

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
                  id="cfg-git-history"
                  checked={gitHistory}
                  onChange={(e) => setGitHistory(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <label htmlFor="cfg-git-history" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ fontSize: 12, color: S.color.text }}>Enable git history</div>
                  <p style={{ fontSize: 10, color: S.color.textTertiary, marginTop: 2, lineHeight: 1.5 }}>
                    Store board data in a git-tracked location so it can be shared with your team.
                  </p>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '12px 16px',
          borderTop: `1px solid ${S.color.border}`,
          fontFamily: S.font.family,
        }}>
          <button onClick={handleCancel} style={S.baseButton}>Cancel</button>
          <button onClick={handleSave} style={S.accentButton}>Save</button>
        </div>
      </div>
    </div>
  );
}
