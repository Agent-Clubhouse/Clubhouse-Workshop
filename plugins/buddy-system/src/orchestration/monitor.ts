// ---------------------------------------------------------------------------
// Monitor — Watches the shared directory for plan + status updates
// ---------------------------------------------------------------------------

import type { PluginAPI, Disposable, FileEvent } from "@clubhouse/plugin-types";
import type { BuddyGroup, MemberStatus } from "../types";
import type { GroupStore } from "../state/groups";
import type { SharedDirectory, MemberStatusFile } from "./shared-dir";

export interface GroupMonitor {
  /** Start watching a group's shared directory. */
  start(groupId: string): void;
  /** Stop watching a group's shared directory. */
  stop(groupId: string): void;
  /** Stop watching all groups. */
  stopAll(): void;
}

type MonitorCallback = (groupId: string, event: MonitorEvent) => void;

export type MonitorEvent =
  | { type: "plan-detected"; groupId: string }
  | { type: "status-updated"; groupId: string; memberId: string; status: MemberStatusFile }
  | { type: "comms-new"; groupId: string; path: string }
  | { type: "all-done"; groupId: string };

export function createGroupMonitor(
  api: PluginAPI,
  store: GroupStore,
  sharedDir: SharedDirectory,
  onEvent: MonitorCallback,
): GroupMonitor {
  const watchers = new Map<string, Disposable>();

  function start(groupId: string): void {
    if (watchers.has(groupId)) return; // already watching

    const glob = sharedDir.watchGlob(groupId);
    const disposable = api.files.watch(glob, (events: FileEvent[]) => {
      handleFileEvents(groupId, events);
    });
    watchers.set(groupId, disposable);
    api.logging.info("Monitor started", { groupId });
  }

  async function handleFileEvents(groupId: string, events: FileEvent[]): Promise<void> {
    for (const event of events) {
      if (event.type === "deleted") continue;

      // Plan detected
      if (event.path.endsWith("/plan.md")) {
        onEvent(groupId, { type: "plan-detected", groupId });
        continue;
      }

      // Status update
      const statusMatch = event.path.match(/\/status\/(.+)\.json$/);
      if (statusMatch) {
        const memberId = statusMatch[1];
        const status = await sharedDir.readMemberStatus(groupId, memberId);
        if (status) {
          onEvent(groupId, { type: "status-updated", groupId, memberId, status });
          // Check if all members are done
          await checkAllDone(groupId);
        }
        continue;
      }

      // New comms message
      if (event.path.includes("/comms/")) {
        onEvent(groupId, { type: "comms-new", groupId, path: event.path });
        continue;
      }
    }
  }

  async function checkAllDone(groupId: string): Promise<void> {
    const group = await store.get(groupId);
    if (!group || group.status !== "executing") return;

    const allDone = group.members.every(m => {
      // Members without assignments are considered done
      if (!m.assignmentId) return true;
      return m.status === "done";
    });

    if (allDone) {
      onEvent(groupId, { type: "all-done", groupId });
    }
  }

  function stop(groupId: string): void {
    const disposable = watchers.get(groupId);
    if (disposable) {
      disposable.dispose();
      watchers.delete(groupId);
      api.logging.info("Monitor stopped", { groupId });
    }
  }

  function stopAll(): void {
    for (const [id, disposable] of watchers) {
      disposable.dispose();
    }
    watchers.clear();
  }

  return { start, stop, stopAll };
}
