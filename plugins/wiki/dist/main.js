// src/state.ts
var wikiState = {
  selectedPath: null,
  isDirty: false,
  viewMode: "view",
  refreshCount: 0,
  listeners: /* @__PURE__ */ new Set(),
  // Navigation history
  history: [],
  historyIndex: -1,
  _isNavigatingHistory: false,
  setSelectedPath(path) {
    if (path && !this._isNavigatingHistory) {
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(path);
      this.historyIndex = this.history.length - 1;
    }
    this._isNavigatingHistory = false;
    this.selectedPath = path;
    this.notify();
  },
  goBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this._isNavigatingHistory = true;
      this.setSelectedPath(this.history[this.historyIndex]);
    }
  },
  canGoBack() {
    return this.historyIndex > 0;
  },
  setDirty(dirty) {
    this.isDirty = dirty;
    this.notify();
  },
  setViewMode(mode) {
    this.viewMode = mode;
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
  reset() {
    this.selectedPath = null;
    this.isDirty = false;
    this.viewMode = "view";
    this.refreshCount = 0;
    this.history = [];
    this.historyIndex = -1;
    this._isNavigatingHistory = false;
    this.listeners.clear();
  }
};

// src/styles.ts
var font = {
  family: "var(--font-family, system-ui, -apple-system, sans-serif)",
  mono: "var(--font-mono, ui-monospace, monospace)"
};
var color = {
  text: "var(--text-primary, #e4e4e7)",
  textSecondary: "var(--text-secondary, #a1a1aa)",
  textTertiary: "var(--text-tertiary, #71717a)",
  textError: "var(--text-error, #f87171)",
  textSuccess: "#22c55e",
  textAccent: "var(--text-accent, #8b5cf6)",
  textWarning: "var(--text-warning, #eab308)",
  bg: "var(--bg-primary, #18181b)",
  bgSecondary: "var(--bg-secondary, #27272a)",
  bgTertiary: "var(--bg-tertiary, #333338)",
  bgActive: "var(--bg-active, #3f3f46)",
  bgError: "var(--bg-error, #2a1515)",
  border: "var(--border-primary, #3f3f46)",
  borderSecondary: "var(--border-secondary, #52525b)",
  accent: "var(--text-accent, #8b5cf6)",
  accentBg: "var(--bg-accent, rgba(139, 92, 246, 0.15))",
  // File icon colors by extension
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  purple: "#a855f7",
  cyan: "#06b6d4"
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
  color: "#fff",
  fontWeight: 500
};
var dangerButton = {
  ...baseButton,
  color: color.textError,
  borderColor: "rgba(248, 113, 113, 0.3)"
};
var overlay = {
  position: "absolute",
  inset: 0,
  background: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50
};
var dialog = {
  background: color.bg,
  border: `1px solid ${color.border}`,
  borderRadius: 12,
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  width: "100%",
  maxWidth: 480,
  margin: "0 16px",
  padding: 16
};

// src/file-icons.ts
var EXT_COLORS = {
  // Markdown
  md: "#3b82f6",
  mdx: "#3b82f6",
  // JavaScript/TypeScript
  js: "#eab308",
  jsx: "#eab308",
  ts: "#3b82f6",
  tsx: "#3b82f6",
  // Config/data
  json: "#22c55e",
  yaml: "#22c55e",
  yml: "#22c55e",
  toml: "#22c55e",
  xml: "#f97316",
  // Styles
  css: "#a855f7",
  scss: "#a855f7",
  less: "#a855f7",
  // Shell
  sh: "#22c55e",
  bash: "#22c55e",
  zsh: "#22c55e",
  // Python
  py: "#3b82f6",
  // Rust
  rs: "#f97316",
  // Go
  go: "#06b6d4",
  // HTML
  html: "#f97316",
  htm: "#f97316",
  // Images
  png: "#a855f7",
  jpg: "#a855f7",
  jpeg: "#a855f7",
  gif: "#a855f7",
  svg: "#a855f7",
  // Text
  txt: "#a1a1aa",
  log: "#a1a1aa"
};
var DEFAULT_COLOR = "#a1a1aa";
function getFileIconColor(ext) {
  return EXT_COLORS[ext.toLowerCase()] || DEFAULT_COLOR;
}

// src/WikiTree.tsx
var React = globalThis.React;
var { useState, useEffect, useCallback, useRef } = React;
var RefreshIcon = React.createElement(
  "svg",
  {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  },
  React.createElement("polyline", { points: "23 4 23 10 17 10" }),
  React.createElement("path", { d: "M20.49 15a9 9 0 1 1-2.12-9.36L23 10" })
);
var FolderIcon = React.createElement("svg", {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color.blue,
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  style: { flexShrink: 0 }
}, React.createElement("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }));
var FolderOpenIcon = React.createElement(
  "svg",
  {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color.blue,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { flexShrink: 0 }
  },
  React.createElement("path", { d: "M5 19a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2 3h9a2 2 0 0 1 2 2v1" }),
  React.createElement("path", { d: "M22 10H10a2 2 0 0 0-2 2l-1 7h15l1-7a2 2 0 0 0-2-2z" })
);
var FileIcon = (iconColor) => React.createElement(
  "svg",
  {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: iconColor,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { flexShrink: 0 }
  },
  React.createElement("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
  React.createElement("polyline", { points: "14 2 14 8 20 8" })
);
var ChevronRight = React.createElement("svg", {
  width: 12,
  height: 12,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  style: { flexShrink: 0 }
}, React.createElement("polyline", { points: "9 18 15 12 9 6" }));
var ChevronDown = React.createElement("svg", {
  width: 12,
  height: 12,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  style: { flexShrink: 0 }
}, React.createElement("polyline", { points: "6 9 12 15 18 9" }));
var AgentIcon = React.createElement(
  "svg",
  {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  },
  React.createElement("circle", { cx: 12, cy: 12, r: 10 }),
  React.createElement("path", { d: "M12 16v-4" }),
  React.createElement("path", { d: "M12 8h.01" })
);
function getExtension(name) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}
function prettifyName(name, wikiStyle = "github") {
  let base = name.replace(/\.md$/i, "");
  if (wikiStyle === "ado") {
    base = base.replace(/%2D/gi, "\0").replace(/-/g, " ").replace(/\x00/g, "-");
  } else {
    base = base.replace(/[-_]/g, " ");
  }
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}
function parseOrderFile(content) {
  return content.split("\n").map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith("#"));
}
function sortByOrder(nodes, order) {
  if (order.length === 0) return nodes;
  const posMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < order.length; i++) {
    posMap.set(order[i].toLowerCase(), i);
  }
  const getKey = (node) => {
    return node.name.replace(/\.md$/i, "").toLowerCase();
  };
  return [...nodes].sort((a, b) => {
    const posA = posMap.get(getKey(a));
    const posB = posMap.get(getKey(b));
    if (posA !== void 0 && posB !== void 0) return posA - posB;
    if (posA !== void 0) return -1;
    if (posB !== void 0) return 1;
    return a.name.localeCompare(b.name);
  });
}
async function applyAdoOrdering(scoped, dirPath, nodes) {
  const orderPath = dirPath === "." ? ".order" : `${dirPath}/.order`;
  try {
    const content = await scoped.readFile(orderPath);
    const order = parseOrderFile(content);
    return sortByOrder(nodes, order);
  } catch {
    return nodes;
  }
}
function filterMarkdownTree(nodes, wikiStyle = "github") {
  const folderNames = wikiStyle === "ado" ? new Set(nodes.filter((n) => n.isDirectory).map((n) => n.name.toLowerCase())) : null;
  const siblingPageMap = /* @__PURE__ */ new Map();
  if (wikiStyle === "ado") {
    for (const node of nodes) {
      if (!node.isDirectory && getExtension(node.name) === "md") {
        const baseName = node.name.replace(/\.md$/i, "").toLowerCase();
        if (folderNames && folderNames.has(baseName)) {
          siblingPageMap.set(baseName, node.path);
        }
      }
    }
  }
  const result = [];
  for (const node of nodes) {
    if (wikiStyle === "ado" && node.name === ".order") continue;
    if (node.isDirectory) {
      const indexPath = siblingPageMap.get(node.name.toLowerCase());
      if (!node.children || node.children.length === 0) {
        result.push(indexPath ? { ...node, indexPath } : node);
      } else {
        const filteredChildren = filterMarkdownTree(node.children, wikiStyle);
        if (filteredChildren.length > 0) {
          result.push(indexPath ? { ...node, children: filteredChildren, indexPath } : { ...node, children: filteredChildren });
        }
      }
    } else if (getExtension(node.name) === "md") {
      if (folderNames && folderNames.has(node.name.replace(/\.md$/i, "").toLowerCase())) {
        continue;
      }
      result.push(node);
    }
  }
  return result;
}
function ContextMenu({ x, y, node, onClose, onAction }) {
  const menuRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);
  const items = [
    { label: "New File", action: "newFile" },
    { label: "New Folder", action: "newFolder" },
    { label: "Rename", action: "rename" },
    { label: "Copy", action: "copy" },
    { label: "Delete", action: "delete" }
  ];
  return React.createElement(
    "div",
    {
      ref: menuRef,
      style: {
        position: "fixed",
        zIndex: 50,
        background: color.bgSecondary,
        border: `1px solid ${color.border}`,
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        padding: "4px 0",
        minWidth: 140,
        left: x,
        top: y
      }
    },
    ...items.map(
      (item) => React.createElement("button", {
        key: item.action,
        style: {
          width: "100%",
          textAlign: "left",
          padding: "4px 12px",
          fontSize: 12,
          color: item.action === "delete" ? color.textError : color.text,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: font.family
        },
        onClick: () => {
          onAction(item.action);
          onClose();
        }
      }, item.label)
    )
  );
}
function TreeNode({ node, depth, expanded, onToggle, onSelect, selected, focused, viewMode, wikiStyle, onContextMenu }) {
  const isExpanded = expanded.has(node.path);
  const hasIndexPage = !!node.indexPath;
  const indexPath = node.indexPath;
  const isSelected = selected === node.path || hasIndexPage && selected === indexPath;
  const isFocused = focused === node.path;
  const ext = getExtension(node.name);
  const bgColor = isSelected ? color.bgActive : isFocused ? color.bgTertiary : "transparent";
  const handleClick = () => {
    if (node.isDirectory) {
      if (hasIndexPage) {
        onSelect(indexPath);
      } else {
        onToggle(node.path);
      }
    } else {
      onSelect(node.path);
    }
  };
  const handleChevronClick = (e) => {
    if (node.isDirectory && hasIndexPage) {
      e.stopPropagation();
      onToggle(node.path);
    }
  };
  const icon = node.isDirectory ? isExpanded ? FolderOpenIcon : FolderIcon : FileIcon(getFileIconColor(ext));
  const chevron = node.isDirectory ? isExpanded ? ChevronDown : ChevronRight : React.createElement("span", { style: { width: 12, display: "inline-block" } });
  const displayName = viewMode === "view" ? prettifyName(node.name, wikiStyle) : node.name;
  const elements = [
    React.createElement(
      "div",
      {
        key: node.path,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingLeft: 8 + depth * 12,
          paddingRight: 8,
          paddingTop: 2,
          paddingBottom: 2,
          cursor: "pointer",
          userSelect: "none",
          fontSize: 12,
          background: bgColor,
          transition: "background 0.15s",
          fontFamily: font.family
        },
        onClick: handleClick,
        onContextMenu: viewMode === "edit" ? (e) => onContextMenu(e, node) : void 0,
        "data-path": node.path
      },
      React.createElement("span", {
        onClick: handleChevronClick,
        style: { display: "flex", alignItems: "center" }
      }, chevron),
      icon,
      React.createElement("span", {
        style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: color.text }
      }, displayName)
    )
  ];
  if (node.isDirectory && isExpanded && node.children) {
    for (const child of node.children) {
      elements.push(
        React.createElement(TreeNode, {
          key: child.path,
          node: child,
          depth: depth + 1,
          expanded,
          onToggle,
          onSelect,
          selected,
          focused,
          viewMode,
          wikiStyle,
          onContextMenu
        })
      );
    }
  }
  return React.createElement(React.Fragment, null, ...elements);
}
function WikiTree({ api }) {
  const [tree, setTree] = useState([]);
  const [expanded, setExpanded] = useState(/* @__PURE__ */ new Set());
  const [focusedPath, setFocusedPath] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [viewMode, setViewMode] = useState(wikiState.viewMode);
  const [contextMenu, setContextMenu] = useState(null);
  const [configError, setConfigError] = useState(null);
  const containerRef = useRef(null);
  const wikiFilesRef = useRef(null);
  const showHidden = api.settings.get("showHiddenFiles") || false;
  const wikiStyle = api.settings.get("wikiStyle") || "github";
  const getScopedFiles = useCallback(() => {
    try {
      const scoped = api.files.forRoot("wiki");
      wikiFilesRef.current = scoped;
      setConfigError(null);
      return scoped;
    } catch {
      setConfigError("Wiki path not configured. Open Settings to set the wiki directory path.");
      wikiFilesRef.current = null;
      return null;
    }
  }, [api]);
  const loadTree = useCallback(async () => {
    const scoped = getScopedFiles();
    if (!scoped) {
      setTree([]);
      return;
    }
    try {
      let nodes = await scoped.readTree(".", { includeHidden: showHidden, depth: 1 });
      if (wikiStyle === "ado") {
        nodes = await applyAdoOrdering(scoped, ".", nodes);
      }
      setTree(nodes);
    } catch {
      setTree([]);
    }
  }, [getScopedFiles, showHidden, wikiStyle]);
  useEffect(() => {
    loadTree();
  }, [loadTree]);
  const lastRefreshRef = useRef(wikiState.refreshCount);
  useEffect(() => {
    return wikiState.subscribe(() => {
      setSelectedPath(wikiState.selectedPath);
      setViewMode(wikiState.viewMode);
      if (wikiState.refreshCount !== lastRefreshRef.current) {
        lastRefreshRef.current = wikiState.refreshCount;
        loadTree();
      }
    });
  }, [loadTree]);
  useEffect(() => {
    const disposable = api.settings.onChange((key) => {
      if (key === "wikiPath" || key === "showHiddenFiles" || key === "wikiStyle") {
        loadTree();
      }
    });
    return () => disposable.dispose();
  }, [api, loadTree]);
  const getVisibleNodes = useCallback(() => {
    const displayTree2 = viewMode === "view" ? filterMarkdownTree(tree, wikiStyle) : tree;
    const result = [];
    const collect = (nodes) => {
      for (const node of nodes) {
        result.push(node);
        if (node.isDirectory && expanded.has(node.path) && node.children) {
          collect(viewMode === "view" ? filterMarkdownTree(node.children, wikiStyle) : node.children);
        }
      }
    };
    collect(displayTree2);
    return result;
  }, [tree, expanded, viewMode, wikiStyle]);
  const selectFile = useCallback((path) => {
    setSelectedPath(path);
    wikiState.setSelectedPath(path);
  }, []);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const toggleExpand = useCallback(async (dirPath) => {
    const wasExpanded = expandedRef.current.has(dirPath);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
    if (wasExpanded) return;
    const scoped = wikiFilesRef.current;
    if (!scoped) return;
    try {
      let nodes = await scoped.readTree(dirPath, { includeHidden: showHidden, depth: 1 });
      if (wikiStyle === "ado") {
        nodes = await applyAdoOrdering(scoped, dirPath, nodes);
      }
      setTree((prevTree) => {
        const updateNode = (items) => {
          return items.map((n) => {
            if (n.path === dirPath) {
              return { ...n, children: nodes };
            }
            if (n.isDirectory && n.children) {
              return { ...n, children: updateNode(n.children) };
            }
            return n;
          });
        };
        return updateNode(prevTree);
      });
      if (wikiStyle === "ado") {
        const dirName = dirPath.split("/").pop() || dirPath;
        const indexPage = nodes.find(
          (c) => !c.isDirectory && c.name.replace(/\.md$/i, "").toLowerCase() === dirName.toLowerCase()
        );
        if (indexPage) {
          selectFile(indexPage.path);
        } else {
          const siblingPath = dirPath + ".md";
          try {
            await scoped.stat(siblingPath);
            selectFile(siblingPath);
          } catch {
          }
        }
      }
    } catch {
    }
  }, [showHidden, wikiStyle, selectFile]);
  const handleToggleMode = useCallback((mode) => {
    setViewMode(mode);
    wikiState.setViewMode(mode);
  }, []);
  const handleRunAgent = useCallback(async () => {
    const wikiPath = api.settings.get("wikiPath") || "";
    const mission = await api.ui.showInput("Mission");
    if (!mission) return;
    try {
      await api.agents.runQuick(mission, {
        systemPrompt: `You are working in the wiki directory at ${wikiPath}. This is a markdown wiki. Help the user with their request about the wiki content.`
      });
      api.ui.showNotice("Agent launched in wiki context");
    } catch {
      api.ui.showError("Failed to launch agent");
    }
  }, [api]);
  const handleContextAction = useCallback(async (action, node) => {
    const scoped = wikiFilesRef.current;
    if (!scoped) return;
    const parentDir = node.isDirectory ? node.path : node.path.replace(/\/[^/]+$/, "") || ".";
    switch (action) {
      case "newFile": {
        const name = await api.ui.showInput("File name");
        if (!name) return;
        const newPath = parentDir === "." ? name : `${node.isDirectory ? node.path : parentDir}/${name}`;
        await scoped.writeFile(newPath, "");
        break;
      }
      case "newFolder": {
        const name = await api.ui.showInput("Folder name");
        if (!name) return;
        const newPath = parentDir === "." ? name : `${node.isDirectory ? node.path : parentDir}/${name}`;
        await scoped.mkdir(newPath);
        break;
      }
      case "rename": {
        const newName = await api.ui.showInput("New name", node.name);
        if (!newName || newName === node.name) return;
        const newPath = node.path.replace(/[^/]+$/, newName);
        await scoped.rename(node.path, newPath);
        break;
      }
      case "copy": {
        const copyName = await api.ui.showInput("Copy name", node.name + " copy");
        if (!copyName) return;
        const destPath = node.path.replace(/[^/]+$/, copyName);
        await scoped.copy(node.path, destPath);
        break;
      }
      case "delete": {
        const confirmed = await api.ui.showConfirm(`Delete "${node.name}"? This cannot be undone.`);
        if (!confirmed) return;
        await scoped.delete(node.path);
        break;
      }
    }
    loadTree();
  }, [api, loadTree]);
  const handleKeyDown = useCallback((e) => {
    const visible = getVisibleNodes();
    if (visible.length === 0) return;
    const currentIndex = visible.findIndex((n) => n.path === focusedPath);
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextIndex = currentIndex < visible.length - 1 ? currentIndex + 1 : 0;
        setFocusedPath(visible[nextIndex].path);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : visible.length - 1;
        setFocusedPath(visible[prevIndex].path);
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (focusedPath) {
          const node = visible.find((n) => n.path === focusedPath);
          if (node) {
            if (node.isDirectory) {
              if (node.indexPath) {
                selectFile(node.indexPath);
                if (!expandedRef.current.has(node.path)) {
                  toggleExpand(node.path);
                }
              } else {
                toggleExpand(node.path);
              }
            } else {
              selectFile(node.path);
            }
          }
        }
        break;
      }
      case "Delete":
      case "Backspace": {
        if (viewMode !== "edit") break;
        e.preventDefault();
        if (focusedPath) {
          const node = visible.find((n) => n.path === focusedPath);
          if (node) {
            handleContextAction("delete", node);
          }
        }
        break;
      }
    }
  }, [focusedPath, getVisibleNodes, toggleExpand, selectFile, viewMode, handleContextAction]);
  const handleContextMenu = useCallback((e, node) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);
  const displayTree = viewMode === "view" ? filterMarkdownTree(tree, wikiStyle) : tree;
  const toggleBtnStyle = (active) => ({
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 10,
    background: active ? color.bgActive : "transparent",
    color: active ? color.text : color.textSecondary,
    border: "none",
    cursor: "pointer",
    fontFamily: font.family
  });
  if (configError) {
    return React.createElement(
      "div",
      {
        style: { display: "flex", flexDirection: "column", height: "100%", background: color.bgSecondary, color: color.text, fontFamily: font.family }
      },
      React.createElement(
        "div",
        {
          style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", borderBottom: `1px solid ${color.border}`, flexShrink: 0 }
        },
        React.createElement("span", { style: { fontSize: 12, fontWeight: 500 } }, "Wiki")
      ),
      React.createElement(
        "div",
        {
          style: { padding: "16px 12px", fontSize: 12, color: color.textSecondary, textAlign: "center" }
        },
        React.createElement("div", { style: { marginBottom: 8, color: color.textWarning } }, "Wiki not configured"),
        React.createElement("div", null, configError)
      )
    );
  }
  return React.createElement(
    "div",
    {
      ref: containerRef,
      style: { display: "flex", flexDirection: "column", height: "100%", background: color.bgSecondary, color: color.text, userSelect: "none", fontFamily: font.family },
      tabIndex: 0,
      onKeyDown: handleKeyDown
    },
    // Header
    React.createElement(
      "div",
      {
        style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", borderBottom: `1px solid ${color.border}`, flexShrink: 0 }
      },
      React.createElement("span", { style: { fontSize: 12, fontWeight: 500 } }, "Wiki"),
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 4 } },
        React.createElement("button", {
          style: { padding: 2, color: color.textSecondary, background: "transparent", border: "none", borderRadius: 4, cursor: "pointer" },
          onClick: () => loadTree(),
          title: "Refresh"
        }, RefreshIcon)
      )
    ),
    // View/Edit toggle
    React.createElement(
      "div",
      {
        style: { padding: "6px 12px", borderBottom: `1px solid ${color.border}`, display: "flex", alignItems: "center", gap: 8 }
      },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", background: color.bgTertiary, borderRadius: 4 } },
        React.createElement("button", {
          style: toggleBtnStyle(viewMode === "view"),
          onClick: () => handleToggleMode("view")
        }, "View"),
        React.createElement("button", {
          style: toggleBtnStyle(viewMode === "edit"),
          onClick: () => handleToggleMode("edit")
        }, "Edit")
      ),
      React.createElement("button", {
        style: { marginLeft: "auto", padding: "2px 8px", fontSize: 10, color: color.accent, background: "transparent", border: "none", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: font.family },
        onClick: handleRunAgent,
        title: "Run Agent in Wiki"
      }, AgentIcon, " Agent")
    ),
    // Tree
    React.createElement(
      "div",
      { style: { flex: 1, overflow: "auto", paddingTop: 4, paddingBottom: 4 } },
      displayTree.length === 0 ? React.createElement(
        "div",
        { style: { padding: "16px 12px", fontSize: 12, color: color.textSecondary, textAlign: "center" } },
        viewMode === "view" ? "No markdown files found" : "No files found"
      ) : displayTree.map(
        (node) => React.createElement(TreeNode, {
          key: node.path,
          node,
          depth: 0,
          expanded,
          onToggle: toggleExpand,
          onSelect: selectFile,
          selected: selectedPath,
          focused: focusedPath,
          viewMode,
          wikiStyle,
          onContextMenu: handleContextMenu
        })
      )
    ),
    // Context menu (edit mode only)
    contextMenu && viewMode === "edit" ? React.createElement(ContextMenu, {
      x: contextMenu.x,
      y: contextMenu.y,
      node: contextMenu.node,
      onClose: () => setContextMenu(null),
      onAction: (action) => handleContextAction(action, contextMenu.node)
    }) : null
  );
}

// src/WikiMarkdownPreview.tsx
import { Marked } from "marked";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import java from "highlight.js/lib/languages/java";
import kotlin from "highlight.js/lib/languages/kotlin";
import swift from "highlight.js/lib/languages/swift";
import csharp from "highlight.js/lib/languages/csharp";
import markdown from "highlight.js/lib/languages/markdown";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import cpp from "highlight.js/lib/languages/cpp";
var React2 = globalThis.React;
var { useMemo, useEffect: useEffect2, useRef: useRef2, useCallback: useCallback2 } = React2;
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("java", java);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("bash", shell);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("cpp", cpp);
var WIKI_LINK_CSS = `
.wiki-link {
  color: ${color.accent};
  text-decoration: underline;
  text-decoration-style: dashed;
  cursor: pointer;
}
.wiki-link:hover {
  opacity: 0.8;
}
.wiki-link-broken {
  color: ${color.textError};
  opacity: 0.6;
  cursor: default;
}
.wiki-link-broken:hover {
  opacity: 0.6;
}
`;
var wikiStyleInjected = false;
function injectWikiLinkStyle() {
  if (wikiStyleInjected) return;
  const style = document.createElement("style");
  style.textContent = WIKI_LINK_CSS;
  document.head.appendChild(style);
  wikiStyleInjected = true;
}
function createWikiLinkExtension(pageNames) {
  const pageSet = new Set(
    pageNames.map((n) => n.replace(/\.md$/i, "").toLowerCase())
  );
  return {
    name: "wikiLink",
    level: "inline",
    start(src) {
      return src.indexOf("[[");
    },
    tokenizer(src) {
      const match = /^\[\[([^\]]+)\]\]/.exec(src);
      if (match) {
        return {
          type: "wikiLink",
          raw: match[0],
          pageName: match[1].trim()
        };
      }
      return void 0;
    },
    renderer(token) {
      const normalised = token.pageName.toLowerCase();
      const exists = pageSet.has(normalised);
      const cls = exists ? "wiki-link" : "wiki-link wiki-link-broken";
      return `<a class="${cls}" data-wiki-link="${token.pageName}">${token.pageName}</a>`;
    }
  };
}
function resolveAdoLink(href) {
  if (/^https?:\/\//i.test(href) || href.startsWith("#") || href.startsWith("mailto:")) {
    return null;
  }
  let path = href.replace(/^\.?\//, "");
  path = path.replace(/\.md$/i, "");
  try {
    path = decodeURIComponent(path);
  } catch {
  }
  return path || null;
}
function renderWikiMarkdown(content, pageNames, wikiStyle = "github") {
  const md = new Marked();
  const codeRenderer = (args) => {
    const lang = args.lang || "";
    const code = args.text;
    if (lang && hljs.getLanguage(lang)) {
      const highlighted = hljs.highlight(code, { language: lang }).value;
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
    }
    const auto = hljs.highlightAuto(code).value;
    return `<pre><code class="hljs">${auto}</code></pre>`;
  };
  const linkRenderer = wikiStyle === "ado" ? (args) => {
    const resolved = resolveAdoLink(args.href);
    if (resolved) {
      const titleAttr2 = args.title ? ` title="${args.title}"` : "";
      return `<a class="wiki-link" data-wiki-link="${resolved}" href="#"${titleAttr2}>${args.text}</a>`;
    }
    const titleAttr = args.title ? ` title="${args.title}"` : "";
    return `<a href="${args.href}"${titleAttr} target="_blank" rel="noopener noreferrer">${args.text}</a>`;
  } : void 0;
  const extensions = wikiStyle === "github" ? [createWikiLinkExtension(pageNames)] : [];
  md.use({
    extensions,
    renderer: {
      code: codeRenderer,
      ...linkRenderer ? { link: linkRenderer } : {}
    }
  });
  return md.parse(content);
}
function WikiMarkdownPreview({ content, pageNames, onNavigate, wikiStyle = "github" }) {
  injectWikiLinkStyle();
  const containerRef = useRef2(null);
  const html = useMemo(() => {
    return renderWikiMarkdown(content, pageNames, wikiStyle);
  }, [content, pageNames, wikiStyle]);
  const handleClick = useCallback2((e) => {
    const target = e.target;
    const wikiLink = target.closest("[data-wiki-link]");
    if (wikiLink) {
      if (wikiLink.classList.contains("wiki-link-broken")) return;
      e.preventDefault();
      const pageName = wikiLink.getAttribute("data-wiki-link");
      if (pageName) {
        onNavigate(pageName);
      }
      return;
    }
    if (wikiStyle === "ado") {
      const anchor = target.closest("a");
      if (anchor) {
        const href = anchor.getAttribute("href") || "";
        if (href && !href.startsWith("#") && !/^https?:\/\//i.test(href) && !href.startsWith("mailto:")) {
          e.preventDefault();
          const resolved = resolveAdoLink(href);
          if (resolved) {
            onNavigate(resolved);
          }
        }
      }
    }
  }, [onNavigate, wikiStyle]);
  useEffect2(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [handleClick]);
  return React2.createElement("div", {
    ref: containerRef,
    className: "help-content",
    style: { padding: 16, overflow: "auto", height: "100%", color: color.text },
    dangerouslySetInnerHTML: { __html: html }
  });
}

// src/SendToAgentDialog.tsx
var React3 = globalThis.React;
var { useState: useState2, useEffect: useEffect3, useCallback: useCallback3, useRef: useRef3 } = React3;
function statusBadge(status) {
  const base = {
    fontSize: 9,
    padding: "1px 4px",
    borderRadius: 4
  };
  switch (status) {
    case "sleeping":
      return React3.createElement("span", {
        style: { ...base, background: "rgba(34, 197, 94, 0.15)", color: color.textSuccess }
      }, "sleeping");
    case "running":
      return React3.createElement("span", {
        style: { ...base, background: "rgba(234, 179, 8, 0.15)", color: color.textWarning }
      }, "running");
    case "error":
      return React3.createElement("span", {
        style: { ...base, background: "rgba(248, 113, 113, 0.15)", color: color.textError }
      }, "error");
    default:
      return null;
  }
}
function SendToAgentDialog({ api, filePath, content, onClose }) {
  const [instructions, setInstructions] = useState2("");
  const [durableAgents, setDurableAgents] = useState2([]);
  const overlayRef = useRef3(null);
  useEffect3(() => {
    const agents = api.agents.list().filter((a) => a.kind === "durable");
    setDurableAgents(agents);
  }, [api]);
  useEffect3(() => {
    const handleMouseDown = (e) => {
      if (overlayRef.current && e.target === overlayRef.current) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);
  const buildMission = useCallback3(() => {
    const parts = [
      `Wiki page: ${filePath}`,
      "",
      "Page content:",
      "```markdown",
      content,
      "```"
    ];
    if (instructions.trim()) {
      parts.push("", `Additional instructions: ${instructions.trim()}`);
    }
    return parts.join("\n");
  }, [filePath, content, instructions]);
  const handleDurableAgent = useCallback3(async (agent) => {
    if (agent.status === "running") {
      const ok = await api.ui.showConfirm(
        `"${agent.name}" is currently running. Sending this page will interrupt its current work. Continue?`
      );
      if (!ok) return;
      await api.agents.kill(agent.id);
    }
    const mission = buildMission();
    try {
      await api.agents.resume(agent.id, { mission });
      api.ui.showNotice(`Wiki page sent to ${agent.name}`);
    } catch {
      api.ui.showError(`Failed to send to ${agent.name}`);
    }
    onClose();
  }, [api, buildMission, onClose]);
  const AgentAvatar = api.widgets.AgentAvatar;
  return React3.createElement(
    "div",
    {
      ref: overlayRef,
      style: overlay
    },
    React3.createElement(
      "div",
      {
        style: { ...dialog, width: 320, maxHeight: "80vh", overflow: "auto" }
      },
      // Title
      React3.createElement("div", {
        style: { fontSize: 14, fontWeight: 500, color: color.text, marginBottom: 12 }
      }, "Send to Agent"),
      // File path
      React3.createElement("div", {
        style: { fontSize: 10, color: color.textSecondary, marginBottom: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
      }, filePath),
      // Instructions textarea
      React3.createElement("textarea", {
        style: {
          ...baseInput,
          height: 80,
          resize: "none",
          fontFamily: font.family
        },
        placeholder: "Additional instructions (optional)",
        value: instructions,
        onChange: (e) => setInstructions(e.target.value)
      }),
      // Agent list
      React3.createElement(
        "div",
        { style: { marginTop: 12 } },
        // Empty state
        durableAgents.length === 0 ? React3.createElement("div", {
          style: { fontSize: 12, color: color.textSecondary, textAlign: "center", padding: "16px 0" }
        }, "No durable agents found") : null,
        ...durableAgents.map(
          (agent) => React3.createElement(
            "button",
            {
              key: agent.id,
              style: {
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                fontSize: 12,
                color: color.text,
                background: "transparent",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: font.family
              },
              onClick: () => handleDurableAgent(agent)
            },
            React3.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 6 } },
              React3.createElement(AgentAvatar, {
                agentId: agent.id,
                size: "sm",
                showStatusRing: true
              }),
              React3.createElement("span", { style: { fontWeight: 500 } }, agent.name),
              statusBadge(agent.status)
            ),
            agent.status === "running" ? React3.createElement("div", {
              style: { fontSize: 10, color: color.textWarning, marginTop: 2, paddingLeft: 20 }
            }, "Will interrupt current work") : React3.createElement("div", {
              style: { fontSize: 10, color: color.textSecondary, marginTop: 2, paddingLeft: 20 }
            }, "Send page to this agent")
          )
        )
      ),
      // Cancel button
      React3.createElement(
        "div",
        { style: { marginTop: 12, display: "flex", justifyContent: "flex-end" } },
        React3.createElement("button", {
          style: {
            padding: "4px 12px",
            fontSize: 12,
            color: color.textSecondary,
            background: "transparent",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: font.family
          },
          onClick: onClose
        }, "Cancel")
      )
    )
  );
}

// src/WikiViewer.tsx
var React4 = globalThis.React;
var { useState: useState3, useEffect: useEffect4, useCallback: useCallback4, useRef: useRef4 } = React4;
function getFileName(path) {
  return path.split("/").pop() || path;
}
function prettifyName2(name, wikiStyle = "github") {
  let base = name.replace(/\.md$/i, "");
  if (wikiStyle === "ado") {
    base = base.replace(/%2D/gi, "\0").replace(/-/g, " ").replace(/\x00/g, "-");
  } else {
    base = base.replace(/[-_]/g, " ");
  }
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}
function getBreadcrumb(path) {
  return path.replace(/\//g, " / ");
}
function collectMarkdownFiles(nodes, result) {
  for (const node of nodes) {
    if (node.isDirectory) {
      if (node.children) {
        collectMarkdownFiles(node.children, result);
      }
    } else if (node.name.endsWith(".md")) {
      result.push({ name: node.name, path: node.path });
    }
  }
}
function SimpleEditor({ value, onSave, onDirtyChange, filePath }) {
  const [currentValue, setCurrentValue] = useState3(value);
  const textareaRef = useRef4(null);
  const initialValueRef = useRef4(value);
  useEffect4(() => {
    setCurrentValue(value);
    initialValueRef.current = value;
  }, [value, filePath]);
  const handleChange = useCallback4((e) => {
    const newValue = e.target.value;
    setCurrentValue(newValue);
    onDirtyChange(newValue !== initialValueRef.current);
  }, [onDirtyChange]);
  const handleKeyDown = useCallback4((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      onSave(currentValue);
      initialValueRef.current = currentValue;
      onDirtyChange(false);
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current;
      if (ta) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newValue = currentValue.substring(0, start) + "  " + currentValue.substring(end);
        setCurrentValue(newValue);
        onDirtyChange(newValue !== initialValueRef.current);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    }
  }, [currentValue, onSave, onDirtyChange]);
  return React4.createElement("textarea", {
    ref: textareaRef,
    value: currentValue,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    spellCheck: false,
    style: {
      width: "100%",
      height: "100%",
      padding: 16,
      fontSize: 13,
      lineHeight: 1.6,
      fontFamily: font.mono,
      color: color.text,
      background: color.bg,
      border: "none",
      outline: "none",
      resize: "none",
      tabSize: 2
    }
  });
}
function UnsavedDialog({ fileName, onSave, onDiscard, onCancel }) {
  return React4.createElement(
    "div",
    {
      style: overlay
    },
    React4.createElement(
      "div",
      {
        style: { ...dialog, maxWidth: 360 }
      },
      React4.createElement(
        "p",
        { style: { fontSize: 14, color: color.text, marginBottom: 16 } },
        `"${fileName}" has unsaved changes.`
      ),
      React4.createElement(
        "div",
        { style: { display: "flex", gap: 8, justifyContent: "flex-end" } },
        React4.createElement("button", {
          style: { padding: "4px 12px", fontSize: 12, color: color.textSecondary, background: "transparent", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: font.family },
          onClick: onCancel
        }, "Cancel"),
        React4.createElement("button", {
          style: { padding: "4px 12px", fontSize: 12, color: color.textError, background: "transparent", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: font.family },
          onClick: onDiscard
        }, "Discard"),
        React4.createElement("button", {
          style: { padding: "4px 12px", fontSize: 12, background: color.accent, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: font.family },
          onClick: onSave
        }, "Save")
      )
    )
  );
}
function WikiViewer({ api }) {
  const [selectedPath, setSelectedPath] = useState3(wikiState.selectedPath);
  const [content, setContent] = useState3("");
  const [viewMode, setViewMode] = useState3(wikiState.viewMode);
  const [isDirty, setIsDirty] = useState3(wikiState.isDirty);
  const [loading, setLoading] = useState3(false);
  const [unsavedDialog, setUnsavedDialog] = useState3(null);
  const [showSendDialog, setShowSendDialog] = useState3(false);
  const [pageNames, setPageNames] = useState3([]);
  const [canGoBack, setCanGoBack] = useState3(wikiState.canGoBack());
  const contentRef = useRef4(content);
  contentRef.current = content;
  const isDirtyRef = useRef4(isDirty);
  isDirtyRef.current = isDirty;
  const selectedPathRef = useRef4(selectedPath);
  selectedPathRef.current = selectedPath;
  const wikiFilesRef = useRef4(null);
  const pagePathMapRef = useRef4(/* @__PURE__ */ new Map());
  const wikiStyle = api.settings.get("wikiStyle") || "github";
  const getScopedFiles = useCallback4(() => {
    try {
      const scoped = api.files.forRoot("wiki");
      wikiFilesRef.current = scoped;
      return scoped;
    } catch {
      wikiFilesRef.current = null;
      return null;
    }
  }, [api]);
  const loadPageNames = useCallback4(async () => {
    const scoped = getScopedFiles();
    if (!scoped) {
      setPageNames([]);
      pagePathMapRef.current = /* @__PURE__ */ new Map();
      return;
    }
    try {
      const tree = await scoped.readTree(".", { depth: 10 });
      const files = [];
      collectMarkdownFiles(tree, files);
      const names = [];
      const pathMap = /* @__PURE__ */ new Map();
      for (const file of files) {
        const baseName = file.name.replace(/\.md$/i, "");
        names.push(baseName);
        pathMap.set(baseName.toLowerCase(), file.path);
        const pathWithoutExt = file.path.replace(/\.md$/i, "").toLowerCase();
        pathMap.set(pathWithoutExt, file.path);
      }
      setPageNames(names);
      pagePathMapRef.current = pathMap;
    } catch {
      setPageNames([]);
      pagePathMapRef.current = /* @__PURE__ */ new Map();
    }
  }, [getScopedFiles]);
  const handleWikiNavigate = useCallback4((pageName) => {
    const key = pageName.toLowerCase();
    const match = pagePathMapRef.current.get(key);
    if (match) {
      wikiState.setSelectedPath(match);
      return;
    }
    const withMd = pagePathMapRef.current.get(key.replace(/\.md$/i, ""));
    if (withMd) {
      wikiState.setSelectedPath(withMd);
      return;
    }
    const lastSegment = key.split("/").pop() || key;
    const fallback = pagePathMapRef.current.get(lastSegment);
    if (fallback) {
      wikiState.setSelectedPath(fallback);
    }
  }, []);
  const loadFile = useCallback4(async (path) => {
    setLoading(true);
    const scoped = getScopedFiles();
    if (!scoped) {
      setContent("");
      setLoading(false);
      return;
    }
    try {
      const text = await scoped.readFile(path);
      setContent(text);
    } catch {
      setContent("");
    }
    setLoading(false);
  }, [getScopedFiles]);
  useEffect4(() => {
    loadPageNames();
  }, []);
  useEffect4(() => {
    return wikiState.subscribe(() => {
      loadPageNames();
    });
  }, [loadPageNames]);
  useEffect4(() => {
    if (selectedPath) {
      loadFile(selectedPath);
    }
  }, []);
  const switchToFile = useCallback4((newPath) => {
    if (!newPath) {
      setSelectedPath(null);
      setContent("");
      return;
    }
    if (isDirtyRef.current && selectedPathRef.current) {
      setUnsavedDialog({ pendingPath: newPath });
      return;
    }
    setSelectedPath(newPath);
    selectedPathRef.current = newPath;
    setIsDirty(false);
    wikiState.setDirty(false);
    loadFile(newPath);
  }, [loadFile]);
  useEffect4(() => {
    return wikiState.subscribe(() => {
      const newPath = wikiState.selectedPath;
      if (newPath !== selectedPathRef.current) {
        switchToFile(newPath);
      }
      setViewMode(wikiState.viewMode);
      setCanGoBack(wikiState.canGoBack());
    });
  }, [switchToFile]);
  const saveFile = useCallback4(async () => {
    if (!selectedPath) return;
    const scoped = wikiFilesRef.current;
    if (!scoped) return;
    try {
      await scoped.writeFile(selectedPath, contentRef.current);
      setIsDirty(false);
      wikiState.setDirty(false);
    } catch (err) {
      api.ui.showError(`Failed to save: ${err}`);
    }
  }, [api, selectedPath]);
  const handleDirtyChange = useCallback4((dirty) => {
    setIsDirty(dirty);
    wikiState.setDirty(dirty);
  }, []);
  const handleSave = useCallback4(async (newContent) => {
    if (!selectedPath) return;
    const scoped = wikiFilesRef.current;
    if (!scoped) return;
    try {
      setContent(newContent);
      await scoped.writeFile(selectedPath, newContent);
      setIsDirty(false);
      wikiState.setDirty(false);
    } catch (err) {
      api.ui.showError(`Failed to save: ${err}`);
    }
  }, [api, selectedPath]);
  const handleToggleMode = useCallback4((mode) => {
    setViewMode(mode);
    wikiState.setViewMode(mode);
  }, []);
  const handleGoBack = useCallback4(() => {
    wikiState.goBack();
  }, []);
  const handleDialogSave = useCallback4(async () => {
    if (!unsavedDialog) return;
    await saveFile();
    const pendingPath = unsavedDialog.pendingPath;
    setUnsavedDialog(null);
    setSelectedPath(pendingPath);
    setIsDirty(false);
    wikiState.setDirty(false);
    loadFile(pendingPath);
  }, [unsavedDialog, saveFile, loadFile]);
  const handleDialogDiscard = useCallback4(() => {
    if (!unsavedDialog) return;
    const pendingPath = unsavedDialog.pendingPath;
    setUnsavedDialog(null);
    setSelectedPath(pendingPath);
    setIsDirty(false);
    wikiState.setDirty(false);
    loadFile(pendingPath);
  }, [unsavedDialog, loadFile]);
  const handleDialogCancel = useCallback4(() => {
    setUnsavedDialog(null);
  }, []);
  const toggleBtnStyle = (active) => ({
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 10,
    background: active ? color.bgActive : "transparent",
    color: active ? color.text : color.textSecondary,
    border: "none",
    cursor: "pointer",
    fontFamily: font.family
  });
  if (!selectedPath) {
    return React4.createElement(
      "div",
      {
        style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: color.textSecondary, fontFamily: font.family }
      },
      React4.createElement(
        "svg",
        {
          width: 40,
          height: 40,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.5,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          style: { marginBottom: 12, opacity: 0.5 }
        },
        React4.createElement("path", { d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20" }),
        React4.createElement("path", { d: "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" })
      ),
      React4.createElement("p", { style: { fontSize: 12 } }, "Select a page to view"),
      React4.createElement("p", { style: { fontSize: 10, marginTop: 4, opacity: 0.6 } }, "Click a page in the sidebar")
    );
  }
  if (loading) {
    return React4.createElement("div", {
      style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: color.textSecondary, fontSize: 12, fontFamily: font.family }
    }, "Loading...");
  }
  const fileName = getFileName(selectedPath);
  const displayName = viewMode === "view" ? prettifyName2(fileName, wikiStyle) : fileName;
  const header = React4.createElement(
    "div",
    {
      style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", borderBottom: `1px solid ${color.border}`, background: color.bgSecondary, flexShrink: 0, fontFamily: font.family }
    },
    React4.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 } },
      // Back button
      React4.createElement(
        "button",
        {
          style: {
            padding: 2,
            borderRadius: 4,
            flexShrink: 0,
            color: canGoBack ? color.textSecondary : color.bgTertiary,
            cursor: canGoBack ? "pointer" : "default",
            background: "transparent",
            border: "none"
          },
          onClick: canGoBack ? handleGoBack : void 0,
          disabled: !canGoBack,
          title: "Go back"
        },
        React4.createElement(
          "svg",
          {
            width: 14,
            height: 14,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2,
            strokeLinecap: "round",
            strokeLinejoin: "round"
          },
          React4.createElement("polyline", { points: "15 18 9 12 15 6" })
        )
      ),
      React4.createElement("span", { style: { fontSize: 12, fontWeight: 500, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, displayName),
      isDirty ? React4.createElement("span", {
        style: { width: 8, height: 8, borderRadius: "50%", background: color.orange, flexShrink: 0 },
        title: "Unsaved changes"
      }) : null
    ),
    React4.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 } },
      // View/Edit toggle
      React4.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", background: color.bgTertiary, borderRadius: 4 } },
        React4.createElement("button", {
          style: toggleBtnStyle(viewMode === "view"),
          onClick: () => handleToggleMode("view")
        }, "View"),
        React4.createElement("button", {
          style: toggleBtnStyle(viewMode === "edit"),
          onClick: () => handleToggleMode("edit")
        }, "Edit")
      ),
      // Send to Agent
      React4.createElement("button", {
        style: { padding: "2px 8px", fontSize: 10, color: color.accent, background: "transparent", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: font.family },
        onClick: () => setShowSendDialog(true)
      }, "Send to Agent"),
      // Breadcrumb
      React4.createElement("span", {
        style: { fontSize: 10, color: color.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 },
        title: selectedPath
      }, getBreadcrumb(selectedPath))
    )
  );
  let body;
  if (viewMode === "view") {
    body = React4.createElement(
      "div",
      { style: { flex: 1, minHeight: 0, overflow: "auto" } },
      React4.createElement(WikiMarkdownPreview, { content, pageNames, onNavigate: handleWikiNavigate, wikiStyle })
    );
  } else {
    body = React4.createElement(
      "div",
      { style: { flex: 1, minHeight: 0 } },
      React4.createElement(SimpleEditor, {
        value: content,
        onSave: handleSave,
        onDirtyChange: handleDirtyChange,
        filePath: selectedPath
      })
    );
  }
  return React4.createElement(
    "div",
    {
      style: { display: "flex", flexDirection: "column", height: "100%", background: color.bg, position: "relative", fontFamily: font.family }
    },
    header,
    body,
    // Unsaved changes dialog
    unsavedDialog ? React4.createElement(UnsavedDialog, {
      fileName: displayName,
      onSave: handleDialogSave,
      onDiscard: handleDialogDiscard,
      onCancel: handleDialogCancel
    }) : null,
    // Send to Agent dialog
    showSendDialog ? React4.createElement(SendToAgentDialog, {
      api,
      filePath: selectedPath,
      content,
      onClose: () => setShowSendDialog(false)
    }) : null
  );
}

// src/main.tsx
import { jsx } from "react/jsx-runtime";
var React5 = globalThis.React;
function activate(ctx, api) {
  const disposable = api.commands.register("refresh", () => {
    wikiState.triggerRefresh();
  });
  ctx.subscriptions.push(disposable);
}
function deactivate() {
  wikiState.reset();
}
function SidebarPanel({ api }) {
  return /* @__PURE__ */ jsx(WikiTree, { api });
}
function MainPanel({ api }) {
  return /* @__PURE__ */ jsx(WikiViewer, { api });
}
export {
  MainPanel,
  SidebarPanel,
  activate,
  deactivate
};
