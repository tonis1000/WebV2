# WEBV2 CURRENT STATE

Updated: 2026-09-30
Repository: `tonis1000/WebV2`
Canonical source: GitHub `main/WEBV2_CURRENT.md`.

## CURRENT VERSION
Phase E3a STRM normalization runtime merge SHA: `35c3f7641221b3ad24b3533269e72218d729e241` via PR #73.
GitHub-canonical CURRENT ownership merge SHA: `c7cb5bda983e405d53190ce4ea8858155b1c4a88`.
Phase E2 runtime merge SHA: `06383089b6fd7b4a31c468c46c7dd2c21ddfdb14`.

Verified Phase E3a production evidence at exact runtime merge SHA `35c3f7641221b3ad24b3533269e72218d729e241`:
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
Phase E3a STRM normalization: DONE.

Current ownership:
- GitHub `main/WEBV2_CURRENT.md` = canonical project current-state truth.
- `/api/project-status` = Registry deployment truth.
- Registry/D1 `WEBV2_CURRENT.md` checkpoint = mirror/history/fallback, not canonical authority.
- Component-specific workflow/live evidence = deployment truth for that component.

## CURRENT VERIFIED OUTCOME
Phase E3a shared STRM structural normalization: DONE.
CLEAN-004 STRM portion: RESOLVED. Enigma2 portion remains PENDING for Phase E3b.

Phase E3a established:
- canonical pure structural core `src/core/strm-core.js`;
- shared STRM reference normalization, GitHub blob-to-raw normalization, `.strm` recognition, KODIPROP/DRM metadata parsing, Kodi header suffix parsing and ordered line structure;
- browser `StrmResolver` migrated while preserving fetch, cache, failure TTL, in-flight dedupe, recursion and public API;
- Source Discovery STRM provider migrated while preserving private/local target blocking, timeouts, body/subrequest/depth limits, reports and candidate policy;
- Source Discovery smart curated STRM pre-resolver migrated while preserving curated-only scope, private-host policy, resolve limits and DRM auto-promotion rejection;
- Source Hunt migrated while preserving Hunt-local fetch budget, ranking/relevance and final HLS/DASH acceptance;
- route tooltip reuses canonical STRM detection;
- permanent repo-wide duplicate-parser audit found no remaining known independent active STRM structural parser in the audited `src`/`workers` scope;
- shared core remains network-free; caller-owned network/security/product policy remains local.

Important E3a implementation lessons are recorded in `WEBV2_LESSONS.md`, `WEBV2_TOOLING.md` and `WEBV2_PLAYBOOKS.md`, including Actions-backed TDD when local clone/DNS is unavailable, stale historical test constraints, hidden consumers found by repo-wide audit, atomic import-map cache invalidation, temporary CI harness removal, connector safety false positives and SHA/CAS-safe GitHub file writes.

## REGISTRY / D1 MIRROR STATUS
Registry/D1 `WEBV2_CURRENT.md` remains mirror/history/fallback, not canonical authority.
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

## NEXT SAFE ACTION
Next runtime phase: Phase E3b Enigma2 normalization.

Before implementation, run the normal `WEBV2_MANUAL.md` preflight, then audit all active Enigma2 bouquet/service parsing paths. Preserve transport/security proxy ownership separately from neutral bouquet/service structure. State exact problem, non-goals and proof before code changes.

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
- Source Verifier security/status semantics
- Existing Player/Discovery/Source Hunt/Xtream behavior unless a bounded change proves necessity
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
