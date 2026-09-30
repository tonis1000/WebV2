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
Implemented shared cores: Channel Identity, Channel Profile ownership, Source Format Registry, M3U Container Core, STRM Structural Core.
Pending next primitive: Enigma2 normalization (E3b), then search/lifecycle consolidation.
