# Phase C EPG Profile Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Greek EPG identity matching away from the legacy EPG family-prefix matcher and duplicate EPG consumption of `CHANNEL_ALIASES` into shared Greek identity plus Channel Profile EPG metadata, preserving programme output semantics while failing closed on documented sibling collisions.

**Architecture:** Keep XMLTV fetching, parsing, programme storage, current/next selection, progress, and time formatting in `EpgService`. Replace only the EPG identity resolution layer: exact feed values are indexed to stable shared identity IDs; channel resolution uses `resolveGreekIdentity()` and Channel Profile EPG aliases. Channel Profiles may carry EPG-specific aliases while remaining `status:'pending'` unless availability is independently verified. The existing `CHANNEL_ALIASES` export remains unchanged for `SourceRegistry` playback source lookup; Phase C only removes EPG's dependency on it.

**Tech Stack:** JavaScript ES modules, Node.js regression tests, GitHub Actions.

**Spec:** Canonical `WEBV2_CURRENT.md` Phase C NEXT STEP plus `tests/fixtures/epg-phase-c-parity.mjs` baseline merged at `45e60f2af6438f7a11fa618dba3b18a9582e6f5c`.

## Global Constraints

- Preserve XMLTV fetch/parse and programme output semantics.
- Do not change playback.
- Do not combine Phase D/import-promotion work.
- Shared Greek identity owns channel recognition and sibling rejection for EPG.
- Channel Profile owns EPG-specific aliases/metadata.
- Do not mark EPG metadata `available` without independent source/ID verification.
- Known unsafe legacy matches must become exact or fail closed, not be preserved as parity.
- Preserve `SourceRegistry`'s existing `CHANNEL_ALIASES` dependency because it belongs to playback/source lookup and is outside this EPG migration.

## Review Focus

- `MEGA News` resolves its own guide when the feed exposes a MEGA News identity and never borrows MEGA.
- `ANT1 Comedy` and `ANT1+ Sports 1` never borrow ANT1.
- regional STAR never borrows national STAR.
- ERT Sports 1–4 remain distinct from each other and from ERT1/2/3.
- Unknown channels remain empty and current/next/progress output remains unchanged.
- Playback SourceRegistry alias lookup remains unchanged.

---

### Task 1: Turn Phase C target contract RED

**Files:**
- Modify: `tests/epg-parity.test.mjs`
- Modify: `tests/frontend-integration.test.mjs`

- [x] Add assertions for the Phase C expected resolution values already stored in the parity fixture.
- [x] Require EPG-specific aliases to live in Channel Profiles for the legacy EPG alias set.
- [x] Require `epg.js` to consume shared identity + Channel Profile and no longer import `CHANNEL_ALIASES`.
- [x] Run CI and confirm RED against the legacy implementation for the intended ownership/fail-closed reasons.

### Task 2: Move EPG metadata ownership to Channel Profiles

**Files:**
- Modify: `src/core/channel-profile-gr.js`

- [x] Add a pending EPG metadata helper accepting aliases without claiming source availability.
- [x] Copy the existing Greek EPG-specific alias values into the corresponding profiles as the EPG-owned metadata source.
- [x] Keep the config `CHANNEL_ALIASES` export unchanged for `SourceRegistry`; assert that `epg.js` no longer consumes it.
- [x] Keep profile validation strict and EPG statuses pending unless independently verified.

### Task 3: Replace legacy EPG matcher with exact shared identity indexing

**Files:**
- Modify: `src/core/epg.js`

- [x] Keep `epgVariants()` only for benign formatting cleanup.
- [x] Index raw/cleaned feed IDs and display names exactly by normalized value.
- [x] Additionally index feed values by stable `resolveGreekIdentity(...).id` when shared identity recognition succeeds.
- [x] Resolve a channel by stable shared identity first, then profile EPG aliases and exact raw values.
- [x] Remove EPG family-prefix matching.
- [x] Keep fetch/merge/finalize/get output code otherwise unchanged.

### Task 4: GREEN, review, deploy

**Files:**
- Modify: `index.html` for core-module cache bust only.

- [x] Run full frontend validation and require EPG parity, Channel Identity/Profile, playback regression, browser smoke, startup, and integration audit all green on the implementation tree.
- [x] Review diff for no playback implementation / Phase D changes.
- [ ] Re-run full validation after this final documentation correction and require green CI on the exact merge head.
- [ ] Merge only after green CI.
- [ ] Verify main validation, Registry deploy, and Pages deployment on the merge SHA.
- [ ] Update canonical `WEBV2_CURRENT.md` when a no-paid-TinyFish checkpoint write path is available; include the project rule to avoid paid TinyFish Agent/Browser unless the user explicitly authorizes it.
