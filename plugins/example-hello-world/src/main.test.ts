import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import { activate, MainPanel } from './main';
import { createMockContext, createMockAPI } from '@clubhouse/plugin-testing';
import type { PluginAPI, ScopedStorage } from '@clubhouse/plugin-types';

// ── Constants (must match main.tsx) ─────────────────────────────────────

const COUNTER_KEY = 'helloCounter';

// ── Helpers ─────────────────────────────────────────────────────────────

function createSpyStorage(): ScopedStorage & { _data: Map<string, unknown> } {
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
    getCount: (): string => {
      const span = container.querySelector('span');
      return span?.textContent || '';
    },
  };
}

/** Flush pending microtasks (storage reads resolve as microtasks). */
async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  });
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('MainPanel increment handler', () => {
  let api: PluginAPI;
  let projectLocalStorage: ReturnType<typeof createSpyStorage>;

  beforeEach(() => {
    projectLocalStorage = createSpyStorage();
    api = createMockAPI({
      storage: { projectLocal: projectLocalStorage },
    });
  });

  it('increments count by 1 on a single click', async () => {
    const { getButtonByText, getCount, unmount } = renderPanel(api);
    await flush();

    expect(getCount()).toBe('0');

    const btn = getButtonByText('Increment');
    act(() => { btn!.click(); });
    await flush();

    expect(getCount()).toBe('1');
    expect(projectLocalStorage.write).toHaveBeenCalledWith(COUNTER_KEY, 1);

    unmount();
  });

  it('increments by 2 on rapid double-click (no stale closure race)', async () => {
    const { getButtonByText, getCount, unmount } = renderPanel(api);
    await flush();

    expect(getCount()).toBe('0');

    const btn = getButtonByText('Increment');

    // Simulate rapid double-click: two clicks without waiting for re-render
    act(() => {
      btn!.click();
      btn!.click();
    });
    await flush();

    expect(getCount()).toBe('2');
    expect(projectLocalStorage.write).toHaveBeenCalledWith(COUNTER_KEY, 1);
    expect(projectLocalStorage.write).toHaveBeenCalledWith(COUNTER_KEY, 2);

    unmount();
  });

  it('persists count to storage on increment', async () => {
    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    const btn = getButtonByText('Increment');
    act(() => { btn!.click(); });
    await flush();

    expect(projectLocalStorage.write).toHaveBeenCalledTimes(1);
    expect(projectLocalStorage.write).toHaveBeenCalledWith(COUNTER_KEY, 1);

    unmount();
  });

  it('resets count to 0', async () => {
    const { getButtonByText, getCount, unmount } = renderPanel(api);
    await flush();

    // Increment first
    const incBtn = getButtonByText('Increment');
    act(() => { incBtn!.click(); });
    await flush();
    expect(getCount()).toBe('1');

    // Reset
    const resetBtn = getButtonByText('Reset');
    act(() => { resetBtn!.click(); });
    await flush();

    expect(getCount()).toBe('0');
    expect(projectLocalStorage.write).toHaveBeenCalledWith(COUNTER_KEY, 0);

    unmount();
  });

  it('loads persisted count on mount', async () => {
    projectLocalStorage._data.set(COUNTER_KEY, 5);

    const { getCount, unmount } = renderPanel(api);
    await flush();

    expect(getCount()).toBe('5');

    unmount();
  });

  it('handles string values from storage', async () => {
    projectLocalStorage._data.set(COUNTER_KEY, '3');

    const { getCount, unmount } = renderPanel(api);
    await flush();

    expect(getCount()).toBe('3');

    unmount();
  });
});

describe('activate()', () => {
  it('registers the greet command', () => {
    const ctx = createMockContext({ pluginId: 'example-hello-world' });
    const api = createMockAPI();

    activate(ctx, api);

    expect(ctx.subscriptions).toHaveLength(1);
    expect(api.commands.register).toHaveBeenCalledWith(
      'hello-world.greet',
      expect.any(Function),
    );
  });
});
