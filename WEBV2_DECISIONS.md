# WebV2 Decision Log

## DEC-001 D1-primary My Playlist
Decision: D1 is the primary persistent My Playlist truth.
Reason: avoid fragmented cloud/local ownership.
Reconsider when: only if a replacement persistence model is explicitly designed and migrated.

## DEC-002 D1-authoritative Favorites after cloud read
Decision: after successful cloud read, D1 wins; localStorage is offline fallback.

## DEC-003 Browser Resolver retired
Decision: retire Browser Resolver/browser-resolved-official path.
Historical note: this decision originally retained `official-api-resolver` and the official-provider lane. That retained Official path was later explicitly retired by DEC-015 after the Unified Search consolidation and Discovery cleanup audit.

## DEC-004 Identity and Profile are separate
Decision: Channel Identity owns ids/names/aliases/rejects/official refs; Channel Profile owns canonical metadata/presentation/EPG mapping state.
Consequence: streams never belong in Channel Profile.

## DEC-005 WebV2 channel id != EPG provider id
Decision: provider XMLTV/tvg identifiers never redefine stable WebV2 identity.

## DEC-006 Hunt / Discovery / Verifier are separate logical roles
Decision: Hunt finds leads, Discovery normalizes candidates, Verifier verifies resolved media.
Consequence: deployment/file boundaries may evolve without collapsing responsibilities.

## DEC-007 Source Format Registry owns format identity/detection
Evidence: Phase E1 merge `d9dff4f7b251afe34605e9588b49dcb15d353951`.
Decision: generic HTTP transport is not confirmed playable media; unknown formats fail closed but remain inspectable/extensible.

## DEC-008 No big-bang cleanup
Decision: migrate one bounded responsibility at a time with parity tests and exact verification.

## DEC-009 DONE definition
Decision: DONE means **implemented + deployed + actually verified**. GitHub main alone is insufficient.

## DEC-010 Delete only with proof
Decision: obsolete-looking code/docs enter Cleanup first. Removal requires replacement/no-consumer/regression/deploy proof.

## DEC-011 Shared M3U structure, caller-owned policy
Decision: Phase E2 centralizes only neutral M3U container structure in `src/core/m3u-container.js`.
Reason: the previous active callers duplicated EXTINF/source traversal but intentionally had different matching, scheme acceptance, ranking, trust, and candidate behavior.
Consequence: the shared parser may expose a neutral source line and structural metadata, while Channel Catalog, Source Discovery, Source Hunt Worker, and frontend Hunt continue to decide what they accept and how they rank/use it.
Hard rule: **shared parser parses; caller decides.**
Non-goal: this decision does not move STRM resolution or Enigma2 parsing into the M3U core.
Reconsider when: only if a later explicit architecture phase proves that a policy itself has one canonical owner and parity is preserved.

## DEC-012 Mixed-case EXTINF is always a structural boundary
Decision: the shared M3U core recognizes `#EXTINF` case-insensitively as a structural entry boundary, even when a caller such as Channel Catalog keeps a stricter uppercase-only policy for accepting that entry.
Reason: one entry must never consume a source structurally belonging to the next entry. The old Catalog/frontend line loops could accidentally let an uppercase entry steal a URL from a following lowercase `#extinf` entry because their boundary check was case-sensitive.
Consequence: caller acceptance policy remains unchanged, but cross-entry source stealing from malformed/mixed-case input is explicitly not preserved.
Evidence: `tests/channel-catalog-m3u-parity.test.mjs` freezes the no-steal rule; the E2 design already requires mixed-case structural coverage and says behavior differences must be explicit rather than silent.

## DEC-013 GitHub CURRENT is canonical project current state
Decision: GitHub `main/WEBV2_CURRENT.md` is canonical project current-state truth; Registry/D1 `WEBV2_CURRENT.md` is mirror/history/fallback.
Reason: the Project Brain is already versioned, reviewed and diffable in GitHub, while the D1 CURRENT became stale after verified E2 production progress because updating it depended on a narrower checkpoint write path.
Consequences:
- only the copy merged to GitHub `main` is canonical;
- `/api/project-status` remains Registry deployment truth and component workflows/live evidence remain authoritative for their components;
- a stale D1 CURRENT mirror is a mirror-sync issue, not canonical unavailability;
- if GitHub CURRENT conflicts with verified live reality, enter reconciliation mode and update GitHub CURRENT rather than treating documentation as production by assertion;
- D1 checkpoint/history infrastructure and project-agent routes remain preserved.
Reconsider when: only through a new explicit architecture decision with a migration/rollback plan; never by silently promoting a mirror back to authority.

## DEC-014 Shared STRM structure, caller-owned network/security/product policy
Decision: Phase E3a centralizes neutral STRM structure and normalization in `src/core/strm-core.js`, while every runtime caller keeps its own networking, security, request-budget, reporting, ranking, save/test and playback policy.
Reason: browser/runtime, Source Discovery, the Discovery smart wrapper, and Source Hunt duplicated STRM parsing but intentionally differed in fetch/security semantics. A universal network resolver would collapse trust boundaries and risk changing browser playback or Worker SSRF protections.
Consequences:
- the shared core is pure and MUST NOT fetch;
- shared responsibilities include reference normalization, `.strm` recognition, KODIPROP/DRM metadata, Kodi header suffix parsing and ordered neutral STRM line structure;
- browser `StrmResolver` keeps cache, failure TTL, in-flight dedupe and recursion;
- Discovery keeps private/local target blocking, timeouts, body/subrequest/depth limits, reports and provider policy;
- Discovery smart wrapper keeps curated-only pre-resolution, resolve limit and DRM auto-promotion rejection;
- Hunt keeps budgets, relevance/ranking and final HLS/DASH acceptance;
- Enigma2 remains a separate E3b problem.
Hard rule: **shared STRM structure; caller-owned network/security/product policy.**
Reconsider when: only if a later explicit design proves one network-resolution service should own all callers and preserves security/playback parity.

## DEC-015 Official broadcaster discovery/resolution retired
Decision: retire the legacy Official broadcaster discovery/resolution runtime and do not reintroduce an `official` automatic-discovery lane into Unified Search by default.
Reason: for the WebV2 use case, locating an official broadcaster page/stream manually is comparatively easy, while keeping the automated Official path required broadcaster-specific registries, resolver logic, verifier coupling, tests and deployment checks.
Retained capabilities and why they remain:
- Curated feeds reduce repeated manual source inspection.
- GitHub playlists surface public playlist sources that are not obvious to locate by hand.
- Recent Web finds fresh leads outside the fixed catalog.
- STRM discovery/resolution resolves technical indirection into actual media targets.
- Authorized Xtream searches explicit user-authorized accounts without exposing credentials.
- Hunt exploration covers wider non-obvious leads.
- New Xtream preview provides temporary inspection before persistence.
- Promotion policy protects the boundary between temporary findings and permanent saved state.
- Local scan remains background intelligence for dedupe and known-source awareness rather than a visible lane.
Consequences:
- Unified Search keeps its explicit `official` provider rejection guard;
- retiring Official does not authorize deleting or weakening the retained discovery capabilities above;
- Official-site lookup remains a manual user action when needed rather than a dedicated maintained discovery subsystem;
- this decision does not change Player, Verifier, D1 save semantics, Xtream credential protections, or Search/Now Playing isolation.
Evidence: PR #82 runtime merge `92dd5411427a06cc501e924df60f7dc2a80be1c1`; Validate Unified Search #43, Validate WebTV Frontend #709, Validate Enigma2 Ownership #52, Deploy Source Discovery Worker #62, Deploy WebTV Registry Worker #100 and GitHub Pages #458 all succeeded; the Source Discovery deployment's `Verify live Worker and retained external providers` step also succeeded.
Reconsider when: only if a new bounded problem proves that automated Official discovery adds material value that manual lookup plus retained discovery paths cannot provide, with explicit maintenance cost and live acceptance proof.

## DEC-016 Xtream preview is owned by account management; custom playlists own mixed-source membership
Decision: New Xtream onboarding is owned by Playlist Manager / Xtream account management, not Unified Search or the legacy Discovery UI. Test / Preview is temporary and non-persistent; durable state is created only by explicit verified Save Channel or Save Full Account actions.

Custom Saved Playlists are first-class user-owned mixed-source collections. D1 normalized membership is their truth. Channel/source ownership is scoped by `(playlist, channel)` so the same canonical channel may have different source sets in different custom playlists. My Playlist keeps its existing independent persistence model.

Source-save rules:
- `Selected source` is the default channel-save scope.
- `All known sources` is an explicit snapshot of already-known eligible sources only; it MUST NOT invoke Unified Search, Hunt or network discovery at save time.
- Custom playlists never own raw Xtream credentials or preview tokens.
- A durable saved Xtream channel source is materialized through secure Xtream storage and may be referenced by My Playlist or Custom Playlists.
- Full Xtream Account save stays account-backed and preserves provider catalog/category/EPG provenance rather than flattening the provider catalog into thousands of D1 playlist membership rows.
- Large account UI rendering remains bounded; current production ownership renders at most 100 catalog rows at once.
- Player ownership remains independent; preview/save flows do not change playback unless an explicit Play action is invoked elsewhere.

Reason: the previous safe preview/promotion machinery survived the Discovery cleanup but lost a normal production UI owner. At the same time, the Library needed a first-class way to create user-curated playlists containing channels from different providers without duplicating credentials, collapsing source ownership into My Playlist, or turning Unified Search into a save-time side effect.

Evidence:
- PR #93 merge `9588e191fd354b42d20ae87ab16d3a2989041df4` implemented the architecture, including custom D1 membership/source rows, production Test / Preview ownership, explicit destinations, reference-safe cleanup, full-account markers and 50/500/5000 scalable mock coverage.
- PR #95 merge `9f08d898b8209ffa4d32aa11424802df367f63e1` restored the Project Agent least-privilege auth boundary after Registry integration exposed an unrelated route-dispatch regression.
- PR #97 merge `bf0b6a70e0c7840c19b0e08c7f2f04396aa22b7a` fixed All-known identity matching for unprofiled channels by considering preserved `originalId` / `tvgId` identities as well as normalized local ids.
- PR #98 merge `de62fca10c7e452c836d168f2c373b437c936a93` fixed save-dialog interaction ownership so the Playlist Manager stays open during save.
- Production Playwright verification against GitHub Pages and the deployed authorized mock provider passed for 50, 500 and 5000 channels, bounded rendering, filtering, Selected / All-known save, Custom Playlist creation, Full Account save, Player independence and zero page/console errors.

Reconsider when: only if a later architecture phase replaces D1 Library ownership or proves a different single owner for Xtream onboarding/custom collections while preserving credential isolation, explicit-save semantics, Player/Search separation and migration compatibility.


## DEC-017 Local intelligence has one canonical known-source aggregation path
Decision: save-time local intelligence is background/read-only data, not a Unified Search lane. `src/known-source-collector.js` owns channel/source matching and dedupe for already-known sources, while `src/cloud-read-sync.js` remains the single owner of reconciled Saved Playlist snapshot reads through `WebTVSavedPlaylistsReadAPI`.

Known-source inputs may include:
- My Playlist;
- Custom Saved Playlists;
- source-backed Saved M3U playlists already present in the reconciled local cache;
- the already-loaded catalog;
- the explicitly selected source.

Hard rules:
- no Unified Search, Hunt or network discovery is started by All known sources;
- Local intelligence does not become a visible automatic-discovery lane;
- source-backed Saved M3U matching must use the canonical known-source identity rules rather than the legacy Discovery-local identity implementation;
- Saved Playlist read/cache ownership is not duplicated into Playlist Manager or another consumer;
- legacy Discovery Local files are not deleted until a separate no-consumer/deletion proof succeeds.

Reason: the legacy Discovery Local Scan contained useful Saved M3U coverage, but its production entrypoint had already been retired and it carried an independent identity path. Moving the missing Saved M3U coverage into the existing known-source collector preserves the useful capability while eliminating the need for two competing local-intelligence owners.

Evidence: PR #100 merge `35306d1161899a8f58801363bd3b1947881db9b2`; RED-first known-source and save-destination ownership tests; exact-SHA Validate WebTV Frontend #813, Deploy WebTV Registry Worker #109 and GitHub Pages #467 SUCCESS.

Reconsider when: only if a later architecture phase replaces the Library/cache model or proves a different single local-intelligence owner while preserving no-search-at-save, source identity, dedupe and startup boundaries.


## DEC-018 Xtream persistence has one verified entry and Playlist Manager owns Saved Xtream cards
Decision: durable Xtream persistence is owned only by the verified Preview flows. Full account persistence is `Test / Preview → Verify → Save Full Xtream Account`. Channel persistence is `Test / Preview → Verify → Save Channel…`, including My Playlist through the narrow `WebTVMyPlaylistAPI.upsertChannel(..., {reason:'xtream-preview-save'})` contract.

Saved Xtream Library rows are account references, not ordinary M3U playlists. Playlist Manager directly owns their presentation and loading:
- typed `kind/type='xtream'` plus `xtream:<accountId>` identity;
- Xtream/person icon;
- `Load live` through `WebTVXtream.loadAccountById(accountId)`;
- no Export of the synthetic marker M3U.

Hard rules:
- the retired `Save Xtream Playlist` button/path must not return;
- the retired Xtream → My Playlist merge overlay must not return;
- loaded Xtream account channels must not use generic Add/Source mutation as a second persistence path;
- normal Saved Playlist URL/paste/custom behavior remains Playlist Manager-owned and unchanged;
- no credentials or preview tokens enter Saved Playlist markers;
- account loading is read/load behavior and must not persist by itself.

Reason: `src/xtream-enhancements.js` duplicated full-account persistence, channel-to-My-Playlist persistence and Library presentation through DOM interception and MutationObserver patching. Consolidating these responsibilities removes competing owners and preserves a single explicit verification boundary.

Evidence:
- PR #102 runtime merge `44dc1b777b222b232f3a9aa4c4e4a4a9dcda6b4f` removed `src/xtream-enhancements.js`, added the shared account loader and moved Xtream Library card ownership into Playlist Manager.
- PR #103 follow-up `f01a422065ff18c0b29841440ba529bdf6df9151` closed the generic My Playlist persistence gap and exposed the verified-only upsert contract.
- PR #106 follow-up `3fb730f01efa370a1ed7d166978b178868a8dc06` fixed overlapping preview persistence hit areas found by live Playwright acceptance.
- Exact-SHA Frontend #849, Registry #113 and Pages #471 succeeded at PR #106 runtime SHA.
- Verification-only PR #105 was closed unmerged after live production run #11 succeeded with the authorized `test_50` mock: legacy save/merge UI absent, exactly one verified My Playlist write, Full Account account-backed card with 👤 / Load live / no Export, Load live with no extra persistence, generic loaded-Xtream Add blocked, and zero page/console errors.

Reconsider when: only if a later explicit architecture replaces Playlist Manager or the Preview verification boundary while preserving single-owner persistence, credential isolation, backward-compatible account markers and live acceptance proof.


## DEC-019 Playback Inspector is not a My Playlist persistence owner
Decision: Playback Inspector is a diagnostic/management surface, not an independent persistence owner. Permanent My Playlist source mutations initiated from the Inspector must delegate to the canonical `WebTVMyPlaylistAPI`; the Inspector must not write `/api/my-playlist/channel` directly.

Hard rules:
- Inspector `Test edited URL` remains temporary playback/diagnostic behavior and persists nothing by itself;
- Inspector Add source delegates to `WebTVMyPlaylistAPI.addSourceToCurrent`;
- Inspector Edit/Delete delegate to `WebTVMyPlaylistAPI.replaceSourcesForCurrent`;
- loaded Xtream account channels inherit `assertGenericMyMutationAllowed` and therefore cannot use Inspector Add/Edit/Delete as a second generic Xtream persistence path;
- normal non-Xtream My Playlist Add/Edit/Delete behavior remains available, including explicit deletion of the last source;
- Xtream orphan-source cleanup remains owned by Playlist Manager/canonical My Playlist mutation logic rather than the Inspector.

Reason: the diagnostics audit found that `src/saved-sources-ui.js` had its own direct Registry PUT helper even after PR #103 had established a single loaded-Xtream persistence boundary in Playlist Manager. A diagnostic UI with its own writer could silently bypass that boundary.

Evidence:
- RED Validate WebTV Frontend #854 failed exactly on the new Inspector persistence-boundary regression.
- PR #108 runtime merge `7fd58ee145884d09e19d4ef1321c18f0fdabc028`; exact-SHA Frontend #856, Registry #115 and Pages #473 SUCCESS.
- Verification-only PR #109 remained unmerged and was closed after Verify Playback Inspector Boundary Live #8 SUCCESS against real production GitHub Pages and deployed authorized `test_50`: temporary Test caused zero persistence, normal Add/Edit/Delete all succeeded through the canonical path, loaded-Xtream Inspector Add caused no new write (3→3), top-level loaded-Xtream Add remained blocked, page errors = 0 and console errors = 0. Artifact ID `11220235679`.

Non-goal: this decision does not yet consolidate Source Health route reconstruction or replace the current diagnostics DOM/MutationObserver coupling. Those remain separate bounded diagnostics-audit tasks.

Reconsider when: only if a future architecture explicitly replaces `WebTVMyPlaylistAPI` with another single persistence owner while preserving loaded-Xtream verification boundaries, source cleanup and live acceptance proof.


## DEC-020 SourceRegistry owns Source Health route diagnostics
Decision: `SourceRegistry` is the canonical owner of curated playback route semantics used by Source Health. Source Health is a presentation/health-metric consumer and must not independently reconstruct direct / worker / worker+headers / STRM routes.

Hard rules:
- `SourceRegistry.getCuratedRouteDiagnostics(channel)` owns curated diagnostic route rows;
- `WebTVDiagnosticsAPI.getSourceHealthRows` delegates to the active SourceRegistry instance;
- Source Health must not import route-building/classification helpers for its own route model, construct worker URLs, or instantiate a second STRM resolver;
- Source Health may join canonical route rows with health entries and presentation state;
- HTTPS HLS, header HLS, HTTP HLS, DASH and video route identities must remain aligned with SourceRegistry playback semantics;
- generic HTTPS transport is not enough to advertise a playback route: non-media URLs remain excluded;
- this ownership change must not alter Player route order, health scoring/cooldown, remote-source behavior or STRM playback/security policy.

Reason: the diagnostics audit found that Source Health duplicated route construction already owned by SourceRegistry. That second model could drift from the routes the Player actually considered, including treating generic HTTPS as a direct route even when SourceRegistry would not classify it as playable media.

Evidence:
- RED Validate WebTV Frontend #867 failed exactly on the new Source Health route-ownership regression.
- PR #111 runtime merge `367421d007c79cd6e7d54e61278c56dc62a910d6`; exact-SHA Frontend #871, Registry #117 and Pages #475 SUCCESS.
- Verification-only PR #112 remained unmerged and was closed after Verify Source Health Route Ownership Live #1 SUCCESS against real production GitHub Pages: canonical rows and the actual playback plan both reported direct + worker for the selected curated HLS source; Source Health rendered the same DIRECT + WORKER rows; route-contract coverage for headers / HTTP / DASH / video / non-media passed; page errors = 0 and console errors = 0. Artifact ID `11222443409`.

Non-goal: this decision does not replace the remaining diagnostics DOM / MutationObserver state propagation. That coupling remains a separate bounded diagnostics-audit task.

Reconsider when: only if a future architecture replaces SourceRegistry as the single playback-route owner while preserving exact route semantics, health behavior and live acceptance proof.


## DEC-021 Runtime diagnostics state has one structured owner
Decision: `main.js` / `WebTVDiagnosticsAPI` is the single owner of runtime diagnostics state. Consumers receive a read-only snapshot through `WebTVDiagnosticsAPI.getSnapshot()` and updates through `webtv:diagnostics-updated`. Rendered diagnostics DOM is presentation only and must not be used as an inter-module state bus.

Hard rules:
- Manual Test verification consumes structured diagnostics state, not `#diag-*` or playback-status DOM mutations;
- Playback Inspector sync/Edit/Delete decisions consume structured diagnostics state, not diagnostic DOM text;
- Source Health refreshes from the structured diagnostics event and gets route rows from the canonical SourceRegistry owner;
- `#diag-source`, `#diag-route`, `#diag-player` and `#diag-startup` remain user-visible presentation and may be updated by the diagnostics producer, but consumers must not infer business state by observing them;
- this state-transport ownership must not change Player callback order, verification policy, health scoring, persistence boundaries or route semantics.

Reason: the diagnostics audit found a hidden second state bus where Manual Test, Playback Inspector and Source Health learned runtime state by observing rendered DOM. That coupled business behavior to presentation timing and allowed UI text mutations to act like state changes.

Evidence:
- RED Validate WebTV Frontend #875 failed exactly on the structured-state ownership contract; intermediate validation exposed and removed two remaining Inspector diagnostic-DOM fallbacks.
- PR #114 runtime merge `040e6be426a7367f8e0ccc6446f5908f82d8ff15`; exact-SHA Frontend #879, Registry #119 and Pages #477 SUCCESS.
- Verification-only PR #115 remained unmerged and was closed after Verify Diagnostics Structured State Live #9 SUCCESS using real production Pages and deterministic browser media. Initial playback and Manual Test both reached structured `live` states, deliberate diagnostic-DOM tampering did not propagate to Inspector state, durable playlist writes remained zero before explicit save, and page/console errors were zero. Artifact ID `11224181561`.

Reconsider when: only if a future architecture replaces `WebTVDiagnosticsAPI` with another single structured diagnostics owner while preserving behavior and live acceptance proof.

## DEC-022 Legacy Local Discovery scan retired after zero-consumer proof
Decision: retire and delete the legacy Local Discovery owner files and Local shell path after canonical local intelligence moved to `cloud-read-sync.js` + `known-source-collector.js` and zero active production consumers were proven.

Deleted/retired ownership:
- `src/discovery/local-data-reader.js`;
- `src/discovery/local-candidates.js`;
- legacy Discovery `Find Local Sources` control, Local lanes, `scanLocalSources` and public `scanLocal` API;
- owner-specific `tests/discovery-local-sources.test.mjs`.

Retained capabilities:
- canonical already-known source aggregation across My Playlist, Custom Playlists, source-backed Saved M3U and loaded catalog;
- Curated / GitHub / Recent Web / STRM / Authorized Xtream discovery;
- verifier and generic verified-source promotion;
- Search / Player isolation and explicit-play boundaries.

Hard rules:
- Local intelligence remains background/read-only and must not reappear as a Unified Search lane or start save-time network discovery;
- the deleted Local owner files/control/API must not return without a new bounded architecture decision;
- retained non-Local discovery capabilities must not be weakened as a side effect of Local retirement.

Reason: after PR #100 migrated the last useful Saved M3U coverage into the canonical known-source path, the legacy Local implementation had no production entrypoint owner and only survived inside an isolated legacy shell. Keeping it created duplicate identity/aggregation ownership and a hidden `scanLocal` API with no canonical product role.

Evidence:
- RED Validate WebTV Frontend #889 proved the legacy owners were still present.
- PR #116 retirement work found and removed a hidden `window.WebTVDiscovery.scanLocal` path and stale `localBusy` state before merge rather than weakening coverage.
- Runtime merge `8ef91a32d898930dfd38d82220ebc370b0444ed2`; exact-SHA Frontend #897, Registry #120 and Pages #478 SUCCESS.
- Verification-only PR #117 remained unmerged and was closed after Verify Legacy Local Discovery Retirement Live #3 SUCCESS: both deleted files returned production HTTP 404; live shell Local ownership was absent; retained capabilities and canonical search remained present; page/console errors were zero. Artifact ID `11224489871`.

Reconsider when: only if a new bounded use case proves a distinct Local discovery lane is needed and cannot be satisfied by canonical known-source intelligence plus retained external discovery, with explicit ownership and live proof.


## DEC-023 Favorites are My Playlist-only and Source Hunt delegates My Playlist persistence
Decision: Favorites are a feature of the D1 My Playlist catalog only. Source Hunt is not an independent My Playlist persistence owner; discovered-channel saves delegate to Playlist Manager through the narrow `WebTVMyPlaylistAPI.saveDiscoveredChannel` API.

Hard rules:
- Favorite filter, row decoration/sorting/filtering and Favorite channel mutation operate only when `WebTVPlaylistAPI.getCatalogMode()==='cloud'`;
- temporary/imported catalogs, Saved/Custom playlist catalogs, loaded Xtream catalogs and other non-My-Playlist surfaces must not expose or apply Favorite behavior;
- existing Favorites remain D1-authoritative after successful cloud read with local fallback; this decision performs no Favorite data cleanup/migration;
- expanding Favorites to another catalog requires a separate future product decision;
- Source Hunt must not contain a direct `/api/my-playlist/channel` writer;
- Source Hunt My Playlist saves use `WebTVMyPlaylistAPI.saveDiscoveredChannel(...,{reason:'source-hunt-save'})`;
- Playlist Manager owns auth, payload, D1 write and primary My Playlist refresh for that path;
- the discovered target must include the actual discovered source URLs before the generic loaded-Xtream guard is evaluated;
- verified Xtream Preview persistence remains owned by the existing `xtream-preview-save` path and must not be bypassed through Source Hunt.

Reason: the ownership audit found one remaining direct My Playlist writer in Source Hunt and a catalog-agnostic Favorites UI. The former duplicated persistence ownership; the latter allowed Favorite state to decorate/filter catalogs outside the user's intended My Playlist-only scope.

Evidence:
- RED Validate WebTV Frontend #903 failed exactly on the direct Source Hunt writer.
- PR #119 review caught and fixed a real loaded-Xtream guard gap before merge; final exact-head Validate WebTV Frontend #906, Playlist Manager Xtream Dialog Ownership #21 and Xtream Save Destination #71 all succeeded.
- Runtime merge `3adc057cd2f0186a1fab506c7c8e4d36ceea9973`; post-merge Frontend #907, Registry #122 and Pages #480 SUCCESS.
- Verification-only PR #120 remained unmerged and was closed after Verify My Playlist Action Ownership Live #4 SUCCESS against real production Pages with Registry mutations mocked: My Playlist Favorites worked; temporary catalog Favorites were hidden/inert and did not affect rows; canonical Source Hunt save produced exactly one My Playlist write with source-hunt provenance/position; loaded-Xtream Source Hunt save was blocked before persistence; page/console errors were zero. Artifact ID `11227811674`.

Reconsider when: if the product deliberately adds cross-playlist Favorites, or if a future single persistence owner replaces Playlist Manager while preserving D1-primary My Playlist, Xtream verification boundaries and live acceptance proof.


## DEC-024 main.js and one PlayerController own active playback/fallback orchestration
Decision: production playback and fallback orchestration has one active owner chain: `main.js` creates one `PlayerController`, and UI/search consumers reach it through the narrow `WebTVPlaybackAPI` bridge. The retired legacy `src/source-hunt-oneclick.js` orchestration owner is deleted after zero-consumer proof and must not return.

Hard rules:
- `main.js` instantiates exactly one active `PlayerController`;
- `main.js` exposes the one production `WebTVPlaybackAPI` bridge for candidate test, selected-channel replay and stop;
- Manual Source Test and Unified Search candidate playback delegate through that bridge rather than controlling media elements directly;
- `PlayerController` owns actual HLS / DASH / native-video attempts, media reset/stop behavior and official fallback loading;
- `src/source-hunt-oneclick.js` remains deleted and its legacy One-click control/orchestration must not be reintroduced;
- dormant historical orchestration must not survive in the repo merely because it is no longer imported; zero-consumer proof is required before deletion and a new bounded architecture decision is required before revival;
- this decision does not alter route ranking, health scoring, fallback policy, diagnostics semantics, EPG behavior or Sidebar behavior.

Reason: the audit found that active production ownership was already singular, but an orphaned legacy One-click module still contained a complete second search/playback/fallback orchestration path. Keeping a dormant second owner created a future regression path even though it was not currently loaded.

Evidence:
- RED Validate WebTV Frontend #914 proved zero `src/**/*.js` consumers and no production entrypoint reference, then failed only because the legacy file still existed.
- PR #122 runtime merge `258bc39cc4a4f26c94c7d4933772ca9a3e3ff1c7`; exact-head Frontend #915 and post-merge Frontend #916, Registry #124 and Pages #482 SUCCESS.
- Verification-only PR #123 remained unmerged and was closed after Verify Player Ownership Live #1 SUCCESS against real production Pages: legacy file HTTP 404, exactly one live PlayerController construction and one WebTVPlaybackAPI bridge, official fallback still PlayerController-owned, Manual Test + Unified Search retained, legacy One-click control absent, stop/idle state coherent, page/console errors zero. Artifact ID `11230147095`.

Reconsider when: only if a future playback architecture intentionally replaces the `main.js` + `PlayerController` owner chain, with an explicit migration plan, regression proof and production live verification.


## DEC-025 main.js owns EPG refresh scheduling; Sidebar is a read-only EPG consumer
Decision: Phase C EPG semantic ownership remains in `src/core/epg.js`, while `main.js` is the sole frontend owner of EPG refresh scheduling. Sidebar Now Playing consumes the shared EPG singleton for presentation only and must not start or schedule EPG refreshes.

Hard rules:
- `src/core/epg.js` owns EPG feed URLs, XMLTV parsing, programme storage/indexing, Channel Identity/Profile-based resolution and fail-closed ambiguity behavior;
- `main.js` owns the initial `epg.refresh()` and the periodic EPG refresh schedule;
- `src/sidebar-now.js` may instantiate/read the shared singleton and call `epg.get(channel)`, but must not call `epg.refresh()`, consume `CONFIG.epgRefreshMs` or independently decide feed retry/refresh timing;
- Sidebar presentation may update from `webtv:epg-updated`, channel-row mutations, `webtv:ready` and a presentation-only render tick;
- provider XMLTV identifiers and aliases continue to flow through the preserved Phase C Identity/Profile contract and must not redefine stable WebV2 identity;
- this ownership change must not alter current/next programme selection, progress calculation, time formatting, feed preference/fallback, Player behavior or final Sidebar layout.

Reason: the audit found that Sidebar correctly shared the EPG singleton but still owned a second refresh function and timer. The singleton reduced duplicate requests in practice, yet two UI modules controlling refresh timing created an unnecessary second orchestration owner and future retry/timing drift risk.

Evidence:
- RED Validate WebTV Frontend #920 failed exactly on the ownership contract, reporting refresh owners `src/main.js` and `src/sidebar-now.js` instead of `src/main.js` alone.
- PR #125 runtime merge `8815ac39b25cc82755dba8a7a37b2b1c8e7783a5`; exact-head Frontend #921 and post-merge Frontend #922, Registry #126 and Pages #484 SUCCESS.
- Verification-only PR #126 remained unmerged and was closed after Verify EPG Refresh Ownership Live #1 SUCCESS against real production Pages: one startup EPG network request remained one after Sidebar-only presentation events; `lastRefreshAt` and the shared 229-programme store did not change; all 24 Sidebar rows retained Now Playing presentation with 18 current-EPG rows visible in that run; page/console errors were zero. Artifact ID `11231467495`.

Reconsider when: only if a future architecture intentionally moves EPG refresh scheduling away from `main.js`, while preserving exactly one scheduler, the Phase C identity/profile/fail-closed contract and production live verification.


## DEC-026 main.js owns selected-channel state; presentation consumes structured selection notifications
Decision: `main.js` is the single owner of selected-channel state. `WebTVPlaylistAPI.getSelectedChannel()` is the canonical selected-channel snapshot, and `webtv:channel-selected` is the structured notification signal for presentation consumers. Rendered channel DOM is presentation only and must not become a second selection state or identity bus.

Hard rules:
- `main.js` owns the internal selected channel and active-row synchronization;
- `WebTVPlaylistAPI.getSelectedChannel()` is the canonical read API for the selected channel;
- `main.js` emits `webtv:channel-selected` after user selection and after catalog replacement/reload reconciles or clears selection;
- event detail may carry a snapshot for observability, but consumers must treat the event as notification rather than an independent durable store;
- Favorites, Playlist Manager and Unified Search must not infer selected-channel changes from rendered `#channel-name`, MutationObserver state, or generic channel-list click timing;
- Sidebar Now Playing must not reconstruct channel identity from visible row text; row identity is `data-channel-id` resolved through `WebTVPlaylistAPI.getChannelById`;
- catalog replacement/reload that retains a selected channel id must rebind `selected` to the replacement canonical channel object before the structured selection notification is emitted;
- active-row behavior, Favorites scope, My Playlist persistence rules, Player behavior, EPG semantics and final visual layout remain unchanged.

Reason: the audit found that selected-channel truth was already singular in `main.js`, but presentation modules were using DOM mutations/click timing as a second notification/state channel, while Sidebar retained a rendered-text identity fallback. Closure review additionally found Unified Search still using rendered `#channel-name` and same-ID catalog replacement keeping the old selected object. Those paths could drift from canonical selection and repeat the same DOM-as-state-bus architecture previously removed from Diagnostics.

Evidence:
- RED Validate WebTV Frontend #926 failed exactly on the missing structured selection-owner contract.
- PR #128 runtime merge `8b6485fb8ad925319b974f0f565478bc507194d0`; exact-head Frontend #929, Playlist Manager Xtream Dialog Ownership #22 and Xtream Save Destination #72 SUCCESS; post-merge Frontend #930, Registry #128 and Pages #486 SUCCESS.
- Verification-only PR #129 remained unmerged and was closed after Verify Sidebar Selection Ownership Live #4 SUCCESS against real production Pages. The production Sidebar rendered 24/24 Now Playing rows with 18 current EPG rows in that run. The QA selection emitted structured `catalog-import` then `user-select`; canonical selected id matched active row id. Tampering rendered `#channel-name` did not alter canonical selection, active row, Favorite action or My Playlist action; Registry writes and page/console errors were all zero. Artifact ID `11236071116`.
- Closure review found two remaining defects before DEC closure: Unified Search still consumed rendered `#channel-name`, and same-ID temporary catalog replacement could publish the old selected object. RED Frontend #936 proved the expanded regression. PR #131 merged the bounded follow-up at `06e4d0cc0696b19c916f0f65007a3cf2572a0356`; exact-head Frontend #938 and Unified Search #63 succeeded, followed by post-merge Frontend #939, Registry #129 and Pages #487 SUCCESS.
- Verification-only PR #132 remained unmerged and was closed after Verify Sidebar Selection Ownership Final Live #1 SUCCESS. Unified Search Now Playing/query followed canonical selection and ignored rendered `#channel-name` tampering; same-ID replacement rebound the canonical selected name/source while active row, Unified Search and Sidebar Now Playing stayed synchronized; Registry writes and page/console errors were zero. Artifact ID `11237980248`, digest `sha256:d4402f9e96cbc9886ed990e17f8a555a60db32ca73f21f6c4ad1d949a2541548`.

Reconsider when: only if a future state architecture deliberately replaces `main.js` / `WebTVPlaylistAPI` as the single selection owner, with one explicit replacement state model, regression proof and production live verification.


## DEC-027 main.js owns channel-row presentation; Favorites supplies state, Sidebar supplies EPG decoration
Decision: `main.js` is the single owner of channel-row root presentation: rendered order, root visibility, list summary and Favorite row decoration. `favorites-ui.js` owns Favorite/filter state and exposes that state through a narrow read API plus notification; `sidebar-now.js` may decorate existing row subtrees with Now Playing / EPG presentation but must not become a second root-row order or visibility owner.

Hard rules:
- `main.js` derives the final visible channel sequence before rendering, including search/group filtering, My Playlist-only Favorites filtering and stable favorite-first ordering;
- `main.js` computes the channel summary from that final rendered sequence, so the summary cannot drift from visible rows;
- `main.js` applies Favorite class/title during row creation and remains the sole owner of channel-list child order;
- `favorites-ui.js` owns Favorite IDs and Favorites-only filter state, exposed read-only through `WebTVFavoritesPresentationAPI.getState()`;
- Favorites state changes notify with `webtv:favorites-presentation-changed`; Favorites must not hide row roots, physically append/reorder channel-list children, or observe channel-list child mutations to post-process rows;
- Favorites remain My Playlist / cloud-catalog only; temporary/imported and other non-cloud catalogs must render normally even if Favorites-only state is persisted;
- `sidebar-now.js` may add/update `.channel-now-inline` and related EPG subtree presentation inside existing rows, but must not reorder, append, replace or hide channel-root rows;
- startup retains exactly one Favorites cloud read;
- selected-channel ownership, Player behavior, EPG semantics and final visual layout are unchanged.

Reason: the audit found that `main.js` created channel rows and the summary while Favorites then became a second physical row owner by hiding rows, changing Favorite decoration, sorting/re-appending the same DOM children and observing list mutations. That architecture allowed summary/order/visibility drift and made Sidebar decoration depend on post-render mutation timing.

Evidence:
- RED Validate WebTV Frontend #943 failed exactly on the row-presentation ownership contract.
- PR #133 runtime merge `f9f861641856bacdcc16b8be0b255dcfa318b692`; exact-head Frontend #946 SUCCESS; post-merge Frontend #947, Registry #131 and Pages #489 SUCCESS.
- Verification-only PR #134 remained unmerged and was closed after Verify Sidebar Row Presentation Live #9 SUCCESS against real production Pages. Initial My Playlist order was `qaone, qathree, qatwo` with `3 / 3 κανάλια`; Favorites-only was `qaone, qathree` with `2 / 3 κανάλια`; selected/active `qathree` survived rerender; a temporary catalog showed `2 / 2 κανάλια` with Favorites hidden/inert; Sidebar Now Playing decorated every rendered row; exactly one Favorites cloud read occurred; durable user-data writes were zero; page/console errors were zero. Artifact ID `11240030912`, digest `sha256:d313f41effbb8d599e73905dddb534f291421d8b22268931b97cec39bcfead0c`.
- Early live-proof failures were harness-only: a Playwright init script initially executed in child frames and cleared same-origin test Favorites storage, and a later assertion incorrectly counted mocked `/api/health` telemetry as durable persistence. Neither required a production change.

Reconsider when: only if a future rendering architecture intentionally replaces `main.js` as the single channel-row root owner, or the product deliberately expands Favorites beyond My Playlist, with a new bounded decision, regression proof and production live verification.

## DEC-028 Legacy Source Hunt frontend chain retired after zero-consumer proof
Decision: delete the detached legacy Source Hunt frontend chain after Unified Search consolidation. Unified Search remains the sole automatic discovery surface; Manual Source Test remains an explicit user-triggered candidate URL test surface. Shared parser/normalization cores and server-side discovery Workers remain active.

Deleted/retired frontend ownership:
- `src/source-hunt-engine.js`;
- `src/source-hunt-web.js`;
- `src/source-hunt-save-destination.js`;
- `src/source-hunt-discovery-integration.js`;
- `src/source-hunt-enigma2.js`;
- `src/source-hunt-playlist-provenance.js`.

Hard rules:
- the six retired frontend files remain deleted and must not return as dormant “reference/rollback” owners;
- rendered `#channel-name` must not return as a Source Hunt query/state fallback through a revived legacy module;
- Unified Search owns automatic discovery orchestration;
- Manual Source Test performs explicit candidate testing only and must not become a second automatic discovery surface;
- shared M3U, STRM and Enigma2 cores remain the canonical structural parsing/normalization owners;
- Source Hunt Worker, Source Discovery Worker and the Enigma2 bouquet proxy retain their active server-side/transport roles;
- My Playlist persistence remains behind Playlist Manager-owned APIs and loaded-Xtream persistence guards;
- any revival of the retired frontend chain requires a new bounded architecture decision, real consumer proof, regression coverage, deployment and production live verification.

Reason: recursive ownership work found old Source Hunt modules still containing historical DOM/state and discovery logic after the production UI had already consolidated automatic discovery into Unified Search. A zero-consumer audit then proved the chain was detached from the production entrypoint and only old tests/reference scaffolding required its presence. Keeping the files created a future regression path without an active product role.

Evidence:
- audit-only PR #138, exact audit head `10738e5a3b938c7cb9bed43ec8e7bb7938f9597b`, proved the zero-consumer chain;
- RED Validate WebTV Frontend #967 failed because the six files still existed;
- PR #139 exact implementation head `eef479b35979a77de98519934e195b758ac1c9d1` completed Frontend #976 SUCCESS (75/75) and Enigma2 #60 SUCCESS;
- runtime merge `b46f11bce380d03b565f65c22e96729dae60beb6`; post-merge Frontend, Enigma2, Source Hunt Worker, Source Discovery Worker, Registry and Pages workflows all succeeded, and `/api/project-status` reported the same runtime SHA;
- verification-only PR #140 stayed unmerged and closed after Verify Source Hunt Frontend Retirement Live #1 SUCCESS and Frontend #978 SUCCESS. All six retired URLs were production 404s, retained active surfaces/cores were present, no retired script loaded, durable writes were zero and page/console errors were zero. Artifact ID `11241690885`, digest `sha256:2bba1b06fbd9a8da599d3d6944fc74e948d36a22f9b889ededc92ff2f6c64724`.

Reconsider when: only if a concrete future product requirement cannot be satisfied by Unified Search, Manual Source Test, active shared cores and Workers, and a new bounded owner is explicitly justified and production-verified.

## DEC-029 Zero-consumer saveDiscoveredChannel API retired
Decision: retire the narrow `WebTVMyPlaylistAPI.saveDiscoveredChannel` surface and its `saveDiscoveredMyChannel` implementation after the legacy Source Hunt frontend chain was deleted and recursive proof showed no remaining active frontend consumer.

Hard rules:
- `saveDiscoveredChannel` and `saveDiscoveredMyChannel` remain absent unless a future concrete product flow justifies a new bounded persistence API;
- Playlist Manager remains the My Playlist persistence boundary;
- verified Xtream channel persistence continues through `upsertChannel(...,{reason:'xtream-preview-save'})`;
- Playback Inspector source persistence continues through `addSourceToCurrent` and `replaceSourcesForCurrent`;
- generic My Playlist operations retain `assertGenericMyMutationAllowed` and the loaded-Xtream mutation guard;
- retiring this orphan surface must not weaken Favorites scope, Saved/Custom playlist semantics, Unified Search, Manual Source Test, Player, EPG or diagnostics/discovery behavior.

Reason: after DEC-028 retired the entire zero-consumer Source Hunt frontend chain, the special Source Hunt discovered-channel save API had no caller but still preserved a second historical persistence surface. Keeping an uncallable public API created unnecessary future regression risk.

Evidence:
- audit-only PR #142 exact audit head `e62a339ce583fb6ed8502cb922cf7fc8ef88748a`: 78 frontend JS files scanned, one self-export hit, active consumers = 0;
- RED Frontend #982 failed because the orphan surface still existed;
- PR #143 exact GREEN head `8c7203c339aa9d4bdddea192cdda393535527daf`: Frontend #984 76/76 SUCCESS, Xtream Save Destination #74 SUCCESS, Playlist Manager ownership #24 SUCCESS;
- runtime merge `0c6360f6d3cfdab0ca629a59c1500deee88f13fa`; post-merge Frontend #985, Registry #135 and Pages #493 SUCCESS, with Registry reporting the same deployed SHA;
- verification-only PR #144 closed unmerged after live proof #1 SUCCESS and Frontend #986 SUCCESS. Retired API absent live, active persistence APIs/guards retained, durable writes/page errors/console errors all zero. Artifact `11242903026`, digest `sha256:688bc68bce73841b122a1ec778d2a9af2f4e3318de7838ef71ef0486f12448b7`.

Reconsider when: only if a new active product flow requires discovered-channel persistence that cannot use the existing canonical My Playlist APIs, with explicit caller ownership, regression coverage, deployment and live verification.

