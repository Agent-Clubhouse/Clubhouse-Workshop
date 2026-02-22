// src/main.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var React = globalThis.React;
var { useState, useEffect, useCallback } = React;
var COUNTER_KEY = "helloCounter";
function activate(ctx, api) {
  api.logging.info("Hello World plugin activated!");
  const cmd = api.commands.register("hello-world.greet", () => {
    api.ui.showNotice("Hello from the Clubhouse Workshop!");
  });
  ctx.subscriptions.push(cmd);
}
function deactivate() {
}
function MainPanel({ api }) {
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
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
    return /* @__PURE__ */ jsx("div", { style: { padding: 24 }, children: "Loading\u2026" });
  }
  return /* @__PURE__ */ jsxs("div", { style: { padding: 24, fontFamily: "var(--font-family, sans-serif)" }, children: [
    /* @__PURE__ */ jsx("h2", { style: { marginTop: 0 }, children: "Hello from Workshop!" }),
    /* @__PURE__ */ jsx("p", { style: { color: "var(--text-secondary, #888)" }, children: "This is a minimal Clubhouse plugin. It demonstrates storage, logging, and the notification API." }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 16
        },
        children: [
          /* @__PURE__ */ jsx("span", { style: { fontSize: 24, fontWeight: 600 }, children: count }),
          /* @__PURE__ */ jsx("button", { onClick: increment, children: "Increment" }),
          /* @__PURE__ */ jsx("button", { onClick: reset, children: "Reset" })
        ]
      }
    ),
    /* @__PURE__ */ jsx("p", { style: { marginTop: 24, fontSize: 13, color: "var(--text-tertiary, #666)" }, children: "The counter is persisted in project-local storage. It survives restarts." })
  ] });
}
export {
  MainPanel,
  activate,
  deactivate
};
