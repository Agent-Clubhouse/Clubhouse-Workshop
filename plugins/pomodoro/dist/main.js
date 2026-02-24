// src/use-theme.ts
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function mapThemeToCSS(theme) {
  const c = theme.colors;
  const onAccent = theme.type === "dark" ? "#ffffff" : "#000000";
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
    "--bg-overlay": "rgba(0, 0, 0, 0.5)",
    // Borders
    "--border-primary": c.surface0,
    "--border-secondary": c.surface1,
    "--border-error": hexToRgba(c.error, 0.3),
    "--border-info": hexToRgba(c.info, 0.3),
    "--border-accent": hexToRgba(c.accent, 0.3),
    // Shadows & overlays
    "--shadow": "rgba(0, 0, 0, 0.3)",
    "--shadow-light": "rgba(0, 0, 0, 0.15)",
    "--shadow-heavy": "rgba(0, 0, 0, 0.5)",
    "--shadow-menu": "rgba(0, 0, 0, 0.3)",
    "--shadow-color": "rgba(0, 0, 0, 0.5)",
    "--overlay": "rgba(0, 0, 0, 0.5)",
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
var { useState, useEffect, useCallback, useRef } = React;
var WORK_DURATION = 25 * 60;
var BREAK_DURATION = 5 * 60;
var SESSIONS_KEY = "pomodoroSessions";
var TIMER_STATE_KEY = "pomodoroTimerState";
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
function todayKey() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
function isTimerState(val) {
  if (typeof val !== "object" || val === null) return false;
  const obj = val;
  return (obj.phase === "work" || obj.phase === "break") && typeof obj.startedAt === "number" && typeof obj.durationMs === "number";
}
function activate(ctx, api) {
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
function deactivate() {
}
function MainPanel({ api }) {
  const { style: themeStyle } = useTheme(api.theme);
  const [phase, setPhase] = useState("idle");
  const [remaining, setRemaining] = useState(WORK_DURATION);
  const [todaySessions, setTodaySessions] = useState(0);
  const intervalRef = useRef(null);
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
  const runInterval = useCallback((targetPhase, startTime, durationSec) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase(targetPhase);
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
    tick();
    intervalRef.current = setInterval(tick, 1e3);
  }, [api, recordSession]);
  const startTimer = useCallback((targetPhase) => {
    const duration = targetPhase === "work" ? WORK_DURATION : BREAK_DURATION;
    const startTime = Date.now();
    api.storage.global.write(TIMER_STATE_KEY, {
      phase: targetPhase,
      startedAt: startTime,
      durationMs: duration * 1e3
    });
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
  const styles = {
    container: { padding: 24, fontFamily: "var(--font-family, sans-serif)", textAlign: "center" },
    timer: { fontSize: 64, fontWeight: 700, fontVariantNumeric: "tabular-nums", margin: "24px 0" },
    phaseLabel: { fontSize: 14, textTransform: "uppercase", letterSpacing: 2, color: "var(--text-secondary, #888)" },
    sessions: { marginTop: 32, fontSize: 14, color: "var(--text-secondary, #888)" },
    buttonRow: { display: "flex", justifyContent: "center", gap: 12, marginTop: 16 }
  };
  return /* @__PURE__ */ jsxs("div", { style: { ...themeStyle, ...styles.container }, children: [
    /* @__PURE__ */ jsx("h2", { style: { marginTop: 0 }, children: "Pomodoro" }),
    /* @__PURE__ */ jsx("div", { style: styles.phaseLabel, children: phase === "idle" ? "Ready" : phase === "work" ? "Focus" : "Break" }),
    /* @__PURE__ */ jsx("div", { style: styles.timer, children: formatTime(remaining) }),
    /* @__PURE__ */ jsxs("div", { style: styles.buttonRow, children: [
      phase === "idle" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("button", { onClick: () => startTimer("work"), style: { cursor: "pointer" }, children: "Start Work (25m)" }),
        /* @__PURE__ */ jsx("button", { onClick: () => startTimer("break"), style: { cursor: "pointer" }, children: "Start Break (5m)" })
      ] }),
      phase !== "idle" && /* @__PURE__ */ jsx("button", { onClick: stop, style: { cursor: "pointer" }, children: "Stop" })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: styles.sessions, children: [
      "Sessions today: ",
      /* @__PURE__ */ jsx("strong", { children: todaySessions })
    ] })
  ] });
}
export {
  MainPanel,
  activate,
  deactivate
};
