# Changelog — @clubhouse/plugin-types v0.6

## v0.6.0 (2026-02-23, updated 2026-02-24)

### Added

- **ThemeAPI** — New sub-API (`api.theme`) enabling plugins to read the current theme, subscribe to theme changes, and resolve individual color tokens
- **ThemeInfo** — Type representing the full theme snapshot (id, name, type, colors, hljs, terminal)
- **SoundsAPI** — New sub-API (`api.sounds`) enabling plugins to register, unregister, and list custom notification sound packs
- **PluginSoundPackDeclaration** — Manifest type for declaring a sound pack that ships with a plugin
- New permissions: `sounds`, `theme`
- `PluginContributes.sounds` — Declare a sound pack in the plugin manifest
- **AgentConfigAPI** — New sub-API (`api.agentConfig`) enabling plugins to inject skills, agent templates, instruction content, permission rules, and MCP server configurations into project agents
- **AgentConfigTargetOptions** — Options type for cross-project agent config operations
- New permissions: `agent-config`, `agent-config.cross-project`, `agent-config.permissions`, `agent-config.mcp`
- `CommandsAPI.registerWithHotkey()` — Register a command with a keyboard binding in a single call
- `CommandsAPI.getBinding()` — Get the current keyboard binding for a plugin command
- `CommandsAPI.clearBinding()` — Clear the keyboard binding for a plugin command
- `PluginCommandDeclaration.defaultBinding` — Optional default keyboard binding for manifest-declared commands
- `PluginCommandDeclaration.global` — Optional flag to allow hotkey to fire even in text inputs
- `NavigationAPI.popOutAgent()` — Open an agent in a pop-out window
- `NavigationAPI.toggleSidebar()` — Toggle the sidebar panel visibility
- `NavigationAPI.toggleAccessoryPanel()` — Toggle the accessory panel visibility
- **PluginOrchestratorInfo** — New interface describing orchestrator metadata (id, displayName, shortName, badge, capabilities)
- `AgentInfo.orchestrator` — Optional field identifying which orchestrator owns the agent
- `AgentInfo.freeAgentMode` — Optional field indicating if the agent runs with all permissions bypassed
- `AgentsAPI.listOrchestrators()` — List all available orchestrators
- `AgentsAPI.checkOrchestratorAvailability()` — Check if a specific orchestrator is available and configured
- New permission: `agents.free-agent-mode` (elevated, dangerous — spawns agents with all permissions bypassed)

### Changed

- `AgentsAPI.runQuick()` options expanded with `orchestrator?: string` and `freeAgentMode?: boolean`
- `AgentsAPI.getModelOptions()` now accepts an optional `orchestrator?: string` second parameter

### Removed

- Nothing removed

### Migration from v0.5

- All v0.5 code is fully compatible with v0.6 — no changes required
- To use the new `ThemeAPI`, add `theme` to your manifest permissions and access `api.theme.getCurrent()`, `api.theme.onDidChange()`, or `api.theme.getColor(token)`
- To use the new `SoundsAPI`, add `sounds` to your manifest permissions and access `api.sounds.*` methods. Optionally declare a `contributes.sounds` in your manifest.
- To use the new `AgentConfigAPI`, add the appropriate `agent-config` permission(s) to your manifest and access `api.agentConfig.*` methods
- To use keyboard bindings, either declare `defaultBinding` in your manifest commands or use `api.commands.registerWithHotkey()` at runtime
- New navigation methods (`popOutAgent`, `toggleSidebar`, `toggleAccessoryPanel`) require the `navigation` permission (same as before)
- To target a specific orchestrator when spawning agents, pass `orchestrator` in `runQuick()` options. Use `listOrchestrators()` to discover available orchestrators.
- The `agents.free-agent-mode` permission is elevated and dangerous — only request it if your plugin genuinely needs to bypass all agent permission checks
