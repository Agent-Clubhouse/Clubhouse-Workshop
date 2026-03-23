# Changelog — @clubhouse/plugin-types v0.9

## v0.9.0 (2026-03-22)

### Added
- `PluginPermission: "companion"` — own a singleton companion agent with a persistent workspace (elevated)
- `PluginPermission: "mcp.tools"` — contribute custom tools to the Clubhouse MCP server (elevated)
- `PluginKind: "workspace"` — new plugin kind for companion agent plugins (requires API >= 0.9, app scope, companion permission)
- `PluginCompanionConfig` — manifest companion agent configuration (enabled, defaultModel, systemPrompt)
- `PluginManifest.companion` — companion agent configuration field
- `PluginMcpToolDefinition` — tool definition type (name, description, inputSchema)
- `PluginMcpToolResult` — tool handler result type (content array, isError flag)
- `McpAPI` — new sub-API for MCP tool contribution
- `McpAPI.contributeTools()` — register tools that other agents can call
- `McpAPI.removeTools()` — remove all contributed tools
- `McpAPI.listContributedTools()` — list contributed tool names
- `McpAPI.onToolCall()` — register handler for incoming tool calls
- `AgentsAPI.spawnCompanion()` — spawn or wake the plugin's companion agent
- `AgentsAPI.getCompanionStatus()` — check companion agent status (sleeping/waking/active/none)
- `AgentsAPI.getCompanionWorkspace()` — get companion workspace path
- `AgentKind: "companion"` — new agent kind for plugin-owned companion agents
- `PluginAPI.mcp` — MCP sub-API on the composite PluginAPI

### Changed
- `PluginKind` — added `"workspace"` variant
- `AgentKind` / `AgentInfo.kind` — added `"companion"` variant

### Migration from v0.8
- New APIs (`mcp`, companion methods on `agents`) are opt-in — no migration needed for existing plugins
- `companion` and `mcp.tools` permissions are new elevated permissions gated to API >= 0.9
- The `workspace` plugin kind requires `companion` permission and `app` scope
- `PluginCompanionConfig` on the manifest is optional — only workspace-kind plugins use it
- `AgentInfo.kind` may now be `"companion"` — handle it in status checks if you enumerate agents
- **Note**: v0.9 runtime is WIP — types are stable but `spawnCompanion()`, `mcp.contributeTools()`, and `workspace` lifecycle will throw "not yet implemented" until runtime support lands
