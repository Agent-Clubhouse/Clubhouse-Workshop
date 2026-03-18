---
name: release-plugin
description: Guide the user through releasing one or more plugins by tagging, pushing, and verifying the CI release pipeline. Use when someone wants to release, publish, or tag a plugin version.
argument-hint: "[plugin-name...] or blank to choose interactively"
---

# Release a Plugin

Help the user release one or more plugins through the release pipeline. This skill handles tagging, pushing, verifying CI, and troubleshooting failures.

## Release Options

There are two ways to release plugins:

### Option A: Batch Release (recommended for multiple plugins)

Use the **Release Batch** workflow to release multiple plugins in a single run. This is the preferred method for releasing 2+ plugins (e.g., theme packs).

```bash
# Auto-detect all plugins with version bumps
gh workflow run "Release Batch" -f plugins=auto

# Release specific plugins
gh workflow run "Release Batch" -f plugins=fall-themes,spring-themes,summer-themes

# Dry run — build and validate without publishing
gh workflow run "Release Batch" -f plugins=auto -f dry_run=true
```

The batch workflow:
1. Detects plugins to release (auto or explicit list)
2. Validates no duplicate tags exist
3. Builds each plugin serially via `scripts/release-plugin.mjs`
4. Creates git tags and GitHub Releases for each
5. Updates the registry in a single PR via `scripts/update-registry.mjs`
6. Prints a summary table

### Option B: Single Tag Push (for individual releases)

The `release-plugin.yml` workflow triggers on tag pushes matching `*-v*` (e.g., `wiki-v1.2.1`). It uses the same shared scripts as the batch workflow.

**Tag format:** `{plugin-id}-v{version}` (hyphen before `v`, NOT a slash)
- Correct: `wiki-v1.2.1`, `automations-v1.0.0`
- Wrong: `wiki/v1.2.1`, `wiki-1.2.1`

## Step 1: Identify what to release

If plugin names were provided via `$ARGUMENTS`, use those. Otherwise:

1. List plugins in `plugins/` with their manifest version
2. Ask which plugin(s) to release
3. For each, confirm the version in `manifest.json` is correct and has been updated

To auto-detect releasable plugins:
```bash
node scripts/detect-releasable.mjs
```

Check existing tags to make sure the tag doesn't already exist:
```bash
git tag -l '{plugin-id}-v*'
```

## Step 2: Choose release method

**For multiple plugins (2+):** Recommend the batch workflow.

```bash
# Dry run first to validate
gh workflow run "Release Batch" -f plugins=fall-themes,spring-themes -f dry_run=true

# Then release for real
gh workflow run "Release Batch" -f plugins=fall-themes,spring-themes
```

**For a single plugin:** Either method works. For a single tag push:

```bash
git checkout main
git pull origin main
git tag -a {plugin-id}-v{version} -m "{plugin-id} v{version}"
git push origin {plugin-id}-v{version}
```

## Step 3: Verify releases

```bash
# Check batch workflow status
gh run list --workflow="Release Batch" --limit 1

# Check single release workflow status
gh run list --workflow=release-plugin.yml --limit 1

# Watch a specific run
gh run watch {run-id}

# View logs if it failed
gh run view {run-id} --log-failed
```

Confirm these artifacts were created:
- GitHub Release exists with the zip file
- Registry PR was created and auto-merged

## Troubleshooting

### Workflow didn't trigger (single tag push)
- Verify the tag is on the remote: `git ls-remote --tags origin | grep {plugin-id}`
- Verify tag format matches `*-v*` pattern
- If the tag was pushed by the batch workflow (as `github-actions[bot]`), the single workflow intentionally skips it to prevent double-trigger

### Batch workflow partial failure
The batch workflow continues past failed plugins and reports failures in the summary. To retry just the failed plugins:
```bash
gh workflow run "Release Batch" -f plugins=failed-plugin-1,failed-plugin-2
```

### "manifest.json version does not match tag version"
The version in `manifest.json` must exactly match the tag. Check:
```bash
cat plugins/{plugin-id}/manifest.json | grep '"version"'
```
If it doesn't match, update the manifest, commit, push to main, delete the bad tag, and re-tag.

### Tag already exists
If a tag already exists locally or on remote:
```bash
# Delete local and remote, then re-create
git tag -d {plugin-id}-v{version}
git push origin :refs/tags/{plugin-id}-v{version}
git tag -a {plugin-id}-v{version} -m "{plugin-id} v{version}"
git push origin {plugin-id}-v{version}
```

### Re-trigger via workflow_dispatch
For any failed single release, re-trigger without needing to recreate the tag:
```bash
gh workflow run "Release Plugin" -f tag={plugin-id}-v{version}
```

## Step 4: Confirm completion

Once all releases are done, summarize:

```
Releases complete:

  wiki v1.2.1        - Released
  automations v1.2.1 - Released
  ...

Registry updated with all new versions.
```

Remind the user to verify the registry looks correct:
```bash
node scripts/validate-registry.mjs
```
