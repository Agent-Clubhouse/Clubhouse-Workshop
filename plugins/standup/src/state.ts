// Shared state factory — coordinates SidebarPanel and MainPanel across React trees.

export interface StandupEntry {
  id: string;
  date: string;        // YYYY-MM-DD
  summary: string;     // first line preview
  output: string;      // full standup content
  projectName: string;
}

export interface StandupState {
  history: StandupEntry[];
  selectedId: string | null;
  generating: boolean;
  generatingDates: string[];  // dates currently being backfilled
  listeners: Set<() => void>;

  setHistory(entries: StandupEntry[]): void;
  setSelectedId(id: string | null): void;
  setGenerating(val: boolean): void;
  setGeneratingDates(dates: string[]): void;
  getSelected(): StandupEntry | null;
  subscribe(fn: () => void): () => void;
  notify(): void;
}

export function createStandupState(): StandupState {
  const state: StandupState = {
    history: [],
    selectedId: null,
    generating: false,
    generatingDates: [],
    listeners: new Set(),

    setHistory(entries: StandupEntry[]): void {
      state.history = entries;
      state.notify();
    },

    setSelectedId(id: string | null): void {
      state.selectedId = id;
      state.notify();
    },

    setGenerating(val: boolean): void {
      state.generating = val;
      state.notify();
    },

    setGeneratingDates(dates: string[]): void {
      state.generatingDates = dates;
      state.notify();
    },

    getSelected(): StandupEntry | null {
      if (!state.selectedId) return null;
      return state.history.find(e => e.id === state.selectedId) ?? null;
    },

    subscribe(fn: () => void): () => void {
      state.listeners.add(fn);
      return () => { state.listeners.delete(fn); };
    },

    notify(): void {
      for (const fn of state.listeners) fn();
    },
  };

  return state;
}
