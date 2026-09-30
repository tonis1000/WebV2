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
Current STRM consumers found by E3a audit: browser `StrmResolver`, Source Discovery STRM-specific provider, Source Discovery smart curated pre-resolver, Source Hunt Worker, plus route-tooltip presentation detection.
Current Enigma2 consumers found by E3b audit: Source Discovery and frontend Source Hunt structural parsing; `workers/source-hunt-bouquet-proxy.js` is a separate transport/security consumer and not a structural parser owner.
Replacement for STRM: pure `src/core/strm-core.js` plus caller-owned adapters/policy. The shared core owns reference/document/header/DRM structure only; network/security/budgets/ranking/playback stay local.
Replacement for Enigma2: pure `src/core/enigma2-core.js` plus caller-owned adapters/policy. The shared core owns bouquet/service structure and neutral raw/decoded/reference facts; Source Discovery keeps matching/service-type/public-URL/candidate policy; frontend Hunt keeps embedded-scheme/header/private-target/classification/UI policy; bouquet proxy keeps HTTPS/allowlist/timeout/max-body/raw-fetch security ownership.
Required STRM proof: RED parity fixtures, browser/Discovery smart/Discovery provider/Hunt migrations, repo-wide permanent duplicate-parser audit, full frontend regressions, exact-SHA frontend/Pages and affected Worker deploy/live proof including real ERT1 STRM resolution and Source Hunt live verification.
Required Enigma2 proof: RED core/Discovery/frontend parity fixtures, compact/nonstandard and embedded-reference parity, permanent repo-wide duplicate-parser audit, proxy-boundary contract, deployment dependency/cache wiring, exact-SHA frontend/Discovery/Registry/Pages success and post-merge live Enigma2 verification.
Status: **RESOLVED.** STRM resolved by Phase E3a / PR #73, runtime merge `35c3f7641221b3ad24b3533269e72218d729e241`. Enigma2 resolved by Phase E3b / PR #75, runtime merge `cc7e2128e9257cc431a95abf08f2f286e93d2235`. E3b exact-SHA proof: Enigma Ownership #15, Frontend #655, Source Discovery #59, Registry #94 and Pages #453 SUCCESS; post-merge verification confirmed real ERT1 HansSettings Greece `format=enigma2`, HTTP 200, count 1, live Pages E3b cache key and Registry exact runtime SHA. Permanent duplicate-parser audit found no remaining active independent Enigma2 structural parser in audited `src`/`workers` scope.
Deletion SHA: not applicable. E3a/E3b removed duplicate parser ownership in place rather than deleting one standalone obsolete file.

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
