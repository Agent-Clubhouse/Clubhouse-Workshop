// example-hello-world v0.1.0 — pre-built for direct installation
// Source: src/main.tsx | Build: esbuild --bundle --format=esm --external:react

const React = globalThis.React;
const { useState, useEffect, useCallback } = React;

const COUNTER_KEY = "helloCounter";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function activate(ctx, api) {
  api.logging.info("Hello World plugin activated!");

  const cmd = api.commands.register("hello-world.greet", () => {
    api.ui.showNotice("Hello from the Clubhouse Workshop!");
  });

  ctx.subscriptions.push(cmd);
}

export function deactivate() {}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function MainPanel({ api }) {
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.storage.projectLocal.read(COUNTER_KEY).then((raw) => {
      if (typeof raw === "number") {
        setCount(raw);
      } else if (typeof raw === "string") {
        setCount(Number(raw) || 0);
      }
      setLoaded(true);
    });
  }, []);

  const increment = useCallback(async () => {
    const next = count + 1;
    setCount(next);
    await api.storage.projectLocal.write(COUNTER_KEY, next);
    api.ui.showNotice("Count is now " + next);
  }, [count]);

  const reset = useCallback(async () => {
    setCount(0);
    await api.storage.projectLocal.write(COUNTER_KEY, 0);
    api.logging.info("Counter reset to 0");
  }, []);

  if (!loaded) {
    return React.createElement("div", { style: { padding: 24 } }, "Loading\u2026");
  }

  return React.createElement(
    "div",
    { style: { padding: 24, fontFamily: "var(--font-family, sans-serif)" } },
    React.createElement("h2", { style: { marginTop: 0 } }, "Hello from Workshop!"),
    React.createElement(
      "p",
      { style: { color: "var(--text-secondary, #888)" } },
      "This is a minimal Clubhouse plugin. It demonstrates storage, logging, and the notification API."
    ),
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 12, marginTop: 16 } },
      React.createElement("span", { style: { fontSize: 24, fontWeight: 600 } }, count),
      React.createElement("button", { onClick: increment }, "Increment"),
      React.createElement("button", { onClick: reset }, "Reset")
    ),
    React.createElement(
      "p",
      { style: { marginTop: 24, fontSize: 13, color: "var(--text-tertiary, #666)" } },
      "The counter is persisted in project-local storage. It survives restarts."
    )
  );
}
