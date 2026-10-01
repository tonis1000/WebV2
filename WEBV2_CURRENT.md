# WEBV2 CURRENT STATE

Updated: 2026-10-01
Repository: `tonis1000/WebV2`
Canonical source: GitHub `main/WEBV2_CURRENT.md`.

## CURRENT VERSION
Unified Search Hunt / Discovery consolidation runtime merge SHA: `d6c7e67ca2a3e7203dd00fbf4d83df31b9b779c8` via PR #78.
Unified Search sidebar-selection sync follow-up merge SHA: `90c6d80b7295cc0f17a1f8e976e7b6876e20a604` via PR #79.
Phase E3b Enigma2 normalization runtime merge SHA: `cc7e2128e9257cc431a95abf08f2f286e93d2235` via PR #75.
Phase E3a STRM normalization runtime merge SHA: `35c3f7641221b3ad24b3533269e72218d729e241` via PR #73.
GitHub-canonical CURRENT ownership merge SHA: `c7cb5bda983e405d53190ce4ea8858155b1c4a88`.
Phase E2 runtime merge SHA: `06383089b6fd7b4a31c468c46c7dd2c21ddfdb14`.

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
Hunt / Discovery consolidation into Unified Search: DONE.
Unified Search sidebar-selection sync follow-up: DONE.

Current ownership:
- GitHub `main/WEBV2_CURRENT.md` = canonical project current-state truth.
- `/api/project-status` = Registry deployment truth.
- Registry/D1 `WEBV2_CURRENT.md` checkpoint = mirror/history/fallback, not canonical authority.
- Component-specific workflow/live evidence = deployment truth for that component.

## CURRENT VERIFIED OUTCOME
Unified Search Hunt / Discovery consolidation: DONE.

The production search surface now has:
- one user-facing Unified Search instead of parallel automatic Hunt and Discovery result universes;
- independent Search and Now Playing state, so search does not own playback state;
- explicit Play as the only Search action that changes the Player;
- channel, group/subgroup and free-text intent handling through shared search context;
- progressive, cancellable, bounded lane orchestration with stale-run protection;
- normalized candidate aggregation grouped by channel;
- Source Registry / shared adapter architecture using the existing Source Format Registry and shared M3U / STRM / Enigma2 cores;
- preserved unique Hunt exploration intelligence through the normalized lead/candidate path instead of a second UI universe;
- provenance and safe `Open source` handling, including protected Xtream credential behavior;
- Official discovery excluded from the new Unified Search UX while legacy Official code remains outside this migration boundary;
- Manual Source Test retained as the explicit manual testing surface;
- sidebar channel selection now synchronizes the Unified Search query while the field remains freely editable for another channel, group or free-text query.

The live acceptance scenario is verified by the user in production after Pages deployment: selecting channels updates the Search field, manual Search text can still be entered, and Search remains isolated from current playback until explicit Play.

## REGISTRY / D1 MIRROR STATUS
Registry/D1 `WEBV2_CURRENT.md` remains mirror/history/fallback, not canonical authority.
During this 2026-10-01 closure, the available web tool could not read `/api/project-status` or `/api/project-checkpoints`, so no fresh direct checkpoint SHA or direct Registry status body is claimed.
The exact GitHub head `90c6d80b7295cc0f17a1f8e976e7b6876e20a604` did complete Deploy WebTV Registry Worker #97 successfully, but direct endpoint readback was not independently available through the current tool.
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

## NEXT SAFE ACTION
No new large runtime change is implied by this closure.

Before the next major change, define the exact production problem first and the concrete evidence that will prove it solved. Prefer bounded follow-ups driven by observed live behavior over speculative search/player refactors. Preserve the Unified Search ownership boundary and do not change Player, Verifier or save semantics unless a separate problem statement and proof require it.

## DO NOT BREAK
- D1-primary My Playlist
- D1-authoritative Favorites after successful cloud read
- Saved Playlist D1 truth + IndexedDB reconciliation
- Non-blocking startup
- Phase C EPG identity/profile ownership and fail-closed ambiguity behavior
- Phase D import/promotion boundary
- Phase E1 Source Format Registry transport-vs-media distinction
- Phase E2 shared M3U structural ownership and caller-owned policy
- Phase E3a shared STRM structural ownership and caller-owned network/security/product policy
- Phase E3b shared Enigma2 structural ownership with caller-owned matching/header/security/UI policy
- Unified Search as the single automatic discovery surface
- Search / Now Playing independence and explicit-Play-only ownership of Player changes
- Unified Search progressive cancellation, stale-run protection, provenance and credential-redaction behavior
- bouquet proxy transport/security ownership
- Source Verifier security/status semantics
- Existing Player/Xtream behavior unless a bounded change proves necessity
- Project-agent least-privilege route separation
- Existing Registry checkpoint/history infrastructure
- Existing PIN implementation while temporary `PIN_AUTH_DISABLED=1` maintenance mode is active

## OPERATIONAL NOTES
- Branch copies of `WEBV2_CURRENT.md` are proposed state; only the copy merged to `main` is canonical.
- GitHub CURRENT documents verified reality but does not make GitHub `main` automatically equal production.
- Always compare CURRENT claims with `/api/project-status`, relevant CI/deploy workflows, and component-specific live evidence.
- Registry/D1 CURRENT is mirror/history/fallback; its CAS-protected write/editor path remains available for mirror synchronization and historical maintenance.
- `/api/project-status` remains Registry deployment truth, not universal Worker deployment truth.
- Every solved problem that yields reusable knowledge must update the correct Brain owner before task closure.
- DONE means implemented + deployed + actually verified.
