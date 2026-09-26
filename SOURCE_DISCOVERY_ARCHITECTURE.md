# WebTV V2 · Source Discovery Architecture

> Design checkpoint agreed on **2026-09-26**.
> This document describes the next-generation source discovery system before implementation.
> It is intentionally separated from the player/runtime so the existing WebTV experience stays stable.

## 1. Goal

Build a professional Source Discovery system that can find, normalize, verify and present candidate sources for channels without slowing down or destabilizing the currently loaded player/sidebar.

The user keeps final control over what becomes a permanent source.

```text
DISCOVERY can find
VERIFIER can test
HEALTH can score
USER decides what is saved
```

No discovery result becomes a permanent My Playlist source automatically.

---

## 2. Non-negotiable safety boundary

The Source Discovery system must be isolated from the normal WebTV runtime.

```text
PLAYER + SIDEBAR
  └── only work with the currently loaded playlist/catalog

DISCOVERY
  └── runs separately and stores temporary candidate results

ONLY explicit user action
  └── may add a verified source to My Playlist
```

Discovery must not:

- reload the sidebar
- replace the current playlist
- mutate the selected channel
- trigger player playback unless the user explicitly asks to verify a candidate
- run DOM-wide MutationObservers
- force D1 My Playlist refreshes while scanning
- block normal channel selection/playback
- continuously scan in the background without user action

The current player/sidebar remains the priority runtime.

---

## 3. Core model: Channel, Source, Route

These are different objects and must stay separate.

```text
CHANNEL
  Example: MEGA

SOURCE
  Example: M3U URL, Xtream stream, STRM, HLS, DASH

ROUTE
  Example: direct, worker, worker+headers
```

One source may generate multiple playback routes.

Example:

```text
SOURCE
https://example.com/mega.m3u8

ROUTES
1. direct
2. worker
```

The sidebar star/count may describe routes, while the Sources editor remains the user's list of actual sources.

---

## 4. Unified Source Candidate model

Every discovered candidate is normalized into one common structure before verification.

Conceptual model:

```text
Candidate
- candidateId
- channelName
- normalizedChannelName
- sourceType
- sourceUrl
- sourceOrigin
- discoveredAt
- discoveryProvider
- freshness
- requiredHeaders
- xtreamAccountRef
- xtreamStreamId
- verified
- verificationStatus
- startupMs
- lastHttpStatus
- mediaType
- drmDetected
- healthScore
- duplicateOf
- matchConfidence
```

Supported candidate types should include:

- M3U / M3U8
- HLS
- DASH / MPD
- STRM
- direct media URLs
- Xtream live streams
- sources requiring approved headers
- known remote feeds
- official streams, kept in a separate trust lane where appropriate

This model is temporary discovery state until the user explicitly saves a source.

---

## 5. Search lanes

Discovery runs through several independent lanes. Results are merged only after normalization.

### 5.1 Xtream

Search inside user-authorized Xtream accounts and provider/demo accounts the user is entitled to use.

When a channel is found through Xtream, preserve enough account context to let the user choose between:

```text
Add only this channel source
or
Save / connect the whole Xtream account
```

For an authorized Xtream account the system should keep:

```text
Server
Username
Password
Stream ID
Account reference
```

Credentials must never be written into GitHub source code or logs.

If an M3U URL supplied by the user is an Xtream-style URL such as `get.php?...`, WebTV may detect the server/account fields automatically and offer to import the account.

Public search may discover provider/server leads and recent public references, but WebTV must not harvest, store or use credentials that the user is not authorized to use.

Default freshness for recent public Xtream-related discovery: **last 7 days**.

Optional search windows later:

- last 24 hours
- last 7 days
- last 30 days

### 5.2 M3U / M3U8

Search sources may include:

- known public playlists
- trusted remote feeds
- GitHub repositories / raw playlist files
- recent public web results
- user-supplied playlists

Extract channel entries, normalize names and collect stream candidates.

### 5.3 HLS

Look for `.m3u8` endpoints in:

- public playlists
- GitHub code / raw files
- known feeds
- official/public broadcaster pages where appropriate
- discovered STRM targets

Every HLS candidate must be verified before it can be offered as save-ready.

### 5.4 DASH

Look for `.mpd` endpoints in:

- official/public pages
- GitHub/public repositories
- known feeds

Verification must detect DRM status. DRM detection is metadata, not automatic proof that the stream is playable by the current WebTV player.

### 5.5 STRM

Search repositories/lists containing `.strm` references.

```text
STRM candidate
→ resolve reference
→ obtain real media URL
→ classify HLS / DASH / direct media
→ verify final media
```

The `.strm` reference itself is not considered verified playback until its final target works.

### 5.6 Public GitHub sources

Use GitHub as one discovery provider, not as the only source of truth.

Search channel aliases together with patterns such as:

```text
m3u8
mpd
EXTINF
strm
HLS
```

Known useful repositories may be checked directly instead of searching the entire GitHub universe every time.

### 5.7 Known remote feeds

Maintain a curated registry of remote feeds that are worth checking repeatedly.

Each feed has metadata such as:

```text
name
url
type
lastChecked
trustClass
freshness
```

Remote feeds produce candidates only. They do not become permanent playlist authorities.

### 5.8 Official sources

Official live pages / broadcaster endpoints remain a separate trust lane.

The system may search:

- official live pages
- official web players
- official HLS/DASH endpoints
- approved official embeds

Official fallbacks must remain separate from normal IPTV candidate auto-save behavior unless the architecture is explicitly changed later.

### 5.9 Recent public posts / repositories

Default window: **last 7 days**.

Search recent public material for channel aliases and source patterns.

Recent does not mean trusted. A recent result still has to pass normalization, channel matching and verification.

---

## 6. Channel identity and matching

The system must recognize that channel names can vary.

Example aliases:

```text
MEGA
MEGA TV
MEGA HD
MEGA Greece
mega.gr
```

Candidate matching should use multiple signals:

- normalized channel name
- tvg-id
- domain / broadcaster identity
- group/country/language
- logo similarity where available
- provider metadata

Suggested confidence classes:

```text
HIGH       likely same channel
MEDIUM     possible match, user confirmation required
LOW        do not merge automatically
```

No uncertain candidate should be merged silently into an existing channel.

---

## 7. Verification before Save

A discovered URL is only a candidate.

```text
FOUND
→ NORMALIZE
→ MATCH CHANNEL
→ VERIFY
→ RESULT
→ USER DECISION
```

Verification should answer, as applicable:

- HTTP reachable?
- manifest valid?
- HLS/DASH recognized?
- stream actually starts?
- startup time?
- needs Worker?
- needs approved headers?
- terminal 404/410?
- 403/direct failure but Worker success?
- DRM detected?
- final resolved URL for STRM?

A candidate may have states such as:

```text
VERIFIED
FAILED
TIMEOUT
HTTP 403
HTTP 404
DRM
WRONG CHANNEL
UNRESOLVED
```

Only a verified source becomes save-ready.

Failed candidates may still be shown in an expandable diagnostic view, but they should not clutter the main result list.

---

## 8. Result ranking

Ranking is for discovery results only. It must not rewrite the user's permanent source order.

Possible ranking signals:

- verification success
- freshness
- startup latency
- repeat reliability
- source provenance
- duplicate status
- channel-match confidence
- route compatibility

The user must still decide what to save.

---

## 9. User experience

The intended flow should be simple:

```text
Select a channel
→ Find Sources
→ WebTV searches separately
→ Verify candidates
→ Results
→ user chooses
     Add to this channel
     Save as separate channel
     Save/connect Xtream account
     Ignore
```

Recommended result card:

```text
MEGA

Type: Xtream / HLS / M3U / STRM / DASH
Origin: provider / GitHub / remote feed / official
Verified: Yes / No
Startup: 420 ms
Freshness: 2h
Match: High
Routes: direct / worker

[Add to MEGA]
[Save separately]
[Details]
```

For Xtream candidates from an authorized account, optionally expose:

```text
[Add channel source]
[Open account catalog]
[Save account]
```

Sensitive credentials must not be displayed casually in result cards.

---

## 10. Runtime isolation and performance

This is the most important implementation rule.

Heavy work belongs outside `main.js`.

Recommended ownership:

```text
src/main.js
  player + sidebar only

src/discovery/discovery-ui.js
  open/close discovery panel, result rendering

src/discovery/discovery-client.js
  calls backend discovery endpoints

src/discovery/candidate-model.js
  normalization

src/discovery/channel-matcher.js
  matching / confidence

src/discovery/verifier-client.js
  candidate verification requests

Cloudflare discovery Worker
  external search
  remote feed reads
  bounded probing
  temporary result cache
```

Do not attach DOM-wide MutationObservers.

Do not periodically rerender the sidebar because discovery progressed.

The browser should receive lightweight progress/results only.

Recommended request lifecycle:

```text
user presses Find Sources
→ create discovery job
→ backend searches in bounded batches
→ frontend polls or receives progress
→ results appear in discovery panel
→ player/sidebar remain untouched
```

Discovery jobs should be cancellable.

---

## 11. Storage policy

### Permanent

Keep existing authoritative rules:

```text
My Playlist + saved channel sources → Cloudflare D1
Saved Playlists                  → Cloudflare D1
```

### Temporary discovery state

Use a separate temporary store, for example Worker/KV/D1 discovery tables with expiration.

Candidate results must not enter My Playlist tables simply because they were discovered or verified.

Only an explicit protected user action may promote a candidate into My Playlist.

---

## 12. Security and privacy

- Never commit Xtream passwords/tokens to GitHub.
- Do not place credentials into diagnostic logs.
- Encrypt stored Xtream secrets server-side using the existing Xtream secret design.
- Never expose another account's credentials to the browser.
- Treat public web results as untrusted input.
- Only approved request-header classes may be proxied.
- Validate/normalize every external URL before use.
- Bounded timeouts and concurrency are mandatory.
- Do not automate the collection/use of credentials the user is not authorized to use.

---

## 13. Integration strategy: do not break the repository

Implementation must be phased.

### Phase 0 · Documentation only

Status: **DONE** by this document.

No runtime behavior changed.

### Phase 1 · Discovery shell

Add a standalone discovery panel and modules with mocked/local results only.

Acceptance test:

```text
WebTV clean load
→ same sidebar count/order
→ current channels play normally
→ open/close Discovery panel
→ no playlist/player state changes
```

Rollback: remove only discovery entry/module imports.

### Phase 2 · Candidate model + local sources

Normalize only existing safe local inputs first:

- current My Playlist sources
- Saved Playlists
- authorized Xtream accounts

No general web search yet.

Acceptance test:

- candidate normalization produces correct source types
- no D1 write occurs during search
- normal playback is unchanged

### Phase 3 · Separate verifier

Add verification service with strict concurrency/timeouts.

Acceptance test:

- one known working source becomes VERIFIED
- one dead source becomes FAILED
- sidebar/player remain responsive throughout

### Phase 4 · External discovery providers

Add providers one by one:

1. curated remote feeds
2. GitHub/public playlists
3. recent web results
4. STRM-specific discovery
5. official lane
6. authorized Xtream expansion

Each provider gets its own kill switch and regression test.

### Phase 5 · Save/promote actions

Only after discovery/verifier are stable:

```text
verified candidate
→ explicit user click
→ protected D1 mutation
→ refresh affected channel only where possible
```

No bulk My Playlist replacement.

---

## 14. First implementation steps

The first three code changes should be deliberately small.

### A. Add isolated Discovery panel

No real search yet.

Verify:

- player works before, during and after panel use
- sidebar is unchanged
- no extra D1 reload loop
- no global observers

### B. Add Candidate normalizer

Feed it controlled examples for:

- M3U8/HLS
- DASH
- STRM
- Xtream
- header-aware source

Verify using unit tests only.

### C. Add verifier endpoint/client

Test a tiny controlled set of known good/bad URLs.

Verify:

- bounded timeout
- bounded concurrency
- cancellation
- no UI freeze

Only after these pass should general discovery search be connected.

---

## 15. Definition of success

The project succeeds when the user can:

```text
choose a channel
→ Find Sources
→ see fresh candidates from multiple source types
→ know where each came from
→ know whether it really plays
→ understand whether it is HLS/DASH/STRM/Xtream/etc.
→ choose exactly what to save
```

while at the same time:

```text
current playback remains smooth
sidebar remains fast
D1 My Playlist remains authoritative
manual source control remains untouched
AUTO Health remains advisory for playback ordering
```

That separation is the architectural contract for Source Discovery.
