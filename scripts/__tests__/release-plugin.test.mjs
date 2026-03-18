import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import { createHash } from "crypto";

const FIXTURES = resolve(import.meta.dirname, "fixtures");
const REPO_ROOT = resolve(import.meta.dirname, "../..");

// We import the function dynamically to avoid side-effects from CLI parsing
async function importReleasePlugin() {
  // The module's CLI code runs on import, so we test via subprocess
}

function run(pluginDir, version, extraArgs = "") {
  const script = resolve(import.meta.dirname, "../release-plugin.mjs");
  const cmd = `node "${script}" "${pluginDir}" "${version}" ${extraArgs}`;
  return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8", timeout: 30000 });
}

function runExpectFail(pluginDir, version, extraArgs = "") {
  const script = resolve(import.meta.dirname, "../release-plugin.mjs");
  const cmd = `node "${script}" "${pluginDir}" "${version}" ${extraArgs}`;
  try {
    execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8", timeout: 30000, stdio: "pipe" });
    assert.fail("Expected command to fail");
  } catch (e) {
    return e;
  }
}

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "release-plugin-test-"));
}

describe("release-plugin.mjs", () => {
  describe("pack plugin (no build)", () => {
    let tmpDir;
    let output;

    before(() => {
      tmpDir = makeTempDir();
      cpSync(join(FIXTURES, "pack-plugin"), join(tmpDir, "test-pack"), { recursive: true });
      const stdout = run(join(tmpDir, "test-pack"), "0.1.0");
      // Extract JSON from stdout (skip any warning lines)
      const jsonStart = stdout.indexOf("{");
      output = JSON.parse(stdout.slice(jsonStart));
    });

    after(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      // Clean up zip
      if (output?.zipPath && existsSync(output.zipPath)) {
        rmSync(output.zipPath);
      }
    });

    it("outputs correct pluginId", () => {
      assert.equal(output.pluginId, "test-pack");
    });

    it("outputs correct version", () => {
      assert.equal(output.version, "0.1.0");
    });

    it("outputs correct tag", () => {
      assert.equal(output.tag, "test-pack-v0.1.0");
    });

    it("outputs valid sha256", () => {
      assert.match(output.sha256, /^[a-f0-9]{64}$/);
      // Verify sha256 matches actual file
      const data = readFileSync(output.zipPath);
      const expected = createHash("sha256").update(data).digest("hex");
      assert.equal(output.sha256, expected);
    });

    it("outputs valid size", () => {
      assert.equal(typeof output.size, "number");
      assert.ok(output.size > 0);
    });

    it("zip file exists", () => {
      assert.ok(existsSync(output.zipPath));
    });

    it("zip contains manifest.json", () => {
      const listing = execSync(`unzip -l "${output.zipPath}"`, { encoding: "utf8" });
      assert.ok(listing.includes("manifest.json"));
    });

    it("zip does not contain dist/", () => {
      const listing = execSync(`unzip -l "${output.zipPath}"`, { encoding: "utf8" });
      assert.ok(!listing.includes("dist/"));
    });

    it("includes manifest in output", () => {
      assert.equal(output.manifest.id, "test-pack");
      assert.equal(output.manifest.kind, "pack");
    });
  });

  describe("full plugin (with build)", () => {
    let tmpDir;
    let output;

    before(() => {
      tmpDir = makeTempDir();
      cpSync(join(FIXTURES, "full-plugin"), join(tmpDir, "test-full"), { recursive: true });
      const stdout = run(join(tmpDir, "test-full"), "1.0.0");
      const jsonStart = stdout.indexOf("{");
      output = JSON.parse(stdout.slice(jsonStart));
    });

    after(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      if (output?.zipPath && existsSync(output.zipPath)) {
        rmSync(output.zipPath);
      }
    });

    it("outputs correct pluginId", () => {
      assert.equal(output.pluginId, "test-full");
    });

    it("outputs correct version", () => {
      assert.equal(output.version, "1.0.0");
    });

    it("creates dist/main.js via build", () => {
      assert.ok(existsSync(join(tmpDir, "test-full", "dist", "main.js")));
    });

    it("zip contains dist/", () => {
      const listing = execSync(`unzip -l "${output.zipPath}"`, { encoding: "utf8" });
      assert.ok(listing.includes("dist/"));
    });

    it("zip contains manifest.json", () => {
      const listing = execSync(`unzip -l "${output.zipPath}"`, { encoding: "utf8" });
      assert.ok(listing.includes("manifest.json"));
    });
  });

  describe("version mismatch", () => {
    it("fails when expected version does not match manifest", () => {
      const tmpDir = makeTempDir();
      try {
        cpSync(join(FIXTURES, "pack-plugin"), join(tmpDir, "test-pack"), { recursive: true });
        const err = runExpectFail(join(tmpDir, "test-pack"), "9.9.9");
        assert.ok(err.stderr.includes("Version mismatch") || err.message.includes("Version mismatch"));
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("missing manifest", () => {
    it("fails when manifest.json is missing", () => {
      const tmpDir = makeTempDir();
      try {
        mkdirSync(join(tmpDir, "empty-plugin"), { recursive: true });
        const err = runExpectFail(join(tmpDir, "empty-plugin"), "1.0.0");
        assert.ok(err.stderr.includes("manifest.json not found") || err.status !== 0);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("invalid permissions", () => {
    it("fails when manifest has unknown permissions", () => {
      const tmpDir = makeTempDir();
      try {
        cpSync(join(FIXTURES, "bad-manifest"), join(tmpDir, "bad-plugin"), { recursive: true });
        const err = runExpectFail(join(tmpDir, "bad-plugin"), "1.0.0");
        assert.ok(err.stderr.includes("Unknown permission") || err.status !== 0);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("strict mode - missing dist/main.js", () => {
    it("fails when main is declared but dist/main.js does not exist", () => {
      const tmpDir = makeTempDir();
      try {
        // Create a plugin with main declared but no dist/ and no package.json (so no build step)
        mkdirSync(join(tmpDir, "no-dist"), { recursive: true });
        writeFileSync(
          join(tmpDir, "no-dist", "manifest.json"),
          JSON.stringify({
            id: "no-dist",
            name: "No Dist",
            version: "1.0.0",
            description: "Missing dist",
            author: "Test",
            engine: { api: 0.7 },
            scope: "project",
            main: "./dist/main.js",
            permissions: [],
          })
        );
        const err = runExpectFail(join(tmpDir, "no-dist"), "1.0.0");
        assert.ok(err.stderr.includes("main entry point not found") || err.status !== 0);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
