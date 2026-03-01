// ---------------------------------------------------------------------------
// Shared Directory — Creates and manages the filesystem-based comms directory
// ---------------------------------------------------------------------------

import type { FilesAPI } from "@clubhouse/plugin-types";
import type { BuddyGroup, GroupMember, Deliverable } from "../types";

const FALLBACK_ROOT = `${process.env.HOME || process.env.USERPROFILE || "/tmp"}/.clubhouse/buddy-system`;

function resolveRoot(files: FilesAPI): string {
  // Prefer the plugin's own data directory (auto-cleaned on uninstall).
  // Falls back to ~/.clubhouse/buddy-system/ if dataDir is not yet available.
  return files.dataDir ? `${files.dataDir}/groups` : FALLBACK_ROOT;
}

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

export function createSharedDirectory(files: FilesAPI): SharedDirectory {
  const root = resolveRoot(files);

  function gdir(groupId: string): string {
    return `${root}/${groupId}`;
  }

  async function create(group: BuddyGroup): Promise<void> {
    const base = gdir(group.id);
    await files.mkdir(base);
    await files.mkdir(`${base}/assignments`);
    await files.mkdir(`${base}/status`);
    await files.mkdir(`${base}/comms`);
    await files.mkdir(`${base}/shared`);
    // Seed shared files
    await files.writeFile(`${base}/shared/decisions.md`, "# Design Decisions\n\n");
    await files.writeFile(`${base}/shared/interfaces.md`, "# Shared Interfaces\n\n");
  }

  async function remove(groupId: string): Promise<void> {
    try {
      await files.delete(gdir(groupId));
    } catch {
      // Directory may not exist; ignore
    }
  }

  async function writePlan(groupId: string, planContent: string): Promise<void> {
    await files.writeFile(`${gdir(groupId)}/plan.md`, planContent);
  }

  async function readPlan(groupId: string): Promise<string | null> {
    try {
      return await files.readFile(`${gdir(groupId)}/plan.md`);
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

    await files.writeFile(`${base}/assignments/${member.id}.md`, content);
  }

  async function readMemberStatus(groupId: string, memberId: string): Promise<MemberStatusFile | null> {
    try {
      const raw = await files.readFile(`${gdir(groupId)}/status/${memberId}.json`);
      return JSON.parse(raw) as MemberStatusFile;
    } catch {
      return null;
    }
  }

  function watchGlob(groupId: string): string {
    return `${gdir(groupId)}/**/*`;
  }

  function groupPath(groupId: string): string {
    return gdir(groupId);
  }

  return { root, create, remove, writePlan, readPlan, writeAssignment, readMemberStatus, watchGlob, groupPath };
}
