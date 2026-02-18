// pomodoro v0.1.0 — pre-built for direct installation
// Source: src/main.tsx | Build: esbuild --bundle --format=esm --external:react

const React = globalThis.React;
const { useState, useEffect, useCallback, useRef } = React;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;
const SESSIONS_KEY = "pomodoroSessions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m.toString().padStart(2, "0") + ":" + s.toString().padStart(2, "0");
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function activate(ctx, api) {
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

export function deactivate() {}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function MainPanel({ api }) {
  const [phase, setPhase] = useState("idle");
  const [remaining, setRemaining] = useState(WORK_DURATION);
  const [todaySessions, setTodaySessions] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    api.storage.global.read(SESSIONS_KEY).then((raw) => {
      let records = [];
      if (typeof raw === "string") {
        try { records = JSON.parse(raw); } catch {}
      } else if (Array.isArray(raw)) {
        records = raw;
      }
      const today = records.find((r) => r.date === todayKey());
      if (today) setTodaySessions(today.completedWork);
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const recordSession = useCallback(async () => {
    const raw = await api.storage.global.read(SESSIONS_KEY);
    let records = [];
    if (typeof raw === "string") {
      try { records = JSON.parse(raw); } catch {}
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

  const startTimer = useCallback((targetPhase) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const duration = targetPhase === "work" ? WORK_DURATION : BREAK_DURATION;
    setPhase(targetPhase);
    setRemaining(duration);

    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const left = duration - elapsed;
      if (left <= 0) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;

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
    }, 1000);
  }, [recordSession]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPhase("idle");
    setRemaining(WORK_DURATION);
  }, []);

  const styles = {
    container: { padding: 24, fontFamily: "var(--font-family, sans-serif)", textAlign: "center" },
    timer: { fontSize: 64, fontWeight: 700, fontVariantNumeric: "tabular-nums", margin: "24px 0" },
    phaseLabel: { fontSize: 14, textTransform: "uppercase", letterSpacing: 2, color: "var(--text-secondary, #888)" },
    sessions: { marginTop: 32, fontSize: 14, color: "var(--text-secondary, #888)" },
    buttonRow: { display: "flex", justifyContent: "center", gap: 12, marginTop: 16 },
  };

  return React.createElement("div", { style: styles.container },
    React.createElement("h2", { style: { marginTop: 0 } }, "Pomodoro"),

    React.createElement("div", { style: styles.phaseLabel },
      phase === "idle" ? "Ready" : phase === "work" ? "Focus" : "Break"
    ),

    React.createElement("div", { style: styles.timer }, formatTime(remaining)),

    React.createElement("div", { style: styles.buttonRow },
      phase === "idle" && React.createElement(React.Fragment, null,
        React.createElement("button", { onClick: function() { startTimer("work"); }, style: { cursor: "pointer" } }, "Start Work (25m)"),
        React.createElement("button", { onClick: function() { startTimer("break"); }, style: { cursor: "pointer" } }, "Start Break (5m)")
      ),
      phase !== "idle" && React.createElement("button", { onClick: stop, style: { cursor: "pointer" } }, "Stop")
    ),

    React.createElement("div", { style: styles.sessions },
      "Sessions today: ",
      React.createElement("strong", null, todaySessions)
    )
  );
}
