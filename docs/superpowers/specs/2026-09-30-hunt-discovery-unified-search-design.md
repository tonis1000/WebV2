# WebV2 Hunt / Discovery Unified Search Design

Date: 2026-09-30
Repository: `tonis1000/WebV2`
Base main SHA: `46db7d821cd6bd09c3a044a523cdf82425cb905f`
Status: DESIGN FOR REVIEW

## 1. Problem

WebV2 currently has overlapping search/scanning/orchestration across Source Hunt and Source Discovery. The overlap is especially visible in GitHub/web search and in One-Click, which runs legacy Hunt and Discovery in parallel, scrapes/collects both result sets, merges them, dedupes them, then proceeds to verification and real playback.

This makes ownership unclear and makes free search harder because Discovery is currently tied to the selected sidebar channel.

The user goal is simpler:

- one easy search box;
- search must not interrupt or freeze the currently playing channel;
- search must support a single channel and a whole group/subgroup such as `ERT`, `ANT1`, `Nova`, `Cosmote`, `Cosmote Sport`;
- free-text search remains available when a channel/group identity is not known;
- known source formats must be handled by reusable format adapters;
- adding another source of an existing format must be easy;
- adding a genuinely new source format must be possible without rewriting the whole search/player pipeline;
- every result should show where it came from and, when safe/public, offer an `Open source` link in a new browser tab;
- Official sources are explicitly out of scope for this new search system because they can be managed manually;
- Player, Verifier and Save semantics must not be changed merely to simplify Hunt/Discovery.

## 2. Design principles

### 2.1 One user-facing search, multiple internal lanes

The UI exposes one search surface. The user should not need to understand Hunt versus Discovery.

Examples:

- `ERT1` -> single-channel intent
- `ERT` -> group intent
- `COSMOTE SPORT` -> subgroup intent
- unknown text -> free-text intent

The playing channel is independent from the search target.

### 2.2 Search must never own playback state

`Now Playing` and `Search` are separate states.

If MEGA is playing and the user searches for ERT1, MEGA continues to play. Search results never auto-switch the Player. Only an explicit user action such as `Play` changes the currently playing channel.

### 2.3 Existing format knowledge remains canonical

`src/core/source-format-registry.js` remains the canonical owner of format capabilities such as browser playback, verifier support and resolve-first behavior.

The new system must consume that registry instead of duplicating format capability rules.

### 2.4 New source vs new format

- New source of an existing format -> add/configure a Source Registry entry.
- New format -> implement a new adapter/format handler and register its capabilities.
- New search method/provider -> add a new exploration/discovery provider.

No unrelated Player/Verifier/Save rewrite is required.

## 3. Scope

### In scope

- unified search orchestration;
- channel/group/subgroup/free-text intent;
- independent search state and player state;
- Source Registry for concrete sources;
- reusable format adapters;
- progressive, cancellable, bounded search lanes;
- normalized candidate flow;
- provenance/origin metadata;
- safe public `Open source` links;
- grouping results by channel;
- migration away from DOM-scraped legacy result merging;
- preserving Hunt-specific lead intelligence where it adds unique value;
- preserving existing shared M3U, STRM and Enigma2 cores;
- explicit playback capability display based on the existing Source Format Registry.

### Out of scope

- Official source/provider discovery;
- changing Source Verifier security/status semantics;
- changing Save policy merely for this consolidation;
- adding RTMP/RTSP browser playback in this phase;
- replacing the Player implementation;
- changing D1 My Playlist, Favorites or Saved Playlist ownership;
- automatic saving of newly found sources;
- automatic Player switching after search.

## 4. Target architecture

```text
NOW PLAYING STATE -------------------------------> Player
       ^                                            ^
       | explicit user Play                         |
       |                                            |
UNIFIED SEARCH UI                                  |
       |
       v
Search Intent Resolver
(channel / group / subgroup / free-text)
       |
       v
Search Orchestrator
       |
       +--> Source Registry
       |      +--> M3U sources
       |      +--> Enigma2 sources
       |      +--> STRM sources
       |      +--> Xtream contexts
       |
       +--> Exploration Providers
              +--> GitHub
              +--> Web
              +--> Reddit/forums/issues/unknown pages
       |
       v
Format Adapters / Resolvers
       |
       v
Normalized Candidate Store
       |
       +--> grouped by channel
       +--> provenance/origin
       +--> format + resolved media format
       +--> browser-playable capability
       |
       v
Verifier
       |
       v
Explicit Play action
       |
       v
Player
```

## 5. Source Registry

A Source Registry describes WHERE WebV2 searches.

Example conceptual records:

```js
{
  id: 'iptv-org-gr',
  label: 'iptv-org Greece',
  type: 'm3u',
  location: '...',
  enabled: true,
  priority: 'high'
}
```

```js
{
  id: 'hanssettings-gr',
  label: 'HansSettings Greece',
  type: 'enigma2',
  location: '...',
  enabled: true,
  priority: 'medium'
}
```

The registry is source configuration, not format logic.

Adding another M3U source should not require another M3U parser.

## 6. Format adapters

Adapters own the translation from a source/container format to normalized candidates/leads.

Initial adapter families:

- M3U adapter
- STRM adapter
- Enigma2 adapter
- Xtream adapter
- direct HTTP/media adapter
- Exploration adapter/provider family for unknown/unstructured pages

Existing shared cores remain reused:

- M3U structural core
- STRM structural core
- Enigma2 structural core
- Channel Identity
- Source Format Registry

The adapter contract should be explicit and small. Conceptually:

```js
search({ target, source, signal }) -> {
  candidates: [],
  leads: [],
  reports: []
}
```

A source adapter must not claim playback success. It only produces normalized findings.

## 7. Hunt / Discovery ownership after consolidation

The final user-facing system no longer exposes two competing mental models.

### Discovery ownership

Discovery owns normalized playable-candidate production and candidate metadata.

This includes structured sources such as:

- curated M3U feeds;
- GitHub playlist sources;
- recent web sources after extraction;
- STRM resolution;
- Enigma2 resolution;
- authorized Xtream results;
- direct HLS/DASH/video candidates.

### Hunt / Exploration ownership

Hunt keeps the work that is genuinely exploratory:

- Reddit/forums;
- GitHub issue intelligence;
- rejected/historical issue context;
- unknown pages;
- lead inspection;
- provenance/freshness/ranking of leads.

When Hunt proves a media/container finding, it must feed the same normalized candidate path instead of maintaining a parallel candidate universe.

## 8. Search intent

Search intent is separate from the selected/playing channel.

Minimum supported intents:

- `channel`
- `group`
- `subgroup`
- `free-text`

Future-safe but not required in the first runtime slice:

- `category` such as Sports, News, Movies, Music, Kids.

Examples:

```text
ERT1 -> channel -> [ERT1]
ERT  -> group   -> [ERT1, ERT2, ERT3, ERT News, ...]
COSMOTE SPORT -> subgroup -> [Cosmote Sport 1, 2, 3, ...]
unknown query -> free-text
```

Group/subgroup membership should use shared identity/profile metadata rather than raw substring matching wherever possible.

## 9. Search execution and performance

Search must not block playback or the UI.

Required behavior:

1. Search work does not stop/reset/reload the Player.
2. Heavy network scanning stays in Workers/server-side providers where practical, not large synchronous browser loops.
3. Every lane has a timeout.
4. Parallelism is bounded.
5. New search cancels the previous search via AbortController/token semantics where supported.
6. Results stream/appear progressively as each lane finishes.
7. A slow/failing lane cannot block completed results from other lanes.
8. Search rendering is incremental and bounded to avoid expensive full-list rerenders.
9. Player playback remains responsive while search is active.

Acceptance proof must include active playback while a broad search runs.

## 10. Result model and UI

Results are grouped by resolved channel identity, not presented as one flat URL list.

Example:

```text
ERT1
  Candidate 1  HLS   VERIFIED
  Candidate 2  Enigma2 -> HLS

ERT2
  Candidate 1  DASH
```

Each result should expose, when known:

- channel name/identity;
- source label;
- input format;
- resolved media format;
- browser-playable yes/no;
- verifier status;
- playback status if tested;
- freshness/provenance metadata;
- `Open source` link when safe/public;
- copyable playable URL where policy allows.

## 11. Provenance and Open Source

Candidate provenance must distinguish playable URL from discovery origin.

Conceptual fields:

```js
{
  sourceUrl: 'https://stream.example/ert1/index.m3u8',
  sourceOriginUrl: 'https://github.com/.../userbouquet.greece.tv',
  sourceOriginLabel: 'HansSettings Greece'
}
```

`Open source` opens `sourceOriginUrl` in a new browser tab using safe link handling.

Expected origin behavior:

- GitHub repo/file -> exact repo/file page when available;
- GitHub issue -> exact issue;
- forum/web page -> exact discovered page;
- M3U -> playlist/public source URL when appropriate;
- Enigma2 -> bouquet/file origin;
- STRM -> `.strm` origin;
- Xtream -> never expose credentials or credential-bearing URLs; use a safe provider/context label instead.

The UI must not leak credentials, authorization headers or private metadata.

## 12. Playback capability matrix

The current Source Format Registry already expresses the important capability boundary and remains authoritative.

| Input/final format | Browser Player now | Required handling |
| --- | --- | --- |
| HLS `.m3u8` | yes | direct/native or hls.js |
| DASH `.mpd` | yes | dash.js |
| MP4 | yes | native video |
| WebM | yes | native video |
| M3U | no | parse/resolve to candidate |
| STRM | no | resolve first |
| Enigma2 | no | parse/resolve embedded source |
| Xtream | no | API/context -> stream candidate |
| RTMP | no | retain as recognized unsupported/external |
| RTSP | no | retain as recognized unsupported/external |
| Unknown | unknown | inspect / future adapter |

Search must not discard recognized unsupported formats. It may keep them as findings with clear status such as `Needs gateway` or `Unsupported by browser Player`.

## 13. Official sources

Official provider/page/API search is excluded from the new unified search UX by explicit product decision.

Existing official code is not automatically deleted by this design. Removal or retirement of existing official lanes, tests or workflows requires a separately verified migration step so current behavior is not accidentally broken.

Manual official source management remains possible outside this unified search flow.

## 14. Migration strategy

The migration should be incremental, not a flag-day rewrite.

### Slice A: shared search context and intent

Create search state that is independent from selected/playing channel. Preserve existing Player behavior.

### Slice B: Source Registry + adapter contract

Introduce configuration for concrete sources and route existing M3U/STRM/Enigma2 logic through explicit adapters without rewriting the shared structural cores.

### Slice C: normalized candidate aggregation

Use one typed candidate store/path instead of One-Click DOM scraping and legacy/discovery merge duplication.

### Slice D: progressive orchestration

Run lanes independently with cancellation, timeout and bounded concurrency. Preserve current playback while search runs.

### Slice E: provenance UI

Expose source label, source origin and safe `Open source` links.

### Slice F: group/subgroup search

Add identity-backed group/subgroup expansion and grouped result presentation.

### Slice G: retire proven duplicates

Only after parity tests and live verification, retire legacy browser GitHub/web scanning paths that are fully replaced. Keep unique Hunt issue/forum/lead intelligence.

## 15. Non-regression boundaries

Do not break:

- D1-primary My Playlist;
- D1-authoritative Favorites after successful cloud read;
- Saved Playlist D1 truth and IndexedDB reconciliation;
- non-blocking startup;
- Channel Identity/Profile ownership;
- EPG ownership;
- import/promotion policy;
- Source Format Registry semantics;
- shared M3U/STRM/Enigma2 structural cores;
- bouquet proxy transport/security ownership;
- Source Verifier security/status semantics;
- Player fallback/playback semantics unless a separately proven issue requires a bounded change;
- existing save semantics;
- authorized Xtream credential handling;
- project-agent security boundaries.

## 16. Proof of success

The phase is not DONE until implemented, deployed and actually verified.

Minimum proof:

1. Start playing MEGA.
2. Run a broad search for `ERT`.
3. MEGA continues playing without reload/interruption while search lanes run.
4. Search returns grouped ERT-family results progressively.
5. A slow/failing lane does not prevent other results from appearing.
6. Search `ERT1` works even if another sidebar channel is selected/playing.
7. Free-text search still works without requiring the selected sidebar channel to match.
8. Known M3U, STRM and Enigma2 sources resolve through shared cores and produce normalized candidates.
9. HLS/DASH/direct-video candidates show browser-playable capability correctly.
10. RTMP/RTSP findings are recognized but not falsely presented as browser-playable.
11. Each candidate carries provenance; public safe origins open in a new tab.
12. Xtream provenance never leaks credentials.
13. Explicit Play changes the Player; search itself never changes the Player.
14. Existing Player/Verifier/save regression tests remain green.
15. Relevant CI/deploy workflows pass.
16. Live Worker/frontend verification proves exact deployed SHA(s), not only main.

## 17. Current-state / deployment caution

At design time:

- GitHub `main` is `46db7d821cd6bd09c3a044a523cdf82425cb905f`.
- Canonical `WEBV2_CURRENT.md` records Phase E3b runtime merge `cc7e2128e9257cc431a95abf08f2f286e93d2235` as production-verified.
- Fresh Registry `/api/project-status` and `/api/project-checkpoints` content could not be independently read through the available web tool in this session, so no new Registry SHA comparison is claimed.
- Therefore no future implementation may assume `main == production` without fresh deployment evidence.

## 18. Decision summary

Approved design direction captured from the user discussion:

- one simple unified search;
- no Official search lane in the new UX;
- Now Playing remains independent and uninterrupted;
- user explicitly chooses when to Play a search result;
- channel/group/subgroup/free-text search;
- Source Registry for where to search;
- existing Source Format Registry for what a format can do;
- reusable adapters/resolvers;
- progressive/cancellable/bounded search;
- one normalized candidate path;
- Hunt retained only for unique exploratory lead intelligence;
- provenance and safe `Open source` link in a new tab;
- easy addition of new sources and future formats;
- no claim of DONE until deployed and live verified.
