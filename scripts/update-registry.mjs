#!/usr/bin/env node

// Batch registry update script.
// Usage: node scripts/update-registry.mjs <releases-json-path> [--registry <path>] [--repo <repo>]
//
// The releases JSON file must contain an array of objects:
//   [{ pluginId, version, tag, sha256, size, manifest }]
//
// Updates registry/registry.json for all releases in one pass,
// syncs supportedApis from sdk/versions.json, and validates the result.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { validateRegistry } from "./validate-registry.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "..");

// ── core update ──────────────────────────────────────────────────────────────

export async function updateRegistry(
  releases,
  {
    registryPath = join(REPO_ROOT, "registry", "registry.json"),
    versionsPath = join(REPO_ROOT, "sdk", "versions.json"),
    repo = "https://github.com/Agent-Clubhouse/Clubhouse-Workshop",
    validate = true,
  } = {}
) {
  // Load current registry
  let registry;
  if (existsSync(registryPath)) {
    registry = JSON.parse(readFileSync(registryPath, "utf8"));
  } else {
    registry = {
      version: 1,
      updated: new Date().toISOString(),
      supportedApis: {},
      plugins: [],
    };
  }

  // Apply each release
  for (const release of releases) {
    const { pluginId, version, tag, sha256, size, manifest } = release;

    let plugin = registry.plugins.find((p) => p.id === pluginId);
    if (!plugin) {
      plugin = {
        id: pluginId,
        name: manifest.name,
        description: manifest.description,
        author: manifest.author,
        official: true,
        repo,
        path: `plugins/${pluginId}`,
        tags: [],
        latest: version,
        releases: {},
      };
      registry.plugins.push(plugin);
    }

    // Update metadata from manifest
    plugin.name = manifest.name;
    plugin.description = manifest.description;
    plugin.author = manifest.author;
    plugin.latest = version;

    // Add release entry
    plugin.releases[version] = {
      api: manifest.engine.api,
      asset: `${repo}/releases/download/${tag}/${tag}.zip`,
      sha256,
      permissions: manifest.permissions || [],
      size,
    };
  }

  // Sync supportedApis from sdk/versions.json
  if (existsSync(versionsPath)) {
    const sdkVersions = JSON.parse(readFileSync(versionsPath, "utf8"));
    const activeVersions = Object.entries(sdkVersions.versions)
      .filter(([_, e]) => e.status !== "removed")
      .map(([v]) => v);
    registry.supportedApis = {
      latest: sdkVersions.latest,
      minimum: sdkVersions.minimum,
      versions: activeVersions,
    };
  }

  // Update timestamp
  registry.updated = new Date().toISOString();

  // Write registry
  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");

  // Validate if requested
  if (validate) {
    // validateRegistry reads from disk, so the file must be written first
    const { errors, warnings } = await validateRegistry();
    return { errors, warnings, registry };
  }

  return { errors: [], warnings: [], registry };
}

// ── CLI entry point ──────────────────────────────────────────────────────────

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, "update-registry.mjs");
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log("Usage: node scripts/update-registry.mjs <releases-json-path> [--registry <path>] [--repo <repo>]");
    console.log("");
    console.log("Updates registry.json with an array of release metadata.");
    console.log("The JSON file must contain: [{ pluginId, version, tag, sha256, size, manifest }]");
    process.exit(args.includes("--help") ? 0 : 1);
  }

  const releasesPath = resolve(args[0]);
  const registryIdx = args.indexOf("--registry");
  const repoIdx = args.indexOf("--repo");

  const opts = {};
  if (registryIdx !== -1) opts.registryPath = resolve(args[registryIdx + 1]);
  if (repoIdx !== -1) opts.repo = args[repoIdx + 1];

  const releases = JSON.parse(readFileSync(releasesPath, "utf8"));
  const { errors, warnings } = await updateRegistry(releases, opts);

  if (warnings.length > 0) {
    for (const w of warnings) console.warn(`WARNING: ${w}`);
  }
  if (errors.length > 0) {
    for (const e of errors) console.error(`ERROR: ${e}`);
    process.exit(1);
  }

  console.log(`Registry updated with ${releases.length} release(s).`);
}
