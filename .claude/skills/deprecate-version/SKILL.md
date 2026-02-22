---
name: deprecate-version
description: Mark an SDK version as deprecated with a removal target date. Use when an older API version should be phased out in favor of a newer one.
argument-hint: "[version-number]"
---

# Deprecate Version

You are deprecating an SDK version to signal that plugins should migrate to a newer version.

## Step 1: List active versions

1. Read `sdk/versions.json`
2. Display all versions with status `active`:

```
Active SDK versions:
  v0.5  — Initial release (latest)
  v0.6  — Added widgets API
```

If a version was provided via `$ARGUMENTS`, use it. Otherwise, ask which version to deprecate.

## Step 2: Validate the choice

- The selected version **cannot** be the `latest` version — a newer version must exist first
- The selected version must have status `active` (not already deprecated or removed)
- If invalid, explain why and suggest creating a new version first with `/create-version-snapshot`

## Step 3: Set a removal target date

Ask the user for a removal target date. Default suggestion: **90 days from today**.

Format: `YYYY-MM-DD`

## Step 4: Scan for affected plugins

Check which plugins currently target this version:

1. Read `plugins/*/manifest.json` — check `engine.api` field
2. Read `registry/registry.json` — check each plugin's release `api` values

Report findings:

```
Plugins targeting v{version}:

In-repo plugins:
  - example-hello-world (manifest.json engine.api: 0.5)
  - code-review (manifest.json engine.api: 0.5)

Registry releases:
  - example-hello-world@0.1.0 (api: 0.5)
  - code-review@0.1.0 (api: 0.5)

These plugins will need to be migrated before the removal date ({date}).
```

Ask for confirmation before proceeding.

## Step 5: Apply deprecation

On confirmation:

### Update `sdk/versions.json`

Set for the target version:
```json
{
  "status": "deprecated",
  "deprecated": "{today's date}",
  "removalTarget": "{removal target date}"
}
```

### Add deprecation header to `index.d.ts`

Prepend to `sdk/v{version}/plugin-types/index.d.ts`:
```ts
/**
 * @deprecated This API version ({version}) is deprecated as of {today's date}.
 * It will be removed on or after {removal target date}.
 * Please migrate to v{latest} using the /migrate-plugin skill.
 */
```

### Add deprecation banner to READMEs

Add a banner at the top of:
- `sdk/v{version}/plugin-types/README.md`
- `sdk/v{version}/plugin-testing/README.md`

```markdown
> **Deprecated**: This SDK version ({version}) is deprecated and will be removed on or after {removal date}. Please migrate to v{latest}. See `/migrate-plugin` for migration assistance.
```

## Step 6: Suggest next steps

```
Version {version} is now deprecated.

Next steps:
  - Run /migrate-plugin for each affected plugin
  - Affected plugins: {list}
  - Removal target: {date}
```

## Important notes

- Deprecation is a soft signal — deprecated versions still work, but CI will warn
- The `minimum` field in versions.json is NOT updated during deprecation — it changes only on removal
- Always leave the version directory intact — files are only deleted by `/delete-version`
