#!/usr/bin/env node

// Auto-detect plugins with version bumps relative to the registry.
// Usage: node scripts/detect-releasable.mjs [--registry <path>] [--plugins-dir <path>]
//
// Outputs a JSON array of { pluginId, version, tag, currentLatest } objects
// for plugins whose manifest version is newer than the registry's latest
// (or not in the registry at all).

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";

const REPO_ROOT = resolve(import.meta.dirname, "..");

// ── semver comparison ────────────────────────────────────────────────────────

function parseSemver(v) {
  const [major, minor, patch] = v.split("-")[0].split(".").map(Number);
  return { major, minor, patch };
}

function semverGt(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa.major !== pb.major) return pa.major > pb.major;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor;
  return pa.patch > pb.patch;
}

// ── core detection ───────────────────────────────────────────────────────────

export function detectReleasable({
  registryPath = join(REPO_ROOT, "registry", "registry.json"),
  pluginsDir = join(REPO_ROOT, "plugins"),
} = {}) {
  // Load registry
  let registry = { plugins: [] };
  if (existsSync(registryPath)) {
    registry = JSON.parse(readFileSync(registryPath, "utf8"));
  }

  // Build lookup: pluginId -> latest version in registry
  const registryLatest = new Map();
  for (const plugin of registry.plugins) {
    registryLatest.set(plugin.id, plugin.latest);
  }

  // Scan all plugin directories
  const results = [];
  if (!existsSync(pluginsDir)) return results;

  for (const entry of readdirSync(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const manifestPath = join(pluginsDir, entry.name, "manifest.json");
    if (!existsSync(manifestPath)) continue;

    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      continue; // Skip invalid manifests
    }

    const pluginId = manifest.id;
    const version = manifest.version;
    if (!pluginId || !version) continue;

    const currentLatest = registryLatest.get(pluginId) || null;

    if (!currentLatest || semverGt(version, currentLatest)) {
      results.push({
        pluginId,
        version,
        tag: `${pluginId}-v${version}`,
        currentLatest,
      });
    }
  }

  return results;
}

// ── CLI entry point ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: node scripts/detect-releasable.mjs [--registry <path>] [--plugins-dir <path>]");
  console.log("");
  console.log("Detects plugins whose manifest version is newer than the registry's latest.");
  console.log("Outputs a JSON array to stdout.");
  process.exit(0);
}

const registryIdx = args.indexOf("--registry");
const pluginsDirIdx = args.indexOf("--plugins-dir");

const opts = {};
if (registryIdx !== -1) opts.registryPath = resolve(args[registryIdx + 1]);
if (pluginsDirIdx !== -1) opts.pluginsDir = resolve(args[pluginsDirIdx + 1]);

const releasable = detectReleasable(opts);
console.log(JSON.stringify(releasable, null, 2));
