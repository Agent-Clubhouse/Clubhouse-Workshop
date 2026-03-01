// ---------------------------------------------------------------------------
// Config Injector — Injects group-specific skills and permissions into agents
// ---------------------------------------------------------------------------

import type { AgentConfigAPI } from "@clubhouse/plugin-types";
import type { BuddyGroup, GroupMember } from "../types";

const BUDDY_ROOT = "~/.clubhouse/buddy-system";

function buildGroupSkill(group: BuddyGroup, member: GroupMember): string {
  const leader = group.members.find(m => m.isLeader);
  const groupDir = `${BUDDY_ROOT}/${group.id}`;

  return `# Buddy System Member

You are part of a buddy group: **${group.name}**.

## Your Role
- Member ID: ${member.id}
- Group Leader: ${leader?.agentName ?? "unassigned"} (${leader?.projectName ?? "unknown"})
- Your Assignment: See \`${groupDir}/assignments/${member.id}.md\`

## Work Loop

Follow this loop for every unit of work (a function, a file, a logical step):

1. **Read** — Check \`${groupDir}/comms/\` and \`shared/\` for updates from other members. Look for new decisions, interface changes, or messages that affect your work.
2. **Work** — Implement the next piece of your assignment. Commit your code frequently with clear, descriptive messages.
3. **Write status** — After each commit, update your status file:
   \`${groupDir}/status/${member.id}.json\`
4. **Share** — If you made a decision, discovered something, or changed an interface that affects other members, write it to the appropriate shared file before continuing.
5. **Repeat** — Go back to step 1.

Do NOT batch large amounts of work before checking in. The loop should be tight: read, work a small unit, commit, write status, share, repeat.

## Status Format

Write to \`${groupDir}/status/${member.id}.json\`:
\`\`\`json
{
  "status": "working",
  "deliverableId": "...",
  "progress": "brief description of current state",
  "blockers": [],
  "lastCheckin": "${new Date().toISOString()}"
}
\`\`\`

## Paths

| Action | Path |
|--------|------|
| Read your assignment | \`${groupDir}/assignments/${member.id}.md\` |
| Update your status | \`${groupDir}/status/${member.id}.json\` |
| Read others' status | \`${groupDir}/status/\` |
| Read comms | \`${groupDir}/comms/\` |
| Write a message | \`${groupDir}/comms/{timestamp}-${member.id}.md\` |
| Log a design decision | Append to \`${groupDir}/shared/decisions.md\` |
| Update shared interfaces | \`${groupDir}/shared/interfaces.md\` |

## Rules
- **Always** read the shared directory before starting a new unit of work
- **Always** commit and update your status after completing a unit of work
- When you make a design decision that affects others, write it to \`decisions.md\` immediately
- When you define or change a shared interface, update \`interfaces.md\` immediately
- If blocked on another member's work, write a comms message explaining what you need and set your status to \`blocked\`
- When all deliverables assigned to you are complete, set status to \`done\`
`;
}

function buildInstructions(group: BuddyGroup, member: GroupMember): string {
  return `You are participating in a Buddy System group "${group.name}". Check your assignment at ~/.clubhouse/buddy-system/${group.id}/assignments/${member.id}.md and follow the buddy-system-mission skill for communication protocols.`;
}

function buildPermissionRules(groupId: string): string[] {
  return [
    `Bash(read:~/.clubhouse/buddy-system/**)`,
    `Bash(write:~/.clubhouse/buddy-system/${groupId}/**)`,
  ];
}

export interface ConfigInjector {
  /** Inject group-specific config into a member's project. */
  injectMemberConfig(group: BuddyGroup, member: GroupMember): Promise<void>;
  /** Remove injected config when a member leaves or group is disbanded. */
  removeMemberConfig(member: GroupMember): Promise<void>;
}

export function createConfigInjector(agentConfig: AgentConfigAPI): ConfigInjector {
  async function injectMemberConfig(group: BuddyGroup, member: GroupMember): Promise<void> {
    const opts = { projectId: member.projectId };
    await agentConfig.injectSkill(
      "buddy-system-mission",
      buildGroupSkill(group, member),
      opts,
    );
    await agentConfig.appendInstructions(buildInstructions(group, member), opts);
    await agentConfig.addPermissionAllowRules(buildPermissionRules(group.id), opts);
  }

  async function removeMemberConfig(member: GroupMember): Promise<void> {
    const opts = { projectId: member.projectId };
    await agentConfig.removeSkill("buddy-system-mission", opts);
    await agentConfig.removeInstructionAppend(opts);
    await agentConfig.removePermissionRules(opts);
  }

  return { injectMemberConfig, removeMemberConfig };
}
