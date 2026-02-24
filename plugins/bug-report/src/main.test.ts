import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockAPI, createMockContext } from "@clubhouse/plugin-testing";
import type { PluginAPI, PluginContext } from "@clubhouse/plugin-types";

// Import the activate function and state
import { activate, deactivate } from "./main";
import { createBugReportState } from "./state";

describe("activate", () => {
  let api: PluginAPI;
  let ctx: PluginContext;

  beforeEach(() => {
    api = createMockAPI();
    ctx = createMockContext({ pluginId: "bug-report", scope: "app" });
  });

  it("registers commands on activation", () => {
    activate(ctx, api);
    // activate registers 3 commands, each pushes a disposable to subscriptions
    expect(ctx.subscriptions.length).toBeGreaterThanOrEqual(3);
  });

  it("does not throw during activation", () => {
    expect(() => activate(ctx, api)).not.toThrow();
  });

  it("registers exactly 3 subscriptions", () => {
    activate(ctx, api);
    expect(ctx.subscriptions).toHaveLength(3);
  });

  it("each subscription has a dispose method", () => {
    activate(ctx, api);
    for (const sub of ctx.subscriptions) {
      expect(sub).toHaveProperty("dispose");
    }
  });
});

describe("deactivate", () => {
  it("runs without error", () => {
    expect(() => deactivate()).not.toThrow();
  });
});

describe("bug report state integration", () => {
  it("state starts in my-reports view mode", () => {
    const state = createBugReportState();
    expect(state.viewMode).toBe("my-reports");
  });

  it("creating new clears selection", () => {
    const state = createBugReportState();
    state.setSelectedIssue(1);
    state.setCreatingNew(true);
    expect(state.selectedIssueNumber).toBeNull();
    expect(state.creatingNew).toBe(true);
  });

  it("selecting an issue clears creating state", () => {
    const state = createBugReportState();
    state.setCreatingNew(true);
    state.setSelectedIssue(42);
    expect(state.creatingNew).toBe(false);
    expect(state.selectedIssueNumber).toBe(42);
  });

  it("view mode switch triggers refresh", () => {
    const state = createBugReportState();
    state.setViewMode("all-recent");
    expect(state.needsRefresh).toBe(true);
    expect(state.viewMode).toBe("all-recent");
  });
});
