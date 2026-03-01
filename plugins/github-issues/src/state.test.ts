import { describe, it, expect, vi } from "vitest";
import { createIssueState } from "./state";

describe("createIssueState", () => {
  it("initialises with null repoIdentity", () => {
    const state = createIssueState();
    expect(state.repoIdentity).toBeNull();
  });
});

describe("setRepoIdentity", () => {
  it("sets repoIdentity on first call", () => {
    const state = createIssueState();
    state.setRepoIdentity("owner/repo-a");
    expect(state.repoIdentity).toBe("owner/repo-a");
  });

  it("does not reset state when identity is unchanged", () => {
    const state = createIssueState();
    state.setRepoIdentity("owner/repo-a");

    // Populate some cached state
    state.issues = [
      {
        number: 1,
        title: "Test",
        state: "open",
        url: "",
        createdAt: "",
        updatedAt: "",
        author: { login: "user" },
        labels: [],
      },
    ];
    state.page = 3;
    state.hasMore = true;
    state.selectedIssueNumber = 1;

    // Call again with the same identity
    state.setRepoIdentity("owner/repo-a");

    // State should be preserved
    expect(state.issues).toHaveLength(1);
    expect(state.page).toBe(3);
    expect(state.hasMore).toBe(true);
    expect(state.selectedIssueNumber).toBe(1);
  });

  it("resets cached data when identity changes", () => {
    const state = createIssueState();
    state.setRepoIdentity("owner/repo-a");

    // Populate cached state
    state.issues = [
      {
        number: 1,
        title: "Test",
        state: "open",
        url: "",
        createdAt: "",
        updatedAt: "",
        author: { login: "user" },
        labels: [],
      },
    ];
    state.page = 3;
    state.hasMore = true;
    state.selectedIssueNumber = 1;
    state.stateFilter = "closed";
    state.searchQuery = "bug";
    state.creatingNew = true;

    // Switch to a different repo
    state.setRepoIdentity("owner/repo-b");

    // All cached data should be cleared
    expect(state.repoIdentity).toBe("owner/repo-b");
    expect(state.issues).toEqual([]);
    expect(state.page).toBe(1);
    expect(state.hasMore).toBe(false);
    expect(state.selectedIssueNumber).toBeNull();
    expect(state.stateFilter).toBe("open");
    expect(state.searchQuery).toBe("");
    expect(state.creatingNew).toBe(false);
  });

  it("preserves listeners when identity changes", () => {
    const state = createIssueState();
    const listener = vi.fn();
    state.subscribe(listener);

    state.setRepoIdentity("owner/repo-a");
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    state.setRepoIdentity("owner/repo-b");
    // Listener should still be subscribed and called
    expect(listener).toHaveBeenCalled();
    expect(state.listeners.size).toBe(1);
  });

  it("notifies listeners on identity change", () => {
    const state = createIssueState();
    const listener = vi.fn();
    state.subscribe(listener);

    state.setRepoIdentity("owner/repo-a");
    expect(listener).toHaveBeenCalledTimes(1);

    state.setRepoIdentity("owner/repo-b");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not notify when identity is unchanged", () => {
    const state = createIssueState();
    state.setRepoIdentity("owner/repo-a");

    const listener = vi.fn();
    state.subscribe(listener);

    state.setRepoIdentity("owner/repo-a");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("reset", () => {
  it("clears repoIdentity", () => {
    const state = createIssueState();
    state.setRepoIdentity("owner/repo-a");
    expect(state.repoIdentity).toBe("owner/repo-a");

    state.reset();
    expect(state.repoIdentity).toBeNull();
  });

  it("clears all cached data", () => {
    const state = createIssueState();
    state.issues = [
      {
        number: 1,
        title: "Test",
        state: "open",
        url: "",
        createdAt: "",
        updatedAt: "",
        author: { login: "user" },
        labels: [],
      },
    ];
    state.page = 5;
    state.hasMore = true;
    state.selectedIssueNumber = 1;

    state.reset();

    expect(state.issues).toEqual([]);
    expect(state.page).toBe(1);
    expect(state.hasMore).toBe(false);
    expect(state.selectedIssueNumber).toBeNull();
  });
});
