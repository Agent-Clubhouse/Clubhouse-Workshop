import type { PluginContext, PluginAPI, PanelProps, CanvasWidgetComponentProps, PinnedWidgetComponentProps } from "@clubhouse/plugin-types";
import { useTheme } from "./use-theme";

const React = globalThis.React;
const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ---------------------------------------------------------------------------
// Constants & defaults
// ---------------------------------------------------------------------------

const DEFAULT_WORK = 25;
const DEFAULT_SHORT_BREAK = 5;
const DEFAULT_LONG_BREAK = 15;
const DEFAULT_CYCLE = 4;

const SESSIONS_KEY = "pomodoroSessions";
const TIMER_STATE_KEY = "pomodoroTimerState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimerPhase = "idle" | "work" | "break";

export interface SessionRecord {
  date: string;
  completedWork: number;
  completedBreaks: number;
}

export interface TimerState {
  phase: "work" | "break";
  startedAt: number;
  durationMs: number;
}

interface Durations {
  work: number;        // seconds
  shortBreak: number;  // seconds
  longBreak: number;   // seconds
  cycle: number;       // sessions before long break
}

// ---------------------------------------------------------------------------
// Helpers (exported for testing)
// ---------------------------------------------------------------------------

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function isTimerState(val: unknown): val is TimerState {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    (obj.phase === "work" || obj.phase === "break") &&
    typeof obj.startedAt === "number" &&
    typeof obj.durationMs === "number"
  );
}

/** Read a numeric setting, clamped to [min, max]. */
function readDuration(api: PluginAPI, key: string, fallback: number, min = 1, max = 120): number {
  const raw = api.settings.get<number>(key);
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function getDurations(api: PluginAPI): Durations {
  return {
    work: readDuration(api, "workDuration", DEFAULT_WORK) * 60,
    shortBreak: readDuration(api, "shortBreakDuration", DEFAULT_SHORT_BREAK) * 60,
    longBreak: readDuration(api, "longBreakDuration", DEFAULT_LONG_BREAK) * 60,
    cycle: Math.max(1, Math.min(20, Math.round(
      (api.settings.get<number>("sessionsBeforeLongBreak") ?? DEFAULT_CYCLE),
    ))),
  };
}

// ---------------------------------------------------------------------------
// Progress ring SVG component
// ---------------------------------------------------------------------------

const RING_SIZE = 180;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({
  progress,
  phase,
  children,
}: {
  progress: number; // 0..1 (1 = full, 0 = empty)
  phase: TimerPhase;
  children: React.ReactNode;
}) {
  const offset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));

  const trackColor = "var(--border-primary, #3f3f46)";
  const activeColor =
    phase === "work"
      ? "var(--text-error, #e74c3c)"
      : phase === "break"
        ? "var(--text-success, #2ecc71)"
        : "var(--text-tertiary, #71717a)";

  return (
    <div style={{ position: "relative", width: RING_SIZE, height: RING_SIZE, margin: "0 auto" }}>
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Background track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={trackColor}
          strokeWidth={RING_STROKE}
        />
        {/* Progress arc */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={activeColor}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.3s ease, stroke 0.3s ease" }}
        />
      </svg>
      {/* Center content (timer text) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session tomato dots
// ---------------------------------------------------------------------------

function SessionDots({
  count,
  cycle,
}: {
  count: number;
  cycle: number;
}) {
  if (count === 0) return null;

  const dots: React.ReactNode[] = [];
  const total = Math.min(count, 20); // cap visual at 20

  for (let i = 0; i < total; i++) {
    const isLongBreakMarker = (i + 1) % cycle === 0;
    dots.push(
      <span
        key={i}
        title={`Session ${i + 1}${isLongBreakMarker ? " (long break)" : ""}`}
        style={{
          display: "inline-block",
          width: isLongBreakMarker ? 10 : 8,
          height: isLongBreakMarker ? 10 : 8,
          borderRadius: "50%",
          background: "var(--text-error, #e74c3c)",
          opacity: isLongBreakMarker ? 1 : 0.7,
          border: isLongBreakMarker ? "1px solid var(--text-error, #e74c3c)" : "none",
        }}
      />,
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 6,
        flexWrap: "wrap",
        marginTop: 16,
      }}
    >
      {dots}
      {count > 20 && (
        <span style={{ fontSize: 11, color: "var(--text-tertiary, #71717a)", alignSelf: "center" }}>
          +{count - 20}
        </span>
      )}
    </div>
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
    }),
  );

  ctx.subscriptions.push(
    api.commands.register("pomodoro.stop", () => {
      api.ui.showNotice("Open the Pomodoro panel to manage timers");
    }),
  );

  if (api.canvas) {
    ctx.subscriptions.push(
      api.canvas.registerWidgetType({
        id: "pomodoro-timer",
        component: PomodoroFullWidget,
        pinnedComponent: PomodoroPinnedWidget,
      }),
    );
  }
}

export function deactivate(): void {}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = {
  container: {
    padding: "32px 24px",
    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
    textAlign: "center" as const,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    minHeight: "100%",
  },
  phaseLabel: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    marginBottom: 20,
  },
  timerText: {
    fontSize: 42,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums" as const,
    lineHeight: 1,
    color: "var(--text-primary, #e4e4e7)",
  },
  timerSubtext: {
    fontSize: 11,
    marginTop: 4,
    color: "var(--text-tertiary, #71717a)",
  },
  buttonRow: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    marginTop: 24,
  },
  btn: (variant: "primary" | "secondary" | "danger") => {
    const base: React.CSSProperties = {
      padding: "8px 20px",
      fontSize: 13,
      fontWeight: 600,
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      fontFamily: "inherit",
      transition: "opacity 0.15s ease",
    };
    switch (variant) {
      case "primary":
        return { ...base, background: "var(--text-error, #e74c3c)", color: "#fff" };
      case "secondary":
        return {
          ...base,
          background: "var(--bg-accent, rgba(139,92,246,0.15))",
          color: "var(--text-primary, #e4e4e7)",
          border: "1px solid var(--border-primary, #3f3f46)",
        };
      case "danger":
        return {
          ...base,
          background: "transparent",
          color: "var(--text-secondary, #a1a1aa)",
          border: "1px solid var(--border-primary, #3f3f46)",
        };
    }
  },
  sessions: {
    marginTop: 24,
    fontSize: 13,
    color: "var(--text-secondary, #a1a1aa)",
  },
  longBreakHint: {
    marginTop: 8,
    fontSize: 11,
    color: "var(--text-success, #2ecc71)",
    fontWeight: 500,
  },
  gearBtn: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "1px solid var(--border-primary, #3f3f46)",
    background: "transparent",
    color: "var(--text-secondary, #a1a1aa)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    transition: "opacity 0.15s ease",
  } as React.CSSProperties,
  settingsSection: {
    marginTop: 12,
    padding: "12px 16px",
    background: "var(--bg-surface, #27272a)",
    borderRadius: 10,
    border: "1px solid var(--border-primary, #3f3f46)",
    width: "100%",
    maxWidth: 260,
  } as React.CSSProperties,
  settingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 0",
  } as React.CSSProperties,
  settingLabel: {
    fontSize: 12,
    color: "var(--text-secondary, #a1a1aa)",
  },
  stepperBtn: (disabled: boolean): React.CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid var(--border-primary, #3f3f46)",
    background: "var(--bg-surface-hover, #3f3f46)",
    color: "var(--text-primary, #e4e4e7)",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    fontSize: 16,
    fontWeight: 600,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  }),
  stepperValue: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary, #e4e4e7)",
    minWidth: 36,
    textAlign: "center" as const,
  },
};

// ---------------------------------------------------------------------------
// Duration stepper (inline settings control)
// ---------------------------------------------------------------------------

function DurationStepper({
  label,
  value,
  settingKey,
  api,
  min = 1,
  max = 120,
}: {
  label: string;
  value: number;
  settingKey: string;
  api: PluginAPI;
  min?: number;
  max?: number;
}) {
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div style={S.settingRow}>
      <span style={S.settingLabel}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          style={S.stepperBtn(atMin)}
          onClick={() => api.settings.set(settingKey, Math.max(min, value - 1))}
          disabled={atMin}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          &minus;
        </button>
        <span style={S.stepperValue}>{value}m</span>
        <button
          style={S.stepperBtn(atMax)}
          onClick={() => api.settings.set(settingKey, Math.min(max, value + 1))}
          disabled={atMax}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function MainPanel({ api }: PanelProps) {
  const { style: themeStyle } = useTheme(api.theme);
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [remaining, setRemaining] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [todaySessions, setTodaySessions] = useState(0);
  const [durations, setDurations] = useState<Durations>(() => getDurations(api));
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-close settings when timer starts
  useEffect(() => {
    if (phase !== "idle") setShowSettings(false);
  }, [phase]);

  // Initialise remaining to work duration once durations are loaded
  useEffect(() => {
    if (phase === "idle") {
      setRemaining(durations.work);
      setTotalDuration(durations.work);
    }
  }, [durations.work, phase]);

  // React to settings changes
  useEffect(() => {
    const unsub = api.settings.onChange(() => {
      setDurations(getDurations(api));
    });
    return () => unsub.dispose();
  }, [api]);

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

    if (records.length > 30) records.length = 30;
    await api.storage.global.write(SESSIONS_KEY, records);
  }, [api]);

  const runInterval = useCallback(
    (targetPhase: "work" | "break", startTime: number, durationSec: number) => {
      if (intervalRef.current) clearInterval(intervalRef.current);

      setPhase(targetPhase);
      setTotalDuration(durationSec);

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
            setRemaining(durations.shortBreak);
            setTotalDuration(durations.shortBreak);
          } else {
            api.ui.showNotice("Break over! Ready for another round?");
            setPhase("idle");
            setRemaining(durations.work);
            setTotalDuration(durations.work);
          }
        } else {
          setRemaining(left);
        }
      };

      tick();
      intervalRef.current = setInterval(tick, 1000);
    },
    [api, recordSession, durations],
  );

  const startTimer = useCallback(
    (targetPhase: "work" | "break", longBreak = false) => {
      let duration: number;
      if (targetPhase === "work") {
        duration = durations.work;
      } else {
        duration = longBreak ? durations.longBreak : durations.shortBreak;
      }
      const startTime = Date.now();

      api.storage.global.write(TIMER_STATE_KEY, {
        phase: targetPhase,
        startedAt: startTime,
        durationMs: duration * 1000,
      } satisfies TimerState);

      setRemaining(duration);
      setTotalDuration(duration);
      runInterval(targetPhase, startTime, duration);
    },
    [api, runInterval, durations],
  );

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    api.storage.global.delete(TIMER_STATE_KEY);
    setPhase("idle");
    setRemaining(durations.work);
    setTotalDuration(durations.work);
  }, [api, durations]);

  // On mount: load session count and restore any in-progress timer
  useEffect(() => {
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

    api.storage.global.read(TIMER_STATE_KEY).then((raw) => {
      if (!isTimerState(raw)) return;

      const elapsedMs = Date.now() - raw.startedAt;
      const remainingSec = Math.floor((raw.durationMs - elapsedMs) / 1000);

      if (remainingSec > 0) {
        runInterval(raw.phase, raw.startedAt, Math.floor(raw.durationMs / 1000));
      } else {
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

  // Derived state
  const progress = totalDuration > 0 ? remaining / totalDuration : 1;
  const isLongBreakDue = todaySessions > 0 && todaySessions % durations.cycle === 0;

  const phaseColor = useMemo(() => {
    if (phase === "work") return "var(--text-error, #e74c3c)";
    if (phase === "break") return "var(--text-success, #2ecc71)";
    return "var(--text-secondary, #a1a1aa)";
  }, [phase]);

  const phaseLabel = phase === "idle" ? "Ready" : phase === "work" ? "Focus" : "Break";
  const durationLabel = phase === "idle"
    ? `${Math.round(durations.work / 60)}m work`
    : null;

  return (
    <div style={{ ...themeStyle, ...S.container }}>
      {/* Phase label */}
      <div style={{ ...S.phaseLabel, color: phaseColor }}>{phaseLabel}</div>

      {/* Progress ring with timer */}
      <ProgressRing progress={progress} phase={phase}>
        <div style={S.timerText}>{formatTime(remaining)}</div>
        {durationLabel && <div style={S.timerSubtext}>{durationLabel}</div>}
      </ProgressRing>

      {/* Action buttons */}
      <div style={S.buttonRow}>
        {phase === "idle" && (
          <>
            <button
              onClick={() => startTimer("work")}
              style={S.btn("primary")}
            >
              Start Work
            </button>
            {isLongBreakDue ? (
              <button
                onClick={() => startTimer("break", true)}
                style={S.btn("secondary")}
              >
                Long Break ({Math.round(durations.longBreak / 60)}m)
              </button>
            ) : (
              <button
                onClick={() => startTimer("break")}
                style={S.btn("secondary")}
              >
                Short Break ({Math.round(durations.shortBreak / 60)}m)
              </button>
            )}
          </>
        )}
        {phase !== "idle" && (
          <button onClick={stop} style={S.btn("danger")}>
            Stop
          </button>
        )}
      </div>

      {/* Settings gear toggle */}
      {phase === "idle" && (
        <button
          onClick={() => setShowSettings((v) => !v)}
          style={S.gearBtn}
          title="Timer settings"
          aria-label="Timer settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      )}

      {/* Inline duration settings */}
      {phase === "idle" && showSettings && (
        <div style={S.settingsSection}>
          <DurationStepper
            label="Work"
            value={Math.round(durations.work / 60)}
            settingKey="workDuration"
            api={api}
          />
          <DurationStepper
            label="Short Break"
            value={Math.round(durations.shortBreak / 60)}
            settingKey="shortBreakDuration"
            api={api}
          />
          <DurationStepper
            label="Long Break"
            value={Math.round(durations.longBreak / 60)}
            settingKey="longBreakDuration"
            api={api}
          />
        </div>
      )}

      {/* Long break hint */}
      {phase === "idle" && isLongBreakDue && (
        <div style={S.longBreakHint}>
          {durations.cycle} sessions done — take a long break!
        </div>
      )}

      {/* Session dots */}
      <SessionDots count={todaySessions} cycle={durations.cycle} />

      {/* Session count */}
      <div style={S.sessions}>
        {todaySessions === 0
          ? "No sessions yet today"
          : `${todaySessions} session${todaySessions === 1 ? "" : "s"} today`}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas full widget (wraps MainPanel)
// ---------------------------------------------------------------------------

export function PomodoroFullWidget({ api }: CanvasWidgetComponentProps) {
  return <MainPanel api={api} />;
}

// ---------------------------------------------------------------------------
// Pinned widget (compact controls bar timer)
// ---------------------------------------------------------------------------

const pinnedStyles = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
    fontSize: 13,
    color: "var(--text-primary, #e4e4e7)",
    whiteSpace: "nowrap" as const,
  },
  time: {
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums" as const,
    minWidth: 42,
  },
  phaseLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  btn: {
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 600,
    border: "1px solid var(--border-primary, #3f3f46)",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
    background: "transparent",
    color: "var(--text-secondary, #a1a1aa)",
  },
};

export function PomodoroPinnedWidget({ api }: PinnedWidgetComponentProps) {
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [remaining, setRemaining] = useState(0);
  const [durations, setDurations] = useState<Durations>(() => getDurations(api));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { style: themeStyle } = useTheme(api.theme);

  // Load durations on settings change
  useEffect(() => {
    const unsub = api.settings.onChange(() => setDurations(getDurations(api)));
    return () => unsub.dispose();
  }, [api]);

  // Set idle display
  useEffect(() => {
    if (phase === "idle") setRemaining(durations.work);
  }, [durations.work, phase]);

  // Poll timer state from storage
  useEffect(() => {
    const tick = async () => {
      const raw = await api.storage.global.read(TIMER_STATE_KEY);
      if (!isTimerState(raw)) {
        if (phase !== "idle") setPhase("idle");
        return;
      }
      const elapsed = Math.floor((Date.now() - raw.startedAt) / 1000);
      const left = Math.floor(raw.durationMs / 1000) - elapsed;
      if (left > 0) {
        setPhase(raw.phase);
        setRemaining(left);
      } else {
        setPhase("idle");
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    intervalRef.current = id;
    return () => clearInterval(id);
  }, [api, phase]);

  const startWork = useCallback(() => {
    const now = Date.now();
    api.storage.global.write(TIMER_STATE_KEY, {
      phase: "work",
      startedAt: now,
      durationMs: durations.work * 1000,
    } satisfies TimerState);
    setPhase("work");
    setRemaining(durations.work);
  }, [api, durations]);

  const stop = useCallback(() => {
    api.storage.global.delete(TIMER_STATE_KEY);
    setPhase("idle");
    setRemaining(durations.work);
  }, [api, durations]);

  const phaseColor =
    phase === "work" ? "var(--text-error, #e74c3c)"
    : phase === "break" ? "var(--text-success, #2ecc71)"
    : "var(--text-secondary, #a1a1aa)";

  const label = phase === "idle" ? "Ready" : phase === "work" ? "Focus" : "Break";

  return (
    <div style={{ ...themeStyle, ...pinnedStyles.container }}>
      <span style={{ ...pinnedStyles.phaseLabel, color: phaseColor }}>{label}</span>
      <span style={pinnedStyles.time}>{formatTime(remaining)}</span>
      {phase === "idle" ? (
        <button onClick={startWork} style={pinnedStyles.btn}>Start</button>
      ) : (
        <button onClick={stop} style={pinnedStyles.btn}>Stop</button>
      )}
    </div>
  );
}
