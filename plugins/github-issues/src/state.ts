// Issue state factory — extracted for testability.

import type { IssueListItem } from "./helpers";

export type { IssueListItem } from "./helpers";

export interface IssueState {
  repoIdentity: string | null;
  selectedIssueNumber: number | null;
  creatingNew: boolean;
  issues: IssueListItem[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  needsRefresh: boolean;
  stateFilter: "open" | "closed";
  searchQuery: string;
  listeners: Set<() => void>;
  pendingAction: "assignAgent" | "toggleState" | "viewInBrowser" | null;

  setRepoIdentity(identity: string): void;
  setSelectedIssue(num: number | null): void;
  setCreatingNew(val: boolean): void;
  setIssues(issues: IssueListItem[]): void;
  appendIssues(issues: IssueListItem[]): void;
  setLoading(loading: boolean): void;
  setStateFilter(filter: "open" | "closed"): void;
  setSearchQuery(query: string): void;
  triggerAction(action: "assignAgent" | "toggleState" | "viewInBrowser"): void;
  consumeAction(): "assignAgent" | "toggleState" | "viewInBrowser" | null;
  requestRefresh(): void;
  subscribe(fn: () => void): () => void;
  notify(): void;
  reset(): void;
}

export function createIssueState(): IssueState {
  const state: IssueState = {
    repoIdentity: null,
    selectedIssueNumber: null,
    creatingNew: false,
    issues: [],
    page: 1,
    hasMore: false,
    loading: false,
    needsRefresh: false,
    stateFilter: "open",
    searchQuery: "",
    listeners: new Set(),
    pendingAction: null,

    setRepoIdentity(identity: string): void {
      if (state.repoIdentity !== identity) {
        const listeners = new Set(state.listeners);
        state.reset();
        state.listeners = listeners;
        state.repoIdentity = identity;
        state.notify();
      }
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
      state.notify();
    },

    appendIssues(issues: IssueListItem[]): void {
      state.issues = [...state.issues, ...issues];
      state.notify();
    },

    setLoading(loading: boolean): void {
      state.loading = loading;
      state.notify();
    },

    setStateFilter(filter: "open" | "closed"): void {
      state.stateFilter = filter;
      state.page = 1;
      state.issues = [];
      state.requestRefresh();
    },

    setSearchQuery(query: string): void {
      state.searchQuery = query;
      state.notify();
    },

    triggerAction(action: "assignAgent" | "toggleState" | "viewInBrowser"): void {
      if (state.selectedIssueNumber === null) return;
      state.pendingAction = action;
      state.notify();
    },

    consumeAction(): "assignAgent" | "toggleState" | "viewInBrowser" | null {
      const action = state.pendingAction;
      state.pendingAction = null;
      return action;
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
      state.repoIdentity = null;
      state.selectedIssueNumber = null;
      state.creatingNew = false;
      state.issues = [];
      state.page = 1;
      state.hasMore = false;
      state.loading = false;
      state.needsRefresh = false;
      state.pendingAction = null;
      state.stateFilter = "open";
      state.searchQuery = "";
      state.listeners.clear();
    },
  };

  return state;
}
