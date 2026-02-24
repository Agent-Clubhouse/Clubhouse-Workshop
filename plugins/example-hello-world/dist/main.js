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
  const { style: themeStyle } = useTheme(api.theme);
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
  return /* @__PURE__ */ jsxs("div", { style: { ...themeStyle, padding: 24, fontFamily: "var(--font-family, sans-serif)" }, children: [
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
