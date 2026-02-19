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

# 2. Build and test
npm run build
npm test

# 3. Commit the version bump
git add -A && git commit -m "my-plugin: bump to v1.0.0"

# 4. Tag the release
git tag my-plugin-v1.0.0
git push origin main --tags

# 5. CI handles the rest:
#    - Builds the plugin
#    - Validates the manifest
#    - Creates a zip artifact
#    - Creates a GitHub Release
#    - Updates registry.json with the new version
```

## Registry format

See `registry.json` for the full schema. Each plugin entry contains:

| Field | Description |
|---|---|
| `id` | Unique plugin identifier (matches manifest) |
| `name` | Display name |
| `description` | Short description |
| `author` | Author name |
| `source` | `first-party` or `community` |
| `repo` | Source repository URL |
| `path` | Path within the repo (for monorepo plugins) |
| `tags` | Searchable keywords |
| `latest` | Current recommended version |
| `releases` | Map of version to release info (asset URL, sha256, permissions, size) |

## Versioning

The `"version": 1` field at the top of `registry.json` tracks the schema version. If the schema changes incompatibly, this number bumps. The app checks this field and shows "Please update Clubhouse" if it encounters a version it doesn't understand.
