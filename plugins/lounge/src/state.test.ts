import { describe, it, expect } from 'vitest';
import { createLoungeStore, groupAgentsByCategory, sortAgentsByOrder, disambiguateAgentName, DEFAULT_CIRCLE_ID, DEFAULT_CIRCLE_LABEL, isReservedCircleName, isDefaultCircle, isDuplicateCircleName, getPersistedState } from './state';
import type { LoungeCategory, LoungePersistedState } from './state';
import type { AgentInfo, ProjectInfo } from '@clubhouse/plugin-types';

/** Create a store that is already hydrated (mutations are unblocked). */
function createHydratedStore() {
  const store = createLoungeStore();
  store.setState({ hydrated: true });
  return store;
}

function makeAgent(overrides: Partial<AgentInfo> & { id: string; projectId: string }): AgentInfo {
  return {
    name: 'agent-1',
    kind: 'durable',
    status: 'running',
    color: 'blue',
    ...overrides,
  };
}

function makeProject(overrides: Partial<ProjectInfo> & { id: string }): ProjectInfo {
  return {
    name: overrides.id,
    path: `/projects/${overrides.id}`,
    ...overrides,
  };
}

describe('createLoungeStore', () => {
  it('initializes with General circle', () => {
    const store = createHydratedStore();
    const state = store.getState();
    expect(state.categories).toHaveLength(1);
    expect(state.categories[0]).toEqual({ id: DEFAULT_CIRCLE_ID, label: DEFAULT_CIRCLE_LABEL, emoji: '💬' });
    expect(state.collapsed.size).toBe(0);
    expect(state.selectedAgentId).toBeNull();
    expect(state.selectedProjectId).toBeNull();
  });

  describe('deriveCategories', () => {
    it('creates one category per project plus General', () => {
      const store = createHydratedStore();
      store.getState().deriveCategories([
        makeProject({ id: 'proj-1', name: 'Project One' }),
        makeProject({ id: 'proj-2', name: 'Project Two' }),
      ]);
      const { categories } = store.getState();
      expect(categories).toHaveLength(3);
      expect(categories[0]).toEqual({ id: 'project:proj-1', label: 'Project One', emoji: '📁', projectId: 'proj-1' });
      expect(categories[1]).toEqual({ id: 'project:proj-2', label: 'Project Two', emoji: '📁', projectId: 'proj-2' });
      expect(categories[2]).toEqual({ id: DEFAULT_CIRCLE_ID, label: DEFAULT_CIRCLE_LABEL, emoji: '💬' });
    });

    it('preserves collapsed state for surviving categories', () => {
      const store = createHydratedStore();
      store.getState().deriveCategories([
        makeProject({ id: 'proj-1' }),
        makeProject({ id: 'proj-2' }),
      ]);
      store.getState().toggleCollapsed('project:proj-1');
      expect(store.getState().collapsed.has('project:proj-1')).toBe(true);

      // Re-derive with proj-1 still present
      store.getState().deriveCategories([
        makeProject({ id: 'proj-1' }),
        makeProject({ id: 'proj-3' }),
      ]);
      expect(store.getState().collapsed.has('project:proj-1')).toBe(true);
      expect(store.getState().collapsed.has('project:proj-2')).toBe(false);
    });

    it('removes collapsed state for removed categories', () => {
      const store = createHydratedStore();
      store.getState().deriveCategories([makeProject({ id: 'proj-1' })]);
      store.getState().toggleCollapsed('project:proj-1');

      store.getState().deriveCategories([makeProject({ id: 'proj-2' })]);
      expect(store.getState().collapsed.has('project:proj-1')).toBe(false);
    });
  });

  describe('toggleCollapsed', () => {
    it('toggles a category collapsed state', () => {
      const store = createHydratedStore();
      store.getState().deriveCategories([makeProject({ id: 'proj-1' })]);

      store.getState().toggleCollapsed('project:proj-1');
      expect(store.getState().collapsed.has('project:proj-1')).toBe(true);

      store.getState().toggleCollapsed('project:proj-1');
      expect(store.getState().collapsed.has('project:proj-1')).toBe(false);
    });
  });

  describe('selectAgent', () => {
    it('sets selectedAgentId and selectedProjectId', () => {
      const store = createHydratedStore();
      store.getState().selectAgent('agent-1', 'proj-1');
      expect(store.getState().selectedAgentId).toBe('agent-1');
      expect(store.getState().selectedProjectId).toBe('proj-1');
    });

    it('clears selection when null', () => {
      const store = createHydratedStore();
      store.getState().selectAgent('agent-1', 'proj-1');
      store.getState().selectAgent(null);
      expect(store.getState().selectedAgentId).toBeNull();
      expect(store.getState().selectedProjectId).toBeNull();
    });
  });

  describe('renameCategory', () => {
    it('updates the category label', () => {
      const store = createHydratedStore();
      store.getState().deriveCategories([makeProject({ id: 'proj-1', name: 'Original' })]);
      store.getState().renameCategory('project:proj-1', 'Custom Name');
      expect(store.getState().categories[0].label).toBe('Custom Name');
    });

    it('persists renamed label across deriveCategories calls', () => {
      const store = createHydratedStore();
      store.getState().deriveCategories([makeProject({ id: 'proj-1', name: 'Original' })]);
      store.getState().renameCategory('project:proj-1', 'My Label');

      // Re-derive — renamed label should persist
      store.getState().deriveCategories([makeProject({ id: 'proj-1', name: 'Original' })]);
      expect(store.getState().categories[0].label).toBe('My Label');
    });

    it('stores the renamed label in renamedLabels', () => {
      const store = createHydratedStore();
      store.getState().deriveCategories([makeProject({ id: 'proj-1' })]);
      store.getState().renameCategory('project:proj-1', 'Renamed');
      expect(store.getState().renamedLabels['project:proj-1']).toBe('Renamed');
    });

    it('does not affect other categories', () => {
      const store = createHydratedStore();
      store.getState().deriveCategories([
        makeProject({ id: 'proj-1', name: 'One' }),
        makeProject({ id: 'proj-2', name: 'Two' }),
      ]);
      store.getState().renameCategory('project:proj-1', 'Renamed One');
      expect(store.getState().categories[0].label).toBe('Renamed One');
      expect(store.getState().categories[1].label).toBe('Two');
    });
  });

  describe('moveAgent', () => {
    it('adds an override for the agent', () => {
      const store = createHydratedStore();
      store.getState().moveAgent('agent-1', 'project:proj-2');
      expect(store.getState().agentCategoryOverrides['agent-1']).toBe('project:proj-2');
    });

    it('overwrites previous override', () => {
      const store = createHydratedStore();
      store.getState().moveAgent('agent-1', 'project:proj-2');
      store.getState().moveAgent('agent-1', 'project:proj-3');
      expect(store.getState().agentCategoryOverrides['agent-1']).toBe('project:proj-3');
    });

    it('does not affect other agents', () => {
      const store = createHydratedStore();
      store.getState().moveAgent('agent-1', 'project:proj-2');
      store.getState().moveAgent('agent-2', 'project:proj-3');
      expect(store.getState().agentCategoryOverrides['agent-1']).toBe('project:proj-2');
      expect(store.getState().agentCategoryOverrides['agent-2']).toBe('project:proj-3');
    });
  });
});

describe('groupAgentsByCategory', () => {
  it('groups agents into their project categories', () => {
    const categories: LoungeCategory[] = [
      { id: 'project:p1', label: 'P1', projectId: 'p1' },
      { id: 'project:p2', label: 'P2', projectId: 'p2' },
    ];
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1' }),
      makeAgent({ id: 'a2', projectId: 'p2' }),
      makeAgent({ id: 'a3', projectId: 'p1' }),
    ];

    const grouped = groupAgentsByCategory(agents, categories);
    expect(grouped.get('project:p1')).toHaveLength(2);
    expect(grouped.get('project:p2')).toHaveLength(1);
  });

  it('returns empty arrays for categories with no agents', () => {
    const categories: LoungeCategory[] = [
      { id: 'project:p1', label: 'P1', projectId: 'p1' },
    ];
    const grouped = groupAgentsByCategory([], categories);
    expect(grouped.get('project:p1')).toEqual([]);
  });

  it('falls unmatched agents into General when present', () => {
    const categories: LoungeCategory[] = [
      { id: 'project:p1', label: 'P1', projectId: 'p1' },
      { id: DEFAULT_CIRCLE_ID, label: DEFAULT_CIRCLE_LABEL },
    ];
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1' }),
      makeAgent({ id: 'a2', projectId: 'unknown' }),
    ];

    const grouped = groupAgentsByCategory(agents, categories);
    expect(grouped.get('project:p1')).toHaveLength(1);
    expect(grouped.get(DEFAULT_CIRCLE_ID)).toHaveLength(1);
  });

  it('drops unmatched agents when General is absent', () => {
    const categories: LoungeCategory[] = [
      { id: 'project:p1', label: 'P1', projectId: 'p1' },
    ];
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1' }),
      makeAgent({ id: 'a2', projectId: 'unknown' }),
    ];

    const grouped = groupAgentsByCategory(agents, categories);
    expect(grouped.get('project:p1')).toHaveLength(1);
  });

  it('respects overrides to move agent to a different category', () => {
    const categories: LoungeCategory[] = [
      { id: 'project:p1', label: 'P1', projectId: 'p1' },
      { id: 'project:p2', label: 'P2', projectId: 'p2' },
    ];
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1' }),
      makeAgent({ id: 'a2', projectId: 'p1' }),
    ];

    const overrides = { a2: 'project:p2' };
    const grouped = groupAgentsByCategory(agents, categories, overrides);
    expect(grouped.get('project:p1')).toHaveLength(1);
    expect(grouped.get('project:p2')).toHaveLength(1);
    expect(grouped.get('project:p2')![0].id).toBe('a2');
  });

  it('ignores overrides pointing to invalid categories', () => {
    const categories: LoungeCategory[] = [
      { id: 'project:p1', label: 'P1', projectId: 'p1' },
    ];
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1' }),
    ];

    const overrides = { a1: 'project:nonexistent' };
    const grouped = groupAgentsByCategory(agents, categories, overrides);
    // Falls back to project-based grouping
    expect(grouped.get('project:p1')).toHaveLength(1);
  });
});

describe('disambiguateAgentName', () => {
  it('returns plain name when unique', () => {
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1', name: 'alpha' }),
      makeAgent({ id: 'a2', projectId: 'p1', name: 'beta' }),
    ];
    const projects = [makeProject({ id: 'p1', name: 'MyProject' })];
    expect(disambiguateAgentName(agents[0], agents, projects)).toBe('alpha');
  });

  it('prepends project name when name is duplicated', () => {
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1', name: 'agent' }),
      makeAgent({ id: 'a2', projectId: 'p2', name: 'agent' }),
    ];
    const projects = [
      makeProject({ id: 'p1', name: 'Frontend' }),
      makeProject({ id: 'p2', name: 'Backend' }),
    ];

    expect(disambiguateAgentName(agents[0], agents, projects)).toBe('Frontend/agent');
    expect(disambiguateAgentName(agents[1], agents, projects)).toBe('Backend/agent');
  });

  it('falls back to projectId when project not found', () => {
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1', name: 'agent' }),
      makeAgent({ id: 'a2', projectId: 'p2', name: 'agent' }),
    ];
    expect(disambiguateAgentName(agents[0], agents, [])).toBe('p1/agent');
  });
});

describe('default circle (General)', () => {
  it('isDefaultCircle returns true for the default circle ID', () => {
    expect(isDefaultCircle(DEFAULT_CIRCLE_ID)).toBe(true);
    expect(isDefaultCircle('project:p1')).toBe(false);
    expect(isDefaultCircle('circle:1')).toBe(false);
  });

  it('renameCategory is a no-op on the default circle', () => {
    const store = createHydratedStore();
    store.getState().renameCategory(DEFAULT_CIRCLE_ID, 'Hacked');
    const general = store.getState().categories.find((c) => c.id === DEFAULT_CIRCLE_ID);
    expect(general!.label).toBe(DEFAULT_CIRCLE_LABEL);
  });

  it('renameCategory rejects reserved names on other circles', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'proj-1', name: 'MyProject' })]);
    store.getState().renameCategory('project:proj-1', 'General');
    expect(store.getState().categories[0].label).toBe('MyProject');
    // case-insensitive
    store.getState().renameCategory('project:proj-1', 'GENERAL');
    expect(store.getState().categories[0].label).toBe('MyProject');
  });

  it('General is always last after deriveCategories', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([
      makeProject({ id: 'proj-1' }),
      makeProject({ id: 'proj-2' }),
    ]);
    const cats = store.getState().categories;
    expect(cats[cats.length - 1].id).toBe(DEFAULT_CIRCLE_ID);
  });

  it('agents with no matching category fall into General', () => {
    const categories: LoungeCategory[] = [
      { id: 'project:p1', label: 'P1', projectId: 'p1' },
      { id: DEFAULT_CIRCLE_ID, label: DEFAULT_CIRCLE_LABEL },
    ];
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1' }),
      makeAgent({ id: 'a2', projectId: 'unknown-project' }),
    ];

    const grouped = groupAgentsByCategory(agents, categories);
    expect(grouped.get('project:p1')).toHaveLength(1);
    expect(grouped.get(DEFAULT_CIRCLE_ID)).toHaveLength(1);
    expect(grouped.get(DEFAULT_CIRCLE_ID)![0].id).toBe('a2');
  });
});

describe('isReservedCircleName', () => {
  it('matches "general" case-insensitively', () => {
    expect(isReservedCircleName('general')).toBe(true);
    expect(isReservedCircleName('General')).toBe(true);
    expect(isReservedCircleName('GENERAL')).toBe(true);
    expect(isReservedCircleName(' General ')).toBe(true);
  });

  it('does not match non-reserved names', () => {
    expect(isReservedCircleName('My Circle')).toBe(false);
    expect(isReservedCircleName('generals')).toBe(false);
  });
});

describe('addCircle', () => {
  it('adds a custom circle and returns its ID', () => {
    const store = createHydratedStore();
    const id = store.getState().addCircle('My Circle');
    expect(id).toBe('circle:1');
    expect(store.getState().customCircles).toHaveLength(1);
    expect(store.getState().customCircles[0]).toEqual({ id: 'circle:1', label: 'My Circle', emoji: '⭐' });
  });

  it('inserts custom circle before General in categories', () => {
    const store = createHydratedStore();
    store.getState().addCircle('Team Chat');
    const cats = store.getState().categories;
    expect(cats[cats.length - 1].id).toBe(DEFAULT_CIRCLE_ID);
    expect(cats[cats.length - 2].label).toBe('Team Chat');
  });

  it('increments nextCircleId', () => {
    const store = createHydratedStore();
    store.getState().addCircle('A');
    store.getState().addCircle('B');
    expect(store.getState().nextCircleId).toBe(3);
    expect(store.getState().customCircles).toHaveLength(2);
  });

  it('rejects reserved names and returns empty string', () => {
    const store = createHydratedStore();
    const id = store.getState().addCircle('General');
    expect(id).toBe('');
    expect(store.getState().customCircles).toHaveLength(0);
  });

  it('preserves custom circles across deriveCategories', () => {
    const store = createHydratedStore();
    store.getState().addCircle('Favorites');
    store.getState().deriveCategories([makeProject({ id: 'proj-1' })]);

    const cats = store.getState().categories;
    expect(cats.find((c) => c.label === 'Favorites')).toBeDefined();
    expect(cats[cats.length - 1].id).toBe(DEFAULT_CIRCLE_ID);
  });

  it('agents can be moved to custom circles', () => {
    const store = createHydratedStore();
    const circleId = store.getState().addCircle('VIPs');
    store.getState().deriveCategories([makeProject({ id: 'p1' })]);

    const categories = store.getState().categories;
    const agents = [makeAgent({ id: 'a1', projectId: 'p1' })];
    const overrides = { a1: circleId };

    const grouped = groupAgentsByCategory(agents, categories, overrides);
    expect(grouped.get(circleId)).toHaveLength(1);
    expect(grouped.get('project:p1')).toHaveLength(0);
  });
});

describe('reorderCategory', () => {
  it('moves a category before the target', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([
      makeProject({ id: 'p1', name: 'P1' }),
      makeProject({ id: 'p2', name: 'P2' }),
      makeProject({ id: 'p3', name: 'P3' }),
    ]);

    // Move p3 before p1
    store.getState().reorderCategory('project:p3', 'project:p1');
    const ids = store.getState().categories.map((c) => c.id);
    expect(ids).toEqual(['project:p3', 'project:p1', 'project:p2', DEFAULT_CIRCLE_ID]);
  });

  it('keeps General at the end after reorder', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([
      makeProject({ id: 'p1' }),
      makeProject({ id: 'p2' }),
    ]);
    store.getState().reorderCategory('project:p2', 'project:p1');
    const cats = store.getState().categories;
    expect(cats[cats.length - 1].id).toBe(DEFAULT_CIRCLE_ID);
  });

  it('is a no-op when dragging General', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1' })]);
    const before = store.getState().categories.map((c) => c.id);
    store.getState().reorderCategory(DEFAULT_CIRCLE_ID, 'project:p1');
    const after = store.getState().categories.map((c) => c.id);
    expect(after).toEqual(before);
  });

  it('is a no-op when dropping onto General', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1' })]);
    const before = store.getState().categories.map((c) => c.id);
    store.getState().reorderCategory('project:p1', DEFAULT_CIRCLE_ID);
    const after = store.getState().categories.map((c) => c.id);
    expect(after).toEqual(before);
  });

  it('is a no-op for same category', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1' })]);
    const before = store.getState().categories.map((c) => c.id);
    store.getState().reorderCategory('project:p1', 'project:p1');
    const after = store.getState().categories.map((c) => c.id);
    expect(after).toEqual(before);
  });

  it('persists order across deriveCategories', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([
      makeProject({ id: 'p1', name: 'P1' }),
      makeProject({ id: 'p2', name: 'P2' }),
    ]);
    store.getState().reorderCategory('project:p2', 'project:p1');

    // Re-derive — order should be preserved
    store.getState().deriveCategories([
      makeProject({ id: 'p1', name: 'P1' }),
      makeProject({ id: 'p2', name: 'P2' }),
    ]);
    const ids = store.getState().categories.map((c) => c.id);
    expect(ids).toEqual(['project:p2', 'project:p1', DEFAULT_CIRCLE_ID]);
  });
});

describe('setCategoryEmoji', () => {
  it('changes emoji on a project circle', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1' })]);
    store.getState().setCategoryEmoji('project:p1', '🔥');
    expect(store.getState().categories[0].emoji).toBe('🔥');
  });

  it('changes emoji on the General circle', () => {
    const store = createHydratedStore();
    store.getState().setCategoryEmoji(DEFAULT_CIRCLE_ID, '🏠');
    expect(store.getState().categories.find((c) => c.id === DEFAULT_CIRCLE_ID)!.emoji).toBe('🏠');
  });

  it('changes emoji on a custom circle', () => {
    const store = createHydratedStore();
    const id = store.getState().addCircle('VIPs');
    store.getState().setCategoryEmoji(id, '💎');
    expect(store.getState().categories.find((c) => c.id === id)!.emoji).toBe('💎');
    expect(store.getState().customCircles.find((c) => c.id === id)!.emoji).toBe('💎');
  });

  it('persists emoji across deriveCategories', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1' })]);
    store.getState().setCategoryEmoji('project:p1', '🚀');

    store.getState().deriveCategories([makeProject({ id: 'p1' })]);
    expect(store.getState().categories[0].emoji).toBe('🚀');
  });

  it('stores emoji in categoryEmojis', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1' })]);
    store.getState().setCategoryEmoji('project:p1', '🎯');
    expect(store.getState().categoryEmojis['project:p1']).toBe('🎯');
  });
});

describe('persistence (getPersistedState / loadPersistedState)', () => {
  it('round-trips state through persist/load', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1', name: 'P1' })]);
    store.getState().addCircle('Favorites');
    store.getState().renameCategory('project:p1', 'My Proj');
    store.getState().moveAgent('a1', 'circle:1');
    store.getState().setCategoryEmoji('project:p1', '🚀');
    store.getState().toggleCollapsed('project:p1');

    const snapshot = getPersistedState(store.getState());

    // Create a fresh store and load the snapshot
    const store2 = createLoungeStore();
    store2.getState().loadPersistedState(snapshot);

    const s2 = store2.getState();
    expect(s2.renamedLabels['project:p1']).toBe('My Proj');
    expect(s2.agentCategoryOverrides['a1']).toBe('circle:1');
    expect(s2.customCircles).toHaveLength(1);
    expect(s2.customCircles[0].label).toBe('Favorites');
    expect(s2.nextCircleId).toBe(2);
    expect(s2.categoryEmojis['project:p1']).toBe('🚀');
    expect(s2.collapsed.has('project:p1')).toBe(true);
  });

  it('getPersistedState serializes collapsed as array', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1' })]);
    store.getState().toggleCollapsed('project:p1');

    const snapshot = getPersistedState(store.getState());
    expect(Array.isArray(snapshot.collapsed)).toBe(true);
    expect(snapshot.collapsed).toContain('project:p1');
  });

  it('loadPersistedState handles missing fields gracefully', () => {
    const store = createHydratedStore();
    store.getState().loadPersistedState({} as LoungePersistedState);

    const s = store.getState();
    expect(s.renamedLabels).toEqual({});
    expect(s.customCircles).toEqual([]);
    expect(s.categoryOrder).toEqual([]);
    expect(s.collapsed.size).toBe(0);
  });
});

describe('hydration guard', () => {
  it('starts un-hydrated', () => {
    const store = createLoungeStore();
    expect(store.getState().hydrated).toBe(false);
  });

  it('blocks mutations before hydration', () => {
    const store = createLoungeStore();
    store.getState().renameCategory('project:p1', 'X');
    expect(store.getState().renamedLabels).toEqual({});

    store.getState().moveAgent('a1', 'circle:1');
    expect(store.getState().agentCategoryOverrides).toEqual({});

    const id = store.getState().addCircle('Test');
    expect(id).toBe('');
    expect(store.getState().customCircles).toHaveLength(0);
  });

  it('unblocks after loadPersistedState', () => {
    const store = createLoungeStore();
    store.getState().loadPersistedState({ collapsed: [] } as unknown as LoungePersistedState);
    expect(store.getState().hydrated).toBe(true);

    store.getState().addCircle('Now works');
    expect(store.getState().customCircles).toHaveLength(1);
  });

  it('allows deriveCategories and selectAgent before hydration', () => {
    const store = createLoungeStore();
    store.getState().deriveCategories([makeProject({ id: 'p1', name: 'P1' })]);
    expect(store.getState().categories).toHaveLength(2);

    store.getState().selectAgent('a1', 'p1');
    expect(store.getState().selectedAgentId).toBe('a1');
  });
});

describe('circle persistence race condition', () => {
  it('deriveCategories before loadPersistedState loses overrides (documents the bug)', () => {
    const store = createLoungeStore();
    const projects = [makeProject({ id: 'p1', name: 'P1' })];

    // Simulate the race: derive runs before persisted state is loaded
    store.getState().deriveCategories(projects);

    // At this point, agentCategoryOverrides is empty — agents in default circles
    expect(store.getState().agentCategoryOverrides).toEqual({});

    // Now load persisted state (too late for the first derive)
    store.getState().loadPersistedState({
      agentCategoryOverrides: { 'a1': 'circle:1' },
      customCircles: [{ id: 'circle:1', label: 'Favorites', emoji: '⭐' }],
      nextCircleId: 2,
      categoryOrder: ['circle:1', 'project:p1', 'circle:general'],
      categoryEmojis: {},
      renamedLabels: {},
      collapsed: [],
    });

    // Overrides are loaded but categories haven't been re-derived yet
    expect(store.getState().agentCategoryOverrides['a1']).toBe('circle:1');
    // Custom circle is in state but not in categories until next derive
    expect(store.getState().customCircles).toHaveLength(1);
  });

  it('loadPersistedState then deriveCategories preserves overrides (the fix)', () => {
    const store = createLoungeStore();
    const projects = [makeProject({ id: 'p1', name: 'P1' })];

    // Fix: load persisted state FIRST
    store.getState().loadPersistedState({
      agentCategoryOverrides: { 'a1': 'circle:1' },
      customCircles: [{ id: 'circle:1', label: 'Favorites', emoji: '⭐' }],
      nextCircleId: 2,
      categoryOrder: ['circle:1', 'project:p1', 'circle:general'],
      categoryEmojis: {},
      renamedLabels: {},
      collapsed: [],
    });

    expect(store.getState().hydrated).toBe(true);

    // Now derive — custom circles and overrides are already in state
    store.getState().deriveCategories(projects);

    const state = store.getState();
    // Override survives
    expect(state.agentCategoryOverrides['a1']).toBe('circle:1');
    // Custom circle appears in categories
    expect(state.categories.find((c: LoungeCategory) => c.id === 'circle:1')?.label).toBe('Favorites');
    // Project category also present
    expect(state.categories.find((c: LoungeCategory) => c.id === 'project:p1')).toBeDefined();
    // Order is preserved
    expect(state.categoryOrder).toEqual(['circle:1', 'project:p1', 'circle:general']);
  });

  it('groupAgentsByCategory respects overrides when loaded before derive', () => {
    const store = createLoungeStore();

    store.getState().loadPersistedState({
      agentCategoryOverrides: { 'a1': 'circle:1' },
      customCircles: [{ id: 'circle:1', label: 'Favorites', emoji: '⭐' }],
      nextCircleId: 2,
      categoryOrder: [],
      categoryEmojis: {},
      renamedLabels: {},
      collapsed: [],
    });

    store.getState().deriveCategories([makeProject({ id: 'p1', name: 'P1' })]);

    const agents = [makeAgent({ id: 'a1', projectId: 'p1', name: 'Agent One' })];
    const { categories, agentCategoryOverrides } = store.getState();
    const grouped = groupAgentsByCategory(agents, categories, agentCategoryOverrides);

    // Agent should be in Favorites circle, not project circle
    expect(grouped.get('circle:1')).toHaveLength(1);
    expect(grouped.get('circle:1')![0].id).toBe('a1');

    // Project circle should be empty
    expect(grouped.get('project:p1') ?? []).toHaveLength(0);
  });
});

describe('General project name collision', () => {
  it('disambiguates project named General', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1', name: 'General' })]);
    const cats = store.getState().categories;
    const projectCat = cats.find((c) => c.id === 'project:p1');
    expect(projectCat?.label).toBe('General (project)');
    // The default circle should remain as-is
    const general = cats.find((c) => c.id === DEFAULT_CIRCLE_ID);
    expect(general?.label).toBe(DEFAULT_CIRCLE_LABEL);
  });

  it('does not disambiguate projects with non-reserved names', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1', name: 'My Project' })]);
    const cats = store.getState().categories;
    expect(cats[0].label).toBe('My Project');
  });
});

describe('deleteCircle', () => {
  it('removes a custom circle', () => {
    const store = createHydratedStore();
    const id = store.getState().addCircle('Temp');
    expect(store.getState().customCircles).toHaveLength(1);
    store.getState().deleteCircle(id);
    expect(store.getState().customCircles).toHaveLength(0);
    expect(store.getState().categories.find((c) => c.id === id)).toBeUndefined();
  });

  it('moves agents back to General when their circle is deleted', () => {
    const store = createHydratedStore();
    const id = store.getState().addCircle('VIPs');
    store.getState().moveAgent('a1', id);
    expect(store.getState().agentCategoryOverrides['a1']).toBe(id);
    store.getState().deleteCircle(id);
    expect(store.getState().agentCategoryOverrides['a1']).toBeUndefined();
  });

  it('cannot delete the General circle', () => {
    const store = createHydratedStore();
    store.getState().deleteCircle(DEFAULT_CIRCLE_ID);
    expect(store.getState().categories.find((c) => c.id === DEFAULT_CIRCLE_ID)).toBeDefined();
  });

  it('cannot delete project-derived circles', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1' })]);
    store.getState().deleteCircle('project:p1');
    expect(store.getState().categories.find((c) => c.id === 'project:p1')).toBeDefined();
  });

  it('cleans up emojis, labels, order, and collapsed state', () => {
    const store = createHydratedStore();
    const id = store.getState().addCircle('Temp');
    store.getState().setCategoryEmoji(id, '🔥');
    store.getState().renameCategory(id, 'Renamed');
    store.getState().toggleCollapsed(id);
    store.getState().deleteCircle(id);
    expect(store.getState().categoryEmojis[id]).toBeUndefined();
    expect(store.getState().renamedLabels[id]).toBeUndefined();
    expect(store.getState().collapsed.has(id)).toBe(false);
  });
});

describe('duplicate name validation', () => {
  it('isDuplicateCircleName detects duplicates case-insensitively', () => {
    const cats: LoungeCategory[] = [
      { id: 'circle:1', label: 'Favorites' },
      { id: DEFAULT_CIRCLE_ID, label: 'General' },
    ];
    expect(isDuplicateCircleName('Favorites', cats)).toBe(true);
    expect(isDuplicateCircleName('favorites', cats)).toBe(true);
    expect(isDuplicateCircleName('FAVORITES', cats)).toBe(true);
    expect(isDuplicateCircleName('Something else', cats)).toBe(false);
  });

  it('isDuplicateCircleName excludes a specific ID', () => {
    const cats: LoungeCategory[] = [
      { id: 'circle:1', label: 'Favorites' },
    ];
    expect(isDuplicateCircleName('Favorites', cats, 'circle:1')).toBe(false);
    expect(isDuplicateCircleName('Favorites', cats, 'circle:2')).toBe(true);
  });

  it('addCircle rejects duplicate names', () => {
    const store = createHydratedStore();
    store.getState().addCircle('Favorites');
    const id = store.getState().addCircle('Favorites');
    expect(id).toBe('');
    expect(store.getState().customCircles).toHaveLength(1);
  });

  it('addCircle rejects duplicate names case-insensitively', () => {
    const store = createHydratedStore();
    store.getState().addCircle('Favorites');
    const id = store.getState().addCircle('favorites');
    expect(id).toBe('');
  });

  it('renameCategory rejects duplicate names', () => {
    const store = createHydratedStore();
    store.getState().addCircle('Alpha');
    store.getState().addCircle('Beta');
    store.getState().renameCategory('circle:2', 'Alpha');
    expect(store.getState().categories.find((c) => c.id === 'circle:2')?.label).toBe('Beta');
  });

  it('renameCategory allows same name on the same circle (no-op)', () => {
    const store = createHydratedStore();
    store.getState().addCircle('Alpha');
    store.getState().renameCategory('circle:1', 'Alpha');
    expect(store.getState().categories.find((c) => c.id === 'circle:1')?.label).toBe('Alpha');
  });

  it('addCircle rejects empty names', () => {
    const store = createHydratedStore();
    expect(store.getState().addCircle('')).toBe('');
    expect(store.getState().addCircle('   ')).toBe('');
    expect(store.getState().customCircles).toHaveLength(0);
  });
});

describe('sortAgentsByOrder', () => {
  it('returns agents in order array sequence', () => {
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1' }),
      makeAgent({ id: 'a2', projectId: 'p1' }),
      makeAgent({ id: 'a3', projectId: 'p1' }),
    ];
    const sorted = sortAgentsByOrder(agents, ['a3', 'a1', 'a2']);
    expect(sorted.map((a) => a.id)).toEqual(['a3', 'a1', 'a2']);
  });

  it('appends agents not in order array at the end', () => {
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1' }),
      makeAgent({ id: 'a2', projectId: 'p1' }),
      makeAgent({ id: 'a3', projectId: 'p1' }),
    ];
    const sorted = sortAgentsByOrder(agents, ['a3']);
    expect(sorted.map((a) => a.id)).toEqual(['a3', 'a1', 'a2']);
  });

  it('returns original order when order is undefined', () => {
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1' }),
      makeAgent({ id: 'a2', projectId: 'p1' }),
    ];
    expect(sortAgentsByOrder(agents, undefined)).toEqual(agents);
  });

  it('returns original order when order is empty', () => {
    const agents = [
      makeAgent({ id: 'a1', projectId: 'p1' }),
      makeAgent({ id: 'a2', projectId: 'p1' }),
    ];
    expect(sortAgentsByOrder(agents, [])).toEqual(agents);
  });

  it('ignores order entries for agents not in the list', () => {
    const agents = [makeAgent({ id: 'a1', projectId: 'p1' })];
    const sorted = sortAgentsByOrder(agents, ['a99', 'a1', 'a50']);
    expect(sorted.map((a) => a.id)).toEqual(['a1']);
  });
});

describe('placeAgent', () => {
  it('places agent before a target agent in the same circle', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1', name: 'P1' })]);
    // Set up initial order
    store.getState().placeAgent('a1', 'project:p1', null);
    store.getState().placeAgent('a2', 'project:p1', null);
    store.getState().placeAgent('a3', 'project:p1', null);
    expect(store.getState().agentOrder['project:p1']).toEqual(['a1', 'a2', 'a3']);

    // Move a3 before a1
    store.getState().placeAgent('a3', 'project:p1', 'a1');
    expect(store.getState().agentOrder['project:p1']).toEqual(['a3', 'a1', 'a2']);
  });

  it('appends agent to end when beforeAgentId is null', () => {
    const store = createHydratedStore();
    store.getState().placeAgent('a1', 'circle:general', null);
    store.getState().placeAgent('a2', 'circle:general', null);
    expect(store.getState().agentOrder['circle:general']).toEqual(['a1', 'a2']);
  });

  it('moves agent between circles with position', () => {
    const store = createHydratedStore();
    store.getState().deriveCategories([makeProject({ id: 'p1', name: 'P1' })]);
    store.getState().addCircle('Favorites');

    // Place agents in project circle
    store.getState().placeAgent('a1', 'project:p1', null);
    store.getState().placeAgent('a2', 'project:p1', null);

    // Place a3 in Favorites
    store.getState().placeAgent('a3', 'circle:1', null);

    // Move a1 from project to Favorites, before a3
    store.getState().placeAgent('a1', 'circle:1', 'a3');

    expect(store.getState().agentOrder['circle:1']).toEqual(['a1', 'a3']);
    expect(store.getState().agentOrder['project:p1']).toEqual(['a2']);
    expect(store.getState().agentCategoryOverrides['a1']).toBe('circle:1');
  });

  it('removes agent from old category order on cross-circle move', () => {
    const store = createHydratedStore();
    store.getState().placeAgent('a1', 'circle:general', null);
    store.getState().placeAgent('a2', 'circle:general', null);

    store.getState().addCircle('Test');
    store.getState().placeAgent('a1', 'circle:1', null);

    expect(store.getState().agentOrder['circle:general']).toEqual(['a2']);
    expect(store.getState().agentOrder['circle:1']).toEqual(['a1']);
  });

  it('is blocked before hydration', () => {
    const store = createLoungeStore();
    store.getState().placeAgent('a1', 'circle:general', null);
    expect(store.getState().agentOrder).toEqual({});
  });

  it('reorders correctly with empty agentOrder when currentAgentIds provided', () => {
    const store = createHydratedStore();
    // Simulate first-ever reorder: agentOrder is empty, but UI knows display order
    store.getState().placeAgent('a3', 'project:p1', 'a1', ['a1', 'a2', 'a3']);
    expect(store.getState().agentOrder['project:p1']).toEqual(['a3', 'a1', 'a2']);
  });

  it('reorders correctly with sparse agentOrder when currentAgentIds provided', () => {
    const store = createHydratedStore();
    // Partially populated order — only some agents tracked
    store.getState().placeAgent('b', 'project:p1', null);
    store.getState().placeAgent('d', 'project:p1', null);
    expect(store.getState().agentOrder['project:p1']).toEqual(['b', 'd']);

    // Move e before d; UI knows the full display order [b, d, a, c, e]
    store.getState().placeAgent('e', 'project:p1', 'd', ['b', 'd', 'a', 'c', 'e']);
    expect(store.getState().agentOrder['project:p1']).toEqual(['b', 'e', 'd', 'a', 'c']);
  });

  it('cross-circle move with currentAgentIds populates full target order', () => {
    const store = createHydratedStore();
    store.getState().addCircle('Favs');
    // Target circle has agents [x, y] in display but empty agentOrder
    store.getState().placeAgent('a1', 'circle:1', 'x', ['x', 'y']);
    expect(store.getState().agentOrder['circle:1']).toEqual(['a1', 'x', 'y']);
    expect(store.getState().agentCategoryOverrides['a1']).toBe('circle:1');
  });
});

describe('moveAgent with agentOrder', () => {
  it('appends to target circle order and removes from source', () => {
    const store = createHydratedStore();
    store.getState().placeAgent('a1', 'circle:general', null);
    store.getState().placeAgent('a2', 'circle:general', null);

    store.getState().addCircle('New');
    store.getState().moveAgent('a1', 'circle:1');

    expect(store.getState().agentOrder['circle:general']).toEqual(['a2']);
    expect(store.getState().agentOrder['circle:1']).toEqual(['a1']);
  });
});

describe('deleteCircle cleans up agentOrder', () => {
  it('removes the deleted circle from agentOrder', () => {
    const store = createHydratedStore();
    store.getState().addCircle('Temp');
    store.getState().placeAgent('a1', 'circle:1', null);
    expect(store.getState().agentOrder['circle:1']).toEqual(['a1']);

    store.getState().deleteCircle('circle:1');
    expect(store.getState().agentOrder['circle:1']).toBeUndefined();
  });
});

describe('persistence round-trip with agentOrder', () => {
  it('persists and restores agentOrder', () => {
    const store = createHydratedStore();
    store.getState().placeAgent('a1', 'circle:general', null);
    store.getState().placeAgent('a2', 'circle:general', null);
    store.getState().placeAgent('a2', 'circle:general', 'a1');

    const snapshot = getPersistedState(store.getState());
    expect(snapshot.agentOrder['circle:general']).toEqual(['a2', 'a1']);

    const store2 = createLoungeStore();
    store2.getState().loadPersistedState(snapshot);
    expect(store2.getState().agentOrder['circle:general']).toEqual(['a2', 'a1']);
  });

  it('loadPersistedState handles missing agentOrder gracefully', () => {
    const store = createLoungeStore();
    store.getState().loadPersistedState({
      renamedLabels: {},
      agentCategoryOverrides: {},
      customCircles: [],
      nextCircleId: 1,
      categoryOrder: [],
      categoryEmojis: {},
      collapsed: [],
    } as LoungePersistedState);
    expect(store.getState().agentOrder).toEqual({});
  });
});
