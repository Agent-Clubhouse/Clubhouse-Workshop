import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { updateRegistry } from "../update-registry.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const REAL_REGISTRY = join(REPO_ROOT, "registry", "registry.json");
const REAL_VERSIONS = join(REPO_ROOT, "sdk", "versions.json");

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "update-registry-test-"));
}

function makeTestRegistry(tmpDir, plugins = []) {
  const registryPath = join(tmpDir, "registry.json");
  writeFileSync(
    registryPath,
    JSON.stringify({
      version: 1,
      updated: "2026-01-01T00:00:00.000Z",
      supportedApis: { latest: "0.7", minimum: "0.6", versions: ["0.6", "0.7"] },
      plugins,
    }, null, 2) + "\n"
  );
  return registryPath;
}

function makeRelease(overrides = {}) {
  return {
    pluginId: "test-plugin",
    version: "1.0.0",
    tag: "test-plugin-v1.0.0",
    sha256: "abc123def456",
    size: 5000,
    manifest: {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
      engine: { api: 0.7 },
      scope: "project",
      main: "./dist/main.js",
      permissions: ["storage", "notifications"],
    },
    ...overrides,
  };
}

describe("update-registry.mjs", () => {
  describe("add new plugin", () => {
    let tmpDir;
    let result;
    let registryPath;

    before(async () => {
      tmpDir = makeTempDir();
      registryPath = makeTestRegistry(tmpDir);

      result = await updateRegistry([makeRelease()], {
        registryPath,
        versionsPath: REAL_VERSIONS,
        validate: false,
      });
    });

    after(() => rmSync(tmpDir, { recursive: true, force: true }));

    it("returns no errors", () => {
      assert.equal(result.errors.length, 0);
    });

    it("creates new plugin entry", () => {
      const plugin = result.registry.plugins.find((p) => p.id === "test-plugin");
      assert.ok(plugin);
      assert.equal(plugin.name, "Test Plugin");
      assert.equal(plugin.description, "A test plugin");
      assert.equal(plugin.author, "Test Author");
      assert.equal(plugin.official, true);
    });

    it("sets latest version", () => {
      const plugin = result.registry.plugins.find((p) => p.id === "test-plugin");
      assert.equal(plugin.latest, "1.0.0");
    });

    it("creates release entry with correct fields", () => {
      const plugin = result.registry.plugins.find((p) => p.id === "test-plugin");
      const release = plugin.releases["1.0.0"];
      assert.ok(release);
      assert.equal(release.api, 0.7);
      assert.equal(release.sha256, "abc123def456");
      assert.equal(release.size, 5000);
      assert.deepEqual(release.permissions, ["storage", "notifications"]);
      assert.ok(release.asset.includes("test-plugin-v1.0.0"));
    });

    it("writes to disk", () => {
      const onDisk = JSON.parse(readFileSync(registryPath, "utf8"));
      assert.equal(onDisk.plugins.length, 1);
      assert.equal(onDisk.plugins[0].id, "test-plugin");
    });
  });

  describe("update existing plugin", () => {
    let tmpDir;
    let result;

    before(async () => {
      tmpDir = makeTempDir();
      const registryPath = makeTestRegistry(tmpDir, [
        {
          id: "test-plugin",
          name: "Test Plugin",
          description: "Old description",
          author: "Old Author",
          official: true,
          repo: "https://github.com/test/repo",
          path: "plugins/test-plugin",
          tags: ["test"],
          latest: "0.9.0",
          releases: {
            "0.9.0": {
              api: 0.6,
              asset: "https://example.com/old.zip",
              sha256: "old-hash",
              permissions: ["storage"],
              size: 3000,
            },
          },
        },
      ]);

      const release = makeRelease({
        manifest: {
          ...makeRelease().manifest,
          description: "Updated description",
          author: "New Author",
        },
      });

      result = await updateRegistry([release], {
        registryPath,
        versionsPath: REAL_VERSIONS,
        validate: false,
      });
    });

    after(() => rmSync(tmpDir, { recursive: true, force: true }));

    it("updates latest to new version", () => {
      const plugin = result.registry.plugins.find((p) => p.id === "test-plugin");
      assert.equal(plugin.latest, "1.0.0");
    });

    it("preserves old releases", () => {
      const plugin = result.registry.plugins.find((p) => p.id === "test-plugin");
      assert.ok(plugin.releases["0.9.0"]);
      assert.equal(plugin.releases["0.9.0"].sha256, "old-hash");
    });

    it("adds new release entry", () => {
      const plugin = result.registry.plugins.find((p) => p.id === "test-plugin");
      assert.ok(plugin.releases["1.0.0"]);
      assert.equal(plugin.releases["1.0.0"].sha256, "abc123def456");
    });

    it("updates metadata from manifest", () => {
      const plugin = result.registry.plugins.find((p) => p.id === "test-plugin");
      assert.equal(plugin.description, "Updated description");
      assert.equal(plugin.author, "New Author");
    });
  });

  describe("batch update", () => {
    let tmpDir;
    let result;

    before(async () => {
      tmpDir = makeTempDir();
      const registryPath = makeTestRegistry(tmpDir);

      const releases = [
        makeRelease({ pluginId: "plugin-a", version: "1.0.0", tag: "plugin-a-v1.0.0", manifest: { ...makeRelease().manifest, id: "plugin-a", name: "Plugin A" } }),
        makeRelease({ pluginId: "plugin-b", version: "2.0.0", tag: "plugin-b-v2.0.0", manifest: { ...makeRelease().manifest, id: "plugin-b", name: "Plugin B", version: "2.0.0" } }),
        makeRelease({ pluginId: "plugin-c", version: "0.1.0", tag: "plugin-c-v0.1.0", manifest: { ...makeRelease().manifest, id: "plugin-c", name: "Plugin C", version: "0.1.0", kind: "pack", permissions: [] } }),
      ];

      result = await updateRegistry(releases, {
        registryPath,
        versionsPath: REAL_VERSIONS,
        validate: false,
      });
    });

    after(() => rmSync(tmpDir, { recursive: true, force: true }));

    it("creates all three plugins", () => {
      assert.equal(result.registry.plugins.length, 3);
      const ids = result.registry.plugins.map((p) => p.id).sort();
      assert.deepEqual(ids, ["plugin-a", "plugin-b", "plugin-c"]);
    });

    it("each has correct latest version", () => {
      const a = result.registry.plugins.find((p) => p.id === "plugin-a");
      const b = result.registry.plugins.find((p) => p.id === "plugin-b");
      const c = result.registry.plugins.find((p) => p.id === "plugin-c");
      assert.equal(a.latest, "1.0.0");
      assert.equal(b.latest, "2.0.0");
      assert.equal(c.latest, "0.1.0");
    });
  });

  describe("registry validation passes", () => {
    let tmpDir;
    let backupRegistry;

    before(() => {
      // Backup real registry
      backupRegistry = readFileSync(REAL_REGISTRY, "utf8");
    });

    after(() => {
      // Restore real registry
      writeFileSync(REAL_REGISTRY, backupRegistry);
    });

    it("validates successfully after update", async () => {
      // Use the real registry path so validateRegistry() can find it
      const release = makeRelease({
        pluginId: "validation-test",
        version: "1.0.0",
        tag: "validation-test-v1.0.0",
        sha256: "a".repeat(64),
        manifest: {
          ...makeRelease().manifest,
          id: "validation-test",
          name: "Validation Test",
        },
      });

      const result = await updateRegistry([release], {
        registryPath: REAL_REGISTRY,
        versionsPath: REAL_VERSIONS,
        validate: true,
      });

      assert.equal(result.errors.length, 0);
    });
  });

  describe("supportedApis sync", () => {
    let tmpDir;
    let result;

    before(async () => {
      tmpDir = makeTempDir();
      const registryPath = makeTestRegistry(tmpDir);

      result = await updateRegistry([makeRelease()], {
        registryPath,
        versionsPath: REAL_VERSIONS,
        validate: false,
      });
    });

    after(() => rmSync(tmpDir, { recursive: true, force: true }));

    it("syncs latest from sdk/versions.json", () => {
      const sdkVersions = JSON.parse(readFileSync(REAL_VERSIONS, "utf8"));
      assert.equal(result.registry.supportedApis.latest, sdkVersions.latest);
    });

    it("syncs minimum from sdk/versions.json", () => {
      const sdkVersions = JSON.parse(readFileSync(REAL_VERSIONS, "utf8"));
      assert.equal(result.registry.supportedApis.minimum, sdkVersions.minimum);
    });

    it("includes only non-removed versions", () => {
      const sdkVersions = JSON.parse(readFileSync(REAL_VERSIONS, "utf8"));
      const expected = Object.entries(sdkVersions.versions)
        .filter(([_, e]) => e.status !== "removed")
        .map(([v]) => v);
      assert.deepEqual(result.registry.supportedApis.versions, expected);
    });
  });

  describe("idempotent", () => {
    let tmpDir;
    let registryPath;

    before(() => {
      tmpDir = makeTempDir();
      registryPath = makeTestRegistry(tmpDir);
    });

    after(() => rmSync(tmpDir, { recursive: true, force: true }));

    it("running same release twice does not corrupt registry", async () => {
      const release = makeRelease();

      await updateRegistry([release], { registryPath, versionsPath: REAL_VERSIONS, validate: false });
      const first = JSON.parse(readFileSync(registryPath, "utf8"));

      await updateRegistry([release], { registryPath, versionsPath: REAL_VERSIONS, validate: false });
      const second = JSON.parse(readFileSync(registryPath, "utf8"));

      // Should still have exactly one plugin
      assert.equal(second.plugins.length, 1);
      // Should still have exactly one release
      assert.equal(Object.keys(second.plugins[0].releases).length, 1);
      // Latest should be the same
      assert.equal(second.plugins[0].latest, first.plugins[0].latest);
    });
  });
});
