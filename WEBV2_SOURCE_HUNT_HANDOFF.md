# WebV2 Source Hunt / Source Discovery handoff

**Last updated:** 2026-09-28  
**Project:** `tonis1000/WebV2`  
**Purpose:** This file is the continuity note for a future ChatGPT conversation. Read this first before changing Source Hunt, Source Discovery, stream parsing, or the source-verification flow.

---

## 1. What we were trying to solve

The main goal was not to add more and more buttons or separate search tools. The goal was to make the existing **Source Hunt / Find & Test Best** flow smarter, so that WebV2 can discover, inspect, normalize, verify, and then promote useful stream sources from more kinds of public source collections.

The desired user experience is still:

1. Select a channel.
2. Open **Source Hunt**.
3. Press **Find & Test Best**.
4. WebV2 searches the configured discovery lanes behind the scenes.
5. Candidates are verified before being accepted.
6. The UI should show where a candidate came from and why it passed or failed.

The user explicitly does **not** want a forest of new discovery buttons. New source types should feed the existing architecture.

---

## 2. Important architectural rule

Keep this pipeline intact:

`source/feed/page -> parser/resolver -> candidate -> verifier/playback test -> promotion -> SourceRegistry/player`

Discovery must not blindly save a URL just because it was found. A result is a lead/candidate until it survives verification.

Useful source metadata should be preserved whenever possible:

- source origin
- discovery provider
- source type
- required HTTP headers
- freshness / date evidence
- verification result
- failure reason
- whether it was resolved from another reference, such as `.strm`

---

## 3. Source classes discussed and supported

### Direct web streams

Supported or already understood by WebV2:

- HLS `.m3u8`
- DASH `.mpd`
- direct HTTP media
- `.m3u` playlists
- `.strm` references after resolving them to the underlying media URL

The player already has HLS.js and dash.js support.

### Enigma2 web streams

We added parsing for Enigma2 IPTV service lines using service types:

- `#SERVICE 4097`
- `#SERVICE 5001`
- `#SERVICE 5002`

The encoded URL is decoded and treated as a normal candidate.

Pure DVB/satellite Enigma2 references such as `1:0:19:...` are **not** directly playable by a browser. Those require an actual tuner/backend such as Enigma2, TVHeadend, SAT>IP bridge, etc.

### Header-dependent streams

Candidates may require:

- `User-Agent`
- `Referer`
- `Origin`

The project already has header-aware/proxy concepts. The discovery layer should preserve these values rather than stripping them.

### `.strm`

`.strm` is a reference file, not necessarily playable media by itself. A common failure we saw was a raw GitHub `.strm` URL being sent directly to playback and producing an **Unsupported non-media source** result.

This was changed so curated `.strm` references are pre-resolved before playback testing.

### Xtream

Authorized Xtream support already exists in the project. It should remain an authorized-account feature. Do not mix public-source discovery with leaked credentials or unauthorized accounts.

### Other backend-only formats discussed

Possible with a backend/helper, not directly in the browser:

- TVHeadend output
- SAT>IP through a backend
- `streamlink://`
- helper-style `hls://` URLs
- Stalker/Ministra only for an authorized portal

DRM streams are not treated as ordinary direct streams. No DRM bypass is part of this project.

---

## 4. Curated source feeds currently integrated

The Source Discovery worker has a curated feed lane. Primary Greek-focused feeds are scanned first. Broad fallback feeds are used when too few matches are found.

### Primary feeds

- **hitnickgr/iptv**  
  `https://raw.githubusercontent.com/hitnickgr/iptv/refs/heads/main/GreekChannels`

- **jimgate07/grtv**  
  `https://raw.githubusercontent.com/jimgate07/grtv/refs/heads/master/android.m3u`

- **Michatec/Greek-IPTV**  
  `https://raw.githubusercontent.com/Michatec/Greek-IPTV/refs/heads/main/greek-iptv.m3u8`

- **Don24crk**  
  `https://raw.githubusercontent.com/don24crk/Don24crk-Repository/refs/heads/master/android.m3u`

- **iptv-org Greece**  
  `https://iptv-org.github.io/iptv/countries/gr.m3u`

- **HansSettings Greece**  
  OpenPLi HansSettings Greek internet-stream bouquet, Enigma2 format.

- **HansSettings Sport**  
  OpenPLi HansSettings sport internet-stream bouquet, Enigma2 format.

### Fallback feeds

- **Ciefp IPTV Mix**  
  Enigma2 IPTV bouquet from ciefpsettings.

- **Free-TV/IPTV**  
  `https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8`

- **b2og iptv-org All**  
  `https://iptv.b2og.com/o_all.m3u`

### Older / Source Hunt seed feeds also used

The Source Hunt worker separately has known Greek M3U seeds including:

- hitnickgr/iptv
- jimgate07/grtv
- Michatec/Greek-IPTV
- musics300/total
- gdiolitsis/greek-iptv
- Don24crk

Do not assume every URL from these feeds is alive. Their value is discovery, not automatic trust.

---

## 5. Other source families researched in this conversation

These were identified as useful places to continue looking for similar sources.

### HansSettings / OpenPLi ecosystem

HansSettings contains actual internet-stream bouquets for Greece and sport. The Greek bouquet was important because it contained entries for channels such as ERT, Alpha, ANT1, MEGA, OPEN, SKAI, Star and related ERT streams.

Important distinction: HansSettings also contains satellite service references for premium packages. Those are not public HTTP stream URLs and should not be treated as browser-playable sources.

### ciefpsettings / Enigma2 settings repositories

Useful because some bouquets contain `#SERVICE 4097` HTTP IPTV entries. Other bouquets are only satellite service references, so parsing must distinguish those two cases.

### iptv-org

Useful not only for country playlists but also for:

- issue history
- rejected/broken-link labels
- commits
- metadata about User-Agent / Referrer requirements
- source provenance

This led directly to the GitHub issue-intelligence change described below.

### GitHub public playlists / gists

Useful targets include repositories and gists containing:

- `.m3u`
- `.m3u8`
- `.strm`
- Enigma2 `userbouquet.*.tv`
- channel-specific stream references

The GitHub discovery provider uses recent repository activity as a freshness signal.

### Forums / threads

OpenPLi, LinuxSat, Vu+, Reddit and similar technical communities can contain stream snippets, helper URLs, headers, playlist references, or links to repositories. Treat these as **leads**, not trusted final streams.

### Aggregators

`iptv.b2og.com` was discussed as a useful aggregator/meta-source. It can expose public Greek channels and can be monitored as a source of candidate URLs. It is not evidence by itself that a premium stream is authorized or stable.

### Other public playlist projects mentioned during research

Potential discovery targets, to be evaluated individually rather than trusted wholesale:

- `LIVE-GRECO/TV-LIVE-GRECO`
- `dearbulut/iptv`
- `freecasthub/public-iptv`
- `PublicIPTV.com`
- `FreeEPG.de`
- `Free-TV/IPTV`
- TV Garden as a discovery/reference lead
- old Enigma2 webstream repositories such as `nrdn226/enigma2`

These are candidates for further research, not a guarantee of live streams.

---

## 6. Fresh Web discovery

The project has a `recent-web-search` provider that uses Brave Search with freshness windows:

- 24h
- 7d
- 30d

It searches channel-specific queries and scans a limited number of result pages for HLS/DASH URLs or playlist content.

Freshness rules matter. An undated result should not be presented as if it had a known publication date. The search window is evidence of recency, not a fabricated timestamp.

---

## 7. Source Hunt worker behavior

The Source Hunt worker currently combines:

- known Greek M3U seeds
- Fresh Web searches
- forum/thread searches
- Reddit JSON search
- web leads
- forum leads
- page inspection
- channel-name provenance guards
- stale-result rejection
- candidate deduplication

It intentionally separates **candidate streams** from **leads**.

A lead may point to a repository, issue, page, gist, or thread that still needs inspection.

---

## 8. Major change: GitHub issue intelligence

### Why we added it

During testing, Source Hunt could surface a stream from a GitHub / iptv-org issue even when the issue itself already said the link was rejected or broken. That wastes test time and makes the UI look less intelligent.

We therefore added a smart Source Hunt wrapper:

`workers/source-hunt-smart.js`

Current deployed Source Hunt version after this work:

**v1.14**

### What it reads from GitHub issues

For issue URLs it can read:

- issue state
- state reason
- labels
- updated time
- `HTTP User Agent`
- `HTTP Referrer` / `HTTP Referer`

### Rejection policy

If an issue has a label such as:

- `rejected:broken_link`
- another `rejected:*` label

it is no longer treated as an auto-test candidate.

It is retained as a historical lead so that the discovery trail is not lost, but it should not waste playback tests.

This was motivated by an ERT2/ipvt-org issue example where the issue metadata itself already showed that the link had been rejected as broken.

### Commit

`52fc10f7e2a95ea2a8051c9be3076da1835106b4`  
**Add GitHub issue intelligence to Source Hunt**

Deployment commit/workflow update:

`2efdbd031e014710f8faa28afa0bc1b448906af0`

The Source Hunt deployment completed successfully.

---

## 9. Major change: curated `.strm` pre-resolution

### Why we added it

A `.strm` file can contain the actual stream URL inside it. Testing the GitHub raw `.strm` file itself as media caused false failures such as:

`Unsupported non-media source`

### What was added

Smart Source Discovery wrapper:

`workers/webtv-source-discovery-smart.js`

Current deployed Source Discovery version after this work:

**v1.8**

### Behavior

For curated candidates whose source type is `.strm`:

1. Fetch the `.strm` file.
2. Read the first HTTP media target.
3. Follow nested `.strm` references up to a limited depth.
4. Detect resulting type such as HLS/DASH/direct.
5. Preserve Kodi-style headers such as User-Agent, Referer and Origin.
6. Record `resolvedFrom` and resolution diagnostics.
7. Send the final media URL to the normal verifier/playback path.

If DRM-related KODIPROP license information is detected, the reference is not auto-promoted as an ordinary stream.

### Commit

`c2d4140377a7ef0bac5765ad42af4d1baab69bf1`  
**Resolve curated STRM references before testing**

Deployment commit/workflow update:

`d11b7104824a72a6e5886d74a79a1790b4f7e1c5`

The Source Discovery deployment completed successfully.

---

## 10. Previous curated-source expansion

Before the smart wrappers above, we expanded the existing curated remote feed lane rather than inventing a new UI subsystem.

The work included:

- iptv-org Greece
- HansSettings Greece
- HansSettings Sport
- Ciefp IPTV Mix
- Free-TV/IPTV
- b2og iptv-org All
- Enigma2 `#SERVICE 4097/5001/5002` parsing
- URL decoding for Enigma2 IPTV lines
- primary/fallback feed strategy
- parser regression coverage

This work was merged through PR #44:

**Add fresh curated IPTV and Enigma2 sources**

Merge commit:

`ebee5323a0a9cbe8efc1299888478c6777c4b4ab`

The important design decision was to expand `curated-remote-feeds` while keeping the same candidate -> verifier -> promotion architecture.

---

## 11. Source Discovery lanes already present

The project now has, or has discussed/implemented, these lanes:

- `curated-remote-feeds`
- `github-public-playlists`
- `recent-web-search`
- `strm-specific-discovery`
- `official-provider-lane`
- `official-api-resolver`
- `browser-resolved-official`
- `authorized-xtream`

The existing Source Hunt UI should remain the normal entry point for the user. These lanes are implementation detail, not a reason to create seven more top-level buttons.

---

## 12. Source Hunt UI work already done

`src/source-hunt-web.js` was changed so Source Hunt can show more of the discovery work rather than silently returning nothing.

It includes sections for:

- Fresh Curated Feeds
- Known M3U Seeds
- Fresh Web
- Web Leads
- Forums / Reddit
- Forum / Reddit Leads

For curated feeds it can display per-feed information such as:

- feed name
- primary/fallback tier
- format
- HTTP status
- number of channel matches
- elapsed time
- error text

This was done because the user ran `Find & Test Best`, saw candidates being tested, then only saw `No active routes` / `0/1` and reasonably said: **“δεν βλέπω τίποτα”**.

The long-term UI requirement is therefore:

> Never reduce a complete discovery run to only “No active routes”. Show what was found, what was tested, where it came from, and why it failed.

Ideal compact result row:

`Source origin | host | HLS/DASH/STRM | verification result | HTTP/error reason | Test`

Ideal summary:

`Found N | Tested N | Verified N | Active N`

No new top-level search button is needed for this.

---

## 13. Current test state at the end of this conversation

The user was testing **MEGA** and **ERT2** in the live WebV2 site.

Observed before the latest fixes:

- `Find & Test Best` found/tested candidates.
- UI could end at `No active routes` and `0/1` without enough explanation.
- A GitHub issue-derived candidate could be stale/rejected but still appear useful.
- A Don24crk `.strm` reference could be tested as if the `.strm` file itself were media.

The two latest changes were specifically meant to fix the latter two problems.

### Next practical test

After a hard refresh / `Ctrl+F5`:

1. Select **ERT2**.
2. Run **Source Hunt -> Find & Test Best**.
3. Confirm that a GitHub issue marked `rejected:*` is shown only as a rejected/historical lead and is not auto-tested.
4. Confirm that a Don24crk `.strm` candidate is first resolved to an actual media URL, or rejected with a clear STRM resolution reason.
5. Repeat with **MEGA**.
6. If the top result still says `No active routes`, inspect the advanced results and record the exact failure reason for every candidate.

This is the immediate continuation point for the next conversation.

---

## 14. What to investigate next

New similar sources can absolutely still be found. The most productive search targets are not random “free IPTV” websites, but structured repositories and communities that expose enough provenance to automate safely.

Priority research directions:

1. **Fresh Enigma2 settings repositories**  
   Search for `userbouquet.*.tv`, `#SERVICE 4097`, `5001`, `5002`, Greek channel names, and recently updated settings projects.

2. **Fresh M3U/M3U8 repositories and gists**  
   Search by exact channel aliases plus `.m3u8`, `.mpd`, `#EXTINF`, `Greece`, `Greek`, `live`.

3. **iptv-org issue + commit intelligence**  
   Mine recently changed Greece-related issues/commits. Respect `rejected:*` labels and header requirements.

4. **Public technical forums / Reddit**  
   Treat posts as leads. Inspect linked files/pages before testing any URL.

5. **Official channel pages/APIs**  
   Prefer official live pages or APIs when available. Browser-resolved official discovery should be used where static HTML is insufficient.

6. **`.strm` repositories**  
   Now more useful because WebV2 can resolve references before verification.

7. **Header-aware playlists**  
   Look for Kodi/Enigma2 entries that explicitly include User-Agent/Referer/Origin. Preserve those headers end-to-end.

8. **Aggregator feeds as change detectors**  
   Use sources like b2og to discover changes, then verify the underlying stream independently.

The project should prefer fresh, inspectable, provenance-rich sources over large anonymous playlists.

---

## 15. Channel matching lessons

Matching only by substring is dangerous, especially for names such as ANT1, Alpha, Star, Mega, Open, etc.

The Source Hunt worker therefore has channel profiles/aliases and filters for obvious wrong variants.

Examples of things to avoid:

- radio entries
- sport subchannels when the selected channel is the main channel
- VOD/archive links
- `.mp4` archive chunks
- DRM-marked results pretending to be normal live streams
- unrelated channels whose title merely contains a short alias

For ANT1 specifically, subchannel filters were added for variants such as drama/comedy/music/etc.

Future discovery improvements should strengthen channel identity, not weaken it just to increase candidate counts.

---

## 16. Verification philosophy

A URL being syntactically valid is not enough.

The verifier/playback path should distinguish at least:

- verified playable
- HTTP 403
- HTTP 404
- timeout
- unsupported/non-media
- unresolved reference
- DRM
- region restriction
- headers required / missing
- CORS/proxy route required

When possible, the UI should expose the exact reason.

A failed candidate can still be useful intelligence if it tells us what resolver/proxy/header capability is missing.

---

## 17. Why we did not simply save every discovered URL

Public stream URLs are volatile. They disappear, rotate, require headers, become region-limited, or point to something other than the selected channel.

Therefore discovery and storage were deliberately separated.

The philosophy is:

`discover broadly -> verify strictly -> save/promote narrowly`

That is the reason the system may find several candidates but still show zero active routes.

The fix is better diagnostics and better resolvers, not lowering verification standards until bad streams are accepted.

---

## 18. Relevant files to inspect first in a future conversation

Frontend / orchestration:

- `src/source-hunt-engine.js`
- `src/source-hunt-oneclick.js`
- `src/source-hunt-web.js`
- `src/discovery/discovery-ui.js`
- `src/discovery/external-discovery-client.js`
- `src/discovery/verifier-client.js`
- `src/discovery/promotion.js`
- `src/core/source-registry.js`
- `src/core/player.js`

Workers:

- `workers/source-huntatonisworkersdev.js`
- `workers/source-hunt-smart.js`
- `workers/webtv-source-discovery.js`
- `workers/webtv-source-discovery-smart.js`
- `workers/webtv-source-verifier.js`
- `workers/source-discovery/github-public-playlists.js`
- `workers/source-discovery/recent-web-search.js`
- `workers/source-discovery/strm-specific-discovery.js`
- `workers/source-discovery/official-provider-lane.js`
- `workers/source-discovery/official-api-resolver.js`
- `workers/source-discovery/browser-resolved-official.js`

Deployment:

- `.github/workflows/deploy-source-hunt.yml`
- `.github/workflows/deploy-source-discovery.yml`

Existing architecture/operations notes:

- `SOURCE_DISCOVERY_ARCHITECTURE.md`
- `WEBTV_OPERATIONS.md`

---

## 19. Deployment state recorded at handoff

At the end of this work:

- **Source Hunt Worker v1.14** deployment: successful
- **Source Discovery Worker v1.8** deployment: successful

Do not assume this remains true forever. At the start of a future debugging conversation, check the current `main` branch and latest workflow runs before claiming what is live.

---

## 20. Safety / scope boundary

This project can discover and use public or authorized stream sources and can integrate a user's own authorized backend/account.

Do not turn Source Hunt into a credential-harvesting system and do not add:

- leaked Xtream usernames/passwords
- hacked Stalker/Ministra MACs
- stolen premium provider URLs
- DRM bypass
- circumvention intended to access unauthorized premium channels

Public/official/authorized discovery, headers, normal proxies, format conversion, backend integration and availability verification are in scope.

---

## 21. One-paragraph handoff for ChatGPT

If a new conversation starts, the short version is: **WebV2 Source Hunt was expanded so one existing “Find & Test Best” flow can search curated Greek/public M3U feeds, Enigma2 IPTV bouquets, GitHub playlists, Fresh Web, forums/Reddit, official sources, STRM references and authorized Xtream. We added curated feeds including iptv-org Greece, HansSettings, Ciefp, Free-TV and b2og, plus Enigma2 4097/5001/5002 parsing. We then fixed two concrete bad-discovery patterns: Source Hunt v1.14 now reads GitHub issue labels/state/headers and blocks `rejected:*` issues from auto-testing, and Source Discovery v1.8 now resolves curated `.strm` references to their underlying media URL before verification. Both deployments succeeded. The current next step is live testing ERT2/MEGA after Ctrl+F5 and improving the existing Advanced stream results so every found/tested/failed candidate shows origin and exact failure reason instead of only “No active routes”. Do not add more top-level discovery buttons unless absolutely necessary.**
