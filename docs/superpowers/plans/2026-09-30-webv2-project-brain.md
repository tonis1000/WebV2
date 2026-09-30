# WebV2 Project Brain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the WebV2 Project Brain so every task starts from verified current state, clear ownership, a known roadmap, proven operational playbooks, and accumulated lessons without creating duplicate sources of truth.

**Architecture:** Keep current verified state canonical in Registry Worker / D1, while GitHub owns durable process, roadmap, architecture, tooling, decision, lesson, and cleanup documents. Add a small repo pointer for CURRENT instead of copying the live state into GitHub. Add a documentation contract test so the Brain structure and mandatory rules do not silently drift.

**Tech Stack:** Markdown, Node.js `.mjs` contract test, GitHub Actions, Registry Worker checkpoint API / D1.

**Spec:** `docs/superpowers/specs/2026-09-30-webv2-project-brain-design.md`

## Global Constraints

- No product runtime behavior changes.
- No Player, Discovery, Hunt, Verifier, Xtream, EPG, D1 application-schema, or playback changes.
- `WEBV2_CURRENT.md` remains canonical in Registry Worker / D1.
- The GitHub `WEBV2_CURRENT.md` file is a pointer only and must not duplicate current SHA/state content.
- Historical docs are inputs/reference only until migrated; they never outrank current canonical sources.
- One owner per knowledge category.
- DONE means implemented + deployed + actually verified.
- Every major task starts with problem + scope/non-goals + proof of success.
- Every solved problem that yields reusable knowledge must be classified into Current, Roadmap, Architecture, Playbooks, Tooling, Decisions, Lessons, and/or Cleanup before the task is operationally closed.
- TinyFish pricing/limits are time-sensitive; Tooling must record verification date/source and distinguish free Search/Fetch from metered Browser/Agent/Monitor based on current verified evidence.
- No deletion of runtime code or historical docs in this bootstrap.
- Canonical checkpoint writes use optimistic concurrency/readback; never blind overwrite.

## Review Focus

- The repo must not become a second source of current project truth: GitHub CURRENT stays a pointer, not a copy.
- The same fact must not be owned by two Brain documents; cross-links replace duplicated prose.
- A new conversation must be able to find the exact first-read order and next safe action without reading every historical document.
- Tool/cost claims must be dated and marked re-verify-if-time-sensitive rather than treated as permanent facts.
- If Registry canonical reconciliation remains blocked, the docs must say so explicitly instead of claiming the bootstrap is fully canonical.

---

### Task 1: Project Brain Skeleton + Operating Manual

**Files:**
- Create: `WEBV2_PROJECT_BRAIN.md`
- Create: `WEBV2_MANUAL.md`
- Create: `WEBV2_CURRENT.md` (pointer stub only)
- Create: `tests/project-brain-docs.test.mjs`

**Interfaces:**
- Consumes: approved Project Brain spec.
- Produces: stable document names, first-read order, owner map, mandatory problem-to-knowledge rule, and repo pointer to the D1 canonical current state.

- [ ] **Step 1: Write the RED documentation contract test**

Create `tests/project-brain-docs.test.mjs` asserting:
- `WEBV2_PROJECT_BRAIN.md`, `WEBV2_MANUAL.md`, `WEBV2_CURRENT.md`, `WEBV2_ROADMAP.md`, `WEBV2_ARCHITECTURE.md`, `WEBV2_PLAYBOOKS.md`, `WEBV2_TOOLING.md`, `WEBV2_DECISIONS.md`, `WEBV2_LESSONS.md`, `WEBV2_CLEANUP.md` exist;
- Brain index names all owner documents;
- Manual contains the mandatory preflight sequence and DONE definition;
- Manual contains `Problem-to-Knowledge` rule or equivalent explicit wording;
- repo `WEBV2_CURRENT.md` contains Registry/D1 pointer language and must not contain the current production commit SHA literal;
- Manual says live/document mismatch enters reconciliation mode rather than guessing.

- [ ] **Step 2: Run the test and verify RED**

Run: `node tests/project-brain-docs.test.mjs`
Expected: FAIL because the Brain files do not yet exist.

- [ ] **Step 3: Create index, manual, and CURRENT pointer**

`WEBV2_PROJECT_BRAIN.md` must be a navigation index only.

`WEBV2_MANUAL.md` must include:
- first-read order: MANUAL -> `/api/project-status` -> `/api/project-checkpoints` -> entire live `WEBV2_CURRENT.md` -> GitHub main -> relevant workflows -> comparison;
- responsibility-based source-of-truth precedence;
- problem/scope/proof rule;
- TDD/review/merge/deploy/live-verification sequence;
- DONE definition;
- reconciliation mode;
- deletion gate;
- end-of-task knowledge checklist;
- explicit Problem-to-Knowledge rule stating that a reusable solution is recorded before task closure.

`WEBV2_CURRENT.md` must contain only:
- warning that it is not canonical current-state content;
- canonical Registry endpoint paths;
- instruction to read the entire live D1 checkpoint;
- no production SHA or phase-state copy.

- [ ] **Step 4: Run contract test**

Expected: still FAIL only for owner documents not created yet; Task 1 assertions for index/manual/pointer pass.

- [ ] **Step 5: Commit**

Commit message: `docs: add WebV2 project brain operating manual`

---

### Task 2: Roadmap + Architecture Ownership

**Files:**
- Create: `WEBV2_ROADMAP.md`
- Create: `WEBV2_ARCHITECTURE.md`
- Modify: `tests/project-brain-docs.test.mjs`

**Interfaces:**
- Consumes: current verified phase history from spec, GitHub merge evidence, existing Project knowledge.
- Produces: end-to-end cleanup sequence and one-owner-per-responsibility map.

- [ ] **Step 1: Extend RED test**

Assert Roadmap contains ordered status for:
- state/persistence foundation;
- Channel Identity;
- Channel Profile A/B;
- Phase C EPG ownership;
- Phase D import/promotion;
- Phase E1 Source Format Registry;
- E2 M3U/container parsing;
- E3 STRM/Enigma2;
- later Hunt/Discovery consolidation;
- lifecycle cleanup;
- dead-code/document cleanup;
- final architecture/repo audit.

Assert Architecture identifies exactly one canonical owner for at least:
Registry/D1, Channel Identity, Channel Profile, Source Format Registry, Source Hunt, Source Discovery, Source Verifier, Frontend orchestration, Player, EPG data consumption.

- [ ] **Step 2: Run RED**

Expected: FAIL because Roadmap/Architecture files are absent.

- [ ] **Step 3: Create Roadmap**

For every phase use the same template:
`Problem | Why | Scope | Non-goals | Dependencies | Proof | Status | SHA/evidence | Future follow-up`.

Use exact known SHAs where verified:
- Phase C prerequisite `45e60f2af6438f7a11fa618dba3b18a9582e6f5c`
- Phase C merge `f5319497aa2f85d7e10fb4946382300da9de6acf`
- Phase D merge `d40a2f34027318d69dd78ef88d06fbfd60dc03fb`
- Phase E1 merge `d9dff4f7b251afe34605e9588b49dcb15d353951`

Do not invent unknown Phase B SHA; mark evidence as inherited/needs extraction if not freshly established.

- [ ] **Step 4: Create Architecture ownership map**

For each component record:
`Owns | Does not own | Primary interfaces | Current cleanup notes`.

Preserve key decisions:
- WebV2 id != EPG provider id;
- Channel Profile never owns streams;
- Source Format Registry recognizes formats but does not verify media;
- Hunt/Discovery/Verifier remain separate logical responsibilities;
- Player owns playback execution/fallback, not discovery truth.

- [ ] **Step 5: Run contract test**

Expected: owner/roadmap assertions PASS; remaining absent docs still fail.

- [ ] **Step 6: Commit**

Commit message: `docs: add WebV2 roadmap and ownership map`

---

### Task 3: Proven Playbooks + Tool Matrix

**Files:**
- Create: `WEBV2_PLAYBOOKS.md`
- Create: `WEBV2_TOOLING.md`
- Modify: `tests/project-brain-docs.test.mjs`

**Interfaces:**
- Consumes: successful Registry/GitHub/CI workflows and current TinyFish capability/pricing evidence.
- Produces: reusable operational procedures and cost-aware tool-selection rules.

- [ ] **Step 1: Extend RED test**

Assert Playbooks contain entries for:
- Registry project status read;
- checkpoint list/current read;
- CAS checkpoint write + readback;
- main SHA + workflow/deploy verification;
- bounded change lifecycle RED -> GREEN -> regressions -> review -> PR -> merge -> deploy -> live verify;
- exact DONE check;
- tool-access failure vs endpoint/auth failure.

Assert Tooling includes GitHub, Registry, standard web/fetch path, TinyFish Search, TinyFish Fetch, TinyFish Browser/Agent, and cost/limit freshness marker.

- [ ] **Step 2: Run RED**

Expected: FAIL for missing Playbooks/Tooling.

- [ ] **Step 3: Create Playbooks using a fixed template**

Each entry: `Goal | Preferred method | Prerequisites | Steps | Verification/readback | Failure modes | Fallback | Cost/security | Last verified`.

For checkpoint write playbook, document current reality honestly:
- API supports CAS PUT JSON;
- current alternate browser path proved read access;
- arbitrary PUT JSON was not available in that browser automation attempt;
- browser-friendly CAS editor is proposed/not implemented until verified later.

- [ ] **Step 4: Create Tooling matrix**

Record current verified tool behavior and mark all time-sensitive limits/prices with `Verified: 2026-09-30; re-check before relying on exact limits/cost`.

Preference rule:
project-native/connector -> GitHub API -> free fetch/search -> metered browser/agent only when materially necessary and justified.

Do not encode wallet balance or secrets.

- [ ] **Step 5: Run contract test**

Expected: Tooling/Playbook assertions PASS.

- [ ] **Step 6: Commit**

Commit message: `docs: add WebV2 playbooks and tooling matrix`

---

### Task 4: Decisions + Lessons + Cleanup Queue

**Files:**
- Create: `WEBV2_DECISIONS.md`
- Create: `WEBV2_LESSONS.md`
- Create: `WEBV2_CLEANUP.md`
- Modify: `tests/project-brain-docs.test.mjs`

**Interfaces:**
- Consumes: historical project decisions, current architecture, known tool failures/workarounds, existing docs/files.
- Produces: durable rationale, reusable operational learning, and evidence-gated deletion queue.

- [ ] **Step 1: Extend RED test**

Assert Decisions covers at minimum:
- D1-primary My Playlist;
- D1-authoritative Favorites after cloud read;
- Browser Resolver retired / official-api-resolver retained;
- identity/profile split;
- streams excluded from profiles;
- Hunt/Discovery/Verifier separation;
- Source Format Registry ownership;
- generic HTTP != confirmed media;
- unknown formats fail closed/inspectable;
- no big-bang cleanup;
- DONE definition.

Assert Lessons includes:
- `workers.dev` tool-access limitation != auth failure;
- alternate path can read Registry;
- browser automation PUT limitation encountered;
- CAS/readback rule;
- exact-SHA deployment truth rule.

Assert Cleanup defines candidate schema and deletion gate.

- [ ] **Step 2: Run RED**

Expected: FAIL for missing Decisions/Lessons/Cleanup.

- [ ] **Step 3: Create Decision log**

Use stable IDs such as `DEC-001` and template:
`Decision | Context | Choice | Alternatives | Consequences | Evidence | Reconsider when`.

- [ ] **Step 4: Create Lessons log**

Use IDs such as `LESSON-001` and template:
`Situation | Observation | Proven cause | Worked | Did not work | Reusable lesson | Knowledge updates`.

- [ ] **Step 5: Create Cleanup queue**

Initial entries should include only candidates with evidence, not automatic deletions:
- old/current-state handoff docs after unique knowledge migration;
- historical source-hunt/architecture handoffs after comparison;
- compatibility facades/duplicate parsers only when later phase parity proves removal safe;
- stale documentation that conflicts with Project Brain after migration.

Every candidate must have `Current consumers | Replacement | Required proof | Status`.

- [ ] **Step 6: Run contract test**

Expected: all file-structure and mandatory-knowledge assertions PASS.

- [ ] **Step 7: Commit**

Commit message: `docs: capture WebV2 decisions lessons and cleanup queue`

---

### Task 5: CI Contract + Cross-Document Consistency Audit

**Files:**
- Modify: `.github/workflows/validate-frontend.yml`
- Modify: `tests/project-brain-docs.test.mjs`
- Modify: Brain docs only when audit finds conflicts.

**Interfaces:**
- Consumes: all Project Brain owner documents.
- Produces: automatic guard that future Brain changes trigger validation and preserve mandatory invariants.

- [ ] **Step 1: Extend documentation contract test**

Add assertions:
- Index references every owner doc exactly once;
- repo CURRENT pointer contains no 40-hex production SHA;
- Manual defines knowledge update classification for all eight owner categories;
- Roadmap says Phase E1 complete and E2 not started;
- Architecture and Decisions agree on Identity/Profile/Source Format ownership;
- Cleanup never labels an item deletable solely because it looks old;
- no Brain doc claims browser-friendly checkpoint write exists before it is implemented/verified.

- [ ] **Step 2: Run test**

Expected: PASS after fixing any documentation inconsistencies.

- [ ] **Step 3: Wire Brain docs into CI path filters**

Modify `validate-frontend.yml` push and PR paths to include:
- `WEBV2_*.md`
- `tests/project-brain-docs.test.mjs`

Add step:
`node tests/project-brain-docs.test.mjs`

This is validation-only; it does not alter runtime deployment.

- [ ] **Step 4: Run local relevant validation**

Run:
- `node tests/project-brain-docs.test.mjs`
- existing non-runtime high-value regressions if available in execution environment; at minimum verify no product JS/Worker files changed in the branch diff.

Expected: PASS; branch diff contains documentation/test/workflow only.

- [ ] **Step 5: Commit**

Commit message: `ci: validate WebV2 project brain contract`

---

### Task 6: Canonical Reconciliation + Bootstrap Verification

**Files / External state:**
- Registry D1 checkpoint: `WEBV2_CURRENT.md`
- Possibly Brain docs if readback reveals a mismatch.
- No runtime code change in this task.

**Interfaces:**
- Consumes: completed Brain docs, live `/api/project-status`, `/api/project-checkpoints`, live current checkpoint, GitHub main, relevant exact-SHA deploy evidence.
- Produces: reconciled canonical current state or an explicit unresolved blocker entry.

- [ ] **Step 1: Fresh read before any canonical write**

Read:
- `/api/project-status`
- `/api/project-checkpoints`
- entire `/api/project-checkpoints/WEBV2_CURRENT.md`
- GitHub main SHA
- relevant Phase E1 workflows/deploy evidence.

Compare current server checkpoint SHA with the previously observed SHA; never assume it is unchanged.

- [ ] **Step 2: Prepare compact canonical CURRENT content**

It must contain only current truth:
- actual GitHub main/deployed SHA evidence;
- Phase E1 status;
- current Project Brain bootstrap status;
- next safe action;
- mismatch/blocker status;
- DO-NOT-BREAK summary;
- pointer to Brain documents for roadmap/history/architecture.

Do not copy the whole Roadmap/Decisions into CURRENT.

- [ ] **Step 3: Write using a verified CAS-capable route**

If an existing safe route can perform the authenticated/bypassed CAS PUT with `expectedSha256`, use it.

If no current tool can send the required write safely, STOP this step and record:
`Canonical reconciliation blocked: safe CAS write route unavailable from current harness`.
Do not introduce the browser-friendly editor inside this documentation bootstrap without a separately approved bounded change.

- [ ] **Step 4: Read back and verify if write succeeded**

Require:
- returned/current SHA changed as expected;
- checkpoint history preserved;
- content contains current main/Phase E1 and Project Brain status;
- list endpoint reports the new SHA/updated_at.

If blocked, verify the old checkpoint remains unchanged and document the blocker in Current pointer/Playbook/Lessons/Roadmap as appropriate.

- [ ] **Step 5: Whole-branch review**

Check:
- no product runtime files changed;
- no duplicate knowledge ownership;
- no invented SHAs/evidence;
- all known facts are tagged current, historical, future, or unverified;
- Problem-to-Knowledge rule is explicit and reusable.

- [ ] **Step 6: Open PR and run CI**

PR title: `docs: bootstrap WebV2 project brain`

Require Project Brain contract CI success. Runtime deployment is not required for documentation-only GitHub files, except any independent Registry checkpoint reconciliation is verified through its own readback.

- [ ] **Step 7: Merge only after review**

After merge, verify GitHub main includes the Brain docs and contract test. Update canonical CURRENT if the merge SHA itself materially changes the current-state pointer and a safe CAS route is available; otherwise record the exact reconciliation blocker.

---

## Bootstrap Completion Criteria

The Project Brain bootstrap is DONE only when:

1. Brain index + Manual + pointer + Roadmap + Architecture + Playbooks + Tooling + Decisions + Lessons + Cleanup exist.
2. `tests/project-brain-docs.test.mjs` passes.
3. CI watches and validates `WEBV2_*.md` changes.
4. One owner exists for each knowledge category.
5. Manual contains the automatic Problem-to-Knowledge rule so the user does not need to remind the agent.
6. Current project truth is either successfully reconciled in Registry D1 or explicitly marked blocked with exact reason and old checkpoint left untouched.
7. No runtime behavior changed.
8. The next safe runtime work is visible from Roadmap/Current: resolve canonical write tooling if still blocked, then Phase E2.
