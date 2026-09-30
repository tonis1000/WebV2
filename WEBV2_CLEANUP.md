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
Status: E2 MIGRATION IN PROGRESS. Local structural loops in the four approved callers have been replaced on PR #69; do not mark RESOLVED until final audit + production verification complete.

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
