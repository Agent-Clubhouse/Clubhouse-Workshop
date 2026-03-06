// ---------------------------------------------------------------------------
// Shared Directory — Creates and manages the filesystem-based comms directory
// ---------------------------------------------------------------------------

import type { WorkspaceAPI } from "@clubhouse/plugin-types";
import type { BuddyGroup, GroupMember, Deliverable } from "../types";

export interface SharedDirectory {
  /** The absolute root path where group directories are stored. */
  readonly root: string;
  /** Create the full shared directory structure for a group. */
  create(group: BuddyGroup): Promise<void>;
  /** Remove the shared directory for a group. */
  remove(groupId: string): Promise<void>;
  /** Write the leader's plan to the shared directory. */
  writePlan(groupId: string, planContent: string): Promise<void>;
  /** Read the plan from the shared directory. */
  readPlan(groupId: string): Promise<string | null>;
  /** Write an assignment file for a member. */
  writeAssignment(groupId: string, member: GroupMember, deliverable: Deliverable): Promise<void>;
  /** Read a member's status file. */
  readMemberStatus(groupId: string, memberId: string): Promise<MemberStatusFile | null>;
  /** Get the glob pattern for watching a group's shared directory. */
  watchGlob(groupId: string): string;
  /** Get the base directory path for a group. */
  groupPath(groupId: string): string;
}

export interface MemberStatusFile {
  status: "working" | "blocked" | "done" | "error";
  deliverableId: string;
  progress: string;
  blockers: string[];
  lastCheckin: string;
}

export function createSharedDirectory(workspace: WorkspaceAPI): SharedDirectory {
  const root = `${workspace.root}/groups`;

  function gdir(groupId: string): string {
    return `${root}/${groupId}`;
  }

  // Relative path within workspace for a group
  function wrel(groupId: string, ...parts: string[]): string {
    return `groups/${groupId}${parts.length ? "/" + parts.join("/") : ""}`;
  }

  async function create(group: BuddyGroup): Promise<void> {
    await workspace.mkdir(wrel(group.id));
    await workspace.mkdir(wrel(group.id, "assignments"));
    await workspace.mkdir(wrel(group.id, "status"));
    await workspace.mkdir(wrel(group.id, "comms"));
    await workspace.mkdir(wrel(group.id, "shared"));
    // Seed shared files
    await workspace.writeFile(wrel(group.id, "shared", "decisions.md"), "# Design Decisions\n\n");
    await workspace.writeFile(wrel(group.id, "shared", "interfaces.md"), "# Shared Interfaces\n\n");
  }

  async function remove(groupId: string): Promise<void> {
    try {
      await workspace.delete(wrel(groupId));
    } catch {
      // Directory may not exist; ignore
    }
  }

  async function writePlan(groupId: string, planContent: string): Promise<void> {
    await workspace.writeFile(wrel(groupId, "plan.md"), planContent);
  }

  async function readPlan(groupId: string): Promise<string | null> {
    try {
      return await workspace.readFile(wrel(groupId, "plan.md"));
    } catch {
      return null;
    }
  }

  async function writeAssignment(
    groupId: string,
    member: GroupMember,
    deliverable: Deliverable,
  ): Promise<void> {
    const base = gdir(groupId);
    const content = [
      `# Assignment: ${deliverable.title}`,
      "",
      `**Assignee:** ${member.agentName} (${member.projectName})`,
      `**Deliverable ID:** ${deliverable.id}`,
      `**Status:** ${deliverable.status}`,
      "",
      "## Description",
      "",
      deliverable.description,
      "",
      deliverable.dependencies?.length
        ? `## Dependencies\n\nThis deliverable depends on: ${deliverable.dependencies.join(", ")}\n`
        : "",
      "## Communication",
      "",
      `Update your status at: ${base}/status/${member.id}.json`,
      `Write comms to: ${base}/comms/`,
      `Check shared decisions: ${base}/shared/decisions.md`,
      `Check shared interfaces: ${base}/shared/interfaces.md`,
    ].join("\n");

    await workspace.writeFile(wrel(groupId, "assignments", `${member.id}.md`), content);
  }

  async function readMemberStatus(groupId: string, memberId: string): Promise<MemberStatusFile | null> {
    try {
      const raw = await workspace.readFile(wrel(groupId, "status", `${memberId}.json`));
      return JSON.parse(raw) as MemberStatusFile;
    } catch {
      return null;
    }
  }

  function watchGlob(groupId: string): string {
    return `${wrel(groupId)}/**/*`;
  }

  function groupPath(groupId: string): string {
    return gdir(groupId);
  }

  return { root, create, remove, writePlan, readPlan, writeAssignment, readMemberStatus, watchGlob, groupPath };
}
