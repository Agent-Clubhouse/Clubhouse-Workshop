#!/usr/bin/env node

// Per-plugin build, validate, and zip script for release pipelines.
// Usage: node scripts/release-plugin.mjs <plugin-dir> <expected-version> [--repo <repo>]
//
// Outputs structured JSON to stdout on success:
//   { pluginId, version, tag, zipPath, sha256, size, manifest }
//
// Exits with code 1 on any validation or build failure.

import { readFileSync, existsSync, mkdirSync, createWriteStream } from "fs";
import { join, resolve, basename } from "path";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { statSync, readdirSync } from "fs";
import { validateManifest } from "./validate-manifest.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "..");

// ── helpers ──────────────────────────────────────────────────────────────────

function fatal(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function exec(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function computeSha256(filePath) {
  const data = readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

function fileSize(filePath) {
  return statSync(filePath).size;
}

// Recursively collect files relative to a base directory
function collectFiles(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else {
      results.push(full.slice(base.length + 1));
    }
  }
  return results;
}

// ── zip creation ─────────────────────────────────────────────────────────────

function createZip(pluginDir, outputPath, manifest) {
  const isPack = manifest.kind === "pack";
  const filesToInclude = ["manifest.json"];

  // Include dist/ for non-pack plugins
  if (!isPack && existsSync(join(pluginDir, "dist"))) {
    filesToInclude.push("dist/");
  }

  // Include README.md if present
  if (existsSync(join(pluginDir, "README.md"))) {
    filesToInclude.push("README.md");
  }

  const fileArgs = filesToInclude.join(" ");
  exec(`zip -r "${outputPath}" ${fileArgs}`, { cwd: pluginDir, stdio: "pipe" });
}

// ── main ─────────────────────────────────────────────────────────────────────

export async function releasePlugin(pluginDir, expectedVersion, { repo = "" } = {}) {
  pluginDir = resolve(pluginDir);

  // 1. Validate manifest (strict mode — checks dist/main.js exists if declared)
  const isPack = (() => {
    try {
      const m = JSON.parse(readFileSync(join(pluginDir, "manifest.json"), "utf8"));
      return m.kind === "pack";
    } catch {
      return false;
    }
  })();

  // For pack plugins or plugins without package.json, skip strict initially
  // (we'll run strict after build for non-pack plugins)
  const hasPackageJson = existsSync(join(pluginDir, "package.json"));
  const preValidation = validateManifest(pluginDir, { strict: isPack || !hasPackageJson });

  if (preValidation.errors.length > 0) {
    return { success: false, errors: preValidation.errors };
  }

  const manifest = preValidation.manifest;

  // 2. Verify version matches expected
  if (manifest.version !== expectedVersion) {
    return {
      success: false,
      errors: [`Version mismatch: manifest has ${manifest.version}, expected ${expectedVersion}`],
    };
  }

  // 3. Verify ID matches directory name
  const dirName = basename(pluginDir);
  if (manifest.id !== dirName) {
    // This is a warning, not an error — allow it but log
    for (const w of preValidation.warnings) {
      console.warn(`WARNING: ${w}`);
    }
  }

  // 4. Build (if package.json exists)
  if (hasPackageJson) {
    try {
      exec("npm install", { cwd: pluginDir });
      exec("npm run build", { cwd: pluginDir });
    } catch (e) {
      return { success: false, errors: [`Build failed: ${e.message}`] };
    }

    // Run tests if test script exists
    try {
      const pkg = JSON.parse(readFileSync(join(pluginDir, "package.json"), "utf8"));
      if (pkg.scripts?.test) {
        exec("npm test", { cwd: pluginDir });
      }
    } catch (e) {
      return { success: false, errors: [`Tests failed: ${e.message}`] };
    }

    // Re-validate in strict mode after build
    const postValidation = validateManifest(pluginDir, { strict: true });
    if (postValidation.errors.length > 0) {
      return { success: false, errors: postValidation.errors };
    }
  }

  // 5. Create zip
  const tag = `${manifest.id}-v${manifest.version}`;
  const zipName = `${tag}.zip`;
  const zipPath = resolve(REPO_ROOT, zipName);

  createZip(pluginDir, zipPath, manifest);

  if (!existsSync(zipPath)) {
    return { success: false, errors: ["Failed to create zip file"] };
  }

  // 6. Compute sha256 and size
  const sha256 = computeSha256(zipPath);
  const size = fileSize(zipPath);

  // Print warnings
  for (const w of preValidation.warnings) {
    console.warn(`WARNING: ${w}`);
  }

  const result = {
    pluginId: manifest.id,
    version: manifest.version,
    tag,
    zipPath,
    sha256,
    size,
    manifest,
  };

  return { success: true, ...result };
}

// ── CLI entry point ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length < 2 || args.includes("--help")) {
  console.log("Usage: node scripts/release-plugin.mjs <plugin-dir> <expected-version> [--repo <repo>]");
  console.log("");
  console.log("Builds, validates, and zips a plugin for release.");
  console.log("Outputs structured JSON to stdout on success.");
  process.exit(args.includes("--help") ? 0 : 1);
}

const pluginDir = resolve(args[0]);
const expectedVersion = args[1];
const repoIdx = args.indexOf("--repo");
const repo = repoIdx !== -1 ? args[repoIdx + 1] : "";

const result = await releasePlugin(pluginDir, expectedVersion, { repo });

if (!result.success) {
  for (const e of result.errors) {
    console.error(`ERROR: ${e}`);
  }
  process.exit(1);
}

// Output structured JSON to stdout
console.log(JSON.stringify(result, null, 2));
