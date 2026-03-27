---
name: prepare-beta
description: Prepare a beta release for a single Workshop plugin. Gathers commits, classifies changes, proposes version bump, creates a PR, and provides tag instructions. Routes to preview-registry.json via CI.
argument-hint: "<plugin-id>"
---

# Prepare a Plugin Beta Release

This skill prepares a beta release for a single Workshop plugin using a 6-phase flow. The user provides the plugin ID as `$ARGUMENTS`. If omitted, list available plugins and ask.

**Scope:** All work is filtered to `plugins/<plugin-id>/` — only commits touching that directory are considered.

---

## Phase 1: Gather Data

```bash
# Ensure main is up to date
git checkout main && git pull origin main

# Read current version from manifest
cat plugins/<plugin-id>/manifest.json | grep '"version"'

# Find existing tags for this plugin
git tag --list '<plugin-id>-v*' --sort=-v:refname | head -10

# Determine last stable tag (no -beta in name) and last beta tag
LAST_STABLE=$(git tag --list '<plugin-id>-v*' --sort=-v:refname | grep -v '\-beta\.' | head -1)
LAST_BETA=$(git tag --list '<plugin-id>-v*-beta.*' --sort=-v:refname | head -1)

# Collect commits since last tag (stable or beta, whichever is newer)
# Use the newer of the two as the base
git log <last-tag>..HEAD --oneline --no-merges -- plugins/<plugin-id>/
```

If no previous tags exist for this plugin, collect all commits touching `plugins/<plugin-id>/`.

Determine beta increment: if `LAST_BETA` exists and is newer than `LAST_STABLE`, increment its beta number. Otherwise, start at `-beta.1`.

---

## Phase 2: Classify Commits

Classify each commit using **first-match-wins**:

1. **Feature** — `feat:` prefix, or clearly new user-visible functionality
2. **Bug Fix** — `fix:` prefix, or user-visible bug correction
3. **Internal** — `perf:` prefix, optimizations, performance improvements
4. **Non-User** — `chore:`, `ci:`, `test:`, `docs:`, `build:`, `refactor:`

**Skip version bump commits entirely** (`chore: bump version to ...`).

---

## Phase 3: Coalesce

- A Feature absorbs closely related fixes (show final state only)
- Multiple fixes in the same area → one entry
- Keep distinct items separate
- **Drop all Non-User items completely** — they never appear in release notes or PR body
- Internal items appear only as "Improvements" in the PR body (not in the title)

---

## Phase 4: Propose Beta Release

Present to the user:

```
Plugin: <plugin-id>
Current version: <version-in-manifest>
Proposed beta version: <new-version>-beta.<N>

Release title: <brief theme, user-facing>

Release notes:
  Type        | Description
  ------------|------------
  New Feature | ...
  Bug Fix     | ...
  Improvement | ...

Commits included:
  <raw list for transparency>
```

**Version bump rules:**
- Features present → minor bump (e.g. `1.1.0` → `1.2.0-beta.1`)
- Fixes only → patch bump (e.g. `1.1.0` → `1.1.1-beta.1`)
- Never propose a major bump
- If incrementing an existing beta series → keep base version, increment beta number (e.g. `1.2.0-beta.1` → `1.2.0-beta.2`)

Iterate with the user until confirmed. Do not proceed to Phase 5 without explicit approval.

---

## Phase 5: Create Version Bump PR

Once the user approves the proposed release:

1. **Create branch** from main:
   ```bash
   git checkout main && git pull origin main
   git checkout -b release/<plugin-id>-<full-version>
   ```

2. **Update `plugins/<plugin-id>/manifest.json`** — set `version` to the full beta version (e.g. `"1.2.0-beta.1"`). Edit only the `version` field.

3. **Commit:**
   ```bash
   git add plugins/<plugin-id>/manifest.json
   git commit -m "chore(<plugin-id>): bump version to <full-version>"
   ```

4. **Push:**
   ```bash
   git push -u origin release/<plugin-id>-<full-version>
   ```

5. **Open PR** via `gh pr create`:
   - Title: `chore(<plugin-id>): bump version to <full-version> (Preview)`
   - Body **must use this exact format** (load-bearing — CI parses it):

   ```
   Release: <Release Title>

   # New Features
   - <item>

   # Bug Fixes
   - <item>

   # Improvements
   - <item>
   ```

   **Rules for the PR body:**
   - First line must be `Release: <title>` — no prefix, no markdown
   - Only include sections that have content (omit empty sections)
   - Features → `# New Features`, Bug Fixes → `# Bug Fixes`, Internal → `# Improvements`
   - Non-User items: never included
   - No extra markdown, no emoji, no test plan, no co-authored-by footer
   - Internal/Improvements items appear here even though they're not in the title

---

## Phase 6: Provide Tag Instructions

After the PR is merged, provide these commands for the user to run (never run them yourself):

```bash
# Create and push the beta tag (triggers preview pipeline)
git checkout main && git pull origin main
git tag -a <plugin-id>-v<full-version> -m "<Release Title> (Beta)"
git push origin <plugin-id>-v<full-version>
```

**Tag format:** `<plugin-id>-v<version>-beta.<N>` (e.g. `pomodoro-v1.2.0-beta.1`)

The tag triggers `release-plugin.yml` which:
1. Detects `-beta.` in the version → sets channel to `preview`
2. Builds, validates, and zips the plugin
3. Creates a GitHub Release (prerelease)
4. Updates `registry/preview-registry.json` (not `registry.json`)

**To promote to stable later:**
1. Open a new PR: strip `-beta.N` from `manifest.json` version
2. Merge PR
3. Tag with the clean version: `<plugin-id>-v<version>` (no `-beta.N`)
4. That tag routes to `registry/registry.json` as a normal stable release

---

## Critical Rules

1. **Never create tags or push tags yourself** — always give commands to the user
2. **Never propose a major version bump**
3. **Non-User commits** (`chore:`, `ci:`, `docs:`, etc.) never appear in title, notes, or PR body
4. **Internal commits** (`perf:`) appear only as "Improvements" in the PR body, not the title
5. **PR body format is load-bearing** — follow it exactly, no deviations
6. **Skip version bump commits** during classification
7. **Iterate with the user** in Phase 4 before creating the PR
8. **Scope all git log queries** to `-- plugins/<plugin-id>/` to avoid picking up unrelated commits
9. **Full version including `-beta.N`** goes in `manifest.json`
10. **Beta tag pattern** `*-beta.*` is what the CI uses to detect preview channel — do not deviate from tag format
