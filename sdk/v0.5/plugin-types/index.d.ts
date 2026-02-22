// @clubhouse/plugin-types v0.5
// Type definitions for the Clubhouse plugin API.
//
// Source of truth: Clubhouse/src/shared/plugin-types.ts
// This is a type-only package — no runtime code.

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** A function that tears down a subscription or registration. */
export interface Disposable {
  dispose(): void;
}

/** Key-value storage scoped to a specific context. */
export interface ScopedStorage {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// File system types
// ---------------------------------------------------------------------------

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface FileStatInfo {
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  modifiedAt: number;
}

export interface FileEvent {
  type: "created" | "modified" | "deleted";
  path: string;
}

// ---------------------------------------------------------------------------
// Git types
// ---------------------------------------------------------------------------

export interface GitStatus {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  date: string;
}

// ---------------------------------------------------------------------------
// Project types
// ---------------------------------------------------------------------------

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
}

// ---------------------------------------------------------------------------
// Agent types
// ---------------------------------------------------------------------------

export type AgentKind = "durable" | "quick";
export type AgentStatus = "running" | "sleeping" | "error";

export interface AgentInfo {
  id: string;
  name: string;
  kind: AgentKind;
  status: AgentStatus;
  color: string;
  icon?: string;
  exitCode?: number;
  mission?: string;
  projectId: string;
  branch?: string;
  worktreePath?: string;
  model?: string;
  parentAgentId?: string;
}

export interface PluginAgentDetailedStatus {
  state: "idle" | "working" | "needs_permission" | "tool_error";
  message: string;
  toolName?: string;
}

export interface CompletedQuickAgentInfo {
  id: string;
  projectId: string;
  name: string;
  mission: string;
  summary: string | null;
  filesModified: string[];
  exitCode: number;
  completedAt: number;
  parentAgentId?: string;
}

export interface ModelOption {
  id: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Process types
// ---------------------------------------------------------------------------

export interface ProcessExecOptions {
  timeout?: number;
}

export interface ProcessExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

export type PluginScope = "project" | "app" | "dual";

export type PluginPermission =
  | "files"
  | "files.external"
  | "git"
  | "terminal"
  | "agents"
  | "notifications"
  | "storage"
  | "navigation"
  | "projects"
  | "commands"
  | "events"
  | "widgets"
  | "logging"
  | "process"
  | "badges"
  | "agent-config"
  | "agent-config.cross-project"
  | "agent-config.permissions"
  | "agent-config.mcp";

export interface PluginExternalRoot {
  settingKey: string;
  root: string;
}

export interface PluginCommandDeclaration {
  id: string;
  title: string;
}

export interface PluginSettingDeclaration {
  key: string;
  type: "boolean" | "string" | "number" | "select" | "directory";
  label: string;
  description?: string;
  default?: unknown;
  options?: Array<{ label: string; value: string }>;
}

export interface PluginStorageDeclaration {
  scope: "project" | "project-local" | "global";
}

export interface PluginHelpTopic {
  id: string;
  title: string;
  content: string;
}

export interface PluginHelpContribution {
  topics?: PluginHelpTopic[];
}

export interface PluginContributes {
  tab?: {
    label: string;
    icon?: string;
    layout?: "sidebar-content" | "full";
  };
  railItem?: {
    label: string;
    icon?: string;
    position?: "top" | "bottom";
  };
  commands?: PluginCommandDeclaration[];
  settings?: PluginSettingDeclaration[];
  storage?: PluginStorageDeclaration;
  help?: PluginHelpContribution;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  official?: boolean;
  engine: { api: number };
  scope: PluginScope;
  main?: string;
  contributes?: PluginContributes;
  settingsPanel?: "declarative" | "custom";
  permissions?: PluginPermission[];
  externalRoots?: PluginExternalRoot[];
  allowedCommands?: string[];
}

// ---------------------------------------------------------------------------
// Render mode for dual-scope plugins
// ---------------------------------------------------------------------------

export type PluginRenderMode = "project" | "app";

// ---------------------------------------------------------------------------
// Plugin context (per-activation)
// ---------------------------------------------------------------------------

export interface PluginContext {
  pluginId: string;
  pluginPath: string;
  scope: PluginScope;
  projectId?: string;
  projectPath?: string;
  subscriptions: Disposable[];
  settings: Record<string, unknown>;
}

export interface PluginContextInfo {
  mode: PluginRenderMode;
  projectId?: string;
  projectPath?: string;
}

// ---------------------------------------------------------------------------
// Sub-API interfaces
// ---------------------------------------------------------------------------

export interface LoggingAPI {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  fatal(msg: string, meta?: Record<string, unknown>): void;
}

export interface StorageAPI {
  /** Project-scoped, committed — .clubhouse/plugin-data/{pluginId}/ */
  project: ScopedStorage;
  /** Project-scoped, gitignored — .clubhouse/plugin-data-local/{pluginId}/ */
  projectLocal: ScopedStorage;
  /** Global (user home) — ~/.clubhouse/plugin-data/{pluginId}/ */
  global: ScopedStorage;
}

export interface FilesAPI {
  readTree(relativePath?: string, options?: { includeHidden?: boolean; depth?: number }): Promise<FileNode[]>;
  readFile(relativePath: string): Promise<string>;
  readBinary(relativePath: string): Promise<string>;
  writeFile(relativePath: string, content: string): Promise<void>;
  stat(relativePath: string): Promise<FileStatInfo>;
  rename(oldRelativePath: string, newRelativePath: string): Promise<void>;
  copy(srcRelativePath: string, destRelativePath: string): Promise<void>;
  mkdir(relativePath: string): Promise<void>;
  delete(relativePath: string): Promise<void>;
  showInFolder(relativePath: string): Promise<void>;
  /** Returns a FilesAPI scoped to an external root directory (requires files.external permission). */
  forRoot(rootName: string): FilesAPI;
}

export interface ProjectAPI {
  readFile(relativePath: string): Promise<string>;
  writeFile(relativePath: string, content: string): Promise<void>;
  deleteFile(relativePath: string): Promise<void>;
  fileExists(relativePath: string): Promise<boolean>;
  listDirectory(relativePath?: string): Promise<DirectoryEntry[]>;
  readonly projectPath: string;
  readonly projectId: string;
}

export interface ProjectsAPI {
  list(): ProjectInfo[];
  getActive(): ProjectInfo | null;
}

export interface GitAPI {
  status(): Promise<GitStatus[]>;
  log(limit?: number): Promise<GitCommit[]>;
  currentBranch(): Promise<string>;
  diff(filePath: string, staged?: boolean): Promise<string>;
}

export interface UIAPI {
  showNotice(message: string): void;
  showError(message: string): void;
  showConfirm(message: string): Promise<boolean>;
  showInput(prompt: string, defaultValue?: string): Promise<string | null>;
  openExternalUrl(url: string): Promise<void>;
}

export interface CommandsAPI {
  register(commandId: string, handler: (...args: unknown[]) => void | Promise<void>): Disposable;
  execute(commandId: string, ...args: unknown[]): Promise<void>;
}

export interface EventsAPI {
  on(event: string, handler: (...args: unknown[]) => void): Disposable;
}

export interface SettingsAPI {
  get<T = unknown>(key: string): T | undefined;
  getAll(): Record<string, unknown>;
  onChange(callback: (key: string, value: unknown) => void): Disposable;
}

export interface AgentsAPI {
  list(): AgentInfo[];
  runQuick(mission: string, options?: { model?: string; systemPrompt?: string; projectId?: string }): Promise<string>;
  kill(agentId: string): Promise<void>;
  resume(agentId: string, options?: { mission?: string }): Promise<void>;
  listCompleted(projectId?: string): CompletedQuickAgentInfo[];
  dismissCompleted(projectId: string, agentId: string): void;
  getDetailedStatus(agentId: string): PluginAgentDetailedStatus | null;
  getModelOptions(projectId?: string): Promise<ModelOption[]>;
  onStatusChange(callback: (agentId: string, status: string, prevStatus: string) => void): Disposable;
  /** Subscribe to any change in the agents store (status, detailed status, new/removed agents). */
  onAnyChange(callback: () => void): Disposable;
}

export interface HubAPI {
  refresh(): void;
}

export interface NavigationAPI {
  focusAgent(agentId: string): void;
  setExplorerTab(tabId: string): void;
}

export interface WidgetsAPI {
  AgentTerminal: React.ComponentType<{ agentId: string; focused?: boolean }>;
  SleepingAgent: React.ComponentType<{ agentId: string }>;
  AgentAvatar: React.ComponentType<{
    agentId: string;
    size?: "sm" | "md";
    showStatusRing?: boolean;
  }>;
  QuickAgentGhost: React.ComponentType<{
    completed: CompletedQuickAgentInfo;
    onDismiss: () => void;
    onDelete?: () => void;
  }>;
}

export interface TerminalAPI {
  /** Spawn an interactive shell in the given directory (defaults to project root). */
  spawn(sessionId: string, cwd?: string): Promise<void>;
  /** Write data to a terminal session. */
  write(sessionId: string, data: string): void;
  /** Resize a terminal session. */
  resize(sessionId: string, cols: number, rows: number): void;
  /** Kill a terminal session. */
  kill(sessionId: string): Promise<void>;
  /** Get buffered output for replay on reconnect. */
  getBuffer(sessionId: string): Promise<string>;
  /** Subscribe to terminal data output. */
  onData(sessionId: string, callback: (data: string) => void): Disposable;
  /** Subscribe to terminal exit events. */
  onExit(sessionId: string, callback: (exitCode: number) => void): Disposable;
  /** React component that renders an xterm.js terminal connected to a session. */
  ShellTerminal: React.ComponentType<{ sessionId: string; focused?: boolean }>;
}

export interface BadgesAPI {
  /** Set or update a badge. Key is unique within this plugin + target combo. */
  set(options: {
    key: string;
    type: "count" | "dot";
    value?: number;
    target: { tab: string } | { appPlugin: true };
  }): void;
  /** Clear a specific badge by key. */
  clear(key: string): void;
  /** Clear all badges set by this plugin. */
  clearAll(): void;
}

export interface ProcessAPI {
  exec(command: string, args: string[], options?: ProcessExecOptions): Promise<ProcessExecResult>;
}

// ---------------------------------------------------------------------------
// Composite PluginAPI
// ---------------------------------------------------------------------------

export interface PluginAPI {
  project: ProjectAPI;
  projects: ProjectsAPI;
  git: GitAPI;
  storage: StorageAPI;
  ui: UIAPI;
  commands: CommandsAPI;
  events: EventsAPI;
  settings: SettingsAPI;
  agents: AgentsAPI;
  hub: HubAPI;
  navigation: NavigationAPI;
  widgets: WidgetsAPI;
  terminal: TerminalAPI;
  logging: LoggingAPI;
  files: FilesAPI;
  process: ProcessAPI;
  badges: BadgesAPI;
  context: PluginContextInfo;
}

// ---------------------------------------------------------------------------
// Plugin module (what a plugin's main file exports)
// ---------------------------------------------------------------------------

export interface HubPanelProps {
  paneId: string;
  resourceId?: string;
}

/** Convenience type for the props received by panel components. */
export interface PanelProps {
  api: PluginAPI;
}

export interface PluginModule {
  activate?(ctx: PluginContext, api: PluginAPI): void | Promise<void>;
  deactivate?(): void | Promise<void>;
  MainPanel?: React.ComponentType<PanelProps>;
  SidebarPanel?: React.ComponentType<PanelProps>;
  HubPanel?: React.ComponentType<HubPanelProps>;
  SettingsPanel?: React.ComponentType<PanelProps>;
}
