# Phase E3a STRM Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize active STRM parsing around one shared pure structural core while preserving browser playback, Discovery security/budgets, Source Hunt policy, and existing live behavior.

**Architecture:** Extract pure STRM structure helpers into `src/core/strm-core.js`. Keep all network fetch, SSRF/private-host policy, budgets, ranking, reporting, verification, save policy, and playback ownership in caller-specific adapters. Refactor the existing browser `StrmResolver` first, then Source Discovery, then Source Hunt.

**Tech Stack:** JavaScript ES modules, Node test runner scripts, browser modules, Cloudflare Workers, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-30-phase-e3a-strm-normalization-design.md`

## Global Constraints

- Shared STRM core MUST NOT perform network fetches.
- Source Format Registry remains the capability/policy owner for STRM classification.
- Player and Source Verifier remain unchanged in Phase E3a.
- Discovery retains SSRF/private/local-host blocking, subrequest budgets, timeouts, max-body limits, provider reports, freshness semantics, and kill switch.
- Hunt retains search/ranking/relevance, candidate construction, and save/test policy.
- Enigma2 is out of scope until Phase E3b.
- DRM parsing is metadata-only; Phase E3a does not implement DRM playback.
- DONE requires implementation + deployment + live verification.

## Review Focus

1. A STRM media line with `|User-Agent=...&Referer=...&Origin=...` preserves the same final URL and supported headers.
2. Nested `.strm -> .strm -> media` preserves DRM inheritance and caller depth limits.
3. GitHub `blob` references normalize to raw URLs without performing fetch or security decisions in the shared core.
4. Private/local targets remain blocked by Discovery after shared-core migration, including nested targets.
5. Browser resolver cache/failure TTL/in-flight dedupe semantics remain unchanged after parser extraction.

---

### Task 1: Shared Pure STRM Core

**Files:**
- Create: `src/core/strm-core.js`
- Create: `tests/strm-core.test.mjs`
- Modify: `.github/workflows/validate-frontend.yml`

**Interfaces:**
- Produces: `canonicalizeStrmReference(value)`, `isStrmReference(value)`, `parseKodiHeaderSuffix(value)`, `parseStrmDocument(text)`, and only if tests prove necessary `classifyStrmTarget(value)`.
- Consumes: no network API and no caller policy.

- [ ] **Step 1: Write failing pure-core tests**

Cover:
- empty/malformed input;
- plain `.strm` recognition with query strings;
- GitHub `blob` to raw normalization;
- first non-comment HTTP(S) media/reference line;
- `#KODIPROP:inputstream.adaptive.license_type` and `license_key` case-insensitively;
- Kodi `User-Agent`, `Referer`/`Referrer`, and `Origin` suffix parsing;
- ordered `directives` / `valueLines` metadata sufficient for later parity;
- no network side effects.

- [ ] **Step 2: Run the new core test and verify RED**

Run: `node tests/strm-core.test.mjs`
Expected: FAIL because `src/core/strm-core.js` does not exist or exports are missing.

- [ ] **Step 3: Implement the minimal pure core**

Keep URL normalization and parsing deterministic. Do not import `fetch`, Worker policy, Source Format Registry, save policy, verifier policy, or Player logic.

- [ ] **Step 4: Run core + Phase E1/E2 regressions**

Run:
- `node tests/strm-core.test.mjs`
- `node tests/source-format-registry.test.mjs`
- `node tests/m3u-container-core.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add shared STRM structural core"`

---

### Task 2: Browser StrmResolver Parity Migration

**Files:**
- Modify: `src/core/strm-resolver.js`
- Create: `tests/strm-resolver-parity.test.mjs`
- Modify if cache-bust is required: `index.html`

**Interfaces:**
- Consumes: Task 1 pure STRM helpers.
- Produces: existing `StrmResolver` and `isStrmReference` public behavior unchanged for current consumers.

- [ ] **Step 1: Write browser/runtime parity tests before refactor**

Pin:
- plain STRM -> HLS;
- STRM -> DASH;
- nested STRM;
- GitHub blob normalization;
- DRM metadata extraction/inheritance;
- success cache;
- failure TTL behavior;
- in-flight deduplication;
- malformed/non-STRM behavior;
- header-bearing media line metadata if currently observable.

- [ ] **Step 2: Add an ownership assertion and verify RED**

The test must prove `strm-resolver.js` still owns a local STRM document parser before migration, while behavioral assertions remain green.

- [ ] **Step 3: Refactor `strm-resolver.js` onto Task 1 helpers**

Preserve constructor, `resolve()`, `peek()`, `peekInfo()`, `inspect()`, recursion depth, cache semantics, and error behavior. Keep fetch/timeout/cache/in-flight logic in this adapter.

- [ ] **Step 4: Run browser/runtime regressions**

Run:
- `node tests/strm-core.test.mjs`
- `node tests/strm-resolver-parity.test.mjs`
- `node tests/startup-nonblocking.test.mjs`
- `node tests/frontend-integration.test.mjs`
- existing browser smoke gate through frontend CI

Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "refactor: migrate browser STRM resolver to shared core"`

---

### Task 3: Source Discovery STRM Security/Parity Migration

**Files:**
- Modify: `workers/source-discovery/strm-specific-discovery.js`
- Extend or create: `tests/strm-specific-discovery-provider.test.mjs`
- Create if clearer separation is needed: `tests/source-discovery-strm-parity.test.mjs`

**Interfaces:**
- Consumes: shared STRM structural helpers.
- Produces: unchanged provider API and reports for `strm-specific-discovery`.

- [ ] **Step 1: Expand RED parity/security fixtures**

Pin:
- duplicate reference collapse;
- nested chain depth/reporting;
- Kodi headers;
- DRM detection;
- GitHub blob normalization;
- direct and nested private/local target rejection;
- `STRM_MAX_SUBREQUESTS`, `STRM_MAX_DEPTH`, `STRM_MAX_BODY_BYTES`, and timeout ownership remain local;
- candidate/report shape and `freshnessApplied === false` remain unchanged.

- [ ] **Step 2: Add ownership assertion and verify RED**

Prove the provider still owns its own STRM document parser/canonicalization before migration.

- [ ] **Step 3: Replace only shared structural logic**

Keep `canonicalHttpUrl` security validation or its caller-local equivalent around every fetchable reference/target. Do not move private-host checks into the shared core. Keep budgets, fetch headers, reporting, source-type mapping, and provider metadata local.

- [ ] **Step 4: Run Discovery suite**

Run at minimum:
- `node tests/strm-core.test.mjs`
- `node tests/strm-specific-discovery-provider.test.mjs`
- `node tests/source-discovery-worker.test.mjs`
- `node tests/curated-remote-feeds.test.mjs`
- `node tests/discovery-external.test.mjs`
- all provider tests already in `deploy-source-discovery.yml`

Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "refactor: migrate Discovery STRM parsing to shared core"`

---

### Task 4: Source Hunt STRM Parity Migration

**Files:**
- Modify: `workers/source-huntatonisworkersdev.js`
- Create: `tests/source-hunt-strm-parity.test.mjs`

**Interfaces:**
- Consumes: shared STRM structural helpers.
- Produces: existing Hunt candidate resolution semantics, ranking/relevance ownership, and save/test policy.

- [ ] **Step 1: Write Hunt STRM parity test**

Pin the current accepted final media types, failure behavior, caller timeout/budget ownership, no new automatic save behavior, and no ranking/relevance movement into shared core.

- [ ] **Step 2: Verify RED ownership assertion**

Behavior fixtures should pass before migration while the test fails because the Worker still owns independent STRM document parsing.

- [ ] **Step 3: Migrate structural parsing only**

Keep Hunt fetch policy, ranking, relevance, candidate construction, and eligibility local.

- [ ] **Step 4: Run Hunt regressions**

Run:
- `node tests/strm-core.test.mjs`
- `node tests/source-hunt-strm-parity.test.mjs`
- `node tests/source-hunt-m3u-parity.test.mjs`
- existing Source Hunt validation tests

Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "refactor: migrate Source Hunt STRM parsing to shared core"`

---

### Task 5: Workflow and Deployment Wiring

**Files:**
- Modify: `.github/workflows/validate-frontend.yml`
- Modify: `.github/workflows/deploy-source-discovery.yml`
- Modify: `.github/workflows/deploy-source-hunt.yml`
- Extend: `tests/strm-core.test.mjs` or create a narrow workflow-contract test if preferable

**Interfaces:**
- Consumes: Tasks 1-4 tests/modules.
- Produces: CI/deploy triggers that cannot miss shared STRM core changes.

- [ ] **Step 1: Write RED workflow contract assertions**

Require:
- frontend validation runs shared STRM core + browser parity tests;
- Discovery deploy watches `src/core/strm-core.js` and runs STRM provider/parity tests;
- Hunt deploy watches `src/core/strm-core.js` and runs Hunt STRM parity test;
- existing live Discovery ERT1 STRM gate remains present;
- existing Hunt live verification remains present.

- [ ] **Step 2: Verify RED**

Expected: FAIL until workflow paths/test commands are wired.

- [ ] **Step 3: Add minimal workflow wiring**

Do not weaken or remove existing live checks.

- [ ] **Step 4: Verify workflow contract + full frontend validation**

Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "ci: wire shared STRM core into validation and deploys"`

---

### Task 6: Duplicate-Parser Audit and Brain State

**Files:**
- Modify: `WEBV2_ARCHITECTURE.md`
- Modify: `WEBV2_DECISIONS.md`
- Modify: `WEBV2_CLEANUP.md`
- Modify: `WEBV2_ROADMAP.md`
- Modify only if evidence warrants: `WEBV2_LESSONS.md`, `WEBV2_PLAYBOOKS.md`, `WEBV2_TOOLING.md`

**Interfaces:**
- Consumes: completed migration evidence.
- Produces: explicit STRM ownership and CLEAN-004 partial-resolution state.

- [ ] **Step 1: Repo-wide audit for active independent STRM parsers**

Search active `src/**` and `workers/**` for `.strm`, `#KODIPROP`, local `parseStrm*`, GitHub blob normalization, and STRM media-line scans. Classify each hit as shared core, adapter policy, test fixture, compatibility surface, or duplicate parser.

- [ ] **Step 2: Block closure if an active duplicate parser remains**

Do not mark STRM resolved while any approved active caller still owns an independent STRM document parser.

- [ ] **Step 3: Update Brain owners**

Record:
- shared STRM structural ownership;
- caller-owned network/security/product policy;
- `CLEAN-004`: STRM RESOLVED only after live verification, Enigma2 PENDING/E3b;
- roadmap next action E3b after E3a closure.

- [ ] **Step 4: Commit**

`git commit -m "docs: record Phase E3a STRM ownership"`

---

### Task 7: Full Verification, Review, Merge, Deploy, Closure

**Files:**
- Modify after verified deployment: `WEBV2_CURRENT.md`
- Finalize affected Brain owners from Task 6 with exact evidence.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified E3a production state and next-safe-action E3b.

- [ ] **Step 1: Run full regression suite**

Must include Phase E1, E2, STRM core, browser/runtime, Discovery, Hunt, browser smoke, startup, and frontend integration gates.

- [ ] **Step 2: Whole-branch review**

Focus on security boundary drift, header/DRM loss, recursion/depth changes, browser cache semantics, and accidental Enigma2 scope expansion.

- [ ] **Step 3: Open PR and require exact-head CI success**

Do not merge a different head than the reviewed/green SHA.

- [ ] **Step 4: Merge and capture exact merge SHA**

- [ ] **Step 5: Verify deployments at the merge SHA**

Required where changed:
- Frontend/Pages;
- Source Discovery Worker;
- Source Hunt Worker.

Source Discovery live proof MUST retain the real ERT1 STRM gate and show at least one successful resolution/candidate at the deployed SHA.

Source Hunt live verification MUST remain intact if Hunt Worker changed.

- [ ] **Step 6: Update canonical GitHub CURRENT on a docs-only closure branch**

Record exact merge SHA, workflow numbers, live verification evidence, E3a DONE, `CLEAN-004` STRM resolved / Enigma2 pending, and next safe action E3b.

- [ ] **Step 7: Merge closure and read back `main/WEBV2_CURRENT.md`**

DONE only after the canonical readback matches verified production reality.

---

## Execution Notes

- Use `superpowers:executing-plans` for native execution or `superpowers:subagent-driven-development` if execution mode changes.
- Use `superpowers:test-driven-development` before every implementation task.
- Use `superpowers:systematic-debugging` for unexpected failures.
- Use `superpowers:requesting-code-review` before merge.
- Use `superpowers:verification-before-completion` before any DONE claim.
- If parity reveals that the shared core needs extra neutral ordered structure, enrich the pure result rather than moving caller policy into the core. If that changes ownership materially, reconcile against the approved spec before continuing.
