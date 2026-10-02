# WEBV2 CURRENT STATE

Updated: 2026-10-02
Repository: `tonis1000/WebV2`
Canonical source: GitHub `main/WEBV2_CURRENT.md`.

## CURRENT VERSION
Playlist / Library / Xtream consolidation runtime SHA: `44dc1b777b222b232f3a9aa4c4e4a4a9dcda6b4f` via PR #102.
Xtream My Playlist persistence-boundary follow-up SHA: `f01a422065ff18c0b29841440ba529bdf6df9151` via PR #103.
Xtream preview action hit-layout follow-up SHA: `3fb730f01efa370a1ed7d166978b178868a8dc06` via PR #106.
Playback Inspector My Playlist persistence-boundary runtime SHA: `7fd58ee145884d09e19d4ef1321c18f0fdabc028` via PR #108.
Source Health route-ownership runtime SHA: `367421d007c79cd6e7d54e61278c56dc62a910d6` via PR #111.
Diagnostics structured-state ownership runtime SHA: `040e6be426a7367f8e0ccc6446f5908f82d8ff15` via PR #114.
Legacy Local Discovery retirement runtime SHA: `8ef91a32d898930dfd38d82220ebc370b0444ed2` via PR #116.
My Playlist action-ownership runtime SHA: `3adc057cd2f0186a1fab506c7c8e4d36ceea9973` via PR #119.
Player ownership retirement runtime SHA: `258bc39cc4a4f26c94c7d4933772ca9a3e3ff1c7` via PR #122.
EPG refresh-ownership runtime SHA: `8815ac39b25cc82755dba8a7a37b2b1c8e7783a5` via PR #125.
Sidebar selected-channel ownership runtime SHA: `8b6485fb8ad925319b974f0f565478bc507194d0` via PR #128; closure follow-up runtime SHA: `06e4d0cc0696b19c916f0f65007a3cf2572a0356` via PR #131.
Sidebar row-presentation ownership runtime SHA: `f9f861641856bacdcc16b8be0b255dcfa318b692` via PR #133.
Legacy Source Hunt frontend-chain retirement runtime SHA: `b46f11bce380d03b565f65c22e96729dae60beb6` via PR #139.
Orphan `saveDiscoveredChannel` API retirement runtime SHA: `0c6360f6d3cfdab0ca629a59c1500deee88f13fa` via PR #143.
Final dormant frontend-surface retirement runtime SHA: `3fd863325511a332268dc6238a08a236341f3cf0` via PR #147.
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

Verified Playback Inspector persistence-boundary evidence:
- Diagnostics audit found that `src/saved-sources-ui.js` owned a second direct `PUT /api/my-playlist/channel` path for Playback Inspector Add/Edit/Delete source actions. That bypassed the canonical `WebTVMyPlaylistAPI` owner and could bypass the loaded-Xtream generic-mutation guard added by PR #103.
- PR #108 merged at `7fd58ee145884d09e19d4ef1321c18f0fdabc028`. Playback Inspector no longer owns a direct Registry writer: Add delegates to `WebTVMyPlaylistAPI.addSourceToCurrent`, while Edit/Delete delegate to `WebTVMyPlaylistAPI.replaceSourcesForCurrent`. The canonical API retains `assertGenericMyMutationAllowed`; explicit `allowEmpty` exists only to preserve normal last-source deletion behavior, with Xtream source cleanup still owned by Playlist Manager.
- RED-first evidence: Validate WebTV Frontend #854 failed exactly on the new `playback-inspector-persistence-boundary` regression. Exact branch head `9a3597632186691653ff4ccf7a35c255151af87d` then completed Validate WebTV Frontend #855 SUCCESS.
- Exact-SHA post-merge proof at `7fd58ee145884d09e19d4ef1321c18f0fdabc028`: Validate WebTV Frontend #856 SUCCESS, Deploy WebTV Registry Worker #115 SUCCESS and GitHub Pages #473 SUCCESS.
- Verification-only PR #109 was closed unmerged after Verify Playback Inspector Boundary Live #8 SUCCESS against real production GitHub Pages plus the deployed authorized `test_50` Xtream mock. The final proof showed: Test edited URL persisted nothing; normal Inspector Add/Edit/Delete all succeeded through the canonical My Playlist API with three expected writes; a loaded Xtream Inspector Add was blocked before persistence and write count remained 3→3; the top-level loaded-Xtream Add remained blocked; page errors = 0; console errors = 0. Artifact ID: `11220235679`.
- The Playback Inspector persistence-owner sub-slice remains closed. Source Health route reconstruction and diagnostics state propagation are now canonicalized; the bounded Diagnostics ownership audit is DONE.

Verified Source Health route-ownership evidence:
- Diagnostics audit found that `src/source-health-ui.js` reconstructed direct / worker / worker+headers / STRM route semantics independently from the active `SourceRegistry`, including its own route parsing/classification, worker URL construction and STRM resolver. That created a second route model which could drift from actual playback ownership.
- PR #111 merged at `367421d007c79cd6e7d54e61278c56dc62a910d6`. `SourceRegistry.getCuratedRouteDiagnostics(channel)` is now the canonical owner of curated Source Health route diagnostics. `WebTVDiagnosticsAPI.getSourceHealthRows` delegates to the active SourceRegistry instance, while Source Health only joins those canonical rows with health metrics and renders them.
- RED-first evidence: Validate WebTV Frontend #867 failed exactly on the new Source Health route-ownership regression. Exact branch head `c97b4868e0aba307b1b97c2f3a742a19bbfa28cb` then completed Validate WebTV Frontend #870 SUCCESS.
- The regression freezes route semantics: HTTPS HLS = direct + worker; header HLS = direct + worker+headers; HTTP HLS = worker only; DASH = direct; video = direct; generic non-media HTTPS is excluded from playback diagnostics.
- Exact-SHA post-merge proof at `367421d007c79cd6e7d54e61278c56dc62a910d6`: Validate WebTV Frontend #871 SUCCESS, Deploy WebTV Registry Worker #117 SUCCESS and GitHub Pages #475 SUCCESS.
- Verification-only PR #112 was closed unmerged after Verify Source Health Route Ownership Live #1 SUCCESS against real production GitHub Pages. The final proof showed the live canonical API and actual playback plan both produced direct + worker for the selected curated HLS source; Source Health rendered exactly DIRECT + WORKER for the same source; headers / HTTP / DASH / video / non-media route contracts passed; page errors = 0; console errors = 0. Artifact ID: `11222443409`.
- Source Health route ownership remains closed, and the subsequent structured-state follow-up removed the remaining diagnostic DOM / MutationObserver state-bus coupling.

Verified diagnostics structured-state ownership evidence:
- The diagnostics audit found that Manual Test verification and Playback Inspector used rendered `#diag-*` / playback DOM as an implicit second state bus, while Source Health refreshed from diagnostic DOM mutations.
- PR #114 merged at `040e6be426a7367f8e0ccc6446f5908f82d8ff15`. `main.js` now owns one structured runtime diagnostics snapshot, `WebTVDiagnosticsAPI.getSnapshot()` exposes a read-only copy, and `webtv:diagnostics-updated` is the single runtime update event consumed by Manual Test, Playback Inspector and Source Health. The `#diag-*` elements remain presentation only.
- RED-first evidence: Validate WebTV Frontend #875 failed exactly on the new structured-state ownership regression. An intermediate exact-head run then exposed two remaining Inspector Edit/Delete `diagSource.textContent` fallbacks; those were removed rather than weakening the contract. Exact branch head completed Validate WebTV Frontend #878 SUCCESS.
- Exact-SHA post-merge proof at `040e6be426a7367f8e0ccc6446f5908f82d8ff15`: Validate WebTV Frontend #879 SUCCESS, Deploy WebTV Registry Worker #119 SUCCESS and GitHub Pages #477 SUCCESS.
- Verification-only PR #115 was closed unmerged after Verify Diagnostics Structured State Live #9 SUCCESS against real production GitHub Pages with deterministic range-served WebM media. Initial playback reached `native-video / direct / live`; Manual Test reached `native-video / candidate-direct / live`; Save Source became available only after verified playback; Source Health showed the selected source; deliberate mutation of `#diag-source/#diag-route` did not propagate to Playback Inspector; durable My Playlist/Saved Playlist writes remained 0; page errors = 0; console errors = 0. Artifact ID: `11224181561`.
- Final ownership sweep found no diagnostic MutationObserver or `#diag-*` state reads in Manual Test / Playback Inspector / Source Health. The Diagnostics ownership audit is DONE for the approved bounded scope.

Verified legacy Local Discovery retirement evidence:
- Zero-consumer audit proved `src/discovery/local-data-reader.js` and `src/discovery/local-candidates.js` were no longer production entrypoint dependencies; their only remaining runtime wiring was the retired Local lane inside the legacy `discovery-ui.js` shell.
- PR #116 merged at `8ef91a32d898930dfd38d82220ebc370b0444ed2`. It deleted both legacy Local owner files and `tests/discovery-local-sources.test.mjs`, removed the Local imports/button/scan/lanes/`scanLocal` API from the legacy shell, and preserved Curated / GitHub / Recent Web / STRM / Authorized Xtream / verifier / promotion capabilities.
- RED-first evidence: Validate WebTV Frontend #889 failed because the legacy Local owners still existed. Intermediate CI found and closed two genuine retirement defects: a hidden `window.WebTVDiscovery.scanLocal` API and stale `localBusy` references. Discovery isolation/browser-smoke expectations were then updated to require the deleted ownership while proving retained capabilities.
- Exact branch head `a72146459b8ea28c059f115e8129a5675bf305be` completed Validate WebTV Frontend #896 SUCCESS, including the permanent retirement regression, canonical known-source regression, Discovery entrypoint ownership, Discovery isolation, retained-capability browser smoke, non-blocking startup and recursive frontend import audit.
- Exact-SHA post-merge proof at `8ef91a32d898930dfd38d82220ebc370b0444ed2`: Validate WebTV Frontend #897 SUCCESS, Deploy WebTV Registry Worker #120 SUCCESS and GitHub Pages #478 SUCCESS.
- Verification-only PR #117 was closed unmerged after Verify Legacy Local Discovery Retirement Live #3 SUCCESS. Both deleted production URLs returned HTTP 404; the live legacy shell had no Local import/control/API and retained Curated / GitHub / Recent Web / STRM / Authorized Xtream / verify / promotion; the production page loaded with canonical search visible; legacy Discovery Beta and Local controls were absent; page errors = 0; console errors = 0. Artifact ID: `11224489871`.
- Canonical local intelligence remains `cloud-read-sync.js` + `known-source-collector.js`; it stays background/read-only and does not become a Unified Search lane or start save-time network discovery.

Verified Favorites / My Playlist action-ownership evidence:
- The ownership audit found that `src/source-hunt-save-destination.js` still owned a direct `PUT /api/my-playlist/channel` writer even after Playlist Manager had become the canonical My Playlist persistence owner. The same audit also clarified product scope: Favorites belong only to the D1 My Playlist catalog, not temporary imports, Saved/Custom playlists, loaded Xtream catalogs or other list surfaces.
- PR #119 merged at `3adc057cd2f0186a1fab506c7c8e4d36ceea9973`. Playlist Manager now exposes narrow `WebTVMyPlaylistAPI.saveDiscoveredChannel(...,{reason:'source-hunt-save'})`; Source Hunt delegates My Playlist persistence to that owner and no longer contains a direct My Playlist channel writer.
- The canonical discovered-channel owner builds its target from the actual discovered source URLs before applying `assertGenericMyMutationAllowed(target)`, preserving the loaded-Xtream persistence boundary. Source Hunt provenance remains `origin:'source-hunt'`, priority 100, append position 999999 and replaceSources=true.
- `favorites-ui.js` now treats only `WebTVPlaylistAPI.getCatalogMode()==='cloud'` as Favorite-capable. Outside My Playlist the filter/action are hidden, Favorite mutation is a no-op, rows are not reordered/filtered/decorated by Favorite state, and existing cloud Favorite data is not migrated or deleted.
- RED-first evidence: Validate WebTV Frontend #903 failed exactly on the direct Source Hunt My Playlist writer. #904 exposed only an over-specific test regex and was corrected without weakening the no-direct-writer contract. Diff review then found a real loaded-Xtream guard gap in the first implementation; that gap was fixed before merge. Final exact branch head completed Validate WebTV Frontend #906 SUCCESS, plus Playlist Manager Xtream Dialog Ownership #21 and Xtream Save Destination #71 SUCCESS.
- Exact-SHA post-merge proof at `3adc057cd2f0186a1fab506c7c8e4d36ceea9973`: Validate WebTV Frontend #907 SUCCESS, Deploy WebTV Registry Worker #122 SUCCESS and GitHub Pages #480 SUCCESS.
- Verification-only PR #120 was closed unmerged after Verify My Playlist Action Ownership Live #4 SUCCESS against real production GitHub Pages with Registry writes mocked so user data was not modified. In cloud My Playlist, the stored Favorite decorated the normalized channel row and one explicit Favorite action produced exactly one `/api/favorites` PUT. In a temporary catalog, Favorites filter/action were hidden, rows remained visible and undecorated, and a programmatic hidden-action click produced no write. Canonical Source Hunt save produced exactly one My Playlist channel PUT with preserved provenance/position semantics; a loaded-Xtream discovered source was rejected before persistence with the verified Preview/Save Channel guidance. Page errors = 0; console errors = 0. Artifact ID: `11227811674`.
- Existing Favorite data remains untouched. Expanding Favorites beyond My Playlist is explicitly deferred to a future separate product decision.

Verified Player ownership retirement evidence:
- The Player ownership audit confirmed production already had one active `PlayerController` instance created in `main.js` and one narrow `window.WebTVPlaybackAPI` bridge used by Manual Test / Unified Search candidate playback. `PlayerController` remained the actual media-attempt and official-fallback owner.
- The audit found one dormant legacy orchestration owner: `src/source-hunt-oneclick.js`. It was already absent from the production entrypoint but still contained historical search / playback / official-fallback orchestration around `WebTVPlaybackAPI`.
- RED-first zero-consumer proof recursively scanned all `src/**/*.js` files, excluding the legacy file itself, and proved no active source consumers. It also proved `index.html` did not load the file. Validate WebTV Frontend #914 then failed only because the orphaned file still existed.
- PR #122 merged at `258bc39cc4a4f26c94c7d4933772ca9a3e3ff1c7`. The orphaned `src/source-hunt-oneclick.js` file was deleted; integration coverage now requires it to stay deleted. No active Player code, route/ranking policy, fallback semantics, diagnostics behavior, EPG or Sidebar code changed.
- Exact branch head `3973ed415ada90579332b4d09bbaaa6bd3ea27dd` completed Validate WebTV Frontend #915 SUCCESS, including the new Player ownership regression, playback/fallback tests, Discovery browser smoke, non-blocking startup and frontend integration audit.
- Exact-SHA post-merge proof at `258bc39cc4a4f26c94c7d4933772ca9a3e3ff1c7`: Validate WebTV Frontend #916 SUCCESS, Deploy WebTV Registry Worker #124 SUCCESS and GitHub Pages #482 SUCCESS.
- Verification-only PR #123 was closed unmerged after Verify Player Ownership Live #1 SUCCESS against real production GitHub Pages. The retired One-click file returned HTTP 404; live `main.js` contained exactly one PlayerController construction and one WebTVPlaybackAPI bridge; live PlayerController retained official fallback ownership; browser playback API exposed only `replaySelected / stop / testCandidate`; Manual Source Test and Unified Search remained present; the legacy One-click control remained absent; explicit stop kept structured diagnostics and visible playback status at `Idle` with video/iframe hidden; page errors = 0; console errors = 0. Artifact ID: `11230147095`.

Verified EPG refresh-ownership evidence:
- The EPG ownership audit confirmed Phase C core ownership remained intact: `src/core/epg.js` owns EPG feed URLs, XMLTV parsing, programme storage, shared Channel Identity/Profile resolution and fail-closed ambiguity handling.
- The audit found one ownership drift in `src/sidebar-now.js`: despite using the shared EPG singleton, Sidebar also called `epg.refresh()` and scheduled its own `CONFIG.epgRefreshMs` timer in addition to the canonical scheduling already owned by `main.js`.
- RED-first evidence: Validate WebTV Frontend #920 failed exactly on the new recursive ownership regression, reporting actual refresh owners `src/main.js` + `src/sidebar-now.js` versus the required sole owner `src/main.js`.
- PR #125 merged at `8815ac39b25cc82755dba8a7a37b2b1c8e7783a5`. Sidebar no longer owns refresh/fetch scheduling, no longer imports EPG refresh configuration, and consumes the shared EPG singleton read-only through `epg.get(channel)`, `webtv:epg-updated`, row updates and its presentation-only 30 s render tick. `core/epg.js` and `main.js` behavior were not changed.
- Exact branch head `78c2a333f0b806efaf7e39e57b92f8ea73b1a642` completed Validate WebTV Frontend #921 SUCCESS, including EPG refresh ownership, Phase C parity, EPG deploy contract, browser smoke, non-blocking startup and frontend integration audit.
- Exact-SHA post-merge proof at `8815ac39b25cc82755dba8a7a37b2b1c8e7783a5`: Validate WebTV Frontend #922 SUCCESS, Deploy WebTV Registry Worker #126 SUCCESS and GitHub Pages #484 SUCCESS.
- Verification-only PR #126 was closed unmerged after Verify EPG Refresh Ownership Live #1 SUCCESS against real production GitHub Pages and the live EPG proxy status endpoint. Production issued one startup EPG request and remained at one after Sidebar-only presentation events; `lastRefreshAt` and the 229-programme store were unchanged; all 24 channel rows retained Sidebar Now Playing presentation with 18 current-EPG rows visible in that run; page errors = 0; console errors = 0. Artifact ID: `11231467495`.

Verified Sidebar selected-channel ownership evidence:
- The Sidebar / Now Playing ownership audit confirmed canonical selected-channel state already lived in `main.js` and `WebTVPlaylistAPI.getSelectedChannel()`, but three presentation paths still treated rendered DOM as a secondary state/identity source.
- Playlist Manager listened to generic `#channel-list` clicks and observed rendered `#channel-name`; Favorites observed `#channel-name`; Sidebar Now Playing could fall back to reconstructing a synthetic channel identity from rendered row text when canonical id lookup failed.
- RED-first evidence: Validate WebTV Frontend #926 failed exactly on the new Sidebar selected-channel ownership regression because no structured canonical selection event existed while the DOM-derived paths remained.
- PR #128 merged at `8b6485fb8ad925319b974f0f565478bc507194d0`. `main.js` now owns `selectedChannelSnapshot()` and emits `webtv:channel-selected` for user selection and catalog-selection reconciliation. The event is notification only; consumers continue reading truth through `WebTVPlaylistAPI.getSelectedChannel()`.
- Favorites and Playlist Manager consume the structured event and no longer infer selected-channel state from rendered `#channel-name` or generic channel-list clicks. Sidebar Now Playing resolves row identity only through `data-channel-id` + `WebTVPlaylistAPI.getChannelById`; rendered channel text is no longer an identity fallback.
- Exact branch head `90cbd21c71b514be41ff9873b8266acc50d52d7a` completed Validate WebTV Frontend #929 SUCCESS. Playlist Manager Xtream Dialog Ownership #22 and Xtream Save Destination #72 also completed SUCCESS.
- Exact-SHA post-merge proof at `8b6485fb8ad925319b974f0f565478bc507194d0`: Validate WebTV Frontend #930 SUCCESS, Deploy WebTV Registry Worker #128 SUCCESS and GitHub Pages #486 SUCCESS.
- Verification-only PR #129 was closed unmerged after Verify Sidebar Selection Ownership Live #4 SUCCESS against real production Pages with deterministic in-memory QA media and zero persistence. Initial production Sidebar rendered 24 channel rows / 24 Now Playing rows / 18 current-EPG rows in that run. The temporary QA catalog emitted `catalog-import`; real row selection emitted `user-select`; canonical selected id equaled active row id (`webv2.sidebar.qa`). Deliberate mutation of rendered `#channel-name` changed neither canonical selection, active row, Favorite action nor My Playlist action. Registry writes = 0; page errors = 0; console errors = 0. Artifact ID: `11236071116`.
- Closure review then found two remaining ownership defects: Unified Search still observed/read rendered `#channel-name`, and temporary catalog replacement could keep `selected` bound to an old same-ID channel object. RED Validate WebTV Frontend #936 failed exactly on the expanded ownership regression. PR #131 fixed only those bounded defects: Unified Search now consumes `webtv:channel-selected` plus `WebTVPlaylistAPI.getSelectedChannel()`, and `main.js` rebinds same-ID selection to the replacement channel object before publishing catalog reconciliation.
- Exact follow-up head `5a3be5b13542bc5d04894bec01574569d84d74ea` completed Validate WebTV Frontend #938 SUCCESS and Validate Unified Search #63 SUCCESS. PR #131 merged at `06e4d0cc0696b19c916f0f65007a3cf2572a0356`; post-merge Validate WebTV Frontend #939, Deploy WebTV Registry Worker #129 and GitHub Pages #487 all completed SUCCESS.
- Verification-only PR #132 remained unmerged and was closed after Verify Sidebar Selection Ownership Final Live #1 SUCCESS against production runtime `06e4d0cc0696b19c916f0f65007a3cf2572a0356`. Unified Search Now Playing/query followed canonical selection; deliberate `#channel-name` tampering changed no selection consumer; same-ID catalog replacement rebound canonical selected name/source and kept active row, Unified Search and Sidebar Now Playing synchronized; Registry writes = 0; page errors = 0; console errors = 0. Artifact ID: `11237980248`, digest `sha256:d4402f9e96cbc9886ed990e17f8a555a60db32ca73f21f6c4ad1d949a2541548`.

Verified Sidebar row-presentation ownership evidence:
- The bounded audit found one concrete duplicate presentation owner: `main.js` rendered channel rows and summary, while `favorites-ui.js` subsequently hid, decorated, sorted and physically re-appended the same `.channel-item` nodes and observed list mutations. `sidebar-now.js` also writes row-subtree EPG presentation but did not own root ordering/visibility.
- RED-first evidence: Validate WebTV Frontend #943 failed exactly on the new Sidebar row-presentation ownership regression while all earlier steps were green.
- PR #133 merged at `f9f861641856bacdcc16b8be0b255dcfa318b692`. `main.js` now owns final channel-row order, root visibility, summary and Favorite class/title during rendering. `favorites-ui.js` exposes read-only presentation state through `WebTVFavoritesPresentationAPI.getState()` and notifies with `webtv:favorites-presentation-changed`; it no longer hides/reorders rows or observes channel-list child mutations. `sidebar-now.js` remains an EPG row-subtree decorator and does not own root row order/visibility.
- Exact branch head `33c781b24f0e1f56e270d3cbd7899d65feb9b473` completed Validate WebTV Frontend #946 SUCCESS. Post-merge Validate WebTV Frontend #947, Deploy WebTV Registry Worker #131 and GitHub Pages #489 all completed SUCCESS.
- Verification-only PR #134 remained unmerged and was closed after Verify Sidebar Row Presentation Live #9 SUCCESS against production runtime `f9f861641856bacdcc16b8be0b255dcfa318b692`; exact verification head Frontend #956 also succeeded. My Playlist rendered favorite-first rows with summary `3 / 3 κανάλια`; Favorites-only rendered exactly two Favorite rows with summary `2 / 3 κανάλια`; selected/active `qathree` survived the main-owned rerender; a temporary catalog ignored Favorites-only state and rendered `2 / 2 κανάλια`; every rendered row retained Sidebar Now Playing decoration. Favorites startup performed one cloud read, durable Registry user-data writes were zero, page errors = 0 and console errors = 0. The one mocked `PUT /api/health` was playback telemetry, not durable user data. Artifact ID: `11240030912`, digest `sha256:d313f41effbb8d599e73905dddb534f291421d8b22268931b97cec39bcfead0c`.

Verified legacy Source Hunt frontend-chain retirement evidence:
- Audit-only PR #138 proved the legacy chain was detached from production: `source-hunt-engine.js`, `source-hunt-web.js` and `source-hunt-save-destination.js` had zero production consumers; the integration / Enigma2 / playlist-provenance files were reachable only through that orphan chain.
- RED-first Validate WebTV Frontend #967 failed exactly because the six zero-consumer frontend files still existed.
- PR #139 merged at `b46f11bce380d03b565f65c22e96729dae60beb6`. The six retired files were deleted while Unified Search, Manual Source Test, shared M3U / STRM / Enigma2 cores, Source Hunt / Source Discovery Workers, bouquet proxy, Xtream, playback and persistence semantics were retained.
- Exact-head `eef479b35979a77de98519934e195b758ac1c9d1`: Validate WebTV Frontend #976 SUCCESS with all 75/75 steps, and Validate Enigma2 Ownership #60 SUCCESS.
- Exact-SHA post-merge proof at `b46f11bce380d03b565f65c22e96729dae60beb6`: Validate WebTV Frontend, Validate Enigma2 Ownership, Deploy Source Hunt Worker, Deploy Source Discovery Worker, Deploy WebTV Registry Worker and GitHub Pages all SUCCESS; Registry `/api/project-status` reported that exact deployed SHA.
- Verification-only PR #140 remained unmerged and was closed after Verify Source Hunt Frontend Retirement Live #1 SUCCESS; verification-head Frontend #978 also succeeded. All six retired production URLs returned HTTP 404, Unified Search and Manual Source Test remained present, no retired script loaded, shared Enigma2 / STRM cores remained live, durable Registry user-data writes were zero and page/console errors were zero. Artifact ID `11241690885`, digest `sha256:2bba1b06fbd9a8da599d3d6944fc74e948d36a22f9b889ededc92ff2f6c64724`.
- The recursive Sidebar / Now Playing audit preceding this slice scanned 84 frontend JavaScript files and proved zero overlap for the already-closed Sidebar owners; no production change was required for that audit.


Verified Local known-source ownership production evidence:
- PR #100 merged at `35306d1161899a8f58801363bd3b1947881db9b2`.
- `src/known-source-collector.js` is the canonical source aggregation owner for save-time already-known sources; it now includes source-backed Saved M3U snapshots in addition to My Playlist, Custom Playlists and the already-loaded catalog.
- Saved Playlist snapshot reading remains owned by `src/cloud-read-sync.js` through `WebTVSavedPlaylistsReadAPI`; no second cache/read owner was introduced.
- Saved M3U entries are parsed through the existing shared Channel Catalog/M3U path and matched with the canonical known-source identity rules, including preserved `originalId` / `tvgId` handling.
- The save-time path performs no Unified Search, Hunt or network discovery and does not create a Local Search lane.
- The later zero-consumer retirement PR #116 deleted the legacy `src/discovery/local-data-reader.js` and `src/discovery/local-candidates.js` owners after preserving the canonical known-source coverage established here.
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

Verified orphan saveDiscoveredChannel API retirement evidence:
- Audit-only PR #142 recursively scanned 78 frontend JavaScript files at deployed/base `aa0293cdaea6ab814560a6c0b7e4e246bad20698`. The sole `saveDiscoveredChannel` hit was its own export in `src/playlist-manager.js`; active consumers = 0.
- RED Validate WebTV Frontend #982 failed exactly on the new retirement regression because the orphan implementation/export still existed.
- PR #143 removed only `saveDiscoveredMyChannel(...)` and `WebTVMyPlaylistAPI.saveDiscoveredChannel`. An intermediate GREEN attempt exposed one stale historical My Playlist ownership test that required the orphan API; that test was aligned to require the retired API absent while preserving active persistence boundaries.
- Exact implementation head `8c7203c339aa9d4bdddea192cdda393535527daf`: Validate WebTV Frontend #984 SUCCESS (76/76), Xtream Save Destination #74 SUCCESS and Playlist Manager Xtream Dialog Ownership #24 SUCCESS.
- Runtime merge `0c6360f6d3cfdab0ca629a59c1500deee88f13fa`; post-merge Frontend #985, Registry #135 and Pages #493 SUCCESS; Registry `/api/project-status` reported that exact deployed SHA.
- Verification-only PR #144 remained unmerged and was closed after Verify saveDiscoveredChannel Retirement Live #1 SUCCESS and verification-head Frontend #986 SUCCESS. Live `playlist-manager.js` and browser API exposed no retired discovered-channel surface; active `upsertChannel`, `addSourceToCurrent`, `replaceSourcesForCurrent` and `addCurrent` remained; Xtream reason gate and generic loaded-Xtream mutation guard remained; Unified Search + Manual Source Test remained; durable user-data writes = 0; page errors = 0; console errors = 0. Artifact ID `11242903026`, digest `sha256:688bc68bce73841b122a1ec778d2a9af2f4e3318de7838ef71ef0486f12448b7`.


Verified final broad ownership sweep / dormant-retirement / acceptance evidence:
- Audit-only PR #146 built the final ownership inventory on canonical/deployed base `36b3e814a01ebbc8adeeb9e421788c1066893105`. It scanned 78 frontend JavaScript files, found duplicate `window.WebTV*` global owners = 0, and confirmed persistence writers stayed with the known canonical owners. Cross-runtime classification retained `src/core/enigma2-core.js` because `workers/webtv-source-discovery.js` and deploy/validation workflows actively consume it.
- The same audit proved five frontend files had no production runtime consumer: `src/cloud-auto-sync.js`, `src/d1-sync-addon.js`, `src/core/official-fallbacks.js`, `src/discovery/discovery-ui.js`, and `src/discovery/new-xtream-preview.js`. The active official-fallback implementation was verified in `src/core/player.js`; the active right rail contained one dead `Discovery Beta` compatibility lookup.
- RED-first PR #147 retired those five files and the dead right-rail compatibility hook. Historical tests that required retired owners only for reference were moved to the active owners: Unified Search retained Curated / GitHub / Recent Web / STRM / Authorized Xtream coverage; Player retained official fallback; active Xtream Preview and Enigma2 Worker ownership remained.
- Exact implementation head `e1d5d1a8b53f1f135855c6e9a32cbaf3fbac4d97`: Validate WebTV Frontend #1002 SUCCESS (76/76), Validate Unified Search #71 SUCCESS, and the retained legacy-Xtream ownership workflow SUCCESS. An intermediate browser-smoke failure was fixture-only because mocked `fetch` converted local retired-file 404 probes into HTTP 200; the fixture was corrected without a production change.
- Runtime merge `3fd863325511a332268dc6238a08a236341f3cf0`; post-merge Validate WebTV Frontend #1003 SUCCESS, Validate Unified Search #72 SUCCESS, Deploy Source Discovery Worker #66 SUCCESS including live retained-provider verification, Deploy WebTV Registry Worker #137 SUCCESS, and GitHub Pages #495 SUCCESS. Registry `/api/project-status` reported the exact runtime SHA.
- Verification-only PR #150 remained unmerged and was closed after Verify Final System Acceptance Live #2 SUCCESS at exact verification head `e985189d47fc8cea9d472b49a431434c9825214c`; verification-head Frontend #1007 completed 76/76 SUCCESS. Source-level production proof showed all five retired URLs return HTTP 404 and retained Player / Enigma2 / Playlist / Custom Playlist / Unified Search owners remain live.
- Final browser acceptance covered Player, Sidebar / Now Playing, EPG, Unified Search, Manual Source Test, Playlist Manager / My Playlist, Favorites, Saved / Custom Playlist surfaces, Xtream UI, Diagnostics / Playback Inspector and discovery boundaries. Retired `saveDiscoveredChannel` stayed absent, retired dormant scripts loaded = 0, durable Registry user-data writes = 0, page errors = 0 and console errors = 0.
- Initial final-acceptance run #1 failed only because the harness sampled Sidebar rows before the real `webtv:epg-updated` readiness signal. The harness was corrected to wait for the actual Sidebar/EPG contract; no production code change was required.
- Final acceptance Artifact ID `11244485111`, digest `sha256:254c2c7d2acc94183fe999d66c29a996ad9ce13f48c12dfa2043ea0e0f23cf94`.


## CURRENT TASK
WebV2 System Audit & UX Consolidation: DONE / VERIFIED for the approved ownership-consolidation scope.
Discovery / Unified Search cleanup: DONE for the approved bounded ownership scope.
Legacy Discovery Beta production entrypoint cleanup: DONE.
Official discovery/resolution retirement: DONE.
Hunt / Discovery consolidation into Unified Search: DONE.
Unified Search sidebar-selection sync follow-up: DONE.
New Xtream Preview ownership audit + production migration: DONE.
Custom Saved Playlists mixed-source foundation: DONE.
Promotion safety audit for the Xtream preview persistence path: DONE and preserved.
Local scan ownership audit + canonical known-source migration: DONE.
Playlist / Library / Xtream management consolidation: DONE for the approved bounded ownership scope.
Playback Inspector My Playlist persistence-boundary sub-slice: DONE.
Source Health route-ownership sub-slice: DONE.
Diagnostics ownership audit: DONE for the approved bounded scope.
Legacy Local Discovery zero-consumer retirement: DONE / deleted.
Favorites / My Playlist action ownership: DONE for the approved bounded scope.
Player ownership audit: DONE for the approved bounded scope.
EPG refresh-ownership audit: DONE for the approved bounded scope.
Sidebar selected-channel ownership audit: DONE for the approved bounded scope.
Sidebar row-presentation ownership audit: DONE for the approved bounded scope.
Recursive Sidebar / Now Playing zero-overlap sweep: DONE / CLEAN across 84 frontend JavaScript files.
Legacy Source Hunt frontend-chain zero-consumer retirement: DONE / DELETED for the approved bounded scope.
Orphan `WebTVMyPlaylistAPI.saveDiscoveredChannel` retirement: DONE / DELETED after recursive zero-consumer proof.
Final broad orphan / duplicate-owner sweep: DONE. Duplicate `window.WebTV*` global owners = 0; five dormant frontend surfaces retired; shared Enigma2 core retained as an active Worker dependency.
Final end-to-end production acceptance: DONE / SUCCESS against runtime `3fd863325511a332268dc6238a08a236341f3cf0`.

Current ownership:
- GitHub `main/WEBV2_CURRENT.md` = canonical project current-state truth.
- `/api/project-status` = Registry deployment truth.
- Registry/D1 `WEBV2_CURRENT.md` checkpoint = mirror/history/fallback, not canonical authority.
- Component-specific workflow/live evidence = deployment truth for that component.

## CURRENT VERIFIED OUTCOME
Playlist / Library / Xtream management consolidation is DONE for the approved bounded ownership scope.
Local scan ownership and canonical known-source migration remain DONE for their approved bounded scope.
Xtream Preview ownership and Custom Saved Playlists remain DONE for their approved bounded scope.
Playback Inspector permanent My Playlist mutations are now canonical-API owned; loaded Xtream account channels cannot persist through Inspector Add/Edit/Delete as a second generic path.
Source Health route semantics are now canonical SourceRegistry output; Source Health no longer parses/classifies routes, builds worker routes or owns a second STRM resolver.
Runtime diagnostics state now has one structured owner in `main.js` / `WebTVDiagnosticsAPI`; Manual Test, Playback Inspector and Source Health consume snapshot/event state rather than rendered diagnostic DOM.
Legacy Local Discovery owner files and Local shell bindings are deleted after zero-consumer proof; canonical local intelligence remains `cloud-read-sync` + `known-source-collector`.
Favorites are scoped only to the D1 My Playlist catalog. The legacy Source Hunt frontend chain and its zero-consumer discovered-channel persistence API are retired; future discovered-channel persistence requires a new bounded decision behind the canonical Playlist Manager persistence boundary and loaded-Xtream guard.
Production playback/fallback orchestration is owned by `main.js` + one `PlayerController`; consumers use the narrow `WebTVPlaybackAPI` bridge. The retired One-click orchestration owner is deleted after zero-consumer proof.
EPG feed/XMLTV/matching ownership remains in `src/core/epg.js`; `main.js` is the sole frontend EPG refresh scheduler, while Sidebar Now Playing is a read-only EPG presentation consumer.
Selected-channel state is owned by `main.js`; `WebTVPlaylistAPI.getSelectedChannel()` is the canonical snapshot and `webtv:channel-selected` is the structured notification consumed by presentation modules instead of rendered DOM state.
Channel-row presentation ownership is also singular: `main.js` owns channel-row order, root visibility, summary and Favorite decoration. `favorites-ui.js` owns Favorite/filter state only through `WebTVFavoritesPresentationAPI.getState()` plus `webtv:favorites-presentation-changed`; `sidebar-now.js` may decorate existing row subtrees with EPG presentation but must not reorder or hide channel-root rows.
The recursive Sidebar / Now Playing sweep is clean: `sidebar-now.js` is the sole `.channel-now-inline` writer, `main.js` is the sole channel-summary/root-row owner and sole EPG refresh scheduler, and remaining row consumers are read-only for their bounded roles.
The legacy Source Hunt frontend chain is deleted after zero-consumer proof. Unified Search remains the sole automatic discovery surface; Manual Source Test remains explicit candidate testing. Shared M3U / STRM / Enigma2 cores plus Source Hunt / Source Discovery Workers remain active.
The now-callerless `WebTVMyPlaylistAPI.saveDiscoveredChannel` surface and its `saveDiscoveredMyChannel` implementation are also retired after a 78-file recursive consumer audit proved zero active callers. Active My Playlist APIs, Playback Inspector source mutation APIs and the verified Xtream `upsertChannel(...,{reason:'xtream-preview-save'})` boundary remain intact.
The final broad ownership sweep found no duplicate `window.WebTV*` global owners and no new persistence-owner overlap. It retired five production-dormant frontend surfaces: `src/cloud-auto-sync.js`, `src/d1-sync-addon.js`, `src/core/official-fallbacks.js`, `src/discovery/discovery-ui.js`, and `src/discovery/new-xtream-preview.js`, plus the dead `Discovery Beta` right-rail compatibility lookup. Active official fallback ownership remains in `src/core/player.js`; shared `src/core/enigma2-core.js` remains active through the Source Discovery Worker.
Final production acceptance is green across Player, Sidebar / Now Playing, EPG, Unified Search, Manual Source Test, My Playlist / Favorites, Saved / Custom Playlist surfaces, Xtream, Diagnostics / Playback Inspector and discovery boundaries. Retired scripts/APIs remain absent and no durable user-data writes occurred during verification.

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
Fresh 2026-10-02 preflight readback succeeded for both `/api/project-status` and `/api/project-checkpoints`.
Before the PR #108 runtime change, GitHub main and Registry deployed SHA were both `002f7215d6a5d3666fbef79c2b0eb98772de912b`; the D1 `WEBV2_CURRENT.md` checkpoint was independently read and remains stale at the older Project Brain bootstrap state from 2026-09-30. The stale mirror therefore does not equal current GitHub/runtime state and must not be treated as production truth.
The exact latest verified runtime SHA `f9f861641856bacdcc16b8be0b255dcfa318b692` completed Deploy WebTV Registry Worker #131 successfully, GitHub Pages #489 successfully and Validate WebTV Frontend #947 successfully. The Registry workflow's live verification and deployment-status recording steps completed successfully at that exact SHA, and verification-only PR #134 independently required `/api/project-status` to report the same runtime SHA before browser acceptance.
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
- Playback Inspector My Playlist persistence boundary: DONE, runtime merge `7fd58ee145884d09e19d4ef1321c18f0fdabc028`
- Source Health route ownership: DONE, runtime merge `367421d007c79cd6e7d54e61278c56dc62a910d6`
- Diagnostics structured-state ownership: DONE, runtime merge `040e6be426a7367f8e0ccc6446f5908f82d8ff15`
- Legacy Local Discovery zero-consumer retirement: DONE / DELETED, runtime merge `8ef91a32d898930dfd38d82220ebc370b0444ed2`
- Favorites / My Playlist action ownership: DONE, runtime merge `3adc057cd2f0186a1fab506c7c8e4d36ceea9973`
- Player ownership audit / dormant One-click retirement: DONE / DELETED, runtime merge `258bc39cc4a4f26c94c7d4933772ca9a3e3ff1c7`
- EPG refresh ownership audit: DONE, runtime merge `8815ac39b25cc82755dba8a7a37b2b1c8e7783a5`
- Sidebar selected-channel ownership audit: DONE, initial runtime merge `8b6485fb8ad925319b974f0f565478bc507194d0`, closure follow-up runtime `06e4d0cc0696b19c916f0f65007a3cf2572a0356`
- Sidebar row-presentation ownership audit: DONE, runtime merge `f9f861641856bacdcc16b8be0b255dcfa318b692`
- Sidebar / Now Playing recursive zero-overlap sweep: DONE / CLEAN, audit-only PR #137, 84 `src/**/*.js` files, `zeroOverlap:true`
- Legacy Source Hunt frontend chain: DONE / DELETED after zero-consumer proof, runtime merge `b46f11bce380d03b565f65c22e96729dae60beb6`
- Orphan `saveDiscoveredChannel` API: DONE / DELETED after zero-consumer proof, runtime merge `0c6360f6d3cfdab0ca629a59c1500deee88f13fa`
- Final broad ownership sweep: DONE; duplicate global API owners = 0; active Enigma2 Worker dependency retained
- Final dormant frontend retirement: DONE / DELETED, runtime merge `3fd863325511a332268dc6238a08a236341f3cf0`
- Final end-to-end production acceptance: DONE / SUCCESS, verification-only PR #150, artifact `11244485111`

## NEXT SAFE ACTION
The WebV2 System Audit & UX Consolidation is closed for the approved ownership-consolidation scope.

For future work:
1. treat the current ownership map and DEC-001…DEC-030 as the baseline; do not reopen a closed owner without new concrete evidence;
2. before any new major feature or architectural change, define the exact problem and the production proof that will demonstrate it is solved;
3. use a new bounded slice for any future Player, Sidebar, EPG, Playlist/My Playlist, Favorites, Xtream, Unified Search / discovery, diagnostics or persistence change;
4. preserve the existing RED → implementation → exact-SHA deploy → live verification → canonical docs closure discipline.

The next task should be a new product requirement, verified bug, or explicitly chosen UX improvement rather than more cleanup for its own sake.

## DO NOT BREAK
- D1-primary My Playlist
- D1-authoritative Favorites after successful cloud read
- Favorites belong only to the D1 My Playlist catalog; do not expose/apply them to temporary, Saved/Custom, loaded Xtream or other catalogs without a separate future product decision
- The retired legacy Source Hunt frontend chain must remain deleted; Unified Search is the sole automatic discovery surface and Manual Source Test remains explicit candidate testing. The zero-consumer `saveDiscoveredChannel` API must also remain retired. Any future discovered-channel My Playlist path requires a new bounded decision and must stay behind the canonical Playlist Manager persistence boundary and loaded-Xtream guard.
- Final dormant frontend retirements must remain deleted unless a new bounded decision proves a real production consumer: `cloud-auto-sync.js`, `d1-sync-addon.js`, `core/official-fallbacks.js`, `discovery/discovery-ui.js`, `discovery/new-xtream-preview.js`.
- `src/core/player.js` remains the active official-fallback owner; do not reintroduce a parallel official-fallback helper.
- `src/core/enigma2-core.js` remains an active shared dependency of Source Discovery Worker and must not be mistaken for browser-orphan code.
- Saved Playlist D1 truth + IndexedDB reconciliation
- Custom Saved Playlist D1 truth with playlist-specific channel/source ownership
- Custom Playlist source snapshots must never own raw Xtream credentials or preview tokens
- Full Xtream Account playlists remain account-backed rather than giant copied D1 channel sets
- Full Xtream Account persistence remains Preview → Verify → Save Full Xtream Account only
- Xtream channel persistence remains the verified Save Channel… flow only; loaded-account channels must not regain a generic My Playlist persistence shortcut
- Playback Inspector must not own a direct My Playlist Registry writer; permanent source Add/Edit/Delete goes through `WebTVMyPlaylistAPI` and inherits the loaded-Xtream generic-mutation guard
- SourceRegistry owns curated playback route semantics for Source Health; Source Health must not reintroduce route parsing/classification, worker construction or a second STRM resolver
- Runtime diagnostics state is owned by `main.js` / `WebTVDiagnosticsAPI`; rendered `#diag-*` DOM must not become an inter-module state bus again
- Retired legacy Local Discovery files/control/API must not return; canonical local intelligence remains background/read-only through `cloud-read-sync` + `known-source-collector`
- Saved Xtream Library cards remain Playlist Manager-owned account references with Load live and no synthetic marker export
- Test / Preview persists nothing until explicit verified save
- All known sources means already-known sources only; no implicit Unified Search or discovery at save time
- bounded Xtream catalog rendering for large provider accounts
- reference-safe Xtream channel-source cleanup across My Playlist and Custom Playlist references
- Non-blocking startup
- Phase C EPG identity/profile ownership and fail-closed ambiguity behavior
- `src/core/epg.js` remains the sole frontend EPG feed/XMLTV/matching owner; EPG provider ids must not redefine WebV2 channel identity
- `main.js` remains the sole frontend EPG refresh scheduler; Sidebar Now Playing must not call `epg.refresh()` or schedule EPG fetches
- `main.js` owns selected-channel state; presentation consumers, including Unified Search, use `WebTVPlaylistAPI.getSelectedChannel()` plus `webtv:channel-selected`, never rendered `#channel-name` as a state bus
- Sidebar row identity must come from `data-channel-id` resolved through `WebTVPlaylistAPI.getChannelById`; rendered channel text must not become an identity fallback again
- catalog replacement/reload that retains a selected channel id must rebind selection to the replacement canonical channel object before publishing `webtv:channel-selected`
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
- Production playback/fallback orchestration remains owned by `main.js` + one `PlayerController`; Manual Test / Unified Search use the narrow `WebTVPlaybackAPI` bridge
- Retired `src/source-hunt-oneclick.js` and its legacy One-click control/orchestration must not return without a separate bounded architecture decision and proof
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
