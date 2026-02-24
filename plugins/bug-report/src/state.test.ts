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
  });

  it("clears listeners", () => {
    const state = createBugReportState();
    state.subscribe(vi.fn());
    state.reset();
    expect(state.listeners.size).toBe(0);
  });
});
