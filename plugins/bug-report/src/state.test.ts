import { describe, it, expect, vi } from "vitest";
import { createBugReportState } from "./state";

describe("createBugReportState", () => {
  it("initialises with null ghUsername", () => {
    const state = createBugReportState();
    expect(state.ghUsername).toBeNull();
  });

  it("initialises with null ghAuthed", () => {
    const state = createBugReportState();
    expect(state.ghAuthed).toBeNull();
  });

  it("initialises with my-reports view mode", () => {
    const state = createBugReportState();
    expect(state.viewMode).toBe("my-reports");
  });

  it("initialises with empty issues", () => {
    const state = createBugReportState();
    expect(state.issues).toEqual([]);
    expect(state.myIssues).toEqual([]);
  });

  it("initialises repoTarget as app", () => {
    const state = createBugReportState();
    expect(state.repoTarget).toBe("app");
  });

  it("initialises repoCache with empty entries for both targets", () => {
    const state = createBugReportState();
    expect(state.repoCache.app).toEqual({ issues: [], myIssues: [], page: 1, hasMore: false });
    expect(state.repoCache.plugins).toEqual({ issues: [], myIssues: [], page: 1, hasMore: false });
  });
});

describe("setGhUsername", () => {
  it("sets the username and notifies", () => {
    const state = createBugReportState();
    const listener = vi.fn();
    state.subscribe(listener);
    state.setGhUsername("testuser");
    expect(state.ghUsername).toBe("testuser");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("setGhAuthed", () => {
  it("sets the auth state and notifies", () => {
    const state = createBugReportState();
    const listener = vi.fn();
    state.subscribe(listener);
    state.setGhAuthed(true);
    expect(state.ghAuthed).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("setSelectedIssue", () => {
  it("sets selectedIssueNumber and clears creatingNew", () => {
    const state = createBugReportState();
    state.creatingNew = true;
    state.setSelectedIssue(42);
    expect(state.selectedIssueNumber).toBe(42);
    expect(state.creatingNew).toBe(false);
  });

  it("notifies listeners", () => {
    const state = createBugReportState();
    const listener = vi.fn();
    state.subscribe(listener);
    state.setSelectedIssue(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("sets to null", () => {
    const state = createBugReportState();
    state.setSelectedIssue(1);
    state.setSelectedIssue(null);
    expect(state.selectedIssueNumber).toBeNull();
  });
});

describe("setCreatingNew", () => {
  it("sets creatingNew and clears selectedIssue when true", () => {
    const state = createBugReportState();
    state.selectedIssueNumber = 5;
    state.setCreatingNew(true);
    expect(state.creatingNew).toBe(true);
    expect(state.selectedIssueNumber).toBeNull();
  });

  it("does not clear selectedIssue when false", () => {
    const state = createBugReportState();
    state.selectedIssueNumber = 5;
    state.setCreatingNew(false);
    expect(state.creatingNew).toBe(false);
    expect(state.selectedIssueNumber).toBe(5);
  });
});

describe("setIssues and setMyIssues", () => {
  const issue = {
    number: 1,
    title: "Test",
    state: "open",
    url: "",
    createdAt: "",
    updatedAt: "",
    author: { login: "user" },
    labels: [],
  };

  it("sets issues", () => {
    const state = createBugReportState();
    state.setIssues([issue]);
    expect(state.issues).toHaveLength(1);
  });

  it("sets myIssues", () => {
    const state = createBugReportState();
    state.setMyIssues([issue]);
    expect(state.myIssues).toHaveLength(1);
  });

  it("appends issues", () => {
    const state = createBugReportState();
    state.setIssues([issue]);
    state.appendIssues([{ ...issue, number: 2 }]);
    expect(state.issues).toHaveLength(2);
  });
});

describe("setViewMode", () => {
  it("switches view mode and resets page", () => {
    const state = createBugReportState();
    state.page = 3;
    state.setViewMode("all-recent");
    expect(state.viewMode).toBe("all-recent");
    expect(state.page).toBe(1);
  });

  it("triggers a refresh", () => {
    const state = createBugReportState();
    state.setViewMode("all-recent");
    expect(state.needsRefresh).toBe(true);
  });
});

describe("setSearchQuery", () => {
  it("updates search query", () => {
    const state = createBugReportState();
    state.setSearchQuery("login bug");
    expect(state.searchQuery).toBe("login bug");
  });
});

describe("requestRefresh", () => {
  it("sets needsRefresh and notifies", () => {
    const state = createBugReportState();
    const listener = vi.fn();
    state.subscribe(listener);
    state.requestRefresh();
    expect(state.needsRefresh).toBe(true);
    expect(listener).toHaveBeenCalled();
  });
});

describe("subscribe / unsubscribe", () => {
  it("adds and removes listeners", () => {
    const state = createBugReportState();
    const listener = vi.fn();
    const unsub = state.subscribe(listener);
    expect(state.listeners.size).toBe(1);
    unsub();
    expect(state.listeners.size).toBe(0);
  });

  it("listener receives notifications", () => {
    const state = createBugReportState();
    const listener = vi.fn();
    state.subscribe(listener);
    state.notify();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("setRepoTarget", () => {
  const issue = {
    number: 1,
    title: "Test",
    state: "open",
    url: "",
    createdAt: "",
    updatedAt: "",
    author: { login: "user" },
    labels: [],
  };

  it("switches repoTarget", () => {
    const state = createBugReportState();
    state.setRepoTarget("plugins");
    expect(state.repoTarget).toBe("plugins");
  });

  it("is a no-op when switching to the same target", () => {
    const state = createBugReportState();
    const listener = vi.fn();
    state.subscribe(listener);
    state.setRepoTarget("app");
    expect(listener).not.toHaveBeenCalled();
  });

  it("preserves current issues in cache when switching", () => {
    const state = createBugReportState();
    state.setIssues([issue]);
    state.setMyIssues([{ ...issue, number: 2 }]);
    state.page = 3;
    state.hasMore = true;

    state.setRepoTarget("plugins");

    // App cache should have the issues we set
    expect(state.repoCache.app.issues).toHaveLength(1);
    expect(state.repoCache.app.myIssues).toHaveLength(1);
    expect(state.repoCache.app.page).toBe(3);
    expect(state.repoCache.app.hasMore).toBe(true);
  });

  it("restores cached issues when switching back", () => {
    const state = createBugReportState();
    state.setIssues([issue]);

    // Switch to plugins (empty cache)
    state.setRepoTarget("plugins");
    expect(state.issues).toEqual([]);

    // Populate plugins with a different issue
    const pluginIssue = { ...issue, number: 99, title: "Plugin Bug" };
    state.setIssues([pluginIssue]);

    // Switch back to app — should restore the app issues
    state.setRepoTarget("app");
    expect(state.issues).toHaveLength(1);
    expect(state.issues[0].number).toBe(1);
  });

  it("clears selection when switching", () => {
    const state = createBugReportState();
    state.setSelectedIssue(42);
    state.setRepoTarget("plugins");
    expect(state.selectedIssueNumber).toBeNull();
    expect(state.creatingNew).toBe(false);
  });

  it("triggers refresh when cache is empty", () => {
    const state = createBugReportState();
    state.setRepoTarget("plugins");
    expect(state.needsRefresh).toBe(true);
  });

  it("does not trigger refresh when cache has data", () => {
    const state = createBugReportState();
    // Pre-populate plugins cache
    state.setRepoTarget("plugins");
    state.setIssues([issue]);
    state.needsRefresh = false;

    // Switch to app and back
    state.setRepoTarget("app");
    state.needsRefresh = false;
    state.setRepoTarget("plugins");
    expect(state.needsRefresh).toBe(false);
  });
});

describe("reset", () => {
  it("clears all state", () => {
    const state = createBugReportState();
    state.setGhUsername("user");
    state.setGhAuthed(true);
    state.setSelectedIssue(5);
    state.setIssues([{
      number: 1, title: "T", state: "open", url: "",
      createdAt: "", updatedAt: "", author: { login: "u" }, labels: [],
    }]);
    state.page = 3;
    state.hasMore = true;
    state.viewMode = "all-recent";
    state.searchQuery = "test";

    state.reset();

    expect(state.ghUsername).toBeNull();
    expect(state.ghAuthed).toBeNull();
    expect(state.selectedIssueNumber).toBeNull();
    expect(state.creatingNew).toBe(false);
    expect(state.issues).toEqual([]);
    expect(state.myIssues).toEqual([]);
    expect(state.page).toBe(1);
    expect(state.hasMore).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.needsRefresh).toBe(false);
    expect(state.viewMode).toBe("my-reports");
    expect(state.searchQuery).toBe("");
    expect(state.repoTarget).toBe("app");
    expect(state.repoCache.app).toEqual({ issues: [], myIssues: [], page: 1, hasMore: false });
    expect(state.repoCache.plugins).toEqual({ issues: [], myIssues: [], page: 1, hasMore: false });
  });

  it("clears listeners", () => {
    const state = createBugReportState();
    state.subscribe(vi.fn());
    state.reset();
    expect(state.listeners.size).toBe(0);
  });
});
