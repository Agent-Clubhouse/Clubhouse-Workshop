// ../../sdk/shared/plugin-utils/src/use-theme.ts
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function mapThemeToCSS(theme) {
  const c = theme.colors;
  const onAccent = theme.type === "dark" ? "#ffffff" : "#000000";
  const shadowOpacity = theme.type === "dark" ? 0.5 : 0.1;
  const shadowLight = theme.type === "dark" ? 0.15 : 0.08;
  const shadowMenu = theme.type === "dark" ? 0.3 : 0.1;
  const overlayOpacity = theme.type === "dark" ? 0.5 : 0.3;
  return {
    // Text
    "--text-primary": c.text,
    "--text-secondary": c.subtext1,
    "--text-tertiary": c.subtext0,
    "--text-muted": c.surface2,
    "--text-error": c.error,
    "--text-success": c.success,
    "--text-warning": c.warning,
    "--text-info": c.info,
    "--text-accent": c.accent,
    "--text-on-badge": onAccent,
    "--text-on-accent": onAccent,
    // Backgrounds
    "--bg-primary": c.base,
    "--bg-secondary": c.mantle,
    "--bg-tertiary": c.crust,
    "--bg-surface": c.surface0,
    "--bg-surface-hover": c.surface1,
    "--bg-surface-raised": c.surface2,
    "--bg-active": c.surface1,
    "--bg-error": hexToRgba(c.error, 0.1),
    "--bg-error-subtle": hexToRgba(c.error, 0.05),
    "--bg-success": hexToRgba(c.success, 0.15),
    "--bg-warning": hexToRgba(c.warning, 0.15),
    "--bg-info": hexToRgba(c.info, 0.1),
    "--bg-accent": hexToRgba(c.accent, 0.15),
    "--bg-overlay": `rgba(0, 0, 0, ${overlayOpacity})`,
    // Borders
    "--border-primary": c.surface0,
    "--border-secondary": c.surface1,
    "--border-error": hexToRgba(c.error, 0.3),
    "--border-info": hexToRgba(c.info, 0.3),
    "--border-accent": hexToRgba(c.accent, 0.3),
    // Shadows & overlays
    "--shadow": `rgba(0, 0, 0, ${shadowOpacity})`,
    "--shadow-light": `rgba(0, 0, 0, ${shadowLight})`,
    "--shadow-heavy": `rgba(0, 0, 0, ${shadowOpacity})`,
    "--shadow-menu": `rgba(0, 0, 0, ${shadowMenu})`,
    "--shadow-color": `rgba(0, 0, 0, ${shadowOpacity})`,
    "--overlay": `rgba(0, 0, 0, ${overlayOpacity})`,
    "--glow-error": hexToRgba(c.error, 0.3),
    "--glow-accent": hexToRgba(c.accent, 0.3),
    // Fonts
    "--font-family": "system-ui, -apple-system, sans-serif",
    "--font-mono": "ui-monospace, monospace",
    // Color aliases (file icons, labels, etc.)
    "--color-blue": c.info,
    "--color-green": c.success,
    "--color-yellow": c.warning,
    "--color-orange": c.warning,
    "--color-red": c.error,
    "--color-purple": c.accent,
    "--color-cyan": c.info
  };
}
function useTheme(themeApi) {
  const React2 = globalThis.React;
  const [theme, setTheme] = React2.useState(() => themeApi.getCurrent());
  React2.useEffect(() => {
    setTheme(themeApi.getCurrent());
    const disposable = themeApi.onDidChange((t) => setTheme(t));
    return () => disposable.dispose();
  }, [themeApi]);
  const style = React2.useMemo(
    () => mapThemeToCSS(theme),
    [theme]
  );
  return { style, themeType: theme.type };
}

// src/main.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var React = globalThis.React;
var { useState, useEffect, useCallback, useRef, useMemo } = React;
var DEFAULT_WORK = 25;
var DEFAULT_SHORT_BREAK = 5;
var DEFAULT_LONG_BREAK = 15;
var DEFAULT_CYCLE = 4;
var SESSIONS_KEY = "pomodoroSessions";
var TIMER_STATE_KEY = "pomodoroTimerState";
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
function todayKey() {
  const d = /* @__PURE__ */ new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isTimerState(val) {
  if (typeof val !== "object" || val === null) return false;
  const obj = val;
  return (obj.phase === "work" || obj.phase === "break") && typeof obj.startedAt === "number" && typeof obj.durationMs === "number";
}
function readDuration(api, key, fallback, min = 1, max = 120) {
  const raw = api.settings.get(key);
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}
function getDurations(api) {
  return {
    work: readDuration(api, "workDuration", DEFAULT_WORK) * 60,
    shortBreak: readDuration(api, "shortBreakDuration", DEFAULT_SHORT_BREAK) * 60,
    longBreak: readDuration(api, "longBreakDuration", DEFAULT_LONG_BREAK) * 60,
    cycle: Math.max(1, Math.min(20, Math.round(
      api.settings.get("sessionsBeforeLongBreak") ?? DEFAULT_CYCLE
    )))
  };
}
var RING_SIZE = 180;
var RING_STROKE = 8;
var RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
function ProgressRing({
  progress,
  phase,
  children
}) {
  const offset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));
  const trackColor = "var(--border-primary, #3f3f46)";
  const activeColor = phase === "work" ? "var(--text-error, #e74c3c)" : phase === "break" ? "var(--text-success, #2ecc71)" : "var(--text-tertiary, #71717a)";
  return /* @__PURE__ */ jsxs("div", { style: { position: "relative", width: RING_SIZE, height: RING_SIZE, margin: "0 auto" }, children: [
    /* @__PURE__ */ jsxs(
      "svg",
      {
        width: RING_SIZE,
        height: RING_SIZE,
        viewBox: `0 0 ${RING_SIZE} ${RING_SIZE}`,
        style: { transform: "rotate(-90deg)" },
        children: [
          /* @__PURE__ */ jsx(
            "circle",
            {
              cx: RING_SIZE / 2,
              cy: RING_SIZE / 2,
              r: RING_RADIUS,
              fill: "none",
              stroke: trackColor,
              strokeWidth: RING_STROKE
            }
          ),
          /* @__PURE__ */ jsx(
            "circle",
            {
              cx: RING_SIZE / 2,
              cy: RING_SIZE / 2,
              r: RING_RADIUS,
              fill: "none",
              stroke: activeColor,
              strokeWidth: RING_STROKE,
              strokeLinecap: "round",
              strokeDasharray: RING_CIRCUMFERENCE,
              strokeDashoffset: offset,
              style: { transition: "stroke-dashoffset 0.3s ease, stroke 0.3s ease" }
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center"
        },
        children
      }
    )
  ] });
}
function SessionDots({
  count,
  cycle
}) {
  if (count === 0) return null;
  const dots = [];
  const total = Math.min(count, 20);
  for (let i = 0; i < total; i++) {
    const isLongBreakMarker = (i + 1) % cycle === 0;
    dots.push(
      /* @__PURE__ */ jsx(
        "span",
        {
          title: `Session ${i + 1}${isLongBreakMarker ? " (long break)" : ""}`,
          style: {
            display: "inline-block",
            width: isLongBreakMarker ? 10 : 8,
            height: isLongBreakMarker ? 10 : 8,
            borderRadius: "50%",
            background: "var(--text-error, #e74c3c)",
            opacity: isLongBreakMarker ? 1 : 0.7,
            border: isLongBreakMarker ? "1px solid var(--text-error, #e74c3c)" : "none"
          }
        },
        i
      )
    );
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        display: "flex",
        justifyContent: "center",
        gap: 6,
        flexWrap: "wrap",
        marginTop: 16
      },
      children: [
        dots,
        count > 20 && /* @__PURE__ */ jsxs("span", { style: { fontSize: 11, color: "var(--text-tertiary, #71717a)", alignSelf: "center" }, children: [
          "+",
          count - 20
        ] })
      ]
    }
  );
}
function activate(ctx, api) {
  api.logging.info("Pomodoro plugin activated");
  if (api.canvas) {
    ctx.subscriptions.push(
      api.canvas.registerWidgetType({
        id: "pomodoro-timer",
        component: PomodoroFullWidget,
        pinnedComponent: PomodoroPinnedWidget
      })
    );
  }
}
function deactivate() {
}
var S = {
  container: {
    padding: "32px 24px",
    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minHeight: "100%"
  },
  phaseLabel: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 20
  },
  timerText: {
    fontSize: 42,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
    color: "var(--text-primary, #e4e4e7)"
  },
  timerSubtext: {
    fontSize: 11,
    marginTop: 4,
    color: "var(--text-tertiary, #71717a)"
  },
  buttonRow: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    marginTop: 24
  },
  btn: (variant) => {
    const base = {
      padding: "8px 20px",
      fontSize: 13,
      fontWeight: 600,
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      fontFamily: "inherit",
      transition: "opacity 0.15s ease"
    };
    switch (variant) {
      case "primary":
        return { ...base, background: "var(--text-error, #e74c3c)", color: "#fff" };
      case "secondary":
        return {
          ...base,
          background: "var(--bg-accent, rgba(139,92,246,0.15))",
          color: "var(--text-primary, #e4e4e7)",
          border: "1px solid var(--border-primary, #3f3f46)"
        };
      case "danger":
        return {
          ...base,
          background: "transparent",
          color: "var(--text-secondary, #a1a1aa)",
          border: "1px solid var(--border-primary, #3f3f46)"
        };
    }
  },
  sessions: {
    marginTop: 24,
    fontSize: 13,
    color: "var(--text-secondary, #a1a1aa)"
  },
  longBreakHint: {
    marginTop: 8,
    fontSize: 11,
    color: "var(--text-success, #2ecc71)",
    fontWeight: 500
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
    transition: "opacity 0.15s ease"
  },
  settingsSection: {
    marginTop: 12,
    padding: "12px 16px",
    background: "var(--bg-surface, #27272a)",
    borderRadius: 10,
    border: "1px solid var(--border-primary, #3f3f46)",
    width: "100%",
    maxWidth: 260
  },
  settingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 0"
  },
  settingLabel: {
    fontSize: 12,
    color: "var(--text-secondary, #a1a1aa)"
  },
  stepperBtn: (disabled) => ({
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
    padding: 0
  }),
  stepperValue: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary, #e4e4e7)",
    minWidth: 36,
    textAlign: "center"
  }
};
function DurationStepper({
  label,
  value,
  settingKey,
  api,
  min = 1,
  max = 120
}) {
  const atMin = value <= min;
  const atMax = value >= max;
  return /* @__PURE__ */ jsxs("div", { style: S.settingRow, children: [
    /* @__PURE__ */ jsx("span", { style: S.settingLabel, children: label }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          style: S.stepperBtn(atMin),
          onClick: () => api.settings.set(settingKey, Math.max(min, value - 1)),
          disabled: atMin,
          "aria-label": `Decrease ${label.toLowerCase()}`,
          children: "\u2212"
        }
      ),
      /* @__PURE__ */ jsxs("span", { style: S.stepperValue, children: [
        value,
        "m"
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          style: S.stepperBtn(atMax),
          onClick: () => api.settings.set(settingKey, Math.min(max, value + 1)),
          disabled: atMax,
          "aria-label": `Increase ${label.toLowerCase()}`,
          children: "+"
        }
      )
    ] })
  ] });
}
function MainPanel({ api }) {
  const { style: themeStyle } = useTheme(api.theme);
  const [phase, setPhase] = useState("idle");
  const [remaining, setRemaining] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [todaySessions, setTodaySessions] = useState(0);
  const [durations, setDurations] = useState(() => getDurations(api));
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef(null);
  useEffect(() => {
    if (phase !== "idle") setShowSettings(false);
  }, [phase]);
  useEffect(() => {
    if (phase === "idle") {
      setRemaining(durations.work);
      setTotalDuration(durations.work);
    }
  }, [durations.work, phase]);
  useEffect(() => {
    const unsub = api.settings.onChange(() => {
      setDurations(getDurations(api));
    });
    return () => unsub.dispose();
  }, [api]);
  const recordSession = useCallback(async () => {
    const raw = await api.storage.global.read(SESSIONS_KEY);
    let records = [];
    if (typeof raw === "string") {
      try {
        records = JSON.parse(raw);
      } catch {
      }
    } else if (Array.isArray(raw)) {
      records = raw;
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
    (targetPhase, startTime, durationSec) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPhase(targetPhase);
      setTotalDuration(durationSec);
      const tick = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1e3);
        const left = durationSec - elapsed;
        if (left <= 0) {
          clearInterval(intervalRef.current);
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
      intervalRef.current = setInterval(tick, 1e3);
    },
    [api, recordSession, durations]
  );
  const startTimer = useCallback(
    (targetPhase, longBreak = false) => {
      let duration;
      if (targetPhase === "work") {
        duration = durations.work;
      } else {
        duration = longBreak ? durations.longBreak : durations.shortBreak;
      }
      const startTime = Date.now();
      api.storage.global.write(TIMER_STATE_KEY, {
        phase: targetPhase,
        startedAt: startTime,
        durationMs: duration * 1e3
      });
      setRemaining(duration);
      setTotalDuration(duration);
      runInterval(targetPhase, startTime, duration);
    },
    [api, runInterval, durations]
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
  useEffect(() => {
    api.storage.global.read(SESSIONS_KEY).then((raw) => {
      let records = [];
      if (typeof raw === "string") {
        try {
          records = JSON.parse(raw);
        } catch {
          return;
        }
      } else if (Array.isArray(raw)) {
        records = raw;
      } else {
        return;
      }
      const today = records.find((r) => r.date === todayKey());
      if (today) setTodaySessions(today.completedWork);
    });
    api.storage.global.read(TIMER_STATE_KEY).then((raw) => {
      if (!isTimerState(raw)) return;
      const elapsedMs = Date.now() - raw.startedAt;
      const remainingSec = Math.floor((raw.durationMs - elapsedMs) / 1e3);
      if (remainingSec > 0) {
        runInterval(raw.phase, raw.startedAt, Math.floor(raw.durationMs / 1e3));
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
  const progress = totalDuration > 0 ? remaining / totalDuration : 1;
  const isLongBreakDue = todaySessions > 0 && todaySessions % durations.cycle === 0;
  const phaseColor = useMemo(() => {
    if (phase === "work") return "var(--text-error, #e74c3c)";
    if (phase === "break") return "var(--text-success, #2ecc71)";
    return "var(--text-secondary, #a1a1aa)";
  }, [phase]);
  const phaseLabel = phase === "idle" ? "Ready" : phase === "work" ? "Focus" : "Break";
  const durationLabel = phase === "idle" ? `${Math.round(durations.work / 60)}m work` : null;
  return /* @__PURE__ */ jsxs("div", { style: { ...themeStyle, ...S.container }, children: [
    /* @__PURE__ */ jsx("div", { style: { ...S.phaseLabel, color: phaseColor }, children: phaseLabel }),
    /* @__PURE__ */ jsxs(ProgressRing, { progress, phase, children: [
      /* @__PURE__ */ jsx("div", { style: S.timerText, children: formatTime(remaining) }),
      durationLabel && /* @__PURE__ */ jsx("div", { style: S.timerSubtext, children: durationLabel })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: S.buttonRow, children: [
      phase === "idle" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => startTimer("work"),
            style: S.btn("primary"),
            children: "Start Work"
          }
        ),
        isLongBreakDue ? /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => startTimer("break", true),
            style: S.btn("secondary"),
            children: [
              "Long Break (",
              Math.round(durations.longBreak / 60),
              "m)"
            ]
          }
        ) : /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => startTimer("break"),
            style: S.btn("secondary"),
            children: [
              "Short Break (",
              Math.round(durations.shortBreak / 60),
              "m)"
            ]
          }
        )
      ] }),
      phase !== "idle" && /* @__PURE__ */ jsx("button", { onClick: stop, style: S.btn("danger"), children: "Stop" })
    ] }),
    phase === "idle" && /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => setShowSettings((v) => !v),
        style: S.gearBtn,
        title: "Timer settings",
        "aria-label": "Timer settings",
        children: /* @__PURE__ */ jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
          /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "3" }),
          /* @__PURE__ */ jsx("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" })
        ] })
      }
    ),
    phase === "idle" && showSettings && /* @__PURE__ */ jsxs("div", { style: S.settingsSection, children: [
      /* @__PURE__ */ jsx(
        DurationStepper,
        {
          label: "Work",
          value: Math.round(durations.work / 60),
          settingKey: "workDuration",
          api
        }
      ),
      /* @__PURE__ */ jsx(
        DurationStepper,
        {
          label: "Short Break",
          value: Math.round(durations.shortBreak / 60),
          settingKey: "shortBreakDuration",
          api
        }
      ),
      /* @__PURE__ */ jsx(
        DurationStepper,
        {
          label: "Long Break",
          value: Math.round(durations.longBreak / 60),
          settingKey: "longBreakDuration",
          api
        }
      )
    ] }),
    phase === "idle" && isLongBreakDue && /* @__PURE__ */ jsxs("div", { style: S.longBreakHint, children: [
      durations.cycle,
      " sessions done \u2014 take a long break!"
    ] }),
    /* @__PURE__ */ jsx(SessionDots, { count: todaySessions, cycle: durations.cycle }),
    /* @__PURE__ */ jsx("div", { style: S.sessions, children: todaySessions === 0 ? "No sessions yet today" : `${todaySessions} session${todaySessions === 1 ? "" : "s"} today` })
  ] });
}
function PomodoroFullWidget({ api }) {
  return /* @__PURE__ */ jsx(MainPanel, { api });
}
var pinnedStyles = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
    fontSize: 13,
    color: "var(--text-primary, #e4e4e7)",
    whiteSpace: "nowrap"
  },
  time: {
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    minWidth: 42
  },
  phaseLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1
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
    color: "var(--text-secondary, #a1a1aa)"
  }
};
function PomodoroPinnedWidget({ api }) {
  const [phase, setPhase] = useState("idle");
  const [remaining, setRemaining] = useState(0);
  const [durations, setDurations] = useState(() => getDurations(api));
  const intervalRef = useRef(null);
  const { style: themeStyle } = useTheme(api.theme);
  useEffect(() => {
    const unsub = api.settings.onChange(() => setDurations(getDurations(api)));
    return () => unsub.dispose();
  }, [api]);
  useEffect(() => {
    if (phase === "idle") setRemaining(durations.work);
  }, [durations.work, phase]);
  useEffect(() => {
    const tick = async () => {
      const raw = await api.storage.global.read(TIMER_STATE_KEY);
      if (!isTimerState(raw)) {
        if (phase !== "idle") setPhase("idle");
        return;
      }
      const elapsed = Math.floor((Date.now() - raw.startedAt) / 1e3);
      const left = Math.floor(raw.durationMs / 1e3) - elapsed;
      if (left > 0) {
        setPhase(raw.phase);
        setRemaining(left);
      } else {
        setPhase("idle");
      }
    };
    tick();
    const id = setInterval(tick, 1e3);
    intervalRef.current = id;
    return () => clearInterval(id);
  }, [api, phase]);
  const startWork = useCallback(() => {
    const now = Date.now();
    api.storage.global.write(TIMER_STATE_KEY, {
      phase: "work",
      startedAt: now,
      durationMs: durations.work * 1e3
    });
    setPhase("work");
    setRemaining(durations.work);
  }, [api, durations]);
  const stop = useCallback(() => {
    api.storage.global.delete(TIMER_STATE_KEY);
    setPhase("idle");
    setRemaining(durations.work);
  }, [api, durations]);
  const phaseColor = phase === "work" ? "var(--text-error, #e74c3c)" : phase === "break" ? "var(--text-success, #2ecc71)" : "var(--text-secondary, #a1a1aa)";
  const label = phase === "idle" ? "Ready" : phase === "work" ? "Focus" : "Break";
  return /* @__PURE__ */ jsxs("div", { style: { ...themeStyle, ...pinnedStyles.container }, children: [
    /* @__PURE__ */ jsx("span", { style: { ...pinnedStyles.phaseLabel, color: phaseColor }, children: label }),
    /* @__PURE__ */ jsx("span", { style: pinnedStyles.time, children: formatTime(remaining) }),
    phase === "idle" ? /* @__PURE__ */ jsx("button", { onClick: startWork, style: pinnedStyles.btn, children: "Start" }) : /* @__PURE__ */ jsx("button", { onClick: stop, style: pinnedStyles.btn, children: "Stop" })
  ] });
}
export {
  MainPanel,
  PomodoroFullWidget,
  PomodoroPinnedWidget,
  activate,
  deactivate,
  formatTime,
  isTimerState,
  todayKey
};
