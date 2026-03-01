import { describe, it, expect } from "vitest";
import { createMockAPI, createMockContext } from "@clubhouse/plugin-testing";
import { activate, deactivate } from "../src/main";

describe("activate", () => {
  it("registers commands and pushes subscriptions", () => {
    const api = createMockAPI();
    const ctx = createMockContext({ pluginId: "buddy-system" });

    activate(ctx, api);

    // Should register 2 commands (new-group, assign-work)
    expect(api.commands.register).toHaveBeenCalledTimes(2);
    expect(api.commands.register).toHaveBeenCalledWith(
      "buddy-system.new-group",
      expect.any(Function),
    );
    expect(api.commands.register).toHaveBeenCalledWith(
      "buddy-system.assign-work",
      expect.any(Function),
    );

    // Should push disposables to subscriptions (2 commands + monitor cleanup)
    expect(ctx.subscriptions.length).toBe(3);
  });

  it("logs activation message", () => {
    const api = createMockAPI();
    const ctx = createMockContext({ pluginId: "buddy-system" });

    activate(ctx, api);

    expect(api.logging.info).toHaveBeenCalledWith("Buddy System plugin activated");
  });
});

describe("deactivate", () => {
  it("runs without error", () => {
    expect(() => deactivate()).not.toThrow();
  });
});
