import type {
  PluginAPI,
  LoggingAPI,
  StorageAPI,
  FilesAPI,
  GitAPI,
  AgentsAPI,
  TerminalAPI,
  ProcessAPI,
  UIAPI,
  CommandsAPI,
  EventsAPI,
  SettingsAPI,
  NavigationAPI,
  WidgetsAPI,
  ProjectAPI,
  ProjectsAPI,
  HubAPI,
  BadgesAPI,
  AgentConfigAPI,
  SoundsAPI,
  ThemeAPI,
  ThemeInfo,
  ScopedStorage,
  Disposable,
  PluginContextInfo,
} from "@clubhouse/plugin-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockFn = ((...args: unknown[]) => unknown) & {
  mock: { calls: unknown[][] };
  mockResolvedValue: (val: unknown) => MockFn;
  mockReturnValue: (val: unknown) => MockFn;
  mockImplementation: (fn: (...args: unknown[]) => unknown) => MockFn;
};

/**
 * Creates a mock function that tracks calls. Works without vitest or jest —
 * but if a global `vi` or `jest` object exists, it delegates to `vi.fn()` /
 * `jest.fn()` so assertions like `toHaveBeenCalled` work natively.
 */
function createMockFn(): MockFn {
  // Use vitest/jest mock if available
  if (typeof globalThis !== "undefined") {
    const g = globalThis as Record<string, unknown>;
    if (g.vi && typeof (g.vi as Record<string, unknown>).fn === "function") {
      return (g.vi as { fn: () => MockFn }).fn();
    }
    if (g.jest && typeof (g.jest as Record<string, unknown>).fn === "function") {
      return (g.jest as { fn: () => MockFn }).fn();
    }
  }

  // Fallback: lightweight mock
  const calls: unknown[][] = [];
  const fn = ((...args: unknown[]) => {
    calls.push(args);
    return fn._impl ? fn._impl(...args) : fn._returnValue;
  }) as MockFn & { _impl?: (...args: unknown[]) => unknown; _returnValue?: unknown };

  fn.mock = { calls };
  fn.mockResolvedValue = (val: unknown) => {
    fn._impl = () => Promise.resolve(val);
    return fn;
  };
  fn.mockReturnValue = (val: unknown) => {
    fn._returnValue = val;
    return fn;
  };
  fn.mockImplementation = (impl: (...args: unknown[]) => unknown) => {
    fn._impl = impl;
    return fn;
  };

  return fn;
}

const noop: Disposable = { dispose: () => {} };

/** Stub React component for widget/terminal mocks. */
const StubComponent = (() => null) as unknown as React.ComponentType<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Mock storage (functional in-memory implementation)
// ---------------------------------------------------------------------------

function createMockStorage(): ScopedStorage {
  const store = new Map<string, unknown>();
  return {
    read: async (key: string) => store.get(key),
    write: async (key: string, value: unknown) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    list: async () => [...store.keys()],
  };
}

// ---------------------------------------------------------------------------
// Sub-API factories
// ---------------------------------------------------------------------------

function createMockLogging(): LoggingAPI {
  return {
    debug: createMockFn() as LoggingAPI["debug"],
    info: createMockFn() as LoggingAPI["info"],
    warn: createMockFn() as LoggingAPI["warn"],
    error: createMockFn() as LoggingAPI["error"],
    fatal: createMockFn() as LoggingAPI["fatal"],
  };
}

function createMockStorageAPI(): StorageAPI {
  return {
    projectLocal: createMockStorage(),
    project: createMockStorage(),
    global: createMockStorage(),
  };
}

function createMockFiles(): FilesAPI {
  const filesApi: FilesAPI = {
    readTree: createMockFn().mockResolvedValue([]) as unknown as FilesAPI["readTree"],
    readFile: createMockFn().mockResolvedValue("") as unknown as FilesAPI["readFile"],
    readBinary: createMockFn().mockResolvedValue("") as unknown as FilesAPI["readBinary"],
    writeFile: createMockFn().mockResolvedValue(undefined) as unknown as FilesAPI["writeFile"],
    stat: createMockFn().mockResolvedValue({ size: 0, isDirectory: false, isFile: true, modifiedAt: 0 }) as unknown as FilesAPI["stat"],
    rename: createMockFn().mockResolvedValue(undefined) as unknown as FilesAPI["rename"],
    copy: createMockFn().mockResolvedValue(undefined) as unknown as FilesAPI["copy"],
    mkdir: createMockFn().mockResolvedValue(undefined) as unknown as FilesAPI["mkdir"],
    delete: createMockFn().mockResolvedValue(undefined) as unknown as FilesAPI["delete"],
    showInFolder: createMockFn().mockResolvedValue(undefined) as unknown as FilesAPI["showInFolder"],
    forRoot: createMockFn().mockReturnValue(null) as unknown as FilesAPI["forRoot"],
  };
  // forRoot returns another FilesAPI — wire it up to return itself by default
  (filesApi.forRoot as MockFn).mockReturnValue(filesApi);
  return filesApi;
}

function createMockProject(): ProjectAPI {
  return {
    readFile: createMockFn().mockResolvedValue("") as unknown as ProjectAPI["readFile"],
    writeFile: createMockFn().mockResolvedValue(undefined) as unknown as ProjectAPI["writeFile"],
    deleteFile: createMockFn().mockResolvedValue(undefined) as unknown as ProjectAPI["deleteFile"],
    fileExists: createMockFn().mockResolvedValue(false) as unknown as ProjectAPI["fileExists"],
    listDirectory: createMockFn().mockResolvedValue([]) as unknown as ProjectAPI["listDirectory"],
    projectPath: "/tmp/test-project",
    projectId: "test-project",
  };
}

function createMockProjects(): ProjectsAPI {
  return {
    list: createMockFn().mockReturnValue([]) as unknown as ProjectsAPI["list"],
    getActive: createMockFn().mockReturnValue(null) as unknown as ProjectsAPI["getActive"],
  };
}

function createMockGit(): GitAPI {
  return {
    status: createMockFn().mockResolvedValue([]) as unknown as GitAPI["status"],
    log: createMockFn().mockResolvedValue([]) as unknown as GitAPI["log"],
    currentBranch: createMockFn().mockResolvedValue("main") as unknown as GitAPI["currentBranch"],
    diff: createMockFn().mockResolvedValue("") as unknown as GitAPI["diff"],
  };
}

function createMockAgents(): AgentsAPI {
  return {
    list: createMockFn().mockReturnValue([]) as unknown as AgentsAPI["list"],
    runQuick: createMockFn().mockResolvedValue("mock-agent-id") as unknown as AgentsAPI["runQuick"],
    kill: createMockFn().mockResolvedValue(undefined) as unknown as AgentsAPI["kill"],
    resume: createMockFn().mockResolvedValue(undefined) as unknown as AgentsAPI["resume"],
    listCompleted: createMockFn().mockReturnValue([]) as unknown as AgentsAPI["listCompleted"],
    dismissCompleted: createMockFn() as unknown as AgentsAPI["dismissCompleted"],
    getDetailedStatus: createMockFn().mockReturnValue(null) as unknown as AgentsAPI["getDetailedStatus"],
    getModelOptions: createMockFn().mockResolvedValue([]) as unknown as AgentsAPI["getModelOptions"],
    listOrchestrators: createMockFn().mockReturnValue([]) as unknown as AgentsAPI["listOrchestrators"],
    checkOrchestratorAvailability: createMockFn().mockResolvedValue({ available: true }) as unknown as AgentsAPI["checkOrchestratorAvailability"],
    onStatusChange: createMockFn().mockReturnValue(noop) as unknown as AgentsAPI["onStatusChange"],
    onAnyChange: createMockFn().mockReturnValue(noop) as unknown as AgentsAPI["onAnyChange"],
  };
}

function createMockUI(): UIAPI {
  return {
    showNotice: createMockFn() as unknown as UIAPI["showNotice"],
    showError: createMockFn() as unknown as UIAPI["showError"],
    showConfirm: createMockFn().mockResolvedValue(true) as unknown as UIAPI["showConfirm"],
    showInput: createMockFn().mockResolvedValue(null) as unknown as UIAPI["showInput"],
    openExternalUrl: createMockFn().mockResolvedValue(undefined) as unknown as UIAPI["openExternalUrl"],
  };
}

function createMockTerminal(): TerminalAPI {
  return {
    spawn: createMockFn().mockResolvedValue(undefined) as unknown as TerminalAPI["spawn"],
    write: createMockFn() as unknown as TerminalAPI["write"],
    resize: createMockFn() as unknown as TerminalAPI["resize"],
    kill: createMockFn().mockResolvedValue(undefined) as unknown as TerminalAPI["kill"],
    getBuffer: createMockFn().mockResolvedValue("") as unknown as TerminalAPI["getBuffer"],
    onData: createMockFn().mockReturnValue(noop) as unknown as TerminalAPI["onData"],
    onExit: createMockFn().mockReturnValue(noop) as unknown as TerminalAPI["onExit"],
    ShellTerminal: StubComponent as TerminalAPI["ShellTerminal"],
  };
}

function createMockProcess(): ProcessAPI {
  return {
    exec: createMockFn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }) as unknown as ProcessAPI["exec"],
  };
}

function createMockCommands(): CommandsAPI {
  return {
    register: createMockFn().mockReturnValue(noop) as unknown as CommandsAPI["register"],
    execute: createMockFn().mockResolvedValue(undefined) as unknown as CommandsAPI["execute"],
    registerWithHotkey: createMockFn().mockReturnValue(noop) as unknown as CommandsAPI["registerWithHotkey"],
    getBinding: createMockFn().mockReturnValue(null) as unknown as CommandsAPI["getBinding"],
    clearBinding: createMockFn() as unknown as CommandsAPI["clearBinding"],
  };
}

function createMockEvents(): EventsAPI {
  return {
    on: createMockFn().mockReturnValue(noop) as unknown as EventsAPI["on"],
  };
}

function createMockSettings(): SettingsAPI {
  return {
    get: createMockFn().mockReturnValue(undefined) as unknown as SettingsAPI["get"],
    getAll: createMockFn().mockReturnValue({}) as unknown as SettingsAPI["getAll"],
    set: createMockFn() as unknown as SettingsAPI["set"],
    onChange: createMockFn().mockReturnValue(noop) as unknown as SettingsAPI["onChange"],
  };
}

function createMockNavigation(): NavigationAPI {
  return {
    focusAgent: createMockFn() as unknown as NavigationAPI["focusAgent"],
    setExplorerTab: createMockFn() as unknown as NavigationAPI["setExplorerTab"],
    popOutAgent: createMockFn().mockResolvedValue(undefined) as unknown as NavigationAPI["popOutAgent"],
    toggleSidebar: createMockFn() as unknown as NavigationAPI["toggleSidebar"],
    toggleAccessoryPanel: createMockFn() as unknown as NavigationAPI["toggleAccessoryPanel"],
  };
}

function createMockWidgets(): WidgetsAPI {
  return {
    AgentTerminal: StubComponent as WidgetsAPI["AgentTerminal"],
    SleepingAgent: StubComponent as WidgetsAPI["SleepingAgent"],
    AgentAvatar: StubComponent as WidgetsAPI["AgentAvatar"],
    QuickAgentGhost: StubComponent as WidgetsAPI["QuickAgentGhost"],
  };
}

function createMockHub(): HubAPI {
  return {
    refresh: createMockFn() as unknown as HubAPI["refresh"],
  };
}

function createMockBadges(): BadgesAPI {
  return {
    set: createMockFn() as unknown as BadgesAPI["set"],
    clear: createMockFn() as unknown as BadgesAPI["clear"],
    clearAll: createMockFn() as unknown as BadgesAPI["clearAll"],
  };
}

function createMockAgentConfig(): AgentConfigAPI {
  return {
    injectSkill: createMockFn().mockResolvedValue(undefined) as unknown as AgentConfigAPI["injectSkill"],
    removeSkill: createMockFn().mockResolvedValue(undefined) as unknown as AgentConfigAPI["removeSkill"],
    listInjectedSkills: createMockFn().mockResolvedValue([]) as unknown as AgentConfigAPI["listInjectedSkills"],
    injectAgentTemplate: createMockFn().mockResolvedValue(undefined) as unknown as AgentConfigAPI["injectAgentTemplate"],
    removeAgentTemplate: createMockFn().mockResolvedValue(undefined) as unknown as AgentConfigAPI["removeAgentTemplate"],
    listInjectedAgentTemplates: createMockFn().mockResolvedValue([]) as unknown as AgentConfigAPI["listInjectedAgentTemplates"],
    appendInstructions: createMockFn().mockResolvedValue(undefined) as unknown as AgentConfigAPI["appendInstructions"],
    removeInstructionAppend: createMockFn().mockResolvedValue(undefined) as unknown as AgentConfigAPI["removeInstructionAppend"],
    getInstructionAppend: createMockFn().mockResolvedValue(null) as unknown as AgentConfigAPI["getInstructionAppend"],
    addPermissionAllowRules: createMockFn().mockResolvedValue(undefined) as unknown as AgentConfigAPI["addPermissionAllowRules"],
    addPermissionDenyRules: createMockFn().mockResolvedValue(undefined) as unknown as AgentConfigAPI["addPermissionDenyRules"],
    removePermissionRules: createMockFn().mockResolvedValue(undefined) as unknown as AgentConfigAPI["removePermissionRules"],
    getPermissionRules: createMockFn().mockResolvedValue({ allow: [], deny: [] }) as unknown as AgentConfigAPI["getPermissionRules"],
    injectMcpServers: createMockFn().mockResolvedValue(undefined) as unknown as AgentConfigAPI["injectMcpServers"],
    removeMcpServers: createMockFn().mockResolvedValue(undefined) as unknown as AgentConfigAPI["removeMcpServers"],
    getInjectedMcpServers: createMockFn().mockResolvedValue({}) as unknown as AgentConfigAPI["getInjectedMcpServers"],
  };
}

function createMockSounds(): SoundsAPI {
  return {
    registerPack: createMockFn().mockResolvedValue(undefined) as unknown as SoundsAPI["registerPack"],
    unregisterPack: createMockFn().mockResolvedValue(undefined) as unknown as SoundsAPI["unregisterPack"],
    listPacks: createMockFn().mockResolvedValue([]) as unknown as SoundsAPI["listPacks"],
  };
}

const DEFAULT_MOCK_THEME: ThemeInfo = {
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
    success: "#a6e3a1",
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
    punctuation: "#bac2de",
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
    brightWhite: "#a6adc8",
  },
};

function createMockTheme(): ThemeAPI {
  return {
    getCurrent: createMockFn().mockReturnValue({ ...DEFAULT_MOCK_THEME }) as unknown as ThemeAPI["getCurrent"],
    onDidChange: createMockFn().mockReturnValue(noop) as unknown as ThemeAPI["onDidChange"],
    getColor: createMockFn().mockImplementation((token: unknown) => {
      const t = DEFAULT_MOCK_THEME;
      const tokenStr = String(token);
      if (tokenStr.startsWith("hljs.")) return (t.hljs as Record<string, string>)[tokenStr.slice(5)] ?? null;
      if (tokenStr.startsWith("terminal.")) return (t.terminal as Record<string, string>)[tokenStr.slice(9)] ?? null;
      return (t.colors as Record<string, string>)[tokenStr] ?? null;
    }) as unknown as ThemeAPI["getColor"],
  };
}

function createMockContextInfo(): PluginContextInfo {
  return {
    mode: "project",
    projectId: "test-project",
    projectPath: "/tmp/test-project",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function deepMerge<T extends Record<string, unknown>>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal !== null &&
      srcVal !== undefined &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal) &&
      typeof tgtVal === "object" &&
      tgtVal !== null
    ) {
      result[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as DeepPartial<Record<string, unknown>>
      ) as T[keyof T];
    } else if (srcVal !== undefined) {
      result[key] = srcVal as T[keyof T];
    }
  }
  return result;
}

/**
 * Creates a fully-stubbed `PluginAPI` where every method is a mock function.
 * Storage sub-APIs are functional in-memory implementations by default.
 *
 * Pass `overrides` to replace specific methods or values:
 *
 * ```ts
 * const api = createMockAPI({
 *   git: { currentBranch: vi.fn().mockResolvedValue("feature") },
 * });
 * ```
 */
export function createMockAPI(overrides?: DeepPartial<PluginAPI>): PluginAPI {
  const base: PluginAPI = {
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
    context: createMockContextInfo(),
  };

  if (overrides) {
    return deepMerge(base as unknown as Record<string, unknown>, overrides as DeepPartial<Record<string, unknown>>) as unknown as PluginAPI;
  }

  return base;
}
