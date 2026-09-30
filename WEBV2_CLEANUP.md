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
Current consumers: multiple active paths.
Replacement: Phase E2 shared M3U/container primitive.
Required proof: RED parity fixtures, migrated callers, regressions/deploy/live proof, no remaining imports/calls.
Status: BLOCKED ON E2.

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
