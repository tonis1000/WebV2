# WebV2 Proven Playbooks

Each playbook records a repeatable method. Re-check live behavior when dated evidence may have changed.

## PB-001 Read production Registry status
Goal: learn Registry deployment state.
Preferred method: GET `/api/project-status`.
Verify/readback: record returned commit SHA/message/deployed time and compare with GitHub main.
Failure mode: client tool may block `*.workers.dev`; do not call that an auth failure without HTTP evidence.
Fallback: another read-capable fetch/browser path.

## PB-002 Read canonical project state
1. GET `/api/project-checkpoints`.
2. Record `WEBV2_CURRENT.md` SHA/updated time.
3. GET `/api/project-checkpoints/WEBV2_CURRENT.md` and read the entire file.
4. Compare with GitHub main and relevant deploy workflows.
Do not use historical handoffs as a substitute when canonical access works.

## PB-003 CAS checkpoint write + readback
Prerequisite: current checkpoint SHA.
Preferred method: checkpoint PUT JSON using `expectedSha256`.
Steps: fresh read -> prepare full content -> PUT with expected SHA -> reject/stop on conflict -> GET again -> verify new SHA/content/history.
Never blind overwrite.
Known limitation as of 2026-09-30: alternate browser automation proved read access but did not expose arbitrary PUT JSON in that attempt; browser-friendly CAS editor remains proposed, not verified.

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
