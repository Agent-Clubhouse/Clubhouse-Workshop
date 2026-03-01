// ---------------------------------------------------------------------------
// Shared Directory — Creates and manages the filesystem-based comms directory
// ---------------------------------------------------------------------------

import type { FilesAPI } from "@clubhouse/plugin-types";
import type { BuddyGroup, GroupMember, Deliverable } from "../types";

const BUDDY_ROOT = "~/.clubhouse/buddy-system";

function groupDir(groupId: string): string {
  return `${BUDDY_ROOT}/${groupId}`;
}

export interface SharedDirectory {
  /** Create the full shared directory structure for a group. */
  create(group: BuddyGroup): Promise<void>;
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
  async function create(group: BuddyGroup): Promise<void> {
    const base = groupDir(group.id);
    await files.mkdir(base);
    await files.mkdir(`${base}/assignments`);
    await files.mkdir(`${base}/status`);
    await files.mkdir(`${base}/comms`);
    await files.mkdir(`${base}/shared`);
    // Seed shared files
    await files.writeFile(`${base}/shared/decisions.md`, "# Design Decisions\n\n");
    await files.writeFile(`${base}/shared/interfaces.md`, "# Shared Interfaces\n\n");
  }

  async function writePlan(groupId: string, planContent: string): Promise<void> {
    await files.writeFile(`${groupDir(groupId)}/plan.md`, planContent);
  }

  async function readPlan(groupId: string): Promise<string | null> {
    try {
      return await files.readFile(`${groupDir(groupId)}/plan.md`);
    } catch {
      return null;
    }
  }

  async function writeAssignment(
    groupId: string,
    member: GroupMember,
    deliverable: Deliverable,
  ): Promise<void> {
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
      `Update your status at: ${groupDir(groupId)}/status/${member.id}.json`,
      `Write comms to: ${groupDir(groupId)}/comms/`,
      `Check shared decisions: ${groupDir(groupId)}/shared/decisions.md`,
      `Check shared interfaces: ${groupDir(groupId)}/shared/interfaces.md`,
    ].join("\n");

    await files.writeFile(`${groupDir(groupId)}/assignments/${member.id}.md`, content);
  }

  async function readMemberStatus(groupId: string, memberId: string): Promise<MemberStatusFile | null> {
    try {
      const raw = await files.readFile(`${groupDir(groupId)}/status/${memberId}.json`);
      return JSON.parse(raw) as MemberStatusFile;
    } catch {
      return null;
    }
  }

  function watchGlob(groupId: string): string {
    return `${groupDir(groupId)}/**/*`;
  }

  function groupPath(groupId: string): string {
    return groupDir(groupId);
  }

  return { create, writePlan, readPlan, writeAssignment, readMemberStatus, watchGlob, groupPath };
}
