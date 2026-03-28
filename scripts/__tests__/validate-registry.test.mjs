import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateRegistry } from "../validate-registry.mjs";

describe("validateRegistry", () => {
  // ── Valid registry ───────────────────────────────────────────────────

  it("passes for the actual registry.json", async () => {
    const { errors } = await validateRegistry();
    assert.equal(errors.length, 0, `Expected no errors, got: ${errors.join(", ")}`);
  });

  // ── Registry structure ───────────────────────────────────────────────

  it("returns registry object on success", async () => {
    const { registry } = await validateRegistry();
    assert.ok(registry, "Expected registry to be returned");
    assert.ok(Array.isArray(registry.plugins), "Expected plugins array");
    assert.ok(registry.plugins.length > 0, "Expected at least one plugin");
  });

  it("validates all plugins have unique IDs", async () => {
    const { registry } = await validateRegistry();
    const ids = registry.plugins.map((p) => p.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, `Found duplicate IDs: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
  });

  it("validates all plugins have required fields", async () => {
    const { registry } = await validateRegistry();
    const required = ["id", "name", "description", "author", "repo", "latest", "releases"];
    for (const plugin of registry.plugins) {
      for (const field of required) {
        assert.ok(field in plugin, `Plugin ${plugin.id || "(unknown)"} missing field: ${field}`);
      }
    }
  });

  it("validates latest version exists in releases", async () => {
    const { registry } = await validateRegistry();
    for (const plugin of registry.plugins) {
      if (plugin.latest && plugin.releases) {
        assert.ok(
          plugin.latest in plugin.releases,
          `Plugin ${plugin.id}: latest "${plugin.latest}" not in releases`
        );
      }
    }
  });

  it("validates all release entries have required fields", async () => {
    const { registry } = await validateRegistry();
    for (const plugin of registry.plugins) {
      if (!plugin.releases) continue;
      for (const [version, release] of Object.entries(plugin.releases)) {
        assert.equal(typeof release.api, "number", `${plugin.id}@${version}: api must be number`);
        assert.equal(typeof release.asset, "string", `${plugin.id}@${version}: asset must be string`);
        assert.ok(Array.isArray(release.permissions), `${plugin.id}@${version}: permissions must be array`);
      }
    }
  });
});
