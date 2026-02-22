import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import { activate, MainPanel } from './main';
import { createMockContext, createMockAPI } from '@clubhouse/plugin-testing';
import type { PluginAPI, ScopedStorage } from '@clubhouse/plugin-types';

// ── Constants (must match main.tsx) ─────────────────────────────────────

const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;
const SESSIONS_KEY = 'pomodoroSessions';
const TIMER_STATE_KEY = 'pomodoroTimerState';

// ── Helpers ─────────────────────────────────────────────────────────────

function createMapStorage(): ScopedStorage & { _data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    _data: data,
    read: vi.fn(async (key: string) => data.get(key)),
    write: vi.fn(async (key: string, value: unknown) => { data.set(key, value); }),
    delete: vi.fn(async (key: string) => { data.delete(key); }),
    list: vi.fn(async () => [...data.keys()]),
  };
}

/** Mount the MainPanel into a DOM container and return helpers. */
function renderPanel(api: PluginAPI) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = ReactDOM.createRoot(container);

  act(() => {
    root.render(React.createElement(MainPanel, { api }));
  });

  return {
    container,
    unmount: () => {
      act(() => { root.unmount(); });
      container.remove();
    },
    getButtonByText: (text: string): HTMLButtonElement | null => {
      const buttons = container.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.includes(text)) return btn;
      }
      return null;
    },
    getText: () => container.textContent || '',
  };
}

/** Flush pending microtasks (storage reads resolve as microtasks). */
async function flush() {
  // Use multiple microtask ticks to let promise chains settle
  await act(async () => {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  });
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('pomodoro timer persistence', () => {
  let api: PluginAPI;
  let globalStorage: ReturnType<typeof createMapStorage>;

  beforeEach(() => {
    vi.useFakeTimers();
    globalStorage = createMapStorage();
    api = createMockAPI({
      storage: { global: globalStorage },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists timer state to storage when starting a work timer', async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const { unmount } = renderPanel(api);
    await flush();

    const btn = document.querySelector('button');
    expect(btn?.textContent).toContain('Start Work');

    act(() => { btn!.click(); });

    expect(globalStorage.write).toHaveBeenCalledWith(TIMER_STATE_KEY, {
      phase: 'work',
      startedAt: now,
      durationMs: WORK_DURATION * 1000,
    });

    unmount();
  });

  it('persists timer state when starting a break timer', async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    const btn = getButtonByText('Start Break');
    act(() => { btn!.click(); });

    expect(globalStorage.write).toHaveBeenCalledWith(TIMER_STATE_KEY, {
      phase: 'break',
      startedAt: now,
      durationMs: BREAK_DURATION * 1000,
    });

    unmount();
  });

  it('clears timer state from storage when stop is called', async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    // Start a timer
    const startBtn = getButtonByText('Start Work');
    act(() => { startBtn!.click(); });

    // Now stop it
    const stopBtn = getButtonByText('Stop');
    act(() => { stopBtn!.click(); });

    expect(globalStorage.delete).toHaveBeenCalledWith(TIMER_STATE_KEY);

    unmount();
  });

  it('resumes an active timer on mount when time remains', async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const startedAt = now - 10 * 60 * 1000; // started 10 min ago
    globalStorage._data.set(TIMER_STATE_KEY, {
      phase: 'work',
      startedAt,
      durationMs: WORK_DURATION * 1000,
    });

    const { getText, getButtonByText, unmount } = renderPanel(api);
    await flush();

    // Timer should be active (showing Stop button, not Start)
    expect(getButtonByText('Stop')).not.toBeNull();
    expect(getButtonByText('Start Work')).toBeNull();

    // Should show roughly 15 minutes remaining
    const text = getText();
    expect(text).toContain('15:00');

    // Storage should NOT have been deleted (timer still active)
    expect(globalStorage.delete).not.toHaveBeenCalledWith(TIMER_STATE_KEY);

    unmount();
  });

  it('records session and notifies when work timer expired while away', async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const startedAt = now - 30 * 60 * 1000; // started 30 min ago (expired)
    globalStorage._data.set(TIMER_STATE_KEY, {
      phase: 'work',
      startedAt,
      durationMs: WORK_DURATION * 1000,
    });

    const { unmount } = renderPanel(api);
    await flush();

    // Should have cleared the expired timer state
    expect(globalStorage.delete).toHaveBeenCalledWith(TIMER_STATE_KEY);
    // Should have shown a completion notice
    expect(api.ui.showNotice).toHaveBeenCalledWith('Pomodoro complete! Time for a break.');
    // Should have recorded the session (written to SESSIONS_KEY)
    expect(globalStorage.write).toHaveBeenCalledWith(SESSIONS_KEY, expect.any(Array));

    unmount();
  });

  it('notifies when break timer expired while away', async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const startedAt = now - 10 * 60 * 1000; // started 10 min ago (break is 5 min)
    globalStorage._data.set(TIMER_STATE_KEY, {
      phase: 'break',
      startedAt,
      durationMs: BREAK_DURATION * 1000,
    });

    const { unmount } = renderPanel(api);
    await flush();

    expect(globalStorage.delete).toHaveBeenCalledWith(TIMER_STATE_KEY);
    expect(api.ui.showNotice).toHaveBeenCalledWith('Break over! Ready for another round?');

    unmount();
  });

  it('stays idle on mount when no timer state is saved', async () => {
    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    // Should show start buttons (idle state)
    expect(getButtonByText('Start Work')).not.toBeNull();
    expect(globalStorage.delete).not.toHaveBeenCalledWith(TIMER_STATE_KEY);
    expect(api.ui.showNotice).not.toHaveBeenCalled();

    unmount();
  });

  it('clears timer state when work timer naturally completes', async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    // Start work timer
    const startBtn = getButtonByText('Start Work');
    act(() => { startBtn!.click(); });
    (globalStorage.delete as ReturnType<typeof vi.fn>).mockClear();

    // Advance time past the work duration
    act(() => { vi.advanceTimersByTime(WORK_DURATION * 1000 + 1000); });
    await flush();

    expect(globalStorage.delete).toHaveBeenCalledWith(TIMER_STATE_KEY);
    expect(api.ui.showNotice).toHaveBeenCalledWith('Pomodoro complete! Time for a break.');

    unmount();
  });

  it('ignores invalid timer state in storage', async () => {
    globalStorage._data.set(TIMER_STATE_KEY, { invalid: true });

    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    // Should stay idle — start buttons visible
    expect(getButtonByText('Start Work')).not.toBeNull();
    expect(globalStorage.delete).not.toHaveBeenCalledWith(TIMER_STATE_KEY);
    expect(api.ui.showNotice).not.toHaveBeenCalled();

    unmount();
  });
});

describe('pomodoro activate()', () => {
  it('registers start and stop commands', () => {
    const ctx = createMockContext({ pluginId: 'pomodoro' });
    const api = createMockAPI();

    activate(ctx, api);

    expect(ctx.subscriptions).toHaveLength(2);
  });
});
