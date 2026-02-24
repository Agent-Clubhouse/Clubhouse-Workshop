import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockAPI, createMockContext } from "@clubhouse/plugin-testing";
import type { PluginAPI, PluginContext } from "@clubhouse/plugin-types";

// Import the activate function, state, and auth helper
import { activate, deactivate, checkGhAuth, fetchIssues, fetchIssueDetail } from "./main";
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

describe("checkGhAuth", () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockAPI();
  });

  it("returns username when gh api user succeeds", async () => {
    (api.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: "testuser\n",
      stderr: "",
      exitCode: 0,
    });
    const result = await checkGhAuth(api);
    expect(result).toBe("testuser");
  });

  it("returns null when gh api user returns non-zero exit code and fallbacks fail", async () => {
    (api.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: "",
      stderr: "not authenticated",
      exitCode: 1,
    });
    const result = await checkGhAuth(api);
    expect(result).toBeNull();
  });

  it("falls back to gh auth status when gh api user fails", async () => {
    let callCount = 0;
    (api.process.exec as ReturnType<typeof vi.fn>).mockImplementation(
      async (cmd: string, args: string[]) => {
        callCount++;
        if (args[0] === "api") {
          // gh api user fails
          return { stdout: "", stderr: "error", exitCode: 1 };
        }
        if (args[0] === "auth") {
          // gh auth status succeeds
          return {
            stdout: "github.com\n  Logged in to github.com account octocat (keyring)\n",
            stderr: "",
            exitCode: 0,
          };
        }
        // gh issue list probe
        return { stdout: "", stderr: "", exitCode: 1 };
      },
    );
    const result = await checkGhAuth(api);
    expect(result).toBe("octocat");
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it("falls back to issue list probe when both api user and auth status fail", async () => {
    let callCount = 0;
    (api.process.exec as ReturnType<typeof vi.fn>).mockImplementation(
      async (cmd: string, args: string[]) => {
        callCount++;
        if (args[0] === "api" && callCount <= 2) {
          return { stdout: "", stderr: "error", exitCode: 1 };
        }
        if (args[0] === "auth") {
          return { stdout: "", stderr: "", exitCode: 1 };
        }
        if (args[0] === "issue") {
          return { stdout: '[{"number":1}]', stderr: "", exitCode: 0 };
        }
        // Second gh api user call (after issue probe succeeds)
        if (args[0] === "api") {
          return { stdout: "probeuser\n", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "", exitCode: 1 };
      },
    );
    const result = await checkGhAuth(api);
    expect(result).not.toBeNull();
  });

  it("returns null when process.exec throws", async () => {
    (api.process.exec as ReturnType<typeof vi.fn>).mockImplementation(
      async () => { throw new Error("sandbox error"); },
    );
    const result = await checkGhAuth(api);
    expect(result).toBeNull();
  });

  it("returns null when gh api user returns empty stdout", async () => {
    (api.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });
    const result = await checkGhAuth(api);
    // All three checks will get empty stdout with exitCode 0
    // gh api user: empty stdout → fail
    // gh auth status: no "Logged in" in output → fail
    // gh issue list: stdout doesn't start with "[" → fail
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchIssues — must handle empty/failed gh responses gracefully
// ---------------------------------------------------------------------------

describe("fetchIssues", () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockAPI();
  });

  it("returns items when gh succeeds with valid JSON", async () => {
    const issues = [
      { number: 1, title: "Bug", state: "OPEN", url: "", createdAt: "", updatedAt: "", author: { login: "u" }, labels: [] },
    ];
    (api.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: JSON.stringify(issues),
      stderr: "",
      exitCode: 0,
    });
    const result = await fetchIssues(api, 1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].number).toBe(1);
  });

  it("returns empty items when gh exits with non-zero code", async () => {
    (api.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: "",
      stderr: "error: not authenticated",
      exitCode: 1,
    });
    const result = await fetchIssues(api, 1);
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("returns empty items when gh returns empty stdout", async () => {
    (api.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });
    const result = await fetchIssues(api, 1);
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("returns empty items when gh returns invalid JSON", async () => {
    (api.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: "not json{",
      stderr: "",
      exitCode: 0,
    });
    const result = await fetchIssues(api, 1);
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("logs warning when gh fails", async () => {
    const warnSpy = vi.spyOn(api.logging, "warn");
    (api.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: "",
      stderr: "auth required",
      exitCode: 1,
    });
    await fetchIssues(api, 1);
    expect(warnSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// fetchIssueDetail — must handle empty/failed gh responses gracefully
// ---------------------------------------------------------------------------

describe("fetchIssueDetail", () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockAPI();
  });

  it("returns detail when gh succeeds", async () => {
    const detail = { number: 42, title: "Bug", state: "OPEN", body: "desc" };
    (api.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: JSON.stringify(detail),
      stderr: "",
      exitCode: 0,
    });
    const result = await fetchIssueDetail(api, 42);
    expect(result).not.toBeNull();
    expect(result!.number).toBe(42);
  });

  it("returns null when gh exits with non-zero code", async () => {
    (api.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: "",
      stderr: "not found",
      exitCode: 1,
    });
    const result = await fetchIssueDetail(api, 999);
    expect(result).toBeNull();
  });

  it("returns null when gh returns empty stdout", async () => {
    (api.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });
    const result = await fetchIssueDetail(api, 42);
    expect(result).toBeNull();
  });

  it("returns null when gh returns invalid JSON", async () => {
    (api.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: "truncated{",
      stderr: "",
      exitCode: 0,
    });
    const result = await fetchIssueDetail(api, 42);
    expect(result).toBeNull();
  });
});
