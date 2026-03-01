// ---------------------------------------------------------------------------
// Group State — CRUD operations backed by global storage
// ---------------------------------------------------------------------------

import type { ScopedStorage } from "@clubhouse/plugin-types";
import type { BuddyGroup, GroupMember } from "../types";
import { generateGroupName } from "../names";

const INDEX_KEY = "groups/index";
function groupKey(id: string): string { return `groups/${id}`; }

function uuid(): string {
  return crypto.randomUUID();
}

export interface GroupStore {
  /** Load all groups from storage. */
  loadAll(): Promise<BuddyGroup[]>;
  /** Get a single group by ID. */
  get(id: string): Promise<BuddyGroup | null>;
  /** Create a new group with an auto-generated name. Returns the created group. */
  create(): Promise<BuddyGroup>;
  /** Update a group in storage. */
  save(group: BuddyGroup): Promise<void>;
  /** Delete a group from storage. */
  remove(id: string): Promise<void>;
  /** Rename a group. */
  rename(id: string, name: string): Promise<BuddyGroup>;
  /** Add a member to a group. Returns the updated group. */
  addMember(groupId: string, member: Omit<GroupMember, "id" | "isLeader" | "status">): Promise<BuddyGroup>;
  /** Remove a member from a group. Returns the updated group. */
  removeMember(groupId: string, memberId: string): Promise<BuddyGroup>;
  /** Set the leader of a group. Returns the updated group. */
  setLeader(groupId: string, memberId: string): Promise<BuddyGroup>;
}

export function createGroupStore(storage: ScopedStorage): GroupStore {
  // Read the index of group IDs
  async function readIndex(): Promise<string[]> {
    const raw = await storage.read(INDEX_KEY);
    if (Array.isArray(raw)) return raw as string[];
    return [];
  }

  // Write the index of group IDs
  async function writeIndex(ids: string[]): Promise<void> {
    await storage.write(INDEX_KEY, ids);
  }

  async function loadAll(): Promise<BuddyGroup[]> {
    const ids = await readIndex();
    const groups: BuddyGroup[] = [];
    for (const id of ids) {
      const raw = await storage.read(groupKey(id));
      if (raw && typeof raw === "object") {
        groups.push(raw as BuddyGroup);
      }
    }
    return groups;
  }

  async function get(id: string): Promise<BuddyGroup | null> {
    const raw = await storage.read(groupKey(id));
    if (raw && typeof raw === "object") return raw as BuddyGroup;
    return null;
  }

  async function create(): Promise<BuddyGroup> {
    const ids = await readIndex();
    const existingGroups = await loadAll();
    const existingNames = new Set(existingGroups.map(g => g.name));

    const id = uuid();
    const group: BuddyGroup = {
      id,
      name: generateGroupName(existingNames),
      createdAt: new Date().toISOString(),
      status: "idle",
      leaderId: "",
      members: [],
    };

    await storage.write(groupKey(id), group);
    await writeIndex([...ids, id]);
    return group;
  }

  async function save(group: BuddyGroup): Promise<void> {
    await storage.write(groupKey(group.id), group);
  }

  async function remove(id: string): Promise<void> {
    const ids = await readIndex();
    await writeIndex(ids.filter(i => i !== id));
    await storage.delete(groupKey(id));
  }

  async function rename(id: string, name: string): Promise<BuddyGroup> {
    const group = await get(id);
    if (!group) throw new Error(`Group ${id} not found`);
    group.name = name;
    await save(group);
    return group;
  }

  async function addMember(
    groupId: string,
    member: Omit<GroupMember, "id" | "isLeader" | "status">,
  ): Promise<BuddyGroup> {
    const group = await get(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);

    const isFirst = group.members.length === 0;
    const newMember: GroupMember = {
      ...member,
      id: uuid(),
      isLeader: isFirst,
      status: "idle",
    };

    group.members.push(newMember);
    if (isFirst) {
      group.leaderId = newMember.id;
    }

    await save(group);
    return group;
  }

  async function removeMember(groupId: string, memberId: string): Promise<BuddyGroup> {
    const group = await get(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);

    const wasLeader = group.members.find(m => m.id === memberId)?.isLeader;
    group.members = group.members.filter(m => m.id !== memberId);

    // If we removed the leader, promote the first remaining member
    if (wasLeader && group.members.length > 0) {
      group.members[0].isLeader = true;
      group.leaderId = group.members[0].id;
    } else if (group.members.length === 0) {
      group.leaderId = "";
    }

    await save(group);
    return group;
  }

  async function setLeader(groupId: string, memberId: string): Promise<BuddyGroup> {
    const group = await get(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);

    const target = group.members.find(m => m.id === memberId);
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
