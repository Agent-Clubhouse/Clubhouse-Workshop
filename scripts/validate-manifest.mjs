#!/usr/bin/env node

// Validate a plugin manifest.json against the canonical schema.
// Usage: node scripts/validate-manifest.mjs plugins/my-plugin [--strict]
//   --strict: also checks that dist/main.js exists

import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const REPO_ROOT = resolve(import.meta.dirname, "..");

// ── helpers ──────────────────────────────────────────────────────────────────

function loadPermissions() {
  const p = join(REPO_ROOT, "sdk", "permissions.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

function loadVersions() {
  const p = join(REPO_ROOT, "sdk", "versions.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

function isSemver(v) {
  return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v);
}

// ── core validation ──────────────────────────────────────────────────────────

export function validateManifest(pluginDir, { strict = false } = {}) {
  const errors = [];
  const warnings = [];

  const manifestPath = join(pluginDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return { errors: [`manifest.json not found in ${pluginDir}`], warnings };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    return { errors: [`manifest.json is not valid JSON: ${e.message}`], warnings };
  }

  // Required fields
  const required = ["id", "name", "version", "description", "author", "engine", "scope", "main"];
  for (const field of required) {
    if (!(field in manifest)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // ID format
  if (manifest.id && !/^[a-z0-9-]+$/.test(manifest.id)) {
    errors.push(`Invalid ID format: "${manifest.id}" (must be lowercase alphanumeric with hyphens)`);
  }

  // Version is semver
  if (manifest.version && !isSemver(manifest.version)) {
    errors.push(`Invalid version: "${manifest.version}" (must be semver, e.g. 1.0.0)`);
  }

  // Scope
  const validScopes = ["project", "app", "dual"];
  if (manifest.scope && !validScopes.includes(manifest.scope)) {
    errors.push(`Invalid scope: "${manifest.scope}" (must be one of: ${validScopes.join(", ")})`);
  }

  // Engine / API version
  const versions = loadVersions();
  if (manifest.engine) {
    const api = String(manifest.engine.api);
    const entry = versions.versions[api];
    if (!entry) {
      errors.push(`Unknown API version: ${api} (valid: ${Object.keys(versions.versions).join(", ")})`);
    } else if (entry.status === "removed") {
      errors.push(`Plugin targets removed API version ${api}`);
    } else if (entry.status === "deprecated") {
      warnings.push(`Plugin targets deprecated API version ${api} (removal target: ${entry.removalTarget}). Consider migrating to v${versions.latest}.`);
    }
  }

  // Permissions
  if (manifest.permissions) {
    if (!Array.isArray(manifest.permissions)) {
      errors.push(`permissions must be an array`);
    } else {
      const permData = loadPermissions();
      const api = String(manifest.engine?.api || versions.latest);
      const validPerms = permData.permissions[api] || permData.permissions[versions.latest] || [];
      const sensitive = permData.sensitive || [];

      for (const perm of manifest.permissions) {
        if (!validPerms.includes(perm)) {
          errors.push(`Unknown permission: "${perm}" (valid for API ${api}: ${validPerms.join(", ")})`);
        }
        if (sensitive.includes(perm)) {
          warnings.push(`Sensitive permission: "${perm}" — requires justification in review`);
        }
      }
    }
  }

  // official is no longer a manifest field — warn if present
  if ("official" in manifest) {
    warnings.push(`"official" field is deprecated in manifests — all Workshop plugins are official by default`);
  }

  // settingsPanel consistency
  if (manifest.settingsPanel === "declarative") {
    const settings = manifest.contributes?.settings;
    if (!settings || (Array.isArray(settings) && settings.length === 0)) {
      warnings.push(`settingsPanel is "declarative" but contributes.settings is empty or missing`);
    }
  }

  // allowedCommands must be array of strings if present
  if ("allowedCommands" in manifest) {
    if (!Array.isArray(manifest.allowedCommands)) {
      errors.push(`allowedCommands must be an array`);
    } else {
      for (const cmd of manifest.allowedCommands) {
        if (typeof cmd !== "string") {
          errors.push(`allowedCommands entries must be strings, got: ${typeof cmd}`);
        }
      }
    }
  }

  // strict: check dist/main.js exists
  if (strict && manifest.main) {
    const mainPath = join(pluginDir, manifest.main);
    if (!existsSync(mainPath)) {
      errors.push(`main entry point not found: ${manifest.main}`);
    }
  }

  return { errors, warnings, manifest };
}

// ── CLI entry point ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help")) {
  console.log("Usage: node scripts/validate-manifest.mjs <plugin-dir> [--strict]");
  console.log("  --strict  Also check that dist/main.js exists");
  process.exit(args.includes("--help") ? 0 : 1);
}

const pluginDir = resolve(args[0]);
const strict = args.includes("--strict");
const { errors, warnings, manifest } = validateManifest(pluginDir, { strict });

if (warnings.length > 0) {
  for (const w of warnings) console.warn(`WARNING: ${w}`);
}
if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}

console.log(`OK: ${manifest.id} v${manifest.version} (API ${manifest.engine.api}, scope: ${manifest.scope})`);
