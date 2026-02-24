// Bug report state factory — extracted for testability.

import type { IssueListItem, RepoTarget } from "./helpers";

export type { IssueListItem } from "./helpers";
export type { RepoTarget } from "./helpers";

export type ViewMode = "my-reports" | "all-recent";

export interface RepoCacheEntry {
  issues: IssueListItem[];
  myIssues: IssueListItem[];
  page: number;
  hasMore: boolean;
}

export interface BugReportState {
  ghUsername: string | null;
  ghAuthed: boolean | null;
  selectedIssueNumber: number | null;
  creatingNew: boolean;
  issues: IssueListItem[];
  myIssues: IssueListItem[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  needsRefresh: boolean;
  viewMode: ViewMode;
  searchQuery: string;
  repoTarget: RepoTarget;
  repoCache: Record<RepoTarget, RepoCacheEntry>;
  listeners: Set<() => void>;

  setGhUsername(username: string): void;
  setGhAuthed(authed: boolean): void;
  setSelectedIssue(num: number | null): void;
  setCreatingNew(val: boolean): void;
  setIssues(issues: IssueListItem[]): void;
  setMyIssues(issues: IssueListItem[]): void;
  appendIssues(issues: IssueListItem[]): void;
  setLoading(loading: boolean): void;
  setViewMode(mode: ViewMode): void;
  setSearchQuery(query: string): void;
  setRepoTarget(target: RepoTarget): void;
  requestRefresh(): void;
  subscribe(fn: () => void): () => void;
  notify(): void;
  reset(): void;
}

function emptyCache(): RepoCacheEntry {
  return { issues: [], myIssues: [], page: 1, hasMore: false };
}

export function createBugReportState(): BugReportState {
  const state: BugReportState = {
    ghUsername: null,
    ghAuthed: null,
    selectedIssueNumber: null,
    creatingNew: false,
    issues: [],
    myIssues: [],
    page: 1,
    hasMore: false,
    loading: false,
    needsRefresh: false,
    viewMode: "my-reports",
    searchQuery: "",
    repoTarget: "app",
    repoCache: { app: emptyCache(), plugins: emptyCache() },
    listeners: new Set(),

    setGhUsername(username: string): void {
      state.ghUsername = username;
      state.notify();
    },

    setGhAuthed(authed: boolean): void {
      state.ghAuthed = authed;
      state.notify();
    },

    setSelectedIssue(num: number | null): void {
      state.selectedIssueNumber = num;
      state.creatingNew = false;
      state.notify();
    },

    setCreatingNew(val: boolean): void {
      state.creatingNew = val;
      if (val) state.selectedIssueNumber = null;
      state.notify();
    },

    setIssues(issues: IssueListItem[]): void {
      state.issues = issues;
      state.repoCache[state.repoTarget].issues = issues;
      state.notify();
    },

    setMyIssues(issues: IssueListItem[]): void {
      state.myIssues = issues;
      state.repoCache[state.repoTarget].myIssues = issues;
      state.notify();
    },

    appendIssues(issues: IssueListItem[]): void {
      state.issues = [...state.issues, ...issues];
      state.repoCache[state.repoTarget].issues = state.issues;
      state.notify();
    },

    setLoading(loading: boolean): void {
      state.loading = loading;
      state.notify();
    },

    setViewMode(mode: ViewMode): void {
      state.viewMode = mode;
      state.page = 1;
      state.requestRefresh();
    },

    setSearchQuery(query: string): void {
      state.searchQuery = query;
      state.notify();
    },

    setRepoTarget(target: RepoTarget): void {
      if (target === state.repoTarget) return;
      // Save current state to cache
      state.repoCache[state.repoTarget] = {
        issues: state.issues,
        myIssues: state.myIssues,
        page: state.page,
        hasMore: state.hasMore,
      };
      // Switch target
      state.repoTarget = target;
      // Restore from cache
      const cached = state.repoCache[target];
      state.issues = cached.issues;
      state.myIssues = cached.myIssues;
      state.page = cached.page;
      state.hasMore = cached.hasMore;
      // Clear selection
      state.selectedIssueNumber = null;
      state.creatingNew = false;
      // Trigger refresh if cache is empty
      if (cached.issues.length === 0 && cached.myIssues.length === 0) {
        state.requestRefresh();
      } else {
        state.notify();
      }
    },

    requestRefresh(): void {
      state.needsRefresh = true;
      state.notify();
    },

    subscribe(fn: () => void): () => void {
      state.listeners.add(fn);
      return () => {
        state.listeners.delete(fn);
      };
    },

    notify(): void {
      for (const fn of state.listeners) fn();
    },

    reset(): void {
      state.ghUsername = null;
      state.ghAuthed = null;
      state.selectedIssueNumber = null;
      state.creatingNew = false;
      state.issues = [];
      state.myIssues = [];
      state.page = 1;
      state.hasMore = false;
      state.loading = false;
      state.needsRefresh = false;
      state.viewMode = "my-reports";
      state.searchQuery = "";
      state.repoTarget = "app";
      state.repoCache = { app: emptyCache(), plugins: emptyCache() };
      state.listeners.clear();
    },
  };

  return state;
}
