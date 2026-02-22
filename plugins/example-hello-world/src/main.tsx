import type { PluginContext, PluginAPI, PanelProps } from "@clubhouse/plugin-types";

const React = globalThis.React;
const { useState, useEffect, useCallback } = React;

const COUNTER_KEY = "helloCounter";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Hello World plugin activated!");

  // Register the "Say Hello" command declared in manifest.json
  const cmd = api.commands.register("hello-world.greet", () => {
    api.ui.showNotice("Hello from the Clubhouse Workshop!");
  });

  ctx.subscriptions.push(cmd);
}

export function deactivate(): void {
  // Nothing to clean up — subscriptions are disposed automatically.
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function MainPanel({ api }: PanelProps) {
  const [count, setCount] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  // Load persisted counter on mount
  useEffect(() => {
    api.storage.projectLocal.read(COUNTER_KEY).then((raw) => {
      if (typeof raw === "string") {
        setCount(Number(raw) || 0);
      } else if (typeof raw === "number") {
        setCount(raw);
      }
      setLoaded(true);
    });
  }, [api]);

  const increment = useCallback(() => {
    setCount((prev) => {
      const next = prev + 1;
      api.storage.projectLocal.write(COUNTER_KEY, next);
      return next;
    });
  }, [api]);

  const reset = useCallback(async () => {
    setCount(0);
    await api.storage.projectLocal.write(COUNTER_KEY, 0);
    api.logging.info("Counter reset to 0");
  }, [api]);

  if (!loaded) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  return (
    <div style={{ padding: 24, fontFamily: "var(--font-family, sans-serif)" }}>
      <h2 style={{ marginTop: 0 }}>Hello from Workshop!</h2>
      <p style={{ color: "var(--text-secondary, #888)" }}>
        This is a minimal Clubhouse plugin. It demonstrates storage, logging,
        and the notification API.
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 16,
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 600 }}>{count}</span>
        <button onClick={increment}>Increment</button>
        <button onClick={reset}>Reset</button>
      </div>

      <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-tertiary, #666)" }}>
        The counter is persisted in project-local storage. It survives restarts.
      </p>
    </div>
  );
}
