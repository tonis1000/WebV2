# Discovery Beta Entrypoint Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy `Discovery Beta` UI from the production entry graph while preserving the discovery provider modules and unique legacy capabilities for later migration decisions.

**Architecture:** Keep Unified Search as the only production automatic discovery surface. Stop importing `src/discovery/discovery-ui.js` from `src/registry-default.js`, but do not delete `src/discovery/*` provider, preview, promotion, local-scan, verifier, or state modules in this slice. Add a static ownership contract that fails if the legacy UI is wired back into production or if Unified Search loses its required shared discovery adapters.

**Tech Stack:** Browser ES modules, Node.js contract tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-01-webv2-system-audit-ux-consolidation-design.md`

## Global Constraints

- D1-primary My Playlist remains unchanged.
- D1-authoritative Favorites remains unchanged.
- Saved Playlist D1 truth + IndexedDB reconciliation remains unchanged.
- Non-blocking startup remains unchanged.
- Channel Identity and EPG ownership remain unchanged.
- Source Format Registry plus shared M3U / STRM / Enigma2 cores remain unchanged.
- Unified Search remains the single automatic discovery surface.
- Search / Now Playing independence remains unchanged.
- Explicit Play remains the only Search action that changes Player state.
- Source Verifier semantics remain unchanged.
- Player and Xtream behavior remain unchanged.
- No Discovery provider implementation is deleted in this slice.
- `New Xtream Account` preview/promotion, legacy Official discovery, and local-source scan code remain available for the next audit decision.
- DONE still means implemented + deployed + live verified.

## Review Focus

1. Production bootstrap must not import `src/discovery/discovery-ui.js`, directly or by an alias introduced in the edited entry module.
2. Unified Search must still register Curated, GitHub, Recent Web, STRM, Authorized Xtream, and Hunt exploration lanes.
3. The Unified Search discovery adapter must continue to consume the shared discovery provider modules rather than cloning their logic.
4. Direct legacy capability tests for new Xtream preview, Discovery promotion, local-source collection, and Discovery browser smoke must continue to pass after the UI entrypoint is removed.
5. The cleanup must not touch Player, Verifier, D1 write APIs, playlist ownership, Favorites, or Xtream secret-storage behavior.

---

## File Structure

- Create: `tests/discovery-entrypoint-ownership.test.mjs`
  - Static ownership contract for production entry wiring and shared Unified Search provider wiring.
- Modify: `src/registry-default.js`
  - Remove only the production import of `src/discovery/discovery-ui.js` and update its stale comment.
- Modify: `.github/workflows/validate-unified-search.yml`
  - Run the new ownership contract and trigger when `src/registry-default.js` or the new test changes.
- Modify: `.github/workflows/validate-frontend.yml`
  - Run the new ownership contract alongside existing legacy capability regressions.
- Do not modify in this slice: `src/discovery/discovery-ui.js`, `src/discovery/new-xtream-preview.js`, `src/discovery/promotion.js`, `src/discovery/local-data-reader.js`, `src/discovery/local-candidates.js`, Player, Verifier, Workers, D1 schemas, or final layout files.

### Task 1: Add the ownership regression contract

**Files:**
- Create: `tests/discovery-entrypoint-ownership.test.mjs`
- Read: `src/registry-default.js`
- Read: `src/search/search-runtime.js`
- Read: `src/search/adapters/discovery-provider-adapter.js`

**Interfaces:**
- Consumes: repository source text only.
- Produces: a Node test that exits non-zero when production rewires the legacy Discovery UI or Unified Search loses shared discovery ownership.

- [ ] **Step 1: Write the failing test**

Create `tests/discovery-entrypoint-ownership.test.mjs` with assertions that:

```js
assert.doesNotMatch(registryDefault, /discovery\/discovery-ui\.js/);
assert.match(searchRuntime, /curated-remote-feeds/);
assert.match(searchRuntime, /github-public-playlists/);
assert.match(searchRuntime, /recent-web-search/);
assert.match(searchRuntime, /strm-specific-discovery/);
assert.match(searchRuntime, /authorized-xtream/);
assert.match(searchRuntime, /hunt-exploration/);
assert.match(discoveryAdapter, /external-discovery-client\.js/);
assert.match(discoveryAdapter, /authorized-xtream\.js/);
assert.match(discoveryAdapter, /BLOCKED_PROVIDER=\/official\/i/);
```

The test must read files relative to the repo root and print one concise PASS line on success.

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
node tests/discovery-entrypoint-ownership.test.mjs
```

Expected: FAIL because `src/registry-default.js` still imports `./discovery/discovery-ui.js`.

- [ ] **Step 3: Commit the RED contract**

```bash
git add tests/discovery-entrypoint-ownership.test.mjs
git commit -m "test: pin Discovery UI ownership boundary"
```

### Task 2: Remove only the legacy production UI entrypoint

**Files:**
- Modify: `src/registry-default.js`
- Test: `tests/discovery-entrypoint-ownership.test.mjs`

**Interfaces:**
- Consumes: existing `registry-default.js` bootstrap behavior.
- Produces: the same bootstrap minus the `discovery-ui.js` import; Xtream/source-management imports and sidebar recovery remain byte-for-byte functionally equivalent.

- [ ] **Step 1: Remove the legacy UI import**

In `src/registry-default.js`, delete only:

```js
import './discovery/discovery-ui.js?...';
```

Do not remove or reorder the Xtream UI, Xtream preview actions, Xtream enhancements, source-order controls, or route-tooltip imports unless formatting requires it.

- [ ] **Step 2: Correct the stale bootstrap comment**

Replace the comment that says Discovery is loaded from `registry-default.js` with wording that states this module loads Xtream/source-management UIs and startup recovery, while automatic discovery is owned by Unified Search.

- [ ] **Step 3: Run the ownership test to verify GREEN**

Run:

```bash
node tests/discovery-entrypoint-ownership.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Run syntax checks for the touched runtime**

Run:

```bash
node --check src/registry-default.js
node --check src/search/search-runtime.js
node --check src/search/adapters/discovery-provider-adapter.js
```

Expected: all exit 0.

- [ ] **Step 5: Commit the bounded runtime change**

```bash
git add src/registry-default.js
git commit -m "cleanup: remove legacy Discovery Beta entrypoint"
```

### Task 3: Wire the ownership contract into CI

**Files:**
- Modify: `.github/workflows/validate-unified-search.yml`
- Modify: `.github/workflows/validate-frontend.yml`
- Test: `tests/discovery-entrypoint-ownership.test.mjs`

**Interfaces:**
- Consumes: the ownership test from Task 1.
- Produces: CI coverage on PRs and main pushes that can affect the production discovery ownership boundary.

- [ ] **Step 1: Extend Unified Search path triggers**

Add these paths to both `push.paths` and `pull_request.paths` in `.github/workflows/validate-unified-search.yml`:

```yaml
- 'src/registry-default.js'
- 'tests/discovery-entrypoint-ownership.test.mjs'
```

- [ ] **Step 2: Run the ownership contract in Unified Search validation**

In the `Run Unified Search contracts` step, add:

```bash
node tests/discovery-entrypoint-ownership.test.mjs
```

Place it near the page-wiring/UI ownership tests.

- [ ] **Step 3: Run the ownership contract in frontend validation**

Add a named step to `.github/workflows/validate-frontend.yml`:

```yaml
- name: Run Discovery entrypoint ownership contract
  run: node tests/discovery-entrypoint-ownership.test.mjs
```

Keep the existing `new-xtream-preview`, `discovery-promotion`, `discovery-local-sources`, `discovery-isolation`, and `discovery-browser-smoke` tests unchanged. Those tests are intentional evidence that unique legacy capabilities still exist after the production UI is unwired.

- [ ] **Step 4: Run the focused CI-equivalent tests locally**

Run:

```bash
node tests/discovery-entrypoint-ownership.test.mjs
node tests/search-runtime.test.mjs
node tests/search-provider-adapters.test.mjs
node tests/unified-search-page-wiring.test.mjs
node tests/new-xtream-preview.test.mjs
node tests/discovery-promotion.test.mjs
node tests/discovery-local-sources.test.mjs
node tests/discovery-isolation.test.mjs
node tests/discovery-browser-smoke.mjs
```

Expected: all PASS.

- [ ] **Step 5: Run syntax checks for both workflow-edited code dependencies**

Run:

```bash
node --check src/registry-default.js
node --check src/search/search-runtime.js
node --check src/search/adapters/discovery-provider-adapter.js
node --check src/discovery/discovery-ui.js
```

Expected: all exit 0.

- [ ] **Step 6: Commit CI wiring**

```bash
git add .github/workflows/validate-unified-search.yml .github/workflows/validate-frontend.yml
git commit -m "ci: guard Unified Search discovery ownership"
```

### Task 4: Branch verification before PR

**Files:**
- No new runtime files.
- Verify all files changed in Tasks 1-3.

**Interfaces:**
- Consumes: completed branch.
- Produces: evidence that the bounded cleanup did not damage protected behavior.

- [ ] **Step 1: Run the complete Unified Search contract set**

Execute the same commands in `.github/workflows/validate-unified-search.yml` for syntax, Unified Search contracts, and curated parser regressions.

Expected: all PASS.

- [ ] **Step 2: Run the complete frontend validation set**

Execute `.github/workflows/validate-frontend.yml` locally where practical. If the browser smoke requires installed Chrome, run it with the same `CHROME_BIN` behavior as CI and record the result.

Expected: all PASS.

- [ ] **Step 3: Inspect the branch diff**

Confirm the diff contains only:

- the new ownership test;
- removal of the single legacy Discovery UI import and comment correction;
- CI wiring.

There must be no edits to Player, Verifier, D1 APIs, Xtream bridge code, Discovery provider implementations, Playlist/Favorites semantics, or layout.

- [ ] **Step 4: Commit any plan-required test-only corrections**

If no corrections are needed, do not create an empty commit.

### Task 5: Deploy and live acceptance

**Files:**
- Runtime behavior only; no extra code is required unless live evidence exposes a defect.

**Interfaces:**
- Consumes: merged exact SHA with passing CI.
- Produces: production evidence for this slice.

- [ ] **Step 1: Verify exact-SHA CI after merge**

Required successful checks for the merged SHA:

- `Validate WebTV Frontend`
- `Validate Unified Search`
- relevant GitHub Pages deployment/build check for the frontend

Do not infer production from a newer main commit if the deployed SHA differs.

- [ ] **Step 2: Compare deployment state**

Attempt the standard preflight read of:

- `/api/project-status`
- `/api/project-checkpoints`
- GitHub main SHA
- deployed frontend SHA/evidence

If Registry endpoint bodies are still unavailable, record that limitation explicitly and do not claim checkpoint equality.

- [ ] **Step 3: Live desktop verification**

On the production WebV2 page, verify:

```text
Discovery Beta control: ABSENT
Unified Search: PRESENT
Manual Test: PRESENT when its existing admin/selection conditions are met
Playlists: unchanged
Favorites: unchanged
Diagnostics: unchanged
```

- [ ] **Step 4: Run one real Unified Search acceptance scenario**

Use one known channel query and confirm:

- the search starts and completes;
- lane/report state appears;
- at least the expected shared lanes are attempted according to current availability;
- Search does not change Now Playing by itself;
- explicit `Play` remains the action that changes playback.

- [ ] **Step 5: Live admin regression spot-check**

Confirm opening Playlist Manager still exposes the existing Xtream management surface. Do not migrate or redesign it in this slice.

- [ ] **Step 6: Record project state only after verified success**

Update the correct Project Brain/CURRENT owner only after implementation, deployment, and live verification all succeed. Mark this slice DONE only then.

## Explicit next task after this plan

Do not immediately delete `src/discovery/discovery-ui.js` after Stage A. The next discussion/audit is:

**Compare the remaining unique Discovery-only capabilities against existing owners:**

- New Xtream preview and explicit preview promotion vs Playlist Manager/Xtream management;
- local-source scan vs Unified Search, Diagnostics, Source Health, and Playlist Manager;
- legacy Official discovery policy;
- any remaining promotion-only behavior.

Only after that capability-by-capability review may legacy modules be moved or removed.
