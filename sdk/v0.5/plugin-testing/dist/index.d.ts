import { PluginAPI, PluginScope, PluginContext, PluginModule, AgentInfo } from '@clubhouse/plugin-types';

type DeepPartial$1<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial$1<T[P]> : T[P];
};
/**
 * Creates a fully-stubbed `PluginAPI` where every method is a mock function.
 * Storage sub-APIs are functional in-memory implementations by default.
 *
 * Pass `overrides` to replace specific methods or values:
 *
 * ```ts
 * const api = createMockAPI({
 *   git: { currentBranch: vi.fn().mockResolvedValue("feature") },
 * });
 * ```
 */
declare function createMockAPI(overrides?: DeepPartial$1<PluginAPI>): PluginAPI;

interface MockContextOptions {
    pluginId?: string;
    pluginPath?: string;
    projectId?: string;
    projectPath?: string;
    scope?: PluginScope;
    settings?: Record<string, unknown>;
}
/**
 * Creates a `PluginContext` with sensible defaults for testing.
 *
 * ```ts
 * const ctx = createMockContext({ pluginId: "my-plugin" });
 * activate(ctx, api);
 * expect(ctx.subscriptions.length).toBeGreaterThan(0);
 * ```
 */
declare function createMockContext(options?: MockContextOptions): PluginContext;

interface RenderPluginOptions {
    pluginId?: string;
    projectId?: string;
    projectPath?: string;
    apiOverrides?: Parameters<typeof createMockAPI>[0];
}
interface RenderResult {
    api: PluginAPI;
    ctx: PluginContext;
    /**
     * The React element returned by MainPanel (if the module exports one).
     * Use with @testing-library/react's `render()` for DOM assertions.
     *
     * ```ts
     * import { render } from "@testing-library/react";
     * const { element } = renderPlugin(myModule);
     * const { getByText } = render(element!);
     * ```
     */
    element: React.ReactElement | null;
    /** Calls deactivate() and disposes all subscriptions. */
    cleanup: () => Promise<void>;
}
/**
 * Activates a plugin module and prepares its MainPanel for rendering.
 *
 * This does NOT mount the component into a DOM — it returns the React element
 * so you can pass it to your preferred testing library.
 *
 * ```ts
 * import { renderPlugin } from "@clubhouse/plugin-testing";
 * import * as myPlugin from "../src/main";
 *
 * const { element, api, cleanup } = await renderPlugin(myPlugin);
 * // ... assertions ...
 * await cleanup();
 * ```
 */
declare function renderPlugin(module: PluginModule, options?: RenderPluginOptions): Promise<RenderResult>;

type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
/**
 * Pre-populates a mock API's agents with test data.
 *
 * ```ts
 * const api = createMockAPI();
 * createMockAgents(api, [
 *   { id: "a1", name: "Research Agent", status: "running" },
 *   { id: "a2", name: "Review Agent", status: "sleeping" },
 * ]);
 * const agents = api.agents.list();
 * // agents.length === 2
 * ```
 */
declare function createMockAgents(api: PluginAPI, agents: DeepPartial<AgentInfo>[]): void;

export { createMockAPI, createMockAgents, createMockContext, renderPlugin };
