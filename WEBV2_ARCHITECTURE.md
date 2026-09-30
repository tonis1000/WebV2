# WebV2 Architecture Ownership Map

Rule: one canonical owner per responsibility. Wrappers/adapters may exist, but they do not acquire canonical ownership.

## Project Brain / GitHub Current
Owns: canonical project current-state truth in GitHub `main/WEBV2_CURRENT.md`, plus the versioned Brain owner documents and their reviewable history.
Does not own: deployment reality by assertion, cloud application data, Worker runtime state, media verification, or playback.
Rule: GitHub CURRENT is canonical documentation, while verified live/deployment evidence is used to reconcile whether the document is stale.

## Registry / D1
Owns: persistent cloud application state, My Playlist persistence, Favorites/cloud state, Saved Playlist truth, checkpoint/history infrastructure, and Registry deploy status.
Does not own: canonical Project Brain current-state truth, channel identity semantics, format verification, playback.
Rule: Registry/D1 `WEBV2_CURRENT.md` is mirror/history/fallback. `/api/project-status` remains Registry deployment truth.

## Channel Identity
Owns: stable channel id, canonical/official names, aliases, rejects/collision guards, official references.
Does not own: logos/categories/EPG provider mapping, streams, verification.

## Channel Profile
Owns: canonical presentation metadata, country/language/category, logo status/provenance, EPG mapping metadata/state.
Does not own: stream URLs, source ordering, verifier state, playback routes.
Rule: stable WebV2 channel id and EPG provider id are different concepts.

## Source Format Registry
Owns: source format identity, detection, capability metadata, transport-vs-media classification, legacy compatibility mapping.
Does not own: network verification, trust, saving, playback success.

## M3U Container Core
Owns: pure structural M3U parsing in `src/core/m3u-container.js`: EXTINF recognition, neutral attribute/title/duration extraction, ordered source candidates, primary source-line association, structural offsets, and intervening directives/comments.
Does not own: channel matching, accepted URL schemes, source-format classification, trust, save eligibility, ranking, STRM resolution, Enigma2 parsing, verification, or playback.
Rule: **shared parser parses; caller decides.** Channel Catalog, Source Discovery, Source Hunt Worker, and frontend Source Hunt remain policy adapters.
Status: Phase E2 DONE at merge `06383089b6fd7b4a31c468c46c7dd2c21ddfdb14`, with exact-SHA frontend, Discovery, Hunt, Registry and Pages deployment verification plus live Discovery/Hunt checks.

## STRM Structural Core
Owns: pure STRM structure and normalization in `src/core/strm-core.js`: canonical HTTP(S) reference normalization, GitHub blob-to-raw normalization, `.strm` reference recognition, `#KODIPROP` DRM metadata parsing, Kodi header-suffix parsing, first structural media/reference line, and ordered nonblank line metadata needed for caller parity.
Does not own: network fetches, SSRF/private-host policy, request budgets, timeouts, max-body limits, recursion limits, candidate ranking, save/test eligibility, verification status, DRM playback, or Player routing.
Adapters/consumers:
- `src/core/strm-resolver.js`: browser/runtime fetch, cache, failure TTL, in-flight dedupe, recursion, browser-facing resolver API;
- `workers/source-discovery/strm-specific-discovery.js`: Discovery provider security/budgets/reporting/candidate policy;
- `workers/webtv-source-discovery-smart.js`: curated-feed STRM pre-resolution policy, private-host block, resolve limit, DRM auto-promotion rejection;
- `workers/source-huntatonisworkersdev.js`: Hunt fetch/budget/relevance/ranking/final-media acceptance policy;
- `src/route-tooltip.js`: presentation-only STRM detection consumer.
Rule: **shared STRM structure; caller-owned network/security/product policy.** The shared core must remain network-free.
Status: Phase E3a DONE via PR #73 / runtime merge `35c3f7641221b3ad24b3533269e72218d729e241`. Production proof: Frontend #619 SUCCESS; Source Discovery #58 SUCCESS with live all-provider verification and real ERT1 STRM resolution; Source Hunt #6 SUCCESS with live Worker verification; Registry #92 SUCCESS; Pages #451 SUCCESS.

## Enigma2 Structural Core
Owns: pure Enigma2 bouquet/service structure in `src/core/enigma2-core.js`: bouquet `#NAME`, service type, raw reference, one-pass and repeated decoded reference facts, raw/decoded inline name, `#DESCRIPTION` association, ordered line metadata, embedded stream-reference facts, and compact/nonstandard service preservation needed for caller parity.
Does not own: channel matching, allowed service types, accepted protocols, URL/public-target validation, private-host policy, Kodi header allowlisting, ranking, trust, save eligibility, candidate construction, fetch/proxy behavior, verification, playback, or UI.
Adapters/consumers:
- `workers/webtv-source-discovery.js`: service-type policy, one-pass/reference semantics, channel matching, public URL validation and Discovery candidate production;
- `src/source-hunt-enigma2.js`: embedded-scheme selection, repeated decoding behavior, header parsing/allowlisting, private-target filtering, format classification, frontend candidate construction and UI/orchestration;
- `workers/source-hunt-bouquet-proxy.js`: **not a structural parser owner**; owns transport/security only, including HTTPS restriction, host allowlist, timeout, max body and raw bouquet fetch/sanity gate.
Rule: **shared Enigma2 structure; caller-owned matching/header/security/UI policy.** The structural core must remain network-free and the bouquet proxy must not absorb neutral parsing ownership.
Status: Phase E3b DONE via PR #75 / runtime merge `cc7e2128e9257cc431a95abf08f2f286e93d2235`. Production proof: Enigma Ownership #15 SUCCESS; Frontend #655 SUCCESS; Source Discovery #59 SUCCESS; Registry #94 SUCCESS; Pages #453 SUCCESS; post-merge verification confirmed real ERT1 HansSettings Greece `format=enigma2`, HTTP 200, count 1, live Pages cache key and exact Registry runtime SHA.

## Source Hunt
Owns: broad lead hunting/search, provenance/freshness/ranking of leads.
Does not own: final VERIFIED media truth or canonical save state.

## Source Discovery
Owns: normalized provider/candidate contract, candidate metadata/dedupe/provider attribution.
Does not own: broad exploratory search long-term, actual media verification, playback.

## Source Verifier
Owns: resolved HTTP media reachability, redirects, media recognition, required-header handling, DRM/error diagnostics, verification statuses.
Does not own: hunting, saving, player fallback, canonical identity/profile metadata.

## Frontend orchestration
Owns: UI/orchestration of Hunt -> Discovery -> Verifier -> user decision/promotion.
Does not own: duplicate canonical matching/search/verification intelligence.

## Player
Owns: playback execution, route/fallback behavior, browser media interaction.
Does not own: discovery truth, canonical metadata, media verification truth.

## EPG subsystem
Owns: programme data fetching/consumption and presentation behavior under Channel Identity/Profile mapping ownership.
Does not own: independent duplicate channel identity rules.

## TV Cache / health / ranking
Owns: auxiliary runtime cache, route health, ranking support.
Does not own: canonical channel identity/profile/source-format truth.

## Current cleanup boundaries
Implemented shared cores: Channel Identity, Channel Profile ownership, Source Format Registry, M3U Container Core, STRM Structural Core, Enigma2 Structural Core.
Next ownership phase: Hunt / Discovery consolidation, then candidate/proof/save lifecycle cleanup.
