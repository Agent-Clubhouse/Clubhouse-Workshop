# Plugin Registry

This directory contains the machine-readable plugin catalog that powers the Clubhouse plugin browser.

## How it works

`registry.json` lists all available plugins — both first-party (built in this repo) and community-submitted. The Clubhouse app fetches this file to populate the plugin browser in Settings.

## Releasing a first-party plugin

Releases are automated via CI. Three steps:

```bash
# 1. Open a PR with your changes (version bump, code, etc.)
cd plugins/my-plugin
# bump "version" in manifest.json AND package.json
npm run build && npm test
node ../../scripts/validate-manifest.mjs .   # catch issues locally
git checkout -b my-plugin/v1.0.0
git add -A && git commit -m "my-plugin: bump to v1.0.0"
git push origin my-plugin/v1.0.0
# Open PR, get it reviewed and merged

# 2. Tag the release on main
git checkout main && git pull
git tag my-plugin-v1.0.0
git push origin my-plugin-v1.0.0
```

**That's it.** CI handles everything else:

1. Builds the plugin and runs tests (failures block the release)
2. Validates the manifest against the canonical permission enum and API versions
3. Verifies manifest version and ID match the tag
4. Creates a zip artifact and GitHub Release
5. Updates `registry.json` directly on main (no second PR needed)

You can also trigger a release manually:
```bash
gh workflow run "Release Plugin" -f tag=my-plugin-v1.0.0
```

### Local validation

Before pushing, validate your manifest locally:

```bash
# Single plugin
node scripts/validate-manifest.mjs plugins/my-plugin

# All plugins
for d in plugins/*/; do node scripts/validate-manifest.mjs "$d"; done

# Registry
node scripts/validate-registry.mjs
```

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Missing required field: X" | manifest.json is incomplete | Add the missing field |
| "Unknown permission: X" | Typo or invalid permission | Check `sdk/permissions.json` for valid values |
| "Version mismatch" | Tag version != manifest version | Ensure tag `my-plugin-v1.0.0` matches `"version": "1.0.0"` |
| "Tests failed" | `npm test` exits non-zero | Fix tests before tagging |
| "dist/ out of date" | Built files don't match source | Run `npm run build` and commit |

## Registry format

See `registry.json` for the full schema. Each plugin entry contains:

| Field | Description |
|---|---|
| `id` | Unique plugin identifier (matches manifest) |
| `name` | Display name |
| `description` | Short description |
| `author` | Author name |
| `official` | `true` for Clubhouse Workshop plugins, omitted or `false` for community |
| `repo` | Source repository URL |
| `path` | Path within the repo (for monorepo plugins) |
| `tags` | Searchable keywords |
| `latest` | Current recommended version |
| `releases` | Map of version to release info (asset URL, sha256, permissions, size) |

## Versioning

The `"version": 1` field at the top of `registry.json` tracks the schema version. If the schema changes incompatibly, this number bumps. The app checks this field and shows "Please update Clubhouse" if it encounters a version it doesn't understand.

## Validation

All validation uses shared scripts in `scripts/`:

- **`scripts/validate-manifest.mjs`** — validates a plugin's manifest.json against required fields, permission enum (`sdk/permissions.json`), API versions (`sdk/versions.json`), semver, scope, etc.
- **`scripts/validate-registry.mjs`** — validates registry.json schema, cross-references permissions and API versions, optionally checks asset URL reachability (`--check-assets`).

These same scripts run in CI (on PRs via `validate-pr.yml`, on releases via `release-plugin.yml`) and can be run locally.
