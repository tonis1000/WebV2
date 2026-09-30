# WebV2 Operating Manual

## Purpose
This is the first document to read before any WebV2 work. It defines process, not project history.

## Mandatory preflight
1. Read this manual.
2. Read `/api/project-status`.
3. Read `/api/project-agent/checkpoints` using the persistent scoped project-agent session.
4. Read the entire live Registry/D1 checkpoint at `/api/project-agent/checkpoints/WEBV2_CURRENT.md`.
5. Check GitHub `main` SHA.
6. Check relevant CI/deploy workflows and component-specific deployment truth.
7. Compare checkpoint/current state, GitHub main SHA, Registry deployed SHA, and relevant component deployed SHA(s).
8. Identify the current roadmap phase and architecture owner.
9. Read only relevant Playbook, Decision, Lesson, and Cleanup entries.
10. Before a major change, state problem, scope/non-goals, and proof of success.

The admin routes `/api/project-checkpoints` and `/api/project-checkpoints/<name>` require Registry admin authentication unless a temporary maintenance bypass is active. Routine Project Brain reads must prefer the scoped `/api/project-agent/checkpoints` routes so the persistent project-agent session stays least-privilege.

If live current state and documentation disagree, enter **reconciliation mode**: stop implementation, inspect live evidence, identify stale knowledge, update the correct owner, and record a Lesson/Decision if the mismatch revealed a structural issue.

## Source-of-truth ownership
- Process rules: `WEBV2_MANUAL.md`
- Current verified truth: live Registry/D1 `WEBV2_CURRENT.md`
- Future sequence: `WEBV2_ROADMAP.md`
- Ownership/interfaces: `WEBV2_ARCHITECTURE.md`
- Reusable procedure: `WEBV2_PLAYBOOKS.md`
- Tool capability/cost: `WEBV2_TOOLING.md`
- Rationale: `WEBV2_DECISIONS.md`
- Learned behavior: `WEBV2_LESSONS.md`
- Removal candidates: `WEBV2_CLEANUP.md`

## Work rule
For implementation work use bounded changes, RED test first, minimal GREEN, regressions, review, merge, deployment, and live verification. Do not combine unrelated cleanup.

**DONE = implemented + deployed + actually verified.** Main is not assumed to be production. A verifier saying a URL is media is not the same as real playback confirmation.

## Problem-to-Knowledge Rule
Every solved problem that produces reusable knowledge must be classified before the task is operationally closed:
- Current state changed → Current
- Future work created → Roadmap
- Responsibility/interface changed → Architecture
- Repeatable successful method found → Playbooks
- Tool capability/cost/limit learned → Tooling
- Durable design choice made → Decisions
- Failure/workaround taught something → Lessons
- Obsolete/duplicate asset identified → Cleanup

Do not duplicate the same fact across files. One owner stores it; other files cross-reference it.

## End-of-task checklist
Before closing meaningful work:
1. Verify exact test/deploy/live evidence.
2. Update every affected knowledge owner.
3. Add future follow-up to Roadmap rather than hiding TODOs in Current.
4. Add obsolete candidates to Cleanup, never delete just because something looks old.
5. Re-read the next safe action.

## Deletion gate
Delete only when replacement is verified, no active consumers remain, relevant regressions pass, and the relevant deployment is verified. Preserve rollback/history where appropriate.

## When unsure
Do not guess. Read Current, Architecture, Decisions, Playbooks, then live evidence. If ambiguity remains, state it explicitly before changing code.
