// src/state.ts
function filtersEqual(a, b) {
  return a.searchQuery === b.searchQuery && a.priorityFilter === b.priorityFilter && a.labelFilter === b.labelFilter && a.stuckOnly === b.stuckOnly;
}
function boardsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].updatedAt !== b[i].updatedAt) return false;
  }
  return true;
}
var kanBossState = {
  selectedBoardId: null,
  boards: [],
  refreshCount: 0,
  // Dialog state
  editingCardId: null,
  // null=closed, 'new'=creating, cardId=editing
  editingStateId: null,
  // target state for new card
  editingSwimlaneId: null,
  // target swimlane for new card
  configuringBoard: false,
  // Filter state
  filter: {
    searchQuery: "",
    priorityFilter: "all",
    labelFilter: "all",
    stuckOnly: false
  },
  listeners: /* @__PURE__ */ new Set(),
  selectBoard(id) {
    this.selectedBoardId = id;
    this.editingCardId = null;
    this.configuringBoard = false;
    this.notify();
  },
  setBoards(boards) {
    if (boardsEqual(this.boards, boards)) return;
    this.boards = boards;
    this.notify();
  },
  openNewCard(stateId, swimlaneId) {
    this.editingCardId = "new";
    this.editingStateId = stateId;
    this.editingSwimlaneId = swimlaneId;
    this.notify();
  },
  openEditCard(cardId) {
    this.editingCardId = cardId;
    this.editingStateId = null;
    this.editingSwimlaneId = null;
    this.notify();
  },
  closeCardDialog() {
    this.editingCardId = null;
    this.editingStateId = null;
    this.editingSwimlaneId = null;
    this.notify();
  },
  openBoardConfig() {
    this.configuringBoard = true;
    this.notify();
  },
  closeBoardConfig() {
    this.configuringBoard = false;
    this.notify();
  },
  setFilter(updates) {
    this.filter = { ...this.filter, ...updates };
    this.notify();
  },
  clearFilter() {
    this.filter = { searchQuery: "", priorityFilter: "all", labelFilter: "all", stuckOnly: false };
    this.notify();
  },
  triggerRefresh() {
    this.refreshCount++;
    this.notify();
  },
  subscribe(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  },
  notify() {
    for (const fn of this.listeners) {
      fn();
    }
  },
  switchProject() {
    this.reset();
  },
  reset() {
    this.selectedBoardId = null;
    this.boards = [];
    this.refreshCount = 0;
    this.editingCardId = null;
    this.editingStateId = null;
    this.editingSwimlaneId = null;
    this.configuringBoard = false;
    this.filter = { searchQuery: "", priorityFilter: "all", labelFilter: "all", stuckOnly: false };
    this.listeners.clear();
  }
};

// src/types.ts
var BOARDS_KEY = "boards";
var cardsKey = (boardId) => `cards:${boardId}`;
var AUTOMATION_RUNS_KEY = "automation-runs";
var PRIORITY_CONFIG = {
  none: { label: "None", color: "", hidden: true },
  low: { label: "Low", color: "var(--text-info, #3b82f6)" },
  medium: { label: "Medium", color: "var(--text-warning, #eab308)" },
  high: { label: "High", color: "var(--text-warning-high, #f97316)" },
  critical: { label: "Critical", color: "var(--text-error, #ef4444)" }
};
var PRIORITY_RANK = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4
};
var LABEL_COLORS = [
  "#3b82f6",
  // blue
  "#22c55e",
  // green
  "#f97316",
  // orange
  "#ef4444",
  // red
  "#a855f7",
  // purple
  "#ec4899",
  // pink
  "#06b6d4",
  // cyan
  "#eab308"
  // yellow
];
function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function isCardStuck(card) {
  for (let i = card.history.length - 1; i >= 0; i--) {
    if (card.history[i].action === "automation-stuck") return true;
    if (card.history[i].action === "moved") return false;
  }
  return false;
}
function isCardAutomating(card) {
  for (let i = card.history.length - 1; i >= 0; i--) {
    const a = card.history[i].action;
    if (a === "automation-started") return true;
    if (a === "automation-succeeded" || a === "automation-failed" || a === "automation-stuck" || a === "moved") return false;
  }
  return false;
}

// src/storageQueue.ts
var mutexes = /* @__PURE__ */ new Map();
function getMutex(storageRef, key) {
  const compositeKey = `${storageRef.__id ?? "default"}::${key}`;
  let entry = mutexes.get(compositeKey);
  if (!entry) {
    entry = { tail: Promise.resolve() };
    mutexes.set(compositeKey, entry);
  }
  return entry;
}
async function mutateStorage(storage, key, updater) {
  const mutex = getMutex(storage, key);
  let resolve;
  const gate = new Promise((r) => {
    resolve = r;
  });
  const predecessor = mutex.tail;
  mutex.tail = gate;
  await predecessor;
  try {
    const raw = await storage.read(key);
    const current = Array.isArray(raw) ? raw : [];
    const next = await updater(current);
    await storage.write(key, next);
    return next;
  } finally {
    resolve();
  }
}

// src/styles.ts
var font = {
  family: "var(--font-family, system-ui, -apple-system, sans-serif)",
  mono: "var(--font-mono, ui-monospace, monospace)"
};
var color = {
  // Text
  text: "var(--text-primary, #e4e4e7)",
  textSecondary: "var(--text-secondary, #a1a1aa)",
  textTertiary: "var(--text-tertiary, #71717a)",
  textError: "var(--text-error, #f87171)",
  textSuccess: "var(--text-success, #22c55e)",
  textWarning: "var(--text-warning, #eab308)",
  textInfo: "var(--text-info, #3b82f6)",
  textAccent: "var(--text-accent, #8b5cf6)",
  textOnBadge: "var(--text-on-badge, #fff)",
  // Backgrounds
  bg: "var(--bg-primary, #18181b)",
  bgSecondary: "var(--bg-secondary, #27272a)",
  bgTertiary: "var(--bg-tertiary, #333338)",
  bgActive: "var(--bg-active, #3f3f46)",
  bgError: "var(--bg-error, #2a1515)",
  bgSuccess: "var(--bg-success, rgba(34, 197, 94, 0.15))",
  bgInfo: "var(--bg-info, rgba(59, 130, 246, 0.1))",
  bgErrorSubtle: "var(--bg-error-subtle, rgba(248, 113, 113, 0.05))",
  // Borders
  border: "var(--border-primary, #3f3f46)",
  borderSecondary: "var(--border-secondary, #52525b)",
  borderError: "var(--border-error, rgba(248, 113, 113, 0.3))",
  borderInfo: "var(--border-info, rgba(59, 130, 246, 0.3))",
  // Accent
  accent: "var(--text-accent, #8b5cf6)",
  accentBg: "var(--bg-accent, rgba(139, 92, 246, 0.15))",
  // Glows (card state indicators)
  glowError: "var(--glow-error, rgba(248, 113, 113, 0.3))",
  glowAccent: "var(--glow-accent, rgba(139, 92, 246, 0.3))",
  // Shadows & overlays
  shadow: "var(--shadow, rgba(0, 0, 0, 0.3))",
  shadowLight: "var(--shadow-light, rgba(0, 0, 0, 0.15))",
  shadowHeavy: "var(--shadow-heavy, rgba(0, 0, 0, 0.5))",
  overlay: "var(--overlay, rgba(0, 0, 0, 0.5))"
};
var baseInput = {
  width: "100%",
  padding: "6px 10px",
  fontSize: 12,
  borderRadius: 8,
  background: color.bgSecondary,
  border: `1px solid ${color.border}`,
  color: color.text,
  outline: "none",
  fontFamily: font.family
};
var baseButton = {
  padding: "5px 12px",
  fontSize: 12,
  borderRadius: 8,
  border: `1px solid ${color.border}`,
  background: "transparent",
  color: color.textSecondary,
  cursor: "pointer",
  fontFamily: font.family
};
var accentButton = {
  ...baseButton,
  background: color.accent,
  border: "none",
  color: color.textOnBadge,
  fontWeight: 500
};
var dangerButton = {
  ...baseButton,
  color: color.textError,
  borderColor: color.borderError
};
var overlay = {
  position: "fixed",
  inset: 0,
  background: color.overlay,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50
};
var dialog = {
  background: color.bg,
  border: `1px solid ${color.border}`,
  borderRadius: 12,
  boxShadow: `0 25px 50px -12px ${color.shadowHeavy}`,
  width: "100%",
  maxWidth: 480,
  margin: "0 16px"
};
var dialogWide = {
  ...dialog,
  maxWidth: 640,
  maxHeight: "80vh",
  display: "flex",
  flexDirection: "column"
};

// src/BoardSidebar.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var React = globalThis.React;
var { useEffect, useState, useCallback, useRef } = React;
function createDefaultBoard(name, gitHistory) {
  const now = Date.now();
  return {
    id: generateId("board"),
    name,
    states: [
      { id: generateId("state"), name: "Todo", order: 0, isAutomatic: false, automationPrompt: "", evaluationPrompt: "", wipLimit: 0 },
      { id: generateId("state"), name: "In Progress", order: 1, isAutomatic: false, automationPrompt: "", evaluationPrompt: "", wipLimit: 0 },
      { id: generateId("state"), name: "Done", order: 2, isAutomatic: false, automationPrompt: "", evaluationPrompt: "", wipLimit: 0 }
    ],
    swimlanes: [
      { id: generateId("lane"), name: "Default", order: 0, managerAgentId: null, evaluationAgentId: null }
    ],
    labels: [],
    config: { maxRetries: 3, zoomLevel: 1, gitHistory },
    createdAt: now,
    updatedAt: now
  };
}
function CreateBoardDialog({ onSave, onCancel }) {
  const [name, setName] = useState("");
  const [gitHistory, setGitHistory] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);
  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, gitHistory);
  }, [name, gitHistory, onSave]);
  return /* @__PURE__ */ jsx("div", { style: overlay, onClick: onCancel, children: /* @__PURE__ */ jsxs("div", { style: { ...dialog, maxWidth: 380 }, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxs("div", { style: { padding: "16px 20px 8px", fontFamily: font.family }, children: [
      /* @__PURE__ */ jsx("h2", { style: { fontSize: 14, fontWeight: 600, color: color.text, margin: 0 }, children: "Create Board" }),
      /* @__PURE__ */ jsx("p", { style: { fontSize: 11, color: color.textTertiary, marginTop: 4 }, children: "Set up a new Kanban board for your project." })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { padding: "12px 20px", display: "flex", flexDirection: "column", gap: 12, fontFamily: font.family }, children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("label", { style: { display: "block", fontSize: 11, fontWeight: 500, color: color.textSecondary, marginBottom: 4 }, children: "Board Name" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            ref: inputRef,
            type: "text",
            placeholder: "e.g. Sprint 14, Feature Work, Bug Triage...",
            value: name,
            onChange: (e) => setName(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") handleSubmit();
            },
            style: baseInput
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: 10,
        borderRadius: 10,
        background: color.bgSecondary,
        border: `1px solid ${color.border}`
      }, children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            id: "create-git-history",
            checked: gitHistory,
            onChange: (e) => setGitHistory(e.target.checked),
            style: { marginTop: 2 }
          }
        ),
        /* @__PURE__ */ jsxs("label", { htmlFor: "create-git-history", style: { cursor: "pointer", userSelect: "none" }, children: [
          /* @__PURE__ */ jsx("div", { style: { fontSize: 11, fontWeight: 500, color: color.text }, children: "Enable git history" }),
          /* @__PURE__ */ jsx("div", { style: { fontSize: 10, color: color.textTertiary, marginTop: 2, lineHeight: 1.5 }, children: "Store board data in a git-tracked location so it can be shared with your team." })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
      padding: "12px 20px",
      borderTop: `1px solid ${color.border}`,
      fontFamily: font.family
    }, children: [
      /* @__PURE__ */ jsx("button", { onClick: onCancel, style: baseButton, children: "Cancel" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleSubmit,
          disabled: !name.trim(),
          style: { ...accentButton, opacity: name.trim() ? 1 : 0.4 },
          children: "Create"
        }
      )
    ] })
  ] }) });
}
function BoardSidebar({ api }) {
  const boardsStorage = api.storage.projectLocal;
  const [boards, setBoards] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [cardCounts, setCardCounts] = useState(/* @__PURE__ */ new Map());
  const [loaded, setLoaded] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  const loadBoards = useCallback(async () => {
    const raw = await boardsStorage.read(BOARDS_KEY);
    const list = Array.isArray(raw) ? raw : [];
    setBoards(list);
    kanBossState.setBoards(list);
    const counts = /* @__PURE__ */ new Map();
    for (const board of list) {
      const cardsStor2 = board.config.gitHistory ? api.storage.project : api.storage.projectLocal;
      const cardsRaw = await cardsStor2.read(cardsKey(board.id));
      const cards = Array.isArray(cardsRaw) ? cardsRaw : [];
      counts.set(board.id, cards.length);
    }
    setCardCounts(counts);
    if (!loadedRef.current) setLoaded(true);
  }, [boardsStorage, api]);
  const loadBoardsRef = useRef(loadBoards);
  loadBoardsRef.current = loadBoards;
  const refreshRef = useRef(kanBossState.refreshCount);
  useEffect(() => {
    loadBoardsRef.current();
    const unsub = kanBossState.subscribe(() => {
      setSelectedId(kanBossState.selectedBoardId);
      if (kanBossState.refreshCount !== refreshRef.current) {
        refreshRef.current = kanBossState.refreshCount;
        loadBoardsRef.current();
      }
    });
    return unsub;
  }, []);
  const handleCreate = useCallback(async (name, gitHistory) => {
    const board = createDefaultBoard(name, gitHistory);
    const next = await mutateStorage(boardsStorage, BOARDS_KEY, (boards2) => {
      boards2.push(board);
      return boards2;
    });
    const cardsStor2 = gitHistory ? api.storage.project : api.storage.projectLocal;
    await cardsStor2.write(cardsKey(board.id), []);
    setBoards(next);
    kanBossState.setBoards(next);
    kanBossState.selectBoard(board.id);
    setSelectedId(board.id);
    setCardCounts((prev) => new Map(prev).set(board.id, 0));
    setShowCreateDialog(false);
  }, [boards, boardsStorage, api]);
  const handleDelete = useCallback(async (boardId, e) => {
    e.stopPropagation();
    const board = boards.find((b) => b.id === boardId);
    if (!board) return;
    const ok = await api.ui.showConfirm(`Delete board "${board.name}" and all its cards? This cannot be undone.`);
    if (!ok) return;
    const next = await mutateStorage(boardsStorage, BOARDS_KEY, (boards2) => boards2.filter((b) => b.id !== boardId));
    const cardsStor2 = board.config.gitHistory ? api.storage.project : api.storage.projectLocal;
    await cardsStor2.delete(cardsKey(boardId));
    setBoards(next);
    kanBossState.setBoards(next);
    if (selectedId === boardId) {
      const newSel = next.length > 0 ? next[0].id : null;
      kanBossState.selectBoard(newSel);
      setSelectedId(newSel);
    }
  }, [api, boards, boardsStorage, selectedId]);
  const handleReorder = useCallback(async (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const updated = await mutateStorage(boardsStorage, BOARDS_KEY, (boards2) => {
      if (fromIdx >= boards2.length || toIdx >= boards2.length) return boards2;
      const result = [...boards2];
      const [moved] = result.splice(fromIdx, 1);
      result.splice(toIdx, 0, moved);
      return result;
    });
    setBoards(updated);
    kanBossState.setBoards(updated);
  }, [boards, boardsStorage]);
  const handleSelect = useCallback((boardId) => {
    kanBossState.selectBoard(boardId);
    setSelectedId(boardId);
  }, []);
  if (!loaded) {
    return /* @__PURE__ */ jsx("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      color: color.textTertiary,
      fontSize: 12,
      fontFamily: font.family
    }, children: "Loading..." });
  }
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", height: "100%", background: color.bgSecondary, fontFamily: font.family }, children: [
    /* @__PURE__ */ jsxs("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 12px",
      borderBottom: `1px solid ${color.border}`
    }, children: [
      /* @__PURE__ */ jsx("span", { style: { fontSize: 12, fontWeight: 500, color: color.text }, children: "Boards" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setShowCreateDialog(true),
          title: "Create new board",
          style: {
            padding: "2px 8px",
            fontSize: 12,
            color: color.textTertiary,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderRadius: 6
          },
          children: "+ New"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { style: { flex: 1, overflowY: "auto" }, children: boards.length === 0 ? /* @__PURE__ */ jsx("div", { style: { padding: "16px 12px", fontSize: 12, color: color.textTertiary, textAlign: "center" }, children: "No boards yet" }) : /* @__PURE__ */ jsx("div", { style: { padding: "2px 0" }, children: boards.map((board, boardIdx) => /* @__PURE__ */ jsxs(
      "div",
      {
        draggable: true,
        onDragStart: (e) => e.dataTransfer.setData("kanboss/board-idx", String(boardIdx)),
        onDragOver: (e) => e.preventDefault(),
        onDrop: (e) => {
          e.preventDefault();
          const from = e.dataTransfer.getData("kanboss/board-idx");
          if (from !== "") handleReorder(parseInt(from), boardIdx);
        },
        onClick: () => handleSelect(board.id),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          cursor: "pointer",
          transition: "background 0.15s",
          background: board.id === selectedId ? color.bgActive : "transparent",
          color: board.id === selectedId ? color.text : color.textSecondary
        },
        children: [
          /* @__PURE__ */ jsx("span", { style: { color: color.textTertiary, fontSize: 10, userSelect: "none", cursor: "grab", flexShrink: 0 }, children: "\u2261" }),
          /* @__PURE__ */ jsx("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ jsx("div", { style: { fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: board.name }) }),
          /* @__PURE__ */ jsx("span", { style: {
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 6,
            background: color.bgTertiary,
            color: color.textTertiary,
            flexShrink: 0
          }, children: cardCounts.get(board.id) ?? 0 }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: (e) => handleDelete(board.id, e),
              title: "Delete board",
              style: {
                color: color.textTertiary,
                fontSize: 14,
                opacity: board.id === selectedId ? 0.5 : 0,
                transition: "opacity 0.15s",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0
              },
              onMouseEnter: (e) => {
                e.target.style.opacity = "1";
              },
              onMouseLeave: (e) => {
                e.target.style.opacity = board.id === selectedId ? "0.5" : "0";
              },
              children: "\xD7"
            }
          )
        ]
      },
      board.id
    )) }) }),
    showCreateDialog && /* @__PURE__ */ jsx(
      CreateBoardDialog,
      {
        onSave: handleCreate,
        onCancel: () => setShowCreateDialog(false)
      }
    )
  ] });
}

// src/CardCell.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var React2 = globalThis.React;
var { useState: useState2, useCallback: useCallback2, useRef: useRef2 } = React2;
var MAX_VISIBLE = 5;
function MoveButton({ card, allStates, onMove }) {
  const [open, setOpen] = useState2(false);
  const otherStates = allStates.filter((s) => s.id !== card.stateId);
  return /* @__PURE__ */ jsxs2("div", { style: { position: "relative", zIndex: open ? 50 : 1 }, children: [
    /* @__PURE__ */ jsx2(
      "button",
      {
        onClick: (e) => {
          e.stopPropagation();
          setOpen(!open);
        },
        title: "Move card",
        style: {
          fontSize: 10,
          color: color.textTertiary,
          padding: "0 4px",
          borderRadius: 6,
          border: "none",
          background: "transparent",
          cursor: "pointer"
        },
        children: "\u2192"
      }
    ),
    open && /* @__PURE__ */ jsx2("div", { style: {
      position: "absolute",
      right: 0,
      top: 20,
      background: color.bgSecondary,
      border: `1px solid ${color.border}`,
      borderRadius: 10,
      boxShadow: `0 10px 25px ${color.shadow}`,
      padding: "4px 0",
      minWidth: 120,
      zIndex: 50
    }, children: otherStates.map((state) => /* @__PURE__ */ jsx2(
      "button",
      {
        onClick: (e) => {
          e.stopPropagation();
          onMove(card.id, state.id);
          setOpen(false);
        },
        style: {
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: "5px 10px",
          fontSize: 11,
          color: color.text,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontFamily: font.family
        },
        children: state.name
      },
      state.id
    )) })
  ] });
}
function CardTile({ card, allStates, boardLabels, onMoveCard, onDeleteCard, onClearRetries, onManualAdvance }) {
  const stuck = isCardStuck(card);
  const automating = !stuck && isCardAutomating(card);
  const hasRetries = !stuck && !automating && card.automationAttempts > 0;
  const [contextMenu, setContextMenu] = useState2(null);
  const config = PRIORITY_CONFIG[card.priority];
  const cardLabels = card.labels.map((lid) => boardLabels.find((l) => l.id === lid)).filter(Boolean);
  return /* @__PURE__ */ jsxs2(
    "div",
    {
      draggable: true,
      onDragStart: (e) => {
        e.dataTransfer.setData("application/x-kanboss-card", card.id);
        e.dataTransfer.effectAllowed = "move";
      },
      onClick: () => kanBossState.openEditCard(card.id),
      onContextMenu: (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      },
      style: {
        position: "relative",
        background: color.bgSecondary,
        border: `1px solid ${stuck ? color.textError : automating ? color.accent : color.border}`,
        borderRadius: 10,
        padding: "8px 10px",
        cursor: "grab",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: stuck ? `0 0 8px ${color.glowError}` : automating ? `0 0 8px ${color.glowAccent}` : `0 1px 3px ${color.shadowLight}`,
        fontFamily: font.family,
        ...automating ? {
          animation: "kanboss-pulse 2s ease-in-out infinite"
        } : {}
      },
      children: [
        (!config.hidden || cardLabels.length > 0) && /* @__PURE__ */ jsxs2("div", { style: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }, children: [
          !config.hidden && /* @__PURE__ */ jsx2("span", { style: {
            fontSize: 10,
            padding: "1px 8px",
            borderRadius: 99,
            fontWeight: 500,
            background: `${config.color}20`,
            color: config.color
          }, children: config.label }),
          cardLabels.map((label) => /* @__PURE__ */ jsx2("span", { style: {
            fontSize: 10,
            padding: "1px 8px",
            borderRadius: 99,
            fontWeight: 500,
            background: `${label.color}20`,
            color: label.color
          }, children: label.name }, label.id))
        ] }),
        /* @__PURE__ */ jsxs2("div", { style: { display: "flex", alignItems: "flex-start", gap: 4 }, children: [
          /* @__PURE__ */ jsx2("span", { style: {
            flex: 1,
            minWidth: 0,
            fontSize: 11,
            color: color.text,
            fontWeight: 500,
            lineHeight: 1.4
          }, children: card.title }),
          /* @__PURE__ */ jsx2(MoveButton, { card, allStates, onMove: onMoveCard })
        ] }),
        card.body && /* @__PURE__ */ jsx2("div", { style: {
          fontSize: 10,
          color: color.textTertiary,
          marginTop: 4,
          lineHeight: 1.5,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical"
        }, children: card.body }),
        automating && /* @__PURE__ */ jsxs2("div", { style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 6,
          paddingTop: 6,
          borderTop: `1px solid ${color.border}`
        }, children: [
          /* @__PURE__ */ jsxs2("span", { style: {
            fontSize: 9,
            padding: "2px 8px",
            borderRadius: 99,
            background: color.accentBg,
            color: color.accent,
            fontWeight: 600
          }, children: [
            "\u2699",
            " Automating..."
          ] }),
          /* @__PURE__ */ jsxs2("span", { style: { fontSize: 9, color: color.textTertiary }, children: [
            "Attempt ",
            card.automationAttempts
          ] })
        ] }),
        stuck && /* @__PURE__ */ jsxs2(
          "div",
          {
            onClick: (e) => e.stopPropagation(),
            style: {
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 6,
              paddingTop: 6,
              borderTop: `1px solid ${color.border}`
            },
            children: [
              /* @__PURE__ */ jsx2(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    onClearRetries(card.id);
                  },
                  title: "Reset retry counter so automation can try again",
                  style: {
                    fontSize: 9,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: color.bgTertiary,
                    color: color.textSecondary,
                    border: "none",
                    cursor: "pointer"
                  },
                  children: "Clear Retries"
                }
              ),
              /* @__PURE__ */ jsxs2(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    onManualAdvance(card.id);
                  },
                  title: "Manually advance to next state",
                  style: {
                    fontSize: 9,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: color.bgSuccess,
                    color: color.textSuccess,
                    border: "none",
                    cursor: "pointer"
                  },
                  children: [
                    "Advance ",
                    "\u2192"
                  ]
                }
              )
            ]
          }
        ),
        stuck && /* @__PURE__ */ jsxs2("div", { style: {
          position: "absolute",
          top: -6,
          right: -6,
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "2px 8px",
          borderRadius: 99,
          fontSize: 8,
          fontWeight: 700,
          color: color.textOnBadge,
          background: color.textError
        }, children: [
          "!",
          " Stuck"
        ] }),
        hasRetries && card.automationAttempts === 1 && /* @__PURE__ */ jsx2("div", { style: {
          position: "absolute",
          top: -6,
          right: -6,
          padding: "2px 8px",
          borderRadius: 99,
          fontSize: 8,
          fontWeight: 700,
          color: color.textOnBadge,
          background: color.textSuccess
        }, children: "1st Attempt" }),
        hasRetries && card.automationAttempts > 1 && /* @__PURE__ */ jsxs2("div", { style: {
          position: "absolute",
          top: -6,
          right: -6,
          padding: "2px 8px",
          borderRadius: 99,
          fontSize: 8,
          fontWeight: 700,
          color: color.textOnBadge,
          background: color.textWarning
        }, children: [
          "Retry: ",
          card.automationAttempts - 1
        ] }),
        contextMenu && /* @__PURE__ */ jsxs2(Fragment, { children: [
          /* @__PURE__ */ jsx2(
            "div",
            {
              onClick: (e) => {
                e.stopPropagation();
                setContextMenu(null);
              },
              onContextMenu: (e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu(null);
              },
              style: { position: "fixed", inset: 0, zIndex: 40 }
            }
          ),
          /* @__PURE__ */ jsxs2(
            "div",
            {
              onClick: (e) => e.stopPropagation(),
              style: {
                position: "absolute",
                left: contextMenu.x,
                top: contextMenu.y,
                background: color.bgSecondary,
                border: `1px solid ${color.border}`,
                borderRadius: 10,
                boxShadow: `0 10px 25px ${color.shadow}`,
                padding: "4px 0",
                zIndex: 50,
                minWidth: 130
              },
              children: [
                /* @__PURE__ */ jsx2(
                  "button",
                  {
                    onClick: (e) => {
                      e.stopPropagation();
                      kanBossState.openEditCard(card.id);
                      setContextMenu(null);
                    },
                    style: {
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 12px",
                      fontSize: 11,
                      color: color.text,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: font.family
                    },
                    children: "Edit"
                  }
                ),
                /* @__PURE__ */ jsx2(
                  "button",
                  {
                    onClick: (e) => {
                      e.stopPropagation();
                      onDeleteCard(card.id);
                      setContextMenu(null);
                    },
                    style: {
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 12px",
                      fontSize: 11,
                      color: color.textError,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: font.family
                    },
                    children: "Delete"
                  }
                )
              ]
            }
          )
        ] })
      ]
    }
  );
}
function CardCell({ cards, stateId, swimlaneId, isLastState, allStates, boardLabels, wipLimit, onMoveCard, onDeleteCard, onClearRetries, onManualAdvance }) {
  const [expanded, setExpanded] = useState2(false);
  const [isDragOver, setIsDragOver] = useState2(false);
  const dragCounter = useRef2(0);
  const sorted = [...cards].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4));
  const overWip = wipLimit > 0 && sorted.length > wipLimit;
  const atWip = wipLimit > 0 && sorted.length === wipLimit;
  const handleAdd = useCallback2((e) => {
    e.stopPropagation();
    kanBossState.openNewCard(stateId, swimlaneId);
  }, [stateId, swimlaneId]);
  const handleDragOver = useCallback2((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);
  const handleDragEnter = useCallback2((e) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback2(() => {
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);
  const handleDrop = useCallback2((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const cardId = e.dataTransfer.getData("application/x-kanboss-card");
    if (cardId) onMoveCard(cardId, stateId, swimlaneId);
  }, [onMoveCard, stateId, swimlaneId]);
  const dropProps = {
    onDragOver: handleDragOver,
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop
  };
  if (isLastState && sorted.length > 0 && !expanded) {
    return /* @__PURE__ */ jsx2(
      "div",
      {
        ...dropProps,
        style: {
          flex: 1,
          padding: 8,
          minHeight: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.2s",
          ...isDragOver ? {
            background: color.bgInfo,
            boxShadow: `inset 0 0 0 1px ${color.borderInfo}`,
            borderRadius: 10
          } : {}
        },
        children: /* @__PURE__ */ jsxs2(
          "button",
          {
            onClick: () => setExpanded(true),
            style: {
              padding: "4px 12px",
              fontSize: 11,
              borderRadius: 99,
              background: color.bgSuccess,
              color: color.textSuccess,
              border: "none",
              cursor: "pointer"
            },
            children: [
              sorted.length,
              " done"
            ]
          }
        )
      }
    );
  }
  const visibleCards = expanded || sorted.length <= MAX_VISIBLE ? sorted : sorted.slice(0, MAX_VISIBLE);
  const hiddenCount = sorted.length - visibleCards.length;
  return /* @__PURE__ */ jsxs2(
    "div",
    {
      ...dropProps,
      style: {
        flex: 1,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: 60,
        transition: "background 0.2s",
        ...overWip ? { background: color.bgErrorSubtle } : {},
        ...isDragOver ? {
          background: color.bgInfo,
          boxShadow: `inset 0 0 0 1px ${color.borderInfo}`,
          borderRadius: 10
        } : {}
      },
      children: [
        wipLimit > 0 && /* @__PURE__ */ jsxs2("div", { style: {
          fontSize: 9,
          color: overWip ? color.textError : atWip ? color.textWarning : color.textTertiary,
          textAlign: "right",
          fontWeight: overWip ? 600 : 400
        }, children: [
          sorted.length,
          "/",
          wipLimit
        ] }),
        visibleCards.map((card) => /* @__PURE__ */ jsx2(
          CardTile,
          {
            card,
            allStates,
            boardLabels,
            onMoveCard,
            onDeleteCard,
            onClearRetries,
            onManualAdvance
          },
          card.id
        )),
        hiddenCount > 0 && /* @__PURE__ */ jsxs2(
          "button",
          {
            onClick: () => setExpanded(true),
            style: {
              width: "100%",
              textAlign: "center",
              fontSize: 10,
              color: color.textTertiary,
              padding: "2px 0",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer"
            },
            children: [
              "+",
              hiddenCount,
              " more"
            ]
          }
        ),
        isLastState && expanded && /* @__PURE__ */ jsx2(
          "button",
          {
            onClick: () => setExpanded(false),
            style: {
              width: "100%",
              textAlign: "center",
              fontSize: 10,
              color: color.textTertiary,
              padding: "2px 0",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer"
            },
            children: "Collapse"
          }
        ),
        /* @__PURE__ */ jsx2(
          "button",
          {
            onClick: handleAdd,
            style: {
              width: "100%",
              textAlign: "center",
              fontSize: 10,
              color: color.textTertiary,
              padding: "2px 0",
              marginTop: 2,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer"
            },
            children: "+ Add"
          }
        )
      ]
    }
  );
}

// src/CardDialog.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var React3 = globalThis.React;
var { useState: useState3, useCallback: useCallback3, useEffect: useEffect2 } = React3;
var PRIORITIES = ["none", "low", "medium", "high", "critical"];
function HistoryItem({ entry }) {
  const time = new Date(entry.timestamp).toLocaleString(void 0, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
  return /* @__PURE__ */ jsxs3("div", { style: { display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0" }, children: [
    /* @__PURE__ */ jsx3("span", { style: { fontSize: 10, color: color.textTertiary, flexShrink: 0, width: 96 }, children: time }),
    /* @__PURE__ */ jsx3("span", { style: { fontSize: 10, color: color.textSecondary }, children: entry.detail })
  ] });
}
function CardDialog({ api, boardId, boardLabels }) {
  const currentBoard = kanBossState.boards.find((b) => b.id === boardId);
  const storage = currentBoard?.config.gitHistory ? api.storage.project : api.storage.projectLocal;
  const isNew = kanBossState.editingCardId === "new";
  const cardId = isNew ? null : kanBossState.editingCardId;
  const [title, setTitle] = useState3("");
  const [body, setBody] = useState3("");
  const [priority, setPriority] = useState3("none");
  const [selectedLabels, setSelectedLabels] = useState3([]);
  const [history, setHistory] = useState3([]);
  const [loaded, setLoaded] = useState3(isNew);
  useEffect2(() => {
    if (isNew || !cardId) {
      setTitle("");
      setBody("");
      setPriority("none");
      setSelectedLabels([]);
      setHistory([]);
      setLoaded(true);
      return;
    }
    (async () => {
      const raw = await storage.read(cardsKey(boardId));
      const cards = Array.isArray(raw) ? raw : [];
      const card = cards.find((c) => c.id === cardId);
      if (card) {
        setTitle(card.title);
        setBody(card.body);
        setPriority(card.priority);
        setSelectedLabels(card.labels || []);
        setHistory(card.history);
      }
      setLoaded(true);
    })();
  }, [cardId, isNew, boardId, storage]);
  const toggleLabel = useCallback3((labelId) => {
    setSelectedLabels(
      (prev) => prev.includes(labelId) ? prev.filter((l) => l !== labelId) : [...prev, labelId]
    );
  }, []);
  const handleSave = useCallback3(async () => {
    if (!title.trim()) return;
    await mutateStorage(storage, cardsKey(boardId), (cards) => {
      const now = Date.now();
      if (isNew) {
        const newCard = {
          id: generateId("card"),
          boardId,
          title: title.trim(),
          body,
          priority,
          labels: selectedLabels,
          stateId: kanBossState.editingStateId,
          swimlaneId: kanBossState.editingSwimlaneId,
          history: [{ action: "created", timestamp: now, detail: `Created "${title.trim()}"` }],
          automationAttempts: 0,
          createdAt: now,
          updatedAt: now
        };
        cards.push(newCard);
      } else if (cardId) {
        const idx = cards.findIndex((c) => c.id === cardId);
        if (idx !== -1) {
          const card = cards[idx];
          const changes = [];
          if (card.title !== title.trim()) changes.push("title");
          if (card.body !== body) changes.push("body");
          if (card.priority !== priority) {
            changes.push("priority");
            card.history.push({
              action: "priority-changed",
              timestamp: now,
              detail: `Priority changed from ${card.priority} to ${priority}`
            });
          }
          if (JSON.stringify(card.labels) !== JSON.stringify(selectedLabels)) changes.push("labels");
          if (changes.length > 0) {
            card.history.push({
              action: "edited",
              timestamp: now,
              detail: `Edited: ${changes.join(", ")}`
            });
          }
          card.title = title.trim();
          card.body = body;
          card.priority = priority;
          card.labels = selectedLabels;
          card.updatedAt = now;
          cards[idx] = card;
        }
      }
      return cards;
    });
    kanBossState.closeCardDialog();
    kanBossState.triggerRefresh();
  }, [title, body, priority, selectedLabels, isNew, cardId, boardId, storage]);
  const handleDelete = useCallback3(async () => {
    if (!cardId) return;
    const ok = await api.ui.showConfirm("Delete this card? This cannot be undone.");
    if (!ok) return;
    await mutateStorage(storage, cardsKey(boardId), (cards) => cards.filter((c) => c.id !== cardId));
    kanBossState.closeCardDialog();
    kanBossState.triggerRefresh();
  }, [api, cardId, boardId, storage]);
  const handleCancel = useCallback3(() => {
    kanBossState.closeCardDialog();
  }, []);
  if (!loaded) return null;
  return /* @__PURE__ */ jsx3("div", { style: overlay, onClick: handleCancel, children: /* @__PURE__ */ jsxs3("div", { style: { ...dialog, maxWidth: 520 }, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxs3("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      borderBottom: `1px solid ${color.border}`
    }, children: [
      /* @__PURE__ */ jsx3("span", { style: { fontSize: 14, fontWeight: 500, color: color.text, fontFamily: font.family }, children: isNew ? "New Card" : "Edit Card" }),
      /* @__PURE__ */ jsx3(
        "button",
        {
          onClick: handleCancel,
          style: {
            color: color.textTertiary,
            fontSize: 18,
            border: "none",
            background: "transparent",
            cursor: "pointer"
          },
          children: "\xD7"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs3("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 12, fontFamily: font.family }, children: [
      /* @__PURE__ */ jsxs3("div", { children: [
        /* @__PURE__ */ jsx3("label", { style: { display: "block", fontSize: 11, color: color.textSecondary, marginBottom: 4 }, children: "Title" }),
        /* @__PURE__ */ jsx3(
          "input",
          {
            type: "text",
            value: title,
            onChange: (e) => setTitle(e.target.value),
            placeholder: "Card title...",
            autoFocus: true,
            style: baseInput
          }
        )
      ] }),
      /* @__PURE__ */ jsxs3("div", { children: [
        /* @__PURE__ */ jsx3("label", { style: { display: "block", fontSize: 11, color: color.textSecondary, marginBottom: 4 }, children: "Description" }),
        /* @__PURE__ */ jsx3(
          "textarea",
          {
            rows: 4,
            value: body,
            onChange: (e) => setBody(e.target.value),
            placeholder: "Description...",
            style: { ...baseInput, resize: "vertical" }
          }
        )
      ] }),
      /* @__PURE__ */ jsxs3("div", { children: [
        /* @__PURE__ */ jsx3("label", { style: { display: "block", fontSize: 11, color: color.textSecondary, marginBottom: 4 }, children: "Priority" }),
        /* @__PURE__ */ jsx3(
          "select",
          {
            value: priority,
            onChange: (e) => setPriority(e.target.value),
            style: baseInput,
            children: PRIORITIES.map((p) => /* @__PURE__ */ jsx3("option", { value: p, children: PRIORITY_CONFIG[p].label }, p))
          }
        )
      ] }),
      boardLabels.length > 0 && /* @__PURE__ */ jsxs3("div", { children: [
        /* @__PURE__ */ jsx3("label", { style: { display: "block", fontSize: 11, color: color.textSecondary, marginBottom: 6 }, children: "Labels" }),
        /* @__PURE__ */ jsx3("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 }, children: boardLabels.map((label) => {
          const isSelected = selectedLabels.includes(label.id);
          return /* @__PURE__ */ jsx3(
            "button",
            {
              onClick: () => toggleLabel(label.id),
              style: {
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 99,
                border: `1px solid ${isSelected ? label.color : color.border}`,
                background: isSelected ? `${label.color}20` : "transparent",
                color: isSelected ? label.color : color.textSecondary,
                cursor: "pointer",
                fontWeight: isSelected ? 500 : 400,
                fontFamily: font.family
              },
              children: label.name
            },
            label.id
          );
        }) })
      ] })
    ] }),
    !isNew && history.length > 0 && /* @__PURE__ */ jsxs3("div", { style: { padding: "0 16px 12px" }, children: [
      /* @__PURE__ */ jsx3("div", { style: { fontSize: 12, fontWeight: 500, color: color.textSecondary, marginBottom: 6, fontFamily: font.family }, children: "History" }),
      /* @__PURE__ */ jsx3("div", { style: {
        maxHeight: 128,
        overflowY: "auto",
        border: `1px solid ${color.border}`,
        borderRadius: 8,
        padding: 8,
        background: color.bgSecondary
      }, children: [...history].reverse().map((entry, i) => /* @__PURE__ */ jsx3(HistoryItem, { entry }, i)) })
    ] }),
    /* @__PURE__ */ jsxs3("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      borderTop: `1px solid ${color.border}`,
      fontFamily: font.family
    }, children: [
      !isNew ? /* @__PURE__ */ jsx3("button", { onClick: handleDelete, style: dangerButton, children: "Delete" }) : /* @__PURE__ */ jsx3("div", {}),
      /* @__PURE__ */ jsxs3("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsx3("button", { onClick: handleCancel, style: baseButton, children: "Cancel" }),
        /* @__PURE__ */ jsx3("button", { onClick: handleSave, style: accentButton, children: "Save" })
      ] })
    ] })
  ] }) });
}

// src/BoardConfigDialog.tsx
import { Fragment as Fragment2, jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var React4 = globalThis.React;
var { useState: useState4, useCallback: useCallback4, useEffect: useEffect3 } = React4;
function BoardConfigDialog({ api, board }) {
  const storage = api.storage.projectLocal;
  const [tab, setTab] = useState4("states");
  const [states, setStates] = useState4([...board.states]);
  const [swimlanes, setSwimlanes] = useState4([...board.swimlanes]);
  const [labels, setLabels] = useState4([...board.labels || []]);
  const [maxRetries, setMaxRetries] = useState4(board.config.maxRetries);
  const [gitHistory, setGitHistory] = useState4(board.config.gitHistory ?? false);
  const [durableAgents, setDurableAgents] = useState4([]);
  useEffect3(() => {
    const agents = api.agents.list().filter((a) => a.kind === "durable");
    setDurableAgents(agents);
  }, [api]);
  const addState = useCallback4(() => {
    const order = states.length;
    setStates([...states, {
      id: generateId("state"),
      name: `State ${order + 1}`,
      order,
      isAutomatic: false,
      automationPrompt: "",
      evaluationPrompt: "",
      wipLimit: 0
    }]);
  }, [states]);
  const removeState = useCallback4((stateId) => {
    if (states.length <= 1) return;
    const filtered = states.filter((s) => s.id !== stateId);
    setStates(filtered.map((s, i) => ({ ...s, order: i })));
  }, [states]);
  const updateState = useCallback4((stateId, updates) => {
    setStates(states.map((s) => s.id === stateId ? { ...s, ...updates } : s));
  }, [states]);
  const moveState = useCallback4((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const result = [...states];
    const [moved] = result.splice(fromIdx, 1);
    result.splice(toIdx, 0, moved);
    setStates(result.map((s, i) => ({ ...s, order: i })));
  }, [states]);
  const addSwimlane = useCallback4(() => {
    const order = swimlanes.length;
    setSwimlanes([...swimlanes, {
      id: generateId("lane"),
      name: `Swimlane ${order + 1}`,
      order,
      managerAgentId: null,
      evaluationAgentId: null
    }]);
  }, [swimlanes]);
  const removeSwimlane = useCallback4((laneId) => {
    if (swimlanes.length <= 1) return;
    const filtered = swimlanes.filter((l) => l.id !== laneId);
    setSwimlanes(filtered.map((l, i) => ({ ...l, order: i })));
  }, [swimlanes]);
  const updateSwimlane = useCallback4((laneId, updates) => {
    setSwimlanes(swimlanes.map((l) => l.id === laneId ? { ...l, ...updates } : l));
  }, [swimlanes]);
  const moveSwimlane = useCallback4((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const result = [...swimlanes];
    const [moved] = result.splice(fromIdx, 1);
    result.splice(toIdx, 0, moved);
    setSwimlanes(result.map((l, i) => ({ ...l, order: i })));
  }, [swimlanes]);
  const addLabel = useCallback4(() => {
    const usedColors = labels.map((l) => l.color);
    const nextColor = LABEL_COLORS.find((c) => !usedColors.includes(c)) || LABEL_COLORS[0];
    setLabels([...labels, {
      id: generateId("label"),
      name: `Label ${labels.length + 1}`,
      color: nextColor
    }]);
  }, [labels]);
  const removeLabel = useCallback4((labelId) => {
    setLabels(labels.filter((l) => l.id !== labelId));
  }, [labels]);
  const updateLabel = useCallback4((labelId, updates) => {
    setLabels(labels.map((l) => l.id === labelId ? { ...l, ...updates } : l));
  }, [labels]);
  const handleSave = useCallback4(async () => {
    const updated = await mutateStorage(storage, BOARDS_KEY, (boards) => {
      const idx = boards.findIndex((b) => b.id === board.id);
      if (idx !== -1) {
        boards[idx] = {
          ...boards[idx],
          states,
          swimlanes,
          labels,
          config: { ...boards[idx].config, maxRetries, gitHistory },
          updatedAt: Date.now()
        };
      }
      return boards;
    });
    kanBossState.setBoards(updated);
    kanBossState.closeBoardConfig();
    kanBossState.triggerRefresh();
  }, [storage, board.id, states, swimlanes, labels, maxRetries, gitHistory]);
  const handleCancel = useCallback4(() => {
    kanBossState.closeBoardConfig();
  }, []);
  const tabBtn = (id, label) => /* @__PURE__ */ jsx4(
    "button",
    {
      onClick: () => setTab(id),
      style: {
        padding: "6px 12px",
        fontSize: 12,
        borderRadius: "8px 8px 0 0",
        border: tab === id ? `1px solid ${color.border}` : "none",
        borderBottom: tab === id ? `1px solid ${color.bg}` : "none",
        marginBottom: tab === id ? -1 : 0,
        background: tab === id ? color.bg : "transparent",
        color: tab === id ? color.text : color.textTertiary,
        cursor: "pointer",
        fontFamily: font.family
      },
      children: label
    },
    id
  );
  return /* @__PURE__ */ jsx4("div", { style: overlay, onClick: handleCancel, children: /* @__PURE__ */ jsxs4("div", { style: dialogWide, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxs4("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      borderBottom: `1px solid ${color.border}`,
      fontFamily: font.family
    }, children: [
      /* @__PURE__ */ jsxs4("span", { style: { fontSize: 14, fontWeight: 500, color: color.text }, children: [
        "Board Settings: ",
        board.name
      ] }),
      /* @__PURE__ */ jsx4(
        "button",
        {
          onClick: handleCancel,
          style: { color: color.textTertiary, fontSize: 18, border: "none", background: "transparent", cursor: "pointer" },
          children: "\xD7"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs4("div", { style: { display: "flex", gap: 4, padding: "8px 16px 0", background: color.bgSecondary }, children: [
      tabBtn("states", "States"),
      tabBtn("swimlanes", "Swimlanes"),
      tabBtn("labels", "Labels"),
      tabBtn("settings", "Settings")
    ] }),
    /* @__PURE__ */ jsxs4("div", { style: { flex: 1, overflowY: "auto", padding: 16, fontFamily: font.family }, children: [
      tab === "states" && /* @__PURE__ */ jsxs4("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
        states.map((state, idx) => /* @__PURE__ */ jsxs4(
          "div",
          {
            draggable: true,
            onDragStart: (e) => e.dataTransfer.setData("kanboss/state-idx", String(idx)),
            onDragOver: (e) => e.preventDefault(),
            onDrop: (e) => {
              e.preventDefault();
              const from = e.dataTransfer.getData("kanboss/state-idx");
              if (from !== "") moveState(parseInt(from), idx);
            },
            style: {
              padding: 12,
              background: color.bgSecondary,
              border: `1px solid ${color.border}`,
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8
            },
            children: [
              /* @__PURE__ */ jsxs4("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ jsx4("span", { style: { color: color.textTertiary, cursor: "grab", fontSize: 12, userSelect: "none" }, title: "Drag to reorder", children: "\u2261" }),
                /* @__PURE__ */ jsx4(
                  "input",
                  {
                    type: "text",
                    value: state.name,
                    onChange: (e) => updateState(state.id, { name: e.target.value }),
                    style: { ...baseInput, flex: 1 }
                  }
                ),
                /* @__PURE__ */ jsxs4("div", { style: { display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }, children: [
                  /* @__PURE__ */ jsx4("label", { style: { fontSize: 10, color: color.textTertiary, whiteSpace: "nowrap" }, children: "WIP" }),
                  /* @__PURE__ */ jsx4(
                    "input",
                    {
                      type: "number",
                      min: 0,
                      max: 99,
                      value: state.wipLimit,
                      onChange: (e) => updateState(state.id, { wipLimit: Math.max(0, parseInt(e.target.value) || 0) }),
                      style: { ...baseInput, width: 50, textAlign: "center" },
                      title: "WIP limit (0 = unlimited)"
                    }
                  )
                ] }),
                states.length > 1 && /* @__PURE__ */ jsx4(
                  "button",
                  {
                    onClick: () => removeState(state.id),
                    title: "Remove state",
                    style: { color: color.textTertiary, fontSize: 14, border: "none", background: "transparent", cursor: "pointer", padding: "0 4px" },
                    children: "\xD7"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs4("label", { style: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }, children: [
                /* @__PURE__ */ jsx4(
                  "input",
                  {
                    type: "checkbox",
                    checked: state.isAutomatic,
                    onChange: (e) => updateState(state.id, { isAutomatic: e.target.checked })
                  }
                ),
                /* @__PURE__ */ jsx4("span", { style: { fontSize: 11, color: color.textSecondary }, children: "Automatic" })
              ] }),
              state.isAutomatic && /* @__PURE__ */ jsxs4(Fragment2, { children: [
                /* @__PURE__ */ jsxs4("div", { children: [
                  /* @__PURE__ */ jsx4("label", { style: { display: "block", fontSize: 10, color: color.textSecondary, marginBottom: 4 }, children: "Execution Prompt" }),
                  /* @__PURE__ */ jsx4(
                    "textarea",
                    {
                      rows: 2,
                      value: state.automationPrompt,
                      onChange: (e) => updateState(state.id, { automationPrompt: e.target.value }),
                      placeholder: "Describe the work the agent should complete...",
                      style: { ...baseInput, fontFamily: font.mono, fontSize: 11, resize: "vertical" }
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs4("div", { children: [
                  /* @__PURE__ */ jsxs4("label", { style: { display: "block", fontSize: 10, color: color.textSecondary, marginBottom: 4 }, children: [
                    "Evaluation Prompt ",
                    /* @__PURE__ */ jsx4("span", { style: { color: color.textTertiary }, children: "(optional \u2014 defaults to execution prompt)" })
                  ] }),
                  /* @__PURE__ */ jsx4(
                    "textarea",
                    {
                      rows: 2,
                      value: state.evaluationPrompt,
                      onChange: (e) => updateState(state.id, { evaluationPrompt: e.target.value }),
                      placeholder: "Describe the criteria for evaluating success...",
                      style: { ...baseInput, fontFamily: font.mono, fontSize: 11, resize: "vertical" }
                    }
                  )
                ] })
              ] })
            ]
          },
          state.id
        )),
        /* @__PURE__ */ jsx4(
          "button",
          {
            onClick: addState,
            style: {
              width: "100%",
              padding: "8px 0",
              fontSize: 12,
              color: color.textTertiary,
              border: `1px dashed ${color.border}`,
              borderRadius: 10,
              background: "transparent",
              cursor: "pointer",
              fontFamily: font.family
            },
            children: "+ Add State"
          }
        )
      ] }),
      tab === "swimlanes" && /* @__PURE__ */ jsxs4("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
        swimlanes.map((lane, laneIdx) => /* @__PURE__ */ jsxs4(
          "div",
          {
            draggable: true,
            onDragStart: (e) => e.dataTransfer.setData("kanboss/lane-idx", String(laneIdx)),
            onDragOver: (e) => e.preventDefault(),
            onDrop: (e) => {
              e.preventDefault();
              const from = e.dataTransfer.getData("kanboss/lane-idx");
              if (from !== "") moveSwimlane(parseInt(from), laneIdx);
            },
            style: {
              padding: 12,
              background: color.bgSecondary,
              border: `1px solid ${color.border}`,
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8
            },
            children: [
              /* @__PURE__ */ jsxs4("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ jsx4("span", { style: { color: color.textTertiary, cursor: "grab", fontSize: 12, userSelect: "none" }, title: "Drag to reorder", children: "\u2261" }),
                /* @__PURE__ */ jsx4(
                  "input",
                  {
                    type: "text",
                    value: lane.name,
                    onChange: (e) => updateSwimlane(lane.id, { name: e.target.value }),
                    style: { ...baseInput, flex: 1 }
                  }
                ),
                swimlanes.length > 1 && /* @__PURE__ */ jsx4(
                  "button",
                  {
                    onClick: () => removeSwimlane(lane.id),
                    title: "Remove swimlane",
                    style: { color: color.textTertiary, fontSize: 14, border: "none", background: "transparent", cursor: "pointer", padding: "0 4px" },
                    children: "\xD7"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs4("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
                /* @__PURE__ */ jsxs4("div", { children: [
                  /* @__PURE__ */ jsx4("label", { style: { display: "block", fontSize: 10, color: color.textSecondary, marginBottom: 4 }, children: "Manager Agent" }),
                  /* @__PURE__ */ jsxs4(
                    "select",
                    {
                      value: lane.managerAgentId ?? "",
                      onChange: (e) => updateSwimlane(lane.id, { managerAgentId: e.target.value || null }),
                      style: baseInput,
                      children: [
                        /* @__PURE__ */ jsx4("option", { value: "", children: "None (manual only)" }),
                        durableAgents.map((agent) => /* @__PURE__ */ jsx4("option", { value: agent.id, children: agent.name }, agent.id))
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs4("div", { children: [
                  /* @__PURE__ */ jsx4("label", { style: { display: "block", fontSize: 10, color: color.textSecondary, marginBottom: 4 }, children: "Evaluation Agent" }),
                  /* @__PURE__ */ jsxs4(
                    "select",
                    {
                      value: lane.evaluationAgentId ?? "",
                      onChange: (e) => updateSwimlane(lane.id, { evaluationAgentId: e.target.value || null }),
                      style: baseInput,
                      children: [
                        /* @__PURE__ */ jsx4("option", { value: "", children: "Same as manager" }),
                        durableAgents.map((agent) => /* @__PURE__ */ jsx4("option", { value: agent.id, children: agent.name }, agent.id))
                      ]
                    }
                  )
                ] })
              ] })
            ]
          },
          lane.id
        )),
        /* @__PURE__ */ jsx4(
          "button",
          {
            onClick: addSwimlane,
            style: {
              width: "100%",
              padding: "8px 0",
              fontSize: 12,
              color: color.textTertiary,
              border: `1px dashed ${color.border}`,
              borderRadius: 10,
              background: "transparent",
              cursor: "pointer",
              fontFamily: font.family
            },
            children: "+ Add Swimlane"
          }
        )
      ] }),
      tab === "labels" && /* @__PURE__ */ jsxs4("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
        labels.length === 0 && /* @__PURE__ */ jsx4("div", { style: { fontSize: 12, color: color.textTertiary, textAlign: "center", padding: 16 }, children: "No labels yet. Add labels to categorize your cards." }),
        labels.map((label) => /* @__PURE__ */ jsxs4(
          "div",
          {
            style: {
              padding: 12,
              background: color.bgSecondary,
              border: `1px solid ${color.border}`,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 10
            },
            children: [
              /* @__PURE__ */ jsx4("div", { style: { display: "flex", gap: 4, flexShrink: 0 }, children: LABEL_COLORS.map((c) => /* @__PURE__ */ jsx4(
                "button",
                {
                  onClick: () => updateLabel(label.id, { color: c }),
                  style: {
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: c,
                    border: label.color === c ? `2px solid ${color.text}` : "2px solid transparent",
                    cursor: "pointer",
                    padding: 0
                  }
                },
                c
              )) }),
              /* @__PURE__ */ jsx4(
                "input",
                {
                  type: "text",
                  value: label.name,
                  onChange: (e) => updateLabel(label.id, { name: e.target.value }),
                  style: { ...baseInput, flex: 1 }
                }
              ),
              /* @__PURE__ */ jsx4("span", { style: {
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 99,
                background: `${label.color}20`,
                color: label.color,
                fontWeight: 500,
                whiteSpace: "nowrap",
                flexShrink: 0
              }, children: label.name || "Preview" }),
              /* @__PURE__ */ jsx4(
                "button",
                {
                  onClick: () => removeLabel(label.id),
                  title: "Remove label",
                  style: { color: color.textTertiary, fontSize: 14, border: "none", background: "transparent", cursor: "pointer", padding: "0 4px" },
                  children: "\xD7"
                }
              )
            ]
          },
          label.id
        )),
        /* @__PURE__ */ jsx4(
          "button",
          {
            onClick: addLabel,
            style: {
              width: "100%",
              padding: "8px 0",
              fontSize: 12,
              color: color.textTertiary,
              border: `1px dashed ${color.border}`,
              borderRadius: 10,
              background: "transparent",
              cursor: "pointer",
              fontFamily: font.family
            },
            children: "+ Add Label"
          }
        )
      ] }),
      tab === "settings" && /* @__PURE__ */ jsxs4("div", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: [
        /* @__PURE__ */ jsxs4("div", { children: [
          /* @__PURE__ */ jsx4("label", { style: { display: "block", fontSize: 12, color: color.textSecondary, marginBottom: 4 }, children: "Max Retries" }),
          /* @__PURE__ */ jsx4(
            "input",
            {
              type: "number",
              min: 1,
              max: 10,
              value: maxRetries,
              onChange: (e) => setMaxRetries(Math.max(1, Math.min(10, parseInt(e.target.value) || 3))),
              style: { ...baseInput, width: 80, textAlign: "center" }
            }
          ),
          /* @__PURE__ */ jsx4("p", { style: { fontSize: 10, color: color.textTertiary, marginTop: 4 }, children: "Number of times automation will retry before marking a card as stuck." })
        ] }),
        /* @__PURE__ */ jsxs4("div", { style: {
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: 10,
          borderRadius: 10,
          background: color.bgSecondary,
          border: `1px solid ${color.border}`
        }, children: [
          /* @__PURE__ */ jsx4(
            "input",
            {
              type: "checkbox",
              id: "cfg-git-history",
              checked: gitHistory,
              onChange: (e) => setGitHistory(e.target.checked),
              style: { marginTop: 2 }
            }
          ),
          /* @__PURE__ */ jsxs4("label", { htmlFor: "cfg-git-history", style: { cursor: "pointer", userSelect: "none" }, children: [
            /* @__PURE__ */ jsx4("div", { style: { fontSize: 12, color: color.text }, children: "Enable git history" }),
            /* @__PURE__ */ jsx4("p", { style: { fontSize: 10, color: color.textTertiary, marginTop: 2, lineHeight: 1.5 }, children: "Store board data in a git-tracked location so it can be shared with your team." })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs4("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
      padding: "12px 16px",
      borderTop: `1px solid ${color.border}`,
      fontFamily: font.family
    }, children: [
      /* @__PURE__ */ jsx4("button", { onClick: handleCancel, style: baseButton, children: "Cancel" }),
      /* @__PURE__ */ jsx4("button", { onClick: handleSave, style: accentButton, children: "Save" })
    ] })
  ] }) });
}

// src/FilterBar.tsx
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
var React5 = globalThis.React;
var { useCallback: useCallback5 } = React5;
var PRIORITIES2 = ["none", "low", "medium", "high", "critical"];
function FilterBar({ filter, labels }) {
  const hasFilters = filter.searchQuery || filter.priorityFilter !== "all" || filter.labelFilter !== "all" || filter.stuckOnly;
  const handleSearch = useCallback5((e) => {
    kanBossState.setFilter({ searchQuery: e.target.value });
  }, []);
  const handlePriority = useCallback5((e) => {
    kanBossState.setFilter({ priorityFilter: e.target.value });
  }, []);
  const handleLabel = useCallback5((e) => {
    kanBossState.setFilter({ labelFilter: e.target.value });
  }, []);
  const handleStuck = useCallback5((e) => {
    kanBossState.setFilter({ stuckOnly: e.target.checked });
  }, []);
  return /* @__PURE__ */ jsxs5("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 16px",
    borderBottom: `1px solid ${color.border}`,
    background: color.bgSecondary,
    flexShrink: 0,
    fontFamily: font.family,
    fontSize: 11
  }, children: [
    /* @__PURE__ */ jsx5(
      "input",
      {
        type: "text",
        placeholder: "Search cards...",
        value: filter.searchQuery,
        onChange: handleSearch,
        style: {
          ...baseInput,
          width: 160,
          padding: "4px 8px",
          fontSize: 11
        }
      }
    ),
    /* @__PURE__ */ jsxs5(
      "select",
      {
        value: filter.priorityFilter,
        onChange: handlePriority,
        style: {
          ...baseInput,
          width: "auto",
          padding: "4px 8px",
          fontSize: 11
        },
        children: [
          /* @__PURE__ */ jsx5("option", { value: "all", children: "All priorities" }),
          PRIORITIES2.map((p) => /* @__PURE__ */ jsx5("option", { value: p, children: PRIORITY_CONFIG[p].label }, p))
        ]
      }
    ),
    labels.length > 0 && /* @__PURE__ */ jsxs5(
      "select",
      {
        value: filter.labelFilter,
        onChange: handleLabel,
        style: {
          ...baseInput,
          width: "auto",
          padding: "4px 8px",
          fontSize: 11
        },
        children: [
          /* @__PURE__ */ jsx5("option", { value: "all", children: "All labels" }),
          labels.map((l) => /* @__PURE__ */ jsx5("option", { value: l.id, children: l.name }, l.id))
        ]
      }
    ),
    /* @__PURE__ */ jsxs5("label", { style: { display: "flex", alignItems: "center", gap: 4, color: color.textSecondary, cursor: "pointer", whiteSpace: "nowrap" }, children: [
      /* @__PURE__ */ jsx5(
        "input",
        {
          type: "checkbox",
          checked: filter.stuckOnly,
          onChange: handleStuck
        }
      ),
      "Stuck only"
    ] }),
    hasFilters && /* @__PURE__ */ jsx5(
      "button",
      {
        onClick: () => kanBossState.clearFilter(),
        style: {
          ...baseButton,
          padding: "3px 8px",
          fontSize: 10,
          color: color.textTertiary
        },
        children: "Clear"
      }
    )
  ] });
}

// src/AutomationEngine.ts
var engineApi = null;
async function loadBoard(api, boardId) {
  const raw = await api.storage.projectLocal.read(BOARDS_KEY);
  const boards = Array.isArray(raw) ? raw : [];
  return boards.find((b) => b.id === boardId) ?? null;
}
function cardsStor(api, board) {
  return board.config.gitHistory ? api.storage.project : api.storage.projectLocal;
}
async function loadCards(api, board) {
  const raw = await cardsStor(api, board).read(cardsKey(board.id));
  return Array.isArray(raw) ? raw : [];
}
async function loadRuns(api) {
  const raw = await api.storage.projectLocal.read(AUTOMATION_RUNS_KEY);
  return Array.isArray(raw) ? raw : [];
}
function addHistory(card, action, detail, agentId) {
  card.history.push({ action, timestamp: Date.now(), detail, agentId });
  card.updatedAt = Date.now();
}
async function triggerAutomation(api, card, board) {
  const state = board.states.find((s) => s.id === card.stateId);
  if (!state || !state.isAutomatic) return;
  const swimlane = board.swimlanes.find((l) => l.id === card.swimlaneId);
  if (!swimlane || !swimlane.managerAgentId) return;
  if (card.automationAttempts >= board.config.maxRetries) {
    return;
  }
  const prompt = [
    "You are working on a Kanban card task. Complete the following outcome:",
    "",
    `OUTCOME: ${state.automationPrompt}`,
    "",
    `CARD TITLE: ${card.title}`,
    `CARD DESCRIPTION: ${card.body}`,
    "",
    "Complete the work needed to satisfy the outcome above. Focus only on completing the task.",
    "When done, provide a summary of what you accomplished."
  ].join("\n");
  try {
    const executionAgentId = await api.agents.runQuick(prompt);
    const configuredEvalAgent = swimlane.evaluationAgentId ?? swimlane.managerAgentId;
    await mutateStorage(api.storage.projectLocal, AUTOMATION_RUNS_KEY, (runs) => {
      runs.push({
        cardId: card.id,
        boardId: board.id,
        stateId: card.stateId,
        swimlaneId: card.swimlaneId,
        executionAgentId,
        evaluationAgentId: null,
        configuredEvaluationAgentId: configuredEvalAgent,
        phase: "executing",
        attempt: card.automationAttempts + 1,
        startedAt: Date.now()
      });
      return runs;
    });
    await mutateStorage(cardsStor(api, board), cardsKey(board.id), (cards) => {
      const idx = cards.findIndex((c) => c.id === card.id);
      if (idx !== -1) {
        cards[idx].automationAttempts++;
        addHistory(
          cards[idx],
          "automation-started",
          `Automation attempt ${cards[idx].automationAttempts} started`,
          executionAgentId
        );
      }
      return cards;
    });
    kanBossState.triggerRefresh();
  } catch {
    api.logging.warn("KanBoss: Failed to spawn execution agent", { cardId: card.id });
  }
}
async function onAgentCompleted(api, agentId, outcome) {
  const allRuns = await loadRuns(api);
  const run = allRuns.find(
    (r) => r.executionAgentId === agentId && r.phase === "executing" || r.evaluationAgentId === agentId && r.phase === "evaluating"
  );
  if (!run) return;
  const board = await loadBoard(api, run.boardId);
  if (!board) return;
  const cardSnapshot = (await loadCards(api, board)).find((c) => c.id === run.cardId);
  if (!cardSnapshot) return;
  const stor = cardsStor(api, board);
  const key = cardsKey(board.id);
  if (run.phase === "executing") {
    if (outcome === "error") {
      await mutateStorage(api.storage.projectLocal, AUTOMATION_RUNS_KEY, (runs) => runs.filter((r) => r.executionAgentId !== agentId || r.phase !== "executing"));
      await mutateStorage(stor, key, (cards) => {
        const idx = cards.findIndex((c) => c.id === run.cardId);
        if (idx !== -1) {
          addHistory(cards[idx], "automation-failed", "Execution agent errored", agentId);
          checkStuck(cards[idx], board);
        }
        return cards;
      });
      kanBossState.triggerRefresh();
      return;
    }
    const completed = api.agents.listCompleted();
    const info = completed.find((c) => c.id === agentId);
    const state = board.states.find((s) => s.id === run.stateId);
    if (!state) return;
    const evalCriteria = state.evaluationPrompt?.trim() ? state.evaluationPrompt : state.automationPrompt;
    const evalPrompt = [
      "Evaluate whether this outcome has been met:",
      "",
      `OUTCOME: ${evalCriteria}`,
      "",
      `CARD: ${cardSnapshot.title} \u2014 ${cardSnapshot.body}`,
      "",
      `AGENT SUMMARY: ${info?.summary ?? "No summary available"}`,
      `FILES MODIFIED: ${info?.filesModified?.join(", ") ?? "None"}`,
      "",
      "Respond with EXACTLY one of:",
      "RESULT: PASS",
      "RESULT: FAIL",
      "",
      "Followed by a brief explanation."
    ].join("\n");
    try {
      const evalAgentId = await api.agents.runQuick(evalPrompt);
      await mutateStorage(api.storage.projectLocal, AUTOMATION_RUNS_KEY, (runs) => runs.map(
        (r) => r.executionAgentId === agentId && r.phase === "executing" ? { ...r, evaluationAgentId: evalAgentId, phase: "evaluating" } : r
      ));
    } catch {
      await mutateStorage(api.storage.projectLocal, AUTOMATION_RUNS_KEY, (runs) => runs.filter((r) => r.executionAgentId !== agentId || r.phase !== "executing"));
      await mutateStorage(stor, key, (cards) => {
        const idx = cards.findIndex((c) => c.id === run.cardId);
        if (idx !== -1) {
          addHistory(cards[idx], "automation-failed", "Failed to spawn evaluation agent", agentId);
          checkStuck(cards[idx], board);
        }
        return cards;
      });
      kanBossState.triggerRefresh();
    }
    return;
  }
  if (run.phase === "evaluating") {
    const completed = api.agents.listCompleted();
    const info = completed.find((c) => c.id === agentId);
    const summary = info?.summary ?? "";
    const passed = summary.includes("RESULT: PASS");
    await mutateStorage(api.storage.projectLocal, AUTOMATION_RUNS_KEY, (runs) => runs.filter((r) => r.evaluationAgentId !== agentId || r.phase !== "evaluating"));
    if (passed) {
      const currentState = board.states.find((s) => s.id === cardSnapshot.stateId);
      if (!currentState) return;
      const sortedStates = [...board.states].sort((a, b) => a.order - b.order);
      const nextStateIdx = sortedStates.findIndex((s) => s.id === currentState.id) + 1;
      if (nextStateIdx < sortedStates.length) {
        const nextState = sortedStates[nextStateIdx];
        const updatedCards = await mutateStorage(stor, key, (cards) => {
          const idx = cards.findIndex((c) => c.id === run.cardId);
          if (idx !== -1) {
            cards[idx].stateId = nextState.id;
            cards[idx].automationAttempts = 0;
            addHistory(
              cards[idx],
              "automation-succeeded",
              `Automation passed \u2014 moved to "${nextState.name}"`,
              agentId
            );
            addHistory(cards[idx], "moved", `Moved from "${currentState.name}" to "${nextState.name}"`);
          }
          return cards;
        });
        kanBossState.triggerRefresh();
        if (nextState.isAutomatic) {
          const freshCard = updatedCards.find((c) => c.id === run.cardId);
          if (freshCard) {
            await triggerAutomation(api, freshCard, board);
          }
        }
      } else {
        await mutateStorage(stor, key, (cards) => {
          const idx = cards.findIndex((c) => c.id === run.cardId);
          if (idx !== -1) {
            addHistory(cards[idx], "automation-succeeded", "Automation passed (already at final state)", agentId);
          }
          return cards;
        });
        kanBossState.triggerRefresh();
      }
    } else {
      const reason = summary.replace(/RESULT:\s*FAIL\s*/i, "").trim() || "Evaluation failed";
      const updatedCards = await mutateStorage(stor, key, (cards) => {
        const idx = cards.findIndex((c) => c.id === run.cardId);
        if (idx !== -1) {
          addHistory(cards[idx], "automation-failed", `Automation failed: ${reason}`, agentId);
          checkStuck(cards[idx], board);
        }
        return cards;
      });
      kanBossState.triggerRefresh();
      const updatedCard = updatedCards.find((c) => c.id === run.cardId);
      if (updatedCard && updatedCard.automationAttempts < board.config.maxRetries) {
        await triggerAutomation(api, updatedCard, board);
      }
    }
  }
}
function checkStuck(card, board) {
  if (card.automationAttempts >= board.config.maxRetries) {
    addHistory(
      card,
      "automation-stuck",
      `Card stuck after ${card.automationAttempts} attempts (max: ${board.config.maxRetries})`
    );
  }
}
function initAutomationEngine(api) {
  engineApi = api;
  const statusSub = api.agents.onStatusChange((agentId, status, prevStatus) => {
    if (!engineApi) return;
    const isCompleted = prevStatus === "running" && status === "sleeping" || prevStatus === "running" && status === "error";
    if (!isCompleted) return;
    const outcome = status === "sleeping" ? "success" : "error";
    onAgentCompleted(engineApi, agentId, outcome);
  });
  return statusSub;
}
function shutdownAutomationEngine() {
  engineApi = null;
}

// src/BoardView.tsx
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
var React6 = globalThis.React;
var { useEffect: useEffect4, useState: useState5, useCallback: useCallback6, useRef: useRef3 } = React6;
function cardsStorage(api, board) {
  return board.config.gitHistory ? api.storage.project : api.storage.projectLocal;
}
function applyFilter(cards, filter) {
  let result = cards;
  if (filter.searchQuery) {
    const q = filter.searchQuery.toLowerCase();
    result = result.filter((c) => c.title.toLowerCase().includes(q) || c.body.toLowerCase().includes(q));
  }
  if (filter.priorityFilter !== "all") {
    result = result.filter((c) => c.priority === filter.priorityFilter);
  }
  if (filter.labelFilter !== "all") {
    result = result.filter((c) => c.labels.includes(filter.labelFilter));
  }
  if (filter.stuckOnly) {
    result = result.filter(isCardStuck);
  }
  return result;
}
var PULSE_STYLE = `
@keyframes kanboss-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
`;
function BoardView({ api }) {
  const boardsStorage = api.storage.projectLocal;
  const [board, setBoard] = useState5(null);
  const [cards, setCards] = useState5([]);
  const [selectedBoardId, setSelectedBoardId] = useState5(null);
  const [showCardDialog, setShowCardDialog] = useState5(false);
  const [showConfigDialog, setShowConfigDialog] = useState5(false);
  const [zoomLevel, setZoomLevel] = useState5(1);
  const [filter, setFilter] = useState5(kanBossState.filter);
  const loadBoard2 = useCallback6(async () => {
    const boardId = kanBossState.selectedBoardId;
    if (!boardId) {
      setBoard(null);
      setCards([]);
      return;
    }
    const raw = await boardsStorage.read(BOARDS_KEY);
    const boards = Array.isArray(raw) ? raw : [];
    const found = boards.find((b) => b.id === boardId) ?? null;
    setBoard(found);
    if (found) {
      setZoomLevel(found.config.zoomLevel);
      const cardsStor2 = cardsStorage(api, found);
      const cardsRaw = await cardsStor2.read(cardsKey(found.id));
      setCards(Array.isArray(cardsRaw) ? cardsRaw : []);
    } else {
      setCards([]);
    }
  }, [boardsStorage, api]);
  const loadBoardRef = useRef3(loadBoard2);
  loadBoardRef.current = loadBoard2;
  const refreshRef2 = useRef3(kanBossState.refreshCount);
  const prevBoardIdRef = useRef3(kanBossState.selectedBoardId);
  useEffect4(() => {
    setSelectedBoardId(kanBossState.selectedBoardId);
    prevBoardIdRef.current = kanBossState.selectedBoardId;
    loadBoardRef.current();
    const unsub = kanBossState.subscribe(() => {
      setSelectedBoardId(kanBossState.selectedBoardId);
      setShowCardDialog(kanBossState.editingCardId !== null);
      setShowConfigDialog(kanBossState.configuringBoard);
      setFilter((prev) => filtersEqual(prev, kanBossState.filter) ? prev : { ...kanBossState.filter });
      const boardChanged = kanBossState.selectedBoardId !== prevBoardIdRef.current;
      const refreshed = kanBossState.refreshCount !== refreshRef2.current;
      if (boardChanged) {
        prevBoardIdRef.current = kanBossState.selectedBoardId;
      }
      if (refreshed) {
        refreshRef2.current = kanBossState.refreshCount;
      }
      if (boardChanged || refreshed) {
        loadBoardRef.current();
      }
    });
    return unsub;
  }, []);
  const scrollRef = useRef3(null);
  const zoomRef = useRef3(zoomLevel);
  zoomRef.current = zoomLevel;
  const adjustZoom = useCallback6(async (delta) => {
    if (!board) return;
    const newZoom = Math.max(0.5, Math.min(2, Math.round((zoomLevel + delta) * 20) / 20));
    setZoomLevel(newZoom);
    await mutateStorage(boardsStorage, BOARDS_KEY, (boards) => {
      const idx = boards.findIndex((b) => b.id === board.id);
      if (idx !== -1) {
        boards[idx].config.zoomLevel = newZoom;
      }
      return boards;
    });
  }, [board, zoomLevel, boardsStorage]);
  useEffect4(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const cur = zoomRef.current;
      const next = Math.max(0.5, Math.min(2, Math.round((cur + delta) * 100) / 100));
      if (next !== cur) adjustZoom(next - cur);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [adjustZoom]);
  const handleMoveCard = useCallback6(async (cardId, targetStateId, targetSwimlaneId) => {
    if (!board) return;
    let movedCard = null;
    let toStateAutomatic = false;
    const updated = await mutateStorage(cardsStorage(api, board), cardsKey(board.id), (allCards) => {
      const idx = allCards.findIndex((c) => c.id === cardId);
      if (idx === -1) return allCards;
      const card = allCards[idx];
      const stateChanged = card.stateId !== targetStateId;
      const laneChanged = targetSwimlaneId != null && card.swimlaneId !== targetSwimlaneId;
      if (!stateChanged && !laneChanged) return allCards;
      const fromState = board.states.find((s) => s.id === card.stateId);
      const toState = board.states.find((s) => s.id === targetStateId);
      if (!fromState || !toState) return allCards;
      const fromLane = laneChanged ? board.swimlanes.find((l) => l.id === card.swimlaneId) : null;
      const toLane = laneChanged && targetSwimlaneId ? board.swimlanes.find((l) => l.id === targetSwimlaneId) : null;
      card.stateId = targetStateId;
      if (targetSwimlaneId) card.swimlaneId = targetSwimlaneId;
      card.automationAttempts = 0;
      card.updatedAt = Date.now();
      let detail = "";
      if (stateChanged) detail = `Moved from "${fromState.name}" to "${toState.name}"`;
      if (laneChanged && fromLane && toLane) {
        detail += detail ? `, lane "${fromLane.name}" \u2192 "${toLane.name}"` : `Moved to lane "${toLane.name}"`;
      }
      card.history.push({ action: "moved", timestamp: Date.now(), detail });
      allCards[idx] = card;
      if (stateChanged && toState.isAutomatic) {
        movedCard = card;
        toStateAutomatic = true;
      }
      return allCards;
    });
    setCards([...updated]);
    kanBossState.triggerRefresh();
    if (toStateAutomatic && movedCard) {
      await triggerAutomation(api, movedCard, board);
    }
  }, [board, api]);
  const handleDeleteCard = useCallback6(async (cardId) => {
    if (!board) return;
    const updated = await mutateStorage(cardsStorage(api, board), cardsKey(board.id), (allCards) => allCards.filter((c) => c.id !== cardId));
    setCards(updated);
    kanBossState.triggerRefresh();
  }, [board, api]);
  const handleClearRetries = useCallback6(async (cardId) => {
    if (!board) return;
    let clearedCard = null;
    const updated = await mutateStorage(cardsStorage(api, board), cardsKey(board.id), (allCards) => {
      const idx = allCards.findIndex((c) => c.id === cardId);
      if (idx === -1) return allCards;
      allCards[idx].automationAttempts = 0;
      allCards[idx].updatedAt = Date.now();
      allCards[idx].history.push({
        action: "edited",
        timestamp: Date.now(),
        detail: "Retries cleared \u2014 automation can retry"
      });
      const state = board.states.find((s) => s.id === allCards[idx].stateId);
      if (state?.isAutomatic) {
        clearedCard = allCards[idx];
      }
      return allCards;
    });
    setCards([...updated]);
    kanBossState.triggerRefresh();
    if (clearedCard) {
      await triggerAutomation(api, clearedCard, board);
    }
  }, [board, api]);
  const handleManualAdvance = useCallback6(async (cardId) => {
    if (!board) return;
    const updated = await mutateStorage(cardsStorage(api, board), cardsKey(board.id), (allCards) => {
      const idx = allCards.findIndex((c) => c.id === cardId);
      if (idx === -1) return allCards;
      const card = allCards[idx];
      const sortedStates2 = [...board.states].sort((a, b) => a.order - b.order);
      const curIdx = sortedStates2.findIndex((s) => s.id === card.stateId);
      if (curIdx === -1 || curIdx >= sortedStates2.length - 1) return allCards;
      const nextState = sortedStates2[curIdx + 1];
      const fromState = sortedStates2[curIdx];
      card.stateId = nextState.id;
      card.automationAttempts = 0;
      card.updatedAt = Date.now();
      card.history.push({
        action: "moved",
        timestamp: Date.now(),
        detail: `Manually advanced from "${fromState.name}" to "${nextState.name}"`
      });
      allCards[idx] = card;
      return allCards;
    });
    setCards([...updated]);
    kanBossState.triggerRefresh();
  }, [board, api]);
  if (!board) {
    return /* @__PURE__ */ jsx6("div", { style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: color.textTertiary,
      fontSize: 12,
      height: "100%",
      fontFamily: font.family
    }, children: "Select a board to get started" });
  }
  const filteredCards = applyFilter(cards, filter);
  const sortedStates = [...board.states].sort((a, b) => a.order - b.order);
  const sortedLanes = [...board.swimlanes].sort((a, b) => a.order - b.order);
  const lastStateId = sortedStates.length > 0 ? sortedStates[sortedStates.length - 1].id : null;
  const gridCols = `140px repeat(${sortedStates.length}, minmax(220px, 1fr))`;
  return /* @__PURE__ */ jsxs6("div", { style: { display: "flex", flexDirection: "column", height: "100%", background: color.bg, fontFamily: font.family }, children: [
    /* @__PURE__ */ jsx6("style", { dangerouslySetInnerHTML: { __html: PULSE_STYLE } }),
    /* @__PURE__ */ jsxs6("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 16px",
      borderBottom: `1px solid ${color.border}`,
      background: color.bgSecondary,
      flexShrink: 0
    }, children: [
      /* @__PURE__ */ jsx6("span", { style: { fontSize: 14, fontWeight: 500, color: color.text }, children: board.name }),
      /* @__PURE__ */ jsx6("div", { style: { flex: 1 } }),
      /* @__PURE__ */ jsxs6("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
        /* @__PURE__ */ jsx6(
          "button",
          {
            onClick: () => adjustZoom(-0.1),
            disabled: zoomLevel <= 0.5,
            style: {
              padding: "2px 6px",
              fontSize: 12,
              color: color.textTertiary,
              background: color.bgTertiary,
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              opacity: zoomLevel <= 0.5 ? 0.3 : 1
            },
            children: "-"
          }
        ),
        /* @__PURE__ */ jsxs6("span", { style: { fontSize: 10, color: color.textTertiary, width: 40, textAlign: "center" }, children: [
          Math.round(zoomLevel * 100),
          "%"
        ] }),
        /* @__PURE__ */ jsx6(
          "button",
          {
            onClick: () => adjustZoom(0.1),
            disabled: zoomLevel >= 2,
            style: {
              padding: "2px 6px",
              fontSize: 12,
              color: color.textTertiary,
              background: color.bgTertiary,
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              opacity: zoomLevel >= 2 ? 0.3 : 1
            },
            children: "+"
          }
        )
      ] }),
      /* @__PURE__ */ jsx6(
        "button",
        {
          onClick: () => kanBossState.openBoardConfig(),
          title: "Board settings",
          style: {
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            color: color.textTertiary,
            background: "transparent",
            border: "none",
            borderRadius: 6,
            cursor: "pointer"
          },
          children: "\u2699"
        }
      )
    ] }),
    /* @__PURE__ */ jsx6(FilterBar, { filter, labels: board.labels || [] }),
    /* @__PURE__ */ jsx6("div", { ref: scrollRef, style: { flex: 1, overflow: "auto" }, children: /* @__PURE__ */ jsx6("div", { style: {
      transform: `scale(${zoomLevel})`,
      transformOrigin: "top left",
      minWidth: `${140 + sortedStates.length * 220}px`
    }, children: /* @__PURE__ */ jsxs6("div", { style: {
      display: "grid",
      gridTemplateColumns: gridCols,
      gap: 1,
      borderRadius: 12,
      overflow: "hidden",
      background: `${color.border}50`
    }, children: [
      /* @__PURE__ */ jsx6("div", { style: { background: color.bgSecondary, padding: 8 } }),
      sortedStates.map((state) => {
        const colCards = filteredCards.filter((c) => c.stateId === state.id);
        const overWip = state.wipLimit > 0 && colCards.length > state.wipLimit;
        return /* @__PURE__ */ jsx6(
          "div",
          {
            style: {
              background: color.bgSecondary,
              padding: 8,
              display: "flex",
              flexDirection: "column",
              ...overWip ? { borderBottom: `2px solid ${color.textError}` } : {}
            },
            children: /* @__PURE__ */ jsxs6("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [
              /* @__PURE__ */ jsx6("span", { style: { fontSize: 12, fontWeight: 500, color: color.text }, children: state.name }),
              state.isAutomatic && /* @__PURE__ */ jsxs6("span", { style: {
                fontSize: 9,
                padding: "1px 6px",
                borderRadius: 99,
                background: color.accentBg,
                color: color.accent,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 3
              }, children: [
                "\u2699",
                " auto"
              ] }),
              state.wipLimit > 0 && /* @__PURE__ */ jsxs6("span", { style: {
                fontSize: 9,
                color: overWip ? color.textError : color.textTertiary,
                fontWeight: overWip ? 600 : 400
              }, children: [
                colCards.length,
                "/",
                state.wipLimit
              ] })
            ] })
          },
          `header-${state.id}`
        );
      }),
      sortedLanes.flatMap((lane, laneIndex) => {
        const laneAgents = api.agents.list();
        const managerAgent = lane.managerAgentId ? laneAgents.find((a) => a.id === lane.managerAgentId) : null;
        const evenBg = color.bgSecondary;
        const oddBg = color.bg;
        const laneBg = laneIndex % 2 === 0 ? evenBg : oddBg;
        const cellBg = laneIndex % 2 === 0 ? color.bg : `${color.bgSecondary}80`;
        return [
          // Swimlane label
          /* @__PURE__ */ jsxs6(
            "div",
            {
              style: {
                background: laneBg,
                padding: 8,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center"
              },
              children: [
                /* @__PURE__ */ jsx6("span", { style: { fontSize: 12, fontWeight: 500, color: color.text }, children: lane.name }),
                managerAgent && /* @__PURE__ */ jsx6("div", { style: { display: "flex", alignItems: "center", gap: 4, marginTop: 4 }, children: /* @__PURE__ */ jsx6("span", { style: { fontSize: 9, color: color.textTertiary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: managerAgent.name }) })
              ]
            },
            `lane-${lane.id}`
          ),
          // Card cells
          ...sortedStates.map((state) => {
            const cellCards = filteredCards.filter(
              (c) => c.stateId === state.id && c.swimlaneId === lane.id
            );
            return /* @__PURE__ */ jsx6(
              "div",
              {
                style: { background: cellBg, display: "flex", flexDirection: "column" },
                children: /* @__PURE__ */ jsx6(
                  CardCell,
                  {
                    cards: cellCards,
                    stateId: state.id,
                    swimlaneId: lane.id,
                    isLastState: state.id === lastStateId,
                    allStates: sortedStates,
                    boardLabels: board.labels || [],
                    wipLimit: state.wipLimit,
                    onMoveCard: handleMoveCard,
                    onDeleteCard: handleDeleteCard,
                    onClearRetries: handleClearRetries,
                    onManualAdvance: handleManualAdvance
                  }
                )
              },
              `cell-${lane.id}-${state.id}`
            );
          })
        ];
      })
    ] }) }) }),
    showCardDialog && /* @__PURE__ */ jsx6(CardDialog, { api, boardId: board.id, boardLabels: board.labels || [] }),
    showConfigDialog && /* @__PURE__ */ jsx6(BoardConfigDialog, { api, board })
  ] });
}

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
  const React8 = globalThis.React;
  const [theme, setTheme] = React8.useState(() => themeApi.getCurrent());
  React8.useEffect(() => {
    setTheme(themeApi.getCurrent());
    const disposable = themeApi.onDidChange((t) => setTheme(t));
    return () => disposable.dispose();
  }, [themeApi]);
  const style = React8.useMemo(
    () => mapThemeToCSS(theme),
    [theme]
  );
  return { style, themeType: theme.type };
}

// src/main.tsx
import { jsx as jsx7 } from "react/jsx-runtime";
var React7 = globalThis.React;
function activate(ctx, api) {
  kanBossState.switchProject();
  api.logging.info("KanBoss plugin activated");
  const refreshCmd = api.commands.register("refresh", () => {
    kanBossState.triggerRefresh();
  });
  ctx.subscriptions.push(refreshCmd);
  const newBoardCmd = api.commands.register("new-board", async () => {
    const name = await api.ui.showInput("Board name", "New Board");
    if (!name) return;
    kanBossState.triggerRefresh();
  });
  ctx.subscriptions.push(newBoardCmd);
  const automationSub = initAutomationEngine(api);
  ctx.subscriptions.push(automationSub);
}
function deactivate() {
  shutdownAutomationEngine();
  kanBossState.reset();
}
function SidebarPanel({ api }) {
  const { style: themeStyle } = useTheme(api.theme);
  return /* @__PURE__ */ jsx7("div", { style: { ...themeStyle, height: "100%" }, children: /* @__PURE__ */ jsx7(BoardSidebar, { api }) });
}
function MainPanel({ api }) {
  const { style: themeStyle } = useTheme(api.theme);
  return /* @__PURE__ */ jsx7("div", { style: { ...themeStyle }, children: /* @__PURE__ */ jsx7(BoardView, { api }) });
}
export {
  MainPanel,
  SidebarPanel,
  activate,
  deactivate
};
