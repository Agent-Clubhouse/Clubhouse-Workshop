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
  }, []);
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
  }, [recordSession]);
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
  }, [runInterval]);
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    api.storage.global.delete(TIMER_STATE_KEY);
    setPhase("idle");
    setRemaining(WORK_DURATION);
  }, []);
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
  }, []);
  const styles = {
    container: { padding: 24, fontFamily: "var(--font-family, sans-serif)", textAlign: "center" },
    timer: { fontSize: 64, fontWeight: 700, fontVariantNumeric: "tabular-nums", margin: "24px 0" },
    phaseLabel: { fontSize: 14, textTransform: "uppercase", letterSpacing: 2, color: "var(--text-secondary, #888)" },
    sessions: { marginTop: 32, fontSize: 14, color: "var(--text-secondary, #888)" },
    buttonRow: { display: "flex", justifyContent: "center", gap: 12, marginTop: 16 }
  };
  return /* @__PURE__ */ jsxs("div", { style: styles.container, children: [
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
