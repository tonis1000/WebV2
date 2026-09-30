# Phase E2 Shared M3U Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated M3U structural parsing across active WebV2 callers with one pure canonical `src/core/m3u-container.js` while preserving every caller's existing matching, filtering, trust, promotion, ranking, verification, and playback behavior.

**Architecture:** The shared core owns only container structure: EXTINF parsing, neutral attributes/title/duration, source-line association, directives/comments, and fail-soft input normalization. Channel Catalog, Source Discovery, Source Hunt Worker, and frontend Source Hunt remain adapters that apply their own policy. Migration is caller-by-caller and stops on unexplained behavior drift.

**Tech Stack:** JavaScript ES modules, Node `.mjs` regression tests, browser modules, Cloudflare Workers/Wrangler, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-30-phase-e2-m3u-container-design.md`

## Global Constraints

- No D1/application schema change.
- No Player behavior or fallback-order change.
- No Channel Identity/Profile behavior change.
- No Phase D promotion-policy change.
- No Source Verifier status/security change.
- No STRM resolution migration in E2.
- No Enigma2 parser/transport migration in E2.
- No RTSP/RTMP gateway work.
- No Source Hunt search/ranking redesign.
- No Source Discovery provider redesign.
- Preserve current caller-specific accepted URL schemes exactly.
- Preserve current candidate/channel object shapes and ordering/dedupe semantics.
- Shared parser is pure: no DOM/window, network, D1, auth, Worker bindings, persistence, playback, or identity logic.
- `shared parser parses; caller decides` is the hard ownership invariant.
- Every task follows RED -> observed expected failure -> minimal GREEN -> focused regressions.
- Any discovered behavior difference that is not required for structural parity becomes a separate decision/task, never a silent E2 change.
- DONE = implemented + deployed + actually verified on the exact merge SHA.

## Review Focus

- Header-aware source lines such as `https://...m3u8|User-Agent=...` must survive structural parsing unchanged.
- `#EXTINF` titles containing commas must preserve the entire display title after the metadata delimiter.
- Blank/comment/directive lines may occur between EXTINF and source.
- A following `#EXTINF` terminates an entry with no source rather than stealing the next channel's URL.
- Channel Catalog must remain HTTP(S)-only even though the shared parser can expose RTSP/RTMP/STRM structurally.
- Source Discovery must continue to preserve RTSP/RTMP candidates and mark them non-saveable according to current policy.
- Source Hunt must retain its own live/HLS/DASH/STRM/filter/ranking rules.
- M3U changes must trigger Source Discovery and Source Hunt deployment because both Workers will import the shared file.

---

### Task 1: Canonical Pure M3U Container Core

**Files:**
- Create: `src/core/m3u-container.js`
- Create: `tests/m3u-container-core.test.mjs`
- Modify: `.github/workflows/validate-frontend.yml` only after core GREEN, to add the permanent E2 test step in Task 6.

**Produces:**
- `parseM3uContainer(text)`
- `parseM3uAttributes(extinfLine)`
- `isM3uContainer(text)`

- [ ] **Step 1: Write RED structural contract**

Create `tests/m3u-container-core.test.mjs` importing the missing module and pin neutral behavior for:
- LF and CRLF;
- `#EXTM3U` detection;
- mixed-case `#EXTINF`;
- quoted `tvg-id`, `tvg-name`, `tvg-logo`, `group-title`;
- bare legacy attributes needed by current Channel Catalog;
- title with additional commas;
- blank lines;
- directives/comments between EXTINF and source;
- source query strings;
- `|User-Agent=...` suffix preserved byte-for-byte after trimming outer whitespace;
- HLS, DASH, direct HTTP(S), RTSP, RTMP, STRM source lines exposed structurally without validation;
- missing source;
- next EXTINF before source;
- duplicate entries kept in input order;
- malformed/partial EXTINF fail-soft behavior.

Representative neutral assertion:

```js
const [entry] = parseM3uContainer(`#EXTM3U\n#EXTINF:-1 tvg-id="MEGA" group-title="General",MEGA, Greece\n#EXTVLCOPT:http-user-agent=WebTV\nhttps://cdn.test/mega.m3u8?token=1|User-Agent=UA\n`);
assert.equal(entry.title, 'MEGA, Greece');
assert.equal(entry.attributes['tvg-id'], 'MEGA');
assert.equal(entry.sourceLine, 'https://cdn.test/mega.m3u8?token=1|User-Agent=UA');
assert.deepEqual(entry.directivesBeforeSource, ['#EXTVLCOPT:http-user-agent=WebTV']);
```

- [ ] **Step 2: Observe RED**

Run:

```bash
node tests/m3u-container-core.test.mjs
```

Expected: FAIL because `src/core/m3u-container.js` does not exist.

- [ ] **Step 3: Implement minimal pure parser**

Implement only the approved API. Entry shape:

```js
{
  index,
  extinf,
  duration,
  title,
  attributes,
  sourceLine,
  directivesBeforeSource,
}
```

Structural rules:
- normalize CRLF to LF;
- case-insensitive EXTINF recognition;
- stop source search at next EXTINF;
- preserve intervening non-empty `#...` lines;
- first non-comment/non-empty line becomes `sourceLine`;
- do not validate scheme/format;
- do not dedupe;
- do not resolve nested containers/STRM;
- malformed entry never aborts parsing of later entries.

- [ ] **Step 4: GREEN core test**

Run:

```bash
node tests/m3u-container-core.test.mjs
node tests/source-format-registry.test.mjs
```

Expected: PASS. E1 format classification remains unchanged.

- [ ] **Step 5: Commit Task 1**

Commit message: `feat: add shared M3U container parser`

---

### Task 2: Migrate Channel Catalog Behind Compatibility Adapter

**Files:**
- Create: `tests/channel-catalog-m3u-parity.test.mjs`
- Modify: `src/core/channel-catalog.js`
- Modify: `index.html` only if browser delivery/cache-busting requires it.

**Consumes:** neutral `parseM3uContainer()` output.

**Preserves:** existing exported `parseM3U(text)` and `dedupeChannels(channels)` behavior.

- [ ] **Step 1: Freeze Channel Catalog parity in RED migration contract**

Pin current behavior before changing implementation:
- quoted metadata maps identically;
- bare attributes stay supported;
- fallback name/title behavior stays identical;
- title with comma remains full fallback name;
- only HTTP(S) source lines enter `directUrls`;
- RTSP/RTMP/STRM remain excluded from Channel Catalog `directUrls`;
- comments/blank lines are skipped as today;
- next EXTINF prevents source stealing;
- duplicate normalized ids merge URLs/logo/group exactly through `dedupeChannels()`;
- `sourceTrust === 'temporary'`.

Add a source-ownership assertion requiring `channel-catalog.js` to import `m3u-container.js` and no longer own its private EXTINF line traversal/attribute parser after migration.

- [ ] **Step 2: Observe RED on ownership assertion**

Run:

```bash
node tests/channel-catalog-m3u-parity.test.mjs
node tests/import-promotion-contract.test.mjs
```

Expected: parity fixtures pass on old implementation, new shared-core ownership assertion FAILS.

- [ ] **Step 3: Migrate `parseM3U()`**

Map neutral entries to the exact current channel object:

```js
{
  id,
  originalId,
  name,
  logo,
  group,
  directUrls,
  sourceTrust: 'temporary'
}
```

Keep `normalizeId`, HTTP(S)-only policy, and `dedupeChannels()` local.

Do not call `detectSourceFormat()` here to broaden policy. Structural source exposure is not format acceptance.

- [ ] **Step 4: Verify Phase D boundary**

Run:

```bash
node tests/channel-catalog-m3u-parity.test.mjs
node tests/import-promotion-contract.test.mjs
node tests/discovery-promotion.test.mjs
```

Expected: PASS with imported metadata still temporary before promotion.

- [ ] **Step 5: Browser cache/import integration check**

If a browser import needs explicit versioning, use the E2 build id consistently and keep `tests/frontend-integration.test.mjs` green. Do not create two independent core build IDs in the import map.

- [ ] **Step 6: Commit Task 2**

Commit message: `refactor: parse catalog M3U through shared core`

---

### Task 3: Migrate Source Discovery M3U Traversal

**Files:**
- Create: `tests/source-discovery-m3u-parity.test.mjs`
- Modify: `workers/webtv-source-discovery.js`
- Existing tests: `tests/source-discovery-worker.test.mjs`, `tests/curated-remote-feeds.test.mjs`, provider tests.

**Preserves:** `parseM3u(text, channel, feed)` public/test contract, `candidateMatches`, `validPublicUrl`, `makeCandidate`, provider injection behavior.

- [ ] **Step 1: Write RED migration assertions**

Fixtures must pin:
- MEGA matches, MEGA News does not collapse into MEGA;
- HLS remains HLS;
- DASH/direct remain current types;
- RTSP/RTMP remain candidates and `saveEligible=false`;
- header-aware HTTP source line is preserved;
- directives/blank lines before source do not alter output;
- invalid/non-public source remains rejected by current `validPublicUrl()`;
- candidate count/order/max-results unchanged;
- injected parser continues to work in GitHub/Recent Web/STRM-specific providers.

Add source-ownership assertion that Discovery imports `parseM3uContainer` and no longer owns duplicate M3U line traversal/EXTINF attribute extraction. Keep Enigma2 parser untouched.

- [ ] **Step 2: Observe RED**

Run:

```bash
node tests/source-discovery-m3u-parity.test.mjs
node tests/source-discovery-worker.test.mjs
node tests/curated-remote-feeds.test.mjs
```

Expected: new shared-core ownership assertion FAILS before migration.

- [ ] **Step 3: Migrate only M3U structure**

Use neutral entries, then retain local policy:
- `candidateMatches(entry.extinf, channel)`;
- `validPublicUrl(entry.sourceLine)`;
- current `makeCandidate()`;
- current `MAX_RESULTS`;
- current source type/save eligibility.

Do not move `parseEnigma2`, `safeDecode`, `typeOf`, or provider logic into the core.

- [ ] **Step 4: Run Discovery suite**

```bash
node tests/source-discovery-m3u-parity.test.mjs
node tests/source-discovery-worker.test.mjs
node tests/curated-remote-feeds.test.mjs
node tests/github-public-playlists-provider.test.mjs
node tests/recent-web-search-provider.test.mjs
node tests/strm-specific-discovery-provider.test.mjs
node tests/official-provider-lane.test.mjs
node tests/official-api-resolver-provider.test.mjs
node tests/discovery-external.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Commit message: `refactor: share Source Discovery M3U structure`

---

### Task 4: Migrate Source Hunt Worker M3U Traversal

**Files:**
- Create: `tests/source-hunt-m3u-parity.test.mjs`
- Modify: `workers/source-huntatonisworkersdev.js`
- Do not modify `workers/source-hunt-smart.js` or `workers/source-hunt-bouquet-proxy.js` unless import packaging/regression evidence requires it.

**Preserves:** Hunt relevance, `classifyEntry`, URL cleaning, live filtering, STRM resolution, search/freshness/ranking.

- [ ] **Step 1: Make current Hunt parser testable and write RED ownership contract**

Export `parseM3u` as a named internal/testable helper if needed without changing default Worker behavior.

Pin representative current Hunt results for:
- exact main-channel match;
- rejected variants/subchannels;
- irrelevant channel skipped;
- HLS/DASH live URLs kept according to current Hunt policy;
- direct non-live source rejected as today;
- comments/blank lines handled with identical result;
- current `extinf` snippet retained;
- STRM handling remains in existing resolution flow, not the shared parser.

Add assertion that Worker consumes `m3u-container.js` and no longer owns a local EXTINF/source traversal loop.

- [ ] **Step 2: Observe RED**

Run:

```bash
node tests/source-hunt-m3u-parity.test.mjs
```

Expected: FAIL on shared-core ownership requirement before migration.

- [ ] **Step 3: Migrate structural loop only**

Replace local line traversal with `parseM3uContainer(text)` while keeping:
- `relevant()`;
- `classifyEntry()`;
- `cleanUrl()`;
- `isLiveUrl()`;
- `isStrm()`/`resolveStrm()`;
- candidate/lead construction;
- budget/search policy.

- [ ] **Step 4: Run focused and syntax tests**

```bash
node tests/source-hunt-m3u-parity.test.mjs
node --check src/core/m3u-container.js
node --check workers/source-huntatonisworkersdev.js
node --check workers/source-hunt-smart.js
node --check workers/source-hunt-bouquet-proxy.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Commit message: `refactor: share Source Hunt M3U structure`

---

### Task 5: Migrate Frontend Source Hunt Structural Traversal

**Files:**
- Create: `tests/source-hunt-frontend-m3u-parity.test.mjs`
- Modify: `src/source-hunt-engine.js`
- Modify: `index.html` for cache-busting/import delivery as required.

**Preserves:** `extractM3u8`, relevance scoring, URL relevance, scores, result object shape, loose-text fallback, UI behavior, fetch/search budgets.

- [ ] **Step 1: Write frontend parity test before migration**

The Node test may stub minimal `document.getElementById` before dynamic-importing `src/source-hunt-engine.js` and use exported `collectFromM3U()` / `extractM3u8()` helpers.

Pin:
- exact M3U candidate output URL/origin/detail/updatedAt/score;
- irrelevant EXTINF produces no candidate;
- comments/blank lines preserve result;
- title/query-string handling remains identical;
- only `.m3u8` URLs are emitted from the exact frontend Hunt M3U path;
- loose-text fallback remains independent.

Add ownership assertion requiring shared M3U core import and absence of independent EXTINF source-line traversal.

- [ ] **Step 2: Observe RED ownership assertion**

Run:

```bash
node tests/source-hunt-frontend-m3u-parity.test.mjs
```

Expected: FAIL before migration.

- [ ] **Step 3: Migrate `collectFromM3U()`**

Use `parseM3uContainer()` entries only for structural traversal. Keep `extractM3u8(entry.sourceLine)`, relevance calculations, scoring, origin/detail fields local.

Do not route loose-text scanning through the M3U parser.

- [ ] **Step 4: Update browser delivery safely**

If using a versioned relative browser import, apply one E2 build id consistently. Ensure `index.html`/module graph cannot serve stale `m3u-container.js` while parent modules are fresh.

Run:

```bash
node tests/source-hunt-frontend-m3u-parity.test.mjs
node tests/frontend-integration.test.mjs
node tests/startup-nonblocking.test.mjs
node tests/discovery-browser-smoke.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

Commit message: `refactor: share frontend Hunt M3U structure`

---

### Task 6: CI/Deployment Dependency + Project Brain Contracts

**Files:**
- Modify: `.github/workflows/validate-frontend.yml`
- Modify: `.github/workflows/deploy-source-discovery.yml`
- Modify: `.github/workflows/deploy-source-hunt.yml`
- Modify: `tests/m3u-container-core.test.mjs` or add a small workflow-contract assertion there.
- Modify: `WEBV2_ROADMAP.md`
- Modify: `WEBV2_ARCHITECTURE.md`
- Modify: `WEBV2_DECISIONS.md`
- Modify: `WEBV2_CLEANUP.md`
- Modify Playbooks/Lessons/Tooling only for knowledge actually learned during implementation.

- [ ] **Step 1: Write RED workflow dependency assertions**

Require:
- Source Discovery deploy `push.paths` contains `src/core/m3u-container.js`;
- Source Hunt deploy `push.paths` contains `src/core/m3u-container.js`;
- both workflows syntax-check the core;
- both workflows execute the relevant core/parity tests;
- frontend validation executes all E2 focused tests.

Run focused test and observe FAIL until workflows are updated.

- [ ] **Step 2: Update workflows**

Source Discovery workflow:
- add `src/core/m3u-container.js` path trigger;
- syntax-check shared core;
- run `tests/m3u-container-core.test.mjs` and `tests/source-discovery-m3u-parity.test.mjs` before existing provider suite.

Source Hunt workflow:
- add `src/core/m3u-container.js` path trigger;
- add relevant new E2 test paths or explicit test file triggers;
- syntax-check shared core;
- run `tests/m3u-container-core.test.mjs` and `tests/source-hunt-m3u-parity.test.mjs`.

Frontend validation:
- add dedicated E2 steps for core/catalog/discovery/hunt/frontend parity tests.

Do not weaken any existing live gate.

- [ ] **Step 3: Update Brain state for implementation branch**

- Roadmap: E2 `NOT STARTED` -> `IN PROGRESS` only once implementation has begun.
- Architecture: add `M3U Container Core` as owner of structural parsing; explicitly state it does not own identity, format verification, trust, ranking, resolution, or playback.
- Decisions: add durable E2 decision `shared container structure, caller-owned policy`.
- Cleanup CLEAN-003: mark migration in progress, not safe to delete until all callers and deploy/live proof are complete.
- Lessons/Playbooks: record only real reusable findings discovered while executing.
- Tooling: record the observed TinyFish Fetch limitation for Registry API raw-body extraction only if re-observed/relevant and word it narrowly.

- [ ] **Step 4: Run Project Brain + workflow contracts**

```bash
node tests/project-brain-docs.test.mjs
node tests/m3u-container-core.test.mjs
node tests/frontend-integration.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

Commit message: `ci: enforce Phase E2 shared M3U dependencies`

---

### Task 7: Full Regression, Review, PR, Merge, Deploy, Live Verification, Canonical Closure

**Files:**
- No behavior expansion.
- Brain docs may be updated with final exact evidence.
- Canonical Registry/D1 `WEBV2_CURRENT.md` is updated only after exact-SHA verification.

- [ ] **Step 1: Run focused E2 suite**

```bash
node tests/m3u-container-core.test.mjs
node tests/channel-catalog-m3u-parity.test.mjs
node tests/source-discovery-m3u-parity.test.mjs
node tests/source-hunt-m3u-parity.test.mjs
node tests/source-hunt-frontend-m3u-parity.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run exposed compatibility regressions**

```bash
node tests/import-promotion-contract.test.mjs
node tests/discovery-promotion.test.mjs
node tests/source-format-registry.test.mjs
node tests/source-discovery-worker.test.mjs
node tests/curated-remote-feeds.test.mjs
node tests/github-public-playlists-provider.test.mjs
node tests/recent-web-search-provider.test.mjs
node tests/strm-specific-discovery-provider.test.mjs
node tests/official-provider-lane.test.mjs
node tests/official-api-resolver-provider.test.mjs
node tests/discovery-external.test.mjs
node tests/header-aware-proxy.test.mjs
node tests/source-ranking.test.mjs
node tests/startup-nonblocking.test.mjs
node tests/frontend-integration.test.mjs
node tests/project-brain-docs.test.mjs
node tests/discovery-browser-smoke.mjs
```

Also run all other tests already enforced by `Validate WebTV Frontend`; the branch PR CI is authoritative for the full suite.

- [ ] **Step 3: No-duplication audit**

Search active code for independent M3U structural parsing patterns (`split('\n')` + EXTINF traversal / private EXTINF attr parsing) in the four migrated callers.

Expected:
- structural ownership is `src/core/m3u-container.js`;
- caller-specific matching/filtering logic remains local;
- Enigma2/STRM-specific parsing remains for E3 and is not misclassified as E2 duplication.

If an active M3U structural consumer was missed, do not mark CLEAN-003 resolved; either migrate it under approved scope or record it explicitly as remaining work.

- [ ] **Step 4: Request code review before merge**

Review focus:
- policy did not leak into core;
- caller parity retained;
- worker imports package correctly;
- browser cache-busting is consistent;
- workflow triggers cover shared dependency;
- no STRM/Enigma2 redesign slipped in.

Resolve P1/P2 or equivalent correctness findings before merge. Use receiving-code-review/systematic-debugging rules for any finding/failure.

- [ ] **Step 5: Open PR and require branch validation GREEN**

Do not merge a RED branch. Record final branch head SHA and successful validation run.

- [ ] **Step 6: Merge and capture exact merge SHA**

After merge, do not call E2 DONE yet.

- [ ] **Step 7: Verify exact-SHA production evidence**

Require on the merge SHA:
- `Validate WebTV Frontend` SUCCESS;
- `Deploy Source Discovery Worker` SUCCESS and existing live provider verification SUCCESS;
- `Deploy Source Hunt Worker` SUCCESS and existing root/bouquet live gate SUCCESS;
- GitHub Pages deployment SUCCESS;
- browser smoke/startup/integration included in validation SUCCESS.

Do not infer one Worker from another Worker's status.

- [ ] **Step 8: Close Brain knowledge only after verification**

Update repo Brain state through the normal follow-up if final evidence must be recorded in GitHub:
- Roadmap E2 -> DONE with merge SHA/evidence;
- Architecture M3U Container Core -> verified owner;
- Cleanup CLEAN-003 -> RESOLVED only if no active duplicate structural parser remains; otherwise list remaining consumer precisely;
- Playbook/Lesson additions for reusable migration/deploy findings.

Avoid creating a second canonical current-state copy in repo `WEBV2_CURRENT.md`.

- [ ] **Step 9: Update live canonical CURRENT with CAS editor**

Use the proven scoped route:
`/api/project-agent/checkpoints/WEBV2_CURRENT.md/edit`

Procedure:
1. fresh scoped checkpoint read;
2. record current SHA;
3. edit full content;
4. save once with CAS;
5. require Saved SHA;
6. scoped readback if independent confirmation is available.

Canonical should record:
- E2 DONE;
- exact merge/deployed SHA;
- exact verification evidence;
- next safe action Phase E3 design/preflight, not automatic implementation.

- [ ] **Step 10: Final verification-before-completion**

Re-check:
- GitHub `main` == E2 merge SHA;
- relevant deployments succeeded on same SHA;
- canonical current names same verified SHA/state;
- no unresolved review/blocker is being hidden;
- Problem-to-Knowledge updates are complete.

Only then report **Phase E2 DONE**.

---

## Execution Notes

- Use a fresh implementation branch/worktree from the approved design branch or the then-current main after checking for divergence. Do not implement directly on `main`.
- If `main` advanced after the design base SHA, reconcile before implementation and rerun affected preflight assumptions.
- Prefer direct module imports. If Wrangler cannot bundle `../src/core/m3u-container.js`, stop and fix packaging; do not copy the parser into Worker files.
- Keep browser cache-bust changes minimal and consistent with `tests/frontend-integration.test.mjs`.
- Source Discovery provider modules may continue receiving `parseM3u` as an injected dependency; E2 does not redesign their interfaces.
- E2 may remove local structural helper functions only after caller parity is GREEN. Their removal is part of migration, not a separate broad cleanup.
