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

---

## 16. Continuation checkpoint · 2026-09-27

This section is the current handoff state for continuing WebV2 work in a fresh conversation. Read this section before making new Source Discovery / Browser Resolver changes.

### 16.1 What is now implemented

The original Source Discovery design above has progressed well beyond documentation. The following runtime pieces are now live and tested:

```text
Discovery frontend
  ↓
webtv-source-discovery
  ├── curated-remote-feeds
  ├── github-public-playlists
  ├── recent-web-search
  ├── strm-specific-discovery
  ├── official-provider-lane
  ├── official-api-resolver
  └── browser-resolved-official
        ↓
webtv-source-verifier
        ↓
VERIFIED Candidate or safe failure classification
```

Cloudflare Workers currently involved in the official-resolution path:

```text
Browser Resolver
https://webtv-browser-resolver.atonis.workers.dev

Source Discovery
https://webtv-source-discovery.atonis.workers.dev

Source Verifier
https://webtv-source-verifier.atonis.workers.dev
```

The Source Discovery Worker uses Cloudflare Service Bindings for both Browser Resolver and Source Verifier. Do not replace these with public same-zone Worker-to-Worker fetches unless there is a proven reason, because the service-binding change fixed earlier same-zone 404 behavior.

Relevant bindings:

```text
env.BROWSER_RESOLVER → webtv-browser-resolver
env.SOURCE_VERIFIER  → webtv-source-verifier
```

### 16.2 Current official resolution orchestration

The frontend `discoverOfficialProvider()` flow is staged:

```text
1. official-api-resolver
2. browser-resolved-official only when still useful
3. official-provider-lane page fallback
```

A trusted `VERIFIED` state from the server is preserved only for `official-api-resolver` when all of the following hold:

```text
trustClass === OFFICIAL
saveEligible === true
verificationStatus === VERIFIED
```

Other external providers cannot claim trusted verification merely by returning `verificationStatus: VERIFIED`.

### 16.3 ERT official API discovery

The official ERT live site exposes a public stream descriptor endpoint:

```text
GET https://live.ertflix.gr/api/stream?channel=<channel-key>
```

The relevant query key is exactly:

```text
channel
```

Supported resolver keys currently include:

```text
ert1
ert2
ert3
ertnews
```

The official API returns an official media descriptor that includes fields such as:

```text
url
primaryUrl
fallbackUrl
type
source
updatedAt
```

The ERT official API resolver chooses the media URL, checks it against the strict broadcaster media-host allowlist, and sends it to the separate Source Verifier before promotion.

### 16.4 ERT1 investigation: root cause established

ERT1 repeatedly produced this pattern from server-side environments:

```text
Official API
→ HTTP 200
→ ert-ucdn.broadpeak-aas.com
   /bpk-tv/ERT1/default/index.mpd
→ HTTP 307
→ ERT CDN target
→ HTTP 401 or occasional 404
→ 0 candidates
```

Safe diagnostics proved all of the following:

```text
Chrome-compatible User-Agent present
Referer present
Origin present
redirect context preserved
no Cookie challenge detected
no WWW-Authenticate challenge detected
no signed query parameters present
queryCount = 0 before redirect
queryCount = 0 after redirect
same MPD pathname preserved
```

The Source Verifier was upgraded to record only safe redirect metadata:

```text
status
from.host
from.pathname
to.host
to.pathname
queryCount
queryKeys
response header NAMES only
hasSetCookie boolean
hasWwwAuthenticate boolean
```

Never expand these diagnostics to print Cookie values, Authorization values, token values or complete signed URLs.

The same ERT1 behavior was reproduced from:

```text
Cloudflare Source Verifier
Cloudflare headless Browser Resolver
GitHub Actions runner
```

Therefore the failure is not a Cloudflare-specific verifier bug.

### 16.5 Control experiment: ERT News proves the pipeline works

ERT News was tested at the same time using the same official API and browser-like request context.

Result:

```text
ERT1
API 200
→ CDN 401
→ no Candidate

ERT News
API 200
→ DASH redirect
→ final HTTP 200
→ DASH recognized
→ VERIFIED
→ candidateCount 1
```

The production `official-api-resolver + SOURCE_VERIFIER service binding` path returned for ERT News:

```text
serviceStatus = 200
status = VERIFIED
verified = true
lastHttpStatus = 200
mediaType = dash
drmDetected = false
candidateCount = 1
```

This proves the resolver/verifier architecture is operational. ERT1 must not be treated as a generic resolver failure merely because its server-side verification is denied.

### 16.6 Region-aware classification

The official-resolution backend now classifies the ERT1/ERT2/ERT3 server-side denial as:

```text
SERVER_REGION_RESTRICTED
```

This classification describes the cloud/server verification environment, not the user's own location.

The frontend behavior is intentionally:

```text
Official API
→ SERVER_REGION_RESTRICTED
→ skip cloud Browser Resolver
→ keep Official Page fallback
```

Reason: the cloud Browser Resolver is in the same general server-side context and already reproduced the same denial, so running Chromium again wastes time/resources. The Official Page fallback must remain available because a real user in an allowed region may still be able to play the broadcaster page.

Discovery UI messaging was updated to explain this path instead of showing a mysterious generic failure:

```text
server verification region-restricted
cloud browser skipped
official page fallback kept
```

Do not change this into a claim that ERT1 is unavailable everywhere.

### 16.7 Browser Resolver improvements completed during the investigation

The Browser Resolver now includes:

- safe request/response diagnostics only
- ERT media observation support for DASH/HLS/direct requests
- strict browser-response success gating to avoid false-positive media candidates
- channel-click retry logic to avoid an ERT page-load race where channel links appear after the first click attempt
- safe final host/path/status diagnostics

The Browser Resolver is a fallback/specialized tool, not the preferred resolver when a clean broadcaster-owned API exists.

Preferred strategy:

```text
Official API first
→ verifier
→ Browser Resolver only when API path does not settle the case
→ official page fallback
```

### 16.8 CI/deployment status at handoff

At the end of this checkpoint:

```text
Source Verifier regression tests              PASS
Source Discovery regression tests             PASS
External Discovery client tests               PASS
Official API resolver tests                   PASS
Browser Resolver tests                        PASS
Browser smoke                                 PASS
Frontend integration audit                    PASS
GitHub Pages build/deploy                     PASS
```

The frontend validation workflow watches both:

```text
tests/**/*.mjs
tests/**/*.html
```

This was fixed after discovering that browser-smoke fixture HTML changes previously did not trigger validation.

Latest relevant UI checkpoint commit from this session:

```text
2f08339ab8ed0f906c18ec26bcea3398f14bcfdd
Show region-restricted official discovery status
```

### 16.9 What the GRTV Android APK investigation established

The uploaded Android APK used for architectural study was inspected statically. Use it only to understand architecture and public/official resolution patterns. Do not copy or expose secret keys, cookies, session tokens, DRM secrets, credentials or unauthorized stream URLs.

Important findings:

1. The app has special handling for ERTFLIX inside a WebView.
2. It observes media requests such as:

```text
.mpd
.m3u8
.mp4
.mpg
```

3. It preserves browser request context such as User-Agent, Referer and other request metadata before handing media to ExoPlayer.
4. Its player architecture knows DRM-related metadata fields including concepts corresponding to:

```text
widevine
license_type
license_key
key_headers
```

These findings do not authorize copying DRM/license material. They show only that the app's resolution path is richer than a plain static media URL.

5. The APK includes a local HTTP proxy on `127.0.0.1:8080` with routes conceptually including:

```text
/proxy_stream.m3u8
/proxy_stream.mpd
/proxy_manifest.mpd
/proxy_dash_wrapper.m3u8
/proxy_dash_segment
/live_updates.m3u8
```

Static analysis indicates this local proxy is mainly for CAST/DLNA, manifest rewriting and local playback adaptation. It is not currently evidence of a remote Greek relay used to bypass ERT geography.

6. The app's custom playlist/config language includes constructs such as:

```text
SERIES$$
|webvod
|webvodphp
|webepg
|webepgphp
|webdeskepg
hub://
|webwivedig
$$stream=
$$sec=
sec:
```

The encrypted remote configuration is known to exist, but secret cryptographic material must never be printed or committed. A previously inspected safe ERT sample resolved to an official ERTFLIX website entry, not a hidden direct ERT1 stream URL.

### 16.10 Current hypothesis to investigate next

The fact that the Android app can play channels that the cloud verifier cannot does NOT yet prove it uses a remote geo-bypass proxy.

The strongest unresolved architectural lead is the app's secondary resolution mechanism around:

```text
sec:
$$sec=
|webwivedig
$$stream=
```

Possible explanations still to distinguish with static analysis:

```text
A. sec: is merely an internal indirection/reference system
B. sec: selects a second public/official source
C. sec: selects an alternate fallback source
D. sec: participates in WebView-to-ExoPlayer handoff
E. another app-owned resolver layer exists before final media selection
```

Do not assume any of these until code evidence supports it.

### 16.11 Immediate next work in the next conversation

Continue with the GRTV APK static analysis first, before changing production WebV2 again.

Exact next sequence:

```text
1. Locate every parser/consumer of `sec:` and `$$sec=`.
2. Trace `|webwivedig` end-to-end.
3. Identify where `$$stream=` and `$$sec=` are turned into runtime objects/URLs.
4. Follow the ERTFLIX-specific WebView branch into the media handoff method.
5. Determine whether the final source comes from:
   - official webpage request interception,
   - another public/official endpoint,
   - a config-selected fallback,
   - local proxy rewriting,
   - or another resolver layer.
6. Record only safe metadata: class/method relationships, host/path families, source type, branching rules.
7. Never expose or persist credentials, cookies, Authorization values, DRM keys/licenses, crypto keys, or hidden unauthorized stream URLs.
8. If a clean public/official alternate ERT path is proven, design a narrow WebV2 provider for it with tests before deployment.
9. Otherwise keep ERT1 as SERVER_REGION_RESTRICTED on server-side verification and move on to other official providers.
```

### 16.12 Broader provider expansion after the GRTV question is settled

Once the GRTV `sec:` / ERTFLIX path is understood, continue official provider expansion one broadcaster at a time:

```text
ANT1
Alpha
Star
SKAI
Open
MEGA
other explicitly registered broadcaster-owned sources
```

For each provider prefer:

```text
official broadcaster API
→ strict official media-host allowlist
→ Source Verifier
→ VERIFIED Candidate
```

Only use Browser Resolver when no clean API exists or the page itself is required for public runtime discovery.

### 16.13 Preserve these invariants

Do not regress any of the following:

```text
D1 My Playlist remains authoritative
Discovery candidates remain temporary until explicit user save
server-side VERIFIED claims are trusted only through the narrow official API trust boundary
Browser Resolver remains fallback, not default
Service Bindings remain the Worker-to-Worker transport
no secret/token/cookie/DRM leakage in diagnostics
no geo/access-control bypass behavior
no automatic saving of official-page fallbacks as IPTV sources
user remains in control of promotion/persistence
```

This checkpoint is the continuation point for the next WebV2 session.
