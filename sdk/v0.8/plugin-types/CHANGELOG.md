# Changelog — @clubhouse/plugin-types v0.8

## v0.8.0 (2026-03-23)

### Added
- `CanvasWidgetMetadata` — type alias for widget metadata key-value pairs
- `PluginCanvasWidgetDeclaration` — manifest declaration for canvas widget types (id, label, icon, defaultSize, metadataKeys, pinnableToControls)
- `CanvasWidgetComponentProps` — props for full canvas widget components (widgetId, api, metadata, onUpdateMetadata, size)
- `PinnedWidgetComponentProps` — props for compact pinned widget components ({ api })
- `CanvasWidgetDescriptor` — runtime registration descriptor (id, component, generateDisplayName, pinnedComponent)
- `CanvasWidgetFilter` — filter options for querying canvas widgets
- `CanvasWidgetHandle` — handle returned by widget queries (id, type, displayName, metadata)
- `CanvasAPI` — canvas sub-API with `registerWidgetType(descriptor)` and `queryWidgets(filter?)`
- `PluginContributes.canvasWidgets` — array of canvas widget declarations in the manifest
- `PluginAPI.canvas` — canvas API on the composite plugin API
- `"canvas"` permission — required for canvas API access

### Migration from v0.7
- No breaking changes — v0.8 is a superset of v0.7
- To use canvas features, add `"canvas"` to your manifest permissions and set `engine.api` to `0.8`
- Declare widgets in `contributes.canvasWidgets` and register them in `activate()` via `api.canvas.registerWidgetType()`
- For pinned widgets (in the controls bar), set `pinnableToControls: true` in the declaration and provide a `pinnedComponent` in the descriptor
