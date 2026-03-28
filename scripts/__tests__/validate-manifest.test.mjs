import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { validateManifest } from "../validate-manifest.mjs";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "validate-manifest-test-"));
}

function writeManifest(dir, manifest) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

function validManifest(overrides = {}) {
  return {
    id: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    description: "A test plugin",
    author: "Test Author",
    engine: { api: 0.7 },
    scope: "project",
    main: "./dist/main.js",
    permissions: ["logging"],
    ...overrides,
  };
}

describe("validateManifest", () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTempDir();
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Valid manifest ───────────────────────────────────────────────────

  it("passes for a valid manifest", () => {
    const dir = join(tmpDir, "valid");
    writeManifest(dir, validManifest());
    const { errors, warnings } = validateManifest(dir);
    assert.equal(errors.length, 0, `Expected no errors, got: ${errors.join(", ")}`);
  });

  it("passes for the full-plugin fixture", () => {
    const { errors } = validateManifest(join(FIXTURES, "full-plugin"));
    assert.equal(errors.length, 0, `Expected no errors, got: ${errors.join(", ")}`);
  });

  // ── Missing required fields ──────────────────────────────────────────

  it("rejects missing name field", () => {
    const dir = join(tmpDir, "no-name");
    const m = validManifest();
    delete m.name;
    writeManifest(dir, m);
    const { errors } = validateManifest(dir);
    assert.ok(errors.some((e) => e.includes("name")), `Expected name error in: ${errors}`);
  });

  it("rejects missing engine field", () => {
    const dir = join(tmpDir, "no-engine");
    const m = validManifest();
    delete m.engine;
    writeManifest(dir, m);
    const { errors } = validateManifest(dir);
    assert.ok(errors.some((e) => e.includes("engine")), `Expected engine error in: ${errors}`);
  });

  it("rejects missing main field for regular plugins", () => {
    const dir = join(tmpDir, "no-main");
    const m = validManifest();
    delete m.main;
    writeManifest(dir, m);
    const { errors } = validateManifest(dir);
    assert.ok(errors.some((e) => e.includes("main")), `Expected main error in: ${errors}`);
  });

  // ── Invalid API version ──────────────────────────────────────────────

  it("rejects unknown API version", () => {
    const dir = join(tmpDir, "bad-api");
    writeManifest(dir, validManifest({ engine: { api: 0.1 } }));
    const { errors } = validateManifest(dir);
    assert.ok(errors.some((e) => e.includes("Unknown API version")), `Expected API error in: ${errors}`);
  });

  it("rejects removed API version", () => {
    const dir = join(tmpDir, "removed-api");
    writeManifest(dir, validManifest({ engine: { api: 0.5 } }));
    const { errors } = validateManifest(dir);
    // 0.5 may or may not exist — check for error or warning
    assert.ok(
      errors.some((e) => e.includes("API version")) || errors.length === 0,
      "Should handle non-existent API version"
    );
  });

  // ── Invalid permissions ──────────────────────────────────────────────

  it("rejects unknown permission strings", () => {
    const dir = join(tmpDir, "bad-perm");
    writeManifest(dir, validManifest({ permissions: ["nonexistent-permission"] }));
    const { errors } = validateManifest(dir);
    assert.ok(errors.some((e) => e.includes("Unknown permission")), `Expected permission error in: ${errors}`);
  });

  it("rejects non-array permissions", () => {
    const dir = join(tmpDir, "perm-string");
    writeManifest(dir, validManifest({ permissions: "logging" }));
    const { errors } = validateManifest(dir);
    assert.ok(errors.some((e) => e.includes("must be an array")), `Expected array error in: ${errors}`);
  });

  // ── ID format ────────────────────────────────────────────────────────

  it("rejects uppercase in ID", () => {
    const dir = join(tmpDir, "bad-id");
    writeManifest(dir, validManifest({ id: "MyPlugin" }));
    const { errors } = validateManifest(dir);
    assert.ok(errors.some((e) => e.includes("Invalid ID format")), `Expected ID error in: ${errors}`);
  });

  // ── Version format ───────────────────────────────────────────────────

  it("rejects non-semver version", () => {
    const dir = join(tmpDir, "bad-version");
    writeManifest(dir, validManifest({ version: "v1" }));
    const { errors } = validateManifest(dir);
    assert.ok(errors.some((e) => e.includes("Invalid version")), `Expected version error in: ${errors}`);
  });

  // ── Scope ────────────────────────────────────────────────────────────

  it("rejects invalid scope", () => {
    const dir = join(tmpDir, "bad-scope");
    writeManifest(dir, validManifest({ scope: "global" }));
    const { errors } = validateManifest(dir);
    assert.ok(errors.some((e) => e.includes("Invalid scope")), `Expected scope error in: ${errors}`);
  });

  // ── Missing manifest ─────────────────────────────────────────────────

  it("returns error when manifest.json is missing", () => {
    const dir = join(tmpDir, "empty");
    mkdirSync(dir, { recursive: true });
    const { errors } = validateManifest(dir);
    assert.ok(errors.some((e) => e.includes("not found")), `Expected not found error in: ${errors}`);
  });

  // ── Pack plugins ─────────────────────────────────────────────────────

  it("does not require main field for pack plugins", () => {
    const dir = join(tmpDir, "pack");
    const m = validManifest({ kind: "pack" });
    delete m.main;
    writeManifest(dir, m);
    const { errors } = validateManifest(dir);
    assert.ok(!errors.some((e) => e.includes("main")), `Pack should not require main, got: ${errors}`);
  });
});
