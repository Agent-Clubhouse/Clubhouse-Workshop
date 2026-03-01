---
name: delete-version
description: Remove a deprecated SDK version's files from the repository. Use when a deprecated version has passed its removal target date and should be cleaned up.
argument-hint: "[version-number]"
---

# Delete Version

You are removing a deprecated SDK version's files from the repository. This is a destructive operation — proceed carefully.

## Step 1: List deprecated versions

1. Read `sdk/versions.json`
2. Display versions with status `deprecated`:

```
Deprecated SDK versions:
  v0.6  — Deprecated 2026-06-01, removal target 2026-09-01
```

If no versions are deprecated, inform the user and suggest `/deprecate-version` first.

If a version was provided via `$ARGUMENTS`, use it. Otherwise, ask which version to delete.

## Step 2: Validate the choice

- The selected version **must** have status `deprecated` (refuse if `active`)
- If the version is still before its `removalTarget` date, warn the user but allow if they confirm
- The selected version cannot be the `latest` or `minimum` version in versions.json

## Step 3: Scan for affected plugins

Check for plugins still targeting this version:

1. Read `plugins/*/manifest.json` — check `engine.api` field
2. Read `registry/registry.json` — check release `api` values

If any plugins still target this version:

```
WARNING: The following plugins still target v{version}:

In-repo plugins:
  - example-hello-world (engine.api: {version})

Registry releases:
  - example-hello-world@0.1.0 (api: {version})

Deleting this version will break these plugins' file: paths.
```

**Require explicit confirmation** — the user must type "yes" or confirm clearly.

Suggest running `/migrate-plugin` first for each affected plugin.

## Step 4: Delete the version

On explicit confirmation:

### Delete the SDK directory

Remove the entire `sdk/v{version}/` directory.

### Update `sdk/versions.json`

```json
{
  "{version}": {
    "status": "removed",
    "sdkPath": null,
    "notes": "Removed on {today's date}. {original notes}"
  }
}
```

Keep all other fields (`released`, `deprecated`, `removalTarget`) for historical record.

### Update `minimum` if needed

If the deleted version was the `minimum`:
- Set `minimum` to the next lowest `active` or `deprecated` version
- If no other versions remain, this is an error — refuse the deletion

## Step 5: Report results

```
Version {version} has been removed.

Updated sdk/versions.json:
  - Status: removed
  - sdkPath: null
  - Minimum version: {new minimum or unchanged}
```

If any plugins had broken paths:
```
WARNING: These plugins now have broken file: paths:
  - {list}

Run /migrate-plugin to fix them.
```

## Important notes

- This is irreversible — the version directory is permanently deleted
- Historical metadata remains in versions.json for audit purposes
- Always check for affected plugins before deleting
- If in doubt, suggest keeping the deprecated version until all plugins have migrated
