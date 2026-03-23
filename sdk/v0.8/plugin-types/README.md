# @clubhouse/plugin-types v0.8

TypeScript type definitions for the Clubhouse plugin SDK.

## Installation

```bash
npm install @clubhouse/plugin-types@0.8.0
```

Or reference directly in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@clubhouse/plugin-types": ["./node_modules/@clubhouse/plugin-types"]
    }
  }
}
```

## What's new in v0.8

- **Canvas API** — `api.canvas.registerWidgetType()` and `api.canvas.queryWidgets()` for embedding plugin widgets on the canvas
- **Canvas widget declarations** — `contributes.canvasWidgets` in the manifest to declare widget types with size, icon, and metadata
- **Pinned widgets** — `pinnableToControls: true` on widget declarations and `pinnedComponent` on descriptors to render compact widgets in the canvas controls bar
- **Canvas permission** — new `"canvas"` permission required for canvas API access

See [CHANGELOG.md](./CHANGELOG.md) for the full list of changes and migration notes.

## Usage

```typescript
import type { PluginAPI, PluginContext, CanvasWidgetComponentProps, PinnedWidgetComponentProps } from "@clubhouse/plugin-types";

export function activate(ctx: PluginContext, api: PluginAPI) {
  ctx.subscriptions.push(
    api.canvas.registerWidgetType({
      id: "my-widget",
      component: MyCanvasWidget,
      pinnedComponent: MyPinnedWidget,
    })
  );
}
```

## License

MIT
