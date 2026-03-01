# Changelog — @clubhouse/plugin-types v0.7

## v0.7.0 (2026-02-28)

### Added
- `SoundEvent` — union type of the 9 recognised sound events (`agent-done`, `error`, `permission`, `permission-granted`, `permission-denied`, `agent-wake`, `agent-sleep`, `agent-focus`, `notification`)
- `SoundEventLabels` — mapped type providing human-readable labels for each sound event
- `SupportedAudioExtension` — union of accepted audio file extensions (`.mp3`, `.wav`, `.ogg`)
- `ALL_SOUND_EVENTS` — runtime constant array of all sound events
- `SOUND_EVENT_LABELS` — runtime constant mapping events to display labels
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
- `PluginSoundPackDeclaration.sounds` — narrowed from `Record<string, string>` to `Partial<Record<SoundEvent, string>>` for compile-time validation of sound event names
- `HubAPI` — `refresh()` method removed; interface reserved for future use

### Removed
- `HubAPI.refresh()` — removed

### Migration from v0.6
- If you use `HubAPI.refresh()`, remove it — the method no longer exists
- If you need file watching, add `'files.watch'` to your manifest permissions and use `api.files.watch()`
- New manifest contributions (`themes`, `agentConfig`, `globalDialog`) are opt-in — no migration needed
- `DialogPanel` export is optional — add it to expose a global dialog
- The `'creating'` agent status may appear in `AgentInfo.status` — handle it in status checks
- `PluginSoundPackDeclaration.sounds` is now `Partial<Record<SoundEvent, string>>` — if you used arbitrary string keys, update them to valid `SoundEvent` values
