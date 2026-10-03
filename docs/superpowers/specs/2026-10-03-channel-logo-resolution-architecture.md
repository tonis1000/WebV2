# Channel Logo Resolution Architecture

Date: 2026-10-03
Scope: bounded frontend metadata slice

## Problem

WebV2 currently treats a channel logo mostly as a URL. Known Channel Profiles can override a stored logo, but the runtime does not expose whether that logo is official, Wikimedia-backed, curated third-party, or merely supplied by a playlist/Registry row. This makes future channels work inconsistently and can make third-party image hosts look more authoritative than they are.

## Goal

Create one deterministic logo-resolution owner that:
- prefers verified provenance over curated or unverified candidates;
- lets a newly added unknown channel display a valid supplied/tvg-logo immediately;
- marks that supplied logo as unverified rather than pretending it is canonical;
- fails closed to the existing placeholder when no safe candidate exists;
- keeps playback, EPG, persistence, discovery and Sidebar ownership unchanged.

## Trust order

1. verified: official broadcaster/media group/publisher, Wikimedia Commons, or explicit registry-verified metadata
2. curated: manually curated third-party baseline
3. unverified: playlist tvg-logo, Registry row logo, other channel-provided URL
4. none: placeholder

## Non-goals

- No web search during startup or rendering.
- No automatic scraping of broadcaster sites.
- No persistence/schema migration.
- No replacement of the existing 24 logos merely to make this slice pass.
- No playback, Source Registry, EPG, Unified Search or Playlist Manager behavior changes.

A future logo-discovery service may produce candidates, but promotion to verified state must feed this same resolver with provenance instead of bypassing it.

## Acceptance proof

- Known official/Wikimedia profile logo outranks playlist logo and reports verified provenance.
- Existing Imgur/ImgBB curated baselines are not mislabeled verified.
- Unknown future channel with valid tvg-logo is immediately usable and explicitly unverified.
- Invalid/missing logo yields placeholder state.
- Existing frontend validation remains green.
- Exact merged SHA deploys to GitHub Pages/Registry and live browser still renders the channel list without errors.
