# Channel Logo Repair

Date: 2026-10-03
Status: proposed bounded slice
Base: `5e83bfb9d6e574325fc60acb1ccfb2a424e89776`

## Problem

WebV2 can already resolve logo provenance correctly, but it has no durable on-demand repair path when a channel has no usable logo or when the supplied Xtream/M3U logo breaks. A large catalog must not trigger thousands of startup searches.

## Product behavior

1. Keep startup non-blocking. No logo web lookup runs on the critical startup path.
2. Use an existing Xtream `stream_icon` / M3U `tvg-logo` immediately as today.
3. If the selected channel has no logo, or its rendered image fails, WebV2 may run one background lookup for that channel only.
4. Add explicit manual controls:
   - **Find logo** for the selected channel.
   - **Repair missing logos** for the current catalog, in bounded batches.
5. Lookup order:
   - tv-logo/tv-logos
   - picons/picons
   - iptv-org logo metadata when a usable tvg-id exists
   - jimgate07/grtv for Greece
6. A discovered community logo is `curated-third-party`, never automatically official/verified.
7. Persist only repaired/overridden results in Registry/D1. Do not copy every Xtream/provider logo into D1.
8. D1 stores the selected logo URL plus provider/provenance metadata. Image bytes remain at the upstream host.
9. Existing verified Channel Profile logos must continue to outrank any repair candidate.

## Persistence

Sparse D1 table keyed by normalized channel id:

- channel_id
- name
- tvg_id
- country
- logo_url
- provider
- source_kind
- source_url
- updated_at

My Playlist reads may overlay this sparse repair table. Temporary/Xtream catalogs receive the same sparse overrides asynchronously through a public read endpoint.

## Safety / load limits

- No startup lookup crawl.
- No full-catalog automatic lookup.
- Manual Repair Missing runs in bounded batches.
- Provider reference documents are fetched only during repair and may be edge-cached.
- Only HTTPS logo URLs are accepted.
- Lookup does not alter playback, EPG, source discovery, Favorites, or playlist persistence ownership.

## Proof of success

The slice is solved only when all are true:

1. Existing channel logo resolution regressions still pass.
2. Provider matching tests prove tv-logo, picons, iptv-org, and grtv fallback behavior.
3. Registry persists a sparse repaired logo with provenance and exposes it again.
4. A repaired My Playlist logo survives reload/export via D1 overlay.
5. Manual **Find logo** works for one selected channel.
6. Manual **Repair missing logos** is batch-bounded and ignores channels that already have a usable logo.
7. Missing/broken selected logo can trigger a non-interactive background repair without blocking startup.
8. Verified profile logo still beats a curated repair candidate.
9. Frontend validation, Registry deployment, Pages deployment, exact-SHA live Registry status, and live asset verification all pass.

## Non-goals

- No automatic mass refresh of all existing logos.
- No image-byte mirroring/CDN in this slice.
- No new channel identity owner.
- No arbitrary search-engine scraping.
- No promotion of community sources to verified provenance.
