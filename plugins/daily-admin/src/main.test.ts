import { describe, it, expect, vi, beforeEach } from 'vitest';
import { activate, onRefresh } from './main';
import type { PluginContext, PluginAPI, ScopedStorage } from '@clubhouse/plugin-types';

function createMockStorage(): ScopedStorage {
  const data: Record<string, unknown> = {};
  return {
    read: vi.fn(async (key: string) => data[key] ?? null),
    write: vi.fn(async (key: string, value: unknown) => { data[key] = value; }),
    delete: vi.fn(async (key: string) => { delete data[key]; }),
    list: vi.fn(async () => Object.keys(data)),
  };
}

function createMockAPI(): PluginAPI {
  return {
    commands: {
      register: vi.fn(),
      execute: vi.fn(),
      registerWithHotkey: vi.fn(),
      getBinding: vi.fn(),
      clearBinding: vi.fn(),
    },
    ui: {
      showNotice: vi.fn(),
      showError: vi.fn(),
      showConfirm: vi.fn(),
      showInput: vi.fn(),
      openExternalUrl: vi.fn(),
    },
    storage: {
      global: createMockStorage(),
      project: createMockStorage(),
      projectLocal: createMockStorage(),
    },
  } as unknown as PluginAPI;
}

function createMockContext(): PluginContext {
  return {
    pluginId: 'daily-admin',
    pluginPath: '/test',
    scope: 'app',
    subscriptions: [],
    settings: {},
  };
}

describe('activate', () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockAPI();
  });

  it('registers three commands', () => {
    activate(createMockContext(), api);
    expect(api.commands.register).toHaveBeenCalledTimes(3);
    const calls = (api.commands.register as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toBe('daily-admin.refresh');
    expect(calls[1][0]).toBe('daily-admin.new-todo');
    expect(calls[2][0]).toBe('daily-admin.new-schedule');
  });

  it('refresh command triggers refresh listeners and shows notice', () => {
    activate(createMockContext(), api);
    const refreshHandler = (api.commands.register as ReturnType<typeof vi.fn>).mock.calls[0][1];

    let refreshed = false;
    const unsub = onRefresh(() => { refreshed = true; });
    refreshHandler();
    expect(refreshed).toBe(true);
    expect(api.ui.showNotice).toHaveBeenCalledWith('Daily Admin refreshed');
    unsub();
  });

  it('new-todo command adds todo and triggers refresh', async () => {
    activate(createMockContext(), api);
    const handler = (api.commands.register as ReturnType<typeof vi.fn>).mock.calls[1][1];
    (api.ui.showInput as ReturnType<typeof vi.fn>).mockResolvedValue('Test task');

    let refreshed = false;
    const unsub = onRefresh(() => { refreshed = true; });
    await handler();
    expect(api.ui.showNotice).toHaveBeenCalledWith('To-do added');
    expect(refreshed).toBe(true);
    unsub();
  });

  it('new-todo command does nothing when input is cancelled', async () => {
    activate(createMockContext(), api);
    const handler = (api.commands.register as ReturnType<typeof vi.fn>).mock.calls[1][1];
    (api.ui.showInput as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await handler();
    expect(api.ui.showNotice).not.toHaveBeenCalled();
  });

  it('new-todo command shows error on storage failure', async () => {
    activate(createMockContext(), api);
    const handler = (api.commands.register as ReturnType<typeof vi.fn>).mock.calls[1][1];
    (api.ui.showInput as ReturnType<typeof vi.fn>).mockResolvedValue('Test task');
    (api.storage.global.write as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Storage full'));

    await handler();
    expect(api.ui.showError).toHaveBeenCalledWith(expect.stringContaining('Storage full'));
  });

  it('new-schedule command adds block and triggers refresh', async () => {
    activate(createMockContext(), api);
    const handler = (api.commands.register as ReturnType<typeof vi.fn>).mock.calls[2][1];
    (api.ui.showInput as ReturnType<typeof vi.fn>).mockResolvedValue('09:00 Standup');

    let refreshed = false;
    const unsub = onRefresh(() => { refreshed = true; });
    await handler();
    expect(api.ui.showNotice).toHaveBeenCalledWith('Schedule block added');
    expect(refreshed).toBe(true);
    unsub();
  });

  it('new-schedule command does nothing when input is cancelled', async () => {
    activate(createMockContext(), api);
    const handler = (api.commands.register as ReturnType<typeof vi.fn>).mock.calls[2][1];
    (api.ui.showInput as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await handler();
    expect(api.ui.showNotice).not.toHaveBeenCalled();
  });

  it('new-schedule command shows error on storage failure', async () => {
    activate(createMockContext(), api);
    const handler = (api.commands.register as ReturnType<typeof vi.fn>).mock.calls[2][1];
    (api.ui.showInput as ReturnType<typeof vi.fn>).mockResolvedValue('10:00 Meeting');
    (api.storage.global.write as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Disk error'));

    await handler();
    expect(api.ui.showError).toHaveBeenCalledWith(expect.stringContaining('Disk error'));
  });
});

describe('onRefresh', () => {
  it('returns unsubscribe function', () => {
    let count = 0;
    const unsub = onRefresh(() => { count++; });
    unsub();
    // After unsub, should not fire (no way to trigger externally without activate)
    expect(count).toBe(0);
  });
});
