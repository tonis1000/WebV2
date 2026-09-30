# WebV2 Project Brain Design

Date: 2026-09-30
Status: DESIGN REVIEW
Base GitHub main SHA: `d9dff4f7b251afe34605e9588b49dcb15d353951`

## 1. Purpose

WebV2 needs one durable operating model for project knowledge so each new task starts from the same verified state instead of reconstructing architecture, decisions, tooling, and history from conversations.

The Project Brain must answer, quickly and without conflicting sources:

- Where are we now?
- What is the final cleanup goal?
- What is the next bounded task?
- Which component owns each responsibility?
- Why was a decision made?
- How do we repeat a workflow that already succeeded?
- Which tool/path is preferred, free, paid, limited, or unreliable?
- What did we learn from a failure or workaround?
- What code/docs are candidates for later deletion, and what proof is required before deleting them?

The final repository goal remains: a clean, functional, understandable, extensible WebV2 with clear ownership, no contradictory project instructions, minimal duplication, and verified removal of obsolete code/documentation.

## 2. Design Principles

1. One owner per kind of project knowledge.
2. Current truth is short and operational; history lives elsewhere.
3. Canonical state must describe verified reality, not override it.
4. GitHub main SHA, deployed SHA, checkpoint SHA, and relevant component deploy evidence are compared before major work.
5. DONE means implemented + deployed + actually verified.
6. New knowledge must be recorded in the file that owns that knowledge type.
7. Historical docs are reference only once migrated; they never outrank current canonical sources.
8. Delete only after replacement + parity + no-consumer proof.
9. Reusable successful methods become playbooks.
10. Tool failures and successful alternatives become lessons/tooling knowledge.
11. No big-bang cleanup. Work proceeds as bounded phases with explicit problem and proof criteria.

## 3. Project Brain Files

The Project Brain consists of nine top-level documents with non-overlapping responsibilities.

### 3.1 `WEBV2_MANUAL.md` — Operating Manual

This is the first document read before any WebV2 work.

It owns:
- mandatory preflight order;
- source-of-truth precedence;
- start-of-task protocol;
- major-change problem/proof rule;
- TDD / review / deployment / live-verification workflow;
- DONE definition;
- end-of-task knowledge-update checklist;
- conflict/reconciliation rules;
- deletion safety rules;
- “when unsure” procedure.

It must not contain detailed roadmap history or component implementation details.

### 3.2 `WEBV2_CURRENT.md` — Current Verified State

This remains the canonical current-state checkpoint in Registry Worker / D1.

It owns only current operational truth:
- current GitHub main SHA;
- Registry deployed SHA;
- current checkpoint SHA when known;
- latest verified phase/commit;
- current task;
- next safe action;
- blockers/mismatches;
- current component verification summary;
- short DO-NOT-BREAK list.

It must stay compact. Historical phase detail moves to Roadmap/Decisions/Lessons.

### 3.3 `WEBV2_ROADMAP.md` — End-to-End Cleanup Roadmap

It owns the path from current state to final clean repository.

For each phase it records:
- problem;
- reason;
- scope;
- non-goals;
- dependencies;
- proof of success;
- status;
- implementation SHA;
- deploy/verification evidence;
- future follow-up created by the phase.

Initial roadmap sequence:
1. State / persistence foundation
2. Channel Identity
3. Channel Profile
4. EPG ownership
5. Import/promotion contract
6. Source Format Registry
7. E2 shared M3U/container parsing
8. E3 STRM/Enigma2 normalization/adapters
9. Source Hunt / Discovery consolidation
10. Candidate / proof / save lifecycle cleanup
11. Playback/source ownership cleanup where evidence requires it
12. State/API/documentation cleanup
13. Dead code + duplicate removal
14. Final architecture audit
15. Final repo cleanup and instruction rewrite

The roadmap may evolve as evidence changes, but completed phases are never rewritten as if they had not happened.

### 3.4 `WEBV2_ARCHITECTURE.md` — Ownership Map

It owns current responsibility boundaries.

Current canonical ownership model includes:
- Registry / D1: persistent cloud state and project checkpoints.
- Channel Identity: stable ids, names, aliases, rejects/collision guards, official references.
- Channel Profile: canonical presentation metadata and EPG mapping metadata, never streams/playback state.
- Source Format Registry: source format identity/detection/capability metadata.
- Source Hunt: broad lead hunting/search/provenance.
- Source Discovery: normalized candidate/provider contract.
- Source Verifier: resolved HTTP media verification and diagnostics.
- Frontend: orchestration/UI, not duplicate search/verification intelligence.
- Player: playback execution/fallback only.
- EPG subsystem: program data consumption under shared identity/profile ownership.
- TV Cache / health/ranking: auxiliary runtime data, not canonical channel identity/profile metadata.

Every architecture entry states what a component owns, what it explicitly does not own, and its primary interfaces.

### 3.5 `WEBV2_PLAYBOOKS.md` — Proven Operational Methods

It records repeatable successful procedures.

Each playbook contains:
- goal;
- preferred method;
- exact path/tool;
- prerequisites;
- verification/readback;
- failure modes;
- fallback;
- security/cost notes;
- last verified date/evidence.

Initial playbooks include:
- read production Registry status;
- read canonical checkpoint list/current file;
- update a checkpoint with CAS and readback;
- inspect GitHub main + relevant workflows;
- implement a bounded change using branch → RED → GREEN → regressions → review → PR → merge → deploy → live verification;
- decide whether a feature is DONE;
- verify a Worker deployment on the exact SHA;
- investigate tool-access failure vs actual endpoint/auth failure.

### 3.6 `WEBV2_TOOLING.md` — Tool Matrix

It owns tool capability, cost, limits, and preference order.

For each tool/path:
- purpose;
- cost model;
- known limits;
- strengths;
- security constraints;
- when to use;
- when not to use;
- known working examples.

TinyFish rule must distinguish free Search/Fetch from metered Browser/Agent/Monitor according to current verified pricing/capabilities. Pricing/limits are time-sensitive and must be rechecked before being treated as permanent facts.

Preference order for routine WebV2 work is generally:
1. direct project-native API/connector;
2. GitHub connector/API;
3. free fetch/search path;
4. metered browser/agent only when materially necessary and explicitly justified.

### 3.7 `WEBV2_DECISIONS.md` — Architecture Decision Log

It stores durable decisions and their rationale.

Each entry includes:
- date/id;
- decision;
- context/problem;
- chosen option;
- rejected alternatives when useful;
- consequences;
- evidence/commit;
- conditions for reconsideration.

Initial decisions include:
- D1-primary My Playlist;
- D1-authoritative Favorites after successful cloud read;
- Browser Resolver retired, official-api-resolver retained;
- Channel Identity and Channel Profile are separate owners;
- stable WebV2 channel id != EPG provider id;
- streams never belong in Channel Profile;
- Hunt / Discovery / Verifier are separate logical responsibilities;
- Source Format Registry owns format identity/detection;
- generic HTTP transport != confirmed playable media;
- unknown formats fail closed but remain inspectable/extensible;
- no big-bang cleanup;
- DONE requires implemented + deployed + verified.

### 3.8 `WEBV2_LESSONS.md` — Operational Learning

It stores facts learned from real attempts, especially failures/workarounds.

Each entry contains:
- situation;
- observed failure/success;
- root cause if proven;
- what worked;
- what did not work;
- reusable lesson;
- whether a Playbook/Tooling/Decision update was created.

Initial lessons include:
- a ChatGPT web retrieval path may reject `*.workers.dev`; this is a client/tool limitation, not automatically Registry auth failure;
- alternate fetch/browser paths can reach the Registry;
- TinyFish browser automation can read the endpoint but browser-style tooling may not support arbitrary PUT JSON;
- checkpoint writes require CAS/readback, not blind overwrite;
- exact-SHA deploy evidence matters because main != production until deployment is verified.

### 3.9 `WEBV2_CLEANUP.md` — Deletion Queue

It owns candidates for removal.

Each candidate records:
- file/module/doc;
- why it may be obsolete/duplicate;
- current consumers;
- intended replacement;
- parity evidence;
- safe-to-delete criteria;
- status;
- deletion SHA when completed.

Deletion rule:
`replacement verified + no active consumers + regressions green + relevant deploy verified` before removal.

## 4. Brain Index

`WEBV2_PROJECT_BRAIN.md` is a small navigation index, not a tenth knowledge store.

It links the nine documents and explains one sentence about each.

New-conversation reading order:
1. `WEBV2_MANUAL.md`
2. `WEBV2_CURRENT.md`
3. relevant Roadmap/Architecture/Playbook/Decision entries only
4. historical documents only when needed for evidence

## 5. Source-of-Truth Precedence

Knowledge precedence is by responsibility, not a single linear list.

- Process rules → `WEBV2_MANUAL.md`
- Current verified project state → `WEBV2_CURRENT.md`
- Current responsibility boundaries → `WEBV2_ARCHITECTURE.md`
- Future sequence/status → `WEBV2_ROADMAP.md`
- Durable rationale → `WEBV2_DECISIONS.md`
- Repeatable operational method → `WEBV2_PLAYBOOKS.md`
- Tool capability/cost/limits → `WEBV2_TOOLING.md`
- Learned operational behavior → `WEBV2_LESSONS.md`
- Deletion candidates → `WEBV2_CLEANUP.md`

If current documentation conflicts with live evidence, do not blindly trust either side. Enter reconciliation mode:
1. stop implementation;
2. read live status/deploy evidence;
3. identify which document is stale;
4. update the stale owner document;
5. record the lesson/decision if the conflict revealed a structural issue.

## 6. Start-of-Task Protocol

Every WebV2 task begins:

1. Read `WEBV2_MANUAL.md`.
2. Read `/api/project-status`.
3. Read `/api/project-checkpoints`.
4. Read the entire canonical `WEBV2_CURRENT.md`.
5. Check GitHub `main` SHA.
6. Check relevant CI/deploy workflows.
7. Compare checkpoint/current state, GitHub main, and deployed component SHA(s).
8. Identify the current roadmap phase and relevant architecture owner.
9. Read only relevant Playbook/Decision/Lesson entries.
10. State the exact problem, scope/non-goals, and proof of success before a major change.

If canonical Registry access is unavailable, record that limitation explicitly and use the most recent verified summary only as a temporary fallback. Never pretend the canonical state was freshly read.

## 7. End-of-Task Knowledge Protocol

After every meaningful task, ask:

- Did current verified state change? → update CURRENT.
- Did roadmap status/sequence change? → update ROADMAP.
- Did ownership/interface change? → update ARCHITECTURE.
- Did we create a repeatable successful procedure? → update PLAYBOOKS.
- Did tool capability/cost/limit knowledge change? → update TOOLING.
- Did we make/reverse a durable design choice? → update DECISIONS.
- Did we learn from a failure/workaround? → update LESSONS.
- Did we identify obsolete code/docs? → update CLEANUP.

A task is not operationally complete until required knowledge updates are made or explicitly noted as blocked.

## 8. Migration of Existing Knowledge

Existing historical files, project uploads, previous handoffs, and conversation knowledge are inputs, not automatically canonical.

Migration method:
1. extract unique facts/decisions/playbooks;
2. place each fact in exactly one owner document;
3. cross-link instead of duplicating prose;
4. mark historical source as migrated/reference-only;
5. add historical source to cleanup queue if no unique value remains;
6. delete only after verification that no unique project knowledge or active dependency remains.

The old `WEBV2_CURRENT.md` is known stale at Phase A while GitHub/Registry production is Phase E1. This mismatch is a priority reconciliation task during Project Brain bootstrap.

## 9. Current Bootstrap Inputs

Fresh GitHub main on 2026-09-30: `d9dff4f7b251afe34605e9588b49dcb15d353951` (`Phase E1: canonical source format registry`).

Known completed sequence to migrate into Roadmap/Decisions/Current:
- stability/state foundation;
- shared Channel Identity;
- Channel Profile Phase A;
- Channel Profile Phase B;
- Phase C EPG ownership migration, prerequisite parity commit `45e60f2af6438f7a11fa618dba3b18a9582e6f5c`, merge `f5319497aa2f85d7e10fb4946382300da9de6acf`;
- Phase D import/promotion contract, merge `d40a2f34027318d69dd78ef88d06fbfd60dc03fb`;
- Phase E1 Source Format Registry, merge `d9dff4f7b251afe34605e9588b49dcb15d353951`.

Known next source-core sequence:
- E2: shared M3U/container parsing;
- E3: STRM/Enigma2 normalization/adapters;
- later Source Hunt / Discovery consolidation and lifecycle cleanup.

Known current stopping point before bootstrap:
- Phase E1 code is merged/deployed/verified;
- canonical `WEBV2_CURRENT.md` is stale;
- Registry reads are possible through an alternate path even when one normal web retrieval tool blocks `workers.dev`;
- browser automation read path did not provide arbitrary PUT JSON checkpoint write capability;
- a browser-friendly CAS editor was proposed but not implemented;
- feature work should remain frozen until the Project Brain bootstrap establishes durable project navigation and current-state reconciliation.

## 10. Testing / Verification of the Documentation System

Bootstrap is accepted only when:

1. all Brain files exist and have non-overlapping ownership;
2. `WEBV2_PROJECT_BRAIN.md` links all documents;
3. `WEBV2_MANUAL.md` is sufficient to start a new conversation correctly;
4. current status reflects live main/deployed evidence rather than stale Phase A state;
5. Roadmap preserves completed phases and future phases;
6. Architecture names one owner per major responsibility;
7. at least the known successful workflows are captured as Playbooks;
8. tool cost/limit claims are source-verified and dated;
9. Decisions/Lessons/Cleanup contain the known high-value historical knowledge;
10. no product runtime behavior changes as part of bootstrap;
11. documentation changes pass repository text/link/consistency review;
12. canonical Registry checkpoint is reconciled once a safe write route is available.

## 11. Non-Goals

This bootstrap does not:
- start E2;
- change Player behavior;
- change Discovery/Hunt/Verifier runtime behavior;
- change D1 application schema;
- change EPG behavior;
- delete code or historical docs immediately;
- implement the browser-friendly checkpoint editor in the same change;
- re-enable/rewrite PIN auth;
- redesign Workers just to reduce file count.

## 12. Rollout Sequence

1. Commit this design spec on an isolated branch.
2. After human review, write implementation plan.
3. Create Project Brain index + nine owner documents.
4. Populate them from canonical/current evidence, GitHub history, project files, and verified conversation knowledge.
5. Self-audit for duplicate/conflicting ownership.
6. Reconcile `WEBV2_CURRENT.md` with Phase E1 reality using a safe CAS-capable route; if blocked, mark it explicitly rather than claiming success.
7. Review old docs and add migration/deletion candidates to CLEANUP.
8. Merge documentation bootstrap only after review.
9. Resume runtime work from the roadmap, starting with unresolved canonical-write tooling if still blocking, then E2.
