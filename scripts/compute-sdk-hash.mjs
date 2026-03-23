#!/usr/bin/env node
/**
 * Compute SHA-256 integrity hashes for SDK API surface files.
 *
 * Usage:
 *   node scripts/compute-sdk-hash.mjs              # print hashes for all versions
 *   node scripts/compute-sdk-hash.mjs --update     # compute and write hashes into versions.json
 *   node scripts/compute-sdk-hash.mjs --verify     # verify hashes match (CI mode, exits 1 on mismatch)
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const VERSIONS_PATH = join(ROOT, 'sdk', 'versions.json');

/** Files that define the API surface — order matters for deterministic hashing. */
const API_SURFACE_FILES = ['plugin-types/index.d.ts', 'plugin-types/package.json'];

function computeHash(sdkPath) {
  const hash = createHash('sha256');
  for (const file of API_SURFACE_FILES) {
    const filePath = join(ROOT, sdkPath, file);
    if (!existsSync(filePath)) {
      throw new Error(`Missing API surface file: ${filePath}`);
    }
    const content = readFileSync(filePath, 'utf8');
    // Normalize line endings for cross-platform consistency
    hash.update(content.replace(/\r\n/g, '\n'));
  }
  return hash.digest('hex');
}

const versions = JSON.parse(readFileSync(VERSIONS_PATH, 'utf8'));
const mode = process.argv[2];

let hasError = false;

for (const [ver, entry] of Object.entries(versions.versions)) {
  if (!entry.sdkPath || entry.status === 'removed') continue;

  // WIP versions are not hash-locked
  if (entry.status === 'wip') {
    console.log(`v${ver}: wip (skipped)`);
    continue;
  }

  const computed = computeHash(entry.sdkPath);

  if (mode === '--update') {
    entry.integrityHash = computed;
    console.log(`v${ver}: ${computed} (updated)`);
  } else if (mode === '--verify') {
    if (!entry.integrityHash) {
      console.error(`v${ver}: ERROR — no integrityHash in versions.json (status: ${entry.status})`);
      hasError = true;
    } else if (entry.integrityHash !== computed) {
      console.error(`v${ver}: MISMATCH`);
      console.error(`  expected: ${entry.integrityHash}`);
      console.error(`  computed: ${computed}`);
      console.error(`  If this change is intentional (security/bug fix), update the hash with:`);
      console.error(`    node scripts/compute-sdk-hash.mjs --update`);
      console.error(`  and document the change in sdk/${entry.sdkPath}/PATCHES.md`);
      hasError = true;
    } else {
      console.log(`v${ver}: OK (${computed.slice(0, 12)}…)`);
    }
  } else {
    // Default: just print
    const match = entry.integrityHash === computed ? 'OK' :
                  entry.integrityHash ? 'MISMATCH' : 'no hash';
    console.log(`v${ver}: ${computed} [${match}]`);
  }
}

if (mode === '--update') {
  writeFileSync(VERSIONS_PATH, JSON.stringify(versions, null, 2) + '\n');
  console.log('\nversions.json updated.');
}

if (hasError) {
  process.exit(1);
}
