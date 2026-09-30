# WebV2 Proven Playbooks

Each playbook records a repeatable method. Re-check live behavior when dated evidence may have changed.

## PB-001 Read production Registry status
Goal: learn Registry deployment state.
Preferred method: GET `/api/project-status`.
Verify/readback: record returned commit SHA/message/deployed time and compare with GitHub main.
Failure mode: client tool may block `*.workers.dev`; do not call that an auth failure without HTTP evidence.
Fallback: another read-capable fetch/browser path.

## PB-002 Read canonical project state
Preferred canonical method:
1. Read GitHub `main/WEBV2_CURRENT.md` in full.
2. Record GitHub `main` SHA.
3. Read `/api/project-status` for Registry deployment truth.
4. Read relevant component workflow/live evidence.
5. Read Registry/D1 checkpoint metadata when available to record mirror/history status.
6. Compare canonical CURRENT claims with verified live/deployment evidence; enter reconciliation mode on a real mismatch.

Registry/D1 `WEBV2_CURRENT.md` is mirror/history/fallback, not canonical authority. Routine mirror inspection can use `/api/project-agent/checkpoints` and `/api/project-agent/checkpoints/WEBV2_CURRENT.md` with the scoped project-agent session. Admin `/api/project-checkpoints` routes remain an explicit admin alternative.

Do not use historical handoffs or the D1 mirror as a substitute for GitHub CURRENT when the canonical GitHub file is available.

## PB-003 Update canonical CURRENT and optionally sync the D1 mirror
Canonical GitHub CURRENT update:
1. start from fresh `main` and verified live evidence;
2. edit `WEBV2_CURRENT.md` on the working branch or a dedicated docs-only closure branch;
3. include exact merge/deploy/live evidence and truthful mirror status;
4. run the Project Brain contract and relevant validation;
5. merge through the normal PR/review gate;
6. read back GitHub `main/WEBV2_CURRENT.md` and record the exact merge SHA.

D1 mirror synchronization is optional operational follow-up, not the canonical state transition. When syncing the mirror, use a fresh checkpoint SHA and CAS-protected write only; stop on conflict and verify readback.

Browser-friendly mirror sync method for `WEBV2_CURRENT.md`: `/api/project-agent/checkpoints/WEBV2_CURRENT.md/edit` inside an active project-agent session. The form POST internally forwards to the checkpoint PUT path.
Never blind overwrite a checkpoint.

## PB-004 Check code vs deployment
1. Read GitHub main SHA.
2. Inspect relevant component workflow(s).
3. Require exact-SHA successful deploy or component-specific live evidence.
4. Do not infer all Workers from Registry `/api/project-status`.

## PB-005 Bounded implementation lifecycle
Problem/proof statement -> branch/isolation -> RED test -> observe expected failure -> minimal GREEN -> focused regressions -> full relevant regressions -> review -> PR -> merge -> exact-SHA deployment -> live verification -> knowledge updates.

## PB-006 DONE check
A change is DONE only when **implemented + deployed + actually verified**.
If deployment or live proof is missing, status is implemented or merged, not DONE.

## PB-007 Diagnose tool-access vs endpoint/auth failure
1. Capture the actual client/tool error.
2. If no HTTP status was received, do not classify as server auth failure.
3. Try an alternate safe read path.
4. Compare server response/status.
5. Record successful route in Tooling/Lessons.

## PB-008 RED / GREEN evidence
RED: test exists and fails for the expected missing behavior.
GREEN: minimal implementation makes that test pass; then relevant suite stays green.
Never reverse the order.

## PB-009 Live media proof vocabulary
`FOUND` is not `VERIFIED_MEDIA`; `VERIFIED_MEDIA` is not `PLAYBACK_CONFIRMED`; `PLAYBACK_CONFIRMED` is not automatically `SAVED`.
Use precise lifecycle terms in reports.

## PB-010 Actions-backed TDD when local execution is unavailable
Goal: preserve real RED/GREEN evidence when the local container cannot clone/read the repository because of DNS/network limits.
1. Create an isolated GitHub branch from the verified base/spec/plan commit.
2. Write only the failing test/contract first.
3. If no permanent workflow executes it yet, add a narrow temporary PR-only validation workflow.
4. Open a draft PR and inspect Actions job steps/logs. RED counts only when the expected test fails for the expected reason.
5. Implement the minimal GREEN change and verify the same Actions gate passes.
6. As the feature matures, move every durable test into the normal frontend/Worker workflows and add dependency-path assertions where useful.
7. Delete the temporary workflow before review/merge.
8. Run the full permanent suite after the temporary harness is gone.
Failure mode: a newly created workflow may not appear in the first run query; re-read before concluding it did not trigger.

## PB-011 Safe large-file edits through the GitHub connector
Goal: modify a large existing file without reconstructing it from truncated display output.
1. Fetch the exact branch version of the file and record its blob SHA.
2. If the connector response is truncated, use its response-resource URI and read the content in line ranges until the full file is recovered.
3. Make the smallest deterministic transformation against that exact content.
4. Use `update_file` with the recorded SHA; remember the connector replaces the whole file rather than applying a patch.
5. Immediately run syntax/parity/full relevant CI to catch accidental whole-file drift.
6. For repeat large-file work, prefer extracting smaller shared modules so future edits become bounded.
Do not copy from a stale `main` file when the branch already contains earlier task changes.
