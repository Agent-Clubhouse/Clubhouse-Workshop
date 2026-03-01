import { describe, it, expect } from "vitest";
import manifest from "../manifest.json";

describe("bug-report manifest", () => {
  it("has correct plugin id", () => {
    expect(manifest.id).toBe("bug-report");
  });

  it("has correct scope", () => {
    expect(manifest.scope).toBe("app");
  });

  it("targets API version 0.6", () => {
    expect(manifest.engine.api).toBe(0.6);
  });

  it("declares required permissions", () => {
    expect(manifest.permissions).toContain("logging");
    expect(manifest.permissions).toContain("storage");
    expect(manifest.permissions).toContain("notifications");
    expect(manifest.permissions).toContain("commands");
    expect(manifest.permissions).toContain("process");
    expect(manifest.permissions).toContain("theme");
  });

  it("does not declare invalid permissions", () => {
    const validPermissions = [
      "files", "files.external", "git", "terminal", "agents",
      "notifications", "storage", "navigation", "projects",
      "commands", "events", "widgets", "logging", "process", "badges",
      "agent-config", "agent-config.cross-project",
      "agent-config.permissions", "agent-config.mcp",
      "theme", "sounds",
    ];
    for (const perm of manifest.permissions) {
      expect(validPermissions).toContain(perm);
    }
  });

  it("contributes a railItem at bottom position", () => {
    expect(manifest.contributes.railItem).toBeDefined();
    expect(manifest.contributes.railItem.label).toBe("Bug Report");
    expect(manifest.contributes.railItem.position).toBe("bottom");
  });

  it("has bug icon SVG", () => {
    expect(manifest.contributes.railItem.icon).toContain("<svg");
    // Bug icon should have the antenna paths (not the old info circle)
    expect(manifest.contributes.railItem.icon).toContain("M8 2l1.88 1.88");
    expect(manifest.contributes.railItem.icon).not.toContain("<circle");
  });

  it("contributes commands", () => {
    const ids = manifest.contributes.commands.map((c: { id: string }) => c.id);
    expect(ids).toContain("bug-report.refresh");
    expect(ids).toContain("bug-report.create");
    expect(ids).toContain("bug-report.viewInBrowser");
  });

  it("contributes help topics", () => {
    expect(manifest.contributes.help.topics.length).toBeGreaterThanOrEqual(1);
    const ids = manifest.contributes.help.topics.map((t: { id: string }) => t.id);
    expect(ids).toContain("overview");
  });

  it("only allows gh command", () => {
    expect(manifest.allowedCommands).toEqual(["gh"]);
  });

  it("does not include official field (set by CI in registry)", () => {
    expect(manifest).not.toHaveProperty("official");
  });
});
