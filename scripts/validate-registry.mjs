#!/usr/bin/env node

// Validate registry/registry.json against the canonical schema.
// Usage: node scripts/validate-registry.mjs [--check-assets]
//   --check-assets: HTTP HEAD each asset URL to verify reachability

import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";

const REPO_ROOT = resolve(import.meta.dirname, "..");

// ── helpers ──────────────────────────────────────────────────────────────────

function loadVersions() {
  const p = join(REPO_ROOT, "sdk", "versions.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

function loadPermissions() {
  const p = join(REPO_ROOT, "sdk", "permissions.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.ok;
  } catch {
    return false;
  }
}

// ── core validation ──────────────────────────────────────────────────────────

export async function validateRegistry({ checkAssets = false } = {}) {
  const errors = [];
  const warnings = [];

  const registryPath = join(REPO_ROOT, "registry", "registry.json");
  if (!existsSync(registryPath)) {
    return { errors: ["registry/registry.json not found"], warnings };
  }

  let registry;
  try {
    registry = JSON.parse(readFileSync(registryPath, "utf8"));
  } catch (e) {
    return { errors: [`registry.json is not valid JSON: ${e.message}`], warnings };
  }

  // Top-level fields
  if (typeof registry.version !== "number") errors.push("Missing or invalid top-level version field");
  if (!Array.isArray(registry.plugins)) {
    errors.push("Missing or invalid plugins array");
    return { errors, warnings };
  }

  const sdkVersions = loadVersions();
  const permData = loadPermissions();

  // Validate supportedApis consistency with sdk/versions.json
  if (sdkVersions && registry.supportedApis) {
    if (registry.supportedApis.latest !== sdkVersions.latest) {
      warnings.push(`supportedApis.latest (${registry.supportedApis.latest}) doesn't match sdk/versions.json latest (${sdkVersions.latest})`);
    }
    if (registry.supportedApis.minimum !== sdkVersions.minimum) {
      warnings.push(`supportedApis.minimum (${registry.supportedApis.minimum}) doesn't match sdk/versions.json minimum (${sdkVersions.minimum})`);
    }
  }

  // Plugin validation
  const ids = new Set();
  for (const plugin of registry.plugins) {
    const prefix = plugin.id || "(unknown)";

    // Required fields
    const required = ["id", "name", "description", "author", "repo", "latest", "releases"];
    for (const field of required) {
      if (!(field in plugin)) errors.push(`${prefix}: Missing required field: ${field}`);
    }

    // Unique IDs
    if (plugin.id) {
      if (ids.has(plugin.id)) errors.push(`Duplicate plugin ID: ${plugin.id}`);
      ids.add(plugin.id);
    }

    // ID format
    if (plugin.id && !/^[a-z0-9-]+$/.test(plugin.id)) {
      errors.push(`${prefix}: Invalid ID format (must be lowercase alphanumeric with hyphens)`);
    }

    // Reserved prefix — example- is reserved for official Workshop examples
    if (plugin.id?.startsWith("example-") && plugin.official === false) {
      errors.push(`${prefix}: The example- prefix is reserved for official examples`);
    }

    // official must be boolean if present
    if ("official" in plugin && typeof plugin.official !== "boolean") {
      errors.push(`${prefix}: "official" must be a boolean`);
    }

    // Latest must exist in releases
    if (plugin.releases && plugin.latest && !(plugin.latest in plugin.releases)) {
      errors.push(`${prefix}: latest version "${plugin.latest}" not found in releases`);
    }

    // Validate each release
    if (plugin.releases) {
      for (const [version, release] of Object.entries(plugin.releases)) {
        const rPrefix = `${prefix}@${version}`;

        if (typeof release.api !== "number") errors.push(`${rPrefix}: missing or invalid api version`);
        if (typeof release.asset !== "string") errors.push(`${rPrefix}: missing asset URL`);
        if (!Array.isArray(release.permissions)) errors.push(`${rPrefix}: missing or invalid permissions array`);

        // Validate API version against SDK
        if (sdkVersions && typeof release.api === "number") {
          const api = String(release.api);
          const entry = sdkVersions.versions[api];
          if (!entry) {
            warnings.push(`${rPrefix}: targets unknown API version ${api}`);
          } else if (entry.status === "removed") {
            errors.push(`${rPrefix}: targets removed API version ${api}`);
          } else if (entry.status === "deprecated") {
            warnings.push(`${rPrefix}: targets deprecated API version ${api}`);
          }
        }

        // Validate permissions against canonical enum
        if (permData && Array.isArray(release.permissions) && typeof release.api === "number") {
          const api = String(release.api);
          const validPerms = permData.permissions[api] || permData.permissions[sdkVersions?.latest] || [];
          for (const perm of release.permissions) {
            if (!validPerms.includes(perm)) {
              errors.push(`${rPrefix}: unknown permission "${perm}"`);
            }
            if (permData.sensitive?.includes(perm)) {
              warnings.push(`${rPrefix}: uses sensitive permission "${perm}"`);
            }
          }
        }

        // Check asset reachability
        if (checkAssets && typeof release.asset === "string") {
          const ok = await checkUrl(release.asset);
          if (ok) {
            console.log(`  OK: ${rPrefix} — asset reachable`);
          } else {
            warnings.push(`${rPrefix}: asset URL not reachable: ${release.asset}`);
          }
        }
      }
    }
  }

  return { errors, warnings, registry };
}

// ── CLI entry point ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: node scripts/validate-registry.mjs [--check-assets]");
  console.log("  --check-assets  HTTP HEAD each asset URL to verify reachability");
  process.exit(0);
}

const checkAssets = args.includes("--check-assets");
const { errors, warnings, registry } = await validateRegistry({ checkAssets });

if (warnings.length > 0) {
  for (const w of warnings) console.warn(`WARNING: ${w}`);
}
if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}

console.log(`Registry valid: ${registry.plugins.length} plugin(s)`);
