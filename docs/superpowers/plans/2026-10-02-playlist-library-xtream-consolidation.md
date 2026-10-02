# Playlist / Library / Xtream Management Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicate legacy Xtream save/merge paths, move Saved Xtream Library card ownership into Playlist Manager, and keep one canonical load/save architecture.

**Architecture:** `xtream-ui.js` gets one shared account loader exposed as `WebTVXtream.loadAccountById(accountId)`. `playlist-manager.js` renders account-backed Xtream Saved Playlist cards directly from typed data and delegates `Load live` to that API. Then `xtream-enhancements.js` is retired and deleted after no-consumer proof.

**Tech Stack:** Browser ES modules, DOM APIs, Cloudflare Registry/D1 conventions, IndexedDB cache, Node assertion tests, GitHub Actions, Playwright/browser verification.

**Spec:** `docs/superpowers/specs/2026-10-02-playlist-library-xtream-consolidation-design.md`

## Global Constraints

- My Playlist remains D1-primary.
- Saved Playlist D1 truth + IndexedDB reconciliation remain unchanged.
- Custom Saved Playlist D1 truth/source ownership remain unchanged.
- Preview persists nothing until explicit verified save.
- Full Xtream Account save remains account-backed, never flattened into D1 channel rows.
- Full account persistence only through Preview → Verify → Save Full Xtream Account.
- Channel persistence only through canonical Save Channel… destination flow.
- No credentials/preview tokens in Library markers or DOM.
- No new Registry writer or duplicate IndexedDB writer.
- No Unified Search/Hunt/save-time discovery.
- Existing `xtream:<accountId>` markers remain compatible without migration.

## Review Focus

1. Missing saved account: Load live fails clearly without deleting/re-writing the Library row.
2. Malformed `xtream:` marker: never apply the synthetic marker M3U as a real playlist.
3. Normal URL/paste/custom Saved Playlists keep current Load/Export behavior.
4. Selector loading and Library loading share one account-load implementation.
5. Removing `xtream-enhancements.js` must preserve useful card behavior and not recreate duplicate persistence elsewhere.

---

### Task 1: One Xtream account load path

**Files:**
- Modify: `src/xtream-ui.js`
- Create: `tests/xtream-account-load-ownership.test.mjs`

**Interfaces:**
- Consumes: `loadXtreamChannels(accountId)`, `xtreamChannelsToM3U`, `WebTVPlaylistAPI.applyText`.
- Produces: `loadAccountById(accountId)` and `window.WebTVXtream.loadAccountById(accountId)`; `loadSelectedAccount()` delegates to it.

- [ ] **Step 1: Write RED test**
Assert that `loadAccountById` exists, is publicly exposed, `loadSelectedAccount` delegates to it, and the load path references no save/My Playlist/Custom persistence API.

- [ ] **Step 2: Verify RED**
Run: `node tests/xtream-account-load-ownership.test.mjs`
Expected: FAIL because shared loader is absent.

- [ ] **Step 3: Implement minimal loader**
Create `async function loadAccountById(accountId)`: trim/validate ID, use existing trusted-device check, load channels, convert to M3U, apply temporary sidebar mode, render existing account preview, update `loaded` and status. Make `loadSelectedAccount()` delegate. Expose it on `window.WebTVXtream`.

- [ ] **Step 4: Verify GREEN**
Run: `node tests/xtream-account-load-ownership.test.mjs && node tests/xtream-ui-preview-contract.test.mjs && node tests/xtream-large-catalog.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**
`git commit -am "refactor: unify Xtream saved account loading"` plus the new test.

---

### Task 2: Playlist Manager owns Saved Xtream cards

**Files:**
- Modify: `src/playlist-manager.js`
- Create: `tests/playlist-manager-xtream-library.test.mjs`

**Interfaces:**
- Consumes: cached item `type:'xtream'`, `url:'xtream:<accountId>'`; `WebTVXtream.loadAccountById(accountId)`.
- Produces: typed Xtream card rendering and Load live behavior.

- [ ] **Step 1: Write RED test**
Assert that Playlist Manager:
- recognizes Xtream items from typed data/reference;
- renders Xtream/person icon;
- renders `Load live`;
- omits Export;
- derives account ID from `xtream:<accountId>`, never title text;
- calls `WebTVXtream.loadAccountById(accountId)`;
- refuses malformed empty `xtream:` markers;
- preserves normal Load/Export branches for non-Xtream items.

- [ ] **Step 2: Verify RED**
Run: `node tests/playlist-manager-xtream-library.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement minimal typed branch**
Add a small `xtreamAccountId(item)` helper. In Saved Playlist rendering, render valid Xtream markers with Xtream icon + `Load live` + no Export. Delegate loading to `WebTVXtream.loadAccountById`. Invalid Xtream marker reports an error and never calls `applyText`. Rename/delete remain unchanged.

- [ ] **Step 4: Verify GREEN**
Run: `node tests/playlist-manager-xtream-library.test.mjs && node tests/playlist-manager-dialog-ownership.test.mjs && node tests/playlist-manager-html-escape.test.mjs && node tests/custom-playlist-cache.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**
Commit Playlist Manager + test as `feat: own Xtream Library cards in Playlist Manager`.

---

### Task 3: Retire duplicate Xtream persistence/merge UI

**Files:**
- Modify: `src/registry-default.js`
- Delete: `src/xtream-enhancements.js`
- Create: `tests/xtream-legacy-enhancements-retirement.test.mjs`
- Modify: `tests/xtream-ui-preview-contract.test.mjs`
- Modify: `tests/frontend-integration.test.mjs`

**Interfaces:**
- Consumes: canonical Preview/Save Channel/Save Full Account flows plus Task 2 card ownership.
- Produces: no legacy Xtream enhancement runtime.

- [ ] **Step 1: Write RED retirement test**
Assert:
- Registry entrypoint does not import `xtream-enhancements.js`;
- production source contains no `Save Xtream Playlist`;
- production source contains no `xtream-merge-overlay`;
- no Xtream-specific capture interception of `#my-playlist-channel-action`;
- canonical channel/full-account save events/buttons still exist;
- `src/xtream-enhancements.js` is absent after implementation.

- [ ] **Step 2: Verify RED**
Run: `node tests/xtream-legacy-enhancements-retirement.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Remove legacy owner**
Remove the import from `registry-default.js`, delete `xtream-enhancements.js`, and add permanent anti-regression assertions to preview/frontend integration tests.

- [ ] **Step 4: Verify GREEN**
Run:
`node tests/xtream-legacy-enhancements-retirement.test.mjs && node tests/xtream-ui-preview-contract.test.mjs && node tests/xtream-save-destination-ui-contract.test.mjs && node tests/xtream-save-destination.test.mjs && node tests/xtream-full-account-save.test.mjs && node tests/frontend-integration.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**
Commit as `refactor: retire duplicate Xtream enhancement paths`.

---

### Task 4: Full branch verification and PR

**Files:** no intended product changes unless a test finds a defect.

- [ ] **Step 1: Run all directly affected tests**
Run all Task 1–3 tests plus Playlist Manager dialog ownership and frontend integration. Expected: zero failures.

- [ ] **Step 2: Run the same frontend validation commands used by `.github/workflows/validate-frontend.yml`**
Expected: zero failures.

- [ ] **Step 3: Diff review against spec**
Confirm no new Registry writer, no duplicate IndexedDB writer, no title-based account identity, no legacy save/merge UI, no Player/Search/EPG change, and normal Saved Playlist behavior preserved.

- [ ] **Step 4: Open PR and require exact-head checks**
Required SUCCESS:
- Validate Xtream Save Destination
- Validate Xtream Save Destination UI
- Validate Xtream Full Account
- Validate WebTV Frontend

Do not merge with failed required checks.

---

### Task 5: Merge, deploy and production acceptance

- [ ] **Step 1: Merge with expected-head protection**
Record exact merge SHA.

- [ ] **Step 2: Verify exact merge SHA deployment**
Require Pages SUCCESS, Frontend SUCCESS, and Registry SUCCESS if triggered. Compare GitHub main, deployed SHA and checkpoint SHA when direct endpoint access is available. If not available, record the limitation and do not claim equality.

- [ ] **Step 3: Production browser acceptance**
Verify:
- no `Save Xtream Playlist` button;
- no legacy `XTREAM → MY PLAYLIST` dialog;
- Preview → Verify → Save Channel… works;
- Preview → Verify → Save Full Xtream Account works;
- saved Xtream card shows Xtream/person identity, `Load live`, no Export;
- `Load live` loads the saved account temporarily;
- no unintended Player/My/Custom mutation;
- no console/page errors.

Use 50-channel authorized mock for functional proof. Do not repeat 5000-channel performance proof unless this change unexpectedly touches catalog rendering.

- [ ] **Step 4: Stop on any live failure**
Add a bounded regression/fix before claiming DONE.

---

### Task 6: Project Brain closure after live success

**Files:**
- Modify: `WEBV2_CURRENT.md`
- Modify: `WEBV2_DECISIONS.md`
- Modify: `WEBV2_CLEANUP.md`

- [ ] **Step 1: Fresh mandatory preflight**
Read project-status, checkpoints, full CURRENT, main SHA and relevant workflows.

- [ ] **Step 2: Update CURRENT**
Record runtime SHA, one canonical Full Account path, one canonical channel-save path, Playlist Manager ownership of Xtream cards, deleted legacy module, exact CI/deploy/live proof, and next safe audit action.

- [ ] **Step 3: Update DECISIONS**
Freeze Preview/Verify as sole Xtream persistence entry and Playlist Manager as Saved Playlist card owner.

- [ ] **Step 4: Update CLEANUP**
Mark `xtream-enhancements.js` resolved/deleted with deletion/runtime SHA and proof.

- [ ] **Step 5: Merge docs-only closure**
Keep runtime SHA distinct from later documentation SHA.
