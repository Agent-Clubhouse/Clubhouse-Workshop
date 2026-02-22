"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  createMockAPI: () => createMockAPI,
  createMockAgents: () => createMockAgents2,
  createMockContext: () => createMockContext2,
  renderPlugin: () => renderPlugin
});
module.exports = __toCommonJS(index_exports);

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
    execute: createMockFn().mockResolvedValue(void 0)
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
    setExplorerTab: createMockFn()
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
function createMockContext() {
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
    context: createMockContext()
  };
  if (overrides) {
    return deepMerge(base, overrides);
  }
  return base;
}

// src/mock-context.ts
function createMockContext2(options) {
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
async function renderPlugin(module2, options) {
  const api = createMockAPI(options?.apiOverrides);
  const ctx = createMockContext2({
    pluginId: options?.pluginId,
    projectId: options?.projectId,
    projectPath: options?.projectPath
  });
  if (module2.activate) {
    await module2.activate(ctx, api);
  }
  let element = null;
  if (module2.MainPanel) {
    const Panel = module2.MainPanel;
    element = Panel({ api });
  }
  const cleanup = async () => {
    if (module2.deactivate) {
      await module2.deactivate();
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createMockAPI,
  createMockAgents,
  createMockContext,
  renderPlugin
});
