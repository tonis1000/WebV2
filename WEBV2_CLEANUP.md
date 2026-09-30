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
Replacement: Project Brain owner documents + canonical GitHub `main/WEBV2_CURRENT.md`.
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
Current STRM consumers found by E3a audit: browser `StrmResolver`, Source Discovery STRM-specific provider, Source Discovery smart curated pre-resolver, Source Hunt Worker, plus route-tooltip presentation detection. Enigma2 parsing remains active in Discovery/frontend paths and is intentionally outside E3a.
Replacement for STRM: pure `src/core/strm-core.js` plus caller-owned adapters/policy. The shared core owns reference/document/header/DRM structure only; network/security/budgets/ranking/playback stay local.
Required STRM proof: RED parity fixtures, browser/Discovery smart/Discovery provider/Hunt migrations, repo-wide permanent duplicate-parser audit, full frontend regressions, exact-SHA frontend/Pages and affected Worker deploy/live proof including real ERT1 STRM resolution and Source Hunt live verification.
Status: **STRM RESOLVED by Phase E3a / PR #73, runtime merge `35c3f7641221b3ad24b3533269e72218d729e241`.** Permanent duplicate-parser audit passed; Frontend #619, Source Discovery #58, Source Hunt #6, Registry #92 and Pages #451 succeeded on the exact runtime SHA; Discovery live verification exercised real ERT1 STRM resolution and Source Hunt live verification passed. **Enigma2 remains PENDING / Phase E3b.**
Deletion SHA: not applicable. E3a removed duplicate parser ownership in place rather than deleting a single obsolete file.

## CLEAN-005 Compatibility facades
Current consumers: must be enumerated before removal.
Replacement: direct canonical shared-core imports only where safe.
Required proof: code search + tests + deployment evidence.
Status: FUTURE AUDIT.

## CLEAN-006 Superseded project documentation after Brain bootstrap
Current consumers: humans/agents may still reference old docs.
Replacement: Brain index + owner documents + canonical GitHub `main/WEBV2_CURRENT.md`; Registry/D1 CURRENT remains mirror/history/fallback rather than replacement authority.
Required proof: unique knowledge migrated, no active workflow/instruction dependency, explicit migration note.
Status: PENDING MIGRATION AUDIT.
