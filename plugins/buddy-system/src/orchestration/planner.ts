// ---------------------------------------------------------------------------
// Planner — Orchestrates leader planning and member assignment
// ---------------------------------------------------------------------------

import type { PluginAPI, Disposable } from "@clubhouse/plugin-types";
import type { BuddyGroup, GroupMember, GroupPlan, Deliverable } from "../types";
import type { GroupStore } from "../state/groups";
import type { SharedDirectory } from "./shared-dir";
import type { ConfigInjector } from "../config/injector";
import { parsePlan } from "./plan-parser";

function buildPlanningPrompt(group: BuddyGroup): string {
  const memberList = group.members
    .map(m => `- **${m.agentName}** (${m.projectName}): ${m.context}${m.isLeader ? " [LEADER — that's you]" : ""}`)
    .join("\n");

  return `You are the leader of buddy group "${group.name}". You have been given the following mission:

${group.mission}

Your group members are:
${memberList}

Create a plan that:
1. Breaks the mission into major deliverables
2. Assigns each deliverable to the most appropriate group member (use their Member ID)
3. Identifies dependencies between deliverables
4. Defines shared interfaces or contracts where cross-project integration is needed

Write your plan to: ~/.clubhouse/buddy-system/${group.id}/plan.md

Format the plan as markdown with YAML frontmatter containing structured assignment data:
---
deliverables:
  - id: d1
    title: "Short title"
    assignee: "${group.members[0]?.id ?? "member-id"}"
    dependencies: []
    description: "What needs to be done"
  - id: d2
    title: "Another task"
    assignee: "${group.members[1]?.id ?? "member-id"}"
    dependencies: ["d1"]
    description: "Details"
---

## Summary

Your high-level approach and reasoning here...

IMPORTANT: Use the exact member IDs listed above as assignee values. Each deliverable must be assigned to one member. You may assign multiple deliverables to yourself.

Member IDs:
${group.members.map(m => `- ${m.id}: ${m.agentName} (${m.projectName})`).join("\n")}`;
}

function buildAssignmentPrompt(group: BuddyGroup, member: GroupMember, deliverable: Deliverable): string {
  return `You have been assigned work as part of buddy group "${group.name}".

Your deliverable: **${deliverable.title}**
${deliverable.description}

${deliverable.dependencies?.length ? `This depends on: ${deliverable.dependencies.join(", ")}. Check the shared directory for status on those items before starting.` : ""}

Read your full assignment at: ~/.clubhouse/buddy-system/${group.id}/assignments/${member.id}.md

Follow the buddy-system-mission skill for the work loop and communication protocol.`;
}

export interface PlannerOrchestrator {
  /** Start the planning phase: wake the leader with the mission. */
  startPlanning(group: BuddyGroup): Promise<BuddyGroup>;
  /** Called when plan.md is detected — parse it and create assignments. */
  processPlan(group: BuddyGroup): Promise<BuddyGroup>;
  /** Resume each assigned member agent with their assignment. */
  startExecution(group: BuddyGroup): Promise<BuddyGroup>;
}

export function createPlanner(
  api: PluginAPI,
  store: GroupStore,
  sharedDir: SharedDirectory,
  injector: ConfigInjector,
): PlannerOrchestrator {

  async function startPlanning(group: BuddyGroup): Promise<BuddyGroup> {
    if (!group.mission) throw new Error("No mission assigned to group");
    if (!group.leaderId) throw new Error("No leader designated for group");

    const leader = group.members.find(m => m.id === group.leaderId);
    if (!leader) throw new Error("Leader not found in group members");

    // Create the shared directory
    await sharedDir.create(group);

    // Inject config into leader's project
    await injector.injectMemberConfig(group, leader);

    // Update group status
    group.status = "planning";
    leader.status = "working";
    await store.save(group);

    // Resume the leader agent with the planning prompt
    const prompt = buildPlanningPrompt(group);
    await api.agents.resume(leader.agentId, { mission: prompt });

    api.logging.info("Planning started", { groupId: group.id, leaderId: leader.agentId });
    return group;
  }

  async function processPlan(group: BuddyGroup): Promise<BuddyGroup> {
    const planContent = await sharedDir.readPlan(group.id);
    if (!planContent) throw new Error("No plan.md found in shared directory");

    const parsed = parsePlan(planContent);
    if (!parsed) throw new Error("Failed to parse plan");

    group.plan = {
      summary: parsed.summary,
      deliverables: parsed.deliverables,
      createdAt: new Date().toISOString(),
    };

    // Link deliverables to members
    for (const d of group.plan.deliverables) {
      const member = group.members.find(m => m.id === d.assigneeId);
      if (member) {
        member.assignmentId = d.id;
      }
    }

    await store.save(group);
    api.logging.info("Plan processed", {
      groupId: group.id,
      deliverableCount: parsed.deliverables.length,
    });
    return group;
  }

  async function startExecution(group: BuddyGroup): Promise<BuddyGroup> {
    if (!group.plan) throw new Error("No plan available — run planning first");

    group.status = "executing";

    for (const member of group.members) {
      // Inject group-specific config into each member's project
      await injector.injectMemberConfig(group, member);

      // Find the member's assigned deliverable
      const deliverable = group.plan.deliverables.find(d => d.assigneeId === member.id);
      if (!deliverable) continue;

      // Write their assignment file
      await sharedDir.writeAssignment(group.id, member, deliverable);

      // Check if agent is in a resumable state
      const agents = api.agents.list();
      const agentInfo = agents.find(a => a.id === member.agentId);
      if (!agentInfo || agentInfo.status !== "sleeping") {
        member.status = "idle";
        api.logging.warn("Agent not in sleeping state, skipping resume", {
          memberId: member.id,
          agentId: member.agentId,
          agentStatus: agentInfo?.status ?? "not found",
        });
        continue;
      }

      // Resume the agent with their assignment
      member.status = "working";
      const prompt = buildAssignmentPrompt(group, member, deliverable);
      await api.agents.resume(member.agentId, { mission: prompt });
    }

    await store.save(group);
    api.logging.info("Execution started", { groupId: group.id });
    return group;
  }

  return { startPlanning, processPlan, startExecution };
}
