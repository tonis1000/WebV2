# WebV2 Lessons

## LESSON-001 `workers.dev` access errors need classification
Situation: one ChatGPT web retrieval path refused the Registry host.
Observation: alternate browser/fetch access reached the endpoint.
Lesson: a client/tool-access limitation is not automatically an auth failure or production outage.
Knowledge update: PB-007 and Tooling matrix.

## LESSON-002 Alternate read path can recover Registry visibility
Worked: alternate fetch/browser path returned project status, checkpoint list, and canonical current content.
Lesson: keep more than one safe read route, favoring free/native paths first.

## LESSON-003 Raw browser PUT limitation was already solved by a scoped editor
Initial observation: browser automation could read Registry but did not expose arbitrary PUT JSON.
Root cause of our confusion: we had forgotten an already implemented route from PR #51 / merge `17ea6687e59fc602e908bea46ea7e812a2087703`.
Proven solution: `/api/project-agent/checkpoints/WEBV2_CURRENT.md/edit` uses a scoped project-agent session, HTML form POST, and internally forwards to the CAS-protected checkpoint PUT.
Verified 2026-09-30: editor opened with the persistent scoped session and saved canonical Current, producing SHA-256 `0961afab1a627068805ea38a7cad8a9bc597fabbe825639596d330cad9cdf840`.
Lesson: before designing a replacement, search Decisions/Playbooks/history for an existing proven path.

## LESSON-004 Checkpoint writes require CAS + readback
Lesson: fresh SHA, `expectedSha256`, conflict stop, post-write readback/history verification. Never blind overwrite.

## LESSON-005 Main != production
Lesson: use exact-SHA component workflow/live evidence. Registry project status does not prove every Worker is on the same SHA.

## LESSON-006 Preserve transport/media distinction
Phase E1 showed generic HTTP recognition must not silently become confirmed media. Compatibility mapping can preserve old callers without corrupting canonical classification.

## LESSON-007 Solved problems must enrich the Brain
When a fix reveals a reusable route, constraint, failure mode, decision, or cleanup candidate, record it before closing the task. Otherwise the project relearns the same lesson later.
