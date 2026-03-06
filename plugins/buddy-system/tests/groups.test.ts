import { describe, it, expect, beforeEach } from "vitest";
import { createMockAPI } from "@clubhouse/plugin-testing";
import { createGroupStore, type GroupStore } from "../src/state/groups";

describe("GroupStore", () => {
  let store: GroupStore;

  beforeEach(() => {
    const api = createMockAPI();
    store = createGroupStore(api.storage.global);
  });

  describe("create", () => {
    it("creates a group with an auto-generated name", async () => {
      const group = await store.create();
      expect(group.id).toBeTruthy();
      expect(group.name).toMatch(/^[a-z]+-[a-z]+$/);
      expect(group.status).toBe("idle");
      expect(group.members).toEqual([]);
      expect(group.leaderId).toBe("");
      expect(group.createdAt).toBeTruthy();
    });

    it("persists the group in storage", async () => {
      const group = await store.create();
      const loaded = await store.get(group.id);
      expect(loaded).toEqual(group);
    });
  });

  describe("loadAll", () => {
    it("returns empty array initially", async () => {
      const groups = await store.loadAll();
      expect(groups).toEqual([]);
    });

    it("returns all created groups", async () => {
      const g1 = await store.create();
      const g2 = await store.create();
      const groups = await store.loadAll();
      expect(groups).toHaveLength(2);
      expect(groups.map(g => g.id)).toContain(g1.id);
      expect(groups.map(g => g.id)).toContain(g2.id);
    });
  });

  describe("remove", () => {
    it("removes a group from storage", async () => {
      const group = await store.create();
      await store.remove(group.id);
      const loaded = await store.get(group.id);
      expect(loaded).toBeNull();
      const all = await store.loadAll();
      expect(all).toHaveLength(0);
    });
  });

  describe("rename", () => {
    it("renames a group", async () => {
      const group = await store.create();
      const updated = await store.rename(group.id, "custom-name");
      expect(updated.name).toBe("custom-name");
      const loaded = await store.get(group.id);
      expect(loaded?.name).toBe("custom-name");
    });

    it("throws for non-existent group", async () => {
      await expect(store.rename("fake-id", "name")).rejects.toThrow("not found");
    });
  });

  describe("addMember", () => {
    it("adds a member to the group", async () => {
      const group = await store.create();
      const updated = await store.addMember(group.id, {
        agentId: "agent-1",
        agentName: "Agent One",
        projectId: "proj-1",
        projectName: "Project One",
        context: "Backend agent",
      });
      expect(updated.members).toHaveLength(1);
      expect(updated.members[0].agentName).toBe("Agent One");
      expect(updated.members[0].status).toBe("idle");
    });

    it("makes the first member the leader", async () => {
      const group = await store.create();
      const updated = await store.addMember(group.id, {
        agentId: "agent-1",
        agentName: "Agent One",
        projectId: "proj-1",
        projectName: "Project One",
        context: "Leader agent",
      });
      expect(updated.members[0].isLeader).toBe(true);
      expect(updated.leaderId).toBe(updated.members[0].id);
    });

    it("does not make subsequent members leaders", async () => {
      const group = await store.create();
      await store.addMember(group.id, {
        agentId: "agent-1",
        agentName: "Agent One",
        projectId: "proj-1",
        projectName: "Project One",
        context: "Leader",
      });
      const updated = await store.addMember(group.id, {
        agentId: "agent-2",
        agentName: "Agent Two",
        projectId: "proj-2",
        projectName: "Project Two",
        context: "Follower",
      });
      expect(updated.members[1].isLeader).toBe(false);
    });
  });

  describe("removeMember", () => {
    it("removes a member from the group", async () => {
      const group = await store.create();
      const withMember = await store.addMember(group.id, {
        agentId: "agent-1",
        agentName: "Agent One",
        projectId: "proj-1",
        projectName: "Project One",
        context: "Test",
      });
      const updated = await store.removeMember(group.id, withMember.members[0].id);
      expect(updated.members).toHaveLength(0);
      expect(updated.leaderId).toBe("");
    });

    it("promotes next member when leader is removed", async () => {
      const group = await store.create();
      await store.addMember(group.id, {
        agentId: "agent-1",
        agentName: "Agent One",
        projectId: "proj-1",
        projectName: "Project One",
        context: "Leader",
      });
      const withTwo = await store.addMember(group.id, {
        agentId: "agent-2",
        agentName: "Agent Two",
        projectId: "proj-2",
        projectName: "Project Two",
        context: "Follower",
      });

      const leaderId = withTwo.members.find(m => m.isLeader)!.id;
      const updated = await store.removeMember(group.id, leaderId);
      expect(updated.members).toHaveLength(1);
      expect(updated.members[0].isLeader).toBe(true);
      expect(updated.leaderId).toBe(updated.members[0].id);
    });
  });

  describe("setLeader", () => {
    it("changes the group leader", async () => {
      const group = await store.create();
      await store.addMember(group.id, {
        agentId: "agent-1",
        agentName: "Agent One",
        projectId: "proj-1",
        projectName: "Project One",
        context: "Original leader",
      });
      const withTwo = await store.addMember(group.id, {
        agentId: "agent-2",
        agentName: "Agent Two",
        projectId: "proj-2",
        projectName: "Project Two",
        context: "New leader",
      });

      const newLeaderId = withTwo.members[1].id;
      const updated = await store.setLeader(group.id, newLeaderId);
      expect(updated.leaderId).toBe(newLeaderId);
      expect(updated.members.find(m => m.id === newLeaderId)?.isLeader).toBe(true);
      expect(updated.members.find(m => m.id !== newLeaderId)?.isLeader).toBe(false);
    });

    it("throws for non-existent member", async () => {
      const group = await store.create();
      await expect(store.setLeader(group.id, "fake-member")).rejects.toThrow("not found");
    });
  });
});
