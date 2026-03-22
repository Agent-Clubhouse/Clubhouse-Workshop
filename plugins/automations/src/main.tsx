import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { PluginContext, PluginAPI, PluginModule, ModelOption, CompletedQuickAgentInfo, PluginOrchestratorInfo, AgentInfo } from '@clubhouse/plugin-types';
import type { Automation, RunRecord, MissedRunPolicy, ExecutionMode } from './types';
import { matchesCron, describeSchedule, validateCronExpression, countMissedFireTimes, PRESETS } from './cron';
import * as S from './styles';
import { useTheme } from './use-theme';

// ── Shared refresh signal ───────────────────────────────────────────────
const refreshSignal = {
  count: 0,
  listeners: new Set<() => void>(),
  trigger(): void {
    this.count++;
    for (const fn of this.listeners) fn();
  },
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  },
};

// ── Storage keys ────────────────────────────────────────────────────────
const AUTOMATIONS_KEY = 'automations';
const runsKey = (automationId: string) => `runs:${automationId}`;
const MAX_RUNS = 50;
const MAX_CATCHUP = 10;

// ── activate() ──────────────────────────────────────────────────────────

export function activate(ctx: PluginContext, api: PluginAPI): void {
  const storage = api.storage.projectLocal;

  // Track agent → automation mapping for runs in flight
  const pendingRuns = new Map<string, string>();

  // Shared helper: fire an agent for an automation and record the run
  async function fireAutomation(auto: Automation, automations: Automation[]): Promise<void> {
    let agentId: string;

    if (auto.executionMode === 'durable' && auto.targetAgentId) {
      // Check if the durable agent exists and is sleeping
      const agents = api.agents.list();
      const target = agents.find((a) => a.id === auto.targetAgentId);
      if (!target) {
        api.logging.warn(`Automation "${auto.name}": target agent not found, skipping`);
        return;
      }
      if (target.status === 'running') {
        api.logging.info(`Automation "${auto.name}": target agent is busy, skipping`);
        return;
      }
      await api.agents.resume(auto.targetAgentId, { mission: auto.prompt });
      agentId = auto.targetAgentId;
    } else {
      agentId = await api.agents.runQuick(auto.prompt, {
        model: auto.model || undefined,
        orchestrator: auto.orchestrator || undefined,
        freeAgentMode: auto.freeAgentMode || undefined,
      });
    }

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
    if (runs.length > MAX_RUNS) runs.length = MAX_RUNS;
    await storage.write(runsKey(auto.id), runs);

    // Update lastRunAt
    auto.lastRunAt = Date.now();
    await storage.write(AUTOMATIONS_KEY, automations);
  }

  // 1. onStatusChange — detect agent completion
  const statusSub = api.agents.onStatusChange((agentId, status, _prevStatus) => {
    const automationId = pendingRuns.get(agentId);
    if (!automationId) return;

    // Treat any transition to a terminal status as completion, regardless of
    // the previous state (e.g. creating→sleeping is still a valid completion).
    const isTerminal = status === 'sleeping' || status === 'error';
    if (!isTerminal) return;

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

  // 2. reconcileStaleRuns — cross-check stored 'running' records against live agent status.
  // Called at the start of each cron tick so stale records are cleaned up even after a
  // plugin restart that cleared the in-memory pendingRuns map.
  async function reconcileStaleRuns(): Promise<void> {
    const raw = await storage.read(AUTOMATIONS_KEY);
    const automations: Automation[] = Array.isArray(raw) ? raw : [];
    const activeAgents = api.agents.list();
    const completedAgents = api.agents.listCompleted();

    for (const auto of automations) {
      const runsRaw = await storage.read(runsKey(auto.id));
      const runs: RunRecord[] = Array.isArray(runsRaw) ? runsRaw : [];
      const staleIndices = runs.reduce<number[]>((acc, r, i) => {
        if (r.status === 'running') acc.push(i);
        return acc;
      }, []);
      if (staleIndices.length === 0) continue;

      let changed = false;
      for (const idx of staleIndices) {
        const record = runs[idx];
        const activeAgent = activeAgents.find((a) => a.id === record.agentId);

        if (activeAgent && activeAgent.status !== 'sleeping' && activeAgent.status !== 'error') {
          // Agent is still in a non-terminal state — restore the pendingRuns mapping
          // so the onStatusChange callback can handle its eventual completion.
          pendingRuns.set(record.agentId, auto.id);
          continue;
        }

        // Agent is terminal (sleeping/error in active list) or gone entirely.
        const completedInfo = completedAgents.find((c) => c.id === record.agentId);
        const terminalStatus: RunRecord['status'] =
          activeAgent?.status === 'sleeping' || completedInfo ? 'completed' : 'failed';
        runs[idx] = {
          ...record,
          status: terminalStatus,
          summary: completedInfo?.summary ?? null,
          exitCode: completedInfo?.exitCode ?? activeAgent?.exitCode ?? null,
          completedAt: Date.now(),
        };
        changed = true;
      }

      if (changed) {
        await storage.write(runsKey(auto.id), runs);
      }
    }
  }

  // 3. Cron tick — every 30 seconds
  const tickInterval = setInterval(async () => {
    // Reconcile any stale 'running' records before processing new cron fires.
    // This handles the case where the plugin was restarted and pendingRuns was lost.
    await reconcileStaleRuns();

    const now = new Date();
    const raw = await storage.read(AUTOMATIONS_KEY);
    const automations: Automation[] = Array.isArray(raw) ? raw : [];

    for (const auto of automations) {
      if (!auto.enabled) continue;

      const policy = auto.missedRunPolicy || 'ignore';

      // ── Missed-run catch-up ──
      if (policy !== 'ignore' && auto.lastRunAt) {
        const lastRun = new Date(auto.lastRunAt);
        const missed = countMissedFireTimes(auto.cronExpression, lastRun, now);

        if (missed > 0) {
          const timesToFire = policy === 'run-once' ? 1 : Math.min(missed, MAX_CATCHUP);
          for (let i = 0; i < timesToFire; i++) {
            try {
              await fireAutomation(auto, automations);
            } catch {
              // spawn failed — skip
            }
          }
          // Already handled this tick (including the current-time match if any)
          continue;
        }
      }

      // ── Normal current-time matching ──
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
        await fireAutomation(auto, automations);
      } catch {
        // Agent spawn failed — skip silently
      }
    }
  }, 30_000);

  ctx.subscriptions.push({ dispose: () => clearInterval(tickInterval) });

  // 3. Register commands
  const cmdSub = api.commands.register('create', () => {
    // Command fires from header — the MainPanel handles creation via storage
  });
  ctx.subscriptions.push(cmdSub);

  const refreshSub = api.commands.register('refresh', () => {
    refreshSignal.trigger();
  });
  ctx.subscriptions.push(refreshSub);

  // 4. Register run-now command — fires the automation immediately (works even when disabled)
  const runNowSub = api.commands.register('run-now', async (...args: unknown[]) => {
    const automationId = args[0] as string | undefined;
    if (!automationId) return;
    const raw = await storage.read(AUTOMATIONS_KEY);
    const automations: Automation[] = Array.isArray(raw) ? raw : [];
    const auto = automations.find((a) => a.id === automationId);
    if (!auto) return;
    try {
      await fireAutomation(auto, automations);
      refreshSignal.trigger();
    } catch {
      // spawn failed
    }
  });
  ctx.subscriptions.push(runNowSub);
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
  const { style: themeStyle } = useTheme(api.theme);
  const storage = api.storage.projectLocal;

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [orchestrators, setOrchestrators] = useState<PluginOrchestratorInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [completedAgents, setCompletedAgents] = useState<CompletedQuickAgentInfo[]>([]);

  // Editor state
  const [editName, setEditName] = useState('');
  const [editCron, setEditCron] = useState('');
  const [editOrchestrator, setEditOrchestrator] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editFreeAgent, setEditFreeAgent] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editMissedRunPolicy, setEditMissedRunPolicy] = useState<MissedRunPolicy>('ignore');
  const [editExecutionMode, setEditExecutionMode] = useState<ExecutionMode>('quick');
  const [editTargetAgentId, setEditTargetAgentId] = useState('');
  const [durableAgents, setDurableAgents] = useState<AgentInfo[]>([]);
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
    const unsub = refreshSignal.subscribe(loadAutomations);
    return () => { clearInterval(iv); unsub(); };
  }, [loadAutomations]);

  // ── Load orchestrators ─────────────────────────────────────────────
  useEffect(() => {
    setOrchestrators(api.agents.listOrchestrators());
  }, [api]);

  // ── Load model options (filtered by orchestrator) ─────────────────
  useEffect(() => {
    api.agents.getModelOptions(undefined, editOrchestrator || undefined).then(setModelOptions);
  }, [api, editOrchestrator]);

  // ── Sync editor when selection changes ──────────────────────────────
  const selected = automations.find((a) => a.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setEditName(selected.name);
      setEditCron(selected.cronExpression);
      setEditOrchestrator(selected.orchestrator ?? '');
      setEditModel(selected.model);
      setEditFreeAgent(selected.freeAgentMode ?? false);
      setEditPrompt(selected.prompt);
      setEditEnabled(selected.enabled);
      setEditMissedRunPolicy(selected.missedRunPolicy ?? 'ignore');
      setEditExecutionMode(selected.executionMode ?? 'quick');
      setEditTargetAgentId(selected.targetAgentId ?? '');
      setCronError(null);
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load durable agents ─────────────────────────────────────────────
  useEffect(() => {
    const updateDurableAgents = () => {
      const all = api.agents.list();
      setDurableAgents(all.filter((a) => a.kind === 'durable'));
    };
    updateDurableAgents();
    const sub = api.agents.onAnyChange(updateDurableAgents);
    return () => sub.dispose();
  }, [api]);

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
      orchestrator: '',
      model: '',
      freeAgentMode: false,
      prompt: '',
      enabled: false,
      missedRunPolicy: 'ignore',
      executionMode: 'quick',
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
        ? { ...a, name: editName, cronExpression: editCron, orchestrator: editOrchestrator, model: editModel, freeAgentMode: editFreeAgent, prompt: editPrompt, enabled: editEnabled, missedRunPolicy: editMissedRunPolicy, executionMode: editExecutionMode, targetAgentId: editExecutionMode === 'durable' ? editTargetAgentId : undefined }
        : a,
    );
    await storage.write(AUTOMATIONS_KEY, next);
    setAutomations(next);
  }, [selectedId, automations, storage, editName, editCron, editOrchestrator, editModel, editFreeAgent, editPrompt, editEnabled, editMissedRunPolicy, editExecutionMode, editTargetAgentId]);

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

  const runNow = useCallback(async (id: string) => {
    await api.commands.execute('run-now', id);
    await loadAutomations();
    await loadRuns();
  }, [api, loadAutomations, loadRuns]);

  const deleteRun = useCallback(async (agentId: string) => {
    if (!selectedId) return;
    const raw = await storage.read(runsKey(selectedId));
    const current: RunRecord[] = Array.isArray(raw) ? raw : [];
    const next = current.filter((r) => r.agentId !== agentId);
    await storage.write(runsKey(selectedId), next);
    setRuns(next);
  }, [selectedId, storage]);

  const dismissRun = useCallback(async (agentId: string) => {
    if (!selectedId) return;
    const raw = await storage.read(runsKey(selectedId));
    const current: RunRecord[] = Array.isArray(raw) ? raw : [];
    const idx = current.findIndex((r) => r.agentId === agentId);
    if (idx === -1) return;
    current[idx] = { ...current[idx], status: 'failed', completedAt: Date.now() };
    await storage.write(runsKey(selectedId), current);
    setRuns([...current]);
    if (!current.some((r) => r.status === 'running')) {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedId);
        return next;
      });
    }
  }, [selectedId, storage]);

  // Stable refs for callbacks
  const actionsRef = useRef({ createAutomation, saveAutomation, deleteAutomation, toggleEnabled, runNow, deleteRun, dismissRun });
  actionsRef.current = { createAutomation, saveAutomation, deleteAutomation, toggleEnabled, runNow, deleteRun, dismissRun };

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: S.color.textTertiary, fontSize: 12 }}>
        Loading automations...
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div style={{ ...themeStyle, ...S.container }}>
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
                  background: 'var(--text-on-accent, #fff)',
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
            {/* Run Now */}
            <button
              style={{
                ...S.baseButton,
                background: S.color.successBg,
                color: S.color.success,
                border: `1px solid ${S.color.success}`,
                fontWeight: 500,
              }}
              onClick={() => actionsRef.current.runNow(selected.id)}
              title="Run this automation immediately (ignores schedule and enabled state)"
            >
              Run Now
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
            {/* Missed Runs */}
            <div>
              <label style={S.label}>If Runs Were Missed</label>
              <select
                style={{ ...S.baseInput, cursor: 'pointer' }}
                value={editMissedRunPolicy}
                onChange={(e) => setEditMissedRunPolicy(e.target.value as MissedRunPolicy)}
              >
                <option value="ignore">Do Nothing</option>
                <option value="run-once">Run Once (catch up with a single run)</option>
                <option value="run-all">Run All (up to 10 catch-up runs)</option>
              </select>
              <div style={{ fontSize: 10, color: S.color.textTertiary, marginTop: 4 }}>
                {editMissedRunPolicy === 'ignore' && 'Skipped runs are silently ignored'}
                {editMissedRunPolicy === 'run-once' && 'Fires one catch-up run when the app resumes'}
                {editMissedRunPolicy === 'run-all' && 'Fires up to 10 catch-up runs when the app resumes'}
              </div>
            </div>
            {/* Execution Mode */}
            <div>
              <label style={S.label}>Execution Mode</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['quick', 'durable'] as const).map((mode) => (
                  <button
                    key={mode}
                    style={{
                      padding: '4px 12px',
                      fontSize: 12,
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: editExecutionMode === mode ? S.color.blueBg : S.color.bgSurface,
                      color: editExecutionMode === mode ? S.color.blue : S.color.textSecondary,
                      border: editExecutionMode === mode
                        ? `1px solid ${S.color.blueBorder}`
                        : `1px solid ${S.color.borderSecondary}`,
                    }}
                    onClick={() => setEditExecutionMode(mode)}
                  >
                    {mode === 'quick' ? 'Quick Agent' : 'Durable Agent'}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: S.color.textTertiary, marginTop: 4 }}>
                {editExecutionMode === 'quick' && 'Spawns a new ephemeral agent for each run'}
                {editExecutionMode === 'durable' && 'Resumes an existing durable agent with the prompt as its mission'}
              </div>
            </div>
            {/* Durable Agent Picker */}
            {editExecutionMode === 'durable' && (
              <div>
                <label style={S.label}>Target Agent</label>
                <select
                  style={{ ...S.baseInput, cursor: 'pointer' }}
                  value={editTargetAgentId}
                  onChange={(e) => setEditTargetAgentId(e.target.value)}
                >
                  <option value="">Select a durable agent...</option>
                  {durableAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}{agent.branch ? ` (${agent.branch})` : ''}{agent.status === 'running' ? ' — busy' : ''}
                    </option>
                  ))}
                </select>
                {editTargetAgentId && (() => {
                  const target = durableAgents.find((a) => a.id === editTargetAgentId);
                  if (!target) return <div style={{ fontSize: 10, color: S.color.error, marginTop: 4 }}>Agent no longer available</div>;
                  return (
                    <div style={{ fontSize: 10, color: S.color.textTertiary, marginTop: 4 }}>
                      {target.worktreePath && <>Worktree: {target.worktreePath}<br /></>}
                      Status: {target.status}
                      {target.status === 'running' && <span style={{ color: S.color.warning }}> — will skip runs while busy</span>}
                    </div>
                  );
                })()}
                {durableAgents.length === 0 && (
                  <div style={{ fontSize: 10, color: S.color.textTertiary, marginTop: 4 }}>
                    No durable agents found in this project
                  </div>
                )}
              </div>
            )}
            {/* Orchestrator */}
            {editExecutionMode === 'quick' && orchestrators.length > 0 && (
              <div>
                <label style={S.label}>Orchestrator</label>
                <select
                  style={{ ...S.baseInput, cursor: 'pointer' }}
                  value={editOrchestrator}
                  onChange={(e) => {
                    setEditOrchestrator(e.target.value);
                    // Reset model when orchestrator changes since available models differ
                    setEditModel('');
                  }}
                >
                  <option value="">Default</option>
                  {orchestrators.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.displayName}{o.badge ? ` ${o.badge}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Model (quick mode only) */}
            {editExecutionMode === 'quick' && <div>
              <label style={S.label}>Model</label>
              <select
                style={{ ...S.baseInput, cursor: 'pointer' }}
                value={editModel}
                onChange={(e) => setEditModel(e.target.value)}
              >
                <option value="">Default</option>
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>}
            {/* Free Agent Mode (quick mode only) */}
            {editExecutionMode === 'quick' && <div>
              <label
                style={{ ...S.label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                onClick={() => setEditFreeAgent(!editFreeAgent)}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    border: `1px solid ${editFreeAgent ? S.color.accent : S.color.borderSecondary}`,
                    background: editFreeAgent ? S.color.accent : 'transparent',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                >
                  {editFreeAgent && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--text-on-accent, #fff)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                  )}
                </span>
                Free Agent Mode
              </label>
              <div style={{ fontSize: 10, color: S.color.textTertiary, marginTop: 2, marginLeft: 24 }}>
                Agent runs with full autonomy — no permission prompts
              </div>
            </div>}
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
                          <button
                            style={{
                              padding: '2px 8px', fontSize: 11, borderRadius: 4,
                              color: S.color.textSecondary,
                              border: `1px solid ${S.color.border}`,
                              background: 'transparent',
                              cursor: 'pointer',
                            }}
                            title="Mark this run as failed and clear the stuck state"
                            onClick={() => actionsRef.current.dismissRun(run.agentId)}
                          >
                            Dismiss
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            style={{
                              padding: '2px 8px', fontSize: 11, borderRadius: 4,
                              cursor: 'pointer',
                              background: expandedRunId === run.agentId ? S.color.accent : S.color.accentBg,
                              color: expandedRunId === run.agentId ? 'var(--text-on-accent, #fff)' : S.color.accent,
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
