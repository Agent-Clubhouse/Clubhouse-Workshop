// src/types.ts
var idCounter = 0;
function generateId() {
  return `${Date.now()}-${++idCounter}`;
}
function todayKey() {
  return formatDate(/* @__PURE__ */ new Date());
}
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function formatTime(time) {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}
function isOverdue(todo, today) {
  return todo.dueDate != null && todo.dueDate < today && (todo.state === "to-do" || todo.state === "carried-fwd");
}
function createEmptyNote(date) {
  return { date, schedule: [], todos: [], reminders: [] };
}
function carryForward(previousNote, newNote) {
  const carried = previousNote.todos.filter((t) => t.state === "to-do" || t.state === "carried-fwd").map((t) => ({ ...t, id: generateId(), state: "carried-fwd" }));
  return {
    ...newNote,
    todos: [...carried, ...newNote.todos]
  };
}
function sortSchedule(blocks) {
  return [...blocks].sort((a, b) => a.time.localeCompare(b.time));
}
function currentBlock(schedule, now) {
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const sorted = sortSchedule(schedule);
  let current = null;
  for (const block of sorted) {
    if (block.time <= nowTime) current = block;
    else break;
  }
  return current;
}

// src/storage.ts
var NOTES_KEY = "daily-notes";
async function loadNotes(storage) {
  const data = await storage.read(NOTES_KEY);
  return data ?? {};
}
async function saveNotes(storage, notes) {
  await storage.write(NOTES_KEY, notes);
}
async function saveNote(storage, note) {
  const notes = await loadNotes(storage);
  notes[note.date] = note;
  await saveNotes(storage, notes);
}
async function ensureToday(storage, today) {
  const notes = await loadNotes(storage);
  if (notes[today]) return notes[today];
  const dates = Object.keys(notes).filter((d) => d < today).sort();
  const previousDate = dates.length > 0 ? dates[dates.length - 1] : null;
  let note = createEmptyNote(today);
  if (previousDate) {
    note = carryForward(notes[previousDate], note);
  }
  notes[today] = note;
  await saveNotes(storage, notes);
  return note;
}

// src/styles.ts
var color = {
  bg: "var(--bg-primary, #1a1a2e)",
  bgSecondary: "var(--bg-secondary, #16213e)",
  bgTertiary: "var(--bg-tertiary, #0f3460)",
  text: "var(--text-primary, #e0e0e0)",
  textSecondary: "var(--text-secondary, #a0a0a0)",
  textTertiary: "var(--text-tertiary, #707070)",
  accent: "var(--text-accent, #5dade2)",
  border: "var(--border-primary, #2a2a4a)",
  textError: "var(--text-error, #e74c3c)",
  textWarning: "var(--text-warning, #f39c12)",
  textSuccess: "var(--text-success, #27ae60)"
};
var font = {
  family: 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
  mono: 'var(--font-mono, "SF Mono", Menlo, monospace)'
};

// src/main.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var React = globalThis.React;
var { useState, useEffect, useCallback } = React;
function activate(ctx, api) {
  api.commands.register("daily-admin.refresh", () => {
  });
  api.commands.register("daily-admin.new-todo", async () => {
    const task = await api.ui.showInput("New to-do:");
    if (!task) return;
    const today = todayKey();
    const note = await ensureToday(api.storage.global, today);
    note.todos.push({ id: generateId(), task, detail: "", linked: "", dueDate: null, state: "to-do" });
    await saveNote(api.storage.global, note);
    api.ui.showNotice("To-do added");
  });
  api.commands.register("daily-admin.new-schedule", async () => {
    const input = await api.ui.showInput('Schedule block (e.g. "09:00 Standup"):');
    if (!input) return;
    const spaceIdx = input.indexOf(" ");
    const time = spaceIdx > 0 ? input.slice(0, spaceIdx) : input;
    const event = spaceIdx > 0 ? input.slice(spaceIdx + 1) : "Untitled";
    const today = todayKey();
    const note = await ensureToday(api.storage.global, today);
    note.schedule.push({ id: generateId(), time, event, detail: "", people: "", actionItems: "" });
    await saveNote(api.storage.global, note);
    api.ui.showNotice("Schedule block added");
  });
}
function deactivate() {
}
function ScheduleSection({ schedule, now }) {
  const sorted = sortSchedule(schedule);
  const active = currentBlock(schedule, now);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h3", { style: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: color.textSecondary, margin: "0 0 8px 0" }, children: "Schedule" }),
    sorted.length === 0 ? /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: color.textTertiary, fontStyle: "italic" }, children: "No schedule blocks today" }) : /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: sorted.map((block) => {
      const isActive = active?.id === block.id;
      return /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            display: "flex",
            gap: 8,
            padding: "4px 8px",
            borderRadius: 4,
            background: isActive ? color.bgTertiary : "transparent",
            borderLeft: isActive ? `3px solid ${color.accent}` : "3px solid transparent"
          },
          children: [
            /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: color.textTertiary, fontFamily: font.mono, minWidth: 60 }, children: formatTime(block.time) }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: isActive ? color.text : color.textSecondary, fontWeight: isActive ? 500 : 400 }, children: block.event }),
            block.detail && /* @__PURE__ */ jsx("span", { style: { fontSize: 11, color: color.textTertiary, marginLeft: "auto" }, children: block.detail })
          ]
        },
        block.id
      );
    }) })
  ] });
}
var STATE_ICONS = {
  "to-do": "[ ]",
  "done": "[x]",
  "carried-fwd": "[>]",
  "cancelled": "[-]"
};
function TodosSection({ todos, today, onToggle }) {
  const active = todos.filter((t) => t.state !== "done" && t.state !== "cancelled");
  const completed = todos.filter((t) => t.state === "done" || t.state === "cancelled");
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h3", { style: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: color.textSecondary, margin: "0 0 8px 0" }, children: "To-Dos" }),
    todos.length === 0 ? /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: color.textTertiary, fontStyle: "italic" }, children: "No to-dos today" }) : /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: [
      active.map((todo) => {
        const overdue = isOverdue(todo, today);
        return /* @__PURE__ */ jsxs(
          "div",
          {
            onClick: () => onToggle(todo.id),
            style: {
              display: "flex",
              gap: 8,
              padding: "4px 8px",
              borderRadius: 4,
              cursor: "pointer",
              alignItems: "baseline"
            },
            children: [
              /* @__PURE__ */ jsx("span", { style: { fontSize: 12, fontFamily: font.mono, color: todo.state === "carried-fwd" ? color.textWarning : color.textSecondary }, children: STATE_ICONS[todo.state] }),
              /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: overdue ? color.textError : color.text }, children: todo.task }),
              todo.state === "carried-fwd" && /* @__PURE__ */ jsx("span", { style: { fontSize: 10, color: color.textWarning }, children: "(fwd)" }),
              todo.dueDate && /* @__PURE__ */ jsx("span", { style: { fontSize: 10, color: overdue ? color.textError : color.textTertiary, marginLeft: "auto" }, children: todo.dueDate })
            ]
          },
          todo.id
        );
      }),
      completed.map((todo) => /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            display: "flex",
            gap: 8,
            padding: "4px 8px",
            borderRadius: 4,
            opacity: 0.5
          },
          children: [
            /* @__PURE__ */ jsx("span", { style: { fontSize: 12, fontFamily: font.mono, color: color.textTertiary }, children: STATE_ICONS[todo.state] }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: color.textTertiary, textDecoration: "line-through" }, children: todo.task })
          ]
        },
        todo.id
      ))
    ] })
  ] });
}
function RemindersSection({ reminders, onDismiss }) {
  const visible = reminders.filter((r) => !r.dismissed);
  if (visible.length === 0) return null;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h3", { style: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: color.textSecondary, margin: "0 0 8px 0" }, children: "Things to Remember" }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: visible.map((r) => /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderRadius: 4,
          background: color.bgSecondary,
          border: `1px solid ${color.border}`
        },
        children: [
          /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: color.textSecondary, flex: 1 }, children: r.text }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => onDismiss(r.id),
              style: {
                background: "none",
                border: "none",
                color: color.textTertiary,
                cursor: "pointer",
                fontSize: 14,
                padding: "0 4px"
              },
              children: "x"
            }
          )
        ]
      },
      r.id
    )) })
  ] });
}
function MainPanel({ api }) {
  const [note, setNote] = useState(null);
  const [now, setNow] = useState(/* @__PURE__ */ new Date());
  const today = todayKey();
  const loadData = useCallback(async () => {
    const n = await ensureToday(api.storage.global, today);
    setNote(n);
  }, [api, today]);
  useEffect(() => {
    loadData();
  }, [loadData]);
  useEffect(() => {
    const interval = setInterval(() => setNow(/* @__PURE__ */ new Date()), 6e4);
    return () => clearInterval(interval);
  }, []);
  const handleToggleTodo = useCallback(async (id) => {
    if (!note) return;
    const updated = {
      ...note,
      todos: note.todos.map(
        (t) => t.id === id ? { ...t, state: t.state === "done" ? "to-do" : "done" } : t
      )
    };
    setNote(updated);
    await saveNote(api.storage.global, updated);
  }, [note, api]);
  const handleDismissReminder = useCallback(async (id) => {
    if (!note) return;
    const updated = {
      ...note,
      reminders: note.reminders.map(
        (r) => r.id === id ? { ...r, dismissed: true } : r
      )
    };
    setNote(updated);
    await saveNote(api.storage.global, updated);
  }, [note, api]);
  if (!note) {
    return /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: color.textTertiary, fontFamily: font.family }, children: "Loading..." });
  }
  const dayName = (/* @__PURE__ */ new Date(today + "T12:00:00")).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", height: "100%", background: color.bg, fontFamily: font.family, overflow: "auto" }, children: [
    /* @__PURE__ */ jsx("div", { style: {
      padding: "12px 20px",
      borderBottom: `1px solid ${color.border}`,
      background: color.bgSecondary
    }, children: /* @__PURE__ */ jsxs("div", { style: { fontSize: 14, fontWeight: 600, color: color.text }, children: [
      "Today: ",
      dayName
    ] }) }),
    /* @__PURE__ */ jsxs("div", { style: {
      flex: 1,
      padding: 20,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr auto",
      gap: 20,
      overflow: "auto"
    }, children: [
      /* @__PURE__ */ jsx(ScheduleSection, { schedule: note.schedule, now }),
      /* @__PURE__ */ jsx(TodosSection, { todos: note.todos, today, onToggle: handleToggleTodo }),
      /* @__PURE__ */ jsx("div", { style: { gridColumn: "1 / -1" }, children: /* @__PURE__ */ jsx(RemindersSection, { reminders: note.reminders, onDismiss: handleDismissReminder }) })
    ] })
  ] });
}
export {
  MainPanel,
  activate,
  deactivate
};
