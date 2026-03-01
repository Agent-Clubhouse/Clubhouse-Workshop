# Contributing a Plugin to the Registry

Want your plugin listed in the Clubhouse plugin browser? Here's how.

## Prerequisites

- Your plugin is published in a public GitHub repository
- It has a valid `manifest.json` targeting a supported API version (see `sdk/versions.json`)
- It has a built `dist/main.js` (or a GitHub Release with a zip artifact)
- It has a `README.md` explaining what it does and how to use it
- All permissions in your manifest are from the valid set in `sdk/permissions.json`

## Steps

### 1. Create a release

In your plugin's repository, create a GitHub Release with a zip file containing:

```
your-plugin-v1.0.0.zip
  ├── manifest.json
  ├── dist/main.js
  └── README.md
```

Note the release asset URL and compute the sha256 hash:

```bash
sha256sum your-plugin-v1.0.0.zip    # Linux
shasum -a 256 your-plugin-v1.0.0.zip # macOS
```

### 2. Fork this repo

Fork [Clubhouse-Workshop](https://github.com/Agent-Clubhouse/Clubhouse-Workshop) and clone your fork.

### 3. Validate locally (optional but recommended)

```bash
# Validate your manifest before submitting
node scripts/validate-manifest.mjs /path/to/your-plugin

# After editing registry.json, validate it too
node scripts/validate-registry.mjs
```

### 4. Add your plugin to the registry

Edit `registry/registry.json` and add your plugin entry to the `plugins` array:

```json
{
  "id": "your-plugin",
  "name": "Your Plugin",
  "description": "What your plugin does in one sentence.",
  "author": "Your Name",
  "repo": "https://github.com/yourname/your-plugin",
  "tags": ["relevant", "keywords"],
  "latest": "1.0.0",
  "releases": {
    "1.0.0": {
      "api": 0.5,
      "asset": "https://github.com/yourname/your-plugin/releases/download/v1.0.0/your-plugin-v1.0.0.zip",
      "sha256": "your-sha256-hash-here",
      "permissions": ["logging", "storage"],
      "size": 12345
    }
  }
}
```

### 5. Open a pull request

Push to your fork and open a PR against this repo's `main` branch.

## Review checklist

Automated CI checks (`validate-pr.yml`) will verify:

- [ ] `registry.json` is valid JSON matching the schema
- [ ] Plugin ID is unique and follows naming rules (lowercase, alphanumeric, hyphens)
- [ ] All permissions are valid (checked against `sdk/permissions.json`)
- [ ] API version is supported (checked against `sdk/versions.json`)
- [ ] Asset URL is reachable
- [ ] Sensitive permissions are flagged for review

Human reviewers will also check:

- [ ] Plugin has a clear purpose described in the README
- [ ] Sensitive permissions are justified (`files.external`, `process`, `terminal`)
- [ ] No obvious security concerns in the source code
- [ ] Plugin builds and runs correctly

## Plugin ID rules

- Lowercase letters, numbers, and hyphens only: `my-cool-plugin`
- Must not conflict with existing plugins in the registry
- Must not use the `example-` prefix (reserved for official Workshop examples)
- Should be descriptive but concise

## Updating your plugin

To release a new version:

1. Create a new GitHub Release in your repo
2. Edit `registry/registry.json`:
   - Add the new version to `releases`
   - Update `latest` to the new version
3. Open a PR

## Removing your plugin

Open a PR removing your plugin entry from `registry.json`. We'll process removals promptly.

## Questions?

Open an issue on this repository.
