import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockAPI } from "@clubhouse/plugin-testing";
import type { PluginAPI } from "@clubhouse/plugin-types";
import { createGroupStore, type GroupStore } from "../src/state/groups";
import { createSharedDirectory, type SharedDirectory } from "../src/orchestration/shared-dir";
import { createPlanner, type PlannerOrchestrator } from "../src/orchestration/planner";
import { createConfigInjector, type ConfigInjector } from "../src/config/injector";
import type { BuddyGroup } from "../src/types";

describe("PlannerOrchestrator", () => {
  let api: PluginAPI;
  let store: GroupStore;
  let sharedDir: SharedDirectory;
  let injector: ConfigInjector;
  let planner: PlannerOrchestrator;

  beforeEach(() => {
    api = createMockAPI({
      agents: {
        list: vi.fn().mockReturnValue([
          { id: "agent-1", name: "Agent One", kind: "durable", status: "sleeping", projectId: "proj-1" },
          { id: "agent-2", name: "Agent Two", kind: "durable", status: "sleeping", projectId: "proj-2" },
        ]),
      },
    });
    store = createGroupStore(api.storage.global);
    sharedDir = createSharedDirectory(api.files);
    injector = createConfigInjector(api.agentConfig);
    planner = createPlanner(api, store, sharedDir, injector);
  });

  async function createGroupWithMembers(): Promise<BuddyGroup> {
    let group = await store.create();
    group = await store.addMember(group.id, {
      agentId: "agent-1",
      agentName: "Agent One",
      projectId: "proj-1",
      projectName: "Project One",
      context: "Backend API agent",
    });
    group = await store.addMember(group.id, {
      agentId: "agent-2",
      agentName: "Agent Two",
      projectId: "proj-2",
      projectName: "Project Two",
      context: "Frontend client agent",
    });
    group.mission = "Build a user authentication system";
    await store.save(group);
    return group;
  }

  describe("startPlanning", () => {
    it("sets group status to planning and resumes leader", async () => {
      const group = await createGroupWithMembers();
      const updated = await planner.startPlanning(group);

      expect(updated.status).toBe("planning");
      expect(api.agents.resume).toHaveBeenCalledWith(
        "agent-1",
        expect.objectContaining({ mission: expect.stringContaining("leader") }),
      );
    });

    it("creates the shared directory", async () => {
      const group = await createGroupWithMembers();
      await planner.startPlanning(group);

      expect(api.files.mkdir).toHaveBeenCalled();
    });

    it("injects config into leader project", async () => {
      const group = await createGroupWithMembers();
      await planner.startPlanning(group);

      expect(api.agentConfig.injectSkill).toHaveBeenCalledWith(
        "buddy-system-mission",
        expect.stringContaining("Buddy System Member"),
        expect.objectContaining({ projectId: "proj-1" }),
      );
    });

    it("throws if no mission assigned", async () => {
      const group = await store.create();
      await expect(planner.startPlanning(group)).rejects.toThrow("No mission");
    });

    it("throws if no leader", async () => {
      const group = await store.create();
      group.mission = "test";
      await store.save(group);
      await expect(planner.startPlanning(group)).rejects.toThrow("No leader");
    });
  });

  describe("processPlan", () => {
    it("parses plan.md and stores deliverables", async () => {
      const group = await createGroupWithMembers();
      const memberId = group.members[0].id;

      // Mock the plan file existing
      (api.files.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(`---
deliverables:
  - id: d1
    title: "Auth API"
    assignee: "${memberId}"
    dependencies: []
    description: "Build auth endpoints"
---

Build auth system.`);

      const updated = await planner.processPlan(group);
      expect(updated.plan).toBeDefined();
      expect(updated.plan!.deliverables).toHaveLength(1);
      expect(updated.plan!.deliverables[0].title).toBe("Auth API");
    });

    it("throws when no plan file found", async () => {
      const group = await createGroupWithMembers();
      // readFile returns empty by default in mock
      (api.files.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("not found"));
      await expect(planner.processPlan(group)).rejects.toThrow();
    });
  });

  describe("startExecution", () => {
    it("resumes member agents with assignment missions", async () => {
      const group = await createGroupWithMembers();
      const m1 = group.members[0];
      const m2 = group.members[1];

      group.plan = {
        summary: "Build auth",
        deliverables: [
          { id: "d1", title: "API", description: "Build API", assigneeId: m1.id, status: "pending" },
          { id: "d2", title: "Client", description: "Build client", assigneeId: m2.id, status: "pending", dependencies: ["d1"] },
        ],
        createdAt: new Date().toISOString(),
      };
      m1.assignmentId = "d1";
      m2.assignmentId = "d2";
      await store.save(group);

      const updated = await planner.startExecution(group);

      expect(updated.status).toBe("executing");
      // Both agents should be resumed (both are sleeping in our mock)
      expect(api.agents.resume).toHaveBeenCalledTimes(2);
    });

    it("writes assignment files for each member", async () => {
      const group = await createGroupWithMembers();
      const m1 = group.members[0];

      group.plan = {
        summary: "Test",
        deliverables: [
          { id: "d1", title: "Task", description: "Do task", assigneeId: m1.id, status: "pending" },
        ],
        createdAt: new Date().toISOString(),
      };
      m1.assignmentId = "d1";
      await store.save(group);

      await planner.startExecution(group);

      expect(api.files.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`/assignments/${m1.id}.md`),
        expect.stringContaining("Task"),
      );
    });

    it("skips agents that are not sleeping", async () => {
      (api.agents.list as ReturnType<typeof vi.fn>).mockReturnValue([
        { id: "agent-1", status: "running" },
        { id: "agent-2", status: "sleeping" },
      ]);

      const group = await createGroupWithMembers();
      const m1 = group.members[0];
      const m2 = group.members[1];

      group.plan = {
        summary: "Test",
        deliverables: [
          { id: "d1", title: "T1", description: "D1", assigneeId: m1.id, status: "pending" },
          { id: "d2", title: "T2", description: "D2", assigneeId: m2.id, status: "pending" },
        ],
        createdAt: new Date().toISOString(),
      };
      m1.assignmentId = "d1";
      m2.assignmentId = "d2";
      await store.save(group);

      await planner.startExecution(group);

      // Only agent-2 should be resumed (agent-1 is running)
      expect(api.agents.resume).toHaveBeenCalledTimes(1);
      expect(api.agents.resume).toHaveBeenCalledWith("agent-2", expect.any(Object));
    });

    it("throws if no plan exists", async () => {
      const group = await createGroupWithMembers();
      await expect(planner.startExecution(group)).rejects.toThrow("No plan");
    });
  });
});

describe("ConfigInjector", () => {
  let api: PluginAPI;
  let injector: ConfigInjector;

  beforeEach(() => {
    api = createMockAPI();
    injector = createConfigInjector(api.agentConfig);
  });

  it("injects skill, instructions, and permissions", async () => {
    const group: BuddyGroup = {
      id: "g1",
      name: "test-squad",
      createdAt: new Date().toISOString(),
      status: "executing",
      leaderId: "m1",
      members: [{
        id: "m1",
        agentId: "a1",
        agentName: "Agent",
        projectId: "p1",
        projectName: "Project",
        context: "test",
        isLeader: true,
        status: "working",
      }],
    };

    await injector.injectMemberConfig(group, group.members[0]);

    expect(api.agentConfig.injectSkill).toHaveBeenCalledWith(
      "buddy-system-mission",
      expect.stringContaining("test-squad"),
      { projectId: "p1" },
    );
    expect(api.agentConfig.appendInstructions).toHaveBeenCalledWith(
      expect.stringContaining("test-squad"),
      { projectId: "p1" },
    );
    expect(api.agentConfig.addPermissionAllowRules).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("buddy-system")]),
      { projectId: "p1" },
    );
  });

  it("removes injected config", async () => {
    const member = {
      id: "m1",
      agentId: "a1",
      agentName: "Agent",
      projectId: "p1",
      projectName: "Project",
      context: "test",
      isLeader: false,
      status: "idle" as const,
    };

    await injector.removeMemberConfig(member);

    expect(api.agentConfig.removeSkill).toHaveBeenCalledWith("buddy-system-mission", { projectId: "p1" });
    expect(api.agentConfig.removeInstructionAppend).toHaveBeenCalledWith({ projectId: "p1" });
    expect(api.agentConfig.removePermissionRules).toHaveBeenCalledWith({ projectId: "p1" });
  });
});
