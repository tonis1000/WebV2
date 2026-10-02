# WEBV2 CURRENT STATE

Updated: 2026-10-02
Repository: `tonis1000/WebV2`
Canonical source: GitHub `main/WEBV2_CURRENT.md`.

## CURRENT VERSION
Playlist / Library / Xtream consolidation runtime SHA: `44dc1b777b222b232f3a9aa4c4e4a4a9dcda6b4f` via PR #102.
Xtream My Playlist persistence-boundary follow-up SHA: `f01a422065ff18c0b29841440ba529bdf6df9151` via PR #103.
Xtream preview action hit-layout follow-up SHA: `3fb730f01efa370a1ed7d166978b178868a8dc06` via PR #106.
Local known-source ownership merge SHA: `35306d1161899a8f58801363bd3b1947881db9b2` via PR #100.
Xtream Preview ownership + Custom Saved Playlists runtime merge SHA: `9588e191fd354b42d20ae87ab16d3a2989041df4` via PR #93.
Registry Project Agent PUT auth-boundary follow-up merge SHA: `9f08d898b8209ffa4d32aa11424802df367f63e1` via PR #95.
Xtream All-known unprofiled identity follow-up merge SHA: `bf0b6a70e0c7840c19b0e08c7f2f04396aa22b7a` via PR #97.
Playlist Manager Xtream dialog ownership follow-up merge SHA: `de62fca10c7e452c836d168f2c373b437c936a93` via PR #98.
Official discovery/resolution retirement runtime merge SHA: `92dd5411427a06cc501e924df60f7dc2a80be1c1` via PR #82.
Legacy Discovery Beta production-entry cleanup merge SHA: `53467ff29cfcb7b71cae4e4a74fd9a4cde33e713` via PR #81.
Unified Search Hunt / Discovery consolidation runtime merge SHA: `d6c7e67ca2a3e7203dd00fbf4d83df31b9b779c8` via PR #78.
Unified Search sidebar-selection sync follow-up merge SHA: `90c6d80b7295cc0f17a1f8e976e7b6876e20a604` via PR #79.
Phase E3b Enigma2 normalization runtime merge SHA: `cc7e2128e9257cc431a95abf08f2f286e93d2235` via PR #75.
Phase E3a STRM normalization runtime merge SHA: `35c3f7641221b3ad24b3533269e72218d729e241` via PR #73.
GitHub-canonical CURRENT ownership merge SHA: `c7cb5bda983e405d53190ce4ea8858155b1c4a88`.
Phase E2 runtime merge SHA: `06383089b6fd7b4a31c468c46c7dd2c21ddfdb14`.

Verified Playlist / Library / Xtream consolidation production evidence:
- PR #102 merged at `44dc1b777b222b232f3a9aa4c4e4a4a9dcda6b4f`. It removed the production import and file `src/xtream-enhancements.js`, retired the duplicate `Save Xtream Playlist` path and legacy Xtream → My Playlist merge dialog, added one shared saved-account loader `WebTVXtream.loadAccountById(accountId)`, and moved typed Xtream Saved Playlist card behavior directly into Playlist Manager.
- Saved Xtream Library entries remain account-backed `xtream:<accountId>` markers. Playlist Manager now renders them with the Xtream/person icon, `Load live`, and no Export action. Normal URL/paste/custom Saved Playlist behavior remains owned by Playlist Manager.
- PR #103 merged at `f01a422065ff18c0b29841440ba529bdf6df9151` after live-acceptance review found that the generic My Playlist action could otherwise become a second Xtream persistence path. Loaded Xtream account channels now reject generic My Playlist mutation and point back to the verified Preview flow; `WebTVMyPlaylistAPI.upsertChannel` is the narrow canonical writer used by `Save Channel… → My Playlist` with `reason:'xtream-preview-save'`.
- PR #106 merged at `3fb730f01efa370a1ed7d166978b178868a8dc06` after production Playwright diagnostics proved overlapping hit areas: the center of `Save Channel…` hit `Verify selected channel`. The three preview persistence actions now have a dedicated non-overlapping grid layout.
- Exact-SHA post-merge proof at `3fb730f01efa370a1ed7d166978b178868a8dc06`: Validate WebTV Frontend #849 SUCCESS, Deploy WebTV Registry Worker #113 SUCCESS and GitHub Pages #471 SUCCESS.
- Verification-only PR #105 remained unmerged and was closed after Verify Playlist Library Xtream Live #11 SUCCESS against real production GitHub Pages plus the deployed authorized `test_50` Xtream mock. The final proof showed: legacy Save Xtream Playlist absent; legacy merge dialog absent; Save Channel → My Playlist performed exactly one verified write; Full Account save produced an account-backed Library card with 👤 / Load live / no Export; Load live produced no additional My Playlist persistence; generic My Playlist Add was blocked for a different loaded Xtream account channel; page errors = 0; console errors = 0. Artifact ID: `11216986353`.

Verified Local known-source ownership production evidence:
- PR #100 merged at `35306d1161899a8f58801363bd3b1947881db9b2`.
- `src/known-source-collector.js` is the canonical source aggregation owner for save-time already-known sources; it now includes source-backed Saved M3U snapshots in addition to My Playlist, Custom Playlists and the already-loaded catalog.
- Saved Playlist snapshot reading remains owned by `src/cloud-read-sync.js` through `WebTVSavedPlaylistsReadAPI`; no second cache/read owner was introduced.
- Saved M3U entries are parsed through the existing shared Channel Catalog/M3U path and matched with the canonical known-source identity rules, including preserved `originalId` / `tvgId` handling.
- The save-time path performs no Unified Search, Hunt or network discovery and does not create a Local Search lane.
- Legacy `src/discovery/local-data-reader.js` and `src/discovery/local-candidates.js` remain historical/legacy files pending a separate no-consumer deletion proof; PR #100 did not delete them.
- Exact-SHA post-merge proof at `35306d1161899a8f58801363bd3b1947881db9b2`: Validate WebTV Frontend #813 SUCCESS, Deploy WebTV Registry Worker #109 SUCCESS and GitHub Pages #467 SUCCESS.

Verified Xtream Preview / Custom Saved Playlists production evidence:
- PR #93 merged at `9588e191fd354b42d20ae87ab16d3a2989041df4` with production ownership moved to Playlist Manager / Xtream account management.
- New Xtream Test / Preview is temporary before persistence; explicit verified save is required.
- Custom Saved Playlists are first-class D1-backed mixed-source collections with playlist-specific channel/source ownership.
- Save Channel supports My Playlist, an existing Custom Playlist or a new Custom Playlist.
- Source scope supports Selected source or All known sources. All known sources only uses already-known persisted/runtime sources and does not invoke Unified Search or discovery.
- Full Xtream Account save remains account-backed and does not flatten thousands of provider channels into D1 playlist rows.
- Xtream channel-source cleanup is reference-safe across My Playlist and Custom Playlist references.
- Scalable authorized mock profiles cover 50 / 500 / 5000 channels; production catalog rendering is bounded to at most 100 rows at a time.
- PR #95 fixed the unrelated Registry Project Agent PUT auth boundary found by post-merge verification; Registry deployment verification then passed.
- PR #97 fixed unprofiled channel identity matching so All known sources recognizes a My Playlist row when local `id` normalization differs but `originalId` preserves provider identity.
- PR #98 fixed Playlist Manager interaction ownership so clicking Save in the Xtream destination dialog does not auto-close the manager.
- Production Playwright proof against real GitHub Pages plus the deployed authorized mock provider succeeded after PR #97/#98. In that run: 50-channel preview rendered 50 rows; 500- and 5000-channel previews were bounded to 100 rows; observed preview times were 77 ms / 62 ms / 948 ms, 5000-channel filter time was 168 ms, production load was 949 ms, All known saved two sources, Full Account save succeeded, Player state remained unchanged, and there were no page or console errors. These numbers are run-specific CI observations, not universal performance guarantees.
- GitHub Pages #465 SUCCESS and Deploy WebTV Registry Worker #107 SUCCESS at exact latest runtime SHA `de62fca10c7e452c836d168f2c373b437c936a93`.
- Validate WebTV Frontend #800 initially hit a transient Chrome smoke-test timeout; the same exact SHA was rerun without a code change and completed SUCCESS on attempt 2, including Discovery browser smoke, non-blocking startup and frontend integration audit.

Verified Official discovery retirement production evidence at exact runtime merge SHA `92dd5411427a06cc501e924df60f7dc2a80be1c1`:
- Validate Unified Search #43 SUCCESS
- Validate WebTV Frontend #709 SUCCESS
- Validate Enigma2 Ownership #52 SUCCESS
- Deploy Source Discovery Worker #62 SUCCESS
- Source Discovery deploy step `Verify live Worker and retained external providers` SUCCESS
- Deploy WebTV Registry Worker #100 SUCCESS
- GitHub Pages #458 SUCCESS
- retained discovery capabilities remain covered: Curated, GitHub, Recent Web, STRM, Authorized Xtream, Hunt exploration, Local intelligence and Promotion policy
- Unified Search keeps its permanent `official` provider rejection guard

Verified Unified Search production evidence at exact latest runtime merge SHA `90c6d80b7295cc0f17a1f8e976e7b6876e20a604`:
- Validate Unified Search #33 SUCCESS
- Validate WebTV Frontend #690 SUCCESS
- Deploy WebTV Registry Worker #97 SUCCESS for the same GitHub head
- GitHub Pages #456 SUCCESS for the same GitHub head
- user live-browser verification after deployment SUCCESS: sidebar channel selection auto-fills the Unified Search field, manual free-text editing remains available, and Search remains independent from playback until explicit Play
- PR #78 established the consolidated Unified Search runtime; PR #79 added the bounded sidebar-selection query sync without changing the Player/Search isolation contract

Verified Phase E3b production evidence remains:
- Validate Enigma2 Ownership #15 SUCCESS
- Validate WebTV Frontend #655 SUCCESS
- Deploy Source Discovery Worker #59 SUCCESS
- Deploy WebTV Registry Worker #94 SUCCESS
- GitHub Pages #453 SUCCESS
- post-merge verification-only run #3 SUCCESS: real ERT1 curated Source Discovery returned `HansSettings Greece`, `format=enigma2`, HTTP 200, `count=1`; live Pages served `./src/source-hunt-enigma2.js?v=20260930-enigma2-e3b`; Registry `/api/project-status` reported exact runtime SHA `cc7e2128e9257cc431a95abf08f2f286e93d2235`

Verified Phase E3a production evidence remains:
- Validate WebTV Frontend #619 SUCCESS
- Deploy Source Discovery Worker #58 SUCCESS
- Source Discovery live verification SUCCESS, including real `strm-specific-discovery` request for ERT1, successful STRM resolution condition, and one resolved STRM candidate
- Deploy Source Hunt Worker #6 SUCCESS with live Worker verification
- Deploy WebTV Registry Worker #92 SUCCESS
- GitHub Pages #451 SUCCESS

Verified Phase E2 evidence remains:
- Validate WebTV Frontend #558 SUCCESS
- Deploy Source Discovery Worker #57 SUCCESS with live verification
- Deploy Source Hunt Worker #5 SUCCESS with live verification
- Deploy WebTV Registry Worker #88 SUCCESS
- GitHub Pages #447 SUCCESS

## CURRENT TASK
WebV2 System Audit & UX Consolidation: ACTIVE.
Discovery / Unified Search cleanup remains the wider bounded workstream.
Legacy Discovery Beta production entrypoint cleanup: DONE.
Official discovery/resolution retirement: DONE.
Hunt / Discovery consolidation into Unified Search: DONE.
Unified Search sidebar-selection sync follow-up: DONE.
New Xtream Preview ownership audit + production migration: DONE.
Custom Saved Playlists mixed-source foundation: DONE.
Promotion safety audit for the Xtream preview persistence path: DONE and preserved.
Local scan ownership audit + canonical known-source migration: DONE.
Playlist / Library / Xtream management consolidation: DONE for the approved bounded ownership scope.

Current ownership:
- GitHub `main/WEBV2_CURRENT.md` = canonical project current-state truth.
- `/api/project-status` = Registry deployment truth.
- Registry/D1 `WEBV2_CURRENT.md` checkpoint = mirror/history/fallback, not canonical authority.
- Component-specific workflow/live evidence = deployment truth for that component.

## CURRENT VERIFIED OUTCOME
Playlist / Library / Xtream management consolidation is DONE for the approved bounded ownership scope.
Local scan ownership and canonical known-source migration remain DONE for their approved bounded scope.
Xtream Preview ownership and Custom Saved Playlists remain DONE for their approved bounded scope.

Production Playlist / Library / Xtream ownership now has one full-account save path, one verified channel-save path and one Saved Playlist card owner. Full Xtream account persistence is only Preview → Verify → Save Full Xtream Account. Verified Xtream channel persistence is only Save Channel…; loaded-account channels cannot silently use the generic My Playlist Add path as a second persistence route. Playlist Manager directly owns account-backed Saved Xtream cards and delegates Load live through the shared Xtream account loader.

Production local intelligence now has one canonical save-time aggregation path: `cloud-read-sync` owns reconciled Saved Playlist snapshots, while `known-source-collector` owns channel/source matching and dedupe across My Playlist, Custom Playlists, source-backed Saved M3U playlists and the already-loaded catalog. This intelligence remains background/read-only and does not appear as a Unified Search lane or start network discovery.

Production behavior now has:
- a single production owner for New Xtream onboarding under Playlist Manager / Xtream account management instead of the retired legacy Discovery New-Xtream UI;
- Test / Preview with zero persistence until an explicit verified save action;
- explicit channel save destinations: My Playlist, existing Custom Playlist or New Custom Playlist;
- Selected source by default and optional All known sources snapshot without save-time discovery;
- D1-backed Custom Saved Playlists that may mix channels from different providers/source types while keeping source membership scoped to the destination playlist;
- provider-backed Full Xtream Account save that preserves the live account/catalog model instead of copying the whole provider catalog into custom playlist rows;
- bounded large-catalog rendering and filtering so a 5000-channel account does not create 5000 DOM rows at once;
- preserved Search / Now Playing isolation and explicit-Play-only ownership of Player changes;
- preserved Phase C EPG identity/profile ownership and Phase D promotion safety boundaries.

Official broadcaster discovery/resolution retirement remains DONE.
Unified Search Hunt / Discovery consolidation remains DONE.

## REGISTRY / D1 MIRROR STATUS
Registry/D1 `WEBV2_CURRENT.md` remains mirror/history/fallback, not canonical authority.
During this 2026-10-02 closure preflight, the available web tool could not access `/api/project-status` or `/api/project-checkpoints`, so no fresh direct checkpoint SHA / deployed SHA equality is claimed.
The exact latest runtime main SHA `3fb730f01efa370a1ed7d166978b178868a8dc06` completed Deploy WebTV Registry Worker #113 successfully, GitHub Pages #471 successfully and Validate WebTV Frontend #849 successfully. The Registry workflow's live verification and deployment-status recording steps also completed successfully at that exact SHA.
Because the direct Registry status/checkpoint endpoints were unavailable to the current tool, workflow/live evidence is recorded without pretending that checkpoint SHA, Registry deployed SHA and GitHub main SHA were independently read back as equal.
A stale mirror is an operational mirror-sync issue only and never overrides GitHub CURRENT.
D1 mirror synchronization remains optional operational follow-up and must use fresh CAS/readback if performed.

## COMPLETED PHASES
- State/persistence foundation: DONE
- Channel Identity shared core: DONE
- Channel Profile A/B: DONE
- Phase C EPG ownership: DONE, merge `f5319497aa2f85d7e10fb4946382300da9de6acf`
- Phase D import/promotion contract: DONE, merge `d40a2f34027318d69dd78ef88d06fbfd60dc03fb`
- Phase E1 Source Format Registry: DONE, merge `d9dff4f7b251afe34605e9588b49dcb15d353951`
- Project Brain bootstrap: DONE, production main `fdf91d3274087237578a090fbb55402bef96141d`
- Phase E2 shared M3U/container parsing: DONE, runtime merge `06383089b6fd7b4a31c468c46c7dd2c21ddfdb14`
- GitHub-canonical CURRENT ownership migration: DONE, merge `c7cb5bda983e405d53190ce4ea8858155b1c4a88`
- Phase E3a STRM normalization: DONE, runtime merge `35c3f7641221b3ad24b3533269e72218d729e241`
- Phase E3b Enigma2 normalization: DONE, runtime merge `cc7e2128e9257cc431a95abf08f2f286e93d2235`
- Hunt / Discovery consolidation into Unified Search: DONE, runtime merge `d6c7e67ca2a3e7203dd00fbf4d83df31b9b779c8`
- Unified Search sidebar-selection sync follow-up: DONE, merge `90c6d80b7295cc0f17a1f8e976e7b6876e20a604`
- Legacy Discovery Beta production entrypoint cleanup: DONE, merge `53467ff29cfcb7b71cae4e4a74fd9a4cde33e713`
- Official broadcaster discovery/resolution retirement: DONE, runtime merge `92dd5411427a06cc501e924df60f7dc2a80be1c1`
- Xtream Preview ownership + Custom Saved Playlists: DONE, runtime merge `9588e191fd354b42d20ae87ab16d3a2989041df4`, closure follow-ups `9f08d898b8209ffa4d32aa11424802df367f63e1`, `bf0b6a70e0c7840c19b0e08c7f2f04396aa22b7a`, `de62fca10c7e452c836d168f2c373b437c936a93`
- Local scan ownership + canonical known-source migration: DONE, runtime merge `35306d1161899a8f58801363bd3b1947881db9b2`
- Playlist / Library / Xtream management consolidation: DONE, runtime merge `44dc1b777b222b232f3a9aa4c4e4a4a9dcda6b4f`, persistence-boundary follow-up `f01a422065ff18c0b29841440ba529bdf6df9151`, action-layout follow-up `3fb730f01efa370a1ed7d166978b178868a8dc06`

## NEXT SAFE ACTION
Continue the System Audit one bounded owner at a time:
1. audit Manual Test / Diagnostics / Source Health / Playback Inspector for duplicate responsibilities, hidden second paths and the correct canonical diagnostic owner;
2. separately prove whether the remaining legacy Local Discovery files have zero active consumers before any deletion;
3. then continue Favorites / My Playlist action ownership and Player / EPG / Sidebar audit in the planned sequence.

Do not delete legacy Local Discovery files merely because canonical ownership has moved. Deletion still requires explicit no-consumer proof, regression coverage and deployed verification. Do not redesign Player, Verifier, EPG or final visual layout as part of the diagnostics audit unless a separate bounded problem statement and proof require it.

## DO NOT BREAK
- D1-primary My Playlist
- D1-authoritative Favorites after successful cloud read
- Saved Playlist D1 truth + IndexedDB reconciliation
- Custom Saved Playlist D1 truth with playlist-specific channel/source ownership
- Custom Playlist source snapshots must never own raw Xtream credentials or preview tokens
- Full Xtream Account playlists remain account-backed rather than giant copied D1 channel sets
- Full Xtream Account persistence remains Preview → Verify → Save Full Xtream Account only
- Xtream channel persistence remains the verified Save Channel… flow only; loaded-account channels must not regain a generic My Playlist persistence shortcut
- Saved Xtream Library cards remain Playlist Manager-owned account references with Load live and no synthetic marker export
- Test / Preview persists nothing until explicit verified save
- All known sources means already-known sources only; no implicit Unified Search or discovery at save time
- bounded Xtream catalog rendering for large provider accounts
- reference-safe Xtream channel-source cleanup across My Playlist and Custom Playlist references
- Non-blocking startup
- Phase C EPG identity/profile ownership and fail-closed ambiguity behavior
- Phase D import/promotion boundary
- Phase E1 Source Format Registry transport-vs-media distinction
- Phase E2 shared M3U structural ownership and caller-owned policy
- Phase E3a shared STRM structural ownership and caller-owned network/security/product policy
- Phase E3b shared Enigma2 structural ownership with caller-owned matching/header/security/UI policy
- Unified Search as the single automatic discovery surface
- Unified Search permanent rejection of `official` providers after Official runtime retirement
- Search / Now Playing independence and explicit-Play-only ownership of Player changes
- Unified Search progressive cancellation, stale-run protection, provenance and credential-redaction behavior
- retained Curated / GitHub / Recent Web / STRM / Authorized Xtream / Hunt exploration discovery capabilities
- Promotion safety boundary between temporary findings and permanent saved state
- Local intelligence remains background/read-only for dedupe and known-source awareness; it must not become a Unified Search lane or start save-time network discovery
- bouquet proxy transport/security ownership
- Source Verifier security/status semantics
- Existing Player behavior unless a bounded change proves necessity
- Project-agent least-privilege route separation
- Existing Registry checkpoint/history infrastructure
- Existing PIN implementation while temporary `PIN_AUTH_DISABLED=1` maintenance mode is active

## OPERATIONAL NOTES
- Branch copies of `WEBV2_CURRENT.md` are proposed state; only the copy merged to GitHub `main` is canonical.
- GitHub CURRENT documents verified reality but does not make GitHub `main` automatically equal production.
- Always compare CURRENT claims with `/api/project-status`, relevant CI/deploy workflows, and component-specific live evidence.
- Registry/D1 CURRENT is mirror/history/fallback; its CAS-protected write/editor path remains available for mirror synchronization and historical maintenance.
- `/api/project-status` remains Registry deployment truth, not universal Worker deployment truth.
- Every solved problem that yields reusable knowledge must update the correct Brain owner before task closure.
- DONE means implemented + deployed + actually verified.
