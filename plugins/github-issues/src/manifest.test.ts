import { describe, it, expect } from "vitest";
import manifest from "../manifest.json";

describe("github-issues manifest", () => {
  it("has correct plugin id", () => {
    expect(manifest.id).toBe("github-issues");
  });

  it("has correct scope", () => {
    expect(manifest.scope).toBe("project");
  });

  it("targets API version 0.6", () => {
    expect(manifest.engine.api).toBe(0.6);
  });

  it("declares required permissions", () => {
    expect(manifest.permissions).toContain("logging");
    expect(manifest.permissions).toContain("storage");
    expect(manifest.permissions).toContain("notifications");
    expect(manifest.permissions).toContain("files");
    expect(manifest.permissions).toContain("agents");
    expect(manifest.permissions).toContain("commands");
    expect(manifest.permissions).toContain("process");
    expect(manifest.permissions).toContain("widgets");
    expect(manifest.permissions).toContain("theme");
  });

  it("does not declare invalid permissions", () => {
    const validPermissions = [
      "files", "files.external", "git", "terminal", "agents",
      "notifications", "storage", "navigation", "projects",
      "commands", "events", "widgets", "logging", "process", "badges",
      "agent-config", "agent-config.cross-project",
      "agent-config.permissions", "agent-config.mcp",
      "sounds", "theme",
    ];
    for (const perm of manifest.permissions) {
      expect(validPermissions).toContain(perm);
    }
  });

  it("contributes a tab with sidebar-content layout", () => {
    expect(manifest.contributes.tab).toBeDefined();
    expect(manifest.contributes.tab.label).toBe("Issues");
    expect(manifest.contributes.tab.layout).toBe("sidebar-content");
  });

  it("has icon SVG", () => {
    expect(manifest.contributes.tab.icon).toContain("<svg");
  });

  it("contributes commands", () => {
    const ids = manifest.contributes.commands.map((c: { id: string }) => c.id);
    expect(ids).toContain("github-issues.refresh");
    expect(ids).toContain("github-issues.create");
    expect(ids).toContain("github-issues.assignAgent");
    expect(ids).toContain("github-issues.toggleState");
    expect(ids).toContain("github-issues.viewInBrowser");
  });

  it("contributes settings", () => {
    const keys = manifest.contributes.settings.map((s: { key: string }) => s.key);
    expect(keys).toContain("defaultRepo");
  });

  it("contributes help topics", () => {
    expect(manifest.contributes.help.topics.length).toBeGreaterThanOrEqual(1);
    const ids = manifest.contributes.help.topics.map((t: { id: string }) => t.id);
    expect(ids).toContain("github-issues");
  });

  it("only allows gh command", () => {
    expect(manifest.allowedCommands).toEqual(["gh"]);
  });
});
