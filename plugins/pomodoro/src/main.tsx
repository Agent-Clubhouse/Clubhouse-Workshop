import type { PluginContext, PluginAPI, PanelProps } from "@clubhouse/plugin-types";
import { useTheme } from './use-theme';

const React = globalThis.React;
const { useState, useEffect, useCallback, useRef } = React;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORK_DURATION = 25 * 60; // 25 minutes in seconds
const BREAK_DURATION = 5 * 60; // 5 minutes in seconds
const SESSIONS_KEY = "pomodoroSessions";
const TIMER_STATE_KEY = "pomodoroTimerState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimerPhase = "idle" | "work" | "break";

interface SessionRecord {
  date: string;
  completedWork: number;
  completedBreaks: number;
}

interface TimerState {
  phase: "work" | "break";
  startedAt: number;      // Date.now() when timer started
  durationMs: number;     // total duration in milliseconds
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function isTimerState(val: unknown): val is TimerState {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    (obj.phase === "work" || obj.phase === "break") &&
    typeof obj.startedAt === "number" &&
    typeof obj.durationMs === "number"
  );
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Pomodoro plugin activated");

  ctx.subscriptions.push(
    api.commands.register("pomodoro.start", () => {
      api.ui.showNotice("Open the Pomodoro panel to start a timer");
    })
  );

  ctx.subscriptions.push(
    api.commands.register("pomodoro.stop", () => {
      api.ui.showNotice("Open the Pomodoro panel to manage timers");
    })
  );
}

export function deactivate(): void {}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function MainPanel({ api }: PanelProps) {
  const { style: themeStyle } = useTheme(api.theme);
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [remaining, setRemaining] = useState(WORK_DURATION);
  const [todaySessions, setTodaySessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recordSession = useCallback(async () => {
    const raw = await api.storage.global.read(SESSIONS_KEY);
    let records: SessionRecord[] = [];
    if (typeof raw === "string") {
      try { records = JSON.parse(raw); } catch { /* ignore */ }
    } else if (Array.isArray(raw)) {
      records = raw as SessionRecord[];
    }

    const key = todayKey();
    let today = records.find((r) => r.date === key);
    if (!today) {
      today = { date: key, completedWork: 0, completedBreaks: 0 };
      records.unshift(today);
    }
    today.completedWork += 1;
    setTodaySessions(today.completedWork);

    // Keep last 30 days
    if (records.length > 30) records.length = 30;
    await api.storage.global.write(SESSIONS_KEY, records);
  }, [api]);

  // Start (or resume) an interval that counts down from a given startTime
  const runInterval = useCallback((targetPhase: "work" | "break", startTime: number, durationSec: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    setPhase(targetPhase);

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const left = durationSec - elapsed;
      if (left <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        api.storage.global.delete(TIMER_STATE_KEY);

        if (targetPhase === "work") {
          recordSession();
          api.ui.showNotice("Pomodoro complete! Time for a break.");
          setPhase("idle");
          setRemaining(BREAK_DURATION);
        } else {
          api.ui.showNotice("Break over! Ready for another round?");
          setPhase("idle");
          setRemaining(WORK_DURATION);
        }
      } else {
        setRemaining(left);
      }
    };

    // Immediately compute the current remaining time
    tick();
    intervalRef.current = setInterval(tick, 1000);
  }, [api, recordSession]);

  const startTimer = useCallback((targetPhase: "work" | "break") => {
    const duration = targetPhase === "work" ? WORK_DURATION : BREAK_DURATION;
    const startTime = Date.now();

    // Persist timer state so it survives unmount
    api.storage.global.write(TIMER_STATE_KEY, {
      phase: targetPhase,
      startedAt: startTime,
      durationMs: duration * 1000,
    } satisfies TimerState);

    setRemaining(duration);
    runInterval(targetPhase, startTime, duration);
  }, [api, runInterval]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    api.storage.global.delete(TIMER_STATE_KEY);
    setPhase("idle");
    setRemaining(WORK_DURATION);
  }, [api]);

  // On mount: load session count and restore any in-progress timer
  useEffect(() => {
    // Load today's session count
    api.storage.global.read(SESSIONS_KEY).then((raw) => {
      let records: SessionRecord[] = [];
      if (typeof raw === "string") {
        try { records = JSON.parse(raw); } catch { return; }
      } else if (Array.isArray(raw)) {
        records = raw as SessionRecord[];
      } else {
        return;
      }
      const today = records.find((r) => r.date === todayKey());
      if (today) setTodaySessions(today.completedWork);
    });

    // Restore persisted timer state
    api.storage.global.read(TIMER_STATE_KEY).then((raw) => {
      if (!isTimerState(raw)) return;

      const elapsedMs = Date.now() - raw.startedAt;
      const remainingSec = Math.floor((raw.durationMs - elapsedMs) / 1000);

      if (remainingSec > 0) {
        // Timer still active — resume it
        runInterval(raw.phase, raw.startedAt, Math.floor(raw.durationMs / 1000));
      } else {
        // Timer expired while away
        api.storage.global.delete(TIMER_STATE_KEY);
        if (raw.phase === "work") {
          recordSession();
          api.ui.showNotice("Pomodoro complete! Time for a break.");
        } else {
          api.ui.showNotice("Break over! Ready for another round?");
        }
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [api, runInterval, recordSession]);

  const styles = {
    container: { padding: 24, fontFamily: "var(--font-family, sans-serif)", textAlign: "center" as const } as const,
    timer: { fontSize: 64, fontWeight: 700, fontVariantNumeric: "tabular-nums", margin: "24px 0" } as const,
    phaseLabel: { fontSize: 14, textTransform: "uppercase" as const, letterSpacing: 2, color: "var(--text-secondary, #888)" } as const,
    sessions: { marginTop: 32, fontSize: 14, color: "var(--text-secondary, #888)" } as const,
    buttonRow: { display: "flex", justifyContent: "center", gap: 12, marginTop: 16 } as const,
  };

  return (
    <div style={{ ...themeStyle, ...styles.container }}>
      <h2 style={{ marginTop: 0 }}>Pomodoro</h2>

      <div style={styles.phaseLabel}>
        {phase === "idle" ? "Ready" : phase === "work" ? "Focus" : "Break"}
      </div>

      <div style={styles.timer}>{formatTime(remaining)}</div>

      <div style={styles.buttonRow}>
        {phase === "idle" && (
          <>
            <button onClick={() => startTimer("work")} style={{ cursor: "pointer" }}>
              Start Work (25m)
            </button>
            <button onClick={() => startTimer("break")} style={{ cursor: "pointer" }}>
              Start Break (5m)
            </button>
          </>
        )}
        {phase !== "idle" && (
          <button onClick={stop} style={{ cursor: "pointer" }}>Stop</button>
        )}
      </div>

      <div style={styles.sessions}>
        Sessions today: <strong>{todaySessions}</strong>
      </div>
    </div>
  );
}
