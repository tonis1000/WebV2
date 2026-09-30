# WebV2 Architecture Ownership Map

Rule: one canonical owner per responsibility. Wrappers/adapters may exist, but they do not acquire canonical ownership.

## Registry / D1
Owns: persistent cloud state, My Playlist persistence, Favorites/cloud state, Saved Playlist truth, project checkpoints, deploy status.
Does not own: channel identity semantics, format verification, playback.

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
Implemented shared cores: Channel Identity, Channel Profile ownership, Source Format Registry.
Pending shared primitives: M3U/container parsing (E2), STRM/Enigma2 normalization (E3), later search/lifecycle consolidation.
