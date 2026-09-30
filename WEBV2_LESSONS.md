# WebV2 Lessons

## LESSON-001 `workers.dev` access errors need classification
Situation: one ChatGPT web retrieval path refused the Registry host.
Observation: alternate browser/fetch access reached the endpoint.
Lesson: a client/tool-access limitation is not automatically an auth failure or production outage.
Knowledge update: PB-007 and Tooling matrix.

## LESSON-002 Alternate read path can recover Registry visibility
Worked: alternate fetch/browser path returned project status, checkpoint list, and canonical current content under the old D1-canonical model.
Lesson: keep more than one safe read route, favoring free/native paths first.

## LESSON-003 Raw browser PUT limitation was already solved by a scoped editor
Initial observation: browser automation could read Registry but did not expose arbitrary PUT JSON.
Root cause of our confusion: we had forgotten an already implemented route from PR #51 / merge `17ea6687e59fc602e908bea46ea7e812a2087703`.
Proven solution: `/api/project-agent/checkpoints/WEBV2_CURRENT.md/edit` uses a scoped project-agent session, HTML form POST, and internally forwards to the CAS-protected checkpoint PUT.
Verified 2026-09-30: editor opened with the persistent scoped session and saved the D1 Current checkpoint, producing SHA-256 `0961afab1a627068805ea38a7cad8a9bc597fabbe825639596d330cad9cdf840`.
Lesson: before designing a replacement, search Decisions/Playbooks/history for an existing proven path.

## LESSON-004 Checkpoint writes require CAS + readback
Lesson: fresh SHA, `expectedSha256`, conflict stop, post-write readback/history verification. Never blind overwrite.

## LESSON-005 Main != production
Lesson: use exact-SHA component workflow/live evidence. Registry project status does not prove every Worker is on the same SHA.

## LESSON-006 Preserve transport/media distinction
Phase E1 showed generic HTTP recognition must not silently become confirmed media. Compatibility mapping can preserve old callers without corrupting canonical classification.

## LESSON-007 Solved problems must enrich the Brain
When a fix reveals a reusable route, constraint, failure mode, decision, or cleanup candidate, record it before closing the task. Otherwise the project relearns the same lesson later.

## LESSON-008 Scoped and admin checkpoint routes are different trust boundaries
Situation: the first Project Brain manual pointed routine reads at `/api/project-checkpoints`, while the persistent project-agent cookie is authorized only for `/api/project-agent/checkpoints`.
Reviewer finding: using the admin path would return 401 once the temporary admin/PIN bypass is removed, despite a valid scoped project-agent session.
Lesson: documentation must name the route that matches the credential scope. Scoped project-agent routes are the normal D1 mirror/history read path; admin checkpoint routes are an explicit admin alternative.
Proof: `workers/webtv-registry.js` has separate `requireProjectAgent()` handling for `/api/project-agent/checkpoints` and `requireAdmin()` handling for admin checkpoint routes.

## LESSON-009 Structural parity sometimes needs metadata that looks caller-specific
Situation: Source Discovery and Source Hunt historically searched only the first nine physical lines after an `#EXTINF`, while a neutral shared parser naturally scans until the next entry.
Solution: the shared M3U core exposes `sourceOffset` as neutral structural metadata. Callers preserve their own nine-line acceptance policy with `sourceOffset < 10` instead of reintroducing private traversal loops.
Lesson: when migrating duplicated structure, add neutral structural facts to the shared core rather than moving domain policy into it or duplicating traversal again.

## LESSON-010 Shared modules require deployment and browser-cache dependency wiring
Situation: moving M3U structure into one module meant frontend, Source Discovery, and Source Hunt all depended on a file they did not previously watch/cache-bust together.
Solution: add the shared core to both Worker deploy triggers/tests and use a consistent E2 browser module cache-bust.
Lesson: extracting a shared core is incomplete until every runtime consumer is automatically rebuilt/redeployed when that core changes and browser module graphs cannot serve mixed old/new versions.

## LESSON-011 RED tests must be wired before they count as TDD evidence
Situation: the first E2 core test existed on the branch but was not yet executed by the PR workflow, which could have produced a misleading green CI.
Solution: wire the focused test into validation before treating the failure as the RED gate.
Lesson: a test file that CI does not execute is not branch-level RED evidence.

## LESSON-012 Shared structure may need ordered candidates, not one chosen source
Situation: self-review found a Channel Catalog parity regression after the first E2 migration. Legacy Catalog skipped unsupported non-comment lines such as `rtsp://...` and kept scanning until it found the first HTTP(S) line before the next entry. A shared parser exposing only one `sourceLine` lost that fallback.
RED proof: `tests/channel-catalog-m3u-parity.test.mjs` reproduced the old `rtsp -> HTTP` fallback and failed before the fix.
Solution: the shared core now exposes ordered neutral `sourceCandidates: [{line, offset}]`; `sourceLine/sourceOffset` remain the first candidate for existing callers, while Catalog applies its own HTTP(S) acceptance policy across the candidate list.
Lesson: if callers disagree about which structurally associated line is acceptable, preserve the ordered structural facts in the shared core and leave selection policy to the caller. Do not make the shared parser choose a domain winner.
Verification: full PR validation #554 passed on `df3b36c838b3238666c037e23389d2f27870a94c`.

## LESSON-013 Put the frequently updated project truth where it is easiest to version and review
Situation: Phase E2 runtime and Brain closure advanced to verified production while the D1 `WEBV2_CURRENT.md` checkpoint remained at the earlier Project Brain bootstrap and still described E2 as future work.
Evidence at migration preflight: GitHub main and Registry deployment were `8e87d80a94c5143c9be5c0e240cebc4c26da37e2`, while the D1 CURRENT mirror SHA-256 `eb1c9237faae25be32265aa19049b7b7d4e5b626ac45f45d5ee35b5adf9905f1` still described `fdf91d...` and Phase E2 as next.
Observation: the rest of the Project Brain, PR review and deployment evidence were already versioned/readable in GitHub, while updating the D1 CURRENT required a narrower session/method path and generic automation could not reliably perform the CAS write.
Lesson: the canonical current-state document should live with the versioned Brain in GitHub. Keep D1 checkpoint/history as mirror/fallback, but do not make the hardest-to-update copy the authority.
Consequence: a stale D1 mirror is recorded truthfully as operational debt; it no longer makes canonical CURRENT unavailable.
