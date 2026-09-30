# Phase C EPG Profile Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Greek EPG identity matching from the legacy matcher/`CHANNEL_ALIASES` into shared Greek identity plus Channel Profile EPG metadata, preserving programme output semantics while failing closed on documented sibling collisions.

**Architecture:** Keep XMLTV fetching, parsing, programme storage, current/next selection, progress, and time formatting in `EpgService`. Replace only the identity resolution layer: exact feed values are indexed to stable shared identity IDs; channel resolution uses `resolveGreekIdentity()` and Channel Profile EPG aliases. Channel Profiles may carry EPG-specific aliases while remaining `status:'pending'` unless availability is independently verified.

**Tech Stack:** JavaScript ES modules, Node.js regression tests, GitHub Actions.

**Spec:** Canonical `WEBV2_CURRENT.md` Phase C NEXT STEP plus `tests/fixtures/epg-phase-c-parity.mjs` baseline merged at `45e60f2af6438f7a11fa618dba3b18a9582e6f5c`.

## Global Constraints

- Preserve XMLTV fetch/parse and programme output semantics.
- Do not change playback.
- Do not combine Phase D/import-promotion work.
- Shared Greek identity owns channel recognition and sibling rejection.
- Channel Profile owns EPG-specific aliases/metadata.
- Do not mark EPG metadata `available` without independent source/ID verification.
- Known unsafe legacy matches must become exact or fail closed, not be preserved as parity.

## Review Focus

- `MEGA News` resolves its own guide when the feed exposes a MEGA News identity and never borrows MEGA.
- `ANT1 Comedy` and `ANT1+ Sports 1` never borrow ANT1.
- regional STAR never borrows national STAR.
- ERT Sports 1–4 remain distinct from each other and from ERT1/2/3.
- Unknown channels remain empty and current/next/progress output remains unchanged.

---

### Task 1: Turn Phase C target contract RED

**Files:**
- Modify: `tests/epg-parity.test.mjs`
- Modify: `tests/channel-profile-core.test.mjs`
- Modify: `tests/frontend-integration.test.mjs`

- [ ] Add assertions for the Phase C expected resolution values already stored in the parity fixture.
- [ ] Require EPG-specific aliases to live in Channel Profiles for the legacy alias set.
- [ ] Require `epg.js` to consume shared identity + Channel Profile and no longer import `CHANNEL_ALIASES`.
- [ ] Run CI and confirm RED against the legacy implementation for the intended ownership/fail-closed reasons.

### Task 2: Move EPG metadata ownership to Channel Profiles

**Files:**
- Modify: `src/core/channel-profile-gr.js`
- Modify: `src/config.js`

- [ ] Add a pending EPG metadata helper accepting aliases without claiming source availability.
- [ ] Move the existing Greek EPG-specific alias values from `CHANNEL_ALIASES` into the corresponding profiles.
- [ ] Remove `CHANNEL_ALIASES` from config after no runtime consumer remains.
- [ ] Keep profile validation strict and EPG statuses pending unless independently verified.

### Task 3: Replace legacy EPG matcher with exact shared identity indexing

**Files:**
- Modify: `src/core/epg.js`

- [ ] Keep `epgVariants()` only for benign formatting cleanup.
- [ ] Index raw/cleaned feed IDs and display names exactly by normalized value.
- [ ] Additionally index feed values by stable `resolveGreekIdentity(...).id` when exact shared identity recognition succeeds.
- [ ] Resolve a channel by stable shared identity first, then profile EPG aliases and exact raw values.
- [ ] Never use prefix family matching for Greek EPG resolution.
- [ ] Keep fetch/merge/finalize/get output code otherwise unchanged.

### Task 4: GREEN, review, deploy

**Files:**
- No new subsystem.

- [ ] Run full frontend validation and require EPG parity, Channel Identity/Profile, browser smoke, startup, and integration audit all green.
- [ ] Review diff for no playback/Phase D changes.
- [ ] Merge only after green CI.
- [ ] Verify main validation, Registry deploy, and Pages deployment on the merge SHA.
- [ ] Update canonical `WEBV2_CURRENT.md` when a no-paid-TinyFish checkpoint write path is available; include the project rule to avoid paid TinyFish Agent/Browser unless the user explicitly authorizes it.
