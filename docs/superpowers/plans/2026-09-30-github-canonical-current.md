# GitHub-Canonical Current-State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `main/WEBV2_CURRENT.md` the single canonical WebV2 current-state truth while retaining Registry/D1 `WEBV2_CURRENT.md` as mirror/history/fallback.

**Architecture:** This is a governance ownership migration, not a runtime feature change. The repository Brain becomes self-contained for current-state truth; `/api/project-status` remains deployment truth, and D1 checkpoints remain operational/history infrastructure without outranking GitHub CURRENT.

**Tech Stack:** Markdown Project Brain documents, Node.js contract tests, GitHub Actions, GitHub repository/PR workflow, Registry/D1 checkpoint readback.

**Spec:** `docs/superpowers/specs/2026-09-30-github-canonical-current-design.md`

## Global Constraints

- GitHub `main/WEBV2_CURRENT.md` is the only canonical current-state document after migration.
- Registry/D1 `WEBV2_CURRENT.md` remains mirror/history/fallback and must not override GitHub CURRENT.
- `/api/project-status` remains Registry deployment truth.
- Component workflow/deploy evidence remains authoritative for its own component.
- Do not change My Playlist, Favorites, Saved Playlist, Player, Discovery, Hunt, Verifier, EPG, Xtream, M3U, STRM, Enigma2, PIN, or project-agent runtime behavior.
- Keep existing checkpoint/history infrastructure intact.
- DONE still means implemented + deployed + actually verified.

## Review Focus

- GitHub CURRENT must not accidentally imply that `main` equals production without workflow/live proof.
- No active Brain owner file may still state that Registry/D1 CURRENT is canonical.
- D1 mirror failure/staleness must be reported as mirror status, not canonical unavailability.
- Application-state D1 ownership must remain unchanged.
- Historical checkpoint evidence must remain preserved and usable after the ownership flip.

---

### Task 1: Invert the Project Brain current-state contract

**Files:**
- Modify: `tests/project-brain-docs.test.mjs`

**Interfaces:**
- Consumes: approved design ownership rules.
- Produces: RED/GREEN contract for GitHub-canonical CURRENT ownership.

- [ ] **Step 1: Write failing assertions**
  Require that `WEBV2_CURRENT.md`:
  - declares GitHub `main/WEBV2_CURRENT.md` canonical;
  - contains real current-state sections such as current version/status/next safe action;
  - does not describe itself as pointer-only or non-canonical;
  - records Registry/D1 CURRENT as mirror/history/fallback.

  Require that `WEBV2_MANUAL.md`, `WEBV2_PROJECT_BRAIN.md`, `WEBV2_PLAYBOOKS.md`, `WEBV2_DECISIONS.md`, and `WEBV2_ARCHITECTURE.md` agree with that ownership.

- [ ] **Step 2: Run RED contract**
  Run: `node tests/project-brain-docs.test.mjs`
  Expected: FAIL against the current pointer/manual ownership wording.

- [ ] **Step 3: Commit RED evidence**
  Commit message: `test: require GitHub canonical current state`

---

### Task 2: Replace the GitHub pointer with real canonical CURRENT

**Files:**
- Modify: `WEBV2_CURRENT.md`

**Interfaces:**
- Consumes: verified Phase E2 and Project Brain closure evidence.
- Produces: canonical current-state document on the migration branch.

- [ ] **Step 1: Replace pointer content with compact real state**
  Record at minimum:
  - canonical source = GitHub `main/WEBV2_CURRENT.md`;
  - current project/Brain closure SHA `8e87d80a94c5143c9be5c0e240cebc4c26da37e2` as the pre-migration verified base;
  - Phase E2 runtime merge `06383089b6fd7b4a31c468c46c7dd2c21ddfdb14` and verified workflow evidence;
  - Phase E2 DONE;
  - CLEAN-003 resolved;
  - Phase E3 as next safe runtime phase, not started;
  - D1 CURRENT mirror currently stale at SHA-256 `eb1c9237faae25be32265aa19049b7b7d4e5b626ac45f45d5ee35b5adf9905f1` until resynced.

- [ ] **Step 2: Keep CURRENT compact**
  Do not duplicate long history already owned by Roadmap/Decisions/Lessons/specs.

- [ ] **Step 3: Run focused contract**
  Run: `node tests/project-brain-docs.test.mjs`
  Expected: still FAIL until all ownership owners are migrated.

- [ ] **Step 4: Commit**
  Commit message: `docs: make GitHub current state canonical`

---

### Task 3: Migrate all active Brain ownership wording

**Files:**
- Modify: `WEBV2_MANUAL.md`
- Modify: `WEBV2_ARCHITECTURE.md`
- Modify: `WEBV2_DECISIONS.md`
- Modify: `WEBV2_PLAYBOOKS.md`
- Modify: `WEBV2_PROJECT_BRAIN.md`
- Modify: `WEBV2_LESSONS.md`
- Modify if needed: `WEBV2_TOOLING.md`

**Interfaces:**
- Consumes: Task 2 canonical CURRENT ownership.
- Produces: consistent Project Brain ownership model with D1 mirror semantics.

- [ ] **Step 1: Update Manual preflight and source-of-truth ownership**
  New order: Manual → GitHub CURRENT → `/api/project-status` → D1 mirror metadata when available → GitHub main → relevant workflows/deploy evidence.

- [ ] **Step 2: Update Architecture**
  Keep Registry/D1 ownership of application persistence, checkpoint/history infrastructure, and deploy status; move canonical Project Brain current-state ownership to GitHub CURRENT.

- [ ] **Step 3: Add durable Decision**
  Decision must state GitHub CURRENT canonical, Registry/D1 CURRENT mirror/history/fallback, with reason/consequences/reconsideration condition.

- [ ] **Step 4: Update Playbooks**
  Canonical read/write procedure becomes GitHub branch/PR/CI/merge/readback. Keep CAS checkpoint procedure for mirror sync and checkpoint maintenance.

- [ ] **Step 5: Update Project Brain index and Lessons**
  Index points to GitHub CURRENT as owner. Lesson records the E2 drift case that motivated the migration.

- [ ] **Step 6: Update Tooling only if ownership instructions there are stale**
  Prefer GitHub connector/API for canonical CURRENT; Registry/browser routes remain for mirror inspection/sync.

- [ ] **Step 7: Run focused contract**
  Run: `node tests/project-brain-docs.test.mjs`
  Expected: PASS.

- [ ] **Step 8: Commit**
  Commit message: `docs: migrate current-state ownership to GitHub`

---

### Task 4: Contradiction audit and full validation

**Files:**
- Inspect: all active `WEBV2_*.md`
- Inspect: `tests/project-brain-docs.test.mjs`
- No runtime files should change.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: proof that no active Brain owner contradicts the new ownership.

- [ ] **Step 1: Search active Brain docs for stale authority wording**
  Search for combinations such as `canonical`, `Registry/D1`, `pointer`, `current truth`, and `/api/project-agent/checkpoints/WEBV2_CURRENT.md`.

- [ ] **Step 2: Classify every remaining D1 CURRENT reference**
  It must be mirror/history/fallback, operational route documentation, or historical evidence. No active instruction may say it outranks GitHub CURRENT.

- [ ] **Step 3: Run Project Brain contract**
  Run: `node tests/project-brain-docs.test.mjs`
  Expected: PASS.

- [ ] **Step 4: Run full frontend validation suite**
  Use the repository’s `Validate WebTV Frontend` workflow on the branch/PR and require SUCCESS. No runtime regression is expected from docs/test-only ownership changes.

- [ ] **Step 5: Review branch diff**
  Confirm there are no `src/**` or `workers/**` behavior changes.

- [ ] **Step 6: Commit any audit-only wording corrections**
  Commit message if needed: `docs: reconcile GitHub canonical wording`

---

### Task 5: PR, merge, exact readback, and post-merge verification

**Files:**
- No new runtime files.

**Interfaces:**
- Consumes: fully green migration branch.
- Produces: canonical ownership transition on `main`.

- [ ] **Step 1: Open PR**
  PR must explain the ownership flip, non-goals, D1 preservation, and stale-mirror evidence.

- [ ] **Step 2: Require PR validation SUCCESS**
  Confirm the Project Brain contract and full validation on the exact PR head.

- [ ] **Step 3: Merge only after review gate**
  Record exact merge SHA.

- [ ] **Step 4: Read back `main/WEBV2_CURRENT.md` from GitHub**
  Verify the merged file explicitly declares GitHub canonical ownership and contains the expected current state.

- [ ] **Step 5: Verify post-merge workflows**
  Check the workflows triggered by the documentation change, including frontend validation, Registry deploy if triggered, and Pages if triggered. Compare exact SHA rather than assuming all components redeployed.

- [ ] **Step 6: Record the migration closure SHA inside CURRENT if the initial canonical content still references only the pre-migration base**
  If needed, use a small docs-only closure PR rather than silently editing `main`.

---

### Task 6: D1 mirror status and optional synchronization

**Files:**
- GitHub CURRENT may receive a final mirror-status update only if the status materially changes.
- No checkpoint schema/runtime changes.

**Interfaces:**
- Consumes: merged GitHub canonical CURRENT.
- Produces: truthful D1 mirror status without making mirror sync a canonical gate.

- [ ] **Step 1: Read D1 checkpoint metadata/content after GitHub migration**
  Record mirror SHA and updated time.

- [ ] **Step 2: Attempt mirror sync only through the existing CAS-protected checkpoint path if practical**
  Never blind overwrite. If tool support/session prevents sync, stop and record the mirror as stale.

- [ ] **Step 3: Verify mirror readback if sync succeeds**
  Require new checkpoint SHA and full content match to the intended mirrored snapshot.

- [ ] **Step 4: Preserve historical evidence**
  Do not delete checkpoint history or project-agent editor/routes.

- [ ] **Step 5: Final DONE check**
  Migration is DONE when GitHub canonical ownership is merged/read back, Brain contracts and post-merge validation are green, and D1 mirror status is truthfully recorded. Mirror synchronization itself is not required to make GitHub CURRENT canonical.
