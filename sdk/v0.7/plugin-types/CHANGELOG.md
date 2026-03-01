# Changelog — @clubhouse/plugin-types v0.7

## v0.7.0 (2026-02-28)

### Added
- `files.watch` permission — watch files and directories for changes
- `PluginKind` type — `'plugin' | 'pack'` for headless manifest-only plugins
- `PluginManifest.kind` field — declare plugin kind
- `ThemeColors` interface — structured UI color tokens
- `HljsColors` interface — structured syntax highlighting color tokens
- `TerminalColors` interface — structured terminal color tokens
- `PluginThemeDeclaration` — declare color themes that ship with a plugin
- `PluginAgentConfigDeclaration` — declare agent config to auto-inject via manifest
- `PluginGlobalDialogDeclaration` — declare a global dialog action with keybinding
- `PluginContributes.themes` — array of theme declarations
- `PluginContributes.agentConfig` — agent config declaration
- `PluginContributes.globalDialog` — global dialog declaration
- `PluginModule.DialogPanel` — React component for global dialog modal overlay
- `FilesAPI.watch()` — file watching with glob patterns (requires `files.watch` permission)
- `AgentStatus: 'creating'` — new agent lifecycle state

### Changed
- `HubAPI` — `refresh()` method removed; interface reserved for future use

### Removed
- `HubAPI.refresh()` — removed

### Migration from v0.6
- If you use `HubAPI.refresh()`, remove it — the method no longer exists
- If you need file watching, add `'files.watch'` to your manifest permissions and use `api.files.watch()`
- New manifest contributions (`themes`, `agentConfig`, `globalDialog`) are opt-in — no migration needed
- `DialogPanel` export is optional — add it to expose a global dialog
- The `'creating'` agent status may appear in `AgentInfo.status` — handle it in status checks
