# P2 — Registry and Automated Releases

> Make plugins discoverable and installable without git clone or manual copying.

**Depends on:** Clubhouse P2 (Workshop browser + one-click install in the app)

---

## 1. Registry format

**Path:** `registry/registry.json`

```json
{
  "version": 1,
  "updated": "2026-02-16T00:00:00Z",
  "plugins": [
    {
      "id": "example-hello-world",
      "name": "Hello World",
      "description": "A minimal example plugin for Clubhouse.",
      "author": "Clubhouse Workshop",
      "official": true,
      "repo": "https://github.com/Agent-Clubhouse/Clubhouse-Workshop",
      "path": "plugins/example-hello-world",
      "tags": ["example", "starter"],
      "latest": "0.1.0",
      "releases": {
        "0.1.0": {
          "api": 0.5,
          "asset": "https://github.com/Agent-Clubhouse/Clubhouse-Workshop/releases/download/example-hello-world-v0.1.0/example-hello-world-v0.1.0.zip",
          "sha256": "...",
          "permissions": ["logging", "storage", "notifications"],
          "size": 12345
        }
      }
    }
  ]
}
```

**Fields per plugin:**
- `id` — matches the plugin's manifest ID
- `name`, `description`, `author` — display metadata
- `official` — `true` for Clubhouse Workshop-maintained plugins, omitted for community
- `repo` — link to the source repository
- `path` — path within the repo (for first-party plugins in this monorepo)
- `tags` — searchable keywords
- `latest` — current recommended version
- `releases` — map of version → release info
  - `api` — required API version
  - `asset` — download URL for the zip
  - `sha256` — integrity hash
  - `permissions` — what the plugin requires (so the app can show this before download)
  - `size` — approximate download size in bytes

---

## 2. CI/CD for first-party plugin releases

**Path:** `.github/workflows/release-plugin.yml`

**Trigger:** Push a git tag matching `<plugin-id>-v*` (e.g., `example-hello-world-v0.1.0`)

**Steps:**
1. Checkout the repo
2. Navigate to the plugin directory (`plugins/<plugin-id>/`)
3. `npm ci && npm run build && npm test`
4. Validate the manifest (run the same validation the app does)
5. Create a zip containing: `manifest.json`, `dist/main.js`, `README.md` (and any other declared assets)
6. Compute sha256 of the zip
7. Create a GitHub Release with the zip attached
8. Update `registry/registry.json`:
   - Add or update the plugin entry
   - Set the new version's asset URL, sha256, permissions
   - Update `latest` field
9. Commit and push the registry update

**Separate workflow for registry validation:**
- On PR, validate that `registry.json` is valid JSON matching the schema
- Check that all `asset` URLs are reachable (or will be after merge)
- Check that plugin IDs are unique

---

## 3. Manual plugin release guide

**Path:** `registry/README.md`

For first-party plugins developed in this repo:
```bash
# 1. Update the plugin version in manifest.json and package.json
# 2. Build and test
cd plugins/my-plugin && npm run build && npm test
# 3. Tag the release
git tag my-plugin-v1.0.0
git push origin my-plugin-v1.0.0
# 4. CI handles the rest
```

---

## 4. Community plugin submission process

**Path:** `registry/CONTRIBUTING.md`

**How a third-party author submits their plugin:**

1. Build and publish their plugin to their own GitHub repo with releases
2. Fork this repo
3. Add their plugin entry to `registry/registry.json`
4. Open a PR

**PR review checklist (automated where possible):**
- [ ] Plugin ID is unique and follows naming rules
- [ ] Manifest is valid against current API version
- [ ] Asset URL is reachable and zip contains valid plugin files
- [ ] sha256 matches the downloaded asset
- [ ] Permissions are justified (no `files.external` or `process` without clear reason)
- [ ] README exists in the plugin repo
- [ ] No obvious security concerns

**Automated validation** via a GitHub Actions workflow that runs on PRs touching `registry/registry.json`.

---

## 5. Registry versioning

The `"version": 1` field in registry.json allows schema evolution:
- The app checks the version field before parsing
- If the version is higher than what the app understands, it shows "Please update Clubhouse to browse newer plugins"
- Schema changes bump this version number
- Old app versions continue to work with registries they understand

---

## Definition of Done

1. `registry/registry.json` exists and lists all first-party plugins
2. Tagging a plugin release automatically builds, zips, publishes, and updates the registry
3. Registry validation runs on PRs
4. `registry/CONTRIBUTING.md` explains the community submission process
5. At least one plugin has a working automated release end-to-end
