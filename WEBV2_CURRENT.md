# WEBV2 CURRENT STATE

Updated: 2026-09-30
Repository: `tonis1000/WebV2`
Canonical source: GitHub `main/WEBV2_CURRENT.md` after this migration is merged.

## CURRENT VERSION
Pre-migration verified project/Brain closure SHA: `8e87d80a94c5143c9be5c0e240cebc4c26da37e2`
Registry deployed SHA at migration preflight: `8e87d80a94c5143c9be5c0e240cebc4c26da37e2`
Phase E2 runtime merge SHA: `06383089b6fd7b4a31c468c46c7dd2c21ddfdb14`

Verified Phase E2 evidence:
- Validate WebTV Frontend #558 SUCCESS
- Deploy Source Discovery Worker #57 SUCCESS with live verification
- Deploy Source Hunt Worker #5 SUCCESS with live verification
- Deploy WebTV Registry Worker #88 SUCCESS
- GitHub Pages #447 SUCCESS
- Project Brain closure validation #560 SUCCESS at `8e87d80a94c5143c9be5c0e240cebc4c26da37e2`
- Registry deployment #89 SUCCESS at `8e87d80a94c5143c9be5c0e240cebc4c26da37e2`
- GitHub Pages #448 SUCCESS at `8e87d80a94c5143c9be5c0e240cebc4c26da37e2`

## CURRENT TASK
GitHub-canonical CURRENT ownership migration: IN PROGRESS on branch `project-brain/github-canonical-current`.

Target ownership after merge:
- GitHub `main/WEBV2_CURRENT.md` = canonical project current-state truth.
- `/api/project-status` = Registry deployment truth.
- Registry/D1 `WEBV2_CURRENT.md` checkpoint = mirror/history/fallback, not canonical authority.
- Component-specific workflow/live evidence = deployment truth for that component.

No runtime product behavior is changed by this migration.

## CURRENT VERIFIED OUTCOME
Phase E2 shared M3U/container parsing: DONE.
CLEAN-003 duplicate M3U structural parsers: RESOLVED for the approved active caller set.

Phase E2 established:
- canonical structural parser `src/core/m3u-container.js`;
- migrated adapters: Channel Catalog, Source Discovery, Source Hunt Worker, frontend Source Hunt;
- caller-owned matching, scheme acceptance, trust, ranking, STRM resolution, verification, promotion, and playback policy;
- historical Discovery/Hunt nine-line behavior preserved through neutral `sourceOffset`;
- Channel Catalog HTTP fallback preserved through ordered neutral `sourceCandidates`;
- mixed-case `#EXTINF` is a structural boundary to prevent cross-entry source stealing.

## REGISTRY / D1 MIRROR STATUS
The Registry/D1 `WEBV2_CURRENT.md` checkpoint is currently stale and retained as mirror/history/fallback.

Migration-preflight mirror metadata:
- SHA-256: `eb1c9237faae25be32265aa19049b7b7d4e5b626ac45f45d5ee35b5adf9905f1`
- updated: `2026-09-30 12:08:09`
- content still describes Project Brain bootstrap at `fdf91d3274087237578a090fbb55402bef96141d` and says Phase E2 is next.

This mismatch is preserved as evidence for this ownership migration. A stale mirror does not override GitHub CURRENT after the migration is merged.

## COMPLETED PHASES
- State/persistence foundation: DONE
- Channel Identity shared core: DONE
- Channel Profile A/B: DONE
- Phase C EPG ownership: DONE, merge `f5319497aa2f85d7e10fb4946382300da9de6acf`
- Phase D import/promotion contract: DONE, merge `d40a2f34027318d69dd78ef88d06fbfd60dc03fb`
- Phase E1 Source Format Registry: DONE, merge `d9dff4f7b251afe34605e9588b49dcb15d353951`
- Project Brain bootstrap: DONE, production main `fdf91d3274087237578a090fbb55402bef96141d`
- Phase E2 shared M3U/container parsing: DONE, runtime merge `06383089b6fd7b4a31c468c46c7dd2c21ddfdb14`, Brain closure `8e87d80a94c5143c9be5c0e240cebc4c26da37e2`

## NEXT SAFE ACTION
Finish and verify the GitHub-canonical CURRENT ownership migration. After it is merged and read back from `main`, the next runtime phase is Phase E3 STRM / Enigma2 normalization.

Do not begin Phase E3 implementation until the normal `WEBV2_MANUAL.md` preflight is run under the new ownership model, and the exact STRM/Enigma2 problem, non-goals, and proof of success are reviewed.

## DO NOT BREAK
- D1-primary My Playlist
- D1-authoritative Favorites after successful cloud read
- Saved Playlist D1 truth + IndexedDB reconciliation
- Non-blocking startup
- Phase C EPG identity/profile ownership and fail-closed ambiguity behavior
- Phase D import/promotion boundary
- Phase E1 Source Format Registry transport-vs-media distinction
- Phase E2 shared M3U structural ownership and caller-owned policy
- Source Verifier security/status semantics
- Existing Player/Discovery/Source Hunt/Xtream behavior unless a bounded change proves necessity
- Project-agent least-privilege route separation
- Existing Registry checkpoint/history infrastructure
- Existing PIN implementation while temporary `PIN_AUTH_DISABLED=1` maintenance mode is active

## OPERATIONAL NOTES
- GitHub `main/WEBV2_CURRENT.md` is canonical only after the ownership migration is merged; branch copies are proposed state.
- GitHub CURRENT documents verified reality but does not make GitHub `main` automatically equal production.
- Always compare CURRENT claims with `/api/project-status`, relevant CI/deploy workflows, and component-specific live evidence.
- Registry/D1 CURRENT is mirror/history/fallback; its CAS-protected write/editor path remains available for mirror synchronization and historical maintenance.
- `/api/project-status` remains Registry deployment truth, not universal Worker deployment truth.
- Every solved problem that yields reusable knowledge must update the correct Brain owner before task closure.
- DONE means implemented + deployed + actually verified.
