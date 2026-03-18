import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { detectReleasable } from "../detect-releasable.mjs";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "detect-releasable-test-"));
}

function writeManifest(dir, manifest) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

function writeRegistry(path, plugins) {
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      updated: new Date().toISOString(),
      supportedApis: { latest: "0.7", minimum: "0.6", versions: ["0.6", "0.7"] },
      plugins,
    }, null, 2)
  );
}

describe("detect-releasable.mjs", () => {
  describe("plugin with higher version than registry", () => {
    let tmpDir;
    let result;

    before(() => {
      tmpDir = makeTempDir();
      const pluginsDir = join(tmpDir, "plugins");
      const registryPath = join(tmpDir, "registry.json");

      writeManifest(join(pluginsDir, "my-plugin"), {
        id: "my-plugin",
        name: "My Plugin",
        version: "1.1.0",
        description: "Test",
        author: "Test",
        engine: { api: 0.7 },
        scope: "project",
        main: "./dist/main.js",
      });

      writeRegistry(registryPath, [
        {
          id: "my-plugin",
          name: "My Plugin",
          description: "Test",
          author: "Test",
          repo: "https://github.com/test/repo",
          latest: "1.0.0",
          releases: { "1.0.0": { api: 0.7, asset: "x", sha256: "x", permissions: [], size: 1 } },
        },
      ]);

      result = detectReleasable({ registryPath, pluginsDir });
    });

    after(() => rmSync(tmpDir, { recursive: true, force: true }));

    it("detects the plugin as releasable", () => {
      assert.equal(result.length, 1);
      assert.equal(result[0].pluginId, "my-plugin");
    });

    it("reports correct version info", () => {
      assert.equal(result[0].version, "1.1.0");
      assert.equal(result[0].currentLatest, "1.0.0");
      assert.equal(result[0].tag, "my-plugin-v1.1.0");
    });
  });

  describe("plugin matching registry", () => {
    let tmpDir;
    let result;

    before(() => {
      tmpDir = makeTempDir();
      const pluginsDir = join(tmpDir, "plugins");
      const registryPath = join(tmpDir, "registry.json");

      writeManifest(join(pluginsDir, "stable-plugin"), {
        id: "stable-plugin",
        name: "Stable",
        version: "1.0.0",
        description: "Test",
        author: "Test",
        engine: { api: 0.7 },
        scope: "project",
        main: "./dist/main.js",
      });

      writeRegistry(registryPath, [
        {
          id: "stable-plugin",
          name: "Stable",
          description: "Test",
          author: "Test",
          repo: "https://github.com/test/repo",
          latest: "1.0.0",
          releases: { "1.0.0": { api: 0.7, asset: "x", sha256: "x", permissions: [], size: 1 } },
        },
      ]);

      result = detectReleasable({ registryPath, pluginsDir });
    });

    after(() => rmSync(tmpDir, { recursive: true, force: true }));

    it("does not list the plugin", () => {
      assert.equal(result.length, 0);
    });
  });

  describe("plugin not in registry", () => {
    let tmpDir;
    let result;

    before(() => {
      tmpDir = makeTempDir();
      const pluginsDir = join(tmpDir, "plugins");
      const registryPath = join(tmpDir, "registry.json");

      writeManifest(join(pluginsDir, "new-plugin"), {
        id: "new-plugin",
        name: "New",
        version: "0.1.0",
        description: "Test",
        author: "Test",
        engine: { api: 0.7 },
        kind: "pack",
        scope: "app",
      });

      writeRegistry(registryPath, []);

      result = detectReleasable({ registryPath, pluginsDir });
    });

    after(() => rmSync(tmpDir, { recursive: true, force: true }));

    it("lists the new plugin", () => {
      assert.equal(result.length, 1);
      assert.equal(result[0].pluginId, "new-plugin");
      assert.equal(result[0].currentLatest, null);
    });
  });

  describe("all up-to-date", () => {
    let tmpDir;
    let result;

    before(() => {
      tmpDir = makeTempDir();
      const pluginsDir = join(tmpDir, "plugins");
      const registryPath = join(tmpDir, "registry.json");

      writeManifest(join(pluginsDir, "a"), {
        id: "a", name: "A", version: "1.0.0", description: "T", author: "T", engine: { api: 0.7 }, kind: "pack", scope: "app",
      });
      writeManifest(join(pluginsDir, "b"), {
        id: "b", name: "B", version: "2.0.0", description: "T", author: "T", engine: { api: 0.7 }, kind: "pack", scope: "app",
      });

      writeRegistry(registryPath, [
        { id: "a", name: "A", description: "T", author: "T", repo: "x", latest: "1.0.0", releases: { "1.0.0": { api: 0.7, asset: "x", sha256: "x", permissions: [], size: 1 } } },
        { id: "b", name: "B", description: "T", author: "T", repo: "x", latest: "2.0.0", releases: { "2.0.0": { api: 0.7, asset: "x", sha256: "x", permissions: [], size: 1 } } },
      ]);

      result = detectReleasable({ registryPath, pluginsDir });
    });

    after(() => rmSync(tmpDir, { recursive: true, force: true }));

    it("returns empty array", () => {
      assert.equal(result.length, 0);
    });
  });

  describe("mixed - some bumped, some not", () => {
    let tmpDir;
    let result;

    before(() => {
      tmpDir = makeTempDir();
      const pluginsDir = join(tmpDir, "plugins");
      const registryPath = join(tmpDir, "registry.json");

      // bumped
      writeManifest(join(pluginsDir, "bumped"), {
        id: "bumped", name: "Bumped", version: "2.0.0", description: "T", author: "T", engine: { api: 0.7 }, kind: "pack", scope: "app",
      });
      // not bumped
      writeManifest(join(pluginsDir, "stable"), {
        id: "stable", name: "Stable", version: "1.0.0", description: "T", author: "T", engine: { api: 0.7 }, kind: "pack", scope: "app",
      });
      // new (not in registry)
      writeManifest(join(pluginsDir, "brand-new"), {
        id: "brand-new", name: "Brand New", version: "0.1.0", description: "T", author: "T", engine: { api: 0.7 }, kind: "pack", scope: "app",
      });

      writeRegistry(registryPath, [
        { id: "bumped", name: "Bumped", description: "T", author: "T", repo: "x", latest: "1.0.0", releases: { "1.0.0": { api: 0.7, asset: "x", sha256: "x", permissions: [], size: 1 } } },
        { id: "stable", name: "Stable", description: "T", author: "T", repo: "x", latest: "1.0.0", releases: { "1.0.0": { api: 0.7, asset: "x", sha256: "x", permissions: [], size: 1 } } },
      ]);

      result = detectReleasable({ registryPath, pluginsDir });
    });

    after(() => rmSync(tmpDir, { recursive: true, force: true }));

    it("lists only bumped and new plugins", () => {
      assert.equal(result.length, 2);
      const ids = result.map((r) => r.pluginId).sort();
      assert.deepEqual(ids, ["brand-new", "bumped"]);
    });

    it("does not list stable plugin", () => {
      assert.ok(!result.some((r) => r.pluginId === "stable"));
    });
  });
});
