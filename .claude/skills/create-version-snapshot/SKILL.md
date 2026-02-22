---
name: create-version-snapshot
description: Generate a new API version by crawling the Clubhouse app source, diffing against the previous version, and creating a self-contained SDK snapshot. Use when the Clubhouse API has changed and a new SDK version is needed.
argument-hint: "[version-number]"
---

# Create Version Snapshot

You are creating a new SDK version snapshot. This involves parsing the Clubhouse app's source types, diffing against the previous version, and generating a complete new SDK version directory.

## Step 1: Determine the target version

If a version number was provided via `$ARGUMENTS`, validate it. Otherwise, ask the user.

1. Read `sdk/versions.json` to find the current `latest` version
2. Validate the target version is greater than the current latest (use semver-style comparison on the version strings, e.g. "0.6" > "0.5")
3. If invalid, explain and ask again

## Step 2: Locate the Clubhouse source

Ask the user for the path to the Clubhouse application source code, or reuse a previously provided path. The source of truth is:

```
<source-path>/src/shared/plugin-types.ts
```

Verify this file exists before proceeding. If it doesn't, ask for correction.

## Step 3: Parse and diff

1. Read the source `plugin-types.ts` from the Clubhouse app
2. Read the previous version's `sdk/v{prev}/plugin-types/index.d.ts`
3. Compare the two and identify:
   - **Added**: New types, interfaces, methods, or properties
   - **Changed**: Modified signatures, added optional fields, changed types
   - **Removed**: Deleted types, interfaces, methods, or properties
4. Present a summary to the user in a clear table format:

```
API Changes: v{prev} → v{new}

Added:
  - api.foo.newMethod(args): ReturnType
  - NewInterface

Changed:
  - api.bar.existingMethod — added optional `options` parameter
  - ExistingType — field `x` changed from string to number

Removed:
  - api.baz.deprecatedMethod
  - OldInterface
```

5. Ask for confirmation before generating files

## Step 4: Generate the new SDK version

On confirmation:

### `sdk/v{new}/plugin-types/`

1. **`index.d.ts`** — The new type definitions, derived from the Clubhouse source. Add a header comment:
   ```ts
   /**
    * Clubhouse Plugin API — v{new}
    *
    * Type definitions for the Clubhouse plugin SDK.
    * Generated from the Clubhouse application source.
    *
    * @version {new}
    * @see https://github.com/Agent-Clubhouse/Clubhouse-Workshop
    */
   ```

2. **`package.json`** — Based on the previous version, with updated version number:
   ```json
   {
     "name": "@clubhouse/plugin-types",
     "version": "{new}.0",
     "description": "TypeScript type definitions for the Clubhouse plugin API",
     "license": "MIT",
     "types": "./index.d.ts",
     "files": ["index.d.ts"],
     "keywords": ["clubhouse", "plugin", "types", "typescript"],
     "repository": {
       "type": "git",
       "url": "https://github.com/Agent-Clubhouse/Clubhouse-Workshop",
       "directory": "sdk/v{new}/plugin-types"
     }
   }
   ```

3. **`CHANGELOG.md`** — Document the changes from the previous version:
   ```markdown
   # Changelog — @clubhouse/plugin-types v{new}

   ## v{new}.0 (YYYY-MM-DD)

   ### Added
   - ...

   ### Changed
   - ...

   ### Removed
   - ...

   ### Migration from v{prev}
   - ...
   ```

4. **`README.md`** — Standard readme with version-specific notes

### `sdk/v{new}/plugin-testing/`

1. Copy `sdk/v{prev}/plugin-testing/` as a base
2. Update `package.json`:
   - Version to `{new}.0`
   - Dependency on `@clubhouse/plugin-types` to `file:../plugin-types`
   - Repository directory to `sdk/v{new}/plugin-testing`
3. Update mock implementations in `src/mock-api.ts` to match any new/changed APIs:
   - Add mock implementations for new methods
   - Update changed method signatures
   - Remove mocks for deleted methods
4. Update `src/mock-context.ts` if context shape changed
5. Update `src/test-harness.ts` if needed

## Step 5: Update versions.json

```json
{
  "latest": "{new}",
  "minimum": "{current-minimum}",
  "versions": {
    "{prev}": { ... },
    "{new}": {
      "status": "active",
      "released": "{today's date}",
      "deprecated": null,
      "removalTarget": null,
      "sdkPath": "sdk/v{new}",
      "notes": "Description of what changed."
    }
  }
}
```

## Step 6: Verify

Suggest running these commands to verify:

```bash
cd sdk/v{new}/plugin-testing && npm install && npm run typecheck
```

And for each plugin targeting the new version:
```bash
cd plugins/<plugin> && npm install && npm run typecheck && npm run build
```

## Important notes

- Each version directory must be fully self-contained
- `plugin-testing` always references `../plugin-types` within its own version
- Never modify the previous version's files — they are frozen snapshots
- The `notes` field in versions.json should concisely describe what changed
