# WebV2 GitHub-Canonical Current-State Design

Date: 2026-09-30
Status: DESIGN REVIEW
Base GitHub main SHA: `8e87d80a94c5143c9be5c0e240cebc4c26da37e2`

## 1. Problem

`WEBV2_CURRENT.md` currently has split ownership:

- The GitHub repository file is intentionally only a pointer.
- The canonical current-state content lives in Registry/D1.
- Routine current-state updates therefore depend on a project-agent/admin checkpoint write path and CAS handling.
- The project has already experienced a real drift case where GitHub main and verified production advanced to Phase E2 while the D1 canonical CURRENT still described the Project Brain bootstrap and Phase E2 as the next step.
- Reading the Registry checkpoint is also more tool-dependent than reading GitHub. Some fetch clients can reach `workers.dev` but do not expose the raw response body, and generic browser automation may not support the write method required by the checkpoint API.

This makes the most frequently consulted Project Brain artifact harder to maintain than the rest of the Brain and creates unnecessary source-of-truth friction.

## 2. Decision

Move canonical current-state ownership to the repository root file:

`WEBV2_CURRENT.md`

After migration:

- **GitHub `WEBV2_CURRENT.md` on `main` is the single canonical current-state truth.**
- Registry/D1 `WEBV2_CURRENT.md` is retained as a mirror/history/operational fallback, not as the authority that overrides GitHub.
- `/api/project-status` remains Registry deployment truth and is still compared with GitHub current state.
- Component-specific workflow/deployment evidence remains authoritative for the component it verifies.
- A stale D1 mirror is a mirror-sync issue, not a reason to treat GitHub CURRENT as stale.

The project therefore distinguishes three concepts:

1. **Canonical project current state** → GitHub `WEBV2_CURRENT.md` on `main`.
2. **Registry deployment truth** → `/api/project-status`.
3. **Historical/mirrored checkpoint state** → Registry/D1 project checkpoint `WEBV2_CURRENT.md`.

## 3. Why GitHub Becomes Canonical

GitHub is already the canonical home for:

- `WEBV2_MANUAL.md`
- `WEBV2_ROADMAP.md`
- `WEBV2_ARCHITECTURE.md`
- `WEBV2_PLAYBOOKS.md`
- `WEBV2_TOOLING.md`
- `WEBV2_DECISIONS.md`
- `WEBV2_LESSONS.md`
- `WEBV2_CLEANUP.md`
- implementation specs/plans
- test and deployment evidence references

Making CURRENT canonical in GitHub gives the Project Brain one versioned, reviewable, diffable knowledge system. It also allows current-state updates to use the same branch/PR/review/CI mechanisms already used for the rest of the Brain.

The D1 checkpoint remains useful for:

- historical checkpoint records;
- portable fallback access outside GitHub;
- recovery/reference if GitHub access is unavailable;
- preserving the existing checkpoint subsystem without deleting it prematurely.

## 4. New Source-of-Truth Rules

### 4.1 Canonical CURRENT

Canonical current-state content is the exact content of:

`tonis1000/WebV2:main/WEBV2_CURRENT.md`

Only content merged to `main` is canonical. A branch copy is proposed state, not current truth.

### 4.2 Live Reality Still Wins Reconciliation

GitHub CURRENT is the documentation authority, but documentation can still become stale relative to real deployment.

If GitHub CURRENT conflicts with verified live evidence:

1. stop new implementation;
2. inspect GitHub main, relevant workflows/deploys, `/api/project-status`, and component-specific evidence;
3. determine actual verified reality;
4. update GitHub `WEBV2_CURRENT.md` through the normal branch/PR process;
5. update affected Brain owners if the mismatch revealed reusable knowledge;
6. optionally resync the D1 mirror.

This keeps the rule: documentation describes reality, it does not redefine production by assertion.

### 4.3 Registry/D1 Mirror

The Registry/D1 `WEBV2_CURRENT.md` checkpoint becomes a **mirror/history surface**.

Rules:

- It must not outrank GitHub CURRENT.
- Its SHA is mirror/checkpoint metadata, not project-current authority.
- A mirror mismatch is recorded during preflight but does not block unrelated work if GitHub CURRENT and live deployment evidence are available and consistent.
- Mirror synchronization should use the existing CAS-protected checkpoint write path when practical.
- Failure to update the mirror must be reported honestly, but does not make an otherwise verified GitHub CURRENT update invalid.

No checkpoint table/schema removal is part of this change.

## 5. New Mandatory Preflight Order

Before WebV2 work:

1. Read `WEBV2_MANUAL.md` from GitHub `main`.
2. Read the entire GitHub `WEBV2_CURRENT.md` from `main`.
3. Read `/api/project-status`.
4. Read Registry checkpoint metadata when available, including the D1 `WEBV2_CURRENT.md` mirror SHA/updated time.
5. Check GitHub `main` SHA.
6. Check relevant CI/deploy workflows and component-specific deployment truth.
7. Compare:
   - GitHub CURRENT claims;
   - GitHub `main` SHA;
   - Registry deployed SHA;
   - relevant component deployed SHA(s);
   - D1 mirror status when available.
8. Identify roadmap phase/architecture owner.
9. Read relevant Playbook/Decision/Lesson/Cleanup entries.
10. Before a major change, state problem, scope/non-goals, and proof of success.

A D1 mirror read failure is no longer equivalent to “canonical CURRENT unavailable.” GitHub CURRENT remains readable through normal repository access.

## 6. End-of-Task Current-State Update

When a task changes verified project state:

1. update `WEBV2_CURRENT.md` on the same working branch as the closure documentation, or on a dedicated docs-only closure branch when runtime proof must be collected first;
2. include exact merge/deploy/live evidence;
3. run the Project Brain documentation contract;
4. merge the CURRENT update to `main`;
5. verify the merged `main` content;
6. optionally synchronize Registry/D1 mirror via CAS and record whether mirror sync succeeded.

The GitHub merge is the canonical state transition. D1 mirror synchronization is follow-up operational maintenance.

## 7. `WEBV2_CURRENT.md` Content Model

The GitHub file stops being a pointer and becomes compact current truth.

It should contain:

- Updated date
- Repository
- Canonical source declaration: GitHub `main/WEBV2_CURRENT.md`
- Current GitHub main SHA / closure SHA
- Relevant runtime merge/deployment SHA(s), when different
- Current task/status
- Latest completed phases
- Current verified outcome
- Next safe action
- concise DO-NOT-BREAK list
- operational notes, including D1 mirror status when known

It must not become a historical dump. Detailed history continues to live in Roadmap, Decisions, Lessons, specs/plans, and Git history.

## 8. Files and Contracts to Change

### `WEBV2_MANUAL.md`

Change:

- Mandatory preflight reads GitHub CURRENT before Registry checkpoint metadata.
- Current verified truth owner becomes GitHub `WEBV2_CURRENT.md`.
- D1 CURRENT becomes mirror/history/fallback.
- Reconciliation language distinguishes canonical documentation from deployment reality.

### `WEBV2_CURRENT.md`

Replace pointer content with the real current state, initially reflecting:

- project/Brain closure main `8e87d80a94c5143c9be5c0e240cebc4c26da37e2`;
- Phase E2 runtime merge `06383089b6fd7b4a31c468c46c7dd2c21ddfdb14`;
- Phase E2 DONE;
- CLEAN-003 resolved;
- next runtime phase Phase E3;
- D1 mirror currently stale at checkpoint SHA `eb1c9237faae25be32265aa19049b7b7d4e5b626ac45f45d5ee35b5adf9905f1` until separately synchronized.

### `WEBV2_ARCHITECTURE.md`

Change Registry/D1 ownership text:

- Registry/D1 still owns persistent cloud application state, checkpoints/history, and deploy status.
- It no longer owns canonical Project Brain current-state truth.
- GitHub Project Brain / `WEBV2_CURRENT.md` owns canonical project current state.

### `WEBV2_DECISIONS.md`

Add durable decision:

**GitHub `WEBV2_CURRENT.md` is canonical; Registry/D1 checkpoint is mirror/history/fallback.**

Record reason, consequences, and reconsideration conditions.

### `WEBV2_PLAYBOOKS.md`

Replace/adjust:

- canonical current read playbook → GitHub CURRENT first;
- D1 checkpoint read → mirror/history inspection;
- current-state update playbook → branch/PR/CI/merge/readback;
- CAS checkpoint write playbook remains for mirror sync and other checkpoint maintenance, not canonical CURRENT ownership.

### `WEBV2_PROJECT_BRAIN.md`

Ensure index wording says GitHub CURRENT is canonical and Registry/D1 is mirror/history.

### `WEBV2_LESSONS.md`

Add the learned reason for the migration:

- operational state drift showed that making the hardest-to-write artifact canonical creates avoidable maintenance friction;
- GitHub Brain files and deployment evidence remained accessible while D1 CURRENT lagged.

### `WEBV2_TOOLING.md`

Only update if needed to clarify preferred CURRENT read/write method:

- GitHub connector/API is preferred for canonical CURRENT.
- Registry/browser paths remain relevant for mirror inspection/sync.

### `tests/project-brain-docs.test.mjs`

Invert the old pointer contract.

New contract must require:

- GitHub CURRENT declares itself canonical;
- GitHub CURRENT contains real current state, not pointer wording;
- Manual says GitHub CURRENT is current truth;
- Manual still requires `/api/project-status` and deployment comparison;
- D1 checkpoint is described as mirror/history/fallback;
- Project Brain index/Playbooks/Decisions reflect the same ownership;
- no contradictory “Registry/D1 CURRENT is canonical” wording remains in active Brain owner files.

## 9. Historical Checkpoint Preservation

The existing D1 checkpoint and history are not deleted.

The pre-migration D1 canonical state is valuable historical evidence of why this migration was needed. The current D1 checkpoint at migration design time is:

- SHA-256: `eb1c9237faae25be32265aa19049b7b7d4e5b626ac45f45d5ee35b5adf9905f1`
- updated: `2026-09-30 12:08:09`
- content still describes Project Brain bootstrap at `fdf91d...` and says Phase E2 is next.

Production/Registry reality at the same time is `8e87d80a94c5143c9be5c0e240cebc4c26da37e2` and Phase E2 is already completed/verified.

That mismatch is evidence, not data to erase.

## 10. Migration Sequence

1. Write RED Project Brain contract asserting GitHub CURRENT canonical ownership.
2. Observe expected failure against the existing pointer/manual.
3. Replace GitHub `WEBV2_CURRENT.md` pointer with real current state.
4. Update Manual, Architecture, Decisions, Playbooks, Project Brain index, and Lessons/Tooling where ownership language changes.
5. Run focused Project Brain contract.
6. Run full frontend validation/regressions.
7. Review for contradictory active Brain wording.
8. Open PR and merge after green review.
9. Verify `main/WEBV2_CURRENT.md` content by GitHub readback.
10. Verify relevant post-merge workflows.
11. Attempt D1 mirror sync using existing CAS path if practical; if it cannot be synchronized, record stale mirror status without rolling back GitHub canonical ownership.

## 11. Proof of Success

The migration is DONE only when:

1. GitHub `main/WEBV2_CURRENT.md` contains real current state and explicitly declares GitHub canonical ownership.
2. `WEBV2_MANUAL.md` instructs agents to read GitHub CURRENT first.
3. Active Brain owner files contain no conflicting statement that Registry/D1 CURRENT is canonical.
4. D1 is explicitly classified as mirror/history/fallback for CURRENT while retaining checkpoint infrastructure.
5. Project Brain contract passes with the new ownership assertions.
6. Full frontend validation passes.
7. PR is merged and exact merged GitHub CURRENT is read back from `main`.
8. Relevant post-merge validation/Pages/Registry workflows are green as triggered by the documentation changes.
9. D1 mirror sync status is recorded truthfully, whether synced or stale.

## 12. Non-Goals

This change does not:

- remove D1 checkpoint tables/history;
- remove project-agent auth/pairing/editor routes;
- re-enable or redesign PIN auth;
- change My Playlist/Favorites/Saved Playlist ownership;
- change Registry deploy-status semantics;
- alter Player, Discovery, Hunt, Verifier, EPG, Xtream, M3U, STRM, or Enigma2 runtime behavior;
- start Phase E3;
- make GitHub `main` automatically equal production without deployment verification.

## 13. Rollback

If the GitHub-canonical model proves operationally worse, ownership can be reconsidered through a new explicit architecture decision. Rollback must not be implicit. The D1 checkpoint/history subsystem remains intact specifically so the migration does not destroy the previous operational path.
