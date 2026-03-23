const React = globalThis.React;
const { useState, useEffect, useCallback } = React;

import type { PluginAPI, PluginContext } from '@clubhouse/plugin-types';
import type { DailyNote, ScheduleBlock, Todo, Reminder } from './types';
import { todayKey, generateId, formatTime, isOverdue, sortSchedule, currentBlock } from './types';
import { ensureToday, saveNote } from './storage';
import * as S from './styles';

// ── Refresh signal ──────────────────────────────────────────────────────

const refreshListeners = new Set<() => void>();

export function onRefresh(fn: () => void): () => void {
  refreshListeners.add(fn);
  return () => { refreshListeners.delete(fn); };
}

function triggerRefresh(): void {
  for (const fn of refreshListeners) fn();
}

// ── activate() ──────────────────────────────────────────────────────────

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.commands.register('daily-admin.refresh', () => {
    triggerRefresh();
    api.ui.showNotice('Daily Admin refreshed');
  });

  api.commands.register('daily-admin.new-todo', async () => {
    const task = await api.ui.showInput('New to-do:');
    if (!task) return;
    try {
      const today = todayKey();
      const note = await ensureToday(api.storage.global, today);
      note.todos.push({ id: generateId(), task, detail: '', linked: '', dueDate: null, state: 'to-do' });
      await saveNote(api.storage.global, note);
      triggerRefresh();
      api.ui.showNotice('To-do added');
    } catch (err) {
      api.ui.showError(`Failed to add to-do: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  api.commands.register('daily-admin.new-schedule', async () => {
    const input = await api.ui.showInput('Schedule block (e.g. "09:00 Standup"):');
    if (!input) return;
    try {
      const spaceIdx = input.indexOf(' ');
      const time = spaceIdx > 0 ? input.slice(0, spaceIdx) : input;
      const event = spaceIdx > 0 ? input.slice(spaceIdx + 1) : 'Untitled';
      const today = todayKey();
      const note = await ensureToday(api.storage.global, today);
      note.schedule.push({ id: generateId(), time, event, detail: '', people: '', actionItems: '' });
      await saveNote(api.storage.global, note);
      triggerRefresh();
      api.ui.showNotice('Schedule block added');
    } catch (err) {
      api.ui.showError(`Failed to add schedule block: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

export function deactivate(): void {}

// ── Schedule Section ────────────────────────────────────────────────────

function ScheduleSection({ schedule, now }: { schedule: ScheduleBlock[]; now: Date }) {
  const sorted = sortSchedule(schedule);
  const active = currentBlock(schedule, now);

  return (
    <div>
      <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: S.color.textSecondary, margin: '0 0 8px 0' }}>
        Schedule
      </h3>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: S.color.textTertiary, fontStyle: 'italic' }}>No schedule blocks today</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sorted.map((block) => {
            const isActive = active?.id === block.id;
            return (
              <div
                key={block.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: isActive ? S.color.bgTertiary : 'transparent',
                  borderLeft: isActive ? `3px solid ${S.color.accent}` : '3px solid transparent',
                }}
              >
                <span style={{ fontSize: 12, color: S.color.textTertiary, fontFamily: S.font.mono, minWidth: 60 }}>
                  {formatTime(block.time)}
                </span>
                <span style={{ fontSize: 12, color: isActive ? S.color.text : S.color.textSecondary, fontWeight: isActive ? 500 : 400 }}>
                  {block.event}
                </span>
                {block.detail && (
                  <span style={{ fontSize: 11, color: S.color.textTertiary, marginLeft: 'auto' }}>{block.detail}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Todos Section ───────────────────────────────────────────────────────

const STATE_ICONS: Record<string, string> = {
  'to-do': '[ ]',
  'done': '[x]',
  'carried-fwd': '[>]',
  'cancelled': '[-]',
};

function TodosSection({ todos, today, onToggle }: { todos: Todo[]; today: string; onToggle: (id: string) => void }) {
  const active = todos.filter((t) => t.state !== 'done' && t.state !== 'cancelled');
  const completed = todos.filter((t) => t.state === 'done' || t.state === 'cancelled');

  return (
    <div>
      <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: S.color.textSecondary, margin: '0 0 8px 0' }}>
        To-Dos
      </h3>
      {todos.length === 0 ? (
        <div style={{ fontSize: 12, color: S.color.textTertiary, fontStyle: 'italic' }}>No to-dos today</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {active.map((todo) => {
            const overdue = isOverdue(todo, today);
            return (
              <div
                key={todo.id}
                onClick={() => onToggle(todo.id)}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '4px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  alignItems: 'baseline',
                }}
              >
                <span style={{ fontSize: 12, fontFamily: S.font.mono, color: todo.state === 'carried-fwd' ? S.color.textWarning : S.color.textSecondary }}>
                  {STATE_ICONS[todo.state]}
                </span>
                <span style={{ fontSize: 12, color: overdue ? S.color.textError : S.color.text }}>
                  {todo.task}
                </span>
                {todo.state === 'carried-fwd' && (
                  <span style={{ fontSize: 10, color: S.color.textWarning }}>(fwd)</span>
                )}
                {todo.dueDate && (
                  <span style={{ fontSize: 10, color: overdue ? S.color.textError : S.color.textTertiary, marginLeft: 'auto' }}>
                    {todo.dueDate}
                  </span>
                )}
              </div>
            );
          })}
          {completed.map((todo) => (
            <div
              key={todo.id}
              style={{
                display: 'flex',
                gap: 8,
                padding: '4px 8px',
                borderRadius: 4,
                opacity: 0.5,
              }}
            >
              <span style={{ fontSize: 12, fontFamily: S.font.mono, color: S.color.textTertiary }}>
                {STATE_ICONS[todo.state]}
              </span>
              <span style={{ fontSize: 12, color: S.color.textTertiary, textDecoration: 'line-through' }}>
                {todo.task}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reminders Section ───────────────────────────────────────────────────

function RemindersSection({ reminders, onDismiss }: { reminders: Reminder[]; onDismiss: (id: string) => void }) {
  const visible = reminders.filter((r) => !r.dismissed);
  if (visible.length === 0) return null;

  return (
    <div>
      <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: S.color.textSecondary, margin: '0 0 8px 0' }}>
        Things to Remember
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visible.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 4,
              background: S.color.bgSecondary,
              border: `1px solid ${S.color.border}`,
            }}
          >
            <span style={{ fontSize: 12, color: S.color.textSecondary, flex: 1 }}>{r.text}</span>
            <button
              onClick={() => onDismiss(r.id)}
              style={{
                background: 'none',
                border: 'none',
                color: S.color.textTertiary,
                cursor: 'pointer',
                fontSize: 14,
                padding: '0 4px',
              }}
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MainPanel ───────────────────────────────────────────────────────────

export function MainPanel({ api }: { api: PluginAPI }) {
  const [note, setNote] = useState<DailyNote | null>(null);
  const [now, setNow] = useState(new Date());
  const today = todayKey();

  // Load today's note
  const loadData = useCallback(async () => {
    const n = await ensureToday(api.storage.global, today);
    setNote(n);
  }, [api, today]);

  useEffect(() => {
    loadData();
    return onRefresh(loadData);
  }, [loadData]);

  // Update clock every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleTodo = useCallback(async (id: string) => {
    if (!note) return;
    const updated = {
      ...note,
      todos: note.todos.map((t) =>
        t.id === id ? { ...t, state: t.state === 'done' ? 'to-do' as const : 'done' as const } : t
      ),
    };
    setNote(updated);
    await saveNote(api.storage.global, updated);
  }, [note, api]);

  const handleDismissReminder = useCallback(async (id: string) => {
    if (!note) return;
    const updated = {
      ...note,
      reminders: note.reminders.map((r) =>
        r.id === id ? { ...r, dismissed: true } : r
      ),
    };
    setNote(updated);
    await saveNote(api.storage.global, updated);
  }, [note, api]);

  if (!note) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: S.color.textTertiary, fontFamily: S.font.family }}>
        Loading...
      </div>
    );
  }

  const dayName = new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: S.color.bg, fontFamily: S.font.family, overflow: 'auto' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: `1px solid ${S.color.border}`,
        background: S.color.bgSecondary,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: S.color.text }}>
          Today: {dayName}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        padding: 20,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr auto',
        gap: 20,
        overflow: 'auto',
      }}>
        {/* Schedule (left) */}
        <ScheduleSection schedule={note.schedule} now={now} />

        {/* Todos (right) */}
        <TodosSection todos={note.todos} today={today} onToggle={handleToggleTodo} />

        {/* Reminders (full width bottom) */}
        <div style={{ gridColumn: '1 / -1' }}>
          <RemindersSection reminders={note.reminders} onDismiss={handleDismissReminder} />
        </div>
      </div>
    </div>
  );
}
