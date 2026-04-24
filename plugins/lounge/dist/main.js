// src/main.ts
import React2, { useEffect, useMemo, useState, useCallback, useRef } from "react";

// node_modules/zustand/esm/vanilla.mjs
var createStoreImpl = (createState) => {
  let state;
  const listeners = /* @__PURE__ */ new Set();
  const setState = (partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };
  const getState = () => state;
  const getInitialState = () => initialState;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const api = { setState, getState, getInitialState, subscribe };
  const initialState = state = createState(setState, getState, api);
  return api;
};
var createStore = (createState) => createState ? createStoreImpl(createState) : createStoreImpl;

// node_modules/zustand/esm/react.mjs
import React from "react";
var identity = (arg) => arg;
function useStore(api, selector = identity) {
  const slice = React.useSyncExternalStore(
    api.subscribe,
    React.useCallback(() => selector(api.getState()), [api, selector]),
    React.useCallback(() => selector(api.getInitialState()), [api, selector])
  );
  React.useDebugValue(slice);
  return slice;
}
var createImpl = (createState) => {
  const api = createStore(createState);
  const useBoundStore = (selector) => useStore(api, selector);
  Object.assign(useBoundStore, api);
  return useBoundStore;
};
var create = (createState) => createState ? createImpl(createState) : createImpl;

// src/state.ts
var DEFAULT_CIRCLE_ID = "circle:general";
var DEFAULT_CIRCLE_LABEL = "General";
var DEFAULT_CIRCLE_EMOJI = "\u{1F4AC}";
var DEFAULT_PROJECT_EMOJI = "\u{1F4C1}";
var DEFAULT_CUSTOM_EMOJI = "\u2B50";
var RESERVED_NAMES = /* @__PURE__ */ new Set(["general"]);
function isReservedCircleName(label) {
  return RESERVED_NAMES.has(label.toLowerCase().trim());
}
function isDefaultCircle(categoryId) {
  return categoryId === DEFAULT_CIRCLE_ID;
}
function isDuplicateCircleName(label, categories, excludeId) {
  const normalized = label.toLowerCase().trim();
  return categories.some((c) => c.id !== excludeId && c.label.toLowerCase().trim() === normalized);
}
function getPersistedState(state) {
  return {
    renamedLabels: state.renamedLabels,
    agentCategoryOverrides: state.agentCategoryOverrides,
    customCircles: state.customCircles,
    nextCircleId: state.nextCircleId,
    categoryOrder: state.categoryOrder,
    categoryEmojis: state.categoryEmojis,
    agentOrder: state.agentOrder,
    collapsed: Array.from(state.collapsed),
    showTags: state.showTags,
    sidebarCollapsed: state.sidebarCollapsed,
    sidebarWidth: state.sidebarWidth
  };
}
function groupAgentsByCategory(agents, categories, overrides = {}) {
  const projectToCategory = /* @__PURE__ */ new Map();
  for (const cat of categories) {
    if (cat.projectId) {
      projectToCategory.set(cat.projectId, cat.id);
    }
  }
  const validCategoryIds = new Set(categories.map((c) => c.id));
  const groups = /* @__PURE__ */ new Map();
  for (const cat of categories) {
    groups.set(cat.id, []);
  }
  for (const agent of agents) {
    const overrideCatId = overrides[agent.id];
    const catId = overrideCatId && validCategoryIds.has(overrideCatId) ? overrideCatId : projectToCategory.get(agent.projectId);
    if (catId && groups.has(catId)) {
      groups.get(catId).push(agent);
    } else if (groups.has(DEFAULT_CIRCLE_ID)) {
      groups.get(DEFAULT_CIRCLE_ID).push(agent);
    }
  }
  return groups;
}
function sortAgentsByOrder(agents, order) {
  if (!order || order.length === 0) return agents;
  const posMap = new Map(order.map((id, i) => [id, i]));
  const ordered = [];
  const unordered = [];
  for (const agent of agents) {
    if (posMap.has(agent.id)) {
      ordered.push(agent);
    } else {
      unordered.push(agent);
    }
  }
  ordered.sort((a, b) => posMap.get(a.id) - posMap.get(b.id));
  return [...ordered, ...unordered];
}
function disambiguateAgentName(agent, allAgents, projects) {
  const sameNameAgents = allAgents.filter((a) => a.name === agent.name);
  if (sameNameAgents.length <= 1) return agent.name;
  const project = projects.find((p) => p.id === agent.projectId);
  const projectLabel = project?.name ?? agent.projectId;
  return `${projectLabel}/${agent.name}`;
}
var GENERAL_CIRCLE = { id: DEFAULT_CIRCLE_ID, label: DEFAULT_CIRCLE_LABEL, emoji: DEFAULT_CIRCLE_EMOJI };
function applyCategoryOrder(categories, order) {
  if (order.length === 0) return categories;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const result = [];
  const placed = /* @__PURE__ */ new Set();
  for (const id of order) {
    if (id === DEFAULT_CIRCLE_ID) continue;
    const cat = byId.get(id);
    if (cat) {
      result.push(cat);
      placed.add(id);
    }
  }
  for (const cat of categories) {
    if (!placed.has(cat.id) && cat.id !== DEFAULT_CIRCLE_ID) {
      result.push(cat);
    }
  }
  const general = byId.get(DEFAULT_CIRCLE_ID);
  if (general) result.push(general);
  return result;
}
var createLoungeStore = () => create((set, get) => ({
  categories: [GENERAL_CIRCLE],
  collapsed: /* @__PURE__ */ new Set(),
  selectedAgentId: null,
  selectedProjectId: null,
  renamedLabels: {},
  agentCategoryOverrides: {},
  customCircles: [],
  nextCircleId: 1,
  categoryOrder: [],
  categoryEmojis: {},
  agentOrder: {},
  hydrated: false,
  showTags: true,
  sidebarCollapsed: false,
  sidebarWidth: 256,
  deriveCategories(projects) {
    set((state) => {
      const projectCategories = projects.map((p) => {
        const catId = `project:${p.id}`;
        const rawLabel = state.renamedLabels[catId] ?? p.name;
        const label = isReservedCircleName(rawLabel) ? `${rawLabel} (project)` : rawLabel;
        return {
          id: catId,
          label,
          emoji: state.categoryEmojis[catId] ?? DEFAULT_PROJECT_EMOJI,
          projectId: p.id
        };
      });
      const customWithEmojis = state.customCircles.map((c) => ({
        ...c,
        emoji: state.categoryEmojis[c.id] ?? c.emoji
      }));
      const general = {
        ...GENERAL_CIRCLE,
        emoji: state.categoryEmojis[DEFAULT_CIRCLE_ID] ?? GENERAL_CIRCLE.emoji
      };
      const unordered = [...projectCategories, ...customWithEmojis, general];
      const newCategories = applyCategoryOrder(unordered, state.categoryOrder);
      const newIds = new Set(newCategories.map((c) => c.id));
      const newCollapsed = /* @__PURE__ */ new Set();
      for (const id of state.collapsed) {
        if (newIds.has(id)) newCollapsed.add(id);
      }
      return { categories: newCategories, collapsed: newCollapsed };
    });
  },
  toggleCollapsed(categoryId) {
    set((state) => {
      const next = new Set(state.collapsed);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return { collapsed: next };
    });
  },
  selectAgent(agentId, projectId) {
    set({ selectedAgentId: agentId, selectedProjectId: projectId ?? null });
  },
  renameCategory(categoryId, label) {
    if (isDefaultCircle(categoryId)) return;
    if (!label.trim() || isReservedCircleName(label)) return;
    if (!get().hydrated) return;
    if (isDuplicateCircleName(label, get().categories, categoryId)) return;
    set((state) => {
      const newLabels = { ...state.renamedLabels, [categoryId]: label };
      const newCategories = state.categories.map(
        (c) => c.id === categoryId ? { ...c, label } : c
      );
      const newCustomCircles = state.customCircles.map(
        (c) => c.id === categoryId ? { ...c, label } : c
      );
      return { renamedLabels: newLabels, categories: newCategories, customCircles: newCustomCircles };
    });
  },
  moveAgent(agentId, targetCategoryId) {
    if (!get().hydrated) return;
    set((state) => {
      const newAgentOrder = { ...state.agentOrder };
      for (const [catId, order] of Object.entries(newAgentOrder)) {
        if (order.includes(agentId)) {
          newAgentOrder[catId] = order.filter((id) => id !== agentId);
        }
      }
      const targetOrder = newAgentOrder[targetCategoryId] ?? [];
      newAgentOrder[targetCategoryId] = [...targetOrder, agentId];
      return {
        agentCategoryOverrides: { ...state.agentCategoryOverrides, [agentId]: targetCategoryId },
        agentOrder: newAgentOrder
      };
    });
  },
  placeAgent(agentId, targetCategoryId, beforeAgentId, currentAgentIds) {
    if (!get().hydrated) return;
    set((state) => {
      const newAgentOrder = { ...state.agentOrder };
      for (const [catId, order] of Object.entries(newAgentOrder)) {
        if (order.includes(agentId)) {
          newAgentOrder[catId] = order.filter((id) => id !== agentId);
        }
      }
      let targetOrder;
      if (currentAgentIds) {
        targetOrder = currentAgentIds.filter((id) => id !== agentId);
      } else {
        targetOrder = [...newAgentOrder[targetCategoryId] ?? []];
      }
      if (beforeAgentId) {
        const idx = targetOrder.indexOf(beforeAgentId);
        if (idx >= 0) {
          targetOrder.splice(idx, 0, agentId);
        } else {
          targetOrder.push(agentId);
        }
      } else {
        targetOrder.push(agentId);
      }
      newAgentOrder[targetCategoryId] = targetOrder;
      return {
        agentCategoryOverrides: { ...state.agentCategoryOverrides, [agentId]: targetCategoryId },
        agentOrder: newAgentOrder
      };
    });
  },
  addCircle(label) {
    if (!label.trim()) return "";
    if (isReservedCircleName(label)) return "";
    if (!get().hydrated) return "";
    if (isDuplicateCircleName(label, get().categories)) return "";
    let newId = "";
    set((state) => {
      const id = `circle:${state.nextCircleId}`;
      newId = id;
      const circle = { id, label, emoji: DEFAULT_CUSTOM_EMOJI };
      const newCustomCircles = [...state.customCircles, circle];
      const cats = state.categories.filter((c) => c.id !== DEFAULT_CIRCLE_ID);
      return {
        customCircles: newCustomCircles,
        categories: [...cats, circle, GENERAL_CIRCLE],
        nextCircleId: state.nextCircleId + 1
      };
    });
    return newId;
  },
  deleteCircle(circleId) {
    if (isDefaultCircle(circleId)) return;
    if (!circleId.startsWith("circle:")) return;
    if (!get().hydrated) return;
    set((state) => {
      const newCustomCircles = state.customCircles.filter((c) => c.id !== circleId);
      const newCategories = state.categories.filter((c) => c.id !== circleId);
      const newOverrides = { ...state.agentCategoryOverrides };
      for (const [agentId, catId] of Object.entries(newOverrides)) {
        if (catId === circleId) delete newOverrides[agentId];
      }
      const newOrder = state.categoryOrder.filter((id) => id !== circleId);
      const { [circleId]: _emoji, ...newEmojis } = state.categoryEmojis;
      const { [circleId]: _label, ...newLabels } = state.renamedLabels;
      const { [circleId]: _agentOrder, ...newAgentOrder } = state.agentOrder;
      const newCollapsed = new Set(state.collapsed);
      newCollapsed.delete(circleId);
      return {
        customCircles: newCustomCircles,
        categories: newCategories,
        agentCategoryOverrides: newOverrides,
        categoryOrder: newOrder,
        categoryEmojis: newEmojis,
        renamedLabels: newLabels,
        agentOrder: newAgentOrder,
        collapsed: newCollapsed
      };
    });
  },
  reorderCategory(fromId, toId) {
    if (isDefaultCircle(fromId) || isDefaultCircle(toId)) return;
    if (fromId === toId) return;
    if (!get().hydrated) return;
    set((state) => {
      const cats = state.categories.filter((c) => c.id !== DEFAULT_CIRCLE_ID);
      const fromIdx = cats.findIndex((c) => c.id === fromId);
      const toIdx = cats.findIndex((c) => c.id === toId);
      if (fromIdx === -1 || toIdx === -1) return state;
      const reordered = [...cats];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      reordered.push(GENERAL_CIRCLE);
      return {
        categories: reordered,
        categoryOrder: reordered.map((c) => c.id)
      };
    });
  },
  setCategoryEmoji(categoryId, emoji) {
    if (!get().hydrated) return;
    set((state) => {
      const newEmojis = { ...state.categoryEmojis, [categoryId]: emoji };
      const newCategories = state.categories.map(
        (c) => c.id === categoryId ? { ...c, emoji } : c
      );
      const newCustomCircles = state.customCircles.map(
        (c) => c.id === categoryId ? { ...c, emoji } : c
      );
      return { categoryEmojis: newEmojis, categories: newCategories, customCircles: newCustomCircles };
    });
  },
  toggleShowTags() {
    set((state) => ({ showTags: !state.showTags }));
  },
  toggleSidebar() {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },
  setSidebarWidth(width) {
    const clamped = Math.max(160, Math.min(480, width));
    set({ sidebarWidth: clamped });
  },
  loadPersistedState(data) {
    set({
      renamedLabels: data.renamedLabels ?? {},
      agentCategoryOverrides: data.agentCategoryOverrides ?? {},
      customCircles: data.customCircles ?? [],
      nextCircleId: data.nextCircleId ?? 1,
      categoryOrder: data.categoryOrder ?? [],
      categoryEmojis: data.categoryEmojis ?? {},
      agentOrder: data.agentOrder ?? {},
      collapsed: new Set(data.collapsed ?? []),
      showTags: data.showTags ?? true,
      sidebarCollapsed: data.sidebarCollapsed ?? false,
      sidebarWidth: data.sidebarWidth ?? 256,
      hydrated: true
    });
  }
}));

// src/tag-helpers.ts
var ORCHESTRATOR_COLORS = {
  "claude-code": { bg: "rgba(249,115,22,0.2)", text: "#fb923c" },
  "copilot-cli": { bg: "rgba(59,130,246,0.2)", text: "#60a5fa" }
};
var DEFAULT_ORCH_COLOR = { bg: "rgba(148,163,184,0.2)", text: "#94a3b8" };
function getOrchestratorColor(id) {
  return ORCHESTRATOR_COLORS[id] || DEFAULT_ORCH_COLOR;
}
var ORCHESTRATOR_DISPLAY_NAMES = {
  "claude-code": "CC",
  "copilot-cli": "GHCP",
  "codex-cli": "Codex"
};
function getOrchestratorLabel(orchId, allOrchestrators) {
  const info = allOrchestrators?.find((o) => o.id === orchId);
  if (info) return info.shortName || info.displayName || orchId;
  return ORCHESTRATOR_DISPLAY_NAMES[orchId] || orchId;
}
var MODEL_PALETTE = [
  { bg: "rgba(168,85,247,0.2)", text: "#c084fc" },
  { bg: "rgba(20,184,166,0.2)", text: "#2dd4bf" },
  { bg: "rgba(236,72,153,0.2)", text: "#f472b6" },
  { bg: "rgba(34,197,94,0.2)", text: "#4ade80" },
  { bg: "rgba(251,191,36,0.2)", text: "#fbbf24" },
  { bg: "rgba(99,102,241,0.2)", text: "#818cf8" },
  { bg: "rgba(14,165,233,0.2)", text: "#38bdf8" }
];
var DEFAULT_MODEL_COLOR = { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" };
var modelColorCache = /* @__PURE__ */ new Map();
function getModelColor(model) {
  let color = modelColorCache.get(model);
  if (!color) {
    let hash = 0;
    for (let i = 0; i < model.length; i++) hash = hash * 31 + model.charCodeAt(i) | 0;
    color = MODEL_PALETTE[(hash % MODEL_PALETTE.length + MODEL_PALETTE.length) % MODEL_PALETTE.length];
    modelColorCache.set(model, color);
  }
  return color;
}
function formatModelLabel(model) {
  if (!model || model === "default") return "Default";
  return model.charAt(0).toUpperCase() + model.slice(1);
}
var FREE_AGENT_COLOR = { bg: "rgba(239,68,68,0.15)", text: "#f87171" };
function getModelTagColor(model) {
  if (!model || model === "default") return DEFAULT_MODEL_COLOR;
  return getModelColor(model);
}

// src/main.ts
var useLoungeStore = createLoungeStore();
var STORAGE_KEY = "lounge-state";
function activate(ctx, _api) {
}
function deactivate() {
}
function statusLabel(status) {
  switch (status) {
    case "running":
      return "Running";
    case "sleeping":
      return "Sleeping";
    case "error":
      return "Error";
    case "creating":
      return "Creating";
    default:
      return status;
  }
}
function AgentRow({ agent, displayName, isSelected, showTags, orchestrators, api, onClick, onContextMenu }) {
  const handleDragStart = useCallback((e) => {
    e.dataTransfer.setData("application/x-lounge-agent", agent.id);
    e.dataTransfer.effectAllowed = "move";
  }, [agent.id]);
  const { AgentAvatar } = api.widgets;
  const detailed = api.agents.getDetailedStatus(agent.id);
  const statusText = detailed?.message ?? statusLabel(agent.status);
  const statusTextColor = detailed?.state === "needs_permission" ? "text-ctp-peach" : detailed?.state === "tool_error" ? "text-ctp-red" : "text-ctp-overlay0";
  return React2.createElement(
    "button",
    {
      key: agent.id,
      onClick,
      onContextMenu,
      draggable: true,
      onDragStart: handleDragStart,
      title: `${displayName} \u2014 ${statusLabel(agent.status)}`,
      "data-testid": `lounge-agent-${agent.id}`,
      className: `w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors flex items-center gap-3 ${isSelected ? "bg-surface-1 text-ctp-text" : "text-ctp-subtext1 hover:bg-surface-0 hover:text-ctp-text"}`
    },
    React2.createElement(
      "div",
      { className: "flex-shrink-0" },
      React2.createElement(AgentAvatar, { agentId: agent.id, size: "sm", showStatusRing: true })
    ),
    React2.createElement(
      "div",
      { className: "min-w-0 flex-1" },
      React2.createElement("span", { className: "truncate block" }, displayName),
      showTags && React2.createElement(
        "div",
        {
          className: "flex items-center gap-1 mt-0.5 flex-wrap",
          "data-testid": `lounge-agent-tags-${agent.id}`
        },
        // Provider tag
        agent.orchestrator && (() => {
          const c = getOrchestratorColor(agent.orchestrator);
          return React2.createElement("span", {
            style: { backgroundColor: c.bg, color: c.text, fontSize: "10px", padding: "1px 6px", borderRadius: "4px", lineHeight: "16px", whiteSpace: "nowrap" },
            "data-testid": "lounge-tag-provider"
          }, getOrchestratorLabel(agent.orchestrator, orchestrators));
        })(),
        // Model tag
        (() => {
          const label = formatModelLabel(agent.model);
          const c = getModelTagColor(agent.model);
          return React2.createElement("span", {
            style: { backgroundColor: c.bg, color: c.text, fontSize: "10px", padding: "1px 6px", borderRadius: "4px", lineHeight: "16px", fontFamily: "monospace", whiteSpace: "nowrap" },
            "data-testid": "lounge-tag-model"
          }, label);
        })(),
        // Free Agent tag
        agent.freeAgentMode && React2.createElement("span", {
          style: { backgroundColor: FREE_AGENT_COLOR.bg, color: FREE_AGENT_COLOR.text, fontSize: "10px", padding: "1px 6px", borderRadius: "4px", lineHeight: "16px", whiteSpace: "nowrap" },
          "data-testid": "lounge-tag-free"
        }, "Free")
      ),
      React2.createElement("span", {
        className: `text-[10px] ${statusTextColor} block mt-0.5`,
        "data-testid": `lounge-agent-status-${agent.id}`
      }, statusText)
    )
  );
}
function CategoryContextMenu({ position, categoryId, onRename, onDelete, onClose }) {
  const menuRef = useRef(null);
  const isCustomCircle = categoryId.startsWith("circle:") && !isDefaultCircle(categoryId);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);
  const style = useMemo(() => {
    const menuWidth = 160;
    const menuHeight = (isCustomCircle ? 64 : 32) + 8;
    const x = Math.min(position.x, window.innerWidth - menuWidth - 8);
    const y = Math.min(position.y, window.innerHeight - menuHeight - 8);
    return { left: x, top: y };
  }, [position, isCustomCircle]);
  return React2.createElement(
    "div",
    {
      ref: menuRef,
      className: "fixed z-50 min-w-[160px] py-1 rounded-lg shadow-xl border border-surface-1 bg-ctp-mantle",
      style,
      "data-testid": "lounge-category-context-menu"
    },
    React2.createElement(
      "button",
      {
        className: "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ctp-subtext0 hover:bg-surface-1 hover:text-ctp-text transition-colors cursor-pointer",
        onClick: (e) => {
          e.stopPropagation();
          onRename();
          onClose();
        },
        "data-testid": "lounge-ctx-rename"
      },
      React2.createElement(
        "svg",
        {
          width: 12,
          height: 12,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round"
        },
        React2.createElement("path", { d: "M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" })
      ),
      React2.createElement("span", null, "Rename")
    ),
    // Delete option — only for custom circles (not project-derived)
    isCustomCircle && React2.createElement(
      "button",
      {
        className: "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ctp-red hover:bg-surface-1 transition-colors cursor-pointer",
        onClick: (e) => {
          e.stopPropagation();
          onDelete();
          onClose();
        },
        "data-testid": "lounge-ctx-delete"
      },
      React2.createElement(
        "svg",
        {
          width: 12,
          height: 12,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round"
        },
        React2.createElement("polyline", { points: "3 6 5 6 21 6" }),
        React2.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })
      ),
      React2.createElement("span", null, "Delete")
    )
  );
}
function AgentContextMenu({ position, agent, api, categories, currentCategoryId, onMoveTo, onCreateCircle, onClose }) {
  const menuRef = useRef(null);
  const [showSubmenu, setShowSubmenu] = useState(false);
  const moveToRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);
  const style = useMemo(() => {
    const menuWidth = 160;
    const menuHeight = 32 + 8;
    const x = Math.min(position.x, window.innerWidth - menuWidth - 8);
    const y = Math.min(position.y, window.innerHeight - menuHeight - 8);
    return { left: x, top: y };
  }, [position]);
  const submenuStyle = useMemo(() => {
    if (!moveToRef.current) return { left: "100%", top: 0 };
    const rect = moveToRef.current.getBoundingClientRect();
    const submenuWidth = 180;
    const submenuHeight = categories.length * 28 + 8;
    const goLeft = rect.right + submenuWidth > window.innerWidth - 8;
    const x = goLeft ? -submenuWidth : rect.width;
    const y = Math.min(0, window.innerHeight - rect.top - submenuHeight - 8);
    return { left: x, top: y };
  }, [showSubmenu, categories.length]);
  const isRunning = agent.status === "running" || agent.status === "waking" || agent.status === "creating";
  const isSleeping = agent.status === "sleeping";
  const menuItemClass = "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ctp-subtext0 hover:bg-surface-1 hover:text-ctp-text transition-colors cursor-pointer";
  return React2.createElement(
    "div",
    {
      ref: menuRef,
      className: "fixed z-50 min-w-[160px] py-1 rounded-lg shadow-xl border border-surface-1 bg-ctp-mantle",
      style,
      "data-testid": "lounge-agent-context-menu"
    },
    // ── Agent lifecycle actions ──
    isRunning && React2.createElement(
      "button",
      {
        className: menuItemClass,
        onClick: () => {
          api.agents.kill(agent.id).catch(() => {
          });
          onClose();
        },
        "data-testid": "lounge-ctx-stop"
      },
      React2.createElement("svg", {
        width: 12,
        height: 12,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }, React2.createElement("rect", { x: "6", y: "6", width: "12", height: "12", rx: "1" })),
      React2.createElement("span", null, "Stop")
    ),
    isSleeping && React2.createElement(
      "button",
      {
        className: menuItemClass,
        onClick: () => {
          api.agents.resume(agent.id).catch(() => {
          });
          onClose();
        },
        "data-testid": "lounge-ctx-wake"
      },
      React2.createElement("svg", {
        width: 12,
        height: 12,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }, React2.createElement("polygon", { points: "5 3 19 12 5 21 5 3" })),
      React2.createElement("span", null, "Wake")
    ),
    // Pop Out
    React2.createElement(
      "button",
      {
        className: menuItemClass,
        onClick: () => {
          api.navigation.popOutAgent(agent.id).catch(() => {
          });
          onClose();
        },
        "data-testid": "lounge-ctx-popout"
      },
      React2.createElement(
        "svg",
        {
          width: 12,
          height: 12,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round"
        },
        React2.createElement("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
        React2.createElement("polyline", { points: "15 3 21 3 21 9" }),
        React2.createElement("line", { x1: "10", y1: "14", x2: "21", y2: "3" })
      ),
      React2.createElement("span", null, "Pop Out")
    ),
    // Divider between lifecycle and circle actions
    React2.createElement("div", { className: "mx-2 my-1 border-t border-surface-1" }),
    // "Move to" with submenu
    React2.createElement(
      "div",
      { className: "relative" },
      React2.createElement(
        "button",
        {
          ref: moveToRef,
          className: "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ctp-subtext0 hover:bg-surface-1 hover:text-ctp-text transition-colors cursor-pointer",
          onMouseEnter: () => setShowSubmenu(true),
          onMouseLeave: () => setShowSubmenu(false),
          onClick: () => setShowSubmenu((v) => !v),
          "data-testid": "lounge-ctx-move-to"
        },
        // Move icon
        React2.createElement(
          "svg",
          {
            width: 12,
            height: 12,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2,
            strokeLinecap: "round",
            strokeLinejoin: "round"
          },
          React2.createElement("path", { d: "M15 3h6v6" }),
          React2.createElement("path", { d: "M10 14L21 3" }),
          React2.createElement("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" })
        ),
        React2.createElement("span", { className: "flex-1 text-left" }, "Move to"),
        // Chevron right
        React2.createElement(
          "svg",
          {
            width: 10,
            height: 10,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2,
            strokeLinecap: "round",
            strokeLinejoin: "round"
          },
          React2.createElement("polyline", { points: "9 18 15 12 9 6" })
        )
      ),
      // Submenu
      showSubmenu && React2.createElement(
        "div",
        {
          className: "absolute z-50 min-w-[180px] py-1 rounded-lg shadow-xl border border-surface-1 bg-ctp-mantle",
          style: submenuStyle,
          onMouseEnter: () => setShowSubmenu(true),
          onMouseLeave: () => setShowSubmenu(false),
          "data-testid": "lounge-move-to-submenu"
        },
        categories.map(
          (cat) => React2.createElement(
            "button",
            {
              key: cat.id,
              className: `w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer ${cat.id === currentCategoryId ? "text-ctp-overlay0 cursor-default" : "text-ctp-subtext0 hover:bg-surface-1 hover:text-ctp-text"}`,
              disabled: cat.id === currentCategoryId,
              onClick: (e) => {
                e.stopPropagation();
                if (cat.id !== currentCategoryId) {
                  onMoveTo(cat.id);
                  onClose();
                }
              },
              "data-testid": `lounge-move-to-${cat.id}`
            },
            React2.createElement("span", null, cat.label),
            cat.id === currentCategoryId && React2.createElement("span", {
              className: "ml-2 text-[10px] text-ctp-overlay0"
            }, "(current)")
          )
        ),
        // Divider + Create new
        React2.createElement("div", { className: "mx-2 my-1 border-t border-surface-1" }),
        React2.createElement(
          "button",
          {
            className: "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ctp-accent hover:bg-surface-1 transition-colors cursor-pointer",
            onClick: (e) => {
              e.stopPropagation();
              onCreateCircle();
              onClose();
            },
            "data-testid": "lounge-move-to-create-new"
          },
          React2.createElement(
            "svg",
            {
              width: 12,
              height: 12,
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 2,
              strokeLinecap: "round",
              strokeLinejoin: "round"
            },
            React2.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
            React2.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" })
          ),
          React2.createElement("span", null, "Create new")
        )
      )
    )
  );
}
var CHEVRON_RIGHT = React2.createElement("svg", {
  width: 12,
  height: 12,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, React2.createElement("polyline", { points: "9 18 15 12 9 6" }));
var CHEVRON_DOWN = React2.createElement("svg", {
  width: 12,
  height: 12,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, React2.createElement("polyline", { points: "6 9 12 15 18 9" }));
var EMOJI_OPTIONS = [
  "\u2B50",
  "\u{1F4AC}",
  "\u{1F525}",
  "\u{1F680}",
  "\u{1F4A1}",
  "\u{1F3AF}",
  "\u{1F3E0}",
  "\u{1F4C1}",
  "\u{1F6E0}\uFE0F",
  "\u{1F9EA}",
  "\u{1F4CB}",
  "\u{1F3A8}",
  "\u{1F512}",
  "\u{1F310}",
  "\u{1F4CA}",
  "\u{1F916}",
  "\u{1F48E}",
  "\u{1F3B5}",
  "\u{1F4F8}",
  "\u{1F3C6}",
  "\u2764\uFE0F",
  "\u26A1",
  "\u{1F31F}",
  "\u{1F3AE}"
];
function CircleDialog({ mode, onConfirm, onCancel, existingCategories, initialName, initialEmoji, editCategoryId }) {
  const [value, setValue] = useState(initialName ?? "");
  const [emoji, setEmoji] = useState(initialEmoji ?? DEFAULT_CUSTOM_EMOJI);
  const [showEmojis, setShowEmojis] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
    if (mode === "edit") inputRef.current?.select();
  }, [mode]);
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);
  const handleSubmit = useCallback(() => {
    const trimmed2 = value.trim();
    if (trimmed2 && !isReservedCircleName(trimmed2) && !isDuplicateCircleName(trimmed2, existingCategories, editCategoryId)) {
      onConfirm(trimmed2, emoji);
    }
  }, [value, emoji, onConfirm, existingCategories, editCategoryId]);
  const trimmed = value.trim();
  const isReserved = trimmed.length > 0 && isReservedCircleName(trimmed);
  const isDuplicate = trimmed.length > 0 && !isReserved && isDuplicateCircleName(trimmed, existingCategories, editCategoryId);
  const isValid = trimmed.length > 0 && !isReserved && !isDuplicate;
  const isCreate = mode === "create";
  return React2.createElement(
    "div",
    {
      className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50",
      onClick: onCancel
    },
    React2.createElement(
      "div",
      {
        className: "bg-ctp-mantle border border-surface-1 rounded-xl p-4 w-72 shadow-2xl",
        onClick: (e) => e.stopPropagation()
      },
      React2.createElement("h3", {
        className: "text-sm font-semibold text-ctp-text mb-3"
      }, isCreate ? "Create a new circle" : "Rename circle"),
      // Emoji + input row
      React2.createElement(
        "div",
        { className: "flex items-center gap-2" },
        // Emoji button
        React2.createElement("button", {
          onClick: () => setShowEmojis(!showEmojis),
          className: "w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-ctp-base border border-surface-1 text-base hover:bg-surface-0 transition-colors cursor-pointer",
          title: "Choose icon",
          "data-testid": "lounge-circle-dialog-emoji-btn"
        }, emoji),
        React2.createElement("input", {
          ref: inputRef,
          type: "text",
          value,
          placeholder: "Enter circle name",
          className: "flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-ctp-base border border-surface-1 text-xs text-ctp-text placeholder-ctp-overlay0 outline-none focus:ring-1 focus:ring-ctp-accent",
          onChange: (e) => setValue(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter" && isValid) handleSubmit();
            if (e.key === "Escape") onCancel();
          },
          "data-testid": "lounge-circle-dialog-input"
        })
      ),
      // Inline emoji picker
      showEmojis && React2.createElement(
        "div",
        {
          className: "mt-2 p-2 rounded-lg bg-ctp-base border border-surface-1",
          style: { display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "4px" },
          "data-testid": "lounge-circle-dialog-emoji-picker"
        },
        ...EMOJI_OPTIONS.map(
          (e) => React2.createElement("button", {
            key: e,
            onClick: () => {
              setEmoji(e);
              setShowEmojis(false);
            },
            className: `w-7 h-7 flex items-center justify-center rounded text-sm cursor-pointer transition-colors ${e === emoji ? "bg-surface-1 ring-1 ring-ctp-accent" : "hover:bg-surface-0"}`
          }, e)
        )
      ),
      isReserved && React2.createElement("p", {
        className: "text-[10px] text-ctp-red mt-1"
      }, "This name is reserved"),
      isDuplicate && React2.createElement("p", {
        className: "text-[10px] text-ctp-red mt-1"
      }, "A circle with this name already exists"),
      React2.createElement(
        "div",
        {
          className: "flex justify-end gap-2 mt-3"
        },
        React2.createElement("button", {
          onClick: onCancel,
          className: "px-3 py-1 rounded-md text-xs text-ctp-subtext0 hover:text-ctp-text hover:bg-surface-0 transition-colors cursor-pointer",
          "data-testid": "lounge-circle-dialog-cancel"
        }, "Cancel"),
        React2.createElement("button", {
          onClick: handleSubmit,
          disabled: !isValid,
          className: `px-3 py-1 rounded-md text-xs transition-colors cursor-pointer ${isValid ? "bg-ctp-accent text-ctp-base hover:opacity-90" : "bg-surface-1 text-ctp-overlay0 cursor-not-allowed"}`,
          "data-testid": "lounge-circle-dialog-confirm"
        }, isCreate ? "Create" : "Save")
      )
    )
  );
}
function CategorySection({ category, agents, allAgents, allCategories, projects, isCollapsed, selectedAgentId, showTags, orchestrators, api, onToggle, onSelectAgent, onEditCircle, onDelete, onMoveAgent, onPlaceAgent, onCreateCircle, onReorderCategory }) {
  const [contextMenu, setContextMenu] = useState(null);
  const [agentContextMenu, setAgentContextMenu] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const handleContextMenu = useCallback((e) => {
    if (isDefaultCircle(category.id)) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [category.id]);
  const isGeneralCircle = isDefaultCircle(category.id);
  const handleDragStart = useCallback((e) => {
    if (isGeneralCircle) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/x-lounge-category", category.id);
    e.dataTransfer.effectAllowed = "move";
  }, [category.id, isGeneralCircle]);
  const handleDragOver = useCallback((e) => {
    const hasAgent = e.dataTransfer.types.includes("application/x-lounge-agent");
    const hasCategory = e.dataTransfer.types.includes("application/x-lounge-category");
    if (!hasAgent && !hasCategory) return;
    if (hasCategory && isGeneralCircle) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  }, [isGeneralCircle]);
  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const agentId = e.dataTransfer.getData("application/x-lounge-agent");
    if (agentId) {
      onPlaceAgent(agentId, category.id, null, agents.map((a) => a.id));
      return;
    }
    const fromCategoryId = e.dataTransfer.getData("application/x-lounge-category");
    if (fromCategoryId && fromCategoryId !== category.id && !isGeneralCircle) {
      onReorderCategory(fromCategoryId, category.id);
    }
  }, [category.id, onPlaceAgent, onReorderCategory, isGeneralCircle]);
  return React2.createElement(
    "div",
    {
      "data-testid": `lounge-category-${category.id}`,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop
    },
    // Category header
    React2.createElement(
      "button",
      {
        onClick: onToggle,
        onContextMenu: handleContextMenu,
        draggable: !isGeneralCircle,
        onDragStart: handleDragStart,
        className: `w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider hover:bg-surface-0 cursor-pointer transition-colors ${dragOver ? "bg-surface-1 ring-1 ring-ctp-accent ring-inset" : ""}`,
        "data-testid": `lounge-category-toggle-${category.id}`
      },
      isCollapsed ? CHEVRON_RIGHT : CHEVRON_DOWN,
      React2.createElement("span", { className: "text-sm flex-shrink-0" }, category.emoji || "\u{1F4C1}"),
      React2.createElement("span", { className: "flex-1 text-left truncate" }, category.label),
      React2.createElement(
        "span",
        { className: "text-[10px] text-ctp-overlay0 tabular-nums" },
        (() => {
          const active = agents.filter((a) => a.status === "running" || a.status === "waking" || a.status === "creating").length;
          return active > 0 ? `${active}/${agents.length}` : String(agents.length);
        })()
      )
    ),
    // Context menu
    contextMenu && React2.createElement(CategoryContextMenu, {
      position: contextMenu,
      categoryId: category.id,
      onRename: () => {
        setContextMenu(null);
        onEditCircle(category.id);
      },
      onDelete: () => onDelete(category.id),
      onClose: () => setContextMenu(null)
    }),
    // Agent rows (hidden when collapsed)
    !isCollapsed && agents.length > 0 && agents.map((agent, idx) => {
      const displayName = disambiguateAgentName(agent, allAgents, projects);
      const nextAgentId = idx < agents.length - 1 ? agents[idx + 1].id : null;
      return React2.createElement(
        "div",
        {
          key: agent.id,
          onDragOver: (e) => {
            if (!e.dataTransfer.types.includes("application/x-lounge-agent")) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
          },
          onDrop: (e) => {
            const draggedId = e.dataTransfer.getData("application/x-lounge-agent");
            if (!draggedId || draggedId === agent.id) return;
            e.preventDefault();
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const isUpperHalf = e.clientY < rect.top + rect.height / 2;
            const beforeId = isUpperHalf ? agent.id : nextAgentId;
            onPlaceAgent(draggedId, category.id, beforeId, agents.map((a) => a.id));
          }
        },
        React2.createElement(AgentRow, {
          agent,
          displayName,
          isSelected: selectedAgentId === agent.id,
          showTags,
          orchestrators,
          api,
          onClick: () => onSelectAgent(agent.id, agent.projectId),
          onContextMenu: (e) => {
            e.preventDefault();
            setAgentContextMenu({ agentId: agent.id, x: e.clientX, y: e.clientY });
          }
        })
      );
    }),
    // Empty custom circle hint
    !isCollapsed && agents.length === 0 && React2.createElement("div", {
      className: "px-8 py-2 text-[11px] text-ctp-overlay0 italic"
    }, "Move agents here via right-click"),
    // Agent context menu
    agentContextMenu && (() => {
      const ctxAgent = agents.find((a) => a.id === agentContextMenu.agentId) ?? allAgents.find((a) => a.id === agentContextMenu.agentId);
      if (!ctxAgent) return null;
      return React2.createElement(AgentContextMenu, {
        position: agentContextMenu,
        agent: ctxAgent,
        api,
        categories: allCategories,
        currentCategoryId: category.id,
        onMoveTo: (targetCategoryId) => onMoveAgent(agentContextMenu.agentId, targetCategoryId),
        onCreateCircle: () => onCreateCircle(agentContextMenu.agentId),
        onClose: () => setAgentContextMenu(null)
      });
    })()
  );
}
function ResizeDivider({ onResize, onToggleCollapse, collapsed }) {
  const [hovered, setHovered] = useState(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const handleMouseMove = (ev) => {
      const delta = ev.clientX - startXRef.current;
      if (delta !== 0) {
        onResize(delta);
        startXRef.current = ev.clientX;
      }
    };
    const handleMouseUp = () => {
      draggingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [onResize]);
  const handleDoubleClick = useCallback(() => {
    onToggleCollapse();
  }, [onToggleCollapse]);
  const chevron = collapsed ? "\u25B6" : "\u25C0";
  return React2.createElement(
    "div",
    {
      style: {
        width: 5,
        cursor: "col-resize",
        position: "relative",
        flexShrink: 0
      },
      onMouseDown: handleMouseDown,
      onDoubleClick: handleDoubleClick,
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      "data-testid": "lounge-sidebar-edge"
    },
    // Visible center line
    React2.createElement("div", {
      style: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: 1,
        backgroundColor: hovered ? "rgba(137, 180, 250, 0.6)" : "rgba(88, 91, 112, 0.5)",
        transition: "background-color 100ms"
      }
    }),
    // Chevron button — only visible on hover
    hovered && React2.createElement("button", {
      onClick: (e) => {
        e.stopPropagation();
        onToggleCollapse();
      },
      style: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 16,
        height: 16,
        borderRadius: "50%",
        backgroundColor: "#1e1e2e",
        border: "1px solid rgba(88, 91, 112, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "8px",
        color: "#a6adc8",
        cursor: "pointer",
        padding: 0,
        zIndex: 10
      },
      "data-testid": "lounge-collapse-sidebar"
    }, chevron)
  );
}
function EmptyState() {
  return React2.createElement(
    "div",
    {
      className: "flex items-center justify-center h-full text-center px-6"
    },
    React2.createElement(
      "div",
      null,
      React2.createElement("p", { className: "text-ctp-subtext0 text-sm mb-1" }, "No agents yet"),
      React2.createElement("p", { className: "text-ctp-overlay0 text-xs" }, "Agents will appear here grouped by project.")
    )
  );
}
function AgentContent({ api, agentId }) {
  const agents = api.agents.list();
  const agent = agents.find((a) => a.id === agentId);
  const [terminalFocused, setTerminalFocused] = useState(false);
  const prevAgentIdRef = useRef(agentId);
  useEffect(() => {
    const agentChanged = prevAgentIdRef.current !== agentId;
    prevAgentIdRef.current = agentId;
    if (agentChanged) {
      setTerminalFocused(false);
      const raf = requestAnimationFrame(() => setTerminalFocused(true));
      return () => cancelAnimationFrame(raf);
    }
    setTerminalFocused(true);
  }, [agentId]);
  if (!agent) {
    return React2.createElement("div", {
      className: "flex items-center justify-center h-full text-ctp-subtext0 text-sm"
    }, "Agent not found");
  }
  const { AgentTerminal, SleepingAgent } = api.widgets;
  if (agent.status === "sleeping" || agent.status === "error") {
    return React2.createElement(SleepingAgent, { agentId: agent.id });
  }
  return React2.createElement(AgentTerminal, { agentId: agent.id, focused: terminalFocused });
}
function NoSelection() {
  return React2.createElement(
    "div",
    {
      className: "flex items-center justify-center h-full text-center px-6",
      "data-testid": "lounge-no-selection"
    },
    React2.createElement(
      "div",
      null,
      React2.createElement("p", { className: "text-ctp-subtext0 text-sm mb-1" }, "Select an agent"),
      React2.createElement("p", { className: "text-ctp-overlay0 text-xs" }, "Click an agent from the list to view it here.")
    )
  );
}
function MainPanel({ api }) {
  const categories = useLoungeStore((s) => s.categories);
  const collapsed = useLoungeStore((s) => s.collapsed);
  const selectedAgentId = useLoungeStore((s) => s.selectedAgentId);
  const deriveCategories = useLoungeStore((s) => s.deriveCategories);
  const toggleCollapsed = useLoungeStore((s) => s.toggleCollapsed);
  const selectAgent = useLoungeStore((s) => s.selectAgent);
  const renameCategory = useLoungeStore((s) => s.renameCategory);
  const moveAgent = useLoungeStore((s) => s.moveAgent);
  const agentCategoryOverrides = useLoungeStore((s) => s.agentCategoryOverrides);
  const addCircle = useLoungeStore((s) => s.addCircle);
  const deleteCircle = useLoungeStore((s) => s.deleteCircle);
  const reorderCategory = useLoungeStore((s) => s.reorderCategory);
  const setCategoryEmoji = useLoungeStore((s) => s.setCategoryEmoji);
  const placeAgent = useLoungeStore((s) => s.placeAgent);
  const agentOrder = useLoungeStore((s) => s.agentOrder);
  const loadPersistedState = useLoungeStore((s) => s.loadPersistedState);
  const showTags = useLoungeStore((s) => s.showTags);
  const toggleShowTags = useLoungeStore((s) => s.toggleShowTags);
  const sidebarCollapsed = useLoungeStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useLoungeStore((s) => s.toggleSidebar);
  const sidebarWidth = useLoungeStore((s) => s.sidebarWidth);
  const setSidebarWidth = useLoungeStore((s) => s.setSidebarWidth);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api.storage.global.read(STORAGE_KEY).then((data) => {
      if (data) loadPersistedState(data);
      else useLoungeStore.setState({ hydrated: true });
      setLoaded(true);
    }).catch(() => {
      useLoungeStore.setState({ hydrated: true });
      setLoaded(true);
    });
  }, [api, loadPersistedState]);
  const renamedLabels = useLoungeStore((s) => s.renamedLabels);
  const customCircles = useLoungeStore((s) => s.customCircles);
  const nextCircleId = useLoungeStore((s) => s.nextCircleId);
  const categoryOrder = useLoungeStore((s) => s.categoryOrder);
  const categoryEmojis = useLoungeStore((s) => s.categoryEmojis);
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const state = useLoungeStore.getState();
      api.storage.global.write(STORAGE_KEY, getPersistedState(state)).catch(() => {
      });
    }, 500);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        const state = useLoungeStore.getState();
        api.storage.global.write(STORAGE_KEY, getPersistedState(state)).catch(() => {
        });
      }
    };
  }, [api, loaded, renamedLabels, agentCategoryOverrides, customCircles, nextCircleId, categoryOrder, categoryEmojis, agentOrder, collapsed, showTags, sidebarCollapsed, sidebarWidth]);
  const [agentTick, setAgentTick] = useState(0);
  useEffect(() => {
    const sub = api.agents.onAnyChange(() => setAgentTick((n) => n + 1));
    return () => sub.dispose();
  }, [api]);
  const projects = useMemo(() => api.projects.list(), [api, agentTick]);
  useEffect(() => {
    if (!loaded) return;
    deriveCategories(projects);
  }, [projects, deriveCategories, loaded]);
  const agents = useMemo(() => api.agents.list(), [api, agentTick]);
  const orchestrators = useMemo(() => api.agents.listOrchestrators(), [api]);
  const grouped = useMemo(
    () => groupAgentsByCategory(agents, categories, agentCategoryOverrides),
    [agents, categories, agentCategoryOverrides]
  );
  const handleSelectAgent = useCallback((agentId, projectId) => {
    selectAgent(agentId, projectId);
  }, [selectAgent]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [pendingMoveAgentId, setPendingMoveAgentId] = useState(null);
  const [editingCircle, setEditingCircle] = useState(null);
  const handleCreateCircle = useCallback((agentId) => {
    setPendingMoveAgentId(agentId ?? null);
    setShowCreateDialog(true);
  }, []);
  const handleConfirmCreate = useCallback((name, emoji) => {
    const newId = addCircle(name);
    if (newId) {
      if (emoji && emoji !== DEFAULT_CUSTOM_EMOJI) {
        setCategoryEmoji(newId, emoji);
      }
      if (pendingMoveAgentId) {
        moveAgent(pendingMoveAgentId, newId);
      }
    }
    setShowCreateDialog(false);
    setPendingMoveAgentId(null);
  }, [addCircle, moveAgent, setCategoryEmoji, pendingMoveAgentId]);
  const handleEditCircle = useCallback((categoryId) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (cat) {
      setEditingCircle({ id: cat.id, label: cat.label, emoji: cat.emoji });
    }
  }, [categories]);
  const handleConfirmEdit = useCallback((name, emoji) => {
    if (editingCircle) {
      if (name !== editingCircle.label) {
        renameCategory(editingCircle.id, name);
      }
      if (emoji) {
        setCategoryEmoji(editingCircle.id, emoji);
      }
    }
    setEditingCircle(null);
  }, [editingCircle, renameCategory, setCategoryEmoji]);
  useEffect(() => {
    if (selectedAgentId && !agents.find((a) => a.id === selectedAgentId)) {
      selectAgent(null);
    }
  }, [agents, selectedAgentId, selectAgent]);
  useEffect(() => {
    if (!loaded || agents.length === 0) return;
    for (const cat of categories) {
      if (cat.projectId || isDefaultCircle(cat.id)) continue;
      const catAgents = grouped.get(cat.id) ?? [];
      if (catAgents.length === 0) {
        deleteCircle(cat.id);
      }
    }
  }, [grouped, categories, deleteCircle, loaded, agents.length]);
  const hasAgents = agents.length > 0;
  const visibleCategories = categories.filter((cat) => {
    if (cat.projectId) {
      const catAgents = grouped.get(cat.id) ?? [];
      return catAgents.length > 0;
    }
    return true;
  });
  return React2.createElement(
    "div",
    {
      className: "flex h-full w-full bg-ctp-base",
      "data-testid": "lounge-main-panel"
    },
    // Left sidebar — agent list (collapsible)
    React2.createElement(
      "div",
      {
        style: {
          width: sidebarCollapsed ? "0px" : `${sidebarWidth}px`,
          minWidth: 0,
          transition: "width 200ms ease-in-out",
          overflow: "hidden",
          flexShrink: 0
        },
        className: "flex flex-col bg-ctp-mantle h-full min-h-0",
        "data-testid": "lounge-sidebar"
      },
      // Header
      React2.createElement(
        "div",
        {
          className: "px-3 py-3 border-b border-surface-0 flex items-center gap-2"
        },
        React2.createElement("h2", {
          className: "text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider flex-1"
        }, "Lounge"),
        // Tags toggle button
        React2.createElement(
          "button",
          {
            onClick: toggleShowTags,
            title: showTags ? "Hide tags" : "Show tags",
            className: "w-5 h-5 flex items-center justify-center rounded text-ctp-overlay0 hover:text-ctp-text hover:bg-surface-0 cursor-pointer transition-colors",
            "data-testid": "lounge-toggle-tags"
          },
          React2.createElement(
            "svg",
            {
              width: 12,
              height: 12,
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 2,
              strokeLinecap: "round",
              strokeLinejoin: "round",
              style: { opacity: showTags ? 1 : 0.4 }
            },
            React2.createElement("path", { d: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" }),
            React2.createElement("line", { x1: "7", y1: "7", x2: "7.01", y2: "7" })
          )
        )
      ),
      // Scrollable category list
      React2.createElement(
        "div",
        {
          className: "flex-1 overflow-y-auto py-1",
          "data-testid": "lounge-category-list"
        },
        hasAgents || categories.some((c) => !c.projectId) ? visibleCategories.map((cat) => {
          const catAgents = sortAgentsByOrder(grouped.get(cat.id) ?? [], agentOrder[cat.id]);
          return React2.createElement(CategorySection, {
            key: cat.id,
            category: cat,
            agents: catAgents,
            allAgents: agents,
            allCategories: categories,
            projects,
            isCollapsed: collapsed.has(cat.id),
            selectedAgentId,
            showTags,
            orchestrators,
            api,
            onToggle: () => toggleCollapsed(cat.id),
            onSelectAgent: handleSelectAgent,
            onEditCircle: handleEditCircle,
            onDelete: deleteCircle,
            onMoveAgent: moveAgent,
            onPlaceAgent: placeAgent,
            onCreateCircle: handleCreateCircle,
            onReorderCategory: reorderCategory
          });
        }) : React2.createElement(EmptyState)
      )
    ),
    // Sidebar resize divider (matches host ResizeDivider pattern)
    React2.createElement(ResizeDivider, {
      collapsed: sidebarCollapsed,
      onToggleCollapse: toggleSidebar,
      onResize: (delta) => {
        const current = useLoungeStore.getState().sidebarWidth;
        setSidebarWidth(current + delta);
      }
    }),
    // Right content — selected agent view
    React2.createElement(
      "div",
      {
        className: "flex-1 min-w-0 h-full"
      },
      selectedAgentId ? React2.createElement(AgentContent, { api, agentId: selectedAgentId }) : React2.createElement(NoSelection)
    ),
    // Circle dialog (create or edit mode)
    showCreateDialog && React2.createElement(CircleDialog, {
      mode: "create",
      onConfirm: handleConfirmCreate,
      onCancel: () => setShowCreateDialog(false),
      existingCategories: categories
    }),
    editingCircle && React2.createElement(CircleDialog, {
      mode: "edit",
      onConfirm: handleConfirmEdit,
      onCancel: () => setEditingCircle(null),
      existingCategories: categories,
      initialName: editingCircle.label,
      initialEmoji: editingCircle.emoji,
      editCategoryId: editingCircle.id
    })
  );
}
export {
  MainPanel,
  activate,
  deactivate
};
