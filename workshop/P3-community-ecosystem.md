# P3 — Community Ecosystem

> Scale the registry beyond first-party. Establish quality expectations. Make the Workshop a place people come to find plugins.

**Depends on:** Workshop P2 (registry and releases), Clubhouse P2 (browse and install in-app)

This is less prescriptive than earlier milestones. The right moves depend on what we learn.

---

## 1. Community plugins in the registry

Once the submission process (P2) is proven with first-party plugins, open it to community submissions.

**Labeling:**
- `official: true` — built and maintained by Clubhouse Workshop
- `official` omitted or `false` — community-submitted, listed in the registry after review

The distinction is visible in the app's Workshop browser (Clubhouse P3 — trust indicators).

---

## 2. Plugin quality guidelines

**Path:** `docs/quality-guidelines.md`

Not a gate — a set of recommendations:

- **Permission minimality** — request only what you need. Don't ask for `terminal` if you don't spawn shells.
- **Error handling** — don't let unhandled exceptions crash the app. Use try/catch around API calls that can fail.
- **Cleanup** — push everything to `ctx.subscriptions` so it's disposed on deactivation. Don't leak event listeners.
- **Storage hygiene** — use `projectLocal` for ephemeral data, `project` for shared data, `global` for user preferences. Don't store large blobs in key-value storage.
- **Accessibility** — use semantic HTML and Clubhouse's existing CSS classes for consistent styling.
- **Performance** — avoid polling when events are available. Don't run expensive operations in `activate()`.
- **Testing** — include unit tests. Use `@clubhouse/plugin-testing` for API mocks.
- **Documentation** — include `contributes.help` topics. Write a README.

---

## 3. Automated review tooling

**Path:** `.github/workflows/review-submission.yml`

When a PR adds or updates a community plugin in the registry:

1. **Download and unpack the asset** — verify it's a valid zip with manifest + main.js
2. **Validate manifest** — same validation the app runs
3. **Static analysis** — scan the built JS for:
   - Network calls to unexpected domains (fetch, XMLHttpRequest, WebSocket to non-localhost)
   - Filesystem access outside expected paths
   - eval() or Function() usage
   - Obvious credential harvesting patterns
4. **Permission audit** — flag if permissions seem excessive for the described functionality
5. **Build verification** — if the plugin repo is public, clone and build from source, verify the output matches the published asset (reproducible builds)

This doesn't replace human review but reduces the manual burden.

---

## 4. Plugin showcase / featured plugins

**Path:** `registry/featured.json` or a `featured` field in registry entries

Curate a "Featured" section in the registry:
- Plugins that demonstrate best practices
- Plugins that are particularly useful or creative
- Rotated periodically to give visibility to new entries

The app's Workshop browser shows featured plugins prominently.

---

## Definition of Done

1. At least one community-submitted plugin is listed in the registry
2. Quality guidelines document exists
3. Automated review workflow runs on community submissions
4. Featured plugins mechanism exists (even if just a field in the registry)
