// ---------------------------------------------------------------------------
// Buddy System — Main entry point
// ---------------------------------------------------------------------------

import type { PluginContext, PluginAPI, PanelProps } from "@clubhouse/plugin-types";
import type { BuddyGroup, MemberStatus } from "./types";
import { createGroupStore, type GroupStore } from "./state/groups";
import { createSharedDirectory, type SharedDirectory } from "./orchestration/shared-dir";
import { createPlanner, type PlannerOrchestrator } from "./orchestration/planner";
import { createGroupMonitor, type GroupMonitor, type MonitorEvent } from "./orchestration/monitor";
import { createConfigInjector, type ConfigInjector } from "./config/injector";
import { useTheme } from "./use-theme";
import { GroupList } from "./ui/GroupList";
import { GroupDetail } from "./ui/GroupDetail";

const React = globalThis.React;
const { useState, useEffect, useCallback, useRef } = React;

// ---------------------------------------------------------------------------
// Module-level state (shared between activate and MainPanel)
// ---------------------------------------------------------------------------

let groupStore: GroupStore | null = null;
let sharedDir: SharedDirectory | null = null;
let planner: PlannerOrchestrator | null = null;
let monitor: GroupMonitor | null = null;
let injector: ConfigInjector | null = null;

// Event listeners that MainPanel registers to get monitor updates
let monitorListeners: Array<(groupId: string, event: MonitorEvent) => void> = [];

function onMonitorEvent(groupId: string, event: MonitorEvent): void {
  for (const listener of monitorListeners) {
    listener(groupId, event);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function activate(ctx: PluginContext, api: PluginAPI): void {
  api.logging.info("Buddy System plugin activated");

  // Initialize subsystems
  groupStore = createGroupStore(api.storage.global);
  sharedDir = createSharedDirectory(api.files);
  injector = createConfigInjector(api.agentConfig);
  planner = createPlanner(api, groupStore, sharedDir, injector);
  monitor = createGroupMonitor(api, groupStore, sharedDir, onMonitorEvent);

  // Register commands
  const createCmd = api.commands.register("buddy-system.new-group", async () => {
    if (!groupStore) return;
    try {
      const group = await groupStore.create();
      api.ui.showNotice(`Created buddy group: ${group.name}`);
      api.logging.info("Group created", { groupId: group.id, name: group.name });
    } catch (err) {
      api.ui.showError(`Failed to create group: ${err}`);
    }
  });
  ctx.subscriptions.push(createCmd);

  const assignCmd = api.commands.register("buddy-system.assign-work", () => {
    api.ui.showNotice("Assign Work: Open the Buddy Groups panel to assign work to a group.");
  });
  ctx.subscriptions.push(assignCmd);

  // Clean up monitor on deactivate
  ctx.subscriptions.push({ dispose: () => monitor?.stopAll() });
}

export function deactivate(): void {
  monitor?.stopAll();
  groupStore = null;
  sharedDir = null;
  planner = null;
  monitor = null;
  injector = null;
  monitorListeners = [];
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
  const plannerRef = useRef(planner);

  // Ensure we have a store (may be called before activate in testing)
  useEffect(() => {
    if (!storeRef.current) {
      storeRef.current = createGroupStore(api.storage.global);
    }
    if (!plannerRef.current && storeRef.current) {
      const sd = sharedDir ?? createSharedDirectory(api.files);
      const inj = injector ?? createConfigInjector(api.agentConfig);
      plannerRef.current = createPlanner(api, storeRef.current, sd, inj);
    }
  }, [api]);

  // Load groups on mount
  const loadGroups = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const allGroups = await store.loadAll();
    setGroups(allGroups);
    setLoaded(true);

    // Start monitors for active groups
    for (const g of allGroups) {
      if (g.status === "planning" || g.status === "executing") {
        monitor?.start(g.id);
      }
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // Listen for monitor events and update group state
  useEffect(() => {
    const handleEvent = async (groupId: string, event: MonitorEvent) => {
      const store = storeRef.current;
      if (!store) return;

      if (event.type === "status-updated") {
        const group = await store.get(groupId);
        if (!group) return;
        const member = group.members.find(m => m.id === event.memberId);
        if (member) {
          member.status = event.status.status as MemberStatus;
        }
        // Update deliverable status if member reports done
        if (event.status.status === "done" && member?.assignmentId && group.plan) {
          const deliverable = group.plan.deliverables.find(d => d.id === member.assignmentId);
          if (deliverable) deliverable.status = "complete";
        }
        if (event.status.status === "working" && member?.assignmentId && group.plan) {
          const deliverable = group.plan.deliverables.find(d => d.id === member.assignmentId);
          if (deliverable && deliverable.status === "pending") deliverable.status = "in-progress";
        }
        await store.save(group);
        setGroups(prev => prev.map(g => g.id === groupId ? group : g));
      }

      if (event.type === "all-done") {
        const group = await store.get(groupId);
        if (group) {
          group.status = "complete";
          await store.save(group);
          setGroups(prev => prev.map(g => g.id === groupId ? group : g));
          monitor?.stop(groupId);
          api.ui.showNotice(`Buddy group "${group.name}" has completed all deliverables!`);
          api.badges.set({
            key: `complete-${groupId}`,
            type: "dot",
            target: { appPlugin: true },
          });
        }
      }

      if (event.type === "plan-detected") {
        api.logging.info("Plan detected by monitor", { groupId });
        api.badges.set({
          key: `plan-${groupId}`,
          type: "dot",
          target: { appPlugin: true },
        });
      }
    };

    monitorListeners.push(handleEvent);
    return () => {
      monitorListeners = monitorListeners.filter(l => l !== handleEvent);
    };
  }, [api]);

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
      monitor?.stop(groupId);
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
    // Start monitor when group enters planning/executing
    if (updated.status === "planning" || updated.status === "executing") {
      monitor?.start(updated.id);
    }
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div style={{ ...themeStyle, height: "100%", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {selectedGroup ? (
        <GroupDetail
          api={api}
          group={selectedGroup}
          store={store}
          planner={plannerRef.current}
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
