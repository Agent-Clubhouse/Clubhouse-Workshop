// src/names.ts
var ADJECTIVES = [
  "bold",
  "brave",
  "bright",
  "clever",
  "cosmic",
  "daring",
  "epic",
  "fierce",
  "golden",
  "grand",
  "hidden",
  "iron",
  "keen",
  "lunar",
  "mighty",
  "noble",
  "prime",
  "proud",
  "rapid",
  "regal",
  "royal",
  "shadow",
  "silent",
  "solar",
  "stellar",
  "swift",
  "valiant",
  "vivid",
  "wild",
  "wise"
];
var GROUP_WORDS = [
  "alliance",
  "band",
  "brigade",
  "cadre",
  "clan",
  "cohort",
  "crew",
  "ensemble",
  "force",
  "guild",
  "league",
  "order",
  "pack",
  "patrol",
  "posse",
  "squad",
  "team",
  "troupe",
  "unit",
  "vanguard"
];
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function generateGroupName(existing) {
  const maxAttempts = 50;
  for (let i = 0; i < maxAttempts; i++) {
    const name = `${randomItem(ADJECTIVES)}-${randomItem(GROUP_WORDS)}`;
    if (!existing || !existing.has(name)) return name;
  }
  const base = `${randomItem(ADJECTIVES)}-${randomItem(GROUP_WORDS)}`;
  return `${base}-${Date.now() % 1e4}`;
}

// src/state/groups.ts
var INDEX_KEY = "groups/index";
function groupKey(id) {
  return `groups/${id}`;
}
function uuid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function createGroupStore(storage) {
  async function readIndex() {
    const raw = await storage.read(INDEX_KEY);
    if (Array.isArray(raw)) return raw;
    return [];
  }
  async function writeIndex(ids) {
    await storage.write(INDEX_KEY, ids);
  }
  async function loadAll() {
    const ids = await readIndex();
    const groups = [];
    for (const id of ids) {
      const raw = await storage.read(groupKey(id));
      if (raw && typeof raw === "object") {
        groups.push(raw);
      }
    }
    return groups;
  }
  async function get(id) {
    const raw = await storage.read(groupKey(id));
    if (raw && typeof raw === "object") return raw;
    return null;
  }
  async function create() {
    const ids = await readIndex();
    const existingGroups = await loadAll();
    const existingNames = new Set(existingGroups.map((g) => g.name));
    const id = uuid();
    const group = {
      id,
      name: generateGroupName(existingNames),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "idle",
      leaderId: "",
      members: []
    };
    await storage.write(groupKey(id), group);
    await writeIndex([...ids, id]);
    return group;
  }
  async function save(group) {
    await storage.write(groupKey(group.id), group);
  }
  async function remove(id) {
    const ids = await readIndex();
    await writeIndex(ids.filter((i) => i !== id));
    await storage.delete(groupKey(id));
  }
  async function rename(id, name) {
    const group = await get(id);
    if (!group) throw new Error(`Group ${id} not found`);
    group.name = name;
    await save(group);
    return group;
  }
  async function addMember(groupId, member) {
    const group = await get(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);
    const isFirst = group.members.length === 0;
    const newMember = {
      ...member,
      id: uuid(),
      isLeader: isFirst,
      status: "idle"
    };
    group.members.push(newMember);
    if (isFirst) {
      group.leaderId = newMember.id;
    }
    await save(group);
    return group;
  }
  async function removeMember(groupId, memberId) {
    const group = await get(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);
    const wasLeader = group.members.find((m) => m.id === memberId)?.isLeader;
    group.members = group.members.filter((m) => m.id !== memberId);
    if (wasLeader && group.members.length > 0) {
      group.members[0].isLeader = true;
      group.leaderId = group.members[0].id;
    } else if (group.members.length === 0) {
      group.leaderId = "";
    }
    await save(group);
    return group;
  }
  async function setLeader(groupId, memberId) {
    const group = await get(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);
    const target = group.members.find((m) => m.id === memberId);
    if (!target) throw new Error(`Member ${memberId} not found in group ${groupId}`);
    for (const m of group.members) {
      m.isLeader = m.id === memberId;
    }
    group.leaderId = memberId;
    await save(group);
    return group;
  }
  return { loadAll, get, create, save, remove, rename, addMember, removeMember, setLeader };
}

// src/orchestration/shared-dir.ts
var BUDDY_ROOT = "~/.clubhouse/buddy-system";
function groupDir(groupId) {
  return `${BUDDY_ROOT}/${groupId}`;
}
function createSharedDirectory(files) {
  async function create(group) {
    const base = groupDir(group.id);
    await files.mkdir(base);
    await files.mkdir(`${base}/assignments`);
    await files.mkdir(`${base}/status`);
    await files.mkdir(`${base}/comms`);
    await files.mkdir(`${base}/shared`);
    await files.writeFile(`${base}/shared/decisions.md`, "# Design Decisions\n\n");
    await files.writeFile(`${base}/shared/interfaces.md`, "# Shared Interfaces\n\n");
  }
  async function writePlan(groupId, planContent) {
    await files.writeFile(`${groupDir(groupId)}/plan.md`, planContent);
  }
  async function readPlan(groupId) {
    try {
      return await files.readFile(`${groupDir(groupId)}/plan.md`);
    } catch {
      return null;
    }
  }
  async function writeAssignment(groupId, member, deliverable) {
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
      deliverable.dependencies?.length ? `## Dependencies

This deliverable depends on: ${deliverable.dependencies.join(", ")}
` : "",
      "## Communication",
      "",
      `Update your status at: ${groupDir(groupId)}/status/${member.id}.json`,
      `Write comms to: ${groupDir(groupId)}/comms/`,
      `Check shared decisions: ${groupDir(groupId)}/shared/decisions.md`,
      `Check shared interfaces: ${groupDir(groupId)}/shared/interfaces.md`
    ].join("\n");
    await files.writeFile(`${groupDir(groupId)}/assignments/${member.id}.md`, content);
  }
  async function readMemberStatus(groupId, memberId) {
    try {
      const raw = await files.readFile(`${groupDir(groupId)}/status/${memberId}.json`);
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  function watchGlob(groupId) {
    return `${groupDir(groupId)}/**/*`;
  }
  function groupPath(groupId) {
    return groupDir(groupId);
  }
  return { create, writePlan, readPlan, writeAssignment, readMemberStatus, watchGlob, groupPath };
}

// src/orchestration/plan-parser.ts
function parsePlan(content) {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const fmMatch = trimmed.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { summary: trimmed, deliverables: [] };
  }
  const yamlBlock = fmMatch[1];
  const body = fmMatch[2].trim();
  const deliverables = parseDeliverables(yamlBlock);
  return {
    summary: body || "Plan provided (see deliverables)",
    deliverables
  };
}
function parseDeliverables(yaml) {
  const deliverables = [];
  const lines = yaml.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].match(/^\s*deliverables:\s*$/)) {
    i++;
  }
  if (i >= lines.length) return [];
  i++;
  let current = null;
  while (i < lines.length) {
    const line = lines[i];
    const idMatch = line.match(/^\s+-\s+id:\s*(.+)/);
    if (idMatch) {
      if (current?.id) {
        deliverables.push(finishDeliverable(current));
      }
      current = { id: idMatch[1].trim().replace(/^["']|["']$/g, "") };
      i++;
      continue;
    }
    if (current && line.match(/^\s{4,}/)) {
      const kvMatch = line.match(/^\s+(title|assignee|description|dependencies):\s*(.+)/);
      if (kvMatch) {
        const key = kvMatch[1];
        const val = kvMatch[2].trim().replace(/^["']|["']$/g, "");
        if (key === "title") current.title = val;
        else if (key === "description") current.description = val;
        else if (key === "assignee") current.assigneeId = val;
        else if (key === "dependencies") current.dependencies = parseDependencyList(val);
      }
      i++;
      continue;
    }
    if (!line.match(/^\s/) && line.trim() !== "") break;
    i++;
  }
  if (current?.id) {
    deliverables.push(finishDeliverable(current));
  }
  return deliverables;
}
function parseDependencyList(val) {
  const cleaned = val.replace(/[\[\]"']/g, "").trim();
  if (!cleaned) return [];
  return cleaned.split(",").map((s) => s.trim()).filter(Boolean);
}
function finishDeliverable(partial) {
  return {
    id: partial.id || "unknown",
    title: partial.title || "Untitled deliverable",
    description: partial.description || "",
    assigneeId: partial.assigneeId || "",
    status: "pending",
    dependencies: partial.dependencies || []
  };
}

// src/orchestration/planner.ts
function buildPlanningPrompt(group) {
  const memberList = group.members.map((m) => `- **${m.agentName}** (${m.projectName}): ${m.context}${m.isLeader ? " [LEADER \u2014 that's you]" : ""}`).join("\n");
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
${group.members.map((m) => `- ${m.id}: ${m.agentName} (${m.projectName})`).join("\n")}`;
}
function buildAssignmentPrompt(group, member, deliverable) {
  return `You have been assigned work as part of buddy group "${group.name}".

Your deliverable: **${deliverable.title}**
${deliverable.description}

${deliverable.dependencies?.length ? `This depends on: ${deliverable.dependencies.join(", ")}. Check the shared directory for status on those items before starting.` : ""}

Read your full assignment at: ~/.clubhouse/buddy-system/${group.id}/assignments/${member.id}.md

Follow the buddy-system-mission skill for the work loop and communication protocol.`;
}
function createPlanner(api, store, sharedDir2, injector2) {
  async function startPlanning(group) {
    if (!group.mission) throw new Error("No mission assigned to group");
    if (!group.leaderId) throw new Error("No leader designated for group");
    const leader = group.members.find((m) => m.id === group.leaderId);
    if (!leader) throw new Error("Leader not found in group members");
    await sharedDir2.create(group);
    await injector2.injectMemberConfig(group, leader);
    group.status = "planning";
    leader.status = "working";
    await store.save(group);
    const prompt = buildPlanningPrompt(group);
    await api.agents.resume(leader.agentId, { mission: prompt });
    api.logging.info("Planning started", { groupId: group.id, leaderId: leader.agentId });
    return group;
  }
  async function processPlan(group) {
    const planContent = await sharedDir2.readPlan(group.id);
    if (!planContent) throw new Error("No plan.md found in shared directory");
    const parsed = parsePlan(planContent);
    if (!parsed) throw new Error("Failed to parse plan");
    group.plan = {
      summary: parsed.summary,
      deliverables: parsed.deliverables,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    for (const d of group.plan.deliverables) {
      const member = group.members.find((m) => m.id === d.assigneeId);
      if (member) {
        member.assignmentId = d.id;
      }
    }
    await store.save(group);
    api.logging.info("Plan processed", {
      groupId: group.id,
      deliverableCount: parsed.deliverables.length
    });
    return group;
  }
  async function startExecution(group) {
    if (!group.plan) throw new Error("No plan available \u2014 run planning first");
    group.status = "executing";
    for (const member of group.members) {
      await injector2.injectMemberConfig(group, member);
      const deliverable = group.plan.deliverables.find((d) => d.assigneeId === member.id);
      if (!deliverable) continue;
      await sharedDir2.writeAssignment(group.id, member, deliverable);
      const agents = api.agents.list();
      const agentInfo = agents.find((a) => a.id === member.agentId);
      if (!agentInfo || agentInfo.status !== "sleeping") {
        member.status = "idle";
        api.logging.warn("Agent not in sleeping state, skipping resume", {
          memberId: member.id,
          agentId: member.agentId,
          agentStatus: agentInfo?.status ?? "not found"
        });
        continue;
      }
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

// src/orchestration/monitor.ts
function createGroupMonitor(api, store, sharedDir2, onEvent) {
  const watchers = /* @__PURE__ */ new Map();
  function start(groupId) {
    if (watchers.has(groupId)) return;
    const glob = sharedDir2.watchGlob(groupId);
    const disposable = api.files.watch(glob, (events) => {
      handleFileEvents(groupId, events);
    });
    watchers.set(groupId, disposable);
    api.logging.info("Monitor started", { groupId });
  }
  async function handleFileEvents(groupId, events) {
    for (const event of events) {
      if (event.type === "deleted") continue;
      if (event.path.endsWith("/plan.md")) {
        onEvent(groupId, { type: "plan-detected", groupId });
        continue;
      }
      const statusMatch = event.path.match(/\/status\/(.+)\.json$/);
      if (statusMatch) {
        const memberId = statusMatch[1];
        const status = await sharedDir2.readMemberStatus(groupId, memberId);
        if (status) {
          onEvent(groupId, { type: "status-updated", groupId, memberId, status });
          await checkAllDone(groupId);
        }
        continue;
      }
      if (event.path.includes("/comms/")) {
        onEvent(groupId, { type: "comms-new", groupId, path: event.path });
        continue;
      }
    }
  }
  async function checkAllDone(groupId) {
    const group = await store.get(groupId);
    if (!group || group.status !== "executing") return;
    const allDone = group.members.every((m) => {
      if (!m.assignmentId) return true;
      return m.status === "done";
    });
    if (allDone) {
      onEvent(groupId, { type: "all-done", groupId });
    }
  }
  function stop(groupId) {
    const disposable = watchers.get(groupId);
    if (disposable) {
      disposable.dispose();
      watchers.delete(groupId);
      api.logging.info("Monitor stopped", { groupId });
    }
  }
  function stopAll() {
    for (const [id, disposable] of watchers) {
      disposable.dispose();
    }
    watchers.clear();
  }
  return { start, stop, stopAll };
}

// src/config/injector.ts
var BUDDY_ROOT2 = "~/.clubhouse/buddy-system";
function buildGroupSkill(group, member) {
  const leader = group.members.find((m) => m.isLeader);
  const groupDir2 = `${BUDDY_ROOT2}/${group.id}`;
  return `# Buddy System Member

You are part of a buddy group: **${group.name}**.

## Your Role
- Member ID: ${member.id}
- Group Leader: ${leader?.agentName ?? "unassigned"} (${leader?.projectName ?? "unknown"})
- Your Assignment: See \`${groupDir2}/assignments/${member.id}.md\`

## Work Loop

Follow this loop for every unit of work (a function, a file, a logical step):

1. **Read** \u2014 Check \`${groupDir2}/comms/\` and \`shared/\` for updates from other members. Look for new decisions, interface changes, or messages that affect your work.
2. **Work** \u2014 Implement the next piece of your assignment. Commit your code frequently with clear, descriptive messages.
3. **Write status** \u2014 After each commit, update your status file:
   \`${groupDir2}/status/${member.id}.json\`
4. **Share** \u2014 If you made a decision, discovered something, or changed an interface that affects other members, write it to the appropriate shared file before continuing.
5. **Repeat** \u2014 Go back to step 1.

Do NOT batch large amounts of work before checking in. The loop should be tight: read, work a small unit, commit, write status, share, repeat.

## Status Format

Write to \`${groupDir2}/status/${member.id}.json\`:
\`\`\`json
{
  "status": "working",
  "deliverableId": "...",
  "progress": "brief description of current state",
  "blockers": [],
  "lastCheckin": "${(/* @__PURE__ */ new Date()).toISOString()}"
}
\`\`\`

## Paths

| Action | Path |
|--------|------|
| Read your assignment | \`${groupDir2}/assignments/${member.id}.md\` |
| Update your status | \`${groupDir2}/status/${member.id}.json\` |
| Read others' status | \`${groupDir2}/status/\` |
| Read comms | \`${groupDir2}/comms/\` |
| Write a message | \`${groupDir2}/comms/{timestamp}-${member.id}.md\` |
| Log a design decision | Append to \`${groupDir2}/shared/decisions.md\` |
| Update shared interfaces | \`${groupDir2}/shared/interfaces.md\` |

## Rules
- **Always** read the shared directory before starting a new unit of work
- **Always** commit and update your status after completing a unit of work
- When you make a design decision that affects others, write it to \`decisions.md\` immediately
- When you define or change a shared interface, update \`interfaces.md\` immediately
- If blocked on another member's work, write a comms message explaining what you need and set your status to \`blocked\`
- When all deliverables assigned to you are complete, set status to \`done\`
`;
}
function buildInstructions(group, member) {
  return `You are participating in a Buddy System group "${group.name}". Check your assignment at ~/.clubhouse/buddy-system/${group.id}/assignments/${member.id}.md and follow the buddy-system-mission skill for communication protocols.`;
}
function buildPermissionRules(groupId) {
  return [
    `Bash(read:~/.clubhouse/buddy-system/**)`,
    `Bash(write:~/.clubhouse/buddy-system/${groupId}/**)`
  ];
}
function createConfigInjector(agentConfig) {
  async function injectMemberConfig(group, member) {
    const opts = { projectId: member.projectId };
    await agentConfig.injectSkill(
      "buddy-system-mission",
      buildGroupSkill(group, member),
      opts
    );
    await agentConfig.appendInstructions(buildInstructions(group, member), opts);
    await agentConfig.addPermissionAllowRules(buildPermissionRules(group.id), opts);
  }
  async function removeMemberConfig(member) {
    const opts = { projectId: member.projectId };
    await agentConfig.removeSkill("buddy-system-mission", opts);
    await agentConfig.removeInstructionAppend(opts);
    await agentConfig.removePermissionRules(opts);
  }
  return { injectMemberConfig, removeMemberConfig };
}

// src/use-theme.ts
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function mapThemeToCSS(theme) {
  const c = theme.colors;
  const onAccent = theme.type === "dark" ? "#ffffff" : "#000000";
  return {
    "--text-primary": c.text,
    "--text-secondary": c.subtext1,
    "--text-tertiary": c.subtext0,
    "--text-muted": c.surface2,
    "--text-error": c.error,
    "--text-success": c.success,
    "--text-warning": c.warning,
    "--text-info": c.info,
    "--text-accent": c.accent,
    "--text-on-accent": onAccent,
    "--bg-primary": c.base,
    "--bg-secondary": c.mantle,
    "--bg-tertiary": c.crust,
    "--bg-surface": c.surface0,
    "--bg-surface-hover": c.surface1,
    "--bg-surface-raised": c.surface2,
    "--bg-active": c.surface1,
    "--bg-error": hexToRgba(c.error, 0.1),
    "--bg-success": hexToRgba(c.success, 0.15),
    "--bg-warning": hexToRgba(c.warning, 0.15),
    "--bg-info": hexToRgba(c.info, 0.1),
    "--bg-accent": hexToRgba(c.accent, 0.15),
    "--border-primary": c.surface0,
    "--border-secondary": c.surface1,
    "--border-accent": hexToRgba(c.accent, 0.3),
    "--shadow": "rgba(0, 0, 0, 0.3)",
    "--shadow-light": "rgba(0, 0, 0, 0.15)",
    "--font-family": "system-ui, -apple-system, sans-serif",
    "--font-mono": "ui-monospace, monospace"
  };
}
function useTheme(themeApi) {
  const React8 = globalThis.React;
  const [theme, setTheme] = React8.useState(() => themeApi.getCurrent());
  React8.useEffect(() => {
    setTheme(themeApi.getCurrent());
    const disposable = themeApi.onDidChange((t) => setTheme(t));
    return () => disposable.dispose();
  }, [themeApi]);
  const style = React8.useMemo(() => mapThemeToCSS(theme), [theme]);
  return { style, themeType: theme.type };
}

// src/ui/GroupList.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var React = globalThis.React;
var STATUS_LABELS = {
  idle: "Idle",
  planning: "Planning",
  executing: "Executing",
  complete: "Complete",
  archived: "Archived"
};
function statusColor(status) {
  switch (status) {
    case "executing":
      return "var(--text-info)";
    case "planning":
      return "var(--text-warning)";
    case "complete":
      return "var(--text-success)";
    case "archived":
      return "var(--text-muted)";
    default:
      return "var(--text-secondary)";
  }
}
function GroupList({ groups, onSelect, onCreate, onDelete }) {
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", height: "100%" }, children: [
    /* @__PURE__ */ jsxs("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 20px 12px",
      borderBottom: "1px solid var(--border-primary)"
    }, children: [
      /* @__PURE__ */ jsx("h2", { style: {
        margin: 0,
        fontSize: 16,
        fontWeight: 600,
        color: "var(--text-primary)",
        fontFamily: "var(--font-family)"
      }, children: "Buddy Groups" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onCreate,
          style: {
            background: "var(--bg-accent)",
            color: "var(--text-accent)",
            border: "1px solid var(--border-accent)",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "var(--font-family)"
          },
          children: "+ New Group"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, overflow: "auto", padding: "8px 12px" }, children: [
      groups.length === 0 && /* @__PURE__ */ jsx("div", { style: {
        textAlign: "center",
        padding: "48px 24px",
        color: "var(--text-tertiary)",
        fontSize: 14,
        fontFamily: "var(--font-family)"
      }, children: "No buddy groups yet. Create one to get started." }),
      groups.map((group) => /* @__PURE__ */ jsxs(
        "div",
        {
          onClick: () => onSelect(group),
          style: {
            padding: "14px 16px",
            marginBottom: 6,
            borderRadius: 8,
            border: "1px solid var(--border-primary)",
            cursor: "pointer",
            background: "var(--bg-primary)",
            transition: "background 0.15s"
          },
          onMouseEnter: (e) => {
            e.currentTarget.style.background = "var(--bg-surface-hover)";
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.background = "var(--bg-primary)";
          },
          children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsx("span", { style: {
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)"
              }, children: group.name }),
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ jsx("span", { style: {
                  fontSize: 11,
                  fontWeight: 500,
                  color: statusColor(group.status),
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }, children: STATUS_LABELS[group.status] ?? group.status }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: (e) => {
                      e.stopPropagation();
                      onDelete(group.id);
                    },
                    title: "Delete group",
                    style: {
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: 14,
                      padding: "2px 4px",
                      lineHeight: 1,
                      borderRadius: 4
                    },
                    onMouseEnter: (e) => {
                      e.currentTarget.style.color = "var(--text-error)";
                    },
                    onMouseLeave: (e) => {
                      e.currentTarget.style.color = "var(--text-muted)";
                    },
                    children: "x"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: {
              fontSize: 12,
              color: "var(--text-tertiary)",
              marginTop: 4,
              fontFamily: "var(--font-family)"
            }, children: [
              group.members.length,
              " member",
              group.members.length !== 1 ? "s" : "",
              group.mission ? ` \xB7 ${group.mission.slice(0, 60)}${group.mission.length > 60 ? "..." : ""}` : " \xB7 No work assigned"
            ] })
          ]
        },
        group.id
      ))
    ] })
  ] });
}

// src/ui/MemberCard.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var React2 = globalThis.React;
function memberStatusIcon(status) {
  switch (status) {
    case "working":
      return "\u25CF";
    case "blocked":
      return "!";
    case "done":
      return "\u2713";
    case "error":
      return "\u2717";
    case "creating":
      return "\u2026";
    default:
      return "\u25CB";
  }
}
function memberStatusColor(status) {
  switch (status) {
    case "working":
      return "var(--text-info)";
    case "blocked":
      return "var(--text-warning)";
    case "done":
      return "var(--text-success)";
    case "error":
      return "var(--text-error)";
    default:
      return "var(--text-muted)";
  }
}
function MemberCard({ api, member, onRemove, onSetLeader }) {
  const { AgentAvatar } = api.widgets;
  return /* @__PURE__ */ jsxs2("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid var(--border-primary)",
    background: member.isLeader ? "var(--bg-accent)" : "var(--bg-primary)",
    marginBottom: 4
  }, children: [
    /* @__PURE__ */ jsx2(AgentAvatar, { agentId: member.agentId, size: "sm", showStatusRing: true }),
    /* @__PURE__ */ jsxs2("div", { style: { flex: 1, minWidth: 0 }, children: [
      /* @__PURE__ */ jsxs2("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [
        member.isLeader && /* @__PURE__ */ jsx2("span", { title: "Group leader", style: { fontSize: 12 }, children: "\u2605" }),
        /* @__PURE__ */ jsx2("span", { style: {
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-primary)",
          fontFamily: "var(--font-family)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }, children: member.agentName })
      ] }),
      /* @__PURE__ */ jsx2("div", { style: {
        fontSize: 11,
        color: "var(--text-tertiary)",
        fontFamily: "var(--font-family)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }, children: member.projectName })
    ] }),
    /* @__PURE__ */ jsx2(
      "span",
      {
        title: member.status,
        style: {
          fontSize: 13,
          color: memberStatusColor(member.status),
          fontWeight: 600
        },
        children: memberStatusIcon(member.status)
      }
    ),
    /* @__PURE__ */ jsxs2("div", { style: { display: "flex", gap: 4 }, children: [
      !member.isLeader && /* @__PURE__ */ jsx2(
        "button",
        {
          onClick: () => onSetLeader(member.id),
          title: "Make leader",
          style: {
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 11,
            padding: "2px 4px",
            borderRadius: 4
          },
          onMouseEnter: (e) => {
            e.currentTarget.style.color = "var(--text-accent)";
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.color = "var(--text-muted)";
          },
          children: "\u2605"
        }
      ),
      /* @__PURE__ */ jsx2(
        "button",
        {
          onClick: () => onRemove(member.id),
          title: "Remove member",
          style: {
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 12,
            padding: "2px 4px",
            borderRadius: 4
          },
          onMouseEnter: (e) => {
            e.currentTarget.style.color = "var(--text-error)";
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.color = "var(--text-muted)";
          },
          children: "x"
        }
      )
    ] })
  ] });
}

// src/ui/AddMemberDialog.tsx
import { Fragment, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var React3 = globalThis.React;
var { useState, useEffect, useMemo, useCallback } = React3;
function AddMemberDialog({ api, existingAgentIds, onAdd, onCancel }) {
  const [agents, setAgents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [context, setContext] = useState("");
  useEffect(() => {
    const allAgents = api.agents.list();
    const eligible = allAgents.filter(
      (a) => a.kind === "durable" && !existingAgentIds.includes(a.id)
    );
    setAgents(eligible);
    setProjects(api.projects.list());
    if (eligible.length > 0) setSelectedAgentId(eligible[0].id);
  }, [api, existingAgentIds]);
  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId),
    [agents, selectedAgentId]
  );
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedAgent?.projectId),
    [projects, selectedAgent]
  );
  const handleAdd = useCallback(() => {
    if (selectedAgent && selectedProject) {
      onAdd(selectedAgent, selectedProject, context);
    }
  }, [selectedAgent, selectedProject, context, onAdd]);
  return /* @__PURE__ */ jsxs3("div", { style: {
    padding: 16,
    border: "1px solid var(--border-accent)",
    borderRadius: 8,
    background: "var(--bg-secondary)",
    marginBottom: 8
  }, children: [
    /* @__PURE__ */ jsx3("div", { style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--text-primary)",
      marginBottom: 12,
      fontFamily: "var(--font-family)"
    }, children: "Add Member" }),
    agents.length === 0 ? /* @__PURE__ */ jsx3("div", { style: {
      fontSize: 12,
      color: "var(--text-tertiary)",
      fontFamily: "var(--font-family)",
      marginBottom: 12
    }, children: "No eligible durable agents found. Start a durable agent in a project first." }) : /* @__PURE__ */ jsxs3(Fragment, { children: [
      /* @__PURE__ */ jsx3("label", { style: {
        display: "block",
        fontSize: 11,
        color: "var(--text-secondary)",
        marginBottom: 4,
        fontFamily: "var(--font-family)"
      }, children: "Agent" }),
      /* @__PURE__ */ jsx3(
        "select",
        {
          value: selectedAgentId,
          onChange: (e) => setSelectedAgentId(e.target.value),
          style: {
            width: "100%",
            padding: "6px 8px",
            fontSize: 13,
            borderRadius: 4,
            border: "1px solid var(--border-primary)",
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-family)",
            marginBottom: 10
          },
          children: agents.map((a) => {
            const proj = projects.find((p) => p.id === a.projectId);
            return /* @__PURE__ */ jsxs3("option", { value: a.id, children: [
              a.name,
              " (",
              proj?.name ?? a.projectId,
              ")"
            ] }, a.id);
          })
        }
      ),
      /* @__PURE__ */ jsx3("label", { style: {
        display: "block",
        fontSize: 11,
        color: "var(--text-secondary)",
        marginBottom: 4,
        fontFamily: "var(--font-family)"
      }, children: "Context (role and project info)" }),
      /* @__PURE__ */ jsx3(
        "textarea",
        {
          value: context,
          onChange: (e) => setContext(e.target.value),
          placeholder: "e.g. Backend API agent, handles auth endpoints",
          rows: 2,
          style: {
            width: "100%",
            padding: "6px 8px",
            fontSize: 12,
            borderRadius: 4,
            border: "1px solid var(--border-primary)",
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-family)",
            resize: "vertical",
            marginBottom: 12,
            boxSizing: "border-box"
          }
        }
      )
    ] }),
    /* @__PURE__ */ jsxs3("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" }, children: [
      /* @__PURE__ */ jsx3(
        "button",
        {
          onClick: onCancel,
          style: {
            padding: "6px 14px",
            fontSize: 12,
            borderRadius: 4,
            border: "1px solid var(--border-primary)",
            background: "var(--bg-primary)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontFamily: "var(--font-family)"
          },
          children: "Cancel"
        }
      ),
      agents.length > 0 && /* @__PURE__ */ jsx3(
        "button",
        {
          onClick: handleAdd,
          disabled: !selectedAgent,
          style: {
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 4,
            border: "1px solid var(--border-accent)",
            background: "var(--bg-accent)",
            color: "var(--text-accent)",
            cursor: selectedAgent ? "pointer" : "not-allowed",
            opacity: selectedAgent ? 1 : 0.5,
            fontFamily: "var(--font-family)"
          },
          children: "Add Member"
        }
      )
    ] })
  ] });
}

// src/ui/MissionInput.tsx
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var React4 = globalThis.React;
var { useState: useState2, useCallback: useCallback2 } = React4;
function MissionInput({ onSubmit, disabled, hasLeader, memberCount }) {
  const [text, setText] = useState2("");
  const canSubmit = text.trim().length > 0 && hasLeader && memberCount >= 1 && !disabled;
  const handleSubmit = useCallback2(() => {
    if (!canSubmit) return;
    onSubmit(text.trim());
    setText("");
  }, [text, canSubmit, onSubmit]);
  let hint = "";
  if (memberCount === 0) hint = "Add at least one member before assigning work.";
  else if (!hasLeader) hint = "Designate a group leader before assigning work.";
  else if (disabled) hint = "Group is already planning or executing.";
  return /* @__PURE__ */ jsxs4("div", { style: { marginBottom: 20 }, children: [
    /* @__PURE__ */ jsx4("h3", { style: {
      margin: "0 0 8px 0",
      fontSize: 13,
      fontWeight: 600,
      color: "var(--text-secondary)",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      fontFamily: "var(--font-family)"
    }, children: "Assign Work" }),
    /* @__PURE__ */ jsx4(
      "textarea",
      {
        value: text,
        onChange: (e) => setText(e.target.value),
        placeholder: "Describe what you want this group to accomplish...",
        rows: 4,
        disabled,
        style: {
          width: "100%",
          padding: "10px 12px",
          fontSize: 13,
          borderRadius: 6,
          border: "1px solid var(--border-primary)",
          background: disabled ? "var(--bg-surface)" : "var(--bg-primary)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-family)",
          resize: "vertical",
          boxSizing: "border-box",
          lineHeight: 1.5,
          opacity: disabled ? 0.6 : 1
        }
      }
    ),
    hint && /* @__PURE__ */ jsx4("div", { style: {
      fontSize: 11,
      color: "var(--text-tertiary)",
      marginTop: 4,
      fontFamily: "var(--font-family)"
    }, children: hint }),
    /* @__PURE__ */ jsx4("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 8 }, children: /* @__PURE__ */ jsx4(
      "button",
      {
        onClick: handleSubmit,
        disabled: !canSubmit,
        style: {
          padding: "8px 18px",
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 6,
          border: "1px solid var(--border-accent)",
          background: canSubmit ? "var(--bg-accent)" : "var(--bg-surface)",
          color: canSubmit ? "var(--text-accent)" : "var(--text-muted)",
          cursor: canSubmit ? "pointer" : "not-allowed",
          fontFamily: "var(--font-family)"
        },
        children: "Start Mission"
      }
    ) })
  ] });
}

// src/ui/PlanView.tsx
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
var React5 = globalThis.React;
function deliverableStatusColor(status) {
  switch (status) {
    case "in-progress":
      return "var(--text-info)";
    case "review":
      return "var(--text-warning)";
    case "complete":
      return "var(--text-success)";
    case "blocked":
      return "var(--text-error)";
    default:
      return "var(--text-muted)";
  }
}
function deliverableStatusLabel(status) {
  switch (status) {
    case "in-progress":
      return "Working";
    case "review":
      return "Review";
    case "complete":
      return "Done";
    case "blocked":
      return "Blocked";
    default:
      return "Pending";
  }
}
function findMember(group, memberId) {
  return group.members.find((m) => m.id === memberId);
}
function PlanView({ group }) {
  if (!group.plan) return null;
  const { plan } = group;
  const completedCount = plan.deliverables.filter((d) => d.status === "complete").length;
  const totalCount = plan.deliverables.length;
  return /* @__PURE__ */ jsxs5("div", { style: { marginBottom: 20 }, children: [
    /* @__PURE__ */ jsxs5("h3", { style: {
      margin: "0 0 8px 0",
      fontSize: 13,
      fontWeight: 600,
      color: "var(--text-secondary)",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      fontFamily: "var(--font-family)"
    }, children: [
      "Plan (",
      completedCount,
      "/",
      totalCount,
      " complete)"
    ] }),
    /* @__PURE__ */ jsx5("div", { style: {
      fontSize: 13,
      color: "var(--text-primary)",
      fontFamily: "var(--font-family)",
      background: "var(--bg-surface)",
      padding: "10px 14px",
      borderRadius: 6,
      lineHeight: 1.5,
      marginBottom: 12
    }, children: plan.summary.length > 300 ? `${plan.summary.slice(0, 300)}...` : plan.summary }),
    plan.deliverables.map((d) => {
      const assignee = findMember(group, d.assigneeId);
      return /* @__PURE__ */ jsxs5(
        "div",
        {
          style: {
            padding: "10px 14px",
            marginBottom: 4,
            borderRadius: 6,
            border: "1px solid var(--border-primary)",
            background: d.status === "complete" ? "var(--bg-success)" : "var(--bg-primary)"
          },
          children: [
            /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ jsx5("span", { style: {
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)"
                }, children: d.id.toUpperCase() }),
                /* @__PURE__ */ jsx5("span", { style: {
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-family)"
                }, children: d.title })
              ] }),
              /* @__PURE__ */ jsx5("span", { style: {
                fontSize: 11,
                fontWeight: 500,
                color: deliverableStatusColor(d.status),
                textTransform: "uppercase",
                letterSpacing: "0.03em"
              }, children: deliverableStatusLabel(d.status) })
            ] }),
            /* @__PURE__ */ jsxs5("div", { style: {
              fontSize: 11,
              color: "var(--text-tertiary)",
              marginTop: 4,
              fontFamily: "var(--font-family)"
            }, children: [
              assignee ? `\u2192 ${assignee.agentName} (${assignee.projectName})` : `\u2192 unassigned`,
              d.dependencies?.length ? ` \xB7 depends on ${d.dependencies.join(", ")}` : ""
            ] })
          ]
        },
        d.id
      );
    })
  ] });
}

// src/ui/GroupDetail.tsx
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
var React6 = globalThis.React;
var { useState: useState3, useCallback: useCallback3 } = React6;
var STATUS_LABELS2 = {
  idle: "Idle",
  planning: "Planning",
  executing: "Executing",
  complete: "Complete",
  archived: "Archived"
};
function GroupDetail({ api, group, store, planner: planner2, onBack, onGroupUpdated }) {
  const [editing, setEditing] = useState3(false);
  const [nameInput, setNameInput] = useState3(group.name);
  const [showAddMember, setShowAddMember] = useState3(false);
  const isActive = group.status === "planning" || group.status === "executing";
  const handleRename = useCallback3(async () => {
    if (nameInput.trim() && nameInput.trim() !== group.name) {
      const updated = await store.rename(group.id, nameInput.trim());
      onGroupUpdated(updated);
    }
    setEditing(false);
  }, [group, nameInput, store, onGroupUpdated]);
  const handleRemoveMember = useCallback3(async (memberId) => {
    const confirmed = await api.ui.showConfirm("Remove this member from the group?");
    if (!confirmed) return;
    const updated = await store.removeMember(group.id, memberId);
    onGroupUpdated(updated);
  }, [api, group.id, store, onGroupUpdated]);
  const handleSetLeader = useCallback3(async (memberId) => {
    const updated = await store.setLeader(group.id, memberId);
    onGroupUpdated(updated);
  }, [group.id, store, onGroupUpdated]);
  const handleAddMember = useCallback3(async (agent, project, context) => {
    const updated = await store.addMember(group.id, {
      agentId: agent.id,
      agentName: agent.name,
      projectId: project.id,
      projectName: project.name,
      context
    });
    onGroupUpdated(updated);
    setShowAddMember(false);
  }, [group.id, store, onGroupUpdated]);
  const handleAssignMission = useCallback3(async (mission) => {
    if (!planner2) {
      api.ui.showError("Orchestration not available");
      return;
    }
    try {
      group.mission = mission;
      await store.save(group);
      onGroupUpdated({ ...group });
      const updated = await planner2.startPlanning(group);
      onGroupUpdated(updated);
      api.ui.showNotice(`Mission assigned to ${group.name}. Leader is planning...`);
    } catch (err) {
      api.logging.error("Failed to start planning", { error: String(err) });
      api.ui.showError(`Failed to start mission: ${err}`);
    }
  }, [api, group, store, planner2, onGroupUpdated]);
  const handleApprovePlan = useCallback3(async () => {
    if (!planner2) return;
    try {
      let updated = await planner2.processPlan(group);
      onGroupUpdated(updated);
      updated = await planner2.startExecution(updated);
      onGroupUpdated(updated);
      api.ui.showNotice(`Execution started for ${group.name}`);
    } catch (err) {
      api.logging.error("Failed to approve plan", { error: String(err) });
      api.ui.showError(`Failed to start execution: ${err}`);
    }
  }, [api, group, planner2, onGroupUpdated]);
  return /* @__PURE__ */ jsxs6("div", { style: { display: "flex", flexDirection: "column", height: "100%" }, children: [
    /* @__PURE__ */ jsxs6("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "16px 20px 12px",
      borderBottom: "1px solid var(--border-primary)"
    }, children: [
      /* @__PURE__ */ jsx6(
        "button",
        {
          onClick: onBack,
          style: {
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 16,
            padding: "0 4px",
            fontFamily: "var(--font-family)"
          },
          children: "\u2190"
        }
      ),
      editing ? /* @__PURE__ */ jsx6(
        "input",
        {
          value: nameInput,
          onChange: (e) => setNameInput(e.target.value),
          onBlur: handleRename,
          onKeyDown: (e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") {
              setNameInput(group.name);
              setEditing(false);
            }
          },
          autoFocus: true,
          style: {
            flex: 1,
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-accent)",
            borderRadius: 4,
            padding: "2px 8px",
            outline: "none"
          }
        }
      ) : /* @__PURE__ */ jsx6(
        "h2",
        {
          onClick: () => {
            setNameInput(group.name);
            setEditing(true);
          },
          title: "Click to rename",
          style: {
            margin: 0,
            flex: 1,
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            cursor: "text"
          },
          children: group.name
        }
      ),
      /* @__PURE__ */ jsx6("span", { style: {
        fontSize: 11,
        fontWeight: 500,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "3px 8px",
        borderRadius: 4,
        background: "var(--bg-surface)"
      }, children: STATUS_LABELS2[group.status] ?? group.status })
    ] }),
    /* @__PURE__ */ jsxs6("div", { style: { flex: 1, overflow: "auto", padding: "16px 20px" }, children: [
      /* @__PURE__ */ jsxs6("div", { style: { marginBottom: 20 }, children: [
        /* @__PURE__ */ jsxs6("div", { style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10
        }, children: [
          /* @__PURE__ */ jsxs6("h3", { style: {
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontFamily: "var(--font-family)"
          }, children: [
            "Members (",
            group.members.length,
            ")"
          ] }),
          !isActive && /* @__PURE__ */ jsx6(
            "button",
            {
              onClick: () => setShowAddMember(true),
              style: {
                background: "none",
                border: "1px solid var(--border-primary)",
                color: "var(--text-secondary)",
                borderRadius: 4,
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "var(--font-family)"
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.borderColor = "var(--border-accent)";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.borderColor = "var(--border-primary)";
              },
              children: "+ Add"
            }
          )
        ] }),
        showAddMember && /* @__PURE__ */ jsx6(
          AddMemberDialog,
          {
            api,
            existingAgentIds: group.members.map((m) => m.agentId),
            onAdd: handleAddMember,
            onCancel: () => setShowAddMember(false)
          }
        ),
        group.members.length === 0 && !showAddMember && /* @__PURE__ */ jsx6("div", { style: {
          fontSize: 12,
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-family)",
          padding: "12px 0"
        }, children: "No members yet. Add durable agents from your projects." }),
        group.members.map((member) => /* @__PURE__ */ jsx6(
          MemberCard,
          {
            api,
            member,
            onRemove: handleRemoveMember,
            onSetLeader: handleSetLeader
          },
          member.id
        ))
      ] }),
      group.status === "idle" && /* @__PURE__ */ jsx6(
        MissionInput,
        {
          onSubmit: handleAssignMission,
          disabled: isActive,
          hasLeader: !!group.leaderId,
          memberCount: group.members.length
        }
      ),
      group.mission && group.status !== "idle" && /* @__PURE__ */ jsxs6("div", { style: { marginBottom: 20 }, children: [
        /* @__PURE__ */ jsx6("h3", { style: {
          margin: "0 0 8px 0",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontFamily: "var(--font-family)"
        }, children: "Mission" }),
        /* @__PURE__ */ jsx6("div", { style: {
          fontSize: 13,
          color: "var(--text-primary)",
          fontFamily: "var(--font-family)",
          background: "var(--bg-surface)",
          padding: "12px 14px",
          borderRadius: 6,
          lineHeight: 1.5
        }, children: group.mission })
      ] }),
      group.status === "planning" && !group.plan && /* @__PURE__ */ jsxs6("div", { style: {
        padding: "16px",
        borderRadius: 8,
        border: "1px solid var(--border-primary)",
        background: "var(--bg-info)",
        marginBottom: 20
      }, children: [
        /* @__PURE__ */ jsx6("div", { style: {
          fontSize: 13,
          color: "var(--text-primary)",
          fontFamily: "var(--font-family)",
          marginBottom: 8
        }, children: "The group leader is creating a plan. Once the plan is written to the shared directory, click below to review and approve it." }),
        /* @__PURE__ */ jsx6(
          "button",
          {
            onClick: handleApprovePlan,
            style: {
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid var(--border-accent)",
              background: "var(--bg-accent)",
              color: "var(--text-accent)",
              cursor: "pointer",
              fontFamily: "var(--font-family)"
            },
            children: "Check for Plan & Approve"
          }
        )
      ] }),
      /* @__PURE__ */ jsx6(PlanView, { group })
    ] })
  ] });
}

// src/main.tsx
import { jsx as jsx7 } from "react/jsx-runtime";
var React7 = globalThis.React;
var { useState: useState4, useEffect: useEffect2, useCallback: useCallback4, useRef } = React7;
var groupStore = null;
var sharedDir = null;
var planner = null;
var monitor = null;
var injector = null;
var monitorListeners = [];
function onMonitorEvent(groupId, event) {
  for (const listener of monitorListeners) {
    listener(groupId, event);
  }
}
function activate(ctx, api) {
  api.logging.info("Buddy System plugin activated");
  groupStore = createGroupStore(api.storage.global);
  sharedDir = createSharedDirectory(api.files);
  injector = createConfigInjector(api.agentConfig);
  planner = createPlanner(api, groupStore, sharedDir, injector);
  monitor = createGroupMonitor(api, groupStore, sharedDir, onMonitorEvent);
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
  ctx.subscriptions.push({ dispose: () => monitor?.stopAll() });
}
function deactivate() {
  monitor?.stopAll();
  groupStore = null;
  sharedDir = null;
  planner = null;
  monitor = null;
  injector = null;
  monitorListeners = [];
}
function MainPanel({ api }) {
  const { style: themeStyle } = useTheme(api.theme);
  const [groups, setGroups] = useState4([]);
  const [selectedGroupId, setSelectedGroupId] = useState4(null);
  const [loaded, setLoaded] = useState4(false);
  const storeRef = useRef(groupStore);
  const plannerRef = useRef(planner);
  useEffect2(() => {
    if (!storeRef.current) {
      storeRef.current = createGroupStore(api.storage.global);
    }
    if (!plannerRef.current && storeRef.current) {
      const sd = sharedDir ?? createSharedDirectory(api.files);
      const inj = injector ?? createConfigInjector(api.agentConfig);
      plannerRef.current = createPlanner(api, storeRef.current, sd, inj);
    }
  }, [api]);
  const loadGroups = useCallback4(async () => {
    const store2 = storeRef.current;
    if (!store2) return;
    const allGroups = await store2.loadAll();
    setGroups(allGroups);
    setLoaded(true);
    for (const g of allGroups) {
      if (g.status === "planning" || g.status === "executing") {
        monitor?.start(g.id);
      }
    }
  }, []);
  useEffect2(() => {
    loadGroups();
  }, [loadGroups]);
  useEffect2(() => {
    const handleEvent = async (groupId, event) => {
      const store2 = storeRef.current;
      if (!store2) return;
      if (event.type === "status-updated") {
        const group = await store2.get(groupId);
        if (!group) return;
        const member = group.members.find((m) => m.id === event.memberId);
        if (member) {
          member.status = event.status.status;
        }
        if (event.status.status === "done" && member?.assignmentId && group.plan) {
          const deliverable = group.plan.deliverables.find((d) => d.id === member.assignmentId);
          if (deliverable) deliverable.status = "complete";
        }
        if (event.status.status === "working" && member?.assignmentId && group.plan) {
          const deliverable = group.plan.deliverables.find((d) => d.id === member.assignmentId);
          if (deliverable && deliverable.status === "pending") deliverable.status = "in-progress";
        }
        await store2.save(group);
        setGroups((prev) => prev.map((g) => g.id === groupId ? group : g));
      }
      if (event.type === "all-done") {
        const group = await store2.get(groupId);
        if (group) {
          group.status = "complete";
          await store2.save(group);
          setGroups((prev) => prev.map((g) => g.id === groupId ? group : g));
          monitor?.stop(groupId);
          api.ui.showNotice(`Buddy group "${group.name}" has completed all deliverables!`);
          api.badges.set({
            key: `complete-${groupId}`,
            type: "dot",
            target: { appPlugin: true }
          });
        }
      }
      if (event.type === "plan-detected") {
        api.logging.info("Plan detected by monitor", { groupId });
        api.badges.set({
          key: `plan-${groupId}`,
          type: "dot",
          target: { appPlugin: true }
        });
      }
    };
    monitorListeners.push(handleEvent);
    return () => {
      monitorListeners = monitorListeners.filter((l) => l !== handleEvent);
    };
  }, [api]);
  const store = storeRef.current;
  if (!loaded || !store) {
    return /* @__PURE__ */ jsx7("div", { style: { ...themeStyle, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ jsx7("span", { style: { color: "var(--text-tertiary)", fontSize: 14, fontFamily: "var(--font-family)" }, children: "Loading..." }) });
  }
  const handleCreate = async () => {
    try {
      const group = await store.create();
      setGroups((prev) => [...prev, group]);
      setSelectedGroupId(group.id);
      api.logging.info("Group created", { groupId: group.id, name: group.name });
    } catch (err) {
      api.logging.error("Failed to create group", { error: String(err) });
      api.ui.showError(`Failed to create group: ${err}`);
    }
  };
  const handleDelete = async (groupId) => {
    try {
      const confirmed = await api.ui.showConfirm("Delete this buddy group?");
      if (!confirmed) return;
      monitor?.stop(groupId);
      await store.remove(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (selectedGroupId === groupId) setSelectedGroupId(null);
      api.logging.info("Group deleted", { groupId });
    } catch (err) {
      api.logging.error("Failed to delete group", { error: String(err) });
      api.ui.showError(`Failed to delete group: ${err}`);
    }
  };
  const handleGroupUpdated = (updated) => {
    setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g));
    if (updated.status === "planning" || updated.status === "executing") {
      monitor?.start(updated.id);
    }
  };
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  return /* @__PURE__ */ jsx7("div", { style: { ...themeStyle, height: "100%", background: "var(--bg-primary)", color: "var(--text-primary)" }, children: selectedGroup ? /* @__PURE__ */ jsx7(
    GroupDetail,
    {
      api,
      group: selectedGroup,
      store,
      planner: plannerRef.current,
      onBack: () => setSelectedGroupId(null),
      onGroupUpdated: handleGroupUpdated
    }
  ) : /* @__PURE__ */ jsx7(
    GroupList,
    {
      api,
      groups,
      onSelect: (g) => setSelectedGroupId(g.id),
      onCreate: handleCreate,
      onDelete: handleDelete
    }
  ) });
}
export {
  MainPanel,
  activate,
  deactivate
};
