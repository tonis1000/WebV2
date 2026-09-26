# WebTV V2 · Master Operations Manual

> **Canonical technical guide for the WebTV project**  
> Last architecture update: **2026-09-26**  
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
   ├── Registry Worker ────────► D1
   ├── EPG Proxy ──────────────► ext.greektv.app XMLTV
   ├── Source Hunt ────────────► GitHub / Brave / web / forums
   ├── Source Discovery ───────► bounded external discovery providers
   ├── Source Verifier ────────► bounded candidate verification
   └── TV Cache ───────────────► KV TV_CACHE
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
  preserves approved IPTV/Kodi header metadata for Worker playback

src/core/strm-resolver.js
  lazily resolves .strm indirections and preserves final Kodi-style URL options

src/core/official-fallbacks.js
  validates configured official fallbacks
  generates official discovery searches
  keeps official embed trust separate from IPTV source trust

src/saved-sources-ui.js
  verified source save flow

src/source-hunt-engine.js
src/source-hunt-web.js
  legacy stream discovery + separate official fallback discovery lane

src/source-hunt-oneclick.js
  legacy one-click testing/saving path
  remains operational during Source Discovery V2 migration

src/discovery/candidate-model.js
  normalized temporary discovery candidate contract

src/discovery/discovery-state.js
  in-memory local/external candidate state
  no permanent persistence

src/discovery/local-data-reader.js
src/discovery/local-candidates.js
  read-only local Discovery lanes

src/discovery/external-discovery-client.js
  dedicated browser client for Phase 4 external provider requests

src/discovery/verifier-client.js
  dedicated browser client for separate candidate verification

src/discovery/discovery-ui.js
  Phase 4 panel orchestration
  explicit Local / External / Verify actions only
  no Save/Add/Promote action

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
- official broadcaster/YouTube/live/embed discovery as a **separate fallback lane**

A found stream URL is not trusted merely because it was discovered. Successful real playback is the verification boundary before a stream source is saved.

Official fallbacks follow different rules:

- they are never mixed into the IPTV candidate list
- they are never auto-saved into D1 channel sources
- they do not participate in normal route health scores/cooldowns
- only explicitly configured and trusted official fallbacks may autoplay after stream routes fail
- discovery links may help locate an official YouTube live, broadcaster live page, official embed, HLS or DASH endpoint, but discovery alone does not make it trusted

Source Hunt therefore has two lanes:

```text
STREAM SOURCES
  GitHub / M3U / Web / Forums / STRM / HLS / DASH
  → real playback test
  → verified stream may be saved to D1

OFFICIAL FALLBACKS
  official YouTube / official live page / official embed / official HLS-DASH
  → provenance + embed/trust verification
  → code-reviewed OFFICIAL_FALLBACKS registry
  → used only after normal stream routes fail
```

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
/?url=...
/?h=<approved-header-context>&url=...
```

The optional `h` context is playback transport metadata only. It is validated by the Worker and may contain only the approved `User-Agent`, `Referer` and `Origin` classes. It is propagated when the Worker rewrites HLS child playlists, URI resources/keys and media segments.

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
workers/webtv-xtream.js
workers/webtv-source-verifier.js
workers/webtv-source-discovery.js
```

Corresponding workflows:

```text
.github/workflows/deploy-webtv-registry.yml
.github/workflows/deploy-epg-proxy-gr.yml
.github/workflows/deploy-source-hunt.yml
.github/workflows/deploy-tv-cache.yml
.github/workflows/deploy-webtv-xtream.yml
.github/workflows/deploy-source-verifier.yml
.github/workflows/deploy-source-discovery.yml
.github/workflows/validate-frontend.yml
```

Normal flow:

```text
change canonical source
→ review / branch if risky
→ merge to main
→ GitHub Action
→ regression/syntax validation
→ Wrangler deploy when a Worker changed
→ Cloudflare propagation wait
→ live verification
```

For TV Cache/header-aware changes, `.github/workflows/deploy-tv-cache.yml` runs `tests/header-aware-proxy.test.mjs` before deployment.

For frontend/source-discovery changes, `.github/workflows/validate-frontend.yml` performs JavaScript syntax checks and runs the shared playback/fallback regression suite plus the Discovery candidate/isolation gates without unnecessarily redeploying unrelated Workers.

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

## 16. Source handling checkpoint + header-aware proxy · 2026-09-24

### Current state

Recent source-handling work added support for temporary IPTV playlists that contain indirections and Kodi-style URL syntax.

Current runtime behavior:

```text
external M3U
→ channel directUrls
→ SourceRegistry
→ optional .strm resolution
→ parse approved IPTV/Kodi options
→ direct clean HLS route
→ optional TV Cache Worker route with approved header context
→ PlayerController
```

Implemented:

- `.strm` references are resolved lazily at playback time by `src/core/strm-resolver.js`.
- Resolution is cached in memory and duplicate/in-flight requests are deduplicated.
- Nested `.strm` references are bounded.
- Final `.strm` media lines retain Kodi-style `|...` options for later safe parsing.
- Temporary external playlist sources remain untrusted until explicitly saved into D1 My Playlist.
- `403` may receive one Worker rescue attempt.
- `404/410` are treated as terminal for the same source and should not waste time retrying the sibling route.
- `src/core/utils.js` parses Kodi-style suffix options while keeping `cleanUrl()` compatible with existing callers.
- `SourceRegistry` creates a clean direct route plus a `worker+headers` route when approved header metadata exists.
- TV Cache validates and forwards only approved `User-Agent`, `Referer` and `Origin` values.
- Worker-rewritten HLS child playlists, URI resources/keys and segments retain the same approved header context.
- Header-context URLs have distinct cache/health identities without changing normal direct-stream identities.

Example source syntax:

```text
https://example.com/live.m3u8|user-agent=Mozilla/5.0&referer=https://example.com/&origin=https://example.com
```

Browser-facing direct URL:

```text
https://example.com/live.m3u8
```

Header-aware Worker route conceptually becomes:

```text
https://tv-cache.atonis.workers.dev/?h=<validated-context>&url=https%3A%2F%2Fexample.com%2Flive.m3u8
```

### Security rules

The header-aware transport preserves these rules:

1. Never forward arbitrary headers supplied by a playlist.
2. Explicit allowlist only: `User-Agent`, `Referer`, `Origin`.
3. CR/LF, control characters, malformed values and overlong values are rejected/ignored according to validation stage.
4. Callers cannot use this mechanism to override `Host`, `Content-Length`, Cloudflare/proxy headers, `Cookie` or `Authorization`.
5. Temporary playlist header metadata is not persisted into D1.
6. D1 My Playlist remains the only permanent live playlist source of truth.
7. Header-aware proxying is playback transport behavior, not a new playlist authority.

### Fallback policy

For an HLS source carrying Kodi options:

```text
1. normalize + parse source
2. direct clean URL remains first when eligible
3. if direct works → use direct
4. if direct fails with browser/CORS/403 → try Worker with approved parsed headers
5. if Worker succeeds → record route health success
6. if Worker fails with terminal 404/410 → quarantine the source/sibling route
7. avoid repeated retries during cooldown
```

### Regression gate

`tests/header-aware-proxy.test.mjs` verifies at minimum:

- normal HLS Worker URL behavior remains unchanged
- Kodi suffix is separated from the browser media URL
- `User-Agent`, `Referer`, `Origin` are preserved in approved context
- unsupported header classes do not enter the approved context
- CR/LF injection is rejected
- `SourceRegistry` emits direct + `worker+headers` routes correctly
- `.strm` resolution preserves final header metadata
- master HLS rewrite preserves header context
- child playlist rewrite preserves header context
- `URI="..."` resources such as keys preserve header context
- segment URLs preserve header context

The TV Cache deployment workflow runs syntax checks plus this regression test before Wrangler deploy.

### Recommended live regression samples

Use:

```text
https://raw.githubusercontent.com/don24crk/Don24crk-Repository/refs/heads/master/android.m3u
```

Check especially:

- `.strm` indirection such as MAK/MTV
- MADTV-style `|user-agent=...` source
- normal Siliconweb HLS sources to ensure no regression

The goal is **not** to force every broken upstream stream to work. The goal is to stop losing otherwise valid Kodi/VLC-compatible channels merely because WebTV ignored required request-header metadata.

---

## 17. Official fallback discovery + playback · 2026-09-24

### Purpose

Official fallbacks are a last-resort playback class, not another source authority.

The runtime order is:

```text
1. curated/direct stream routes
2. Worker/header-aware stream routes
3. resolved STRM/media routes
4. verified official fallback
5. fail cleanly
```

A verified fallback may be an official YouTube live/embed or another explicitly reviewed official player type supported in the future.

### Current implementation

- `OFFICIAL_FALLBACKS` in `src/config.js` is the reviewed registry.
- `src/core/official-fallbacks.js` validates trusted embed hosts and provides discovery searches.
- MADTV currently has a verified official YouTube fallback.
- `PlayerController` tries an official fallback only after normal routes are exhausted or unavailable.
- Official fallback success is shown in Diagnostics but is not written into IPTV route health.
- Source Hunt renders a dedicated **Official Fallback Discovery** lane for every selected channel.
- `Find & Test Best` still tests real stream candidates first. If no working stream is found and a verified fallback already exists, it restores the selected channel and lets normal playback activate that fallback.

### Non-blocking rule

Official discovery must not delay normal playback.

```text
channel click
→ normal playback starts immediately

Source Hunt / official searches
→ user-triggered discovery only
→ no startup dependency
→ no required third-party search response before playback
```

### Persistence rule

Do not save official fallback URLs through `saveBestSourceToCurrent()`.

```text
verified stream URL
→ may enter D1 channel sources

official fallback
→ stays in reviewed code registry
→ separate trust model
→ no D1 source-health identity
```

If official fallbacks are ever moved into D1, that requires an explicit schema with fields for fallback type, provenance, verification status, embed URL, external URL and trust policy. Do not overload the existing stream-source schema.

### Verification rule

Before adding a new official fallback:

1. Confirm broadcaster/channel provenance.
2. Confirm the fallback represents the intended channel, not a clip, show, fan account or unrelated subchannel.
3. Confirm the external URL is HTTPS.
4. For embeds, allowlist the embed host/type explicitly.
5. Confirm the fallback does not bypass normal stream priority.
6. Add/update regression coverage.
7. Merge through normal review/validation.

### Regression gate

`.github/workflows/validate-frontend.yml` runs on relevant frontend changes and checks:

- JavaScript syntax for Source Hunt, save policy, player and official fallback helpers
- shared playback/header regression tests
- trusted MADTV fallback resolution
- rejection of untrusted embed hosts
- official discovery link generation

This keeps discovery/fallback work from causing unnecessary Worker deploys while still giving it a CI gate.

---

## 18. Repository integration audit · 2026-09-24

A repository-wide compatibility review was performed after the header-aware playback and official-fallback work. The goal was to verify that the pieces cooperate as one system instead of merely passing isolated feature tests.

### Audited runtime path

```text
index.html
→ main.js / Playlist Manager
→ D1 My Playlist
→ SourceRegistry
→ optional STRM resolution
→ direct / Worker / worker+headers routes
→ PlayerController
→ route health + cooldown
→ verified official fallback only after stream exhaustion

Source Hunt
→ local + external stream discovery
→ one-click real playback testing
→ verified stream save policy
→ separate official fallback discovery lane
```

The audit covered the loaded frontend modules, relative imports, import-map targets, Source Hunt ordering, D1/playlist ownership, player routing, header-aware Worker behavior, official-fallback isolation, health/cooldown boundaries and deployment workflows.

### Result

The current architecture is internally compatible. No broken local script reference, missing relative import or conflicting Source Hunt wiring was found by the automated integration audit.

Confirmed boundaries:

- D1 remains the only permanent My Playlist authority.
- Temporary external playlists remain temporary until an explicit protected save.
- Header-aware metadata remains transport-only and is not silently persisted to D1.
- Official fallback results are not included in stream candidate auto-test/auto-save collection.
- Verified official fallback playback remains outside normal IPTV route health/cooldown state.
- `Source Hunt engine → external discovery → one-click` load order is intentional and verified.
- Frontend-only changes do not needlessly trigger TV Cache deployment.
- Canonical Worker sources and their deployment workflows are present.

### Exact current stream/fallback priority contract

Do not simplify the current runtime into a claim that every source type has a global hard-coded ranking. The implemented contract is more precise:

```text
1. persistent D1/My Playlist sources are trusted/curated before background TV Cache sources
2. for the same HLS source, DIRECT is attempted before its Worker sibling
3. Worker / worker+headers may rescue browser/CORS/403 failures
4. STRM references resolve lazily into real media routes
5. route health/cooldown influences ordering and suppresses repeated bad routes
6. only after usable stream routes are exhausted does PlayerController use a verified official fallback
7. if no stream and no verified fallback works, fail cleanly
```

### Important source-metadata boundary

The Registry/D1 `channel_sources` table already stores fields such as `origin` and `priority`, and the Registry API returns sources ordered by D1 priority. The current browser catalog, however, primarily consumes the ordered source URLs for playback and does **not** currently enforce a separate automatic `official-origin beats verified-origin` rank for HLS/DASH streams.

Therefore:

- an official HLS/DASH endpoint that is discovered, playback-tested and saved is a normal trusted D1 stream source under the current browser policy
- it is **not** automatically promoted above every other trusted stream merely because its D1 `origin` says `official`
- health, route eligibility, saved/trusted status and existing source order still matter
- official YouTube/embed fallback is a different trust class and remains last-resort through `OFFICIAL_FALLBACKS`

This is a deliberate documentation boundary so future work does not assume an origin-aware stream ranking that has not yet been implemented. If origin-aware ranking is added later, preserve D1 source metadata end-to-end through `main.js`, Playlist Manager, save policy and `SourceRegistry`, then add regression tests before changing this section.

### CI hardening added by this audit

`.github/workflows/validate-frontend.yml` now triggers for:

```text
index.html
src/**/*.js
tests/**/*.mjs
WEBTV_OPERATIONS.md
```

It performs:

1. syntax validation for **every** JavaScript file under `src/`
2. `tests/header-aware-proxy.test.mjs`
3. `tests/frontend-integration.test.mjs`

`tests/frontend-integration.test.mjs` checks at minimum:

- local scripts referenced by `index.html` exist
- import-map targets exist
- relative imports across `src/` resolve to real files
- Source Hunt module load order remains valid
- official fallback result cards cannot leak into stream auto-test/auto-save selectors
- frontend validation and TV Cache deployment triggers stay separated
- canonical Worker and workflow files remain present

### Audit status

At the time this checkpoint was written:

```text
all src JavaScript syntax checks              PASS
header-aware playback/fallback regression     PASS
frontend repository integration audit         PASS
```

Keep this checkpoint as the baseline for later Source Hunt, player, fallback, health or deployment changes.

---

## 19. Source Discovery V2 Phase 1 shell · 2026-09-26

`SOURCE_DISCOVERY_ARCHITECTURE.md` defines the replacement architecture for future source discovery. Phase 1 deliberately introduces only an isolated frontend shell and candidate contract. The legacy Source Hunt remains operational during this migration and is not yet replaced.

### Phase 1 runtime boundary

```text
player + sidebar + SourceRegistry
        │
        └── unchanged

Discovery Phase 1
        ├── read selected channel snapshot only
        ├── in-memory state only
        ├── mock/local candidates only
        └── no save / playback / network / D1 mutation
```

Implemented ownership:

```text
src/discovery/candidate-model.js
  unified temporary Candidate normalization contract
  HLS / DASH / STRM / M3U / direct / Xtream type support
  approved header metadata normalization
  authorized Xtream account context fields with redacted display helper

src/discovery/discovery-state.js
  in-memory panel state
  default freshness 7d
  supported windows 24h / 7d / 30d
  Phase 1 mock candidates only

src/discovery/discovery-ui.js
  standalone Discovery Beta panel
  reads `WebTVPlaylistAPI.getSelectedChannel()` only when opened
  does not import player, SourceRegistry or save policy
```

The shell is loaded by `src/registry-default.js` to avoid adding another large `index.html` edit. This bootstrap relationship does not give Discovery ownership of registry behavior or D1 state.

### Hard Phase 1 prohibitions

Until the next explicitly reviewed phase, Discovery must not:

- call external search providers or the Source Hunt Worker
- call `fetch()` at all
- verify or start playback
- call `WebTVPlaybackAPI` or `PlayerController`
- call My Playlist / Saved Playlist mutation APIs
- persist discovery candidates to D1, localStorage or sessionStorage
- import `src/core/source-registry.js`
- import `src/source-save-policy.js`
- create DOM-wide `MutationObserver` behavior
- reorder permanent sources or routes

The existing `SourceRegistry` MANUAL/AUTO ordering contract remains unchanged. Discovery result ranking is a separate concern and cannot rewrite permanent source order.

### Candidate and Xtream boundary

Phase 1 can represent authorized Xtream account context in temporary Candidate state:

```text
server
username
password
streamId
accountRef
```

Sensitive Xtream passwords must never be rendered directly. `candidateForDisplay()` redacts the password. No real Xtream discovery/search is enabled by Phase 1.

### Regression gate

The frontend validation workflow now runs:

```text
tests/discovery-candidate.test.mjs
tests/discovery-isolation.test.mjs
tests/discovery-browser-smoke.mjs
```

The isolation test rejects accidental references to player/save/D1 APIs, network fetches, browser persistence and global MutationObservers inside the Phase 1 Discovery modules. The browser smoke test opens and closes the panel in headless Chrome and verifies that sidebar/player sentinels remain unchanged.

A Phase 1 commit or CI success is still not sufficient by itself. Before merge, verify the actual branch behavior:

```text
clean WebTV load
→ same My Playlist count/order
→ normal channel playback works
→ open Discovery Beta
→ selected channel unchanged
→ sidebar unchanged
→ playback continues
→ change 24h / 7d / 30d
→ only Discovery state changes
→ close Discovery Beta
→ playback/sidebar remain unchanged
```

Only after those invariants hold should Phase 2 connect safe local sources. External discovery and verification remain later phases.

---

## 20. Source Discovery V2 Phase 2 local sources · 2026-09-26

Phase 2 replaces the Phase 1 mock candidates with **real read-only local candidate lanes**. It still does not perform external discovery, verification, playback testing or persistence.

### Phase 2 local lanes

```text
selected channel
  │
  ├── loaded My Playlist snapshot
  ├── cached Saved Playlists
  └── already loaded authorized Xtream catalog
        │
        ▼
normalize candidates
        │
        ▼
TEMPORARY UNVERIFIED RESULTS ONLY
```

The local lanes are intentionally conservative:

1. **My Playlist**
   - Read from the already loaded `WebTVPlaylistAPI` catalog only when `catalogMode === "cloud"`.
   - Discovery does not trigger a new D1 read just because the panel opens or a local scan runs.
   - If a temporary Saved Playlist/Xtream catalog is currently loaded, the My Playlist lane is skipped rather than forcing a sidebar/cloud reload.

2. **Saved Playlists**
   - `src/cloud-read-sync.js` remains the owner of the IndexedDB cache.
   - It exposes `window.WebTVSavedPlaylistsReadAPI.getAllCached()` as a read-only cache view.
   - Discovery itself does not open IndexedDB, create stores, write records or trigger cloud synchronization.

3. **Xtream**
   - Phase 2 reads only `window.WebTVXtream.getLoaded()`.
   - This means the user must already have loaded an authorized account through Playlist Manager.
   - Discovery does not list accounts, prompt for trusted-device authentication or call the Xtream Worker.
   - Temporary candidate context keeps `accountRef`, `server` and `streamId`.
   - The encrypted provider password remains server-side. Discovery must not reconstruct credentials from playback URLs.
   - Xtream source URLs remain redacted in result cards.

### Matching boundary

Phase 2 deliberately uses conservative exact normalized identity matching across channel `id`, `originalId`, `tvgId` and `name`.

```text
MEGA ↔ MEGA          allowed
MEGA ↔ MEGA News     not merged
```

Fuzzy alias/channel-identity matching belongs to the later dedicated matcher phase. Phase 2 must prefer false negatives over silently attaching a source to the wrong channel.

### Candidate state

All Phase 2 local results remain:

```text
verificationStatus = UNVERIFIED
verified            = false
```

No candidate receives a Save/Add action yet. No candidate is inserted into D1, My Playlist, Saved Playlists, SourceRegistry or route health.

The `24h / 7d / 30d` control remains visible because it is part of the final Discovery contract, but Phase 2 local lanes do not age-filter already-owned local data. The freshness window becomes operative when recent public providers are added later.

### Phase 2 ownership

```text
src/discovery/local-data-reader.js
  read-only snapshots from existing browser-owned APIs
  no fetch
  no D1 endpoint access
  no direct IndexedDB ownership

src/discovery/local-candidates.js
  exact channel matching
  My Playlist candidate normalization
  Saved Playlist M3U candidate normalization
  loaded Xtream candidate normalization
  local deduplication

src/discovery/discovery-state.js
  scan lifecycle + temporary lane counts/results

src/discovery/discovery-ui.js
  explicit Find Local Sources action
  result rendering only
  no verification or save controls

src/cloud-read-sync.js
  remains Saved Playlist cache owner
  adds a read-only cached-playlist accessor for Discovery
```

### Hard Phase 2 prohibitions

Discovery Phase 2 must not:

- call `fetch()`
- call Registry, Source Hunt or Xtream endpoints
- start playback or call `WebTVPlaybackAPI`
- import or mutate `SourceRegistry`
- call source-save policy or My Playlist mutation APIs
- write to D1
- directly read/write IndexedDB from `src/discovery/*`
- use `localStorage` or `sessionStorage` for candidate persistence
- attach `MutationObserver`
- scan automatically in the background
- change MANUAL/AUTO source ordering

### Verification gate

`.github/workflows/validate-frontend.yml` runs the existing regressions plus:

```text
tests/discovery-candidate.test.mjs
tests/discovery-local-sources.test.mjs
tests/discovery-isolation.test.mjs
tests/discovery-browser-smoke.mjs
```

The Phase 2 browser smoke supplies one matching source from each local lane, runs the explicit local scan, confirms three temporary candidates, changes the freshness control, closes the panel and verifies that sidebar/player sentinels remain unchanged.

Acceptance requires all of the following:

```text
existing playback/header regression     PASS
source-ranking regression               PASS
Xtream regression                       PASS
Discovery candidate/state               PASS
Discovery local-source normalization    PASS
Discovery isolation                     PASS
Discovery browser smoke                 PASS
frontend integration audit              PASS
```

Only after these invariants remain green on `main` should the next phase add a verifier. General public discovery providers remain later work.

---

## 21. Source Discovery V2 Phase 3 separate verifier · 2026-09-26

Phase 3 adds **explicit verification** without connecting general public discovery and without allowing any verified candidate to become permanent automatically.

### Runtime boundary

```text
Discovery candidates
      │
      │ user presses Verify / Verify All
      ▼
src/discovery/verifier-client.js
      │
      │ POST /verify
      ▼
webtv-source-verifier Worker
      │
      ├── bounded HTTP/media probe
      ├── HLS/DASH recognition
      ├── DRM marker detection
      └── temporary result only
      │
      ▼
Discovery candidate state

normal player + sidebar + SourceRegistry
      └── unchanged
```

The verifier does **not** call the normal WebTV player and does not write route health. Verification is Discovery metadata only.

### Service ownership

```text
Worker: webtv-source-verifier
URL: https://webtv-source-verifier.atonis.workers.dev
Source: workers/webtv-source-verifier.js
Workflow: .github/workflows/deploy-source-verifier.yml
Version: 1.0
```

The Worker exposes:

```text
GET  /
POST /verify
GET  /fixture/working.m3u8   # controlled Worker fixture
GET  /fixture/dead           # controlled Worker fixture
```

### Bounded verification contract

The initial Phase 3 limits are intentionally small:

```text
Worker upstream timeout      6000 ms
Browser request timeout      7000 ms
Maximum candidates/request   4
Maximum concurrency          2
Maximum inspected body       512000 bytes
```

The browser supports cancellation through `AbortController`. Closing the Discovery panel cancels an active verification job. Verification does not continue as a hidden background task.

### Security boundary

The verifier:

- accepts only HTTP/HTTPS source targets
- blocks localhost, `.local`, link-local and private IPv4 targets
- follows only the existing approved request-header classes: `User-Agent`, `Referer`, `Origin`
- does not forward `Cookie`, `Authorization`, arbitrary playlist headers or browser session tokens
- receives only `candidateId`, `sourceType`, `sourceUrl` and approved `requiredHeaders`
- does not receive Xtream password/context fields from the browser client
- does not read or write D1
- does not call Registry mutation endpoints

The existing Xtream playback URL may be verified as a temporary source URL, but encrypted provider credentials remain owned by the Xtream Worker and are not reconstructed by Discovery.

### Verification semantics

Phase 3 classifies results into the Candidate verification states already defined by the architecture:

```text
VERIFIED
FAILED
TIMEOUT
HTTP 403
HTTP 404
DRM
UNRESOLVED
```

For HLS, a successful HTTP response must also resemble an HLS manifest. For DASH, the body must contain an MPD. DRM markers such as `ContentProtection`, Widevine or PlayReady produce `DRM`, not `VERIFIED`.

This is a bounded manifest/media probe, not a replacement for the normal player. A `VERIFIED` result means the verifier could reach and recognize the candidate; it does not silently promote the candidate into player routing or D1.

### Phase 3 UI

Discovery exposes:

```text
[Verify]        per candidate
[Verify All]    bounded at 2 concurrent requests
[Cancel Verify]
```

Verification metadata can show:

```text
status
startupMs
lastHttpStatus
mediaType
drmDetected
verificationDetail
```

There is still no Save/Add/Promote button in Discovery Phase 3.

### Hard Phase 3 prohibitions

Until Phase 5, Discovery must not:

- save a verified candidate into D1
- call `WebTVMyPlaylistAPI`
- call source-save policy
- mutate `SourceRegistry`
- use `WebTVPlaybackAPI` / `PlayerController`
- alter permanent MANUAL/AUTO source order
- verify automatically in the background
- persist verification results to localStorage/sessionStorage
- expose or transmit Xtream passwords

### Regression and deployment gate

Frontend validation runs:

```text
tests/discovery-candidate.test.mjs
tests/discovery-local-sources.test.mjs
tests/discovery-verifier.test.mjs
tests/source-verifier-worker.test.mjs
tests/discovery-isolation.test.mjs
tests/discovery-browser-smoke.mjs
tests/frontend-integration.test.mjs
```

The verifier tests cover:

- one controlled working HLS source → `VERIFIED`
- one controlled dead source → `HTTP 404`
- DASH DRM marker → `DRM`
- private target rejection
- batch cap
- browser cancellation
- max browser concurrency of 2
- no Xtream secret/context leakage in the verifier payload

The deployment workflow performs a live external gate after Wrangler deploy using exact-commit GitHub fixtures:

```text
GET / → version/limits check
external controlled working HLS → VERIFIED
external deliberately missing URL → HTTP 404
```

Phase 3 is complete only when PR CI, main-branch CI, Worker live verification and Pages deployment are green.

---

## 22. Source Discovery V2 Phase 4 provider #1 · Curated Remote Feeds · 2026-09-26

Phase 4 introduces external discovery **one provider at a time**. The first provider is deliberately narrow: curated public remote playlists. Legacy Source Hunt remains operational and is not used as the backend for this new lane.

### Runtime boundary

```text
selected channel
      │
      │ explicit Find External Sources
      ▼
src/discovery/external-discovery-client.js
      │
      │ POST /discover
      ▼
webtv-source-discovery Worker
      │
      └── provider: curated-remote-feeds
              │
              ├── bounded fetch of curated public playlists
              ├── conservative channel matching
              ├── source normalization
              └── temporary UNVERIFIED candidates only
      │
      ▼
Discovery in-memory state
      │
      ├── merge/dedupe with Local candidates
      └── explicit Verify remains separate

normal player + sidebar + SourceRegistry + D1
      └── unchanged
```

### Service ownership

```text
Worker: webtv-source-discovery
URL: https://webtv-source-discovery.atonis.workers.dev
Source: workers/webtv-source-discovery.js
Workflow: .github/workflows/deploy-source-discovery.yml
Version: 1.0

Browser client:
src/discovery/external-discovery-client.js
```

Endpoints:

```text
GET  /
POST /discover
```

The only enabled Phase 4 provider in this checkpoint is:

```text
curated-remote-feeds
```

Do not silently add another provider to the same release. GitHub/public search, recent web results, STRM-specific discovery, official discovery and authorized Xtream expansion remain separate later provider slices.

### Curated feed registry

The initial provider checks four public remote playlists:

```text
hitnickgr/iptv
jimgate07/grtv
Michatec/Greek-IPTV
Don24crk
```

These feeds are **candidate sources**, not playlist authorities. Their contents never replace My Playlist or Saved Playlists.

### Bounded provider contract

```text
Worker upstream timeout      6000 ms
Browser request timeout      9000 ms
Maximum feed concurrency     2
Maximum unique results       12
Curated feeds/request        4
```

The browser external scan is cancellable with `AbortController`. Closing the Discovery panel cancels an active external request. No hidden/background scan continues after close.

### Kill switches

Provider #1 has two explicit controls:

```text
browser provider flag:
PROVIDER_FLAGS['curated-remote-feeds']

Worker runtime kill switch:
DISABLE_CURATED_REMOTE_FEEDS=1
```

The Worker kill switch returns `503 Provider disabled` only for this provider. It does not disable the verifier, player, Source Hunt, Registry, Xtream or TV Cache services.

### Matching boundary

Provider #1 intentionally avoids fuzzy alias guessing.

It compares normalized selected-channel identity against:

```text
EXTINF title
tvg-name
tvg-id
```

Benign trailing labels may be stripped conservatively:

```text
HD
TV
Channel
Greece
Greek
GR
```

Examples:

```text
MEGA ↔ MEGA HD       HIGH / accepted
MEGA ↔ MEGA TV       HIGH / accepted
MEGA ↔ MEGA News     rejected
```

This prefers false negatives over wrong-channel attachment. A dedicated richer channel matcher can be added later behind its own tests; Provider #1 must not silently become fuzzy.

### Freshness semantics

The UI continues to send the selected `24h / 7d / 30d` value as part of the external provider contract.

Curated M3U entries generally do **not** expose reliable per-entry publication timestamps. Therefore Provider #1 explicitly reports:

```text
freshnessRequested = 24h / 7d / 30d
freshnessApplied   = false
candidate.freshness = "live-feed-check"
```

This means the remote feed itself was fetched during the current scan. It does **not** claim that the channel entry or stream URL was published within the selected age window.

Do not fabricate freshness timestamps from request time. Providers that have reliable dated search results may enforce the requested freshness window later.

### Temporary merge semantics

Local and external Discovery results coexist only in temporary state.

```text
Local scan
→ local candidates

External scan
→ curated candidates

state
→ merge by source URL
→ update lane counts
→ keep all candidates UNVERIFIED until verifier runs
```

Running Local after External or External after Local must not erase the other lane. Candidate state is reset only when the selected channel actually changes or Discovery state is explicitly cleared.

### UI contract

Phase 4 exposes:

```text
[Find Local Sources]
[Find External Sources]
[Cancel Search]      while external scan is active
[Verify]             per candidate
[Verify All]
[Cancel Verify]
```

Result cards show the provider/origin and keep external candidates `UNVERIFIED` until the separate Source Verifier returns a result.

There is still no Save/Add/Promote control.

### Hard Phase 4 prohibitions

Provider #1 must not:

- save candidates to D1
- call `WebTVMyPlaylistAPI`
- call source-save policy
- mutate `SourceRegistry`
- call the normal player
- write route health
- run automatically on page load
- run continuously in the background
- persist candidates to localStorage/sessionStorage
- use legacy Source Hunt as an implicit backend
- search Brave/web/GitHub code beyond the fixed curated feed registry
- attach uncertain `LOW`/fuzzy channel matches
- convert discovery success into verification success

Discovery and verification remain separate services and separate user actions.

### Regression gate

Phase 4 adds:

```text
tests/discovery-external.test.mjs
tests/source-discovery-worker.test.mjs
```

and upgrades:

```text
tests/discovery-isolation.test.mjs
tests/discovery-browser-smoke.html
tests/discovery-browser-smoke.mjs
tests/frontend-integration.test.mjs
```

The Worker regression proves at minimum:

- `MEGA HD` can match `MEGA`
- `MEGA News` does not match `MEGA`
- duplicate URLs across curated feeds collapse
- feed concurrency never exceeds 2
- provider kill switch returns 503
- unsupported providers are rejected

The client regression proves:

- only selected channel identity + requested freshness/provider fields are sent
- returned external candidates are normalized back to `UNVERIFIED`
- cancellation propagates through AbortController

The headless Chrome smoke performs:

```text
open Discovery
→ Local scan: 3 temporary candidates
→ External scan: +1 curated temporary candidate
→ total: 4
→ external candidate still UNVERIFIED
→ Verify All
→ expected verified/failed states
→ close panel
→ player sentinel unchanged
→ sidebar sentinel unchanged
```

### Deployment live gate

`.github/workflows/deploy-source-discovery.yml` performs syntax/regression checks before Wrangler deploy and then checks the live Worker:

```text
GET / → service/version/provider enabled
POST /discover for MEGA
→ exactly four feed reports are returned
→ at least one real external curated feed must return HTTP 200
→ candidates response must be structurally valid
```

The live deployment gate intentionally does **not** require a particular stream URL to exist forever. Curated upstream content changes. Unit tests own deterministic matching semantics; the live gate owns real outbound connectivity/provider execution.

Only after PR CI, main CI, Source Discovery live verification and Pages deployment are green is Provider #1 considered complete. The next Phase 4 slice may then add Provider #2 separately, with its own kill switch and regression gate.

---

## 23. Source Discovery V2 Phase 4 provider #2 · GitHub Public Playlists · 2026-09-26

Provider #2 adds **recent public GitHub repository discovery** while preserving the Phase 4 rule that every provider is explicit, bounded and independently disableable. It does not reuse legacy Source Hunt and it does not expose GitHub directly to the browser.

### Current Source Discovery service

```text
Worker: webtv-source-discovery
URL: https://webtv-source-discovery.atonis.workers.dev
Source: workers/webtv-source-discovery.js
Provider module: workers/source-discovery/github-public-playlists.js
Workflow: .github/workflows/deploy-source-discovery.yml
Version: 1.1

Enabled provider IDs:
curated-remote-feeds
github-public-playlists
```

The browser continues to call only:

```text
POST https://webtv-source-discovery.atonis.workers.dev/discover
```

`src/discovery/external-discovery-client.js` never calls `api.github.com` directly. GitHub access belongs to the Worker provider boundary.

### Explicit UI lanes

Phase 4 now exposes separate provider actions:

```text
[Find Local Sources]
[Find Curated Feeds]
[Search GitHub Playlists]
[Cancel Search]
[Verify]
[Verify All]
[Cancel Verify]
```

Curated and GitHub results keep separate lane counts in temporary Discovery state. Running one external provider does not erase the other provider or the Local lanes. Cross-provider duplicate source URLs collapse in the temporary result set.

### GitHub provider discovery contract

Provider #2 uses the public GitHub **Repository Search** endpoint. It deliberately does **not** use GitHub Code Search.

Current search terms:

```text
greek iptv
greece m3u
```

The requested freshness window becomes a real repository query filter:

```text
24h → pushed:>=<date one day ago>
7d  → pushed:>=<date seven days ago>
30d → pushed:>=<date thirty days ago>
```

Returned repository metadata is filtered again by the provider. Archived repositories and forks are skipped. The provider then inspects only a small number of root-level playlist-like files instead of cloning or recursively downloading repositories.

### Bounded GitHub provider limits

```text
GitHub/API upstream timeout          6000 ms
Browser external request timeout     9000 ms
Repository search calls/request      2
Maximum repositories inspected       4
Maximum playlist files/repository    2
Maximum total subrequests            10
Maximum unique candidates            12
Maximum inspected playlist body      1.2 MB
```

The hard subrequest budget counts search, repository contents and raw playlist fetches together. Exhausting the budget ends further provider work instead of allowing an unbounded crawl.

### Freshness semantics

Provider #2 can truthfully apply freshness to the **repository**, because GitHub exposes repository `pushed_at` and supports `pushed:` search filtering.

It reports:

```text
freshnessRequested = 24h / 7d / 30d
freshnessApplied   = true
candidate.freshness = "repo-pushed:<repository pushed_at>"
```

This does **not** mean an individual M3U entry or stream URL was created at that timestamp. Repository activity and playlist-entry age are different facts. The provider therefore records repository push freshness without pretending it knows the publication age of each stream entry.

### Matching and candidate trust

Playlist entries discovered through GitHub use the same conservative channel identity boundary as Provider #1:

```text
MEGA ↔ MEGA HD       accepted HIGH
MEGA ↔ MEGA News     rejected
```

Every result remains:

```text
verificationStatus = UNVERIFIED
verified            = false
```

A repository match, a fresh `pushed_at`, or a valid M3U line is not verification. Only the separate Source Verifier may change the temporary verification state.

### Kill switches

Provider #2 can be disabled independently at both browser and Worker layers:

```text
browser provider flag:
PROVIDER_FLAGS['github-public-playlists']

Worker runtime kill switch:
DISABLE_GITHUB_PUBLIC_PLAYLISTS=1
```

Disabling Provider #2 does not disable Curated Remote Feeds, the verifier, Source Hunt, Registry, player, Xtream or TV Cache.

### Hard Provider #2 prohibitions

GitHub Public Playlists must not:

- use GitHub Code Search
- require GitHub credentials in the browser
- expose GitHub API access from frontend code
- clone arbitrary repositories
- recursively crawl entire repository trees
- exceed the fixed subrequest budget
- treat repository `pushed_at` as stream-entry publication time
- save candidates to D1
- mutate SourceRegistry
- call the normal player
- write route health
- run automatically or continuously in the background
- turn discovery success into verification success

### Regression gate

Provider #2 adds:

```text
tests/github-public-playlists-provider.test.mjs
```

and expands the existing external client, Worker router, isolation, browser-smoke and integration-audit tests.

The deterministic provider test proves at minimum:

- `pushed:>=YYYY-MM-DD` is present in Repository Search
- only playlist-like root files are fetched
- the hard request budget exists
- GitHub candidate provenance is retained
- candidate freshness records repository push time
- `MEGA News` does not leak into `MEGA`
- returned candidates remain temporary
- the provider kill switch returns 503

The browser smoke now performs:

```text
Local scan             → 3 candidates
Curated provider       → +1
GitHub provider         → +1
Temporary total        → 5
Both external results  → UNVERIFIED
Verify All             → separate verifier only
Close panel            → sidebar/player sentinels unchanged
```

### Deployment live gate

The Source Discovery deployment workflow now verifies **both** external providers after Wrangler deploy:

```text
GET /
→ version === 1.1
→ curated-remote-feeds enabled
→ github-public-playlists enabled

POST curated-remote-feeds
→ four curated feed reports
→ at least one public curated upstream must return HTTP 200

POST github-public-playlists
→ freshnessApplied === true
→ GitHub search reports returned
→ at least one real GitHub Repository Search request must return HTTP 200
→ candidates array structurally valid, even if a particular live search currently yields zero matching channel candidates
```

The live gate intentionally tests provider execution and real upstream connectivity, not a permanent fixed GitHub result. Public repositories change over time. Deterministic unit tests own exact matching semantics; the live gate owns the fact that the deployed Worker can actually reach and execute the provider.

Provider #2 is considered complete only after final-head PR CI, main-branch CI, Source Discovery v1.1 live verification and Pages deployment all succeed.

---

## 24. Source Discovery V2 Phase 4 provider #3 · Recent Web Search · 2026-09-26

Provider #3 adds bounded recent public-web discovery through the dedicated `webtv-source-discovery` Worker. It does not route through legacy Source Hunt and does not expose Brave credentials to browser code.

### Current Source Discovery service

```text
Worker: webtv-source-discovery
URL: https://webtv-source-discovery.atonis.workers.dev
Source: workers/webtv-source-discovery.js
Provider module: workers/source-discovery/recent-web-search.js
Workflow: .github/workflows/deploy-source-discovery.yml
Version: 1.2

Enabled provider IDs:
curated-remote-feeds
github-public-playlists
recent-web-search
```

### Runtime boundary

```text
selected channel
      │ explicit Search Recent Web
      ▼
src/discovery/external-discovery-client.js
      │ POST /discover
      ▼
webtv-source-discovery Worker
      │
      └── provider: recent-web-search
              ├── Brave Search API
              ├── real freshness window
              ├── bounded relevant-page scans
              ├── conservative URL extraction
              └── temporary UNVERIFIED candidates only
      ▼
Discovery in-memory state
      │
      └── explicit Source Verifier remains separate

player + sidebar + SourceRegistry + D1
      └── unchanged
```

### Freshness semantics

The requested Discovery window maps directly to Brave Search freshness:

```text
24h → pd
7d  → pw
30d → pm
```

When Brave returns a reliable result date, candidates record `result-date:<timestamp>`. Undated results record only `brave-window:<window>`. Request time must never be fabricated as publication time.

### Bounded provider contract

```text
Brave/page upstream timeout      6000 ms
Browser request timeout          9000 ms
Maximum Brave searches           2
Maximum relevant page scans      4
Maximum total subrequests        8
Maximum unique candidates        12
Maximum inspected page body      1.2 MB
```

The provider filters private/local targets and selected high-noise social/video hosts before page fetching. Search discovery does not imply stream verification.

### Trust and verification boundary

Every Recent Web result enters Discovery as:

```text
matchConfidence     = MEDIUM
verificationStatus  = UNVERIFIED
verified            = false
```

Only the separate Source Verifier may change temporary verification state. A Brave result, visible media URL or recent result date is not sufficient for promotion or persistence.

### Secret ownership and kill switch

`BRAVE_API_KEY` is configured as a Cloudflare **Production Secret** on `webtv-source-discovery`.

The browser never receives this key. The provider can be disabled independently with:

```text
browser provider flag:
PROVIDER_FLAGS['recent-web-search']

Worker runtime kill switch:
DISABLE_RECENT_WEB_SEARCH=1
```

If the secret is absent, the Worker reports the provider disabled/unavailable and `/discover` returns a clear 503 instead of silently falling back through legacy Source Hunt.

### Hard Provider #3 prohibitions

Recent Web Search must not:

- expose `BRAVE_API_KEY` to browser code
- route requests through legacy Source Hunt
- exceed the fixed search/page/subrequest limits
- fetch private/local network targets
- treat search results as verified streams
- save candidates to D1
- mutate SourceRegistry
- call the normal player
- write route health
- run automatically or continuously in the background
- persist Discovery candidates to localStorage/sessionStorage

### Regression and live gate

Provider #3 adds `tests/recent-web-search-provider.test.mjs` and expands client/router, isolation, browser-smoke and integration-audit coverage.

The browser smoke now proves:

```text
Local → Curated → GitHub → Recent Web → Verify
```

while sidebar/player sentinels remain unchanged.

The post-deploy Source Discovery live gate requires:

```text
GET / → version 1.2 and all three providers enabled
curated provider → at least one real public feed HTTP 200
GitHub provider → at least one real GitHub Repository Search HTTP 200
Recent Web provider → at least one real Brave Search HTTP 200
```

Provider #3 is complete only when final-head PR CI, main-branch CI, Source Discovery v1.2 live verification and Pages deployment all succeed.

---

## 25. Source Discovery V2 Phase 4 provider #4 · STRM-specific Discovery · 2026-09-26

Provider #4 adds an explicit bounded lane for resolving public `.strm` indirections into final media candidates. It does not reuse the normal player resolver and it does not treat a successfully fetched `.strm` file as a verified stream.

### Current Source Discovery service

```text
Worker: webtv-source-discovery
URL: https://webtv-source-discovery.atonis.workers.dev
Source: workers/webtv-source-discovery.js
Provider module: workers/source-discovery/strm-specific-discovery.js
Workflow: .github/workflows/deploy-source-discovery.yml
Version: 1.3

Enabled provider IDs:
curated-remote-feeds
github-public-playlists
recent-web-search
strm-specific-discovery
```

### Runtime boundary

```text
selected channel
      │ explicit Resolve STRM Sources
      ▼
webtv-source-discovery
      │
      └── strm-specific-discovery
              ├── scan existing bounded public feed registry
              ├── keep only channel-matched .strm references
              ├── resolve nested STRM references, max depth 3
              ├── preserve approved Kodi headers only
              ├── record KODIPROP DRM metadata as a hint
              └── emit final HLS / DASH / direct candidate
      ▼
temporary Discovery state
      │
      └── UNVERIFIED until separate Source Verifier runs

player + sidebar + SourceRegistry + D1
      └── unchanged
```

The browser action is explicit:

```text
[Resolve STRM Sources]
```

No STRM scan runs automatically or in the background.

### Bounded STRM contract

```text
Upstream timeout              6000 ms
Maximum STRM references       6
Maximum nested depth          3
Maximum total subrequests     12
Maximum inspected STRM body   256000 bytes
```

The provider uses the same bounded public feed registry already owned by Source Discovery. It does not perform an open-ended web crawl merely because a `.strm` file was found.

Every hop is restricted to HTTP/HTTPS and rejects localhost, `.local`, link-local and private IPv4 targets.

GitHub blob URLs may be canonicalized to `raw.githubusercontent.com` before fetching.

### Header and DRM boundary

Kodi-style suffix metadata is restricted to the existing approved transport classes:

```text
User-Agent
Referer
Origin
```

Cookie, Authorization and arbitrary headers are not promoted into Discovery candidates.

`#KODIPROP` license metadata is treated only as a **DRM hint** during resolution. It is not proof that the final media is playable and it does not bypass the separate verifier.

### Verification boundary

The provider performs:

```text
STRM reference
→ bounded resolution
→ final media URL
→ classify HLS / DASH / direct
→ temporary UNVERIFIED candidate
→ separate Source Verifier
```

Resolution success is not verification success.

The provider must never:

- save a resolved target to D1
- call `WebTVMyPlaylistAPI`
- mutate `SourceRegistry`
- call `PlayerController` or `WebTVPlaybackAPI`
- write route health
- change permanent MANUAL/AUTO source order
- persist candidates in localStorage/sessionStorage
- treat KODIPROP metadata as a verified DRM/playback result

### Freshness semantics

The current STRM lane checks its bounded public feed surfaces live, but those feeds and `.strm` files do not provide reliable publication timestamps for each channel entry.

Therefore:

```text
freshnessRequested = 24h / 7d / 30d
freshnessApplied   = false
candidate.freshness = "live-strm-check"
```

Request time must not be fabricated as publication time.

### Kill switches

```text
browser provider flag:
PROVIDER_FLAGS['strm-specific-discovery']

Worker runtime kill switch:
DISABLE_STRM_SPECIFIC_DISCOVERY=1
```

Disabling this provider does not disable Curated Feeds, GitHub Search, Recent Web Search, the verifier, player, Registry, Xtream, TV Cache or legacy Source Hunt.

### Regression gate

Phase 4.4 adds:

```text
tests/strm-specific-discovery-provider.test.mjs
```

and expands the external client, router, isolation and browser-smoke coverage.

The deterministic STRM regression proves at minimum:

- duplicate STRM references collapse
- nested `.strm → .strm → final media` resolution is bounded
- final DASH/HLS type is classified from the resolved target
- approved Kodi headers survive resolution
- KODIPROP license metadata becomes a DRM hint only
- private/local final targets are rejected
- request budget and depth caps remain enforced
- repository wiring, kill switch and live gate remain present

The browser smoke now exercises:

```text
Local
→ Curated
→ GitHub
→ Recent Web
→ STRM
→ Verify
```

and confirms that the STRM result is still `UNVERIFIED` before the separate verifier runs while sidebar/player sentinels remain unchanged.

### Production live gate

The Source Discovery v1.3 deployment gate uses a real public STRM path rather than a synthetic-only fixture:

```text
ERT1
→ Don24crk public android.m3u
→ public ERT1.strm
→ final HLS target
```

Acceptance requires:

- Worker status reports version `1.3`
- all four providers enabled
- at least one STRM-bearing public feed returns HTTP 200
- at least one STRM reference resolves successfully
- at least one final candidate is returned
- Curated, GitHub and Recent Web live gates continue to pass

Provider #4 is complete only after final-head PR CI, main-branch CI, Source Discovery v1.3 live verification and Pages deployment all succeed.

---

## 26. Source Discovery V2 Phase 4 provider #5 · Official Provider Lane · 2026-09-26

Provider #5 adds an explicit trust-separated lane for broadcaster-owned live pages, allowlisted official embeds and media URLs extracted only from explicitly registered official domains. It is not a general web search and it does not turn an official page into a normal IPTV source.

### Current Source Discovery service

```text
Worker: webtv-source-discovery
URL: https://webtv-source-discovery.atonis.workers.dev
Source: workers/webtv-source-discovery.js
Provider module: workers/source-discovery/official-provider-lane.js
Workflow: .github/workflows/deploy-source-discovery.yml
Version: 1.4

Enabled provider IDs:
curated-remote-feeds
github-public-playlists
recent-web-search
strm-specific-discovery
official-provider-lane
```

### Runtime and trust boundary

```text
selected channel
      │ explicit Find Official Sources
      ▼
webtv-source-discovery
      │
      └── official-provider-lane
              ├── resolve channel only through explicit broadcaster registry
              ├── fetch allowlisted official live page(s)
              ├── extract HLS/DASH only from allowlisted media hosts
              ├── emit allowlisted embed fallback where configured
              └── return temporary official candidates
      ▼
Discovery in-memory state
      │
      ├── official-page / official-embed = fallback/navigation only
      └── media = UNVERIFIED until separate Source Verifier runs

player + sidebar + SourceRegistry + D1
      └── unchanged
```

Official provenance increases trust in origin, not verification status and not permanent source priority.

### Candidate classes

Official results carry explicit metadata:

```text
trustClass = OFFICIAL

candidateKind = media
  → broadcaster-owned HLS/DASH/direct media candidate
  → separate verifier still required
  → saveEligible=true only as discovery metadata; Phase 5 still owns actual promotion

candidateKind = official-page
  → broadcaster-owned live page
  → navigation/fallback only
  → saveEligible=false
  → excluded from media verification

candidateKind = official-embed
  → explicitly allowlisted official embed
  → fallback only
  → saveEligible=false
  → excluded from media verification
```

The browser `Verify All` action skips `official-page` and `official-embed`. The normal verifier is reserved for actual media candidates.

### Initial broadcaster registry

The first server-side registry recognizes only explicit entries:

```text
ERT1 / ERT2 / ERT3 / ERTNEWS
  owner: ERT
  live page: https://live.ertflix.gr/

ANT1
  owner: ANT1
  live page: https://www.antenna.gr/live

MAD TV
  owner: MAD TV
  official live page: https://www.youtube.com/@madtvgreece/live
  explicit youtube-nocookie embed fallback
```

Unknown channels produce `recognized=false` and no official candidates. The provider must not guess an official domain from arbitrary search results.

### Bounded provider contract

```text
Official page timeout          6000 ms
Maximum official pages         2
Maximum candidates             8
Maximum inspected page body    1.2 MB
HTTPS only
```

Media extraction only accepts `.m3u8` and `.mpd` URLs whose hostname is explicitly listed in that broadcaster's registry entry. Redirected or embedded arbitrary third-party media hosts are not promoted merely because they appear on an official page.

### Freshness semantics

Official pages are checked live, but their embedded media URLs do not carry a reliable publication timestamp.

```text
freshnessRequested = 24h / 7d / 30d
freshnessApplied   = false
candidate.freshness = live-official-check
```

Request time is never fabricated as publication time.

### Geography and playback boundary

Official broadcasters may geo-restrict live playback because of rights. Therefore the Source Discovery live gate proves official provenance and bounded page access, not universal playback availability from the CI runner's country.

A reachable broadcaster-owned page can be a valid `official-page` fallback even when a media stream is unavailable, geo-blocked or absent from static HTML. Any extracted media URL must still pass the separate Source Verifier before it can become save-ready in Phase 5.

### Kill switches

```text
browser provider flag:
PROVIDER_FLAGS['official-provider-lane']

Worker runtime kill switch:
DISABLE_OFFICIAL_PROVIDER_LANE=1
```

Disabling the official lane does not disable Curated, GitHub, Recent Web, STRM, the verifier, player, Registry, Xtream, TV Cache or legacy Source Hunt.

### Hard provider prohibitions

The Official Provider Lane must not:

- use arbitrary web search to infer broadcaster ownership
- trust a media URL whose host is not explicitly allowlisted for that broadcaster
- treat an official page or embed as normal IPTV media
- mark any media candidate VERIFIED during discovery
- save anything to D1
- call `WebTVMyPlaylistAPI`
- mutate `SourceRegistry`
- call `PlayerController` or `WebTVPlaybackAPI`
- write route health
- change permanent MANUAL/AUTO source order
- persist discovery candidates to localStorage/sessionStorage

### Regression and production live gate

Phase 4.5 adds:

```text
tests/official-provider-lane.test.mjs
```

and expands the external client, router, discovery state, browser smoke and deployment gate.

The deterministic regression proves at minimum:

- known broadcaster aliases resolve only to the explicit registry
- unknown channels return no candidate
- official page candidates are OFFICIAL and non-saveable fallbacks
- media extraction accepts only allowlisted broadcaster hosts
- arbitrary third-party HLS/DASH URLs are rejected
- HTTPS, page, body and candidate bounds remain enforced
- provider kill switch is independent

The browser smoke now exercises:

```text
Local
→ Curated
→ GitHub
→ Recent Web
→ STRM
→ Official
→ Verify
```

and confirms that the official fallback remains `UNVERIFIED`, is excluded from media Verify All, and does not affect sidebar/player sentinels.

The Source Discovery v1.4 post-deploy gate requires:

- status reports version `1.4`
- all five external providers enabled
- prior Curated/GitHub/Recent Web/STRM live gates continue to pass
- ERT1 is recognized through the official registry
- at least one allowlisted ERT official page returns HTTP 200
- at least one returned `official-page` candidate has `trustClass=OFFICIAL` and `saveEligible=false`

Provider #5 is complete only after final-head PR CI, main-branch CI, Source Discovery v1.4 live verification and Pages deployment all succeed.

---

## 27. Source Discovery V2 Phase 4 provider #6 · Authorized Xtream Expansion · 2026-09-26

Phase 4.6 expands Discovery across Xtream accounts that the user has already saved and authorized through the existing WebTV Xtream Bridge. It does not search the public internet for Xtream credentials or providers, and it does not introduce a second credential store.

### Runtime boundary

```text
selected channel
      │ explicit Search Authorized Xtream
      ▼
src/discovery/authorized-xtream.js
      │
      ├── listXtreamAccounts()
      └── loadXtreamChannels(accountId)
              │
              ▼
existing webtv-xtream bridge
      │
      ├── trusted-device session required
      ├── encrypted credentials remain server-side
      ├── provider catalog is fetched by the existing bridge
      └── browser receives signed bridge playback URLs only
      ▼
temporary Discovery candidate
      │
      └── UNVERIFIED until separate Source Verifier runs

player + SourceRegistry + D1 My Playlist
      └── unchanged
```

This lane is distinct from the existing `Xtream loaded` local lane. The local lane can only inspect a catalog that is already loaded in Playlist Manager. `Authorized Xtream` may explicitly inspect additional saved accounts without first loading their full catalogs into the normal playlist UI.

### Authorization and credential boundary

The lane reuses the existing Xtream Bridge APIs:

```text
GET /api/accounts
GET /api/accounts/{accountId}/channels
```

Those APIs already require a trusted-device session. Xtream usernames/passwords remain encrypted in the existing bridge storage and are decrypted only inside the bridge when contacting the authorized provider.

Discovery receives only:

```text
accountRef
server metadata
streamId
signed WebTV bridge playback URL
channel metadata
```

Discovery candidate context intentionally contains:

```text
username = ""
password = ""
```

Credentials must never be copied into Discovery state, verifier payloads, logs, localStorage/sessionStorage, or the browser-visible source URL.

### Bounded expansion contract

```text
Maximum saved accounts inspected        3
Maximum channels inspected/account      5000
Maximum returned candidates             8
```

Each account catalog call remains bounded by the existing Xtream client/bridge request timeout. `Cancel Search` stops orchestration cooperatively between account calls; Phase 4.6 does not claim mid-request cancellation of an already-running Xtream Bridge catalog request.

### Matching semantics

Matching remains conservative and is based on normalized selected-channel identity against Xtream channel identifiers/names. Benign trailing labels may be normalized:

```text
HD
TV
Greece
Greek
GR
```

Examples:

```text
MEGA ↔ MEGA HD      accepted
MEGA ↔ MEGA TV      accepted
MEGA ↔ MEGA News    rejected
```

No fuzzy category-wide matching is allowed.

### Candidate contract

A matched result enters temporary Discovery state as:

```text
sourceType          = xtream
discoveryProvider   = authorized-xtream-expansion
matchConfidence     = HIGH
verificationStatus  = UNVERIFIED
freshness           = authorized-account-live-catalog
xtreamAccountRef    = saved account id
xtreamStreamId      = provider stream id
```

The source URL is the signed WebTV Xtream Bridge URL, not the provider URL containing username/password. Candidate display continues to redact Xtream source details.

The normal Source Verifier receives only the existing public verification payload (`candidateId`, `sourceType`, signed `sourceUrl`, approved headers). Xtream account context and credentials are not added to the verifier payload.

### Verification and promotion boundary

Authorized account ownership is not equivalent to stream verification. The flow remains:

```text
authorized account
→ bounded catalog match
→ temporary Xtream candidate
→ separate Source Verifier
→ VERIFIED / FAILED / DRM / timeout result
→ no persistence yet
```

Phase 5 remains the sole owner of explicit Save / Promote behavior.

### Hard Phase 4.6 prohibitions

Authorized Xtream Expansion must not:

- discover or scrape public Xtream credentials
- create a second Xtream credential store
- expose username/password in browser state or logs
- embed raw provider credentials in candidate URLs
- bypass trusted-device authorization
- treat a catalog match as VERIFIED
- save a candidate to D1
- call `WebTVMyPlaylistAPI`
- mutate `SourceRegistry`
- call the normal player
- write route health
- change permanent MANUAL/AUTO source order
- run automatically in the background

### Regression gate

Phase 4.6 adds:

```text
tests/authorized-xtream-discovery.test.mjs
```

The deterministic regression proves:

- account expansion is capped at three authorized accounts
- stream inspection and candidate caps are fixed
- `MEGA` matches `MEGA HD` but not `MEGA News`
- candidates remain `xtream` / HIGH / UNVERIFIED
- accountRef and streamId survive candidate creation
- username/password fields remain empty
- serialized Discovery output contains no encrypted credential field names or fixture password
- cancellation is honored before/between account calls

The browser smoke now exercises:

```text
Local
→ Curated
→ GitHub
→ Recent Web
→ STRM
→ Official
→ Authorized Xtream
→ Verify
```

and confirms that the authorized Xtream result enters the same separate verifier path while sidebar/player sentinels remain unchanged.

### Production evidence boundary

CI must not enumerate a user's private authorized Xtream accounts merely to prove this feature. Therefore the Phase 4.6 production gate is privacy-preserving:

- final-head PR CI must pass the deterministic authorized-account expansion test
- Chrome smoke must pass with a trusted-session fixture and signed bridge URL fixture
- the existing production `webtv-xtream` bridge must remain healthy with Registry binding and HLS proxy enabled
- the public WebTV Xtream mock provider may be used to prove the Xtream catalog surface independently of personal credentials
- main-branch CI and Pages deployment must remain green

A personal account catalog is tested only when the user explicitly presses `Search Authorized Xtream` in an authenticated WebTV session. Lack of CI access to private account catalogs is an intentional privacy boundary, not a failed production gate.

Provider #6 is complete only after final-head PR CI, canonical manual append, merge, main-branch CI, Pages deployment and the privacy-preserving Xtream live checks all succeed.

---

## 28. Source Discovery V2 Phase 5.1 · Explicit Save / Promote · 2026-09-26

Phase 5.1 is the first Discovery phase allowed to persist a verified media result into `My Playlist`. Persistence is always an explicit user action. Search, candidate creation and verification remain read-only.

### Runtime boundary

```text
Discovery candidate
      │
      ├── UNVERIFIED → cannot save
      │
      └── separate Source Verifier
              │
              ▼
          VERIFIED
              │
              │ explicit user click only
              ▼
      [Add this source]
              │
              ▼
existing source-save-policy.js
              │
              ▼
My Playlist / D1
```

Discovery does not introduce a second My Playlist writer. `src/discovery/promotion.js` delegates media persistence to the existing `saveBestSourceToCurrent()` policy, which keeps at most the best three source URLs and uses the existing trusted-device Registry write path.

### Promotion prerequisites

A candidate can be promoted only when all of the following are true:

```text
verificationStatus === VERIFIED
verified === true
saveEligible !== false
candidateKind is normal media
sourceUrl is http/https
requiredHeaders is empty
Discovery channel still matches currently selected channel
```

The last condition is the stale-result / wrong-channel guard. If Discovery was opened for `MEGA` and the user subsequently selects `SKAI`, an old MEGA result is refused until Discovery is reopened for the current channel.

### Persistent-header boundary

Phase 5.1 does not persist candidates that require request headers such as `Referer`, `Origin` or `User-Agent`.

The current Registry `channel_sources` persistence contract stores source URL/origin/priority and health metadata but does not yet have a persistent approved-header schema. Therefore a header-dependent candidate may be verified temporarily, but its card shows that the headers are not persistable and the Add action stays disabled.

This preserves the existing Saved Sources policy rather than silently dropping required transport metadata.

### Official fallback boundary

`official-page` and `official-embed` candidates are not media sources and cannot be promoted to `My Playlist` through Phase 5.1.

Official provenance does not bypass media verification or the source persistence model.

### Xtream channel versus full account

For a VERIFIED Xtream candidate the UI exposes two distinct user choices:

```text
[Add this source]
[Keep Full Xtream Account]
```

`Add this source` persists only the signed WebTV Xtream Bridge playback URL for the selected channel through the normal My Playlist source policy.

`Keep Full Xtream Account` does not copy credentials into Discovery and does not write another My Playlist source. Phase 4.6 Authorized Xtream candidates originate only from accounts that are already stored in the secure Xtream Bridge, so Phase 5.1 verifies that `accountRef` still exists and reports the account as already stored securely.

Browser-visible Xtream context remains limited to:

```text
accountRef
server metadata
streamId
signed WebTV bridge playback URL
```

Username/password remain encrypted server-side in the Xtream Bridge and are never requested, returned or rewritten by `src/discovery/promotion.js`.

### Explicit-write invariant

The Phase 5.1 browser gate proves:

```text
Discovery scans completed      → 0 My Playlist writes
Verify All completed           → 0 My Playlist writes
explicit promoteOne() click    → exactly 1 My Playlist write
                               → exactly 1 My Playlist reload
Keep Full Xtream Account       → no additional My Playlist write
```

There is no automatic promote after verification and no background persistence.

### Player/sidebar isolation

Search and Verify continue to leave the normal player and sidebar untouched. The only bridge from Discovery into the primary application is the explicit persistence action.

```text
PLAYER / SIDEBAR
      │
      └── already-loaded catalog/playback only

DISCOVERY
      ├── searches
      ├── temporary candidates
      └── verification
              │
              │ explicit Add only
              ▼
        My Playlist / D1
```

The browser smoke keeps player/sidebar sentinels unchanged throughout Discovery, verification and promotion-policy execution.

### Hard Phase 5.1 prohibitions

Phase 5.1 must not:

- save an UNVERIFIED candidate
- auto-save immediately after verification
- save an official page/embed as an IPTV source
- silently discard required request headers
- promote a stale result to a different currently selected channel
- create a second My Playlist writer
- expose or request Xtream username/password
- rewrite an already stored Xtream account just because a channel matched
- make `Keep Full Xtream Account` add channels automatically
- change permanent MANUAL source order implicitly
- invoke the normal player as part of Search/Verify
- persist any candidate without an explicit user action

### Regression gate

Phase 5.1 adds:

```text
src/discovery/promotion.js
tests/discovery-promotion.test.mjs
```

and extends the existing Discovery browser smoke.

The deterministic regression proves:

- VERIFIED is required
- `saveEligible=false` is blocked
- official fallback pages are blocked
- persistent headers are blocked
- wrong-channel promotion is blocked before the writer runs
- successful media promotion delegates to `saveBestSourceToCurrent(..., {maxSources:3})`
- Xtream full-account keep uses only `accountRef` and the existing account list
- the promotion module neither imports `saveXtreamAccount` nor handles passwords

### Production evidence boundary

CI and automated live gates must not add sources to the user's real `My Playlist` merely to prove Phase 5.1. The write proof therefore uses a browser fixture that counts Registry writes and validates the exact explicit-write boundary.

Completion requires:

- final-head PR CI green
- deterministic promotion regression green
- Chrome Discovery smoke green
- integration audit green
- canonical §28 appended
- main-branch CI green
- Pages deployment green

A real production My Playlist write occurs only when the user explicitly presses `Add this source` in an authenticated WebTV session.

---

## 29. Source Discovery V2 Phase 5.2 · New Xtream Explicit Choice · 2026-09-26

Phase 5.2 extends explicit promotion to a **new user-authorized Xtream login** without silently saving the full account.

The user receives a real persistence choice only after a temporary preview candidate has passed the separate Source Verifier:

```text
New Xtream credentials
        │
        │ explicit Test New Xtream
        ▼
secure Xtream Bridge
        │
        ├── validate provider login
        ├── load bounded live catalog
        └── issue short-lived encrypted preview token
                    │
                    ▼
           temporary candidates
                    │
                    ▼
            Source Verifier
                    │
                    ▼
                VERIFIED
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
[Add only this channel] [Save Full Xtream Account]
```

### Credential boundary

The Discovery form accepts:

```text
server
username
password
optional account name
```

These values are read only for the explicit preview request and sent directly to the trusted Xtream Bridge. After the request completes, the username and password fields are cleared.

Discovery candidate/state does **not** retain raw username/password. It retains only:

```text
opaque encrypted preview token
public server metadata
streamId
preview expiry timestamp
temporary bridge playback URL
```

The display layer redacts both the temporary source URL and the opaque token.

No Phase 5.2 credential is written to `localStorage` or to a Discovery candidate as plaintext.

### Temporary preview contract

The Xtream Worker router adds:

```text
POST /api/preview
GET  /preview-stream/{streamId}.m3u8?t=<opaque-token>
```

`POST /api/preview` requires a trusted-device WebTV session. It validates the supplied Xtream login against the provider, loads a bounded live catalog, and returns a preview token encrypted with the existing `XTREAM_ENCRYPTION_KEY`.

The preview token contains the credential envelope server-side/client-opaque and expires after **10 minutes**. An expired token is refused and the user must test the account again.

The temporary preview URL is only for verification. It is explicitly blocked from the generic `Add this source` promotion path.

The preview token can appear in a temporary playback URL and therefore may pass through ordinary browser/network URL handling, but it is opaque encrypted material, has a short TTL, and is not a reusable plaintext credential.

### Add only this channel

After the preview candidate is VERIFIED, the explicit action:

```text
[Add only this channel]
```

calls:

```text
POST /api/channel-sources
```

with only the opaque preview token and the selected `streamId`.

The bridge decrypts the preview token server-side and persists a channel-scoped encrypted secret in:

```text
xtream_channel_sources
```

with the effective contract:

```text
id
name
server
username_enc
password_enc
stream_id
created_at
updated_at
```

Raw credentials are never returned to the browser.

The bridge then returns a permanent signed playback URL:

```text
/channel-stream/{sourceId}/{streamId}.m3u8?s=<signature>
```

Only that permanent channel URL is passed to the existing `source-save-policy.js` and persisted into My Playlist.

Therefore channel-only promotion means:

```text
1 encrypted channel-scoped Xtream secret
1 My Playlist source write
0 full Xtream account writes
```

The channel-scoped secret is not listed as a normal saved Xtream account.

### Save Full Xtream Account

The alternative explicit action:

```text
[Save Full Xtream Account]
```

calls:

```text
POST /api/accounts/from-preview
```

The bridge decrypts the preview token server-side, revalidates the provider login, and stores the credentials encrypted in the existing `xtream_accounts` table using the same account persistence semantics as the legacy Xtream save path.

This action does **not** automatically add the currently matched channel to My Playlist.

Therefore full-account promotion means:

```text
1 encrypted full-account Xtream write
0 automatic My Playlist writes
```

The existing account list and normal Xtream catalog workflow can then use the account later.

### Worker isolation

The existing `workers/webtv-xtream.js` implementation remains the legacy core.

Phase 5.2 adds:

```text
workers/webtv-xtream-router.js
workers/xtream-preview-routes.js
```

The router handles only the Phase 5.2 route family. Every other request is delegated to the existing Worker unchanged.

This keeps the legacy account, catalog, playback and HLS proxy behavior outside the new feature surface.

### Playback secrecy

Both temporary preview playback and permanent channel-only playback proxy provider HLS through WebTV.

Provider username/password are used only server-side when constructing the upstream Xtream URL. HLS manifests are rewritten so segment/key references pass through the bridge proxy. Returned manifests must not expose provider credentials.

Permanent channel playback uses a signed channel URL and reloads encrypted channel credentials from D1 only inside the Worker.

### Explicit-choice invariant

Phase 5.2 browser coverage proves:

```text
Test New Xtream               → 0 My Playlist writes
                               → 0 channel-secret writes
                               → 0 full-account writes
                               → username/password fields cleared

Verify preview                → 0 persistence writes

Add only this channel         → 1 channel-secret write
                               → +1 My Playlist write/reload
                               → 0 full-account writes

Save Full Xtream Account      → +1 full-account write
                               → 0 additional My Playlist writes
```

The two save choices are therefore behaviorally distinct rather than two labels for the same account-save operation.

### Existing authorized accounts

Phase 5.1 behavior remains unchanged for accounts already stored in the secure bridge:

```text
[Add this source]
[Keep Full Xtream Account]
```

Phase 5.2 does not convert an already-authorized account into the temporary preview workflow.

### Wrong-channel and verification guards

A new Xtream preview can be persisted only when:

```text
sourceType === xtream-preview
verificationStatus === VERIFIED
verified === true
preview token exists
streamId exists
preview has not expired
Discovery channel still matches the currently selected channel
```

If the user changes the selected channel after opening Discovery, both Phase 5.2 persistence actions are blocked until the correct channel context is re-established.

### Hard Phase 5.2 prohibitions

Phase 5.2 must not:

- save a new Xtream account merely because credentials were tested
- save an UNVERIFIED preview candidate
- pass a temporary preview URL through generic `Add this source`
- store raw Xtream username/password in Discovery state, candidate objects or localStorage
- return raw credentials from preview, channel-only or full-account APIs
- make channel-only promotion create a normal full Xtream account
- make full-account promotion add a channel to My Playlist automatically
- persist after preview or verification without an explicit user action
- bypass the stale/wrong-channel guard
- change normal player/sidebar state during preview/search/verification
- expose provider credentials in rewritten HLS manifests

### Regression gates

Phase 5.2 adds deterministic coverage for:

```text
tests/new-xtream-preview.test.mjs
tests/xtream-preview-routes.test.mjs
```

and extends:

```text
tests/discovery-promotion.test.mjs
tests/discovery-browser-smoke.html
```

The tests prove that:

- preview candidates contain no raw username/password
- display output redacts the opaque token and temporary preview URL
- unauthenticated preview requests are refused
- preview HLS output does not expose credentials
- channel-only D1 credentials are encrypted
- permanent channel playback does not expose credentials
- full-account-from-preview credentials are encrypted
- generic promotion refuses `xtream-preview`
- the two explicit save choices have separate write boundaries
- player/sidebar sentinels remain unchanged

### Production verification boundary

Automated production verification must not use or invent a real Xtream account and must not write to the user's real My Playlist.

The live deployment gate therefore verifies only the public/auth boundary:

```text
legacy /api/status                     → healthy existing Xtream bridge
OPTIONS /api/preview                   → 204
unauthenticated POST /api/preview      → 401
```

A real provider preview occurs only when the user explicitly supplies their own authorized Xtream credentials in the WebTV UI.

Phase 5.2 is complete only after final-head PR CI, canonical §29 append, merge, main-branch CI, live Xtream deployment gate and Pages deployment all succeed.
