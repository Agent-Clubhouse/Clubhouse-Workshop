# Plugin Registry

This directory contains the machine-readable plugin catalog that powers the Clubhouse Workshop browser.

## How it works

`registry.json` lists all available plugins — both first-party (built in this repo) and community-submitted. The Clubhouse app fetches this file to populate the plugin browser in Settings.

## For first-party plugin authors

Releases are automated via CI. To release a new version:

```bash
# 1. Update version in manifest.json and package.json
cd plugins/my-plugin
# edit manifest.json: bump "version"
# edit package.json: bump "version"

# 2. Build and test locally
npm run build
npm test

# 3. Commit the version bump (via PR — branch protection requires it)
git checkout -b my-plugin/v1.0.0
git add -A && git commit -m "my-plugin: bump to v1.0.0"
git push origin my-plugin/v1.0.0
# Open and merge a PR

# 4. Tag the release on main
git checkout main && git pull
git tag -m "Release my-plugin v1.0.0" my-plugin-v1.0.0
git push origin my-plugin-v1.0.0
```

CI handles the rest automatically:
1. Builds the plugin and validates the manifest
2. Creates a zip artifact and GitHub Release
3. Opens a PR to update `registry.json` with the new version's sha256, size, and permissions

You can also trigger a release manually:
```bash
gh workflow run "Release Plugin" -f tag=my-plugin-v1.0.0
```

## Registry format

See `registry.json` for the full schema. Each plugin entry contains:

| Field | Description |
|---|---|
| `id` | Unique plugin identifier (matches manifest) |
| `name` | Display name |
| `description` | Short description |
| `author` | Author name |
| `official` | `true` for Clubhouse Workshop-maintained plugins, omitted or `false` for community |
| `repo` | Source repository URL |
| `path` | Path within the repo (for monorepo plugins) |
| `tags` | Searchable keywords |
| `latest` | Current recommended version |
| `releases` | Map of version to release info (asset URL, sha256, permissions, size) |

## Versioning

The `"version": 1` field at the top of `registry.json` tracks the schema version. If the schema changes incompatibly, this number bumps. The app checks this field and shows "Please update Clubhouse" if it encounters a version it doesn't understand.
