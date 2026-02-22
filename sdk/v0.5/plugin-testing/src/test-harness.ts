import type { PluginModule, PluginAPI, PluginContext, PanelProps } from "@clubhouse/plugin-types";
import { createMockAPI } from "./mock-api";
import { createMockContext } from "./mock-context";

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
export async function renderPlugin(
  module: PluginModule,
  options?: RenderPluginOptions,
): Promise<RenderResult> {
  const api = createMockAPI(options?.apiOverrides);
  const ctx = createMockContext({
    pluginId: options?.pluginId,
    projectId: options?.projectId,
    projectPath: options?.projectPath,
  });

  // Activate
  if (module.activate) {
    await module.activate(ctx, api);
  }

  // Render MainPanel if it exists — panels receive { api } only
  let element: React.ReactElement | null = null;
  if (module.MainPanel) {
    const Panel = module.MainPanel as React.FC<PanelProps>;
    element = Panel({ api }) as React.ReactElement;
  }

  // Cleanup function
  const cleanup = async () => {
    if (module.deactivate) {
      await module.deactivate();
    }
    for (const sub of ctx.subscriptions) {
      sub.dispose();
    }
  };

  return { api, ctx, element, cleanup };
}
