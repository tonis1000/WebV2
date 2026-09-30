# WebV2 Cleanup Queue

Nothing is deleted merely because it looks old. Candidates move to SAFE TO DELETE only after evidence.

Required fields for every candidate:
- Current consumers
- Replacement
- Required proof
- Status
- Deletion SHA when completed

## CLEAN-001 Historical current-state / handoff documents
Current consumers: may still be used as historical evidence.
Replacement: Project Brain owner documents + live canonical Current.
Required proof: migrate all unique knowledge, verify no instructions/tooling depend on file, cross-check history value.
Status: INVENTORY / DO NOT DELETE YET.

## CLEAN-002 Historical Source Hunt / architecture handoffs
Current consumers: unknown until repo/reference audit.
Replacement: Roadmap + Architecture + Decisions where unique knowledge is still current.
Required proof: compare content, preserve unique evidence, verify no active links/automation consumers.
Status: INVENTORY / DO NOT DELETE YET.

## CLEAN-003 Duplicate M3U parsers
Current consumers before E2: Channel Catalog, Source Discovery, Source Hunt Worker, frontend Source Hunt each owned independent EXTINF/source traversal.
Replacement: `src/core/m3u-container.js` for neutral container structure, with caller-owned policy adapters.
Required proof: RED parity fixtures, all active structural callers migrated, repo-wide duplicate-parser audit, full regressions, exact-SHA Source Discovery/Source Hunt/frontend/Pages deploy and live proof.
Status: RESOLVED by Phase E2 / PR #69, merge `06383089b6fd7b4a31c468c46c7dd2c21ddfdb14`. The four approved active structural callers use the shared core; the duplicate-parser audit found no remaining known independent M3U structural parser in that scope; exact-SHA Frontend #558, Source Discovery #57, Source Hunt #5, Registry #88 and Pages #447 succeeded, with live Discovery/Hunt verification.
Deletion SHA: not applicable. E2 removed duplicated traversal in place rather than deleting a standalone obsolete file.

## CLEAN-004 Duplicate STRM / Enigma2 parsing primitives
Current consumers: active Hunt/Discovery/frontend paths.
Replacement: Phase E3 shared primitives/adapters.
Required proof: parity, caller migration, no-consumer proof, relevant deploy verification.
Status: BLOCKED ON E3.

## CLEAN-005 Compatibility facades
Current consumers: must be enumerated before removal.
Replacement: direct canonical shared-core imports only where safe.
Required proof: code search + tests + deployment evidence.
Status: FUTURE AUDIT.

## CLEAN-006 Superseded project documentation after Brain bootstrap
Current consumers: humans/agents may still reference old docs.
Replacement: Brain index + owner documents.
Required proof: unique knowledge migrated, no active workflow/instruction dependency, explicit migration note.
Status: PENDING MIGRATION AUDIT.
