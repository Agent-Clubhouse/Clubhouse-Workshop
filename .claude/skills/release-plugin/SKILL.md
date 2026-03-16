---
name: release-plugin
description: Guide the user through releasing one or more plugins by tagging, pushing, and verifying the CI release pipeline. Use when someone wants to release, publish, or tag a plugin version.
argument-hint: "[plugin-name...] or blank to choose interactively"
---

# Release a Plugin

Help the user release one or more plugins through the tag-based release pipeline. This skill handles tagging, pushing, verifying CI, and troubleshooting failures.

## How the release pipeline works

The `release-plugin.yml` workflow triggers on tag pushes matching `*-v*` (e.g., `wiki-v1.2.1`). It:

1. Checks out the tag
2. Builds and tests the plugin
3. Validates the manifest and version match
4. Creates a GitHub Release with a zip artifact
5. Checks out `origin/main`, updates `registry/registry.json` on top of the latest state
6. Creates and auto-merges a registry PR

**Tag format:** `{plugin-id}-v{version}` (hyphen before `v`, NOT a slash)
- Correct: `wiki-v1.2.1`, `automations-v1.0.0`
- Wrong: `wiki/v1.2.1`, `wiki-1.2.1`

## Step 1: Identify what to release

If plugin names were provided via `$ARGUMENTS`, use those. Otherwise:

1. List plugins in `plugins/` with their manifest version
2. Ask which plugin(s) to release
3. For each, confirm the version in `manifest.json` is correct and has been updated

Read each plugin's `manifest.json` to get the `id` and `version` fields. Verify the version looks intentional (e.g., was bumped from the previous release).

Check existing tags to make sure the tag doesn't already exist:
```bash
git tag -l '{plugin-id}-v*'
```

## Step 2: Ensure main is up to date

The tags must be created on a commit that is on `main` and that contains the version bump. Confirm:

```bash
git checkout main
git pull origin main
```

## Step 3: Tag and push ONE AT A TIME

**IMPORTANT: Release one plugin at a time.** Do not push multiple tags simultaneously.

The release workflow uses a concurrency group (`registry-update`) that serializes registry updates. When multiple tags are pushed at once:
- Only the first tag starts running
- One additional tag may queue as "pending"
- All remaining tags are **silently dropped** by GitHub Actions

For each plugin, provide the commands and wait for the user to confirm before moving to the next:

```
Releasing {plugin-name} v{version}...

Run this command:

  git tag -a {plugin-id}-v{version} -m "{plugin-id} v{version}" && git push origin {plugin-id}-v{version}

Then verify the workflow triggered:

  gh run list --workflow=release-plugin.yml --limit 1
```

Wait for the user to confirm that run succeeded (or at least triggered) before providing the next tag command. If releasing multiple plugins, number them clearly:

```
Release 1 of 5: wiki v1.2.1
Release 2 of 5: automations v1.2.1
...
```

## Step 4: Verify each release

After each tag push, help the user verify:

```bash
# Check workflow status
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

### Workflow didn't trigger
- Verify the tag is on the remote: `git ls-remote --tags origin | grep {plugin-id}`
- Verify tag format matches `*-v*` pattern
- If the tag was pushed in a batch, it may have been dropped by the concurrency group. Re-trigger with: `gh workflow run "Release Plugin" -f tag={plugin-id}-v{version}`

### "Your local changes would be overwritten by checkout"
This is the registry race condition. The workflow checks out `origin/main` to apply the registry update. If the working tree is dirty (from a prior step or concurrent run), the checkout fails. The fix (PR #138) ensures the registry update runs after checking out main. If running on an old tag that predates the fix, use `workflow_dispatch` to re-trigger (it uses the workflow from main):
```bash
gh workflow run "Release Plugin" -f tag={plugin-id}-v{version}
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

### Multiple releases were dropped
If you pushed N tags but only 1-2 triggered, re-trigger the rest via `workflow_dispatch`:
```bash
gh workflow run "Release Plugin" -f tag={plugin-id}-v{version}
```
This uses the workflow file from main (not the tag commit), so it always picks up the latest fixes.

## Step 5: Confirm completion

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
cat registry/registry.json | grep -A2 '"latest"'
```
