# Changelog — @clubhouse/plugin-types v0.8

## v0.8.0 (2026-03-21)

### Added
- `CanvasAPI` — new sub-API for registering canvas widget types and querying active widgets
- `WindowAPI` — new sub-API for programmatic window/tab title management (`setTitle`, `resetTitle`, `getTitle`)
- `CanvasWidgetDescriptor` — descriptor for registering a canvas widget type with a React component
- `CanvasWidgetComponentProps` — props passed to canvas widget components (widgetId, api, metadata, size)
- `CanvasWidgetMetadata` — metadata record type for canvas widgets
- `CanvasWidgetHandle` — handle to a placed canvas widget instance
- `CanvasWidgetFilter` — filter criteria for querying canvas widgets
- `PluginCanvasWidgetDeclaration` — manifest declaration for canvas widget types (id, label, icon, defaultSize, metadataKeys)
- `PluginContributes.canvasWidgets` — array of canvas widget declarations in the manifest
- `PluginContributes.tab.title` — custom window/tab title override (defaults to label)
- `PluginContributes.railItem.title` — custom window/tab title override (defaults to label)
- `SessionTranscriptPage` — paginated transcript response type with messages, total count, and hasMore flag
- `SessionSummary` — AI-generated session summary with timestamp
- `AgentsAPI.listSessions()` — list active sessions for an agent
- `AgentsAPI.readSessionTranscript()` — read a page of transcript messages from an agent session
- `AgentsAPI.getSessionSummary()` — get an AI-generated summary of an agent session
- `PluginPermission: "canvas"` — permission for canvas widget registration and querying
- `PluginPermission: "annex"` — permission for remote control compatibility
- `PluginAPI.canvas` — canvas sub-API on the composite PluginAPI
- `PluginAPI.window` — window sub-API on the composite PluginAPI
- `AgentInfo.pluginMetadata` — plugin-supplied metadata attached at spawn time
- `CompletedQuickAgentInfo.pluginMetadata` — plugin-supplied metadata carried from the spawning agent
- `AgentsAPI.runQuick` — added `metadata` option to attach plugin metadata at spawn time
- `UIAPI.showApprovalDialog()` — rich approval dialog with title, summary, and multiple action buttons
- `ApprovalDialogAction` — action button descriptor for approval dialogs
- `ApprovalDialogOptions` — options for `showApprovalDialog`
- `AgentStatus: "waking"` — new agent lifecycle state
- `FilesAPI.dataDir` — readonly path to the plugin's stable data directory
- `FilesAPI.search()` — search for text across project files with regex, glob filters, and context
- `FileSearchResult`, `FileSearchFileResult`, `FileSearchMatch` — search result types
- `GitAPI.currentBranch(subPath?)` — added optional `subPath` parameter
- `AgentConfigAPI.contributeWrapperPreset()` — register a launch wrapper preset for the project

### Migration from v0.7
- New APIs (`canvas`, `window`) are opt-in — no migration needed for existing plugins
- `contributes.tab.title` and `contributes.railItem.title` are optional — existing manifests continue to work
- `canvasWidgets` manifest contribution is optional — add it only if your plugin provides canvas widgets
- If you use `AgentsAPI`, the new session methods (`listSessions`, `readSessionTranscript`, `getSessionSummary`) are additive
- The `canvas` and `annex` permissions are new — add them to your manifest only if needed
