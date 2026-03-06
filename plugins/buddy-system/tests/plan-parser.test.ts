import { describe, it, expect } from "vitest";
import { parsePlan } from "../src/orchestration/plan-parser";

describe("parsePlan", () => {
  it("returns null for empty content", () => {
    expect(parsePlan("")).toBeNull();
    expect(parsePlan("   ")).toBeNull();
  });

  it("returns summary-only when no frontmatter", () => {
    const result = parsePlan("Just a plain text plan with no structure.");
    expect(result).not.toBeNull();
    expect(result!.summary).toBe("Just a plain text plan with no structure.");
    expect(result!.deliverables).toEqual([]);
  });

  it("parses frontmatter with deliverables", () => {
    const content = `---
deliverables:
  - id: d1
    title: "API schema design"
    assignee: "member-abc"
    dependencies: []
    description: "Design the REST API schema for the auth service"
  - id: d2
    title: "Client SDK update"
    assignee: "member-def"
    dependencies: ["d1"]
    description: "Update the client SDK to use the new auth endpoints"
---

## Summary

We'll start with the API schema, then update the client SDK.`;

    const result = parsePlan(content);
    expect(result).not.toBeNull();
    expect(result!.deliverables).toHaveLength(2);

    const d1 = result!.deliverables[0];
    expect(d1.id).toBe("d1");
    expect(d1.title).toBe("API schema design");
    expect(d1.assigneeId).toBe("member-abc");
    expect(d1.dependencies).toEqual([]);
    expect(d1.description).toBe("Design the REST API schema for the auth service");
    expect(d1.status).toBe("pending");

    const d2 = result!.deliverables[1];
    expect(d2.id).toBe("d2");
    expect(d2.assigneeId).toBe("member-def");
    expect(d2.dependencies).toEqual(["d1"]);

    expect(result!.summary).toContain("API schema");
  });

  it("handles missing optional fields gracefully", () => {
    const content = `---
deliverables:
  - id: d1
    title: "Do the thing"
    assignee: "m1"
---

Quick plan.`;

    const result = parsePlan(content);
    expect(result).not.toBeNull();
    expect(result!.deliverables).toHaveLength(1);
    expect(result!.deliverables[0].description).toBe("");
    expect(result!.deliverables[0].dependencies).toEqual([]);
  });

  it("parses multiple dependencies", () => {
    const content = `---
deliverables:
  - id: d3
    title: "Integration tests"
    assignee: "m1"
    dependencies: ["d1", "d2"]
    description: "Write integration tests"
---

Plan summary.`;

    const result = parsePlan(content);
    expect(result!.deliverables[0].dependencies).toEqual(["d1", "d2"]);
  });

  it("handles unquoted YAML values", () => {
    const content = `---
deliverables:
  - id: d1
    title: Simple task
    assignee: member-1
    dependencies: []
    description: Do something simple
---

Summary here.`;

    const result = parsePlan(content);
    expect(result!.deliverables[0].title).toBe("Simple task");
    expect(result!.deliverables[0].assigneeId).toBe("member-1");
  });
});
