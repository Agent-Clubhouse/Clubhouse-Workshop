# @clubhouse/plugin-testing

Test utilities for Clubhouse plugins. Test your plugin without running the full Clubhouse app.

## Installation

```bash
npm install --save-dev @clubhouse/plugin-testing
```

## API

### `createMockAPI(overrides?)`

Returns a fully-stubbed `PluginAPI` where every method is a mock function. Storage sub-APIs are functional in-memory implementations by default.

```ts
import { createMockAPI } from "@clubhouse/plugin-testing";

const api = createMockAPI();
await api.storage.projectLocal.write("key", "value");
const val = await api.storage.projectLocal.read("key"); // "value"

// Override specific methods
const api2 = createMockAPI({
  git: { currentBranch: vi.fn().mockResolvedValue("feature-branch") },
});
```

### `createMockContext(options?)`

Returns a `PluginContext` with sensible defaults.

```ts
import { createMockContext } from "@clubhouse/plugin-testing";

const ctx = createMockContext({ pluginId: "my-plugin" });
activate(ctx, api);
expect(ctx.subscriptions).toHaveLength(1);
```

### `renderPlugin(module, options?)`

Activates a plugin module and prepares its `MainPanel` for rendering.

```ts
import { renderPlugin } from "@clubhouse/plugin-testing";
import { render } from "@testing-library/react";
import * as myPlugin from "../src/main";

const { element, api, cleanup } = await renderPlugin(myPlugin);
const { getByText } = render(element!);
expect(getByText("Hello")).toBeTruthy();
await cleanup();
```

### `createMockAgents(api, agents)`

Pre-populates a mock API's agents with test data.

```ts
import { createMockAPI, createMockAgents } from "@clubhouse/plugin-testing";

const api = createMockAPI();
createMockAgents(api, [
  { id: "a1", name: "Research", status: "running" },
  { id: "a2", name: "Review", status: "completed" },
]);

const agents = await api.agents.list(); // 2 agents
const agent = await api.agents.get("a1"); // { id: "a1", ... }
```

## Mock function compatibility

Mock functions automatically use `vi.fn()` (vitest) or `jest.fn()` if available. Otherwise a lightweight built-in mock is used that tracks calls and supports `mockResolvedValue`, `mockReturnValue`, and `mockImplementation`.

## License

MIT
