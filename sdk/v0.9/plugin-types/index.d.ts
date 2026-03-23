/**
 * Clubhouse Plugin API — v0.9
 *
 * Type definitions for the Clubhouse plugin SDK.
 * Generated from the Clubhouse application source.
 *
 * @version 0.9
 * @see https://github.com/Agent-Clubhouse/Clubhouse-Workshop
 */

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

export type AgentKind = "durable" | "quick" | "companion";
export type AgentStatus = "running" | "sleeping" | "waking" | "creating" | "error";

export interface PluginOrchestratorInfo {
  id: string;
  displayName: string;
  shortName: string;
  badge?: string;
  capabilities: {
    headless: boolean;
    hooks: boolean;
    sessionResume: boolean;
    permissions: boolean;
  };
}

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
  orchestrator?: string;
  freeAgentMode?: boolean;
  /** Plugin-supplied metadata attached at spawn time. @since 0.8 */
  pluginMetadata?: Record<string, string>;
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
  /** Plugin-supplied metadata carried from the spawning agent. @since 0.8 */
  pluginMetadata?: Record<string, string>;
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
// Theme color types (v0.7+)
// ---------------------------------------------------------------------------

export interface ThemeColors {
  base: string;
  mantle: string;
  crust: string;
  text: string;
  subtext0: string;
  subtext1: string;
  surface0: string;
  surface1: string;
  surface2: string;
  accent: string;
  link: string;
  /** Semantic notification colors — WCAG AA compliant against base */
  warning: string;
  error: string;
  info: string;
  success: string;
}

export interface HljsColors {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  function: string;
  type: string;
  variable: string;
  regexp: string;
  tag: string;
  attribute: string;
  symbol: string;
  meta: string;
  addition: string;
  deletion: string;
  property: string;
  punctuation: string;
}

export interface TerminalColors {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

/** Font family overrides for different UI contexts. */
export interface ThemeFonts {
  /** Font family for the general UI (sidebar, headers, labels). */
  ui?: string;
  /** Monospace font family for code blocks, editors, and the terminal. */
  mono?: string;
}

/** Optional CSS gradient decorations layered on top of solid theme colors. */
export interface ThemeGradients {
  /** CSS gradient applied to the app background (e.g. `linear-gradient(135deg, #1a1a2e, #16213e)`). */
  background?: string;
  /** CSS gradient applied to panel/card surfaces. */
  surface?: string;
  /** CSS gradient applied to accent elements (buttons, highlights). */
  accent?: string;
}

// ---------------------------------------------------------------------------
// Sound types
// ---------------------------------------------------------------------------

/**
 * Sound events recognised by the Clubhouse application.
 *
 * Each event corresponds to a distinct moment in the UI that can trigger audio
 * feedback.  A sound pack maps one or more of these events to audio files.
 *
 * | Event                | Description             |
 * | -------------------- | ----------------------- |
 * | `agent-done`         | Agent finished its task  |
 * | `error`              | An error occurred        |
 * | `permission`         | Permission requested     |
 * | `permission-granted` | Permission was granted   |
 * | `permission-denied`  | Permission was denied    |
 * | `agent-wake`         | Agent woke up            |
 * | `agent-sleep`        | Agent went to sleep      |
 * | `agent-focus`        | Agent received focus     |
 * | `notification`       | General notification     |
 */
export type SoundEvent =
  | "agent-done"
  | "error"
  | "permission"
  | "permission-granted"
  | "permission-denied"
  | "agent-wake"
  | "agent-sleep"
  | "agent-focus"
  | "notification";

/** Human-readable labels for each {@link SoundEvent}. */
export type SoundEventLabels = {
  readonly [K in SoundEvent]: string;
};

/** Audio file formats accepted by the Clubhouse sound system. */
export type SupportedAudioExtension = ".mp3" | ".wav" | ".ogg";

/**
 * All recognised sound events as a constant array.
 *
 * Useful for iteration / validation at runtime:
 * ```ts
 * import { ALL_SOUND_EVENTS } from "@clubhouse/plugin-types";
 * for (const event of ALL_SOUND_EVENTS) { … }
 * ```
 */
export declare const ALL_SOUND_EVENTS: readonly SoundEvent[];

/**
 * Display labels for each sound event, e.g. `"agent-done"` → `"Agent Finished"`.
 */
export declare const SOUND_EVENT_LABELS: SoundEventLabels;

// ---------------------------------------------------------------------------
// Canvas types (v0.8+)
// ---------------------------------------------------------------------------

export interface CanvasWidgetDescriptor {
  id: string;
  component: React.ComponentType<CanvasWidgetComponentProps>;
  generateDisplayName?: (metadata: CanvasWidgetMetadata) => string;
}

export interface CanvasWidgetComponentProps {
  widgetId: string;
  api: PluginAPI;
  metadata: CanvasWidgetMetadata;
  onUpdateMetadata: (updates: CanvasWidgetMetadata) => void;
  size: { width: number; height: number };
}

export type CanvasWidgetMetadata = Record<string, string | number | boolean | null>;

export interface CanvasWidgetHandle {
  id: string;
  type: string;
  displayName: string;
  metadata: CanvasWidgetMetadata;
}

export interface CanvasWidgetFilter {
  type?: string;
  metadata?: CanvasWidgetMetadata;
  id?: string;
  displayName?: string;
}

// ---------------------------------------------------------------------------
// Session transcript types (v0.8+)
// ---------------------------------------------------------------------------

export interface SessionTranscriptPage {
  messages: Array<{ role: string; content: string; timestamp: string }>;
  total: number;
  hasMore: boolean;
}

export interface SessionSummary {
  summary: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

export type PluginScope = "project" | "app" | "dual";

/** Plugin kind: 'plugin' (default) has a main module; 'pack' is headless (no JS, manifest-only). */
/** Plugin kind: 'plugin' (default) has a main module; 'pack' is headless; 'workspace' owns a companion agent (v0.9+). */
export type PluginKind = "plugin" | "pack" | "workspace";

export type PluginPermission =
  | "files"
  | "files.external"
  | "files.watch"
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
  | "agents.free-agent-mode"
  | "agent-config.mcp"
  | "workspace"
  | "workspace.watch"
  | "workspace.cross-plugin"
  | "workspace.shared"
  | "workspace.cross-project"
  | "sounds"
  | "theme"
  | "canvas"
  | "annex"
  | "companion"
  | "mcp.tools";

export interface PluginExternalRoot {
  settingKey: string;
  root: string;
}

export interface PluginCommandDeclaration {
  id: string;
  title: string;
  /** Default keyboard binding (e.g. "Meta+Shift+L"). Only available in API >= 0.6. */
  defaultBinding?: string;
  /** When true, the hotkey fires even in text inputs. */
  global?: boolean;
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

export interface PluginSoundPackDeclaration {
  /** Display name for the sound pack. */
  name: string;
  /**
   * Mapping of {@link SoundEvent} names to audio file paths (relative to the
   * plugin directory).  Only the events you want to override need to be
   * provided; the rest fall back to the user's current pack or the defaults.
   *
   * Supported audio formats: `.mp3`, `.wav`, `.ogg`
   *
   * @example
   * ```json
   * {
   *   "agent-done": "sounds/done.mp3",
   *   "error": "sounds/error.wav",
   *   "notification": "sounds/ping.ogg"
   * }
   * ```
   */
  sounds: Partial<Record<SoundEvent, string>>;
}

/** Declare a color theme that ships with this plugin (v0.7+). */
export interface PluginThemeDeclaration {
  /** Unique theme ID (will be prefixed with `plugin:{pluginId}:` on registration). */
  id: string;
  /** Display name for the theme. */
  name: string;
  /** Whether this is a dark or light theme. */
  type: "dark" | "light";
  /** Core UI colors. */
  colors: ThemeColors;
  /** Syntax highlighting colors. */
  hljs: HljsColors;
  /** Terminal colors. */
  terminal: TerminalColors;
  /** Font family overrides. */
  fonts?: ThemeFonts;
  /** CSS gradient decorations layered on top of solid colors. */
  gradients?: ThemeGradients;
}

/** Declare agent configuration that is auto-injected on plugin registration (v0.7+). */
export interface PluginAgentConfigDeclaration {
  /** Skills to inject — mapping of skill name to markdown content. */
  skills?: Record<string, string>;
  /** MCP server configurations to inject. */
  mcpServers?: Record<string, unknown>;
  /** Agent templates to inject — mapping of template name to markdown content. */
  agentTemplates?: Record<string, string>;
}

/** Declare a global dialog action (v0.7+). */
export interface PluginGlobalDialogDeclaration {
  /** Display label for the dialog in command palette / menus. */
  label: string;
  /** SVG icon string or icon name. */
  icon?: string;
  /** Default keyboard binding (e.g. "Meta+Shift+B"). */
  defaultBinding?: string;
  /** Command ID to register for opening this dialog (auto-generated if not specified). */
  commandId?: string;
}

/** Declare a canvas widget type (v0.8+, requires canvas permission). */
export interface PluginCanvasWidgetDeclaration {
  id: string;
  label: string;
  icon?: string;
  defaultSize?: { width: number; height: number };
  metadataKeys?: string[];
}

export interface PluginContributes {
  tab?: {
    label: string;
    icon?: string;
    layout?: "sidebar-content" | "full";
    /** Custom window/tab title (v0.8+). Defaults to label. */
    title?: string;
  };
  railItem?: {
    label: string;
    icon?: string;
    position?: "top" | "bottom";
    /** Custom window/tab title (v0.8+). Defaults to label. */
    title?: string;
  };
  commands?: PluginCommandDeclaration[];
  settings?: PluginSettingDeclaration[];
  storage?: PluginStorageDeclaration;
  help?: PluginHelpContribution;
  /** Declare a sound pack that ships with this plugin. */
  sounds?: PluginSoundPackDeclaration;
  /** Declare color themes that ship with this plugin (v0.7+). */
  themes?: PluginThemeDeclaration[];
  /** Declare agent configuration to auto-inject (v0.7+). */
  agentConfig?: PluginAgentConfigDeclaration;
  /** Declare a global dialog action (v0.7+). */
  globalDialog?: PluginGlobalDialogDeclaration;
  /** Declare canvas widget types (v0.8+, requires canvas permission). */
  canvasWidgets?: PluginCanvasWidgetDeclaration[];
}

/** Companion agent configuration for workspace plugins (v0.9+). */
export interface PluginCompanionConfig {
  /** Whether this plugin owns a companion agent. */
  enabled: boolean;
  /** Default model for the companion agent. */
  defaultModel?: string;
  /** System prompt for the companion agent. */
  systemPrompt?: string;
}

/** MCP tool definition contributed by a plugin (v0.9+). */
export interface PluginMcpToolDefinition {
  /** Tool name suffix (will be prefixed with plugin namespace). */
  name: string;
  /** Human-readable description shown to agents. */
  description: string;
  /** JSON Schema for tool arguments. */
  inputSchema: Record<string, unknown>;
}

/** Result returned by a plugin MCP tool handler. */
export interface PluginMcpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  engine: { api: number };
  /** Plugin kind: 'plugin' (default), 'pack' (headless), or 'workspace' (companion agent, v0.9+). */
  kind?: PluginKind;
  scope: PluginScope;
  main?: string;
  contributes?: PluginContributes;
  settingsPanel?: "declarative" | "custom";
  permissions?: PluginPermission[];
  externalRoots?: PluginExternalRoot[];
  allowedCommands?: string[];
  /** Companion agent configuration (v0.9+, requires 'companion' permission). */
  companion?: PluginCompanionConfig;
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

export interface FileSearchMatch {
  line: number;
  column: number;
  length: number;
  lineContent: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface FileSearchFileResult {
  filePath: string;
  matches: FileSearchMatch[];
}

export interface FileSearchResult {
  results: FileSearchFileResult[];
  totalMatches: number;
  truncated: boolean;
}

export interface FilesAPI {
  /** Absolute path to this plugin's stable, per-plugin data directory. Auto-created before activate(). @since 0.8 */
  readonly dataDir: string;
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
  /**
   * Watch files matching a glob pattern for changes (v0.7+, requires files.watch permission).
   * Callback receives batched file events. Returns a Disposable to stop watching.
   */
  watch(glob: string, callback: (events: FileEvent[]) => void): Disposable;
  /**
   * Search for text across all files in the project directory. @since 0.8
   */
  search(query: string, options?: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    regex?: boolean;
    includeGlobs?: string[];
    excludeGlobs?: string[];
    maxResults?: number;
    contextLines?: number;
  }): Promise<FileSearchResult>;
}

/**
 * Managed filesystem for plugin coordination, sandboxed to
 * ~/.clubhouse/plugin-data/{pluginId}/workspace/.
 * Available to all scopes (app, project, dual). Gated by "workspace" permission.
 * The root directory is auto-created before activate() and cleaned up on uninstall.
 */
export interface WorkspaceAPI {
  /** Absolute filesystem path to this plugin's workspace directory. */
  readonly root: string;
  readFile(relativePath: string): Promise<string>;
  writeFile(relativePath: string, content: string): Promise<void>;
  mkdir(relativePath: string): Promise<void>;
  delete(relativePath: string): Promise<void>;
  stat(relativePath: string): Promise<FileStatInfo>;
  exists(relativePath: string): Promise<boolean>;
  listDir(relativePath?: string): Promise<DirectoryEntry[]>;
  readTree(relativePath?: string, opts?: { depth?: number }): Promise<FileNode[]>;
  /** Watch files matching a glob pattern for changes. Requires "workspace.watch" permission. */
  watch(glob: string, cb: (events: FileEvent[]) => void): Disposable;
  /**
   * Read-only access to another plugin's workspace.
   * Requires "workspace.cross-plugin" on caller and "workspace.shared" on target.
   */
  forPlugin(pluginId: string): WorkspaceReadonlyAPI;
  /**
   * Access workspace data scoped to another project.
   * Requires "workspace.cross-project" permission and bilateral consent
   * (target project must have the plugin enabled).
   */
  forProject(projectId: string): WorkspaceProjectAPI;
}

/** Read-only subset for cross-plugin workspace access. */
export interface WorkspaceReadonlyAPI {
  readonly root: string;
  readFile(relativePath: string): Promise<string>;
  stat(relativePath: string): Promise<FileStatInfo>;
  exists(relativePath: string): Promise<boolean>;
  listDir(relativePath?: string): Promise<DirectoryEntry[]>;
  watch(glob: string, cb: (events: FileEvent[]) => void): Disposable;
}

/** Workspace scoped to {projectPath}/.clubhouse/plugin-data/{pluginId}/. */
export interface WorkspaceProjectAPI {
  readonly projectPath: string;
  readonly projectId: string;
  readFile(relativePath: string): Promise<string>;
  writeFile(relativePath: string, content: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
  listDir(relativePath?: string): Promise<DirectoryEntry[]>;
  watch(glob: string, cb: (events: FileEvent[]) => void): Disposable;
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
  currentBranch(subPath?: string): Promise<string>;
  diff(filePath: string, staged?: boolean): Promise<string>;
}

/** A single action button in an approval dialog. @since 0.8 */
export interface ApprovalDialogAction {
  /** Value returned when this action is selected. */
  value: string;
  /** Button label shown in the dialog. */
  label: string;
  /** Visual style: 'primary' (accent), 'danger' (red), or 'default' (subtle). */
  style?: "primary" | "danger" | "default";
}

/** Options for showApprovalDialog. @since 0.8 */
export interface ApprovalDialogOptions {
  /** Dialog title (short, e.g. "Approve stage transition"). */
  title: string;
  /** Summary or context body (supports plain text). */
  summary: string;
  /** Action buttons. At least one required. First 'primary' or first action gets Enter key. */
  actions: ApprovalDialogAction[];
}

export interface UIAPI {
  showNotice(message: string): void;
  showError(message: string): void;
  showConfirm(message: string): Promise<boolean>;
  showInput(prompt: string, defaultValue?: string): Promise<string | null>;
  /**
   * Show a rich approval dialog with a title, summary, and multiple action buttons.
   * Returns the `value` of the selected action, or `null` if dismissed (overlay click / Escape).
   * @since 0.8
   */
  showApprovalDialog(options: ApprovalDialogOptions): Promise<string | null>;
  openExternalUrl(url: string): Promise<void>;
}

export interface CommandsAPI {
  register(commandId: string, handler: (...args: unknown[]) => void | Promise<void>): Disposable;
  execute(commandId: string, ...args: unknown[]): Promise<void>;
  /**
   * Register a command with a keyboard binding.
   * The binding follows the format "Meta+Shift+K".
   * On collision, the first claimer keeps the binding; later claims are unbound.
   * Returns a Disposable that unregisters both the command and its hotkey.
   */
  registerWithHotkey(
    commandId: string,
    title: string,
    handler: (...args: unknown[]) => void | Promise<void>,
    defaultBinding: string,
    options?: { global?: boolean },
  ): Disposable;
  /** Get the current keyboard binding for a plugin command (null if unbound). */
  getBinding(commandId: string): string | null;
  /** Clear the keyboard binding for a plugin command. */
  clearBinding(commandId: string): void;
}

export interface EventsAPI {
  on(event: string, handler: (...args: unknown[]) => void): Disposable;
}

export interface SettingsAPI {
  get<T = unknown>(key: string): T | undefined;
  getAll(): Record<string, unknown>;
  set(key: string, value: unknown): void;
  onChange(callback: (key: string, value: unknown) => void): Disposable;
}

export interface AgentsAPI {
  list(): AgentInfo[];
  runQuick(mission: string, options?: { model?: string; systemPrompt?: string; projectId?: string; orchestrator?: string; freeAgentMode?: boolean; metadata?: Record<string, string> }): Promise<string>;
  kill(agentId: string): Promise<void>;
  resume(agentId: string, options?: { mission?: string }): Promise<void>;
  listCompleted(projectId?: string): CompletedQuickAgentInfo[];
  dismissCompleted(projectId: string, agentId: string): void;
  getDetailedStatus(agentId: string): PluginAgentDetailedStatus | null;
  getModelOptions(projectId?: string, orchestrator?: string): Promise<ModelOption[]>;
  listOrchestrators(): PluginOrchestratorInfo[];
  checkOrchestratorAvailability(orchestratorId: string): Promise<{ available: boolean; error?: string }>;
  onStatusChange(callback: (agentId: string, status: string, prevStatus: string) => void): Disposable;
  /** Subscribe to any change in the agents store (status, detailed status, new/removed agents). */
  onAnyChange(callback: () => void): Disposable;
  /** List active sessions for an agent (v0.8+). */
  listSessions(agentId: string): Promise<Array<{ sessionId: string; startedAt: string; lastActiveAt: string; friendlyName?: string }>>;
  /** Read a page of transcript messages from an agent session (v0.8+). */
  readSessionTranscript(agentId: string, sessionId: string, offset: number, limit: number): Promise<SessionTranscriptPage | null>;
  /** Get an AI-generated summary of an agent session (v0.8+). */
  getSessionSummary(agentId: string, sessionId: string): Promise<SessionSummary | null>;
  /** Spawn or wake the plugin's companion agent. Returns the agent ID. Requires 'companion' permission. @since 0.9 */
  spawnCompanion(options?: { model?: string; systemPrompt?: string }): Promise<string>;
  /** Get the companion agent's current status. Requires 'companion' permission. @since 0.9 */
  getCompanionStatus(): Promise<"sleeping" | "waking" | "active" | "none">;
  /** Get the companion agent's workspace path. Requires 'companion' permission. @since 0.9 */
  getCompanionWorkspace(): Promise<string>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface HubAPI {
  // Reserved for future hub integration methods
}

export interface NavigationAPI {
  focusAgent(agentId: string): void;
  setExplorerTab(tabId: string): void;
  /** Open an agent in a pop-out window. */
  popOutAgent(agentId: string): Promise<void>;
  /** Toggle the sidebar panel visibility. */
  toggleSidebar(): void;
  /** Toggle the accessory panel visibility. */
  toggleAccessoryPanel(): void;
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
// Sounds API (v0.6+)
// ---------------------------------------------------------------------------

export interface SoundsAPI {
  /** Register a sound pack from this plugin. Uses the plugin's sounds/ directory. */
  registerPack(name?: string): Promise<void>;
  /** Unregister the sound pack from this plugin. */
  unregisterPack(): Promise<void>;
  /** List all available sound packs (user + plugin). */
  listPacks(): Promise<Array<{ id: string; name: string; source: "user" | "plugin" }>>;
}

// ---------------------------------------------------------------------------
// Theme API (v0.6+)
// ---------------------------------------------------------------------------

export interface ThemeInfo {
  id: string;
  name: string;
  type: "dark" | "light";
  colors: Record<string, string>;
  hljs: Record<string, string>;
  terminal: Record<string, string>;
  /** Font family overrides (v0.7+). */
  fonts?: ThemeFonts;
  /** CSS gradient decorations (v0.7+). */
  gradients?: ThemeGradients;
}

export interface ThemeAPI {
  /** Get the current theme ID and full color definition. */
  getCurrent(): ThemeInfo;
  /** Subscribe to theme changes (fires on user theme switch). Returns a Disposable. */
  onDidChange(callback: (theme: ThemeInfo) => void): Disposable;
  /** Get a single resolved CSS color value by token name (e.g. 'base', 'accent', 'hljs.keyword'). */
  getColor(token: string): string | null;
}

// ---------------------------------------------------------------------------
// Agent Config API (v0.6+)
// ---------------------------------------------------------------------------

/**
 * Options for cross-project agent config operations.
 * When `projectId` is specified, the operation targets that project instead of
 * the current project. Requires the 'agent-config.cross-project' permission,
 * and the target project must also have this plugin enabled (bilateral consent).
 */
export interface AgentConfigTargetOptions {
  projectId?: string;
}

export interface AgentConfigAPI {
  /**
   * Inject a skill definition for project agents.
   * When clubhouse mode is on, integrates with materialization.
   * When off, writes directly to the orchestrator's skills directory.
   * Pass `opts.projectId` to target a different project (requires 'agent-config.cross-project').
   */
  injectSkill(name: string, content: string, opts?: AgentConfigTargetOptions): Promise<void>;
  /** Remove a previously injected skill. */
  removeSkill(name: string, opts?: AgentConfigTargetOptions): Promise<void>;
  /** List skills injected by this plugin. */
  listInjectedSkills(opts?: AgentConfigTargetOptions): Promise<string[]>;
  /**
   * Inject an agent template definition for project agents.
   * When clubhouse mode is on, integrates with materialization.
   * When off, writes directly to the orchestrator's agent templates directory.
   * Pass `opts.projectId` to target a different project (requires 'agent-config.cross-project').
   */
  injectAgentTemplate(name: string, content: string, opts?: AgentConfigTargetOptions): Promise<void>;
  /** Remove a previously injected agent template. */
  removeAgentTemplate(name: string, opts?: AgentConfigTargetOptions): Promise<void>;
  /** List agent templates injected by this plugin. */
  listInjectedAgentTemplates(opts?: AgentConfigTargetOptions): Promise<string[]>;
  /**
   * Append content to the project instruction file.
   * Content is added at the end with a plugin attribution comment.
   * When clubhouse mode is on, integrates with materialization pipeline.
   * When off, appends directly to the instruction file.
   * Pass `opts.projectId` to target a different project (requires 'agent-config.cross-project').
   */
  appendInstructions(content: string, opts?: AgentConfigTargetOptions): Promise<void>;
  /** Remove previously appended instruction content from this plugin. */
  removeInstructionAppend(opts?: AgentConfigTargetOptions): Promise<void>;
  /** Get the content currently appended by this plugin (null if none). */
  getInstructionAppend(opts?: AgentConfigTargetOptions): Promise<string | null>;
  /**
   * Add permission allow rules for project agents.
   * Requires the elevated 'agent-config.permissions' permission.
   * Rules are namespaced per plugin and merged during materialization.
   * Pass `opts.projectId` to target a different project (requires 'agent-config.cross-project').
   */
  addPermissionAllowRules(rules: string[], opts?: AgentConfigTargetOptions): Promise<void>;
  /**
   * Add permission deny rules for project agents.
   * Requires the elevated 'agent-config.permissions' permission.
   * Pass `opts.projectId` to target a different project (requires 'agent-config.cross-project').
   */
  addPermissionDenyRules(rules: string[], opts?: AgentConfigTargetOptions): Promise<void>;
  /** Remove all permission rules injected by this plugin. */
  removePermissionRules(opts?: AgentConfigTargetOptions): Promise<void>;
  /** Get the permission rules currently injected by this plugin. */
  getPermissionRules(opts?: AgentConfigTargetOptions): Promise<{ allow: string[]; deny: string[] }>;
  /**
   * Inject MCP server configuration for project agents.
   * Requires the elevated 'agent-config.mcp' permission.
   * Configuration is merged into the agent's .mcp.json during materialization.
   * Pass `opts.projectId` to target a different project (requires 'agent-config.cross-project').
   */
  injectMcpServers(servers: Record<string, unknown>, opts?: AgentConfigTargetOptions): Promise<void>;
  /** Remove MCP server configurations injected by this plugin. */
  removeMcpServers(opts?: AgentConfigTargetOptions): Promise<void>;
  /** Get the MCP server configurations currently injected by this plugin. */
  getInjectedMcpServers(opts?: AgentConfigTargetOptions): Promise<Record<string, unknown>>;
  /**
   * Register a launch wrapper preset for the current project.
   * Writes the wrapper config and MCP catalog to project settings.
   * The preset becomes active immediately.
   * @since 0.8
   */
  contributeWrapperPreset(preset: {
    binary: string;
    separator: string;
    orchestratorMap: Record<string, { subcommand: string }>;
    env?: Record<string, string>;
    mcpCatalog: Array<{ id: string; name: string; description: string }>;
    defaultMcps?: string[];
  }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Window API (v0.8+)
// ---------------------------------------------------------------------------

export interface WindowAPI {
  setTitle(title: string): void;
  resetTitle(): void;
  getTitle(): string;
}

// ---------------------------------------------------------------------------
// Canvas API (v0.8+)
// ---------------------------------------------------------------------------

export interface CanvasAPI {
  registerWidgetType(descriptor: CanvasWidgetDescriptor): Disposable;
  queryWidgets(filter?: CanvasWidgetFilter): CanvasWidgetHandle[];
}

// ---------------------------------------------------------------------------
// MCP Tool Contribution API (v0.9+)
// ---------------------------------------------------------------------------

export interface McpAPI {
  /**
   * Register tools that other agents can call via the Clubhouse MCP.
   * Tools are namespaced per plugin: `plugin__<pluginId>__<toolName>`.
   * Requires 'mcp.tools' permission. @since 0.9
   */
  contributeTools(tools: PluginMcpToolDefinition[]): Promise<void>;
  /** Remove all tools contributed by this plugin. @since 0.9 */
  removeTools(): Promise<void>;
  /** List tools currently contributed by this plugin. @since 0.9 */
  listContributedTools(): Promise<string[]>;
  /**
   * Register a handler for incoming tool calls.
   * The handler receives the tool name (without namespace prefix) and arguments,
   * and must return a result. @since 0.9
   */
  onToolCall(handler: (toolName: string, args: Record<string, unknown>) => Promise<PluginMcpToolResult>): Disposable;
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
  agentConfig: AgentConfigAPI;
  workspace: WorkspaceAPI;
  sounds: SoundsAPI;
  theme: ThemeAPI;
  context: PluginContextInfo;
  canvas: CanvasAPI;
  window: WindowAPI;
  /** MCP tool contribution (v0.9+, requires 'mcp.tools' permission). */
  mcp: McpAPI;
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
  /** Global dialog panel rendered as a modal overlay (v0.7+). */
  DialogPanel?: React.ComponentType<{ api: PluginAPI; onClose: () => void }>;
}
