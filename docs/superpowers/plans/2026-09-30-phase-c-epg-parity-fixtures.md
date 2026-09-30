# Phase C EPG Parity Fixtures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Freeze the current Greek EPG matching/output behavior before any Phase C ownership migration, while explicitly documenting unsafe legacy collisions that the migration must fail closed.

**Architecture:** This prerequisite changes tests only. It seeds the existing `EpgService` public indexes/program map directly in Node so the current private resolver is exercised without browser/XML parsing dependencies. A fixture separates behavior that must remain identical from known unsafe legacy matches that Phase C must intentionally eliminate.

**Tech Stack:** JavaScript ES modules, Node.js built-ins, GitHub Actions.

**Spec:** Registry canonical `WEBV2_CURRENT.md` Phase C NEXT STEP.

## Global Constraints

- Do not change playback behavior.
- Do not move EPG ownership to Channel Profile in this prerequisite.
- Preserve current matching/output behavior where safe.
- Record unsafe legacy collisions instead of silently preserving them.
- Phase D/import-promotion work is out of scope.

## Review Focus

- `MEGA News` must be recorded as a current unsafe collision with `MEGA`, not normalized into a false parity success.
- ANT1 sibling channels such as `ANT1 Comedy` must be represented as fail-closed targets for the later migration.
- Exact ERT Sports identities must remain distinct from ERT1/ERT2/ERT3.
- Unknown channels must produce `{ current:null, next:[] }` rather than borrowing another channel's guide.
- Current/next programme selection and the 3-item next limit must be locked with a deterministic clock.

---

### Task 1: Capture current matching parity

**Files:**
- Create: `tests/fixtures/epg-phase-c-parity.mjs`
- Create: `tests/epg-parity.test.mjs`

**Interfaces:**
- Consumes: existing `EpgService` and `CONFIG.maxNextPrograms` behavior.
- Produces: immutable Phase C parity fixture and executable baseline assertions.

- [ ] Write fixture rows for all 24 My Playlist channel identities plus explicit unsafe legacy collision rows.
- [ ] Seed `EpgService.resolveIndex`, `programKeyIndex`, and `programs` without changing production code.
- [ ] Assert current legacy resolution for the 24-channel baseline.
- [ ] Assert known unsafe collision observations separately from the desired Phase C fail-closed contract.
- [ ] Assert deterministic current/next/progress behavior and unknown-channel empty output.

### Task 2: Make parity capture a permanent CI gate

**Files:**
- Modify: `.github/workflows/validate-frontend.yml`
- Modify: `tests/frontend-integration.test.mjs`

**Interfaces:**
- Consumes: `tests/epg-parity.test.mjs`.
- Produces: required CI enforcement for every future EPG/runtime change.

- [ ] Add a named `Run EPG parity regression test` step.
- [ ] Assert from the integration audit that the workflow executes the parity test.
- [ ] Run full frontend validation and require all existing regressions to remain green.

### Task 3: Integration boundary

**Files:**
- No production file changes in this prerequisite.

- [ ] Review the diff and verify `src/core/epg.js`, `src/core/channel-profile-gr.js`, playback code, and imports are unchanged.
- [ ] Merge only after green CI.
- [ ] Treat Phase C migration itself as a separate bounded change that consumes these fixtures.
