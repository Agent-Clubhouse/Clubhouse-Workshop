import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import ReactDOM from "react-dom/client";
import { act } from "react";
import { activate, MainPanel, formatTime, todayKey, isTimerState } from "./main";
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

// ── Activate tests ──────────────────────────────────────────────────────

describe("pomodoro activate()", () => {
  it("registers start and stop commands", () => {
    const ctx = createMockContext({ pluginId: "pomodoro" });
    const api = createMockAPI();

    activate(ctx, api);

    expect(ctx.subscriptions).toHaveLength(2);
  });
});

// ── Manifest tests ──────────────────────────────────────────────────────

describe("manifest", () => {

  it("has correct id and version", () => {
    expect(manifest.id).toBe("pomodoro");
    expect(manifest.version).toBe("1.1.0");
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

  it("uses bug icon SVG", () => {
    expect(manifest.contributes.railItem.icon).toContain("<svg");
  });

  it("has help topics", () => {
    expect(manifest.contributes.help.topics.length).toBeGreaterThanOrEqual(1);
  });
});
