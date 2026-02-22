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
  textSuccess: "var(--text-success, #22c55e)",
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
  // Status badge backgrounds
  bgSuccess: "var(--bg-success, rgba(34, 197, 94, 0.15))",
  bgWarning: "var(--bg-warning, rgba(234, 179, 8, 0.15))",
  bgErrorSubtle: "var(--bg-error-subtle, rgba(248, 113, 113, 0.15))",
  // Overlay & shadow
  overlay: "var(--bg-overlay, rgba(0, 0, 0, 0.5))",
  shadow: "var(--shadow-color, rgba(0, 0, 0, 0.5))",
  shadowMenu: "var(--shadow-menu, rgba(0, 0, 0, 0.3))",
  // Text on accent backgrounds
  textOnAccent: "var(--text-on-accent, #fff)",
  // File icon colors by extension
  blue: "var(--color-blue, #3b82f6)",
  green: "var(--color-green, #22c55e)",
  yellow: "var(--color-yellow, #eab308)",
  orange: "var(--color-orange, #f97316)",
  red: "var(--color-red, #ef4444)",
  purple: "var(--color-purple, #a855f7)",
  cyan: "var(--color-cyan, #06b6d4)"
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
  color: color.textOnAccent,
  fontWeight: 500
};
var dangerButton = {
  ...baseButton,
  color: color.textError,
  borderColor: "var(--border-error, rgba(248, 113, 113, 0.3))"
};
var overlay = {
  position: "absolute",
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
  boxShadow: `0 25px 50px -12px ${color.shadow}`,
  width: "100%",
  maxWidth: 480,
  margin: "0 16px",
  padding: 16
};

// src/file-icons.ts
var EXT_COLORS = {
  // Markdown
  md: color.blue,
  mdx: color.blue,
  // JavaScript/TypeScript
  js: color.yellow,
  jsx: color.yellow,
  ts: color.blue,
  tsx: color.blue,
  // Config/data
  json: color.green,
  yaml: color.green,
  yml: color.green,
  toml: color.green,
  xml: color.orange,
  // Styles
  css: color.purple,
  scss: color.purple,
  less: color.purple,
  // Shell
  sh: color.green,
  bash: color.green,
  zsh: color.green,
  // Python
  py: color.blue,
  // Rust
  rs: color.orange,
  // Go
  go: color.cyan,
  // HTML
  html: color.orange,
  htm: color.orange,
  // Images
  png: color.purple,
  jpg: color.purple,
  jpeg: color.purple,
  gif: color.purple,
  svg: color.purple,
  // Text
  txt: color.textSecondary,
  log: color.textSecondary
};
function getFileIconColor(ext) {
  return EXT_COLORS[ext.toLowerCase()] || color.textSecondary;
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
        boxShadow: `0 4px 12px ${color.shadowMenu}`,
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

// node_modules/dompurify/dist/purify.es.mjs
var {
  entries,
  setPrototypeOf,
  isFrozen,
  getPrototypeOf,
  getOwnPropertyDescriptor
} = Object;
var {
  freeze,
  seal,
  create
} = Object;
var {
  apply,
  construct
} = typeof Reflect !== "undefined" && Reflect;
if (!freeze) {
  freeze = function freeze2(x) {
    return x;
  };
}
if (!seal) {
  seal = function seal2(x) {
    return x;
  };
}
if (!apply) {
  apply = function apply2(func, thisArg) {
    for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      args[_key - 2] = arguments[_key];
    }
    return func.apply(thisArg, args);
  };
}
if (!construct) {
  construct = function construct2(Func) {
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }
    return new Func(...args);
  };
}
var arrayForEach = unapply(Array.prototype.forEach);
var arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
var arrayPop = unapply(Array.prototype.pop);
var arrayPush = unapply(Array.prototype.push);
var arraySplice = unapply(Array.prototype.splice);
var stringToLowerCase = unapply(String.prototype.toLowerCase);
var stringToString = unapply(String.prototype.toString);
var stringMatch = unapply(String.prototype.match);
var stringReplace = unapply(String.prototype.replace);
var stringIndexOf = unapply(String.prototype.indexOf);
var stringTrim = unapply(String.prototype.trim);
var objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
var regExpTest = unapply(RegExp.prototype.test);
var typeErrorCreate = unconstruct(TypeError);
function unapply(func) {
  return function(thisArg) {
    if (thisArg instanceof RegExp) {
      thisArg.lastIndex = 0;
    }
    for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
      args[_key3 - 1] = arguments[_key3];
    }
    return apply(func, thisArg, args);
  };
}
function unconstruct(Func) {
  return function() {
    for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }
    return construct(Func, args);
  };
}
function addToSet(set, array) {
  let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
  if (setPrototypeOf) {
    setPrototypeOf(set, null);
  }
  let l = array.length;
  while (l--) {
    let element = array[l];
    if (typeof element === "string") {
      const lcElement = transformCaseFunc(element);
      if (lcElement !== element) {
        if (!isFrozen(array)) {
          array[l] = lcElement;
        }
        element = lcElement;
      }
    }
    set[element] = true;
  }
  return set;
}
function cleanArray(array) {
  for (let index = 0; index < array.length; index++) {
    const isPropertyExist = objectHasOwnProperty(array, index);
    if (!isPropertyExist) {
      array[index] = null;
    }
  }
  return array;
}
function clone(object) {
  const newObject = create(null);
  for (const [property, value] of entries(object)) {
    const isPropertyExist = objectHasOwnProperty(object, property);
    if (isPropertyExist) {
      if (Array.isArray(value)) {
        newObject[property] = cleanArray(value);
      } else if (value && typeof value === "object" && value.constructor === Object) {
        newObject[property] = clone(value);
      } else {
        newObject[property] = value;
      }
    }
  }
  return newObject;
}
function lookupGetter(object, prop) {
  while (object !== null) {
    const desc = getOwnPropertyDescriptor(object, prop);
    if (desc) {
      if (desc.get) {
        return unapply(desc.get);
      }
      if (typeof desc.value === "function") {
        return unapply(desc.value);
      }
    }
    object = getPrototypeOf(object);
  }
  function fallbackValue() {
    return null;
  }
  return fallbackValue;
}
var html$1 = freeze(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "shadow", "slot", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]);
var svg$1 = freeze(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "enterkeyhint", "exportparts", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "inputmode", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "part", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]);
var svgFilters = freeze(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]);
var svgDisallowed = freeze(["animate", "color-profile", "cursor", "discard", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]);
var mathMl$1 = freeze(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover", "mprescripts"]);
var mathMlDisallowed = freeze(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]);
var text = freeze(["#text"]);
var html = freeze(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "exportparts", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inert", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "nonce", "noshade", "novalidate", "nowrap", "open", "optimum", "part", "pattern", "placeholder", "playsinline", "popover", "popovertarget", "popovertargetaction", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "slot", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "wrap", "xmlns", "slot"]);
var svg = freeze(["accent-height", "accumulate", "additive", "alignment-baseline", "amplitude", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dur", "edgemode", "elevation", "end", "exponent", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "intercept", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "mask-type", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "slope", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "tablevalues", "targetx", "targety", "transform", "transform-origin", "text-anchor", "text-decoration", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]);
var mathMl = freeze(["accent", "accentunder", "align", "bevelled", "close", "columnsalign", "columnlines", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lspace", "lquote", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]);
var xml = freeze(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]);
var MUSTACHE_EXPR = seal(/\{\{[\w\W]*|[\w\W]*\}\}/gm);
var ERB_EXPR = seal(/<%[\w\W]*|[\w\W]*%>/gm);
var TMPLIT_EXPR = seal(/\$\{[\w\W]*/gm);
var DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
var ARIA_ATTR = seal(/^aria-[\-\w]+$/);
var IS_ALLOWED_URI = seal(
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  // eslint-disable-line no-useless-escape
);
var IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
var ATTR_WHITESPACE = seal(
  /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g
  // eslint-disable-line no-control-regex
);
var DOCTYPE_NAME = seal(/^html$/i);
var CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
var EXPRESSIONS = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  ARIA_ATTR,
  ATTR_WHITESPACE,
  CUSTOM_ELEMENT,
  DATA_ATTR,
  DOCTYPE_NAME,
  ERB_EXPR,
  IS_ALLOWED_URI,
  IS_SCRIPT_OR_DATA,
  MUSTACHE_EXPR,
  TMPLIT_EXPR
});
var NODE_TYPE = {
  element: 1,
  attribute: 2,
  text: 3,
  cdataSection: 4,
  entityReference: 5,
  // Deprecated
  entityNode: 6,
  // Deprecated
  progressingInstruction: 7,
  comment: 8,
  document: 9,
  documentType: 10,
  documentFragment: 11,
  notation: 12
  // Deprecated
};
var getGlobal = function getGlobal2() {
  return typeof window === "undefined" ? null : window;
};
var _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
  if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") {
    return null;
  }
  let suffix = null;
  const ATTR_NAME = "data-tt-policy-suffix";
  if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) {
    suffix = purifyHostElement.getAttribute(ATTR_NAME);
  }
  const policyName = "dompurify" + (suffix ? "#" + suffix : "");
  try {
    return trustedTypes.createPolicy(policyName, {
      createHTML(html2) {
        return html2;
      },
      createScriptURL(scriptUrl) {
        return scriptUrl;
      }
    });
  } catch (_) {
    console.warn("TrustedTypes policy " + policyName + " could not be created.");
    return null;
  }
};
var _createHooksMap = function _createHooksMap2() {
  return {
    afterSanitizeAttributes: [],
    afterSanitizeElements: [],
    afterSanitizeShadowDOM: [],
    beforeSanitizeAttributes: [],
    beforeSanitizeElements: [],
    beforeSanitizeShadowDOM: [],
    uponSanitizeAttribute: [],
    uponSanitizeElement: [],
    uponSanitizeShadowNode: []
  };
};
function createDOMPurify() {
  let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
  const DOMPurify = (root) => createDOMPurify(root);
  DOMPurify.version = "3.3.1";
  DOMPurify.removed = [];
  if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
    DOMPurify.isSupported = false;
    return DOMPurify;
  }
  let {
    document: document2
  } = window2;
  const originalDocument = document2;
  const currentScript = originalDocument.currentScript;
  const {
    DocumentFragment,
    HTMLTemplateElement,
    Node,
    Element,
    NodeFilter,
    NamedNodeMap = window2.NamedNodeMap || window2.MozNamedAttrMap,
    HTMLFormElement,
    DOMParser,
    trustedTypes
  } = window2;
  const ElementPrototype = Element.prototype;
  const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
  const remove = lookupGetter(ElementPrototype, "remove");
  const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
  const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
  const getParentNode = lookupGetter(ElementPrototype, "parentNode");
  if (typeof HTMLTemplateElement === "function") {
    const template = document2.createElement("template");
    if (template.content && template.content.ownerDocument) {
      document2 = template.content.ownerDocument;
    }
  }
  let trustedTypesPolicy;
  let emptyHTML = "";
  const {
    implementation,
    createNodeIterator,
    createDocumentFragment,
    getElementsByTagName
  } = document2;
  const {
    importNode
  } = originalDocument;
  let hooks = _createHooksMap();
  DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
  const {
    MUSTACHE_EXPR: MUSTACHE_EXPR2,
    ERB_EXPR: ERB_EXPR2,
    TMPLIT_EXPR: TMPLIT_EXPR2,
    DATA_ATTR: DATA_ATTR2,
    ARIA_ATTR: ARIA_ATTR2,
    IS_SCRIPT_OR_DATA: IS_SCRIPT_OR_DATA2,
    ATTR_WHITESPACE: ATTR_WHITESPACE2,
    CUSTOM_ELEMENT: CUSTOM_ELEMENT2
  } = EXPRESSIONS;
  let {
    IS_ALLOWED_URI: IS_ALLOWED_URI$1
  } = EXPRESSIONS;
  let ALLOWED_TAGS = null;
  const DEFAULT_ALLOWED_TAGS = addToSet({}, [...html$1, ...svg$1, ...svgFilters, ...mathMl$1, ...text]);
  let ALLOWED_ATTR = null;
  const DEFAULT_ALLOWED_ATTR = addToSet({}, [...html, ...svg, ...mathMl, ...xml]);
  let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
    tagNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    allowCustomizedBuiltInElements: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: false
    }
  }));
  let FORBID_TAGS = null;
  let FORBID_ATTR = null;
  const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
    tagCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    }
  }));
  let ALLOW_ARIA_ATTR = true;
  let ALLOW_DATA_ATTR = true;
  let ALLOW_UNKNOWN_PROTOCOLS = false;
  let ALLOW_SELF_CLOSE_IN_ATTR = true;
  let SAFE_FOR_TEMPLATES = false;
  let SAFE_FOR_XML = true;
  let WHOLE_DOCUMENT = false;
  let SET_CONFIG = false;
  let FORCE_BODY = false;
  let RETURN_DOM = false;
  let RETURN_DOM_FRAGMENT = false;
  let RETURN_TRUSTED_TYPE = false;
  let SANITIZE_DOM = true;
  let SANITIZE_NAMED_PROPS = false;
  const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
  let KEEP_CONTENT = true;
  let IN_PLACE = false;
  let USE_PROFILES = {};
  let FORBID_CONTENTS = null;
  const DEFAULT_FORBID_CONTENTS = addToSet({}, ["annotation-xml", "audio", "colgroup", "desc", "foreignobject", "head", "iframe", "math", "mi", "mn", "mo", "ms", "mtext", "noembed", "noframes", "noscript", "plaintext", "script", "style", "svg", "template", "thead", "title", "video", "xmp"]);
  let DATA_URI_TAGS = null;
  const DEFAULT_DATA_URI_TAGS = addToSet({}, ["audio", "video", "img", "source", "image", "track"]);
  let URI_SAFE_ATTRIBUTES = null;
  const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "role", "summary", "title", "value", "style", "xmlns"]);
  const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  let NAMESPACE = HTML_NAMESPACE;
  let IS_EMPTY_INPUT = false;
  let ALLOWED_NAMESPACES = null;
  const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [MATHML_NAMESPACE, SVG_NAMESPACE, HTML_NAMESPACE], stringToString);
  let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, ["mi", "mo", "mn", "ms", "mtext"]);
  let HTML_INTEGRATION_POINTS = addToSet({}, ["annotation-xml"]);
  const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, ["title", "style", "font", "a", "script"]);
  let PARSER_MEDIA_TYPE = null;
  const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
  const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
  let transformCaseFunc = null;
  let CONFIG = null;
  const formElement = document2.createElement("form");
  const isRegexOrFunction = function isRegexOrFunction2(testValue) {
    return testValue instanceof RegExp || testValue instanceof Function;
  };
  const _parseConfig = function _parseConfig2() {
    let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    if (CONFIG && CONFIG === cfg) {
      return;
    }
    if (!cfg || typeof cfg !== "object") {
      cfg = {};
    }
    cfg = clone(cfg);
    PARSER_MEDIA_TYPE = // eslint-disable-next-line unicorn/prefer-includes
    SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
    transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
    ALLOWED_TAGS = objectHasOwnProperty(cfg, "ALLOWED_TAGS") ? addToSet({}, cfg.ALLOWED_TAGS, transformCaseFunc) : DEFAULT_ALLOWED_TAGS;
    ALLOWED_ATTR = objectHasOwnProperty(cfg, "ALLOWED_ATTR") ? addToSet({}, cfg.ALLOWED_ATTR, transformCaseFunc) : DEFAULT_ALLOWED_ATTR;
    ALLOWED_NAMESPACES = objectHasOwnProperty(cfg, "ALLOWED_NAMESPACES") ? addToSet({}, cfg.ALLOWED_NAMESPACES, stringToString) : DEFAULT_ALLOWED_NAMESPACES;
    URI_SAFE_ATTRIBUTES = objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") ? addToSet(clone(DEFAULT_URI_SAFE_ATTRIBUTES), cfg.ADD_URI_SAFE_ATTR, transformCaseFunc) : DEFAULT_URI_SAFE_ATTRIBUTES;
    DATA_URI_TAGS = objectHasOwnProperty(cfg, "ADD_DATA_URI_TAGS") ? addToSet(clone(DEFAULT_DATA_URI_TAGS), cfg.ADD_DATA_URI_TAGS, transformCaseFunc) : DEFAULT_DATA_URI_TAGS;
    FORBID_CONTENTS = objectHasOwnProperty(cfg, "FORBID_CONTENTS") ? addToSet({}, cfg.FORBID_CONTENTS, transformCaseFunc) : DEFAULT_FORBID_CONTENTS;
    FORBID_TAGS = objectHasOwnProperty(cfg, "FORBID_TAGS") ? addToSet({}, cfg.FORBID_TAGS, transformCaseFunc) : clone({});
    FORBID_ATTR = objectHasOwnProperty(cfg, "FORBID_ATTR") ? addToSet({}, cfg.FORBID_ATTR, transformCaseFunc) : clone({});
    USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES : false;
    ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
    ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
    ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
    ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
    SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
    SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
    WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
    RETURN_DOM = cfg.RETURN_DOM || false;
    RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
    RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
    FORCE_BODY = cfg.FORCE_BODY || false;
    SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
    SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
    KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
    IN_PLACE = cfg.IN_PLACE || false;
    IS_ALLOWED_URI$1 = cfg.ALLOWED_URI_REGEXP || IS_ALLOWED_URI;
    NAMESPACE = cfg.NAMESPACE || HTML_NAMESPACE;
    MATHML_TEXT_INTEGRATION_POINTS = cfg.MATHML_TEXT_INTEGRATION_POINTS || MATHML_TEXT_INTEGRATION_POINTS;
    HTML_INTEGRATION_POINTS = cfg.HTML_INTEGRATION_POINTS || HTML_INTEGRATION_POINTS;
    CUSTOM_ELEMENT_HANDLING = cfg.CUSTOM_ELEMENT_HANDLING || {};
    if (cfg.CUSTOM_ELEMENT_HANDLING && isRegexOrFunction(cfg.CUSTOM_ELEMENT_HANDLING.tagNameCheck)) {
      CUSTOM_ELEMENT_HANDLING.tagNameCheck = cfg.CUSTOM_ELEMENT_HANDLING.tagNameCheck;
    }
    if (cfg.CUSTOM_ELEMENT_HANDLING && isRegexOrFunction(cfg.CUSTOM_ELEMENT_HANDLING.attributeNameCheck)) {
      CUSTOM_ELEMENT_HANDLING.attributeNameCheck = cfg.CUSTOM_ELEMENT_HANDLING.attributeNameCheck;
    }
    if (cfg.CUSTOM_ELEMENT_HANDLING && typeof cfg.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements === "boolean") {
      CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = cfg.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements;
    }
    if (SAFE_FOR_TEMPLATES) {
      ALLOW_DATA_ATTR = false;
    }
    if (RETURN_DOM_FRAGMENT) {
      RETURN_DOM = true;
    }
    if (USE_PROFILES) {
      ALLOWED_TAGS = addToSet({}, text);
      ALLOWED_ATTR = [];
      if (USE_PROFILES.html === true) {
        addToSet(ALLOWED_TAGS, html$1);
        addToSet(ALLOWED_ATTR, html);
      }
      if (USE_PROFILES.svg === true) {
        addToSet(ALLOWED_TAGS, svg$1);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.svgFilters === true) {
        addToSet(ALLOWED_TAGS, svgFilters);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.mathMl === true) {
        addToSet(ALLOWED_TAGS, mathMl$1);
        addToSet(ALLOWED_ATTR, mathMl);
        addToSet(ALLOWED_ATTR, xml);
      }
    }
    if (cfg.ADD_TAGS) {
      if (typeof cfg.ADD_TAGS === "function") {
        EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
      } else {
        if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
          ALLOWED_TAGS = clone(ALLOWED_TAGS);
        }
        addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
      }
    }
    if (cfg.ADD_ATTR) {
      if (typeof cfg.ADD_ATTR === "function") {
        EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
      } else {
        if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
          ALLOWED_ATTR = clone(ALLOWED_ATTR);
        }
        addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
      }
    }
    if (cfg.ADD_URI_SAFE_ATTR) {
      addToSet(URI_SAFE_ATTRIBUTES, cfg.ADD_URI_SAFE_ATTR, transformCaseFunc);
    }
    if (cfg.FORBID_CONTENTS) {
      if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
        FORBID_CONTENTS = clone(FORBID_CONTENTS);
      }
      addToSet(FORBID_CONTENTS, cfg.FORBID_CONTENTS, transformCaseFunc);
    }
    if (cfg.ADD_FORBID_CONTENTS) {
      if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
        FORBID_CONTENTS = clone(FORBID_CONTENTS);
      }
      addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
    }
    if (KEEP_CONTENT) {
      ALLOWED_TAGS["#text"] = true;
    }
    if (WHOLE_DOCUMENT) {
      addToSet(ALLOWED_TAGS, ["html", "head", "body"]);
    }
    if (ALLOWED_TAGS.table) {
      addToSet(ALLOWED_TAGS, ["tbody"]);
      delete FORBID_TAGS.tbody;
    }
    if (cfg.TRUSTED_TYPES_POLICY) {
      if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") {
        throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
      }
      if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") {
        throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
      }
      trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
      emptyHTML = trustedTypesPolicy.createHTML("");
    } else {
      if (trustedTypesPolicy === void 0) {
        trustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
      }
      if (trustedTypesPolicy !== null && typeof emptyHTML === "string") {
        emptyHTML = trustedTypesPolicy.createHTML("");
      }
    }
    if (freeze) {
      freeze(cfg);
    }
    CONFIG = cfg;
  };
  const ALL_SVG_TAGS = addToSet({}, [...svg$1, ...svgFilters, ...svgDisallowed]);
  const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
  const _checkValidNamespace = function _checkValidNamespace2(element) {
    let parent = getParentNode(element);
    if (!parent || !parent.tagName) {
      parent = {
        namespaceURI: NAMESPACE,
        tagName: "template"
      };
    }
    const tagName = stringToLowerCase(element.tagName);
    const parentTagName = stringToLowerCase(parent.tagName);
    if (!ALLOWED_NAMESPACES[element.namespaceURI]) {
      return false;
    }
    if (element.namespaceURI === SVG_NAMESPACE) {
      if (parent.namespaceURI === HTML_NAMESPACE) {
        return tagName === "svg";
      }
      if (parent.namespaceURI === MATHML_NAMESPACE) {
        return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
      }
      return Boolean(ALL_SVG_TAGS[tagName]);
    }
    if (element.namespaceURI === MATHML_NAMESPACE) {
      if (parent.namespaceURI === HTML_NAMESPACE) {
        return tagName === "math";
      }
      if (parent.namespaceURI === SVG_NAMESPACE) {
        return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
      }
      return Boolean(ALL_MATHML_TAGS[tagName]);
    }
    if (element.namespaceURI === HTML_NAMESPACE) {
      if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) {
        return false;
      }
      if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) {
        return false;
      }
      return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) {
      return true;
    }
    return false;
  };
  const _forceRemove = function _forceRemove2(node) {
    arrayPush(DOMPurify.removed, {
      element: node
    });
    try {
      getParentNode(node).removeChild(node);
    } catch (_) {
      remove(node);
    }
  };
  const _removeAttribute = function _removeAttribute2(name, element) {
    try {
      arrayPush(DOMPurify.removed, {
        attribute: element.getAttributeNode(name),
        from: element
      });
    } catch (_) {
      arrayPush(DOMPurify.removed, {
        attribute: null,
        from: element
      });
    }
    element.removeAttribute(name);
    if (name === "is") {
      if (RETURN_DOM || RETURN_DOM_FRAGMENT) {
        try {
          _forceRemove(element);
        } catch (_) {
        }
      } else {
        try {
          element.setAttribute(name, "");
        } catch (_) {
        }
      }
    }
  };
  const _initDocument = function _initDocument2(dirty) {
    let doc = null;
    let leadingWhitespace = null;
    if (FORCE_BODY) {
      dirty = "<remove></remove>" + dirty;
    } else {
      const matches = stringMatch(dirty, /^[\r\n\t ]+/);
      leadingWhitespace = matches && matches[0];
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) {
      dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
    }
    const dirtyPayload = trustedTypesPolicy ? trustedTypesPolicy.createHTML(dirty) : dirty;
    if (NAMESPACE === HTML_NAMESPACE) {
      try {
        doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
      } catch (_) {
      }
    }
    if (!doc || !doc.documentElement) {
      doc = implementation.createDocument(NAMESPACE, "template", null);
      try {
        doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
      } catch (_) {
      }
    }
    const body = doc.body || doc.documentElement;
    if (dirty && leadingWhitespace) {
      body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
    }
    if (NAMESPACE === HTML_NAMESPACE) {
      return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
    }
    return WHOLE_DOCUMENT ? doc.documentElement : body;
  };
  const _createNodeIterator = function _createNodeIterator2(root) {
    return createNodeIterator.call(
      root.ownerDocument || root,
      root,
      // eslint-disable-next-line no-bitwise
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION,
      null
    );
  };
  const _isClobbered = function _isClobbered2(element) {
    return element instanceof HTMLFormElement && (typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || !(element.attributes instanceof NamedNodeMap) || typeof element.removeAttribute !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function");
  };
  const _isNode = function _isNode2(value) {
    return typeof Node === "function" && value instanceof Node;
  };
  function _executeHooks(hooks2, currentNode, data) {
    arrayForEach(hooks2, (hook) => {
      hook.call(DOMPurify, currentNode, data, CONFIG);
    });
  }
  const _sanitizeElements = function _sanitizeElements2(currentNode) {
    let content = null;
    _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
    if (_isClobbered(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    const tagName = transformCaseFunc(currentNode.nodeName);
    _executeHooks(hooks.uponSanitizeElement, currentNode, {
      tagName,
      allowedTags: ALLOWED_TAGS
    });
    if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(/<[/\w!]/g, currentNode.innerHTML) && regExpTest(/<[/\w!]/g, currentNode.textContent)) {
      _forceRemove(currentNode);
      return true;
    }
    if (currentNode.nodeType === NODE_TYPE.progressingInstruction) {
      _forceRemove(currentNode);
      return true;
    }
    if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(/<[/\w]/g, currentNode.data)) {
      _forceRemove(currentNode);
      return true;
    }
    if (!(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName])) {
      if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName)) {
        if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) {
          return false;
        }
        if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(tagName)) {
          return false;
        }
      }
      if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
        const parentNode = getParentNode(currentNode) || currentNode.parentNode;
        const childNodes = getChildNodes(currentNode) || currentNode.childNodes;
        if (childNodes && parentNode) {
          const childCount = childNodes.length;
          for (let i = childCount - 1; i >= 0; --i) {
            const childClone = cloneNode(childNodes[i], true);
            childClone.__removalCount = (currentNode.__removalCount || 0) + 1;
            parentNode.insertBefore(childClone, getNextSibling(currentNode));
          }
        }
      }
      _forceRemove(currentNode);
      return true;
    }
    if (currentNode instanceof Element && !_checkValidNamespace(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(/<\/no(script|embed|frames)/i, currentNode.innerHTML)) {
      _forceRemove(currentNode);
      return true;
    }
    if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
      content = currentNode.textContent;
      arrayForEach([MUSTACHE_EXPR2, ERB_EXPR2, TMPLIT_EXPR2], (expr) => {
        content = stringReplace(content, expr, " ");
      });
      if (currentNode.textContent !== content) {
        arrayPush(DOMPurify.removed, {
          element: currentNode.cloneNode()
        });
        currentNode.textContent = content;
      }
    }
    _executeHooks(hooks.afterSanitizeElements, currentNode, null);
    return false;
  };
  const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
    if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) {
      return false;
    }
    if (ALLOW_DATA_ATTR && !FORBID_ATTR[lcName] && regExpTest(DATA_ATTR2, lcName)) ;
    else if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR2, lcName)) ;
    else if (EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag)) ;
    else if (!ALLOWED_ATTR[lcName] || FORBID_ATTR[lcName]) {
      if (
        // First condition does a very basic check if a) it's basically a valid custom element tagname AND
        // b) if the tagName passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
        // and c) if the attribute name passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.attributeNameCheck
        _isBasicCustomElement(lcTag) && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(lcTag)) && (CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName) || CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.attributeNameCheck(lcName, lcTag)) || // Alternative, second condition checks if it's an `is`-attribute, AND
        // the value passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
        lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(value))
      ) ;
      else {
        return false;
      }
    } else if (URI_SAFE_ATTRIBUTES[lcName]) ;
    else if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE2, ""))) ;
    else if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) ;
    else if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA2, stringReplace(value, ATTR_WHITESPACE2, ""))) ;
    else if (value) {
      return false;
    } else ;
    return true;
  };
  const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
    return tagName !== "annotation-xml" && stringMatch(tagName, CUSTOM_ELEMENT2);
  };
  const _sanitizeAttributes = function _sanitizeAttributes2(currentNode) {
    _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
    const {
      attributes
    } = currentNode;
    if (!attributes || _isClobbered(currentNode)) {
      return;
    }
    const hookEvent = {
      attrName: "",
      attrValue: "",
      keepAttr: true,
      allowedAttributes: ALLOWED_ATTR,
      forceKeepAttr: void 0
    };
    let l = attributes.length;
    while (l--) {
      const attr = attributes[l];
      const {
        name,
        namespaceURI,
        value: attrValue
      } = attr;
      const lcName = transformCaseFunc(name);
      const initValue = attrValue;
      let value = name === "value" ? initValue : stringTrim(initValue);
      hookEvent.attrName = lcName;
      hookEvent.attrValue = value;
      hookEvent.keepAttr = true;
      hookEvent.forceKeepAttr = void 0;
      _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
      value = hookEvent.attrValue;
      if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name")) {
        _removeAttribute(name, currentNode);
        value = SANITIZE_NAMED_PROPS_PREFIX + value;
      }
      if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|title|textarea)/i, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (lcName === "attributename" && stringMatch(value, "href")) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (hookEvent.forceKeepAttr) {
        continue;
      }
      if (!hookEvent.keepAttr) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(/\/>/i, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (SAFE_FOR_TEMPLATES) {
        arrayForEach([MUSTACHE_EXPR2, ERB_EXPR2, TMPLIT_EXPR2], (expr) => {
          value = stringReplace(value, expr, " ");
        });
      }
      const lcTag = transformCaseFunc(currentNode.nodeName);
      if (!_isValidAttribute(lcTag, lcName, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function") {
        if (namespaceURI) ;
        else {
          switch (trustedTypes.getAttributeType(lcTag, lcName)) {
            case "TrustedHTML": {
              value = trustedTypesPolicy.createHTML(value);
              break;
            }
            case "TrustedScriptURL": {
              value = trustedTypesPolicy.createScriptURL(value);
              break;
            }
          }
        }
      }
      if (value !== initValue) {
        try {
          if (namespaceURI) {
            currentNode.setAttributeNS(namespaceURI, name, value);
          } else {
            currentNode.setAttribute(name, value);
          }
          if (_isClobbered(currentNode)) {
            _forceRemove(currentNode);
          } else {
            arrayPop(DOMPurify.removed);
          }
        } catch (_) {
          _removeAttribute(name, currentNode);
        }
      }
    }
    _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
  };
  const _sanitizeShadowDOM = function _sanitizeShadowDOM2(fragment) {
    let shadowNode = null;
    const shadowIterator = _createNodeIterator(fragment);
    _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
    while (shadowNode = shadowIterator.nextNode()) {
      _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
      _sanitizeElements(shadowNode);
      _sanitizeAttributes(shadowNode);
      if (shadowNode.content instanceof DocumentFragment) {
        _sanitizeShadowDOM2(shadowNode.content);
      }
    }
    _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
  };
  DOMPurify.sanitize = function(dirty) {
    let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    let body = null;
    let importedNode = null;
    let currentNode = null;
    let returnNode = null;
    IS_EMPTY_INPUT = !dirty;
    if (IS_EMPTY_INPUT) {
      dirty = "<!-->";
    }
    if (typeof dirty !== "string" && !_isNode(dirty)) {
      if (typeof dirty.toString === "function") {
        dirty = dirty.toString();
        if (typeof dirty !== "string") {
          throw typeErrorCreate("dirty is not a string, aborting");
        }
      } else {
        throw typeErrorCreate("toString is not a function");
      }
    }
    if (!DOMPurify.isSupported) {
      return dirty;
    }
    if (!SET_CONFIG) {
      _parseConfig(cfg);
    }
    DOMPurify.removed = [];
    if (typeof dirty === "string") {
      IN_PLACE = false;
    }
    if (IN_PLACE) {
      if (dirty.nodeName) {
        const tagName = transformCaseFunc(dirty.nodeName);
        if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
          throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
        }
      }
    } else if (dirty instanceof Node) {
      body = _initDocument("<!---->");
      importedNode = body.ownerDocument.importNode(dirty, true);
      if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") {
        body = importedNode;
      } else if (importedNode.nodeName === "HTML") {
        body = importedNode;
      } else {
        body.appendChild(importedNode);
      }
    } else {
      if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && // eslint-disable-next-line unicorn/prefer-includes
      dirty.indexOf("<") === -1) {
        return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? trustedTypesPolicy.createHTML(dirty) : dirty;
      }
      body = _initDocument(dirty);
      if (!body) {
        return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
      }
    }
    if (body && FORCE_BODY) {
      _forceRemove(body.firstChild);
    }
    const nodeIterator = _createNodeIterator(IN_PLACE ? dirty : body);
    while (currentNode = nodeIterator.nextNode()) {
      _sanitizeElements(currentNode);
      _sanitizeAttributes(currentNode);
      if (currentNode.content instanceof DocumentFragment) {
        _sanitizeShadowDOM(currentNode.content);
      }
    }
    if (IN_PLACE) {
      return dirty;
    }
    if (RETURN_DOM) {
      if (RETURN_DOM_FRAGMENT) {
        returnNode = createDocumentFragment.call(body.ownerDocument);
        while (body.firstChild) {
          returnNode.appendChild(body.firstChild);
        }
      } else {
        returnNode = body;
      }
      if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) {
        returnNode = importNode.call(originalDocument, returnNode, true);
      }
      return returnNode;
    }
    let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
    if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) {
      serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
    }
    if (SAFE_FOR_TEMPLATES) {
      arrayForEach([MUSTACHE_EXPR2, ERB_EXPR2, TMPLIT_EXPR2], (expr) => {
        serializedHTML = stringReplace(serializedHTML, expr, " ");
      });
    }
    return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? trustedTypesPolicy.createHTML(serializedHTML) : serializedHTML;
  };
  DOMPurify.setConfig = function() {
    let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    _parseConfig(cfg);
    SET_CONFIG = true;
  };
  DOMPurify.clearConfig = function() {
    CONFIG = null;
    SET_CONFIG = false;
  };
  DOMPurify.isValidAttribute = function(tag, attr, value) {
    if (!CONFIG) {
      _parseConfig({});
    }
    const lcTag = transformCaseFunc(tag);
    const lcName = transformCaseFunc(attr);
    return _isValidAttribute(lcTag, lcName, value);
  };
  DOMPurify.addHook = function(entryPoint, hookFunction) {
    if (typeof hookFunction !== "function") {
      return;
    }
    arrayPush(hooks[entryPoint], hookFunction);
  };
  DOMPurify.removeHook = function(entryPoint, hookFunction) {
    if (hookFunction !== void 0) {
      const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
      return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
    }
    return arrayPop(hooks[entryPoint]);
  };
  DOMPurify.removeHooks = function(entryPoint) {
    hooks[entryPoint] = [];
  };
  DOMPurify.removeAllHooks = function() {
    hooks = _createHooksMap();
  };
  return DOMPurify;
}
var purify = createDOMPurify();

// src/WikiMarkdownPreview.tsx
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
import xml2 from "highlight.js/lib/languages/xml";
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
hljs.registerLanguage("html", xml2);
hljs.registerLanguage("xml", xml2);
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
  const raw = md.parse(content);
  return purify.sanitize(raw, {
    ADD_ATTR: ["data-wiki-link", "target"]
  });
}
function WikiMarkdownPreview({ content, pageNames, onNavigate, wikiStyle = "github" }) {
  injectWikiLinkStyle();
  const containerRef = useRef2(null);
  const html2 = useMemo(() => {
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
    dangerouslySetInnerHTML: { __html: html2 }
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
        style: { ...base, background: color.bgSuccess, color: color.textSuccess }
      }, "sleeping");
    case "running":
      return React3.createElement("span", {
        style: { ...base, background: color.bgWarning, color: color.textWarning }
      }, "running");
    case "error":
      return React3.createElement("span", {
        style: { ...base, background: color.bgErrorSubtle, color: color.textError }
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
          style: { padding: "4px 12px", fontSize: 12, background: color.accent, color: color.textOnAccent, border: "none", borderRadius: 6, cursor: "pointer", fontFamily: font.family },
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
      const text2 = await scoped.readFile(path);
      setContent(text2);
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
/*! Bundled license information:

dompurify/dist/purify.es.mjs:
  (*! @license DOMPurify 3.3.1 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.3.1/LICENSE *)
*/
