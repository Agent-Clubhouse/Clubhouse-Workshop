import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import ReactDOM from "react-dom/client";
import { act } from "react";
import { activate, MainPanel, PomodoroPinnedWidget, PomodoroFullWidget, formatTime, todayKey, isTimerState } from "./main";
import type { TimerState } from "./main";
import { createMockContext, createMockAPI } from "@clubhouse/plugin-testing";
import type { PluginAPI, ScopedStorage } from "@clubhouse/plugin-types";
import manifest from "../manifest.json";

// ── Constants (must match main.tsx defaults) ────────────────────────────

const DEFAULT_WORK = 25 * 60;
const DEFAULT_SHORT_BREAK = 5 * 60;
const SESSIONS_KEY = "pomodoroSessions";
const TIMER_STATE_KEY = "pomodoroTimerState";

// ── Helpers ─────────────────────────────────────────────────────────────

function createMapStorage(): ScopedStorage & { _data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    _data: data,
    read: vi.fn(async (key: string) => data.get(key)),
    write: vi.fn(async (key: string, value: unknown) => {
      data.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      data.delete(key);
    }),
    list: vi.fn(async () => [...data.keys()]),
  };
}

function renderPanel(api: PluginAPI) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = ReactDOM.createRoot(container);

  act(() => {
    root.render(React.createElement(MainPanel, { api }));
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    getButtonByText: (text: string): HTMLButtonElement | null => {
      const buttons = container.querySelectorAll("button");
      for (const btn of buttons) {
        if (btn.textContent?.includes(text)) return btn;
      }
      return null;
    },
    getText: () => container.textContent || "",
  };
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  });
}

// ── Unit tests for helpers ──────────────────────────────────────────────

describe("formatTime", () => {
  it("formats zero seconds", () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("formats minutes and seconds with padding", () => {
    expect(formatTime(65)).toBe("01:05");
  });

  it("formats 25 minutes", () => {
    expect(formatTime(25 * 60)).toBe("25:00");
  });
});

describe("todayKey", () => {
  it("returns an ISO date string", () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isTimerState", () => {
  it("validates a correct work timer state", () => {
    expect(isTimerState({ phase: "work", startedAt: 1000, durationMs: 2000 })).toBe(true);
  });

  it("validates a correct break timer state", () => {
    expect(isTimerState({ phase: "break", startedAt: 1000, durationMs: 2000 })).toBe(true);
  });

  it("rejects null", () => {
    expect(isTimerState(null)).toBe(false);
  });

  it("rejects invalid phase", () => {
    expect(isTimerState({ phase: "idle", startedAt: 1000, durationMs: 2000 })).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(isTimerState({ phase: "work" })).toBe(false);
  });
});

// ── Timer persistence tests ─────────────────────────────────────────────

describe("pomodoro timer persistence", () => {
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

  it("persists timer state when starting a work timer", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const { unmount } = renderPanel(api);
    await flush();

    const btn = document.querySelector("button");
    expect(btn?.textContent).toContain("Start Work");

    act(() => {
      btn!.click();
    });

    expect(globalStorage.write).toHaveBeenCalledWith(TIMER_STATE_KEY, {
      phase: "work",
      startedAt: now,
      durationMs: DEFAULT_WORK * 1000,
    });

    unmount();
  });

  it("persists timer state when starting a short break", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    const btn = getButtonByText("Short Break");
    act(() => {
      btn!.click();
    });

    expect(globalStorage.write).toHaveBeenCalledWith(TIMER_STATE_KEY, {
      phase: "break",
      startedAt: now,
      durationMs: DEFAULT_SHORT_BREAK * 1000,
    });

    unmount();
  });

  it("clears timer state when stop is called", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    const startBtn = getButtonByText("Start Work");
    act(() => {
      startBtn!.click();
    });

    const stopBtn = getButtonByText("Stop");
    act(() => {
      stopBtn!.click();
    });

    expect(globalStorage.delete).toHaveBeenCalledWith(TIMER_STATE_KEY);

    unmount();
  });

  it("resumes an active timer on mount when time remains", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const startedAt = now - 10 * 60 * 1000; // started 10 min ago
    globalStorage._data.set(TIMER_STATE_KEY, {
      phase: "work",
      startedAt,
      durationMs: DEFAULT_WORK * 1000,
    } satisfies TimerState);

    const { getText, getButtonByText, unmount } = renderPanel(api);
    await flush();

    expect(getButtonByText("Stop")).not.toBeNull();
    expect(getButtonByText("Start Work")).toBeNull();

    const text = getText();
    expect(text).toContain("15:00");

    expect(globalStorage.delete).not.toHaveBeenCalledWith(TIMER_STATE_KEY);

    unmount();
  });

  it("records session and notifies when work timer expired while away", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const startedAt = now - 30 * 60 * 1000; // started 30 min ago (expired)
    globalStorage._data.set(TIMER_STATE_KEY, {
      phase: "work",
      startedAt,
      durationMs: DEFAULT_WORK * 1000,
    } satisfies TimerState);

    const { unmount } = renderPanel(api);
    await flush();

    expect(globalStorage.delete).toHaveBeenCalledWith(TIMER_STATE_KEY);
    expect(api.ui.showNotice).toHaveBeenCalledWith(
      "Pomodoro complete! Time for a break.",
    );
    expect(globalStorage.write).toHaveBeenCalledWith(
      SESSIONS_KEY,
      expect.any(Array),
    );

    unmount();
  });

  it("records session with correct date and count", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    // Start and complete a work timer
    act(() => {
      getButtonByText("Start Work")!.click();
    });
    act(() => {
      vi.advanceTimersByTime(DEFAULT_WORK * 1000 + 1000);
    });
    await flush();

    // Verify the session record content
    const writeCall = (globalStorage.write as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[0] === SESSIONS_KEY,
    );
    expect(writeCall).toBeDefined();
    const records = writeCall![1] as Array<{ date: string; completedWork: number }>;
    expect(records).toHaveLength(1);
    expect(records[0].date).toBe(new Date(now).toISOString().split("T")[0]);
    expect(records[0].completedWork).toBe(1);

    unmount();
  });

  it("notifies when break timer expired while away", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const startedAt = now - 10 * 60 * 1000; // started 10 min ago (break is 5 min)
    globalStorage._data.set(TIMER_STATE_KEY, {
      phase: "break",
      startedAt,
      durationMs: DEFAULT_SHORT_BREAK * 1000,
    } satisfies TimerState);

    const { unmount } = renderPanel(api);
    await flush();

    expect(globalStorage.delete).toHaveBeenCalledWith(TIMER_STATE_KEY);
    expect(api.ui.showNotice).toHaveBeenCalledWith(
      "Break over! Ready for another round?",
    );

    unmount();
  });

  it("stays idle on mount when no timer state is saved", async () => {
    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    expect(getButtonByText("Start Work")).not.toBeNull();
    expect(globalStorage.delete).not.toHaveBeenCalledWith(TIMER_STATE_KEY);
    expect(api.ui.showNotice).not.toHaveBeenCalled();

    unmount();
  });

  it("clears timer state when work timer naturally completes", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    const startBtn = getButtonByText("Start Work");
    act(() => {
      startBtn!.click();
    });
    (globalStorage.delete as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      vi.advanceTimersByTime(DEFAULT_WORK * 1000 + 1000);
    });
    await flush();

    expect(globalStorage.delete).toHaveBeenCalledWith(TIMER_STATE_KEY);
    expect(api.ui.showNotice).toHaveBeenCalledWith(
      "Pomodoro complete! Time for a break.",
    );

    unmount();
  });

  it("clears timer state when break timer naturally completes", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const { getButtonByText, getText, unmount } = renderPanel(api);
    await flush();

    // Start a short break
    const breakBtn = getButtonByText("Short Break");
    act(() => {
      breakBtn!.click();
    });
    (globalStorage.delete as ReturnType<typeof vi.fn>).mockClear();

    // Advance past break duration
    act(() => {
      vi.advanceTimersByTime(DEFAULT_SHORT_BREAK * 1000 + 1000);
    });
    await flush();

    expect(globalStorage.delete).toHaveBeenCalledWith(TIMER_STATE_KEY);
    expect(api.ui.showNotice).toHaveBeenCalledWith(
      "Break over! Ready for another round?",
    );
    // Should be back to idle showing work duration
    expect(getButtonByText("Start Work")).not.toBeNull();

    unmount();
  });

  it("ignores invalid timer state in storage", async () => {
    globalStorage._data.set(TIMER_STATE_KEY, { invalid: true });

    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    expect(getButtonByText("Start Work")).not.toBeNull();
    expect(globalStorage.delete).not.toHaveBeenCalledWith(TIMER_STATE_KEY);
    expect(api.ui.showNotice).not.toHaveBeenCalled();

    unmount();
  });
});

// ── Long break cycle tests ──────────────────────────────────────────────

describe("long break cycle", () => {
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

  it("shows long break button after cycle-count sessions", async () => {
    const key = new Date().toISOString().split("T")[0];
    globalStorage._data.set(SESSIONS_KEY, [
      { date: key, completedWork: 4, completedBreaks: 0 },
    ]);

    const { getButtonByText, getText, unmount } = renderPanel(api);
    await flush();

    expect(getButtonByText("Long Break")).not.toBeNull();
    expect(getButtonByText("Short Break")).toBeNull();
    expect(getText()).toContain("take a long break");

    unmount();
  });

  it("shows short break button when not at cycle boundary", async () => {
    const key = new Date().toISOString().split("T")[0];
    globalStorage._data.set(SESSIONS_KEY, [
      { date: key, completedWork: 3, completedBreaks: 0 },
    ]);

    const { getButtonByText, unmount } = renderPanel(api);
    await flush();

    expect(getButtonByText("Short Break")).not.toBeNull();
    expect(getButtonByText("Long Break")).toBeNull();

    unmount();
  });
});

// ── Session dots tests ──────────────────────────────────────────────────

describe("session visualization", () => {
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

  it("shows no-sessions message when count is zero", async () => {
    const { getText, unmount } = renderPanel(api);
    await flush();

    expect(getText()).toContain("No sessions yet today");

    unmount();
  });

  it("shows session count text for completed sessions", async () => {
    const key = new Date().toISOString().split("T")[0];
    globalStorage._data.set(SESSIONS_KEY, [
      { date: key, completedWork: 3, completedBreaks: 0 },
    ]);

    const { getText, unmount } = renderPanel(api);
    await flush();

    expect(getText()).toContain("3 sessions today");

    unmount();
  });

  it("renders correct number of session dot elements", async () => {
    const key = new Date().toISOString().split("T")[0];
    globalStorage._data.set(SESSIONS_KEY, [
      { date: key, completedWork: 5, completedBreaks: 0 },
    ]);

    const { container, unmount } = renderPanel(api);
    await flush();

    // Session dots are spans with border-radius 50% and a title starting with "Session"
    const dots = container.querySelectorAll("span[title^='Session']");
    expect(dots).toHaveLength(5);
    // 4th dot should be a long break marker (default cycle=4)
    expect(dots[3].getAttribute("title")).toContain("long break");
    // 5th dot should not be a long break marker
    expect(dots[4].getAttribute("title")).not.toContain("long break");

    unmount();
  });

  it("caps dots at 20 and shows overflow text", async () => {
    const key = new Date().toISOString().split("T")[0];
    globalStorage._data.set(SESSIONS_KEY, [
      { date: key, completedWork: 25, completedBreaks: 0 },
    ]);

    const { container, getText, unmount } = renderPanel(api);
    await flush();

    const dots = container.querySelectorAll("span[title^='Session']");
    expect(dots).toHaveLength(20);
    expect(getText()).toContain("+5");

    unmount();
  });

  it("shows singular session text", async () => {
    const key = new Date().toISOString().split("T")[0];
    globalStorage._data.set(SESSIONS_KEY, [
      { date: key, completedWork: 1, completedBreaks: 0 },
    ]);

    const { getText, unmount } = renderPanel(api);
    await flush();

    expect(getText()).toContain("1 session today");
    // Should not show "1 sessions"
    expect(getText()).not.toContain("1 sessions");

    unmount();
  });
});

// ── Inline duration controls ────────────────────────────────────────────

describe("inline duration controls", () => {
  let api: PluginAPI;
  let globalStorage: ReturnType<typeof createMapStorage>;
  let settingsStore: Map<string, unknown>;
  let settingsListeners: Array<(key: string, value: unknown) => void>;

  function createStoreBackedSettings() {
    settingsStore = new Map<string, unknown>();
    settingsListeners = [];
    return {
      get: vi.fn((key: string) => settingsStore.get(key)),
      getAll: vi.fn(() => Object.fromEntries(settingsStore)),
      set: vi.fn((key: string, value: unknown) => {
        settingsStore.set(key, value);
        settingsListeners.forEach((fn) => fn(key, value));
      }),
      onChange: vi.fn((cb: (key: string, value: unknown) => void) => {
        settingsListeners.push(cb);
        return { dispose: () => { settingsListeners = settingsListeners.filter((l) => l !== cb); } };
      }),
    };
  }

  function getByAriaLabel(container: HTMLElement, label: string): HTMLElement | null {
    return container.querySelector(`[aria-label="${label}"]`);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    globalStorage = createMapStorage();
    const settings = createStoreBackedSettings();
    api = createMockAPI({
      storage: { global: globalStorage },
      settings,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows gear button when idle", async () => {
    const { container, unmount } = renderPanel(api);
    await flush();

    expect(getByAriaLabel(container, "Timer settings")).not.toBeNull();
    unmount();
  });

  it("hides gear button when timer is running", async () => {
    const { container, getButtonByText, unmount } = renderPanel(api);
    await flush();

    act(() => {
      getButtonByText("Start Work")!.click();
    });

    expect(getByAriaLabel(container, "Timer settings")).toBeNull();
    unmount();
  });

  it("toggles settings section on gear click", async () => {
    const { container, unmount } = renderPanel(api);
    await flush();

    const gear = getByAriaLabel(container, "Timer settings")!;

    // Open
    act(() => { gear.click(); });
    expect(getByAriaLabel(container, "Decrease work")).not.toBeNull();
    expect(getByAriaLabel(container, "Decrease short break")).not.toBeNull();
    expect(getByAriaLabel(container, "Decrease long break")).not.toBeNull();

    // Close
    act(() => { gear.click(); });
    expect(getByAriaLabel(container, "Decrease work")).toBeNull();

    unmount();
  });

  it("increments work duration via + button", async () => {
    const { container, unmount } = renderPanel(api);
    await flush();

    act(() => { getByAriaLabel(container, "Timer settings")!.click(); });
    act(() => { getByAriaLabel(container, "Increase work")!.click(); });

    expect(api.settings.set).toHaveBeenCalledWith("workDuration", 26);
    unmount();
  });

  it("decrements short break duration via - button", async () => {
    const { container, unmount } = renderPanel(api);
    await flush();

    act(() => { getByAriaLabel(container, "Timer settings")!.click(); });
    act(() => { getByAriaLabel(container, "Decrease short break")!.click(); });

    expect(api.settings.set).toHaveBeenCalledWith("shortBreakDuration", 4);
    unmount();
  });

  it("disables decrement button at minimum value", async () => {
    settingsStore.set("shortBreakDuration", 1);
    const { container, unmount } = renderPanel(api);
    await flush();

    act(() => { getByAriaLabel(container, "Timer settings")!.click(); });

    const decreaseBtn = getByAriaLabel(container, "Decrease short break") as HTMLButtonElement;
    expect(decreaseBtn.disabled).toBe(true);
    unmount();
  });

  it("hides settings section when timer starts", async () => {
    const { container, getButtonByText, unmount } = renderPanel(api);
    await flush();

    act(() => { getByAriaLabel(container, "Timer settings")!.click(); });
    expect(getByAriaLabel(container, "Decrease work")).not.toBeNull();

    act(() => { getButtonByText("Start Work")!.click(); });
    expect(getByAriaLabel(container, "Decrease work")).toBeNull();

    unmount();
  });

  it("timer starts with custom duration from settings", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    settingsStore.set("workDuration", 10);
    const { getButtonByText, getText, unmount } = renderPanel(api);
    await flush();

    // Idle display should show custom duration
    expect(getText()).toContain("10m work");

    act(() => { getButtonByText("Start Work")!.click(); });

    // Timer should persist the custom 10-minute duration
    expect(globalStorage.write).toHaveBeenCalledWith(TIMER_STATE_KEY, {
      phase: "work",
      startedAt: now,
      durationMs: 10 * 60 * 1000,
    });

    // Display should show 10:00
    expect(getText()).toContain("10:00");
    unmount();
  });

  it("disables increment button at maximum value", async () => {
    settingsStore.set("workDuration", 120);
    const { container, unmount } = renderPanel(api);
    await flush();

    act(() => { getByAriaLabel(container, "Timer settings")!.click(); });

    const increaseBtn = getByAriaLabel(container, "Increase work") as HTMLButtonElement;
    expect(increaseBtn.disabled).toBe(true);
    unmount();
  });

  it("reflects updated durations after settings change", async () => {
    const { container, getText, unmount } = renderPanel(api);
    await flush();

    // Default shows 25m work
    expect(getText()).toContain("25m work");

    // Change work duration to 30
    act(() => { api.settings.set("workDuration", 30); });
    await flush();

    expect(getText()).toContain("30m work");
    unmount();
  });
});

// ── Activate tests ──────────────────────────────────────────────────────

describe("pomodoro activate()", () => {
  it("registers start and stop commands", () => {
    const ctx = createMockContext({ pluginId: "pomodoro" });
    const api = createMockAPI();

    activate(ctx, api);

    // 2 commands + 1 canvas widget registration
    expect(ctx.subscriptions).toHaveLength(3);
    expect(api.commands.register).toHaveBeenCalledWith("pomodoro.start", expect.any(Function));
    expect(api.commands.register).toHaveBeenCalledWith("pomodoro.stop", expect.any(Function));
  });

  it("registers canvas widget type when api.canvas is available", () => {
    const ctx = createMockContext({ pluginId: "pomodoro" });
    const api = createMockAPI();

    activate(ctx, api);

    expect(ctx.subscriptions).toHaveLength(3);
    expect(api.canvas.registerWidgetType).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pomodoro-timer",
      }),
    );
  });
});

// ── Pinned widget tests ─────────────────────────────────────────────────

describe("PomodoroPinnedWidget", () => {
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

  it("renders idle state with Start button", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    act(() => {
      root.render(React.createElement(PomodoroPinnedWidget, { api }));
    });
    await flush();

    expect(container.textContent).toContain("Ready");
    expect(container.textContent).toContain("25:00");
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe("Start");

    act(() => { root.unmount(); });
    container.remove();
  });

  it("shows running state when timer is active in storage", async () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    globalStorage._data.set(TIMER_STATE_KEY, {
      phase: "work",
      startedAt: now - 5 * 60 * 1000,
      durationMs: 25 * 60 * 1000,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    act(() => {
      root.render(React.createElement(PomodoroPinnedWidget, { api }));
    });
    await flush();

    expect(container.textContent).toContain("Focus");
    expect(container.textContent).toContain("20:00");
    const buttons = container.querySelectorAll("button");
    expect(buttons[0].textContent).toBe("Stop");

    act(() => { root.unmount(); });
    container.remove();
  });
});

// ── Manifest tests ──────────────────────────────────────────────────────

describe("manifest", () => {

  it("has correct id and version", () => {
    expect(manifest.id).toBe("pomodoro");
    expect(manifest.version).toBe("1.2.0-beta.1");
  });

  it("declares settings panel", () => {
    expect(manifest.settingsPanel).toBe("declarative");
  });

  it("declares configurable duration settings", () => {
    const keys = manifest.contributes.settings.map(
      (s: { key: string }) => s.key,
    );
    expect(keys).toContain("workDuration");
    expect(keys).toContain("shortBreakDuration");
    expect(keys).toContain("longBreakDuration");
    expect(keys).toContain("sessionsBeforeLongBreak");
  });

  it("uses tomato icon SVG", () => {
    expect(manifest.contributes.railItem.icon).toContain("<svg");
  });

  it("has help topics", () => {
    expect(manifest.contributes.help.topics.length).toBeGreaterThanOrEqual(1);
  });

  it("targets API v0.9", () => {
    expect(manifest.engine.api).toBe(0.9);
  });

  it("declares canvas permission", () => {
    expect(manifest.permissions).toContain("canvas");
  });

  it("declares canvasWidgets with pinnable pomodoro-timer", () => {
    const widgets = manifest.contributes.canvasWidgets;
    expect(widgets).toHaveLength(1);
    expect(widgets[0].id).toBe("pomodoro-timer");
    expect(widgets[0].pinnableToControls).toBe(true);
  });
});
