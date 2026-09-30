# Phase E1 Source Format Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce one canonical, extensible Source Format Registry for WebV2 so Discovery, frontend compatibility helpers, and the Source Verifier share the same format identity/detection rules while preserving current external behavior.

**Architecture:** Add a pure static registry in `src/core/source-format-registry.js` that separates transport recognition from confirmed media format and exposes structured classification plus legacy compatibility mapping. Migrate current consumers behind thin wrappers, keep Player/STRM/M3U/Enigma2 behavior unchanged, and make the Source Verifier deployment depend on the shared registry file so frontend and Worker cannot drift silently.

**Tech Stack:** JavaScript ES modules, Node-based `.mjs` regression tests, browser modules, Cloudflare Workers/Wrangler, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-30-phase-e1-source-format-registry-design.md`

## Global Constraints

- No D1 or persisted schema changes.
- No Player rewrite or playback fallback-order change.
- No STRM recursive-resolution change.
- No M3U parser migration in E1.
- No Enigma2 parser migration in E1.
- No Source Hunt provider rewrite in E1.
- No RTMP/RTSP browser-playback enablement.
- No dynamic third-party plugin loading.
- Unknown non-HTTP formats fail closed and remain representable.
- Generic HTTP(S) is transport/resource recognition, not confirmed playable media.
- Phase D metadata promotion semantics and Phase C EPG ownership remain unchanged.
- Registry code must be pure: no DOM/window, localStorage, fetch/network I/O, Cloudflare bindings, D1, auth, credentials, or playback-engine dependencies.
- Source Verifier security boundaries for safe HTTP(S), private/local target blocking, credentials, and allowed headers remain unchanged.
- TinyFish is not used for WebV2 without explicit necessity/approval.

## Review Focus

- Query-string/fragment URLs such as `channel.m3u8?token=...#x` must still classify as HLS.
- Explicit type aliases must not let arbitrary/unregistered strings override stronger URL evidence.
- Generic `https://...` must map to canonical `http-resource` while legacy Discovery/verifier callers that expect `direct` retain compatibility.
- Body/content-type evidence must upgrade transport-only HTTP resources to HLS/DASH/direct media without changing verification status semantics.
- Registry-only changes must trigger Source Verifier deployment so production Worker format truth cannot lag frontend truth.

---

### Task 1: Canonical Source Format Registry Core

**Files:**
- Create: `src/core/source-format-registry.js`
- Create: `tests/source-format-registry.test.mjs`

**Interfaces:**
- Consumes: no WebV2 runtime dependencies; standard JavaScript only.
- Produces:
  - `createSourceFormatRegistry(descriptors)`
  - `detectSourceFormat(input, registry?)`
  - `getSourceFormat(id, registry?)`
  - `classifySourceBody(input, registry?)`
  - `normalizeSourceDescriptor(input)`
  - `listSourceFormats(registry?)`
  - `toLegacySourceType(classification)`
  - default production registry/descriptors for `hls`, `dash`, `direct-video`, `http-resource`, `strm`, `m3u`, `rtsp`, `rtmp`, `xtream`, `header-aware`, `unknown`.

- [ ] **Step 1: Write RED registry contract tests**

Add assertions in `tests/source-format-registry.test.mjs` for:

```js
assert.equal(detectSourceFormat({ sourceUrl:'https://x/live.m3u8?token=1#frag' }).formatId, 'hls');
assert.equal(detectSourceFormat({ sourceUrl:'https://x/live.mpd?token=1' }).formatId, 'dash');
assert.equal(detectSourceFormat({ sourceUrl:'https://x/video.mp4' }).formatId, 'direct-video');
assert.deepEqual(
  pick(detectSourceFormat({ sourceUrl:'https://x/live?id=1' }), ['formatId','mediaFormatId']),
  { formatId:'http-resource', mediaFormatId:'unknown' }
);
assert.equal(detectSourceFormat({ sourceUrl:'foo://host/live.xyz' }).status, 'unknown');
assert.equal(detectSourceFormat({ sourceUrl:'rtsp://host/live' }).status, 'recognized-unsupported');
assert.equal(detectSourceFormat({ sourceUrl:'rtmp://host/live' }).status, 'recognized-unsupported');
```

Also assert STRM/M3U resolver/container capabilities, explicit registered type precedence, unregistered explicit-type fail-closed behavior, and HLS/DASH/direct-media body/content-type detection.

- [ ] **Step 2: Run the RED test**

Run:

```bash
node tests/source-format-registry.test.mjs
```

Expected: FAIL because `src/core/source-format-registry.js` does not exist.

- [ ] **Step 3: Implement the minimal pure registry API**

Implement the exact exported interfaces above in `src/core/source-format-registry.js`.

Required classification shape:

```js
{
  formatId,
  mediaFormatId,
  status,
  confidence,
  explicitType,
  rawScheme,
  rawExtension,
  capabilities,
  verificationMode,
  resolutionMode,
  savePolicy
}
```

Use deterministic descriptor priority. `http-resource` is the fallback only for generic `http:`/`https:` URLs; unsupported/non-HTTP unmatched schemes remain `unknown`.

- [ ] **Step 4: Add future-format extensibility proof**

In the same test file, build a test-only registry with a synthetic descriptor `future-test`, classify a synthetic URL, and assert detection succeeds without adding that descriptor to the production default registry.

- [ ] **Step 5: Run Task 1 tests**

Run:

```bash
node tests/source-format-registry.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/core/source-format-registry.js tests/source-format-registry.test.mjs
git commit -m "feat: add canonical source format registry"
```

---

### Task 2: Frontend Compatibility Wrappers

**Files:**
- Modify: `src/core/utils.js`
- Modify: `tests/source-format-registry.test.mjs`
- Modify: `index.html` import map/cache-bust entries only if required by current module-loading pattern.

**Interfaces:**
- Consumes: `detectSourceFormat()` from Task 1.
- Produces unchanged public helpers: `isHls(url)`, `isDash(url)`, `isVideoFile(url)`.

- [ ] **Step 1: Extend RED parity tests for current helper behavior**

Assert current positive and negative fixtures, including query strings:

```js
assert.equal(isHls('https://x/a.m3u8?token=1'), true);
assert.equal(isDash('https://x/a.mpd?token=1'), true);
assert.equal(isVideoFile('https://x/a.mp4?token=1'), true);
assert.equal(isVideoFile('https://x/a.webm'), true);
assert.equal(isHls('https://x/page.html'), false);
```

- [ ] **Step 2: Run helper parity tests before implementation**

Run the focused test command used by the new registry suite.

Expected: existing helpers pass old behavior, but source inspection/test assertion requiring delegation to the registry fails until migration is made.

- [ ] **Step 3: Replace independent format regex ownership in helpers**

Keep signatures unchanged. Make `isHls`, `isDash`, and `isVideoFile` thin wrappers around canonical registry classification.

Do not change `parseIptvUrl`, header normalization, `cleanUrl`, `workerUrl`, timeout logic, or other utilities.

- [ ] **Step 4: Run focused registry/helper tests**

```bash
node tests/source-format-registry.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run header-aware regression**

```bash
node tests/header-aware-proxy.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/core/utils.js tests/source-format-registry.test.mjs index.html
git commit -m "refactor: route source helpers through format registry"
```

---

### Task 3: Discovery Candidate Model Migration

**Files:**
- Modify: `src/discovery/candidate-model.js`
- Modify: `tests/discovery-candidate.test.mjs`
- Modify: `tests/source-format-registry.test.mjs` only if shared parity assertions belong there.

**Interfaces:**
- Consumes: `detectSourceFormat()`, `toLegacySourceType()`, `listSourceFormats()` from Task 1.
- Produces unchanged Discovery API contracts: `detectCandidateType()`, `createCandidate()`, `SOURCE_TYPES`, verification state handling, and legacy `sourceType` values.

- [ ] **Step 1: Write RED Discovery parity assertions**

Pin current outputs:

```js
assert.equal(detectCandidateType('https://x/live.m3u8'), 'hls');
assert.equal(detectCandidateType('https://x/live.mpd'), 'dash');
assert.equal(detectCandidateType('https://x/file.strm'), 'strm');
assert.equal(detectCandidateType('https://x/list.m3u'), 'm3u');
assert.equal(detectCandidateType('rtsp://x/live'), 'rtsp');
assert.equal(detectCandidateType('rtmp://x/live'), 'rtmp');
assert.equal(detectCandidateType('https://x/live?id=1'), 'direct');
```

Also assert an unregistered explicit type does not become a new known `sourceType`, while registered explicit types remain authoritative.

- [ ] **Step 2: Add source-of-truth RED assertion**

Require `SOURCE_TYPES` to be derived/validated from registry compatibility types plus explicit Discovery-only states (`xtream-preview`, `unknown`) rather than maintaining duplicate format truth.

Run:

```bash
node tests/discovery-candidate.test.mjs
```

Expected: FAIL on the new registry-ownership assertion before migration.

- [ ] **Step 3: Migrate `detectCandidateType()`**

Implement it as a thin compatibility wrapper:

```js
detectCandidateType(sourceUrl='', explicitType='') -> string
```

Use registry classification, then `toLegacySourceType()`.

Preserve special Xtream context behavior in `createCandidate()` and preserve `saveEligible` behavior for RTSP/RTMP.

- [ ] **Step 4: Run Discovery candidate tests**

```bash
node tests/discovery-candidate.test.mjs
node tests/source-format-registry.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run Discovery promotion and Xtream regressions**

```bash
node tests/discovery-promotion.test.mjs
node tests/new-xtream-preview.test.mjs
node tests/authorized-xtream-discovery.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/discovery/candidate-model.js tests/discovery-candidate.test.mjs tests/source-format-registry.test.mjs
git commit -m "refactor: share discovery source format detection"
```

---

### Task 4: Source Verifier Shared Classification

**Files:**
- Modify: `workers/webtv-source-verifier.js`
- Modify: `tests/source-verifier-worker.test.mjs`
- Modify: `tests/discovery-verifier.test.mjs` only where parity assertions are needed.

**Interfaces:**
- Consumes: `detectSourceFormat()`, `classifySourceBody()`, `toLegacySourceType()` from Task 1.
- Produces unchanged Source Verifier HTTP API and verification statuses.

- [ ] **Step 1: Write RED verifier ownership/parity tests**

Pin these behaviors:

- HLS fixture remains `VERIFIED`.
- dead HLS remains `HTTP 404`.
- STRM/M3U remain `UNRESOLVED` before resolution.
- generic HTML remains `FAILED` as unrecognized playable media.
- DRM markers still produce `DRM`.
- generic HTTP transport may map through legacy `direct` verification handling without being canonical direct-media format.
- Worker imports/uses shared registry rather than owning an independent `inferredType()` regex table.

- [ ] **Step 2: Run RED verifier tests**

```bash
node tests/source-verifier-worker.test.mjs
node tests/discovery-verifier.test.mjs
```

Expected: FAIL on shared-registry ownership assertion before migration.

- [ ] **Step 3: Replace format inference/body format duplication**

Keep security helpers (`safeHttpUrl`, private IP blocking, redirect diagnostics, header cleaning), timeout/batch logic, and HTTP response contract unchanged.

Use the shared registry only for format identity/body-media classification.

Do not change verification status names or semantics.

- [ ] **Step 4: Run verifier regression tests**

```bash
node tests/source-verifier-worker.test.mjs
node tests/discovery-verifier.test.mjs
node tests/source-format-registry.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add workers/webtv-source-verifier.js tests/source-verifier-worker.test.mjs tests/discovery-verifier.test.mjs
git commit -m "refactor: share verifier format classification"
```

---

### Task 5: Worker Deployment Dependency and Build Proof

**Files:**
- Modify: `.github/workflows/deploy-source-verifier.yml`
- Modify: `.github/workflows/validate-frontend.yml`
- Test: `tests/source-format-registry.test.mjs`

**Interfaces:**
- Consumes: shared registry import from Tasks 1-4.
- Produces: CI/deploy dependency ensuring registry-only changes validate and redeploy the Source Verifier.

- [ ] **Step 1: Add RED workflow-contract assertions**

Add test assertions that `.github/workflows/deploy-source-verifier.yml` contains `src/core/source-format-registry.js` in `push.paths`, and that frontend validation runs `tests/source-format-registry.test.mjs`.

Run:

```bash
node tests/source-format-registry.test.mjs
```

Expected: FAIL until workflows are updated.

- [ ] **Step 2: Update workflow dependencies**

Add `src/core/source-format-registry.js` to Source Verifier deployment trigger paths.

Add a dedicated Phase E1 registry test step to frontend validation.

- [ ] **Step 3: Prove module syntax/importability locally in CI contract**

Ensure workflow validation checks both registry and Worker module syntax/import compatibility before deployment. Prefer direct ES-module imports. If Wrangler cannot package the shared relative import in the existing deployment model, stop implementation and add an explicit bundle/build step rather than duplicating registry code.

- [ ] **Step 4: Run workflow-contract and focused regression tests**

```bash
node tests/source-format-registry.test.mjs
node tests/source-verifier-worker.test.mjs
node tests/discovery-candidate.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add .github/workflows/deploy-source-verifier.yml .github/workflows/validate-frontend.yml tests/source-format-registry.test.mjs
git commit -m "ci: deploy verifier on format registry changes"
```

---

### Task 6: Full Regression, Browser Gates, PR, Merge, and Production Verification

**Files:**
- No new product behavior unless a regression exposes a real compatibility bug.
- Update cache-bust/import-map references in `index.html` only if needed for browser delivery of the new shared module.
- Canonical `WEBV2_CURRENT.md` update is a separate authenticated checkpoint operation and must follow project CAS/PIN governance.

**Interfaces:**
- Consumes: all Task 1-5 outputs.
- Produces: merged/deployed/verified Phase E1 or an explicit recorded blocker/mismatch.

- [ ] **Step 1: Run focused Phase E1 suite**

```bash
node tests/source-format-registry.test.mjs
node tests/discovery-candidate.test.mjs
node tests/source-verifier-worker.test.mjs
node tests/discovery-verifier.test.mjs
```

Expected: all PASS.

- [ ] **Step 2: Run compatibility regressions most exposed to the migration**

```bash
node tests/header-aware-proxy.test.mjs
node tests/discovery-promotion.test.mjs
node tests/strm-specific-discovery-provider.test.mjs
node tests/import-promotion-contract.test.mjs
node tests/xtream-client.test.mjs
node tests/xtream-preview-routes.test.mjs
node tests/source-ranking.test.mjs
node tests/startup-nonblocking.test.mjs
node tests/frontend-integration.test.mjs
node tests/epg-parity.test.mjs
node tests/channel-identity-core.test.mjs
node tests/channel-profile-core.test.mjs
```

Expected: all PASS.

- [ ] **Step 3: Run browser smoke through existing CI path**

Use the repository's normal `Validate WebTV Frontend` workflow. Do not substitute a paid external browser.

Expected: browser smoke/startup jobs PASS on the exact branch head.

- [ ] **Step 4: Whole-branch review before merge**

Verify:

- no Player fallback rewrite;
- no D1 schema change;
- no M3U/STRM/Enigma2 behavior migration outside stated wrappers;
- no credential logging;
- no weakened verifier URL/private-network security;
- no duplicate registry implementation in Worker;
- Source Hunt duplicate extraction remains explicitly deferred to E2/E3.

- [ ] **Step 5: Open/merge PR only after exact-head CI is green**

Use a PR whose body states the problem, shared-registry solution, non-goals, TDD evidence, and rollback. Merge only after exact-head checks are successful.

- [ ] **Step 6: Verify post-merge workflows on one merge SHA**

Require terminal success for:

- Validate WebTV Frontend;
- Deploy Source Verifier Worker;
- GitHub Pages build/deployment;
- any other Worker workflows triggered by the diff.

- [ ] **Step 7: Verify controlled live Source Verifier probes**

Use the existing deploy workflow's live good/dead probes tied to `$GITHUB_SHA`.

Expected: controlled good HLS fixture -> `VERIFIED`; dead fixture -> `HTTP 404`.

- [ ] **Step 8: Reconcile canonical governance state**

Compare:

```text
checkpoint SHA
GitHub main SHA
deployed SHA
```

If authorized checkpoint access exists, update `WEBV2_CURRENT.md` with Phase C/D evidence, Phase E1 final SHA/status, Source Format Registry ownership, E2/E3 remaining boundaries, TinyFish metering rule, and any remaining mismatch using CAS-safe checkpoint semantics.

If checkpoint authorization is unavailable, record the mismatch explicitly and do not claim E1 is fully canonical.

- [ ] **Step 9: Declare DONE only from fresh evidence**

Phase E1 is DONE only if implementation is merged, deployed, production probes/browser gates are verified, and canonical/checkpoint state is updated or its mismatch is explicitly recorded according to project governance.
