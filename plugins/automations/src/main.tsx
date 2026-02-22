import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { PluginContext, PluginAPI, PluginModule, ModelOption, CompletedQuickAgentInfo } from '@clubhouse/plugin-types';
import type { Automation, RunRecord } from './types';
import { matchesCron, describeSchedule, validateCronExpression, PRESETS } from './cron';
import * as S from './styles';

// ── Storage keys ────────────────────────────────────────────────────────
const AUTOMATIONS_KEY = 'automations';
const runsKey = (automationId: string) => `runs:${automationId}`;
const MAX_RUNS = 50;

// ── activate() ──────────────────────────────────────────────────────────

export function activate(ctx: PluginContext, api: PluginAPI): void {
  const storage = api.storage.projectLocal;

  // Track agent → automation mapping for runs in flight
  const pendingRuns = new Map<string, string>();

  // 1. onStatusChange — detect agent completion
  const statusSub = api.agents.onStatusChange((agentId, status, prevStatus) => {
    const automationId = pendingRuns.get(agentId);
    if (!automationId) return;

    const isCompleted =
      (prevStatus === 'running' && status === 'sleeping') ||
      (prevStatus === 'running' && status === 'error');

    if (!isCompleted) return;

    pendingRuns.delete(agentId);

    // Look up summary from completed agents
    const completed = api.agents.listCompleted();
    const info = completed.find((c) => c.id === agentId);

    const runStatus = status === 'sleeping' ? 'completed' as const : 'failed' as const;

    // Update run record in storage
    storage.read(runsKey(automationId)).then((raw) => {
      const runs: RunRecord[] = Array.isArray(raw) ? raw : [];
      const idx = runs.findIndex((r) => r.agentId === agentId);
      if (idx !== -1) {
        runs[idx] = {
          ...runs[idx],
          status: runStatus,
          summary: info?.summary ?? null,
          exitCode: info?.exitCode ?? null,
          completedAt: Date.now(),
        };
      }
      storage.write(runsKey(automationId), runs);
    });

    // Update lastRunAt on the automation
    storage.read(AUTOMATIONS_KEY).then((raw) => {
      const automations: Automation[] = Array.isArray(raw) ? raw : [];
      const auto = automations.find((a) => a.id === automationId);
      if (auto) {
        auto.lastRunAt = Date.now();
        storage.write(AUTOMATIONS_KEY, automations);
      }
    });
  });
  ctx.subscriptions.push(statusSub);

  // 2. Cron tick — every 30 seconds
  const tickInterval = setInterval(async () => {
    const now = new Date();
    const raw = await storage.read(AUTOMATIONS_KEY);
    const automations: Automation[] = Array.isArray(raw) ? raw : [];

    for (const auto of automations) {
      if (!auto.enabled) continue;
      if (!matchesCron(auto.cronExpression, now)) continue;

      // Prevent re-firing within the same minute
      if (auto.lastRunAt) {
        const lastRun = new Date(auto.lastRunAt);
        if (
          lastRun.getMinutes() === now.getMinutes() &&
          lastRun.getHours() === now.getHours() &&
          lastRun.getDate() === now.getDate() &&
          lastRun.getMonth() === now.getMonth() &&
          lastRun.getFullYear() === now.getFullYear()
        ) {
          continue;
        }
      }

      // Fire the agent
      try {
        const agentId = await api.agents.runQuick(auto.prompt, {
          model: auto.model || undefined,
        });

        pendingRuns.set(agentId, auto.id);

        // Record the run
        const runsRaw = await storage.read(runsKey(auto.id));
        const runs: RunRecord[] = Array.isArray(runsRaw) ? runsRaw : [];
        runs.unshift({
          agentId,
          automationId: auto.id,
          startedAt: Date.now(),
          status: 'running',
          summary: null,
          exitCode: null,
          completedAt: null,
        });
        // Cap at MAX_RUNS
        if (runs.length > MAX_RUNS) runs.length = MAX_RUNS;
        await storage.write(runsKey(auto.id), runs);

        // Update lastRunAt
        auto.lastRunAt = Date.now();
        await storage.write(AUTOMATIONS_KEY, automations);
      } catch {
        // Agent spawn failed — skip silently
      }
    }
  }, 30_000);

  ctx.subscriptions.push({ dispose: () => clearInterval(tickInterval) });

  // 3. Register create command
  const cmdSub = api.commands.register('create', () => {
    // Command fires from header — the MainPanel handles creation via storage
  });
  ctx.subscriptions.push(cmdSub);
}

export function deactivate(): void {
  // subscriptions auto-disposed
}

// ── helpers ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `auto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ── MainPanel ───────────────────────────────────────────────────────────

export function MainPanel({ api }: { api: PluginAPI }) {
  const storage = api.storage.projectLocal;

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [completedAgents, setCompletedAgents] = useState<CompletedQuickAgentInfo[]>([]);

  // Editor state
  const [editName, setEditName] = useState('');
  const [editCron, setEditCron] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [cronError, setCronError] = useState<string | null>(null);

  // ── Load automations on mount + poll ────────────────────────────────
  const loadAutomations = useCallback(async () => {
    const raw = await storage.read(AUTOMATIONS_KEY);
    const list: Automation[] = Array.isArray(raw) ? raw : [];
    setAutomations(list);
    // Detect which automations have running agents
    const running = new Set<string>();
    for (const auto of list) {
      const runsRaw = await storage.read(runsKey(auto.id));
      const autoRuns: RunRecord[] = Array.isArray(runsRaw) ? runsRaw : [];
      if (autoRuns.some((r) => r.status === 'running')) running.add(auto.id);
    }
    setRunningIds(running);
    if (!loaded) setLoaded(true);
  }, [storage, loaded]);

  useEffect(() => {
    loadAutomations();
    const iv = setInterval(loadAutomations, 10_000);
    return () => clearInterval(iv);
  }, [loadAutomations]);

  // ── Load model options ──────────────────────────────────────────────
  useEffect(() => {
    api.agents.getModelOptions().then(setModelOptions);
  }, [api]);

  // ── Sync editor when selection changes ──────────────────────────────
  const selected = automations.find((a) => a.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setEditName(selected.name);
      setEditCron(selected.cronExpression);
      setEditModel(selected.model);
      setEditPrompt(selected.prompt);
      setEditEnabled(selected.enabled);
      setCronError(null);
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load runs for selected automation ───────────────────────────────
  const loadRuns = useCallback(async () => {
    if (!selectedId) { setRuns([]); return; }
    const raw = await storage.read(runsKey(selectedId));
    setRuns(Array.isArray(raw) ? raw : []);
    setCompletedAgents(api.agents.listCompleted());
  }, [storage, selectedId, api]);

  useEffect(() => {
    loadRuns();
    const iv = setInterval(loadRuns, 5_000);
    return () => clearInterval(iv);
  }, [loadRuns]);

  // ── Actions ─────────────────────────────────────────────────────────
  const createAutomation = useCallback(async () => {
    const auto: Automation = {
      id: generateId(),
      name: 'New Automation',
      cronExpression: '0 * * * *',
      model: '',
      prompt: '',
      enabled: false,
      createdAt: Date.now(),
      lastRunAt: null,
    };
    const next = [...automations, auto];
    await storage.write(AUTOMATIONS_KEY, next);
    setAutomations(next);
    setSelectedId(auto.id);
  }, [automations, storage]);

  const saveAutomation = useCallback(async () => {
    if (!selectedId) return;
    const error = validateCronExpression(editCron);
    if (error) {
      setCronError(error);
      return;
    }
    setCronError(null);
    const next = automations.map((a) =>
      a.id === selectedId
        ? { ...a, name: editName, cronExpression: editCron, model: editModel, prompt: editPrompt, enabled: editEnabled }
        : a,
    );
    await storage.write(AUTOMATIONS_KEY, next);
    setAutomations(next);
  }, [selectedId, automations, storage, editName, editCron, editModel, editPrompt, editEnabled]);

  const deleteAutomation = useCallback(async () => {
    if (!selectedId) return;
    const next = automations.filter((a) => a.id !== selectedId);
    await storage.write(AUTOMATIONS_KEY, next);
    await storage.delete(runsKey(selectedId));
    setAutomations(next);
    setSelectedId(next.length > 0 ? next[0].id : null);
  }, [selectedId, automations, storage]);

  const toggleEnabled = useCallback(async (id: string) => {
    const next = automations.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a,
    );
    await storage.write(AUTOMATIONS_KEY, next);
    setAutomations(next);
    if (id === selectedId) setEditEnabled(!editEnabled);
  }, [automations, storage, selectedId, editEnabled]);

  const deleteRun = useCallback(async (agentId: string) => {
    if (!selectedId) return;
    const raw = await storage.read(runsKey(selectedId));
    const current: RunRecord[] = Array.isArray(raw) ? raw : [];
    const next = current.filter((r) => r.agentId !== agentId);
    await storage.write(runsKey(selectedId), next);
    setRuns(next);
  }, [selectedId, storage]);

  // Stable refs for callbacks
  const actionsRef = useRef({ createAutomation, saveAutomation, deleteAutomation, toggleEnabled, deleteRun });
  actionsRef.current = { createAutomation, saveAutomation, deleteAutomation, toggleEnabled, deleteRun };

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: S.color.textTertiary, fontSize: 12 }}>
        Loading automations...
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div style={S.container}>
      {/* ── Left sidebar: automation list ────────────────────────────── */}
      <div style={S.sidebar}>
        {/* Header */}
        <div style={S.sidebarHeader}>
          <span style={{ fontSize: 12, fontWeight: 500, color: S.color.text }}>Automations</span>
          <button
            style={{ ...S.baseButton, color: S.color.textTertiary }}
            onClick={() => actionsRef.current.createAutomation()}
            title="Add automation"
          >
            + Add
          </button>
        </div>
        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {automations.length === 0 ? (
            <div style={{ padding: '16px 12px', fontSize: 12, color: S.color.textTertiary, textAlign: 'center' }}>
              No automations yet
            </div>
          ) : (
            <div style={{ padding: '2px 0' }}>
              {automations.map((auto) => (
                <div
                  key={auto.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 12px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    background: auto.id === selectedId ? S.color.bgSurfaceHover : 'transparent',
                  }}
                  onClick={() => setSelectedId(auto.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: S.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {auto.name || 'Untitled'}
                      </span>
                      <span style={S.badge(
                        !auto.enabled ? 'off' : runningIds.has(auto.id) ? 'running' : 'on'
                      )}>
                        {!auto.enabled ? 'off' : runningIds.has(auto.id) ? 'running' : 'on'}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: S.color.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {describeSchedule(auto.cronExpression)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: editor + runs ────────────────────────────────────── */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
          {/* ── Top toolbar: enable, save, delete ─────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px',
            borderBottom: `1px solid ${S.color.border}`,
            background: S.color.bgSecondary,
            flexShrink: 0,
          }}>
            {/* Enable/Disable toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                style={{
                  width: 36, height: 20,
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  background: editEnabled ? S.color.accent : S.color.bgSurface,
                  position: 'relative',
                  transition: 'background 0.2s',
                }}
                onClick={() => setEditEnabled(!editEnabled)}
              >
                <span style={{
                  position: 'absolute',
                  top: 2,
                  left: editEnabled ? 18 : 2,
                  width: 16, height: 16,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </button>
              <span style={{ fontSize: 12, color: S.color.textSecondary, width: 56 }}>
                {editEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {/* Save */}
            <button
              style={S.accentButton}
              onClick={() => actionsRef.current.saveAutomation()}
            >
              Save
            </button>
            {/* Spacer */}
            <div style={{ flex: 1 }} />
            {/* Delete */}
            <button
              style={S.dangerButton}
              onClick={async () => {
                const ok = await api.ui.showConfirm('Delete this automation and its run history? This cannot be undone.');
                if (ok) await deleteAutomation();
              }}
            >
              Delete
            </button>
          </div>

          {/* ── Editor section ─────────────────────────────────────── */}
          <div style={{ ...S.section, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Name */}
            <div>
              <label style={S.label}>Name</label>
              <input
                type="text"
                style={S.baseInput}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            {/* Schedule — preset buttons + raw cron input */}
            <div>
              <label style={{ ...S.label, marginBottom: 6 }}>Schedule</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: editCron === p.value ? S.color.blueBg : S.color.bgSurface,
                      color: editCron === p.value ? S.color.blue : S.color.textSecondary,
                      border: editCron === p.value
                        ? `1px solid ${S.color.blueBorder}`
                        : `1px solid ${S.color.borderSecondary}`,
                    }}
                    onClick={() => setEditCron(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                style={{ ...S.baseInput, fontFamily: S.font.mono }}
                value={editCron}
                onChange={(e) => { setEditCron(e.target.value); setCronError(null); }}
                placeholder="* * * * *  (min hour dom month dow)"
              />
              <div style={{ fontSize: 10, color: S.color.textTertiary, marginTop: 4 }}>
                {describeSchedule(editCron)}
              </div>
              {cronError && (
                <div style={{ fontSize: 11, color: S.color.error, marginTop: 4 }}>
                  {cronError}
                </div>
              )}
            </div>
            {/* Model */}
            <div>
              <label style={S.label}>Model</label>
              <select
                style={{ ...S.baseInput, cursor: 'pointer' }}
                value={editModel}
                onChange={(e) => setEditModel(e.target.value)}
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            {/* Prompt */}
            <div>
              <label style={S.label}>Prompt</label>
              <textarea
                style={{
                  ...S.baseInput,
                  fontFamily: S.font.mono,
                  resize: 'vertical',
                  minHeight: 80,
                }}
                rows={4}
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Enter the mission for the agent..."
              />
            </div>
          </div>

          {/* ── Runs section ───────────────────────────────────────── */}
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: S.color.text, marginBottom: 8 }}>
              Run History
            </div>
            {runs.length === 0 ? (
              <div style={{ fontSize: 12, color: S.color.textTertiary }}>No runs yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {runs.slice(0, 20).map((run) => (
                  <div
                    key={run.agentId}
                    style={{ padding: '8px 10px', background: S.color.bgSecondary, borderRadius: 6, fontSize: 12 }}
                  >
                    {/* Top row: status dot, timestamp, actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={S.statusDot(run.status)} />
                      <span style={{ color: S.color.textTertiary, flexShrink: 0 }}>{formatTime(run.startedAt)}</span>
                      <span style={S.statusText(run.status)}>
                        {run.status === 'running' ? 'running' : run.status}
                      </span>
                      {/* Spacer */}
                      <div style={{ flex: 1 }} />
                      {/* Actions */}
                      {run.status === 'running' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            style={{
                              padding: '2px 8px', fontSize: 11, borderRadius: 4,
                              background: S.color.accentBg, color: S.color.accent,
                              border: `1px solid ${S.color.accentBorder}`,
                              cursor: 'pointer',
                            }}
                            onClick={() => api.navigation.focusAgent(run.agentId)}
                          >
                            View
                          </button>
                          <button
                            style={{
                              padding: '2px 8px', fontSize: 11, borderRadius: 4,
                              color: S.color.error,
                              border: `1px solid ${S.color.errorBorder}`,
                              background: 'transparent',
                              cursor: 'pointer',
                            }}
                            onClick={() => api.agents.kill(run.agentId)}
                          >
                            Stop
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            style={{
                              padding: '2px 8px', fontSize: 11, borderRadius: 4,
                              cursor: 'pointer',
                              background: expandedRunId === run.agentId ? S.color.accent : S.color.accentBg,
                              color: expandedRunId === run.agentId ? '#fff' : S.color.accent,
                              border: expandedRunId === run.agentId
                                ? 'none'
                                : `1px solid ${S.color.accentBorder}`,
                            }}
                            onClick={() => setExpandedRunId(expandedRunId === run.agentId ? null : run.agentId)}
                          >
                            Summary
                          </button>
                          <button
                            style={{
                              padding: '2px 8px', fontSize: 11, borderRadius: 4,
                              color: S.color.error,
                              border: `1px solid ${S.color.errorBorder}`,
                              background: 'transparent',
                              cursor: 'pointer',
                            }}
                            onClick={async () => {
                              const ok = await api.ui.showConfirm('Delete this run record? This cannot be undone.');
                              if (ok) actionsRef.current.deleteRun(run.agentId);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Expanded summary card */}
                    {expandedRunId === run.agentId && (() => {
                      const completed = completedAgents.find((c) => c.id === run.agentId);
                      if (completed) {
                        return (
                          <div style={{ marginTop: 8 }}>
                            <api.widgets.QuickAgentGhost
                              completed={completed}
                              onDismiss={() => setExpandedRunId(null)}
                            />
                          </div>
                        );
                      }
                      // Fallback if agent no longer in completed list
                      return run.summary ? (
                        <div style={{
                          marginTop: 8, padding: 10,
                          background: S.color.bgSurface,
                          borderRadius: 6,
                          fontSize: 11,
                          color: S.color.textSecondary,
                          lineHeight: 1.6,
                        }}>
                          {run.summary}
                        </div>
                      ) : null;
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.color.textTertiary, fontSize: 12 }}>
          {automations.length === 0
            ? 'Create an automation to get started'
            : 'Select an automation to edit'}
        </div>
      )}
    </div>
  );
}

// Compile-time type assertion
const _: PluginModule = { activate, deactivate, MainPanel };
void _;
