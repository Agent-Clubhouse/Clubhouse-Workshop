// src/main.tsx
import { useEffect, useState, useCallback, useRef } from "react";

// src/cron.ts
function parseField(field, min, max) {
  const values = /* @__PURE__ */ new Set();
  for (const part of field.split(",")) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    const step = stepMatch ? parseInt(stepMatch[2], 10) : 1;
    const range = stepMatch ? stepMatch[1] : part;
    if (step <= 0) continue;
    let start;
    let end;
    if (range === "*") {
      start = min;
      end = max;
    } else if (range.includes("-")) {
      const [a, b] = range.split("-").map(Number);
      start = a;
      end = b;
    } else {
      start = parseInt(range, 10);
      end = start;
    }
    start = Math.max(min, Math.min(max, start));
    end = Math.max(min, Math.min(max, end));
    for (let i = start; i <= end; i += step) {
      values.add(i);
    }
  }
  return values;
}
function matchesCron(expression, date) {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const minute = parseField(fields[0], 0, 59);
  const hour = parseField(fields[1], 0, 23);
  const dom = parseField(fields[2], 1, 31);
  const month = parseField(fields[3], 1, 12);
  const dow = parseField(fields[4], 0, 6);
  return minute.has(date.getMinutes()) && hour.has(date.getHours()) && dom.has(date.getDate()) && month.has(date.getMonth() + 1) && dow.has(date.getDay());
}
var FIELD_LIMITS = [
  [0, 59],
  // minute
  [0, 23],
  // hour
  [1, 31],
  // day of month
  [1, 12],
  // month
  [0, 6]
  // day of week
];
var FIELD_NAMES = ["minute", "hour", "day-of-month", "month", "day-of-week"];
function validateCronExpression(expression) {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return `Expected 5 fields, got ${fields.length}`;
  }
  for (let f = 0; f < 5; f++) {
    const [min, max] = FIELD_LIMITS[f];
    const fieldName = FIELD_NAMES[f];
    for (const part of fields[f].split(",")) {
      const stepMatch = part.match(/^(.+)\/(\d+)$/);
      const stepStr = stepMatch ? stepMatch[2] : null;
      const range = stepMatch ? stepMatch[1] : part;
      if (stepStr !== null) {
        const step = parseInt(stepStr, 10);
        if (step <= 0) {
          return `Invalid step value 0 in ${fieldName} field`;
        }
      }
      if (range === "*") {
      } else if (range.includes("-")) {
        const parts = range.split("-");
        if (parts.length !== 2) {
          return `Invalid range "${range}" in ${fieldName} field`;
        }
        const [a, b] = parts.map(Number);
        if (isNaN(a) || isNaN(b)) {
          return `Non-numeric range "${range}" in ${fieldName} field`;
        }
        if (a < min || a > max || b < min || b > max) {
          return `Value out of range (${min}-${max}) in ${fieldName} field`;
        }
        if (a > b) {
          return `Invalid range "${range}" in ${fieldName} field (start > end)`;
        }
      } else {
        const val = parseInt(range, 10);
        if (isNaN(val)) {
          return `Non-numeric value "${range}" in ${fieldName} field`;
        }
        if (val < min || val > max) {
          return `Value ${val} out of range (${min}-${max}) in ${fieldName} field`;
        }
      }
    }
  }
  return null;
}
var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function formatHour12(h) {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12} ${ampm}`;
}
function formatTime12(h, m) {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
function isContiguousRange(values) {
  if (values.size === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return null;
  }
  return { start: sorted[0], end: sorted[sorted.length - 1] };
}
function detectStep(values, min, max) {
  if (values.size <= 1) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted[0] !== min) return null;
  const step = sorted[1] - sorted[0];
  if (step <= 0) return null;
  for (let i = 2; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] !== step) return null;
  }
  if (sorted[sorted.length - 1] !== min + step * (sorted.length - 1)) return null;
  if (sorted[sorted.length - 1] + step > max + 1) return null;
  return step;
}
function describeDaySet(values) {
  if (values.size === 7) return "";
  if (values.size === 5) {
    const weekdays = /* @__PURE__ */ new Set([1, 2, 3, 4, 5]);
    if ([...values].every((v) => weekdays.has(v))) return "Monday through Friday";
  }
  if (values.size === 2) {
    const weekend = /* @__PURE__ */ new Set([0, 6]);
    if ([...values].every((v) => weekend.has(v))) return "Saturday and Sunday";
  }
  const range = isContiguousRange(values);
  if (range) {
    if (range.start === range.end) return DAY_NAMES[range.start];
    return `${DAY_NAMES[range.start]} through ${DAY_NAMES[range.end]}`;
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 2) return `${DAY_NAMES[sorted[0]]} and ${DAY_NAMES[sorted[1]]}`;
  return sorted.map((d) => DAY_NAMES[d]).join(", ");
}
function describeMonthSet(values) {
  if (values.size === 12) return "";
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return `in ${MONTH_NAMES[sorted[0]]}`;
  const range = isContiguousRange(values);
  if (range) return `${MONTH_NAMES[range.start]} through ${MONTH_NAMES[range.end]}`;
  return `in ${sorted.map((m) => MONTH_NAMES[m]).join(", ")}`;
}
function describeDomSet(values) {
  if (values.size === 31) return "";
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) {
    const d = sorted[0];
    const suffix = d === 1 || d === 21 || d === 31 ? "st" : d === 2 || d === 22 ? "nd" : d === 3 || d === 23 ? "rd" : "th";
    return `on the ${d}${suffix}`;
  }
  const range = isContiguousRange(values);
  if (range) return `on days ${range.start}\u2013${range.end}`;
  return `on days ${sorted.join(", ")}`;
}
function describeSchedule(expression) {
  const preset = PRESETS.find((p) => p.value === expression);
  if (preset) return preset.label;
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return expression;
  const [minF, hourF, domF, monF, dowF] = fields;
  const minutes = parseField(minF, 0, 59);
  const hours = parseField(hourF, 0, 23);
  const doms = parseField(domF, 1, 31);
  const months = parseField(monF, 1, 12);
  const dows = parseField(dowF, 0, 6);
  const allMinutes = minutes.size === 60;
  const allHours = hours.size === 24;
  const allDoms = doms.size === 31;
  const allMonths = months.size === 12;
  const allDows = dows.size === 7;
  const parts = [];
  const minuteStep = detectStep(minutes, 0, 59);
  const hourStep = detectStep(hours, 0, 23);
  if (allMinutes && allHours) {
    parts.push("Every minute");
  } else if (minuteStep && minuteStep > 1 && allHours) {
    parts.push(`Every ${minuteStep} minutes`);
  } else if (allMinutes && !allHours) {
    const hourRange = isContiguousRange(hours);
    if (hourRange) {
      parts.push(`Every minute from ${formatHour12(hourRange.start)} to ${formatHour12(hourRange.end)}`);
    } else {
      parts.push("Every minute during select hours");
    }
  } else if (minutes.size === 1 && allHours) {
    const m = [...minutes][0];
    parts.push(`Every hour at :${String(m).padStart(2, "0")}`);
  } else if (minutes.size === 1 && hourStep && hourStep > 1) {
    const m = [...minutes][0];
    if (m === 0) {
      parts.push(`Every ${hourStep} hours`);
    } else {
      parts.push(`Every ${hourStep} hours at :${String(m).padStart(2, "0")}`);
    }
  } else if (minutes.size === 1 && hours.size === 1) {
    const m = [...minutes][0];
    const h = [...hours][0];
    parts.push(`At ${formatTime12(h, m)}`);
  } else if (minutes.size === 1 && !allHours) {
    const m = [...minutes][0];
    const hourRange = isContiguousRange(hours);
    if (hourRange) {
      if (hourRange.start === hourRange.end) {
        parts.push(`At ${formatTime12(hourRange.start, m)}`);
      } else {
        parts.push(`Every hour from ${formatHour12(hourRange.start)} to ${formatHour12(hourRange.end)} at :${String(m).padStart(2, "0")}`);
      }
    } else if (hourStep && hourStep > 1) {
      parts.push(`Every ${hourStep} hours at :${String(m).padStart(2, "0")}`);
    } else {
      const times = [...hours].sort((a, b) => a - b).map((h) => formatTime12(h, m));
      if (times.length <= 3) {
        parts.push(`At ${times.join(", ")}`);
      } else {
        parts.push(`${times.length} times daily at :${String(m).padStart(2, "0")}`);
      }
    }
  } else if (minuteStep && minuteStep > 1 && !allHours) {
    const hourRange = isContiguousRange(hours);
    if (hourRange) {
      parts.push(`Every ${minuteStep} minutes from ${formatHour12(hourRange.start)} to ${formatHour12(hourRange.end)}`);
    } else {
      parts.push(`Every ${minuteStep} minutes during select hours`);
    }
  } else {
    parts.push(`${minF} ${hourF}`);
  }
  if (!allDows) {
    const dayDesc = describeDaySet(dows);
    if (dayDesc) parts.push(dayDesc);
  } else if (!allDoms) {
    const domDesc = describeDomSet(doms);
    if (domDesc) parts.push(domDesc);
  }
  if (!allMonths) {
    const monthDesc = describeMonthSet(months);
    if (monthDesc) parts.push(monthDesc);
  }
  if (parts.length === 0) return expression;
  let result = parts.join(", ");
  if (parts.length > 1 && parts[0].startsWith("At ")) {
  }
  return result;
}
function countMissedFireTimes(expression, from, to, maxMinutes = 20160) {
  const startMs = from.getTime();
  const endMs = to.getTime();
  if (endMs <= startMs) return 0;
  const cursor = new Date(startMs);
  cursor.setSeconds(0, 0);
  cursor.setTime(cursor.getTime() + 6e4);
  let count = 0;
  let iterations = 0;
  while (cursor.getTime() <= endMs && iterations < maxMinutes) {
    if (matchesCron(expression, cursor)) {
      count++;
    }
    cursor.setTime(cursor.getTime() + 6e4);
    iterations++;
  }
  return count;
}
var PRESETS = [
  { label: "Every 5 min", value: "*/5 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 2 hours", value: "0 */2 * * *" },
  { label: "Daily at 6 AM", value: "0 6 * * *" },
  { label: "Every Monday", value: "0 9 * * 1" },
  { label: "Saturday at noon", value: "0 12 * * 6" }
];

// src/styles.ts
var font = {
  family: "var(--font-family, system-ui, -apple-system, sans-serif)",
  mono: "var(--font-mono, ui-monospace, monospace)"
};
var color = {
  text: "var(--text-primary, #cdd6f4)",
  textSecondary: "var(--text-secondary, #bac2de)",
  textTertiary: "var(--text-tertiary, #a6adc8)",
  textMuted: "var(--text-muted, #6c7086)",
  bg: "var(--bg-primary, #1e1e2e)",
  bgSecondary: "var(--bg-secondary, #181825)",
  bgTertiary: "var(--bg-tertiary, #11111b)",
  bgSurface: "var(--bg-surface, #313244)",
  bgSurfaceHover: "var(--bg-surface-hover, #45475a)",
  bgSurfaceRaised: "var(--bg-surface-raised, #585b70)",
  bgActive: "var(--bg-active, #45475a)",
  border: "var(--border-primary, #313244)",
  borderSecondary: "var(--border-secondary, #45475a)",
  accent: "var(--text-accent, #89b4fa)",
  accentBg: "var(--bg-accent, rgba(137, 180, 250, 0.15))",
  accentBorder: "var(--border-accent, rgba(137, 180, 250, 0.3))",
  success: "var(--text-success, #a6e3a1)",
  successBg: "var(--bg-success, rgba(166, 227, 161, 0.15))",
  warning: "var(--text-warning, #f9e2af)",
  warningBg: "var(--bg-warning, rgba(249, 226, 175, 0.15))",
  error: "var(--text-error, #f38ba8)",
  errorBg: "var(--bg-error, rgba(243, 139, 168, 0.1))",
  errorBorder: "var(--border-error, rgba(243, 139, 168, 0.3))",
  blue: "var(--text-info, #89b4fa)",
  blueBg: "var(--bg-info, rgba(137, 180, 250, 0.15))",
  blueBorder: "var(--border-info, rgba(137, 180, 250, 0.3))"
};
var container = {
  display: "flex",
  height: "100%",
  background: color.bg,
  fontFamily: font.family,
  color: color.text
};
var sidebar = {
  width: 256,
  flexShrink: 0,
  borderRight: `1px solid ${color.border}`,
  background: color.bgSecondary,
  display: "flex",
  flexDirection: "column"
};
var sidebarHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  borderBottom: `1px solid ${color.border}`
};
var baseInput = {
  width: "100%",
  padding: "6px 12px",
  fontSize: 13,
  borderRadius: 8,
  background: color.bgSecondary,
  border: `1px solid ${color.bgSurfaceRaised}`,
  color: color.text,
  outline: "none",
  fontFamily: font.family
};
var baseButton = {
  padding: "4px 12px",
  fontSize: 12,
  borderRadius: 6,
  border: "none",
  background: "transparent",
  color: color.textTertiary,
  cursor: "pointer",
  fontFamily: font.family
};
var accentButton = {
  ...baseButton,
  background: color.accent,
  color: "var(--text-on-accent, #fff)",
  fontWeight: 500
};
var dangerButton = {
  ...baseButton,
  color: color.error,
  border: `1px solid ${color.errorBorder}`
};
var label = {
  display: "block",
  fontSize: 12,
  color: color.textSecondary,
  marginBottom: 4
};
var section = {
  padding: 16,
  borderBottom: `1px solid ${color.border}`
};
var statusDot = (status) => ({
  width: 6,
  height: 6,
  borderRadius: "50%",
  flexShrink: 0,
  background: status === "running" ? color.warning : status === "completed" ? color.success : color.error
});
var statusText = (status) => ({
  fontSize: 10,
  flexShrink: 0,
  color: status === "running" ? color.warning : status === "completed" ? color.success : color.error
});
var badge = (variant) => ({
  fontSize: 9,
  padding: "1px 4px",
  borderRadius: 4,
  flexShrink: 0,
  background: variant === "off" ? color.bgSurfaceRaised : variant === "running" ? color.successBg : color.blueBg,
  color: variant === "off" ? color.textTertiary : variant === "running" ? color.success : color.blue
});

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
var refreshSignal = {
  count: 0,
  listeners: /* @__PURE__ */ new Set(),
  trigger() {
    this.count++;
    for (const fn of this.listeners) fn();
  },
  subscribe(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
};
var AUTOMATIONS_KEY = "automations";
var runsKey = (automationId) => `runs:${automationId}`;
var MAX_RUNS = 50;
var MAX_CATCHUP = 10;
function activate(ctx, api) {
  const storage = api.storage.projectLocal;
  const pendingRuns = /* @__PURE__ */ new Map();
  async function fireAutomation(auto, automations) {
    const agentId = await api.agents.runQuick(auto.prompt, {
      model: auto.model || void 0,
      orchestrator: auto.orchestrator || void 0,
      freeAgentMode: auto.freeAgentMode || void 0
    });
    pendingRuns.set(agentId, auto.id);
    const runsRaw = await storage.read(runsKey(auto.id));
    const runs = Array.isArray(runsRaw) ? runsRaw : [];
    runs.unshift({
      agentId,
      automationId: auto.id,
      startedAt: Date.now(),
      status: "running",
      summary: null,
      exitCode: null,
      completedAt: null
    });
    if (runs.length > MAX_RUNS) runs.length = MAX_RUNS;
    await storage.write(runsKey(auto.id), runs);
    auto.lastRunAt = Date.now();
    await storage.write(AUTOMATIONS_KEY, automations);
  }
  const statusSub = api.agents.onStatusChange((agentId, status, prevStatus) => {
    const automationId = pendingRuns.get(agentId);
    if (!automationId) return;
    const isCompleted = prevStatus === "running" && status === "sleeping" || prevStatus === "running" && status === "error";
    if (!isCompleted) return;
    pendingRuns.delete(agentId);
    const completed = api.agents.listCompleted();
    const info = completed.find((c) => c.id === agentId);
    const runStatus = status === "sleeping" ? "completed" : "failed";
    storage.read(runsKey(automationId)).then((raw) => {
      const runs = Array.isArray(raw) ? raw : [];
      const idx = runs.findIndex((r) => r.agentId === agentId);
      if (idx !== -1) {
        runs[idx] = {
          ...runs[idx],
          status: runStatus,
          summary: info?.summary ?? null,
          exitCode: info?.exitCode ?? null,
          completedAt: Date.now()
        };
      }
      storage.write(runsKey(automationId), runs);
    });
    storage.read(AUTOMATIONS_KEY).then((raw) => {
      const automations = Array.isArray(raw) ? raw : [];
      const auto = automations.find((a) => a.id === automationId);
      if (auto) {
        auto.lastRunAt = Date.now();
        storage.write(AUTOMATIONS_KEY, automations);
      }
    });
  });
  ctx.subscriptions.push(statusSub);
  const tickInterval = setInterval(async () => {
    const now = /* @__PURE__ */ new Date();
    const raw = await storage.read(AUTOMATIONS_KEY);
    const automations = Array.isArray(raw) ? raw : [];
    for (const auto of automations) {
      if (!auto.enabled) continue;
      const policy = auto.missedRunPolicy || "ignore";
      if (policy !== "ignore" && auto.lastRunAt) {
        const lastRun = new Date(auto.lastRunAt);
        const missed = countMissedFireTimes(auto.cronExpression, lastRun, now);
        if (missed > 0) {
          const timesToFire = policy === "run-once" ? 1 : Math.min(missed, MAX_CATCHUP);
          for (let i = 0; i < timesToFire; i++) {
            try {
              await fireAutomation(auto, automations);
            } catch {
            }
          }
          continue;
        }
      }
      if (!matchesCron(auto.cronExpression, now)) continue;
      if (auto.lastRunAt) {
        const lastRun = new Date(auto.lastRunAt);
        if (lastRun.getMinutes() === now.getMinutes() && lastRun.getHours() === now.getHours() && lastRun.getDate() === now.getDate() && lastRun.getMonth() === now.getMonth() && lastRun.getFullYear() === now.getFullYear()) {
          continue;
        }
      }
      try {
        await fireAutomation(auto, automations);
      } catch {
      }
    }
  }, 3e4);
  ctx.subscriptions.push({ dispose: () => clearInterval(tickInterval) });
  const cmdSub = api.commands.register("create", () => {
  });
  ctx.subscriptions.push(cmdSub);
  const refreshSub = api.commands.register("refresh", () => {
    refreshSignal.trigger();
  });
  ctx.subscriptions.push(refreshSub);
  const runNowSub = api.commands.register("run-now", async (...args) => {
    const automationId = args[0];
    if (!automationId) return;
    const raw = await storage.read(AUTOMATIONS_KEY);
    const automations = Array.isArray(raw) ? raw : [];
    const auto = automations.find((a) => a.id === automationId);
    if (!auto) return;
    try {
      await fireAutomation(auto, automations);
      refreshSignal.trigger();
    } catch {
    }
  });
  ctx.subscriptions.push(runNowSub);
}
function deactivate() {
}
function generateId() {
  return `auto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString(void 0, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
function MainPanel({ api }) {
  const { style: themeStyle } = useTheme(api.theme);
  const storage = api.storage.projectLocal;
  const [automations, setAutomations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [runs, setRuns] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [orchestrators, setOrchestrators] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [runningIds, setRunningIds] = useState(/* @__PURE__ */ new Set());
  const [expandedRunId, setExpandedRunId] = useState(null);
  const [completedAgents, setCompletedAgents] = useState([]);
  const [editName, setEditName] = useState("");
  const [editCron, setEditCron] = useState("");
  const [editOrchestrator, setEditOrchestrator] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editFreeAgent, setEditFreeAgent] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editMissedRunPolicy, setEditMissedRunPolicy] = useState("ignore");
  const [cronError, setCronError] = useState(null);
  const loadAutomations = useCallback(async () => {
    const raw = await storage.read(AUTOMATIONS_KEY);
    const list = Array.isArray(raw) ? raw : [];
    setAutomations(list);
    const running = /* @__PURE__ */ new Set();
    for (const auto of list) {
      const runsRaw = await storage.read(runsKey(auto.id));
      const autoRuns = Array.isArray(runsRaw) ? runsRaw : [];
      if (autoRuns.some((r) => r.status === "running")) running.add(auto.id);
    }
    setRunningIds(running);
    if (!loaded) setLoaded(true);
  }, [storage, loaded]);
  useEffect(() => {
    loadAutomations();
    const iv = setInterval(loadAutomations, 1e4);
    const unsub = refreshSignal.subscribe(loadAutomations);
    return () => {
      clearInterval(iv);
      unsub();
    };
  }, [loadAutomations]);
  useEffect(() => {
    setOrchestrators(api.agents.listOrchestrators());
  }, [api]);
  useEffect(() => {
    api.agents.getModelOptions(void 0, editOrchestrator || void 0).then(setModelOptions);
  }, [api, editOrchestrator]);
  const selected = automations.find((a) => a.id === selectedId) ?? null;
  useEffect(() => {
    if (selected) {
      setEditName(selected.name);
      setEditCron(selected.cronExpression);
      setEditOrchestrator(selected.orchestrator ?? "");
      setEditModel(selected.model);
      setEditFreeAgent(selected.freeAgentMode ?? false);
      setEditPrompt(selected.prompt);
      setEditEnabled(selected.enabled);
      setEditMissedRunPolicy(selected.missedRunPolicy ?? "ignore");
      setCronError(null);
    }
  }, [selected?.id]);
  const loadRuns = useCallback(async () => {
    if (!selectedId) {
      setRuns([]);
      return;
    }
    const raw = await storage.read(runsKey(selectedId));
    setRuns(Array.isArray(raw) ? raw : []);
    setCompletedAgents(api.agents.listCompleted());
  }, [storage, selectedId, api]);
  useEffect(() => {
    loadRuns();
    const iv = setInterval(loadRuns, 5e3);
    return () => clearInterval(iv);
  }, [loadRuns]);
  const createAutomation = useCallback(async () => {
    const auto = {
      id: generateId(),
      name: "New Automation",
      cronExpression: "0 * * * *",
      orchestrator: "",
      model: "",
      freeAgentMode: false,
      prompt: "",
      enabled: false,
      missedRunPolicy: "ignore",
      createdAt: Date.now(),
      lastRunAt: null
    };
    const next = [...automations, auto];
    await storage.write(AUTOMATIONS_KEY, next);
    setAutomations(next);
    setSelectedId(auto.id);
  }, [automations, storage]);
  const saveAutomation = useCallback(async () => {
    if (!selectedId) return;
    const error = validateCronExpression(editCron);
    if (error) {
      setCronError(error);
      return;
    }
    setCronError(null);
    const next = automations.map(
      (a) => a.id === selectedId ? { ...a, name: editName, cronExpression: editCron, orchestrator: editOrchestrator, model: editModel, freeAgentMode: editFreeAgent, prompt: editPrompt, enabled: editEnabled, missedRunPolicy: editMissedRunPolicy } : a
    );
    await storage.write(AUTOMATIONS_KEY, next);
    setAutomations(next);
  }, [selectedId, automations, storage, editName, editCron, editOrchestrator, editModel, editFreeAgent, editPrompt, editEnabled, editMissedRunPolicy]);
  const deleteAutomation = useCallback(async () => {
    if (!selectedId) return;
    const next = automations.filter((a) => a.id !== selectedId);
    await storage.write(AUTOMATIONS_KEY, next);
    await storage.delete(runsKey(selectedId));
    setAutomations(next);
    setSelectedId(next.length > 0 ? next[0].id : null);
  }, [selectedId, automations, storage]);
  const toggleEnabled = useCallback(async (id) => {
    const next = automations.map(
      (a) => a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    await storage.write(AUTOMATIONS_KEY, next);
    setAutomations(next);
    if (id === selectedId) setEditEnabled(!editEnabled);
  }, [automations, storage, selectedId, editEnabled]);
  const runNow = useCallback(async (id) => {
    await api.commands.execute("run-now", id);
    await loadAutomations();
    await loadRuns();
  }, [api, loadAutomations, loadRuns]);
  const deleteRun = useCallback(async (agentId) => {
    if (!selectedId) return;
    const raw = await storage.read(runsKey(selectedId));
    const current = Array.isArray(raw) ? raw : [];
    const next = current.filter((r) => r.agentId !== agentId);
    await storage.write(runsKey(selectedId), next);
    setRuns(next);
  }, [selectedId, storage]);
  const actionsRef = useRef({ createAutomation, saveAutomation, deleteAutomation, toggleEnabled, runNow, deleteRun });
  actionsRef.current = { createAutomation, saveAutomation, deleteAutomation, toggleEnabled, runNow, deleteRun };
  if (!loaded) {
    return /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: color.textTertiary, fontSize: 12 }, children: "Loading automations..." });
  }
  return /* @__PURE__ */ jsxs("div", { style: { ...themeStyle, ...container }, children: [
    /* @__PURE__ */ jsxs("div", { style: sidebar, children: [
      /* @__PURE__ */ jsxs("div", { style: sidebarHeader, children: [
        /* @__PURE__ */ jsx("span", { style: { fontSize: 12, fontWeight: 500, color: color.text }, children: "Automations" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            style: { ...baseButton, color: color.textTertiary },
            onClick: () => actionsRef.current.createAutomation(),
            title: "Add automation",
            children: "+ Add"
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { style: { flex: 1, overflowY: "auto" }, children: automations.length === 0 ? /* @__PURE__ */ jsx("div", { style: { padding: "16px 12px", fontSize: 12, color: color.textTertiary, textAlign: "center" }, children: "No automations yet" }) : /* @__PURE__ */ jsx("div", { style: { padding: "2px 0" }, children: automations.map((auto) => /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 12px",
            cursor: "pointer",
            transition: "background 0.15s",
            background: auto.id === selectedId ? color.bgSurfaceHover : "transparent"
          },
          onClick: () => setSelectedId(auto.id),
          children: /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [
              /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: auto.name || "Untitled" }),
              /* @__PURE__ */ jsx("span", { style: badge(
                !auto.enabled ? "off" : runningIds.has(auto.id) ? "running" : "on"
              ), children: !auto.enabled ? "off" : runningIds.has(auto.id) ? "running" : "on" })
            ] }),
            /* @__PURE__ */ jsx("div", { style: { fontSize: 10, color: color.textTertiary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: describeSchedule(auto.cronExpression) })
          ] })
        },
        auto.id
      )) }) })
    ] }),
    selected ? /* @__PURE__ */ jsxs("div", { style: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }, children: [
      /* @__PURE__ */ jsxs("div", { style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        borderBottom: `1px solid ${color.border}`,
        background: color.bgSecondary,
        flexShrink: 0
      }, children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              style: {
                width: 36,
                height: 20,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: editEnabled ? color.accent : color.bgSurface,
                position: "relative",
                transition: "background 0.2s"
              },
              onClick: () => setEditEnabled(!editEnabled),
              children: /* @__PURE__ */ jsx("span", { style: {
                position: "absolute",
                top: 2,
                left: editEnabled ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "var(--text-on-accent, #fff)",
                transition: "left 0.2s"
              } })
            }
          ),
          /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: color.textSecondary, width: 56 }, children: editEnabled ? "Enabled" : "Disabled" })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            style: accentButton,
            onClick: () => actionsRef.current.saveAutomation(),
            children: "Save"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            style: {
              ...baseButton,
              background: color.successBg,
              color: color.success,
              border: `1px solid ${color.success}`,
              fontWeight: 500
            },
            onClick: () => actionsRef.current.runNow(selected.id),
            title: "Run this automation immediately (ignores schedule and enabled state)",
            children: "Run Now"
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
        /* @__PURE__ */ jsx(
          "button",
          {
            style: dangerButton,
            onClick: async () => {
              const ok = await api.ui.showConfirm("Delete this automation and its run history? This cannot be undone.");
              if (ok) await deleteAutomation();
            },
            children: "Delete"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { ...section, display: "flex", flexDirection: "column", gap: 12 }, children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: label, children: "Name" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              style: baseInput,
              value: editName,
              onChange: (e) => setEditName(e.target.value)
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: { ...label, marginBottom: 6 }, children: "Schedule" }),
          /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }, children: PRESETS.map((p) => /* @__PURE__ */ jsx(
            "button",
            {
              style: {
                padding: "4px 10px",
                fontSize: 12,
                borderRadius: 6,
                cursor: "pointer",
                transition: "all 0.15s",
                background: editCron === p.value ? color.blueBg : color.bgSurface,
                color: editCron === p.value ? color.blue : color.textSecondary,
                border: editCron === p.value ? `1px solid ${color.blueBorder}` : `1px solid ${color.borderSecondary}`
              },
              onClick: () => setEditCron(p.value),
              children: p.label
            },
            p.value
          )) }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              style: { ...baseInput, fontFamily: font.mono },
              value: editCron,
              onChange: (e) => {
                setEditCron(e.target.value);
                setCronError(null);
              },
              placeholder: "* * * * *  (min hour dom month dow)"
            }
          ),
          /* @__PURE__ */ jsx("div", { style: { fontSize: 10, color: color.textTertiary, marginTop: 4 }, children: describeSchedule(editCron) }),
          cronError && /* @__PURE__ */ jsx("div", { style: { fontSize: 11, color: color.error, marginTop: 4 }, children: cronError })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: label, children: "If Runs Were Missed" }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              style: { ...baseInput, cursor: "pointer" },
              value: editMissedRunPolicy,
              onChange: (e) => setEditMissedRunPolicy(e.target.value),
              children: [
                /* @__PURE__ */ jsx("option", { value: "ignore", children: "Do Nothing" }),
                /* @__PURE__ */ jsx("option", { value: "run-once", children: "Run Once (catch up with a single run)" }),
                /* @__PURE__ */ jsx("option", { value: "run-all", children: "Run All (up to 10 catch-up runs)" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs("div", { style: { fontSize: 10, color: color.textTertiary, marginTop: 4 }, children: [
            editMissedRunPolicy === "ignore" && "Skipped runs are silently ignored",
            editMissedRunPolicy === "run-once" && "Fires one catch-up run when the app resumes",
            editMissedRunPolicy === "run-all" && "Fires up to 10 catch-up runs when the app resumes"
          ] })
        ] }),
        orchestrators.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: label, children: "Orchestrator" }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              style: { ...baseInput, cursor: "pointer" },
              value: editOrchestrator,
              onChange: (e) => {
                setEditOrchestrator(e.target.value);
                setEditModel("");
              },
              children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "Default" }),
                orchestrators.map((o) => /* @__PURE__ */ jsxs("option", { value: o.id, children: [
                  o.displayName,
                  o.badge ? ` ${o.badge}` : ""
                ] }, o.id))
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: label, children: "Model" }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              style: { ...baseInput, cursor: "pointer" },
              value: editModel,
              onChange: (e) => setEditModel(e.target.value),
              children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "Default" }),
                modelOptions.map((m) => /* @__PURE__ */ jsx("option", { value: m.id, children: m.label }, m.id))
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs(
            "label",
            {
              style: { ...label, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
              onClick: () => setEditFreeAgent(!editFreeAgent),
              children: [
                /* @__PURE__ */ jsx(
                  "span",
                  {
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      border: `1px solid ${editFreeAgent ? color.accent : color.borderSecondary}`,
                      background: editFreeAgent ? color.accent : "transparent",
                      transition: "all 0.15s",
                      flexShrink: 0
                    },
                    children: editFreeAgent && /* @__PURE__ */ jsx("svg", { width: "10", height: "10", viewBox: "0 0 12 12", fill: "none", stroke: "var(--text-on-accent, #fff)", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsx("polyline", { points: "2 6 5 9 10 3" }) })
                  }
                ),
                "Free Agent Mode"
              ]
            }
          ),
          /* @__PURE__ */ jsx("div", { style: { fontSize: 10, color: color.textTertiary, marginTop: 2, marginLeft: 24 }, children: "Agent runs with full autonomy \u2014 no permission prompts" })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { style: label, children: "Prompt" }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              style: {
                ...baseInput,
                fontFamily: font.mono,
                resize: "vertical",
                minHeight: 80
              },
              rows: 4,
              value: editPrompt,
              onChange: (e) => setEditPrompt(e.target.value),
              placeholder: "Enter the mission for the agent..."
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { padding: 16 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: 12, fontWeight: 500, color: color.text, marginBottom: 8 }, children: "Run History" }),
        runs.length === 0 ? /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: color.textTertiary }, children: "No runs yet" }) : /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: runs.slice(0, 20).map((run) => /* @__PURE__ */ jsxs(
          "div",
          {
            style: { padding: "8px 10px", background: color.bgSecondary, borderRadius: 6, fontSize: 12 },
            children: [
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ jsx("span", { style: statusDot(run.status) }),
                /* @__PURE__ */ jsx("span", { style: { color: color.textTertiary, flexShrink: 0 }, children: formatTime(run.startedAt) }),
                /* @__PURE__ */ jsx("span", { style: statusText(run.status), children: run.status === "running" ? "running" : run.status }),
                /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
                run.status === "running" ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      style: {
                        padding: "2px 8px",
                        fontSize: 11,
                        borderRadius: 4,
                        background: color.accentBg,
                        color: color.accent,
                        border: `1px solid ${color.accentBorder}`,
                        cursor: "pointer"
                      },
                      onClick: () => api.navigation.focusAgent(run.agentId),
                      children: "View"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      style: {
                        padding: "2px 8px",
                        fontSize: 11,
                        borderRadius: 4,
                        color: color.error,
                        border: `1px solid ${color.errorBorder}`,
                        background: "transparent",
                        cursor: "pointer"
                      },
                      onClick: () => api.agents.kill(run.agentId),
                      children: "Stop"
                    }
                  )
                ] }) : /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      style: {
                        padding: "2px 8px",
                        fontSize: 11,
                        borderRadius: 4,
                        cursor: "pointer",
                        background: expandedRunId === run.agentId ? color.accent : color.accentBg,
                        color: expandedRunId === run.agentId ? "var(--text-on-accent, #fff)" : color.accent,
                        border: expandedRunId === run.agentId ? "none" : `1px solid ${color.accentBorder}`
                      },
                      onClick: () => setExpandedRunId(expandedRunId === run.agentId ? null : run.agentId),
                      children: "Summary"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      style: {
                        padding: "2px 8px",
                        fontSize: 11,
                        borderRadius: 4,
                        color: color.error,
                        border: `1px solid ${color.errorBorder}`,
                        background: "transparent",
                        cursor: "pointer"
                      },
                      onClick: async () => {
                        const ok = await api.ui.showConfirm("Delete this run record? This cannot be undone.");
                        if (ok) actionsRef.current.deleteRun(run.agentId);
                      },
                      children: "Delete"
                    }
                  )
                ] })
              ] }),
              expandedRunId === run.agentId && (() => {
                const completed = completedAgents.find((c) => c.id === run.agentId);
                if (completed) {
                  return /* @__PURE__ */ jsx("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ jsx(
                    api.widgets.QuickAgentGhost,
                    {
                      completed,
                      onDismiss: () => setExpandedRunId(null)
                    }
                  ) });
                }
                return run.summary ? /* @__PURE__ */ jsx("div", { style: {
                  marginTop: 8,
                  padding: 10,
                  background: color.bgSurface,
                  borderRadius: 6,
                  fontSize: 11,
                  color: color.textSecondary,
                  lineHeight: 1.6
                }, children: run.summary }) : null;
              })()
            ]
          },
          run.agentId
        )) })
      ] })
    ] }) : /* @__PURE__ */ jsx("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: color.textTertiary, fontSize: 12 }, children: automations.length === 0 ? "Create an automation to get started" : "Select an automation to edit" })
  ] });
}
export {
  MainPanel,
  activate,
  deactivate
};
