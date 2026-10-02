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

## CLEAN-007 Legacy Official broadcaster discovery/resolution
Current consumers before retirement: legacy Official broadcaster discovery provider/resolver paths, their verifier/deployment checks, and historical tests/workflows that existed outside the consolidated Unified Search ownership boundary.
Replacement: no dedicated automatic Official subsystem. Manual official-site lookup is sufficient for this use case; retained discovery continues through Curated, GitHub, Recent Web, STRM, Authorized Xtream and Hunt exploration, with New Xtream preview, Local intelligence and Promotion policy preserved for their distinct roles.
Required proof: explicit retirement contract, no accidental removal of retained discovery paths, permanent Unified Search rejection of `official` providers, frontend/search regressions, exact-SHA Source Discovery/Registry/Pages deployment, and live Source Discovery verification after deployment.
Status: **RESOLVED** by PR #82, runtime merge `92dd5411427a06cc501e924df60f7dc2a80be1c1`. Validate Unified Search #43, Validate WebTV Frontend #709, Validate Enigma2 Ownership #52, Deploy Source Discovery Worker #62, Deploy WebTV Registry Worker #100 and GitHub Pages #458 succeeded. The Source Discovery deploy step `Verify live Worker and retained external providers` succeeded, providing live evidence that the retained external provider surface still worked after the retirement.
Deletion SHA: runtime retirement merged at `92dd5411427a06cc501e924df60f7dc2a80be1c1`. Historical rationale/spec/plan/ledger documents remain evidence and are not automatically deleted by this cleanup item.

## CLEAN-008 Legacy Discovery New Xtream UI ownership
Current consumers before migration: `src/discovery/discovery-ui.js` owned the only normal UI path for New Xtream credentials, temporary preview, verification and preview-to-persistence actions even though the legacy Discovery shell had already been removed from the production entrypoint.
Replacement: Playlist Manager / Xtream account management owns production Test / Preview, explicit verified Save Channel destinations and explicit Save Full Account. Shared preview security/promotion policy remains reusable and is not duplicated into Unified Search.
Required proof: RED ownership tests, production Xtream preview UI, strict non-persistent preview policy, explicit channel/full-account persistence tests, source-scope tests, no Search/Player coupling, large-catalog proof, legacy shell regression coverage, deploy evidence and live browser verification.
Status: **RESOLVED** by PR #93, runtime merge `9588e191fd354b42d20ae87ab16d3a2989041df4`, with closure follow-ups PR #95 `9f08d898b8209ffa4d32aa11424802df367f63e1`, PR #97 `bf0b6a70e0c7840c19b0e08c7f2f04396aa22b7a` and PR #98 `de62fca10c7e452c836d168f2c373b437c936a93`. Production Playwright verification against live Pages and the deployed authorized 50/500/5000 mock provider passed, including bounded rendering, Selected/All-known saves, Custom Playlist creation, Full Account save, Playlist Manager interaction ownership, Player independence and zero page/console errors.
Deletion SHA: not applicable to the shared preview/promotion primitives. PR #93 retired only the legacy Discovery UI ownership for New Xtream while preserving reusable security/policy logic and other legacy Discovery capabilities still under audit.


## CLEAN-009 Legacy Discovery Local scan ownership
Current consumers before canonicalization: `src/discovery/local-data-reader.js` and `src/discovery/local-candidates.js` feed the retained legacy `src/discovery/discovery-ui.js` shell. That shell is no longer a production entrypoint. The legacy local path historically supplied My Playlist, Saved M3U and loaded Xtream candidates using its own Discovery candidate/identity model.

Replacement: production save-time local intelligence now flows through `src/cloud-read-sync.js` for reconciled Saved Playlist snapshots and `src/known-source-collector.js` for canonical identity matching, dedupe and aggregation across My Playlist, Custom Playlists, source-backed Saved M3U playlists and the already-loaded catalog.

Required proof before deletion:
- repo-wide active-consumer audit for `local-data-reader.js`, `local-candidates.js` and the relevant legacy Discovery Local UI bindings;
- preservation of any still-unique non-Local legacy Discovery capability;
- regression proving Saved M3U known-source parity and no Unified Search/Player coupling;
- full frontend/startup/browser regression;
- exact-SHA Pages/Registry deployment and live verification after deletion.

Status: **MIGRATED / DO NOT DELETE YET.** PR #100 merge `35306d1161899a8f58801363bd3b1947881db9b2` moved the last identified useful Saved M3U local-intelligence coverage into the canonical known-source path. Exact-SHA Validate WebTV Frontend #813, Deploy WebTV Registry Worker #109 and GitHub Pages #467 succeeded. Deletion remains a separate bounded cleanup task.

Deletion SHA: none.
