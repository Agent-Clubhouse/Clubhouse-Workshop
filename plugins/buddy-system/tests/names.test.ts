import { describe, it, expect } from "vitest";
import { generateGroupName, ADJECTIVE_POOL, GROUP_WORD_POOL } from "../src/names";

describe("generateGroupName", () => {
  it("returns a name in adjective-groupword format", () => {
    const name = generateGroupName();
    const parts = name.split("-");
    expect(parts.length).toBe(2);
    expect(ADJECTIVE_POOL).toContain(parts[0]);
    expect(GROUP_WORD_POOL).toContain(parts[1]);
  });

  it("avoids collisions with existing names", () => {
    const existing = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const name = generateGroupName(existing);
      expect(existing.has(name)).toBe(false);
      existing.add(name);
    }
  });

  it("generates unique names across multiple calls", () => {
    const names = new Set<string>();
    // Generate 50 names and check for reasonable uniqueness
    for (let i = 0; i < 50; i++) {
      names.add(generateGroupName());
    }
    // With ~600 combos and 50 calls, collisions are unlikely but possible.
    // Expect at least 40 unique names.
    expect(names.size).toBeGreaterThanOrEqual(40);
  });

  it("pool sizes produce ~600 combinations", () => {
    expect(ADJECTIVE_POOL.length * GROUP_WORD_POOL.length).toBe(600);
  });
});
