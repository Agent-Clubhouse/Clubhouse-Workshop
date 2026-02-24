// src/mock-api.ts
function createMockFn() {
  if (typeof globalThis !== "undefined") {
    const g = globalThis;
    if (g.vi && typeof g.vi.fn === "function") {
      return g.vi.fn();
    }
    if (g.jest && typeof g.jest.fn === "function") {
      return g.jest.fn();
    }
  }
  const calls = [];
  const fn = ((...args) => {
    calls.push(args);
    return fn._impl ? fn._impl(...args) : fn._returnValue;
  });
  fn.mock = { calls };
  fn.mockResolvedValue = (val) => {
    fn._impl = () => Promise.resolve(val);
    return fn;
  };
  fn.mockReturnValue = (val) => {
    fn._returnValue = val;
    return fn;
  };
  fn.mockImplementation = (impl) => {
    fn._impl = impl;
    return fn;
  };
  return fn;
}
var noop = { dispose: () => {
} };
var StubComponent = (() => null);
function createMockStorage() {
  const store = /* @__PURE__ */ new Map();
  return {
    read: async (key) => store.get(key),
    write: async (key, value) => {
      store.set(key, value);
    },
    delete: async (key) => {
      store.delete(key);
    },
    list: async () => [...store.keys()]
  };
}
function createMockLogging() {
  return {
    debug: createMockFn(),
    info: createMockFn(),
    warn: createMockFn(),
    error: createMockFn(),
    fatal: createMockFn()
  };
}
function createMockStorageAPI() {
  return {
    projectLocal: createMockStorage(),
    project: createMockStorage(),
    global: createMockStorage()
  };
}
function createMockFiles() {
  const filesApi = {
    readTree: createMockFn().mockResolvedValue([]),
    readFile: createMockFn().mockResolvedValue(""),
    readBinary: createMockFn().mockResolvedValue(""),
    writeFile: createMockFn().mockResolvedValue(void 0),
    stat: createMockFn().mockResolvedValue({ size: 0, isDirectory: false, isFile: true, modifiedAt: 0 }),
    rename: createMockFn().mockResolvedValue(void 0),
    copy: createMockFn().mockResolvedValue(void 0),
    mkdir: createMockFn().mockResolvedValue(void 0),
    delete: createMockFn().mockResolvedValue(void 0),
    showInFolder: createMockFn().mockResolvedValue(void 0),
    forRoot: createMockFn().mockReturnValue(null)
  };
  filesApi.forRoot.mockReturnValue(filesApi);
  return filesApi;
}
function createMockProject() {
  return {
    readFile: createMockFn().mockResolvedValue(""),
    writeFile: createMockFn().mockResolvedValue(void 0),
    deleteFile: createMockFn().mockResolvedValue(void 0),
    fileExists: createMockFn().mockResolvedValue(false),
    listDirectory: createMockFn().mockResolvedValue([]),
    projectPath: "/tmp/test-project",
    projectId: "test-project"
  };
}
function createMockProjects() {
  return {
    list: createMockFn().mockReturnValue([]),
    getActive: createMockFn().mockReturnValue(null)
  };
}
function createMockGit() {
  return {
    status: createMockFn().mockResolvedValue([]),
    log: createMockFn().mockResolvedValue([]),
    currentBranch: createMockFn().mockResolvedValue("main"),
    diff: createMockFn().mockResolvedValue("")
  };
}
function createMockAgents() {
  return {
    list: createMockFn().mockReturnValue([]),
    runQuick: createMockFn().mockResolvedValue("mock-agent-id"),
    kill: createMockFn().mockResolvedValue(void 0),
    resume: createMockFn().mockResolvedValue(void 0),
    listCompleted: createMockFn().mockReturnValue([]),
    dismissCompleted: createMockFn(),
    getDetailedStatus: createMockFn().mockReturnValue(null),
    getModelOptions: createMockFn().mockResolvedValue([]),
    onStatusChange: createMockFn().mockReturnValue(noop),
    onAnyChange: createMockFn().mockReturnValue(noop)
  };
}
function createMockUI() {
  return {
    showNotice: createMockFn(),
    showError: createMockFn(),
    showConfirm: createMockFn().mockResolvedValue(true),
    showInput: createMockFn().mockResolvedValue(null),
    openExternalUrl: createMockFn().mockResolvedValue(void 0)
  };
}
function createMockTerminal() {
  return {
    spawn: createMockFn().mockResolvedValue(void 0),
    write: createMockFn(),
    resize: createMockFn(),
    kill: createMockFn().mockResolvedValue(void 0),
    getBuffer: createMockFn().mockResolvedValue(""),
    onData: createMockFn().mockReturnValue(noop),
    onExit: createMockFn().mockReturnValue(noop),
    ShellTerminal: StubComponent
  };
}
function createMockProcess() {
  return {
    exec: createMockFn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 })
  };
}
function createMockCommands() {
  return {
    register: createMockFn().mockReturnValue(noop),
    execute: createMockFn().mockResolvedValue(void 0),
    registerWithHotkey: createMockFn().mockReturnValue(noop),
    getBinding: createMockFn().mockReturnValue(null),
    clearBinding: createMockFn()
  };
}
function createMockEvents() {
  return {
    on: createMockFn().mockReturnValue(noop)
  };
}
function createMockSettings() {
  return {
    get: createMockFn().mockReturnValue(void 0),
    getAll: createMockFn().mockReturnValue({}),
    onChange: createMockFn().mockReturnValue(noop)
  };
}
function createMockNavigation() {
  return {
    focusAgent: createMockFn(),
    setExplorerTab: createMockFn(),
    popOutAgent: createMockFn().mockResolvedValue(void 0),
    toggleSidebar: createMockFn(),
    toggleAccessoryPanel: createMockFn()
  };
}
function createMockWidgets() {
  return {
    AgentTerminal: StubComponent,
    SleepingAgent: StubComponent,
    AgentAvatar: StubComponent,
    QuickAgentGhost: StubComponent
  };
}
function createMockHub() {
  return {
    refresh: createMockFn()
  };
}
function createMockBadges() {
  return {
    set: createMockFn(),
    clear: createMockFn(),
    clearAll: createMockFn()
  };
}
function createMockAgentConfig() {
  return {
    injectSkill: createMockFn().mockResolvedValue(void 0),
    removeSkill: createMockFn().mockResolvedValue(void 0),
    listInjectedSkills: createMockFn().mockResolvedValue([]),
    injectAgentTemplate: createMockFn().mockResolvedValue(void 0),
    removeAgentTemplate: createMockFn().mockResolvedValue(void 0),
    listInjectedAgentTemplates: createMockFn().mockResolvedValue([]),
    appendInstructions: createMockFn().mockResolvedValue(void 0),
    removeInstructionAppend: createMockFn().mockResolvedValue(void 0),
    getInstructionAppend: createMockFn().mockResolvedValue(null),
    addPermissionAllowRules: createMockFn().mockResolvedValue(void 0),
    addPermissionDenyRules: createMockFn().mockResolvedValue(void 0),
    removePermissionRules: createMockFn().mockResolvedValue(void 0),
    getPermissionRules: createMockFn().mockResolvedValue({ allow: [], deny: [] }),
    injectMcpServers: createMockFn().mockResolvedValue(void 0),
    removeMcpServers: createMockFn().mockResolvedValue(void 0),
    getInjectedMcpServers: createMockFn().mockResolvedValue({})
  };
}
function createMockSounds() {
  return {
    registerPack: createMockFn().mockResolvedValue(void 0),
    unregisterPack: createMockFn().mockResolvedValue(void 0),
    listPacks: createMockFn().mockResolvedValue([])
  };
}
var DEFAULT_MOCK_THEME = {
  id: "catppuccin-mocha",
  name: "Catppuccin Mocha",
  type: "dark",
  colors: {
    base: "#1e1e2e",
    mantle: "#181825",
    crust: "#11111b",
    text: "#cdd6f4",
    subtext0: "#a6adc8",
    subtext1: "#bac2de",
    surface0: "#313244",
    surface1: "#45475a",
    surface2: "#585b70",
    accent: "#89b4fa",
    link: "#89b4fa",
    warning: "#f9e2af",
    error: "#f38ba8",
    info: "#89b4fa",
    success: "#a6e3a1"
  },
  hljs: {
    keyword: "#cba6f7",
    string: "#a6e3a1",
    number: "#fab387",
    comment: "#6c7086",
    function: "#89b4fa",
    type: "#f9e2af",
    variable: "#cdd6f4",
    regexp: "#f5c2e7",
    tag: "#89b4fa",
    attribute: "#89dceb",
    symbol: "#f2cdcd",
    meta: "#f5c2e7",
    addition: "#a6e3a1",
    deletion: "#f38ba8",
    property: "#89dceb",
    punctuation: "#bac2de"
  },
  terminal: {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    cursor: "#f5e0dc",
    cursorAccent: "#1e1e2e",
    selectionBackground: "#585b70",
    selectionForeground: "#cdd6f4",
    black: "#45475a",
    red: "#f38ba8",
    green: "#a6e3a1",
    yellow: "#f9e2af",
    blue: "#89b4fa",
    magenta: "#f5c2e7",
    cyan: "#94e2d5",
    white: "#bac2de",
    brightBlack: "#585b70",
    brightRed: "#f38ba8",
    brightGreen: "#a6e3a1",
    brightYellow: "#f9e2af",
    brightBlue: "#89b4fa",
    brightMagenta: "#f5c2e7",
    brightCyan: "#94e2d5",
    brightWhite: "#a6adc8"
  }
};
function createMockTheme() {
  return {
    getCurrent: createMockFn().mockReturnValue({ ...DEFAULT_MOCK_THEME }),
    onDidChange: createMockFn().mockReturnValue(noop),
    getColor: createMockFn().mockImplementation((token) => {
      const t = DEFAULT_MOCK_THEME;
      const tokenStr = String(token);
      if (tokenStr.startsWith("hljs.")) return t.hljs[tokenStr.slice(5)] ?? null;
      if (tokenStr.startsWith("terminal.")) return t.terminal[tokenStr.slice(9)] ?? null;
      return t.colors[tokenStr] ?? null;
    })
  };
}
function createMockContextInfo() {
  return {
    mode: "project",
    projectId: "test-project",
    projectPath: "/tmp/test-project"
  };
}
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (srcVal !== null && srcVal !== void 0 && typeof srcVal === "object" && !Array.isArray(srcVal) && typeof tgtVal === "object" && tgtVal !== null) {
      result[key] = deepMerge(
        tgtVal,
        srcVal
      );
    } else if (srcVal !== void 0) {
      result[key] = srcVal;
    }
  }
  return result;
}
function createMockAPI(overrides) {
  const base = {
    logging: createMockLogging(),
    storage: createMockStorageAPI(),
    files: createMockFiles(),
    project: createMockProject(),
    projects: createMockProjects(),
    git: createMockGit(),
    agents: createMockAgents(),
    terminal: createMockTerminal(),
    process: createMockProcess(),
    ui: createMockUI(),
    commands: createMockCommands(),
    events: createMockEvents(),
    settings: createMockSettings(),
    navigation: createMockNavigation(),
    widgets: createMockWidgets(),
    hub: createMockHub(),
    badges: createMockBadges(),
    agentConfig: createMockAgentConfig(),
    sounds: createMockSounds(),
    theme: createMockTheme(),
    context: createMockContextInfo()
  };
  if (overrides) {
    return deepMerge(base, overrides);
  }
  return base;
}

// src/mock-context.ts
function createMockContext(options) {
  return {
    pluginId: options?.pluginId ?? "test-plugin",
    pluginPath: options?.pluginPath ?? "/tmp/plugins/test-plugin",
    projectId: options?.projectId ?? "test-project",
    projectPath: options?.projectPath ?? "/tmp/test-project",
    scope: options?.scope ?? "project",
    subscriptions: [],
    settings: options?.settings ?? {}
  };
}

// src/test-harness.ts
async function renderPlugin(module, options) {
  const api = createMockAPI(options?.apiOverrides);
  const ctx = createMockContext({
    pluginId: options?.pluginId,
    projectId: options?.projectId,
    projectPath: options?.projectPath
  });
  if (module.activate) {
    await module.activate(ctx, api);
  }
  let element = null;
  if (module.MainPanel) {
    const Panel = module.MainPanel;
    element = Panel({ api });
  }
  const cleanup = async () => {
    if (module.deactivate) {
      await module.deactivate();
    }
    for (const sub of ctx.subscriptions) {
      sub.dispose();
    }
  };
  return { api, ctx, element, cleanup };
}

// src/mock-agents.ts
var defaults = {
  id: "agent-1",
  name: "Agent 1",
  kind: "durable",
  status: "running",
  color: "#4A9EFF",
  projectId: "test-project"
};
function createMockAgents2(api, agents) {
  const fullAgents = agents.map((partial, i) => ({
    ...defaults,
    id: `agent-${i + 1}`,
    name: `Agent ${i + 1}`,
    ...partial
  }));
  api.agents.list.mockReturnValue?.(fullAgents);
}
export {
  createMockAPI,
  createMockAgents2 as createMockAgents,
  createMockContext,
  renderPlugin
};
