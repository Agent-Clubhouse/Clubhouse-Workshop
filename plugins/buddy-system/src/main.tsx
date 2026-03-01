// ---------------------------------------------------------------------------
// Buddy System — Main entry point
// ---------------------------------------------------------------------------

import type { PluginContext, PluginAPI, PanelProps } from "@clubhouse/plugin-types";
import type { BuddyGroup } from "./types";
import { createGroupStore, type GroupStore } from "./state/groups";
import { useTheme } from "./use-theme";
import { GroupList } from "./ui/GroupList";
import { GroupDetail } from "./ui/GroupDetail";

const React = globalThis.React;
const { useState, useEffect, useCallback, useRef } = React;

// ---------------------------------------------------------------------------
// Module-level state (shared between activate and MainPanel)
// ---------------------------------------------------------------------------

let groupStore: GroupStore | null = null;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Buddy System plugin activated");

  // Initialize group store with global storage
  groupStore = createGroupStore(api.storage.global);

  // Register commands
  const createCmd = api.commands.register("buddy-system.new-group", async () => {
    if (!groupStore) return;
    const group = await groupStore.create();
    api.ui.showNotice(`Created buddy group: ${group.name}`);
    api.logging.info("Group created", { groupId: group.id, name: group.name });
  });
  ctx.subscriptions.push(createCmd);

  const assignCmd = api.commands.register("buddy-system.assign-work", () => {
    api.ui.showNotice("Assign Work: Open the Buddy Groups panel to assign work to a group.");
  });
  ctx.subscriptions.push(assignCmd);
}

export function deactivate(): void {
  groupStore = null;
}

// ---------------------------------------------------------------------------
// MainPanel
// ---------------------------------------------------------------------------

export function MainPanel({ api }: PanelProps) {
  const { style: themeStyle } = useTheme(api.theme);
  const [groups, setGroups] = useState<BuddyGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const storeRef = useRef(groupStore);

  // Ensure we have a store (may be called before activate in testing)
  useEffect(() => {
    if (!storeRef.current) {
      storeRef.current = createGroupStore(api.storage.global);
    }
  }, [api]);

  // Load groups on mount
  const loadGroups = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const loaded = await store.loadAll();
    setGroups(loaded);
    setLoaded(true);
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const store = storeRef.current;
  if (!loaded || !store) {
    return (
      <div style={{ ...themeStyle, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-tertiary)", fontSize: 14, fontFamily: "var(--font-family)" }}>
          Loading...
        </span>
      </div>
    );
  }

  const handleCreate = async () => {
    try {
      const group = await store.create();
      setGroups(prev => [...prev, group]);
      setSelectedGroupId(group.id);
      api.logging.info("Group created", { groupId: group.id, name: group.name });
    } catch (err) {
      api.logging.error("Failed to create group", { error: String(err) });
      api.ui.showError(`Failed to create group: ${err}`);
    }
  };

  const handleDelete = async (groupId: string) => {
    try {
      const confirmed = await api.ui.showConfirm("Delete this buddy group?");
      if (!confirmed) return;
      await store.remove(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
      if (selectedGroupId === groupId) setSelectedGroupId(null);
      api.logging.info("Group deleted", { groupId });
    } catch (err) {
      api.logging.error("Failed to delete group", { error: String(err) });
      api.ui.showError(`Failed to delete group: ${err}`);
    }
  };

  const handleGroupUpdated = (updated: BuddyGroup) => {
    setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div style={{ ...themeStyle, height: "100%", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {selectedGroup ? (
        <GroupDetail
          api={api}
          group={selectedGroup}
          store={store}
          onBack={() => setSelectedGroupId(null)}
          onGroupUpdated={handleGroupUpdated}
        />
      ) : (
        <GroupList
          api={api}
          groups={groups}
          onSelect={g => setSelectedGroupId(g.id)}
          onCreate={handleCreate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
