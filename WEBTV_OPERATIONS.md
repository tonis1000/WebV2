# WebTV V2 · Master Operations Manual

> **Canonical technical guide for the WebTV project**  
> Last architecture update: **2026-09-22**  
> Repository: `tonis1000/WebV2`

Read this file before a structural WebTV change. It records what runs where, what is authoritative, how data moves, how deployment works, and which safety rules must remain true.

## 1. Core rule

**GitHub is the source of truth for code. Cloudflare D1 is the source of truth for the live My Playlist. Cloudflare is the runtime.**

That distinction is important:

```text
GitHub
├── frontend code
├── Worker code
├── deployment workflows
├── legacy seed playlist
└── this operations manual

Cloudflare D1
├── My Playlist              ← ONE live sidebar playlist
├── channel order
├── channel metadata
├── channel sources
└── Saved Playlists
```

The browser is a client/cache. It must not be the only place where important playlist state exists.

---

## 2. Golden rules

1. **My Playlist in D1 is the only permanent live sidebar playlist.**
   - Normal page startup reads `GET /api/my-playlist`.
   - The sidebar is built from that result.
   - Do not reintroduce a GitHub playlist as a competing startup catalog.

2. **`data/channels.m3u` is legacy seed/archive only.**
   - On 2026-09-22 its 13 channels were migrated into D1.
   - It is not read by normal runtime startup anymore.
   - Keep it only as historical/bootstrap material unless we deliberately decide otherwise.

3. **Saved Playlists are libraries, not alternate permanent sidebars.**
   - They live in D1.
   - They can be loaded temporarily for browsing.
   - A selected channel can then be added to My Playlist.
   - Reloading the page always returns to D1 My Playlist.

4. **All playlist writes stay protected.**
   - Public reads are intentional.
   - Add/edit/remove/reorder/source-save/playlist-save/rename/delete require a valid trusted-device session.

5. **Prefer granular writes.**
   - Add one channel → write one channel.
   - Remove one channel → delete one My Playlist membership.
   - Save a verified source → update that channel.
   - Reorder → update only `my_playlist.position` values.
   - Do not full-replace the library merely because the DOM rerendered.

6. **Never commit secrets.**
   - API tokens, PINs and API keys stay in GitHub Secrets or Cloudflare Worker secrets.

7. **A deploy is not finished until live verification passes.**

8. **If architecture, endpoints, bindings, source-of-truth rules or deployment change, update this file in the same work.**

---

## 3. Runtime architecture

```text
                    PAGE LOAD
                       │
                       ▼
              GitHub Pages frontend
                       │
                       │ public GET
                       ▼
      https://webtv-registry.atonis.workers.dev
                       │
                       ▼
                 Cloudflare D1
                       │
                 My Playlist
                       │
                       ▼
                    SIDEBAR
```

Additional services:

```text
WebTV frontend
   ├── Registry Worker ──► D1
   ├── EPG Proxy ────────► ext.greektv.app XMLTV
   ├── Source Hunt ──────► GitHub / Brave / web / forums
   └── TV Cache ─────────► KV TV_CACHE
```

### Permanent state

- **My Playlist:** D1
- **Saved Playlists:** D1
- **Channel sources belonging to My Playlist:** D1
- **Channel order:** D1 `my_playlist.position`

### Browser state

Browser IndexedDB may cache Saved Playlists for UI speed. Local browser state is not authoritative for My Playlist.

This matters for browsers configured to clear cookies/site data on close: after reopening, WebTV can reconstruct the live sidebar from D1.

---

## 4. My Playlist behavior

### Startup

```text
browser opens page
→ main.js calls GET /api/my-playlist
→ D1 returns ordered channels + sources
→ runtime catalog is built
→ sidebar renders My Playlist
```

No GitHub M3U merge occurs during normal startup.

### Add a channel

Typical flow when browsing a Saved Playlist:

```text
Load Saved Playlist temporarily
→ select channel
→ ★ Add to My Playlist
→ PUT /api/my-playlist/channel
→ D1
→ refresh My Playlist state
```

If the user is still intentionally browsing a temporary Saved Playlist, adding a channel does not forcibly kick the UI back to My Playlist. Press **Show My Playlist** or reload to return to the permanent sidebar.

### Remove a channel

```text
DELETE /api/my-playlist/channel/:id
→ D1 membership removed
→ cloud My Playlist refreshed
→ sidebar refreshed when it is showing My Playlist
```

### Edit a channel

Channel name/group/sources are updated through the protected granular channel endpoint.

### Reorder

Registry v1.5 adds:

```text
PATCH /api/my-playlist/order
Body: { "ids": ["ert1", "ert2", ...] }
```

The endpoint:

- requires authentication
- verifies that the supplied IDs exactly match the current My Playlist set
- returns `409` if the playlist changed concurrently
- updates **only** `my_playlist.position`
- does not replace channels or sources

The Playlist Manager currently exposes ↑ / ↓ controls. After each reorder the D1 order becomes authoritative for every browser/device.

### Verified source save

```text
Source Hunt
→ candidate playback succeeds
→ AUTO-SAVED / Save Source
→ WebTVMyPlaylistAPI.addSourceToCurrent(url)
→ PUT current channel to D1 with merged source set
→ cloud My Playlist refresh
```

Sources coming from the D1 My Playlist are treated by `SourceRegistry` as curated/trusted routes. An old static blocklist must not discard a source that the user has deliberately saved into My Playlist.

---

## 5. Saved Playlists

Saved Playlists are separate from My Playlist.

They are useful for:

- imported IPTV lists
- thematic collections
- candidate libraries
- temporary browsing
- choosing individual channels to add to My Playlist

Supported operations:

```text
Save   → POST /api/playlists
Rename → POST /api/playlists with same id / updated metadata
Delete → DELETE /api/playlists/:id
Read   → GET /api/playlists and GET /api/playlists/:id
```

Saved Playlist reads are public. Writes are protected.

Loading a Saved Playlist is temporary. It does **not** change the permanent startup playlist.

---

## 6. GitHub seed migration history

On **2026-09-22** the old `data/channels.m3u` catalog was migrated into D1 with idempotent UPSERTs.

The seed contained 13 unique channels:

```text
ERT1
ERT2
ERT3
ERT News
ANT1
Alpha TV
SKAI
Open TV
MEGA
MEGA News
Star TV
Action 24
Kontra
```

The migration deliberately did **not** delete existing D1 channels or sources.

After migration D1 contained 15 My Playlist channels because two existing cloud channels were preserved:

```text
RIK Sat
BARAZA TV HD Greek Hits
```

Live verification also confirmed that ERT News retained its 3 previously discovered cloud sources.

The one-time migration workflow was removed after successful verification so it cannot accidentally run again.

---

## 7. Registry Worker

```text
Worker: webtv-registry
URL: https://webtv-registry.atonis.workers.dev
Source: workers/webtv-registry.js
Workflow: .github/workflows/deploy-webtv-registry.yml
D1 binding: DB
Database: webtv-registry
Database ID: 51ab2eab-59a6-4013-9e38-1d154330456a
Target version after D1-primary migration: 1.5
Trusted session lifetime: 180 days
```

### Public endpoints

```text
GET /api/status
GET /api/playlists
GET /api/playlists/:id
GET /api/my-playlist
GET /playlist.m3u
```

### Protected endpoints

```text
POST   /api/playlists
DELETE /api/playlists/:id
PUT    /api/my-playlist/channel
DELETE /api/my-playlist/channel/:id
PATCH  /api/my-playlist/order
POST   /api/my-playlist/replace   # legacy/admin bulk endpoint; avoid for normal UX
```

### Authentication

```text
6-digit PIN
→ POST /api/login
→ signed session token
→ browser stores token
→ Authorization: Bearer <token> on writes
```

Cloudflare secrets:

```text
ADMIN_PIN
ADMIN_TOKEN
```

`ADMIN_TOKEN` signs sessions. Rotating it invalidates existing trusted sessions.

If the browser deletes local site data, the trusted token is also deleted. Public reads still work; the next protected write asks for the PIN again.

---

## 8. Frontend ownership map

```text
index.html
  page structure + module loading

src/main.js
  primary runtime catalog
  D1 My Playlist startup read
  sidebar/player selection
  temporary playlist display bridge

src/playlist-manager.js
  My Playlist management
  Saved Playlist library
  granular D1 mutations
  reorder controls

src/cloud-read-sync.js
  Saved Playlists public cloud read + IndexedDB cache
  DOES NOT merge My Playlist anymore

src/pin-auth.js
  trusted-device session

src/core/source-registry.js
  combines curated D1/direct sources with background TV Cache sources
  scores/cooldowns playback routes

src/saved-sources-ui.js
  verified source save flow

src/source-hunt-engine.js
src/source-hunt-web.js
  source discovery

src/sidebar-now.js
  sidebar now-playing EPG + timeline
```

`src/cloud-auto-sync.js` is not loaded by `index.html`. DOM mutation must not trigger full D1 replacement.

---

## 9. EPG rules

EPG Worker:

```text
Worker: epg-proxy-gr
URL: https://epg-proxy-gr.atonis.workers.dev
Source: workers/epg-proxy-gr.js
Upstream: https://ext.greektv.app/epg/epg.xml
```

Sidebar timeline agreement:

```text
GREEN = current programme already played
RED   = time remaining
NO CURRENT EPG = no timeline
```

There is no percentage text.

---

## 10. Source Hunt

```text
Worker: source-huntatonisworkersdev
URL: https://source-huntatonisworkersdev.atonis.workers.dev
Source: workers/source-huntatonisworkersdev.js
Secret: BRAVE_API_KEY
```

Discovery philosophy:

- recent GitHub activity
- active M3U playlists
- fresh web results
- forums / Reddit/community evidence
- known seeds as candidates, not automatic truth

A found URL is not trusted merely because it was discovered. Successful real playback is the verification boundary before a source is saved.

---

## 11. TV Cache

```text
Worker: tv-cache
URL: https://tv-cache.atonis.workers.dev
Source: workers/tv-cache.js
KV binding: TV_CACHE
Namespace ID: 555321f94d8f4ed7b86a77f231da0a30
```

Important resources:

```text
/channel-streams.json
/proxy-map.json
/proxy?url=...
```

TV Cache/background sources can supplement playback. D1 My Playlist sources have priority as curated routes.

---

## 12. Deployment model

Repository secret:

```text
CLOUDFLARE_API_TOKEN
```

Never print or commit its value.

Canonical Worker sources:

```text
workers/webtv-registry.js
workers/epg-proxy-gr.js
workers/source-huntatonisworkersdev.js
workers/tv-cache.js
```

Corresponding workflows:

```text
.github/workflows/deploy-webtv-registry.yml
.github/workflows/deploy-epg-proxy-gr.yml
.github/workflows/deploy-source-hunt.yml
.github/workflows/deploy-tv-cache.yml
```

Normal flow:

```text
change canonical source
→ review / branch if risky
→ merge to main
→ GitHub Action
→ Wrangler deploy
→ Cloudflare propagation wait
→ live verification
```

Registry deployment verification for v1.5 must confirm:

- `version === 1.5`
- `primaryPlaylist === "d1"`
- session lifetime is 180 days
- public `/api/my-playlist` contains the migrated playlist

---

## 13. How to change WebTV safely

### Before editing

1. Read this manual.
2. Read the current `main` code, not an old pasted copy.
3. Identify the owner of the behavior.
4. Identify what must remain true.

### During editing

5. Prefer a branch for structural work.
6. Keep the change coherent and small enough to reason about.
7. Keep D1 writes authenticated.
8. Do not introduce another permanent playlist source competing with D1 My Playlist.
9. Update asset cache-busting when frontend modules change.
10. Validate JavaScript syntax.

### Before merge

11. Review the diff for unrelated changes.
12. Check Worker bindings/secrets are preserved.
13. Check all new API routes have the correct auth model.
14. Confirm no secret value appears in source.

### After merge

15. Watch GitHub Actions through the **live verification** step.
16. Test the actual WebTV behavior, not just deployment success.
17. For playlist changes, test at minimum:
    - clean page load
    - sidebar channel count/order
    - channel playback
    - Add to My Playlist
    - Remove
    - Reorder
    - source save
    - Saved Playlist temporary load
    - page reload returns to My Playlist
18. Update this manual if the architecture changed.

---

## 14. Troubleshooting

### Sidebar shows old source count

First check whether the sidebar is showing D1 My Playlist or a temporary playlist view. With D1-primary startup, a clean page load should already contain D1 sources before first render.

### D1 source exists but player ignores it

Check `src/core/source-registry.js`. D1/direct curated sources must be in the trusted set and should not be filtered by an old static blocklist.

### PIN is requested again after browser restart

If the browser clears localStorage/site data on close, this is expected. The My Playlist remains in D1; only the trusted-device token was removed.

### Reorder returns 409

The playlist changed between read and reorder. Reload My Playlist and reorder again. This is a safety feature against overwriting concurrent changes.

### Worker deploy succeeds but verification initially sees old version

Cloudflare edge propagation can lag the Wrangler upload. Workflows retry before declaring failure.

### Dashboard hotfix

If a Worker is ever edited directly in Cloudflare Dashboard, copy that exact change back into the canonical `workers/*.js` file immediately. Otherwise a future GitHub deploy will overwrite it.

---

## 15. Current architecture checkpoint · 2026-09-22

The intended steady state is:

```text
ONE My Playlist
      │
      ▼
Cloudflare D1
      │
      ├── ordered channels
      ├── sources per channel
      └── metadata
      │
      ▼
sidebar on every page load
```

Saved Playlists remain independent cloud libraries. GitHub keeps code and the legacy seed file, not the live channel state.

This is the architecture to preserve unless we explicitly decide together to change it.

---

## 16. Source handling checkpoint + next step · 2026-09-24

### Current state

Recent source-handling work added support for temporary IPTV playlists that contain indirections and Kodi-style URL syntax.

Current runtime behavior:

```text
external M3U
→ channel directUrls
→ SourceRegistry
→ optional .strm resolution
→ direct HLS route
→ optional TV Cache Worker route
→ PlayerController
```

Implemented and already merged:

- `.strm` references are resolved lazily at playback time by `src/core/strm-resolver.js`.
- Resolution is cached in memory and duplicate/in-flight requests are deduplicated.
- Nested `.strm` references are bounded.
- Temporary external playlist sources remain untrusted until explicitly saved into D1 My Playlist.
- `403` may receive one Worker rescue attempt.
- `404/410` are treated as terminal for the same source and should not waste time retrying the sibling route.
- IPTV/Kodi suffix syntax after `|` is currently stripped from the browser media URL so it does not corrupt HLS detection, route identity or Worker URL construction.

Example source syntax:

```text
https://example.com/live.m3u8|user-agent=Mozilla/5.0&referer=https://example.com/&origin=https://example.com
```

Today the browser-facing URL becomes:

```text
https://example.com/live.m3u8
```

This is correct for streams where the suffix is unnecessary, but it creates an important compatibility gap.

### Known compatibility gap

Some IPTV streams work in Kodi/VLC only because the values after `|` are converted into real HTTP request headers.

Possible examples:

```text
User-Agent
Referer
Origin
```

A browser cannot reliably apply these arbitrary headers to HLS requests from `hls.js`. If WebTV simply strips the Kodi options, a source that is actually valid may return `403` and be incorrectly treated as dead.

Therefore **we may currently lose channels that depend on Kodi/VLC request headers**.

### NEXT FEATURE: Kodi/VLC header-aware proxying

The next implementation task is to preserve supported Kodi URL options and apply them through the TV Cache Worker instead of discarding them.

Target architecture:

```text
raw IPTV source
https://example.com/live.m3u8|user-agent=UA&referer=https://site.example/
        │
        ▼
parse IPTV/Kodi options
        │
        ├── cleanUrl: https://example.com/live.m3u8
        └── headers:
              User-Agent: UA
              Referer: https://site.example/
        │
        ▼
SourceRegistry route model
        │
        ├── direct route uses clean URL only
        └── worker route carries approved header metadata
        │
        ▼
TV Cache Worker
        │
        ├── validates/whitelists allowed headers
        ├── sends approved headers upstream
        ├── rewrites HLS child URLs through the Worker
        └── preserves the same approved headers for child playlists and segments
```

### Required implementation ownership

#### `src/core/utils.js`

Add parsing that returns both the underlying URL and supported Kodi options instead of permanently discarding the options.

Conceptually:

```js
parseIptvUrl(raw) => {
  url,
  headers
}
```

Do not break existing `cleanUrl()`, HLS detection, health keys or route dedupe.

#### `src/core/source-registry.js`

Carry approved header metadata with a route.

A route may need fields conceptually similar to:

```text
originalUrl
playbackUrl
route
saved
requestHeaders
```

The exact representation can differ, but header-dependent sources must retain enough metadata for Worker playback.

#### `workers/tv-cache.js`

Add safe support for approved upstream request headers.

Do **not** allow arbitrary client-controlled header injection.

Initial whitelist should be deliberately small:

```text
User-Agent
Referer
Origin
```

`Cookie`, `Authorization`, proxy headers, Cloudflare headers and other sensitive headers are **not automatically allowed**. Adding any sensitive header class requires a separate deliberate security decision.

### HLS propagation requirement

Supporting headers only on the first master `.m3u8` request is not sufficient.

The same approved header context must survive across:

```text
master.m3u8
→ variant/child playlist.m3u8
→ encryption/key request if applicable
→ .ts / .m4s segments
```

If the Worker rewrites child URLs, the rewritten Worker URLs must retain a safe reference to the approved header context so every upstream HLS request receives the required headers.

Do not expose secrets or raw sensitive header values unnecessarily in logs or persistent storage.

### Security constraints

The feature must preserve these rules:

1. Never forward arbitrary headers supplied by a playlist.
2. Maintain an explicit allowlist.
3. Reject CR/LF and malformed header values.
4. Do not allow callers to override `Host`, `Content-Length`, Cloudflare/proxy headers or authentication headers.
5. Do not persist temporary playlist header metadata into D1 unless we explicitly design a schema and trust model for it later.
6. D1 My Playlist remains the only permanent live playlist source of truth.
7. Header-aware proxying is playback transport behavior, not a new playlist authority.

### Fallback policy

Desired behavior for an HLS source carrying Kodi options:

```text
1. normalize + parse source
2. direct clean URL may be tried when appropriate
3. if direct works → use direct
4. if direct fails with browser/CORS/403 → try Worker with approved parsed headers
5. if Worker succeeds → record route health success
6. if Worker fails with terminal 404/410 → quarantine the source
7. avoid repeated retries during cooldown
```

For a source whose options clearly require proxy-only behavior, we may later choose to prioritize the Worker route. Make that decision from verified logs rather than guessing.

### Acceptance tests

Before considering the feature complete, verify at minimum:

1. A normal HLS URL with no Kodi options still plays exactly as before.
2. A URL containing `|user-agent=...` is not sent literally to the browser/upstream.
3. A URL containing `|referer=...` reaches the Worker with an approved Referer value.
4. A URL containing `|origin=...` reaches the Worker with an approved Origin value.
5. Unsupported/malicious header names are ignored or rejected.
6. CR/LF header injection is rejected.
7. HLS master playlist loads with required headers.
8. Variant playlist loads with the same header context.
9. Segments load with the same header context.
10. Existing `403` Worker rescue behavior still works.
11. Existing `404/410` terminal sibling suppression still works.
12. Existing `.strm` resolution still works.
13. Source health/cooldown continues to identify routes consistently.
14. Temporary external playlist remains temporary and page reload returns to D1 My Playlist.
15. Existing D1 playlist reads/writes and Source Hunt behavior remain unchanged.

### Recommended first regression samples

Use the existing external playlist that exposed the issue:

```text
https://raw.githubusercontent.com/don24crk/Don24crk-Repository/refs/heads/master/android.m3u
```

Check especially entries that use:

- `.strm` indirection such as MAK/MTV
- Kodi-style `|user-agent=...` syntax such as MADTV-style entries
- normal Siliconweb HLS entries to ensure no regression

The goal is **not** to force every broken upstream stream to work. The goal is to stop losing otherwise valid Kodi/VLC-compatible channels merely because WebTV ignored required request-header metadata.
