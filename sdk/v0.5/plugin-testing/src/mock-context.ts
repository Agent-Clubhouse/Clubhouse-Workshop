import type { PluginContext, PluginScope } from "@clubhouse/plugin-types";

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
export function createMockContext(options?: MockContextOptions): PluginContext {
  return {
    pluginId: options?.pluginId ?? "test-plugin",
    pluginPath: options?.pluginPath ?? "/tmp/plugins/test-plugin",
    projectId: options?.projectId ?? "test-project",
    projectPath: options?.projectPath ?? "/tmp/test-project",
    scope: options?.scope ?? "project",
    subscriptions: [],
    settings: options?.settings ?? {},
  };
}
