// ---------------------------------------------------------------------------
// Buddy System — Data Model
// ---------------------------------------------------------------------------

export type GroupStatus = "idle" | "planning" | "executing" | "complete" | "archived";
export type MemberStatus = "idle" | "creating" | "working" | "blocked" | "done" | "error";
export type DeliverableStatus = "pending" | "in-progress" | "review" | "complete" | "blocked";
export type CommMessageType = "status" | "finding" | "change" | "question" | "plan" | "complete";

export interface BuddyGroup {
  id: string;
  name: string;
  createdAt: string;
  status: GroupStatus;
  leaderId: string;
  members: GroupMember[];
  mission?: string;
  plan?: GroupPlan;
}

export interface GroupMember {
  id: string;
  agentId: string;
  agentName: string;
  projectId: string;
  projectName: string;
  context: string;
  isLeader: boolean;
  status: MemberStatus;
  assignmentId?: string;
}

export interface GroupPlan {
  summary: string;
  deliverables: Deliverable[];
  createdAt: string;
}

export interface Deliverable {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  status: DeliverableStatus;
  dependencies?: string[];
}

export interface CommMessage {
  id: string;
  groupId: string;
  fromMemberId: string;
  timestamp: string;
  type: CommMessageType;
  content: string;
  metadata?: Record<string, unknown>;
}
