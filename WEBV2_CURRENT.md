# WEBV2 CURRENT STATE

Updated: 2026-10-01
Repository: `tonis1000/WebV2`
Canonical source: GitHub `main/WEBV2_CURRENT.md`.

## CURRENT VERSION
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
Local scan ownership audit: NEXT.
Playlist / Library / Xtream management consolidation: ACTIVE, with the Xtream preview/custom-playlist slice completed.

Current ownership:
- GitHub `main/WEBV2_CURRENT.md` = canonical project current-state truth.
- `/api/project-status` = Registry deployment truth.
- Registry/D1 `WEBV2_CURRENT.md` checkpoint = mirror/history/fallback, not canonical authority.
- Component-specific workflow/live evidence = deployment truth for that component.

## CURRENT VERIFIED OUTCOME
Xtream Preview ownership and Custom Saved Playlists are DONE for the approved bounded scope.

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
During this 2026-10-01 closure preflight, the available web tool could not access `/api/project-status` or `/api/project-checkpoints`, so no fresh direct checkpoint SHA / deployed SHA equality is claimed.
The exact latest runtime main SHA `de62fca10c7e452c836d168f2c373b437c936a93` completed Deploy WebTV Registry Worker #107 successfully and GitHub Pages #465 successfully; Validate WebTV Frontend #800 completed SUCCESS on rerun attempt 2 at the same exact SHA.
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

## NEXT SAFE ACTION
Continue the System Audit one bounded owner at a time:
1. audit Local scan as background intelligence and confirm its canonical owner, dedupe inputs and no-user-facing-lane contract;
2. then continue Playlist / Library / Xtream management consolidation beyond the completed Xtream preview/custom-playlist slice;
3. afterward proceed to Manual Test / Diagnostics / Source Health / Playback Inspector overlap cleanup.

Do not redesign Player, Verifier, EPG or final visual layout as part of the Local scan audit unless a separate bounded problem statement and proof require it.

## DO NOT BREAK
- D1-primary My Playlist
- D1-authoritative Favorites after successful cloud read
- Saved Playlist D1 truth + IndexedDB reconciliation
- Custom Saved Playlist D1 truth with playlist-specific channel/source ownership
- Custom Playlist source snapshots must never own raw Xtream credentials or preview tokens
- Full Xtream Account playlists remain account-backed rather than giant copied D1 channel sets
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
- Local scan background intelligence for dedupe and known-source awareness until its ownership audit is complete
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
