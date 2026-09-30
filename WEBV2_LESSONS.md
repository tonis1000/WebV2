# WebV2 Lessons

## LESSON-001 `workers.dev` access errors need classification
Situation: one ChatGPT web retrieval path refused the Registry host.
Observation: alternate browser/fetch access reached the endpoint.
Lesson: a client/tool-access limitation is not automatically an auth failure or production outage.
Knowledge update: PB-007 and Tooling matrix.

## LESSON-002 Alternate read path can recover Registry visibility
Worked: alternate fetch/browser path returned project status, checkpoint list, and canonical current content.
Lesson: keep more than one safe read route, favoring free/native paths first.

## LESSON-003 Browser automation did not provide arbitrary checkpoint PUT JSON
Situation: read succeeded, write automation could not issue required arbitrary PUT JSON.
Lesson: do not assume browser navigation tooling can perform API mutation semantics. Check method/body/header capabilities first.
Future: browser-friendly CAS editor is a candidate bounded change, not yet implemented/verified.

## LESSON-004 Checkpoint writes require CAS + readback
Lesson: fresh SHA, `expectedSha256`, conflict stop, post-write readback/history verification. Never blind overwrite.

## LESSON-005 Main != production
Lesson: use exact-SHA component workflow/live evidence. Registry project status does not prove every Worker is on the same SHA.

## LESSON-006 Preserve transport/media distinction
Phase E1 showed generic HTTP recognition must not silently become confirmed media. Compatibility mapping can preserve old callers without corrupting canonical classification.

## LESSON-007 Solved problems must enrich the Brain
When a fix reveals a reusable route, constraint, failure mode, decision, or cleanup candidate, record it before closing the task. Otherwise the project relearns the same lesson later.
