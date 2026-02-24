---
name: migrate-plugin
description: Migrate a plugin from one API version to another, updating manifest, dependencies, and source code for API changes. Use when a plugin needs to target a newer (or different) SDK version.
argument-hint: "[plugin-name]"
---

# Migrate Plugin

You are migrating a plugin from one SDK API version to another. This involves updating metadata, dependencies, and source code to match the target API.

## Step 1: Identify the plugin

If a plugin name was provided via `$ARGUMENTS`, use it. Otherwise, list available plugins and ask:

1. List directories in `plugins/`
2. Show each plugin's current API version from `manifest.json`

```
Available plugins:
  example-hello-world  — v0.6
  code-review          — v0.6
  standup              — v0.6
  pomodoro             — v0.6
```

## Step 2: Determine current and target versions

1. Read the plugin's `manifest.json` to get `engine.api` (current version)
2. Read `sdk/versions.json` to get available versions
3. Ask for the target version (default: `latest` from versions.json)

Validate:
- Target version must exist in versions.json
- Target version must have status `active` (warn if `deprecated`, refuse if `removed`)
- Target version must differ from current

## Step 3: Diff the API versions

1. Read `sdk/v{current}/plugin-types/index.d.ts`
2. Read `sdk/v{target}/plugin-types/index.d.ts`
3. Identify:
   - **New APIs**: Types, methods, or properties added in the target version
   - **Changed APIs**: Modified signatures, renamed fields, changed types
   - **Removed APIs**: Types, methods, or properties that no longer exist

Present a summary:

```
API changes: v{current} → v{target}

New (available to use):
  - api.foo.newMethod(args): ReturnType
  - NewOptionType

Changed (may require code updates):
  - api.bar.method — parameter type changed from X to Y
  - SomeInterface.field — now required (was optional)

Removed (will cause build errors):
  - api.baz.oldMethod — use api.baz.newMethod instead
  - DeprecatedType — replaced by NewType
```

## Step 4: Update plugin metadata

### `manifest.json`

Update the `engine.api` field:
```json
"engine": { "api": {target-version-number} }
```

### `package.json`

Update the `@clubhouse/plugin-types` dependency path:
```json
"@clubhouse/plugin-types": "file:../../sdk/v{target}/plugin-types"
```

If the plugin uses `@clubhouse/plugin-testing`, update that too:
```json
"@clubhouse/plugin-testing": "file:../../sdk/v{target}/plugin-testing"
```

## Step 5: Scan source for breaking changes

Scan the plugin's `src/` directory for usage of changed or removed APIs:

1. For each **removed** API, search for usage patterns in `src/**/*.ts` and `src/**/*.tsx`
2. For each **changed** API, search for usage patterns
3. Report findings with file:line references:

```
Breaking changes found:

src/main.tsx:42 — Uses api.baz.oldMethod() which was removed
  Suggestion: Replace with api.baz.newMethod()

src/main.tsx:78 — Uses SomeInterface with optional field that is now required
  Suggestion: Provide a default value for the field
```

For each breaking change, suggest the fix and offer to apply it automatically.

## Step 6: Apply fixes

For each suggested fix:
1. Show the before/after code
2. Ask if the user wants to apply it
3. Apply on confirmation

If the user wants to apply all fixes at once, do so.

## Step 7: Verify

Run validation:

```bash
cd plugins/{plugin} && npm install && npm run typecheck && npm run build
```

If tests exist:
```bash
npm test
```

Report results:
- If all pass: "Migration complete! Plugin {name} now targets v{target}."
- If failures: Show errors and suggest fixes

## Important notes

- Always diff the actual `index.d.ts` files — don't guess at API changes
- Be thorough when scanning source files — check all `.ts` and `.tsx` files in `src/`
- For non-breaking additions, just mention them as "newly available" — no code changes needed
- Keep the migration minimal — only change what's necessary for the version bump
- If the plugin doesn't use any changed or removed APIs, the migration is just metadata updates
