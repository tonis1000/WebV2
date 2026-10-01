# Official Discovery Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove WebV2 Official broadcaster discovery/resolution as a product capability while preserving every discovery provider and runtime boundary still required by Unified Search.

**Architecture:** Retire the two Official Source Discovery providers from the Worker API and browser discovery client, remove the corresponding legacy Discovery-shell wiring and tests, and make CI/live verification prove the providers are absent. Keep the permanent Unified Search guard that rejects providers matching `official`, and leave shared candidate, verifier, promotion, Xtream, local-source and retained discovery engines unchanged.

**Tech Stack:** Browser ES modules, Cloudflare Workers, Node.js contract tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-01-discovery-cleanup-decisions.md`

## Global Constraints

- Unified Search remains the single automatic discovery surface.
- Official discovery / official-source resolution is a REMOVE CANDIDATE and must not be added to Unified Search or retained as a hidden fallback.
- Curated feeds, GitHub playlists, recent web, STRM discovery, Authorized Xtream and Hunt exploration remain available.
- New Xtream preview remains available as code for later move to Xtream management.
- Promotion policy remains shared and unchanged in this slice.
- Local source scan remains available as code for later background-intelligence ownership.
- Player, Source Verifier semantics, D1 persistence, Favorites, My Playlist, EPG, Xtream secret storage and startup behavior remain unchanged.
- The permanent Unified Search `official` provider rejection guard remains in place.
- `WEBV2_CURRENT.md` is not updated to claim this slice DONE until merge, deployment and actual verification are complete.
- DONE means implemented + deployed + actually verified.

## Review Focus

1. Requests for `official-provider-lane` and `official-api-resolver` must become unsupported instead of silently routing somewhere else.
2. Removing Official must not remove or weaken Curated, GitHub, Recent Web or STRM Worker providers used by Unified Search.
3. Source Discovery must no longer require the `SOURCE_VERIFIER` service binding solely for the retired Official resolver.
4. Legacy non-production Discovery shell/tests must not retain an Official button, lane or scan path that suggests the feature still exists.
5. Unified Search must continue to reject any future provider name containing `official`, preserving the product decision as a regression guard.

---

## File Structure

### Delete

- `workers/source-discovery/official-provider-lane.js` — broadcaster-page allowlist scanner.
- `workers/source-discovery/official-api-resolver.js` — ERT official API resolver and verifier integration.
- `tests/official-provider-lane.test.mjs` — direct test for retired provider.
- `tests/official-api-resolver-provider.test.mjs` — direct test for retired provider.

### Create

- `tests/official-discovery-retirement.test.mjs` — permanent contract proving Official providers, modules and deploy wiring stay retired while Unified Search continues to reject `official` providers.

### Modify

- `workers/webtv-source-discovery.js` — remove Official imports, provider branches, flags and exports.
- `src/discovery/external-discovery-client.js` — remove Official constants/helpers/fallback aggregation and Official-specific trusted-server normalization.
- `src/discovery/discovery-ui.js` — remove the legacy Official button/lane/scan helper while preserving all retained non-production capabilities.
- `src/discovery/discovery-state.js` — remove Official-only lane counters from legacy shell state.
- `tests/discovery-external.test.mjs` — retain only Curated/GitHub/Web/STRM client contracts plus cancellation/untrusted-normalization coverage.
- `tests/source-discovery-worker.test.mjs` — prove Worker status excludes Official providers and requests to old provider names return `400 Unsupported provider`.
- `tests/browser-resolver-retirement.test.mjs` — remove historical assertions that Official API/provider must remain; preserve Browser Resolver retirement invariants.
- `tests/discovery-browser-smoke.html` — remove legacy Official fixture, scan and lane-count expectations; keep local/retained external/Xtream/verification/promotion coverage.
- `.github/workflows/validate-frontend.yml` — stop running deleted Official provider tests; add retirement contract.
- `.github/workflows/deploy-source-discovery.yml` — remove Official provider tests, Official live calls/assertions and the now-unused `SOURCE_VERIFIER` service binding; add retirement contract and live absence proof.

### Intentionally unchanged

- `src/search/adapters/discovery-provider-adapter.js` — keep `BLOCKED_PROVIDER=/official/i` as permanent product guard.
- `src/search/search-runtime.js` — Unified Search lane set stays unchanged.
- `src/discovery/candidate-model.js` — shared candidate/provenance shape is not narrowed in this slice.
- `src/discovery/promotion.js` — shared save safety remains unchanged.
- `src/discovery/local-data-reader.js`, `src/discovery/local-candidates.js` — local intelligence remains available.
- `src/discovery/new-xtream-preview.js`, `src/discovery/authorized-xtream.js` — Xtream capabilities remain available.
- `workers/webtv-source-discovery-smart.js` — STRM smart wrapper behavior remains unchanged.

---

### Task 1: Add the Official retirement contract

**Files:**
- Create: `tests/official-discovery-retirement.test.mjs`
- Test: `tests/official-discovery-retirement.test.mjs`

**Interfaces:**
- Consumes: current repository source files as text.
- Produces: a static contract preventing Official discovery from returning to Worker/browser/deploy wiring while retaining the Unified Search rejection guard.

- [ ] **Step 1: Write the failing retirement test**

The test must assert all of the following:

```js
assert.equal(fs.existsSync('workers/source-discovery/official-provider-lane.js'), false);
assert.equal(fs.existsSync('workers/source-discovery/official-api-resolver.js'), false);
assert.doesNotMatch(worker, /official-provider-lane|official-api-resolver/i);
assert.doesNotMatch(externalClient, /OFFICIAL_PROVIDER_LANE|OFFICIAL_API_RESOLVER_PROVIDER|discoverOfficialProvider|discoverOfficialApi/);
assert.doesNotMatch(legacyUi, /Find Official Sources|discovery-scan-official|scanOfficial/);
assert.doesNotMatch(deployWorkflow, /OFFICIAL_API|OFFICIAL=|official-provider-lane|official-api-resolver|SOURCE_VERIFIER/);
assert.match(unifiedAdapter, /BLOCKED_PROVIDER=\/official\/i/);
```

Also assert retained provider identifiers still exist in Worker/client wiring: `curated-remote-feeds`, `github-public-playlists`, `recent-web-search`, `strm-specific-discovery`.

- [ ] **Step 2: Run the test to verify RED**

Run: `node tests/official-discovery-retirement.test.mjs`

Expected: FAIL because Official modules and wiring still exist.

- [ ] **Step 3: Commit the RED contract**

```bash
git add tests/official-discovery-retirement.test.mjs
git commit -m "test: define official discovery retirement contract"
```

---

### Task 2: Retire Official providers from the Source Discovery Worker

**Files:**
- Delete: `workers/source-discovery/official-provider-lane.js`
- Delete: `workers/source-discovery/official-api-resolver.js`
- Delete: `tests/official-provider-lane.test.mjs`
- Delete: `tests/official-api-resolver-provider.test.mjs`
- Modify: `workers/webtv-source-discovery.js`
- Modify: `tests/source-discovery-worker.test.mjs`
- Modify: `tests/browser-resolver-retirement.test.mjs`

**Interfaces:**
- Consumes: existing `/discover` provider dispatch contract.
- Produces: Worker API supporting only retained providers; old Official provider names receive the existing unsupported-provider `400` path.

- [ ] **Step 1: Update Worker regression expectations before implementation**

In `tests/source-discovery-worker.test.mjs`:

- remove Official imports/constants/status assertions;
- assert status has no own property `official-provider-lane`;
- assert status has no own property `official-api-resolver`;
- POST each retired provider name and assert HTTP `400` with `error === 'Unsupported provider'`;
- preserve all retained provider assertions.

In `tests/browser-resolver-retirement.test.mjs`, remove only assertions requiring Official provider/API code to remain. Preserve all checks proving Browser Resolver stays retired.

- [ ] **Step 2: Run Worker tests and retirement contract to verify expected failures**

Run:

```bash
node tests/source-discovery-worker.test.mjs
node tests/browser-resolver-retirement.test.mjs
node tests/official-discovery-retirement.test.mjs
```

Expected: updated Worker/retirement expectations fail until implementation is removed.

- [ ] **Step 3: Remove Worker Official wiring**

In `workers/webtv-source-discovery.js`:

- delete imports from the two Official provider modules;
- delete both provider dispatch branches;
- delete both provider entries from GET `/` status;
- delete Official constants from the export list;
- keep all retained provider dispatch/error behavior unchanged.

Delete the two implementation files and their direct provider tests.

- [ ] **Step 4: Run focused Worker tests**

Run:

```bash
node tests/source-discovery-worker.test.mjs
node tests/browser-resolver-retirement.test.mjs
node tests/curated-remote-feeds.test.mjs
node tests/github-public-playlists-provider.test.mjs
node tests/recent-web-search-provider.test.mjs
node tests/strm-specific-discovery-provider.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Worker retirement**

```bash
git add workers/webtv-source-discovery.js workers/source-discovery tests/source-discovery-worker.test.mjs tests/browser-resolver-retirement.test.mjs tests/official-provider-lane.test.mjs tests/official-api-resolver-provider.test.mjs
git commit -m "refactor: retire official discovery providers"
```

---

### Task 3: Remove Official browser-client and legacy-shell wiring

**Files:**
- Modify: `src/discovery/external-discovery-client.js`
- Modify: `src/discovery/discovery-ui.js`
- Modify: `src/discovery/discovery-state.js`
- Modify: `tests/discovery-external.test.mjs`
- Modify: `tests/discovery-browser-smoke.html`

**Interfaces:**
- Consumes: retained `/discover` providers.
- Produces: browser discovery client with Curated/GitHub/Web/STRM only, plus separate Xtream/local capabilities owned by their existing modules.

- [ ] **Step 1: Update browser-client tests first**

In `tests/discovery-external.test.mjs`:

- remove Official imports and scenarios;
- keep Curated/GitHub/Web/STRM request-shape assertions;
- keep the rule that external candidates arrive `UNVERIFIED` in browser state;
- keep malicious `verified:true` payload downgrade coverage for a retained provider;
- keep abort propagation coverage.

In `tests/discovery-browser-smoke.html`:

- remove Official fixture/provider branches;
- remove `api.scanOfficial()`;
- reduce expected lane/candidate totals by the removed Official result;
- preserve local scan, Curated, GitHub, Web, STRM, Authorized Xtream, New Xtream preview, Verify All and promotion checks.

- [ ] **Step 2: Run browser/client tests to verify RED**

Run:

```bash
node tests/discovery-external.test.mjs
node tests/discovery-browser-smoke.mjs
node tests/official-discovery-retirement.test.mjs
```

Expected: FAIL until browser Official wiring is removed.

- [ ] **Step 3: Remove Official client/shell code**

In `src/discovery/external-discovery-client.js`:

- remove both Official provider constants;
- remove Official entries from `PROVIDER_FLAGS`;
- remove Official-only trusted-server verification normalization;
- remove `restrictionType`, `officialStage`, `aggregateOfficialResult`, `discoverOfficialApi`, and `discoverOfficialProvider`;
- preserve `publicChannelRequest`, timeout/cancellation, retained discoverers and normalization.

In `src/discovery/discovery-ui.js`:

- remove Official imports;
- remove `Find Official Sources` button and event binding;
- remove Official lane display/status text and `scanOfficialSources` API/helper;
- do not change local, Xtream, verification or promotion behavior.

In `src/discovery/discovery-state.js`, remove only Official-specific lane counters (`officialApi`, `browserResolvedOfficial`, `officialProvider`).

- [ ] **Step 4: Run focused browser tests**

Run:

```bash
node tests/discovery-external.test.mjs
node tests/discovery-browser-smoke.mjs
node tests/discovery-candidate.test.mjs
node tests/discovery-isolation.test.mjs
node tests/discovery-local-sources.test.mjs
node tests/discovery-verifier.test.mjs
node tests/new-xtream-preview.test.mjs
node tests/discovery-promotion.test.mjs
node tests/authorized-xtream-discovery.test.mjs
node tests/official-discovery-retirement.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit browser cleanup**

```bash
git add src/discovery tests/discovery-external.test.mjs tests/discovery-browser-smoke.html tests/official-discovery-retirement.test.mjs
git commit -m "refactor: remove official discovery browser wiring"
```

---

### Task 4: Align CI/deploy verification with the retired feature

**Files:**
- Modify: `.github/workflows/validate-frontend.yml`
- Modify: `.github/workflows/deploy-source-discovery.yml`
- Test: `tests/official-discovery-retirement.test.mjs`

**Interfaces:**
- Consumes: Worker/browser state from Tasks 2-3.
- Produces: CI and live deployment proof that Official is absent and all retained Source Discovery providers still work.

- [ ] **Step 1: Update frontend CI**

In `.github/workflows/validate-frontend.yml`:

- remove the deleted `official-provider-lane.test.mjs` step;
- add `node tests/official-discovery-retirement.test.mjs`;
- keep retained discovery, Unified Search, Xtream, Player and persistence tests unchanged.

- [ ] **Step 2: Update Source Discovery deploy workflow**

In `.github/workflows/deploy-source-discovery.yml`:

- remove both deleted Official provider tests;
- add the retirement contract to regression tests;
- remove the `[[services]] SOURCE_VERIFIER` block from generated Wrangler config;
- remove `OFFICIAL` and `OFFICIAL_API` live curl calls;
- change live status assertions to require both Official provider keys to be absent;
- preserve live Curated, GitHub, Recent Web and STRM checks, including real STRM resolution;
- preserve the existing proof that `browser-resolved-official` stays absent.

- [ ] **Step 3: Run static retirement contract**

Run: `node tests/official-discovery-retirement.test.mjs`

Expected: PASS.

- [ ] **Step 4: Run full relevant local regression set**

Run the exact Node test commands invoked by `Validate Unified Search`, the Source Discovery section of `Validate WebTV Frontend`, and the pre-deploy regression section of `Deploy Source Discovery Worker`.

Expected: all PASS.

- [ ] **Step 5: Commit CI/deploy cleanup**

```bash
git add .github/workflows/validate-frontend.yml .github/workflows/deploy-source-discovery.yml tests/official-discovery-retirement.test.mjs
git commit -m "ci: verify official discovery retirement"
```

---

### Task 5: Merge, deploy and verify the bounded slice

**Files:**
- No additional runtime files unless verification finds a scoped defect.

**Interfaces:**
- Consumes: completed branch from Tasks 1-4.
- Produces: deployed evidence for Official retirement without changing Unified Search behavior.

- [ ] **Step 1: Review branch diff**

Confirm changed files are limited to the plan above. Explicitly reject unrelated Player, D1, Xtream-secret, Search-lane or layout changes.

- [ ] **Step 2: Run branch CI**

Open a draft PR and require exact-head success for at least:

- `Validate WebTV Frontend`
- `Validate Unified Search` if triggered by touched search/discovery-client ownership files
- `Deploy Source Discovery Worker` only after merge to `main`

- [ ] **Step 3: Merge with expected head SHA**

Merge only the reviewed/green branch head.

- [ ] **Step 4: Verify exact merge SHA deployment**

Require successful Source Discovery deploy on the exact merge SHA. Live workflow verification must prove:

- status does not advertise `official-provider-lane`;
- status does not advertise `official-api-resolver`;
- Curated provider responds successfully;
- GitHub provider responds successfully;
- Recent Web provider responds successfully when configured;
- STRM provider responds successfully and retains real resolution evidence;
- retired Official provider names are not part of the deployed provider set.

- [ ] **Step 5: Live UI verification boundary**

Because Official is already absent from production UI after PR #81, no new Official UI should appear. Verify Unified Search still works and remains independent from Player until explicit Play. If free browser automation remains unavailable, retain the slice as deployed-but-not-fully-DONE until user/live-browser evidence is available.

- [ ] **Step 6: Update canonical project state only after proof**

Update `WEBV2_CURRENT.md`/appropriate Brain owner only when implementation, deploy and actual verification evidence justify the claim. Do not infer Registry checkpoint/deployed SHA equality when `/api/project-status` or `/api/project-checkpoints` cannot be read.

---

## Self-Review Result

- Scope is one subsystem: Official discovery retirement.
- The plan preserves all retained Unified Search provider paths and explicitly avoids Player/D1/Xtream/promotion/local-intelligence changes.
- Worker API, browser client, legacy shell, tests and deploy verification are covered together so no half-retired feature remains.
- The Source Verifier binding is removed only from Source Discovery deployment because its current use in that Worker is exclusively the Official API resolver; Source Verifier itself is untouched.
- The existing Unified Search `/official/i` rejection remains as a permanent product guard.
- Live completion remains blocked on actual verification evidence, consistent with the project DONE rule.
