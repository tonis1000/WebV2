# WEBV2 CURRENT STATE

Updated: 2026-09-30
Repository: `tonis1000/WebV2`
Canonical source: GitHub `main/WEBV2_CURRENT.md`.

## CURRENT VERSION
Phase E3b Enigma2 normalization runtime merge SHA: `cc7e2128e9257cc431a95abf08f2f286e93d2235` via PR #75.
Phase E3a STRM normalization runtime merge SHA: `35c3f7641221b3ad24b3533269e72218d729e241` via PR #73.
GitHub-canonical CURRENT ownership merge SHA: `c7cb5bda983e405d53190ce4ea8858155b1c4a88`.
Phase E2 runtime merge SHA: `06383089b6fd7b4a31c468c46c7dd2c21ddfdb14`.

Verified Phase E3b production evidence at exact runtime merge SHA `cc7e2128e9257cc431a95abf08f2f286e93d2235`:
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
Phase E3b Enigma2 normalization: DONE.

Current ownership:
- GitHub `main/WEBV2_CURRENT.md` = canonical project current-state truth.
- `/api/project-status` = Registry deployment truth.
- Registry/D1 `WEBV2_CURRENT.md` checkpoint = mirror/history/fallback, not canonical authority.
- Component-specific workflow/live evidence = deployment truth for that component.

## CURRENT VERIFIED OUTCOME
Phase E3b shared Enigma2 structural normalization: DONE.
CLEAN-004 duplicate STRM / Enigma2 parsing primitives: RESOLVED.

Phase E3b established:
- canonical pure structural core `src/core/enigma2-core.js`;
- shared neutral Enigma2 bouquet/service structure including bouquet name, service type, raw/decoded reference facts, inline name, DESCRIPTION association, ordered line metadata, embedded stream-reference facts and compact/nonstandard service preservation needed for caller parity;
- Source Discovery migrated while preserving its service-type acceptance, one-pass decoding, raw DESCRIPTION matching, URL/public-target validation, channel matching and candidate policy;
- frontend Source Hunt migrated while preserving embedded-scheme discovery, two-pass decoding behavior, Kodi header parsing/allowlisting, private-target blocking, format classification, candidate construction and UI/orchestration policy;
- `workers/source-hunt-bouquet-proxy.js` remains transport/security-only and retains HTTPS/allowlist/timeout/max-body/raw-bouquet responsibilities;
- permanent repo-wide Enigma2 duplicate-parser audit found no remaining active independent structural parser in audited `src`/`workers` scope;
- permanent proxy-boundary and workflow-wiring contracts protect ownership and redeploy dependencies;
- browser top-level cache key updated atomically for the migrated frontend module;
- temporary RED/probe/patch workflows were removed or closed without merge after serving their verification purpose.

Important E3b implementation lessons are recorded in `WEBV2_LESSONS.md`, especially preserving raw/one-pass/full neutral decode facts when callers historically differ and validating nonstandard structural parity before migration closure.

## REGISTRY / D1 MIRROR STATUS
Registry/D1 `WEBV2_CURRENT.md` remains mirror/history/fallback, not canonical authority.
Fresh unauthenticated preflight could reach `/api/project-status` but did not expose usable PIN-protected checkpoint metadata; no mirror claim is inferred from that limitation.
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

## NEXT SAFE ACTION
Next runtime phase: Hunt / Discovery consolidation.

Before implementation, run the normal `WEBV2_MANUAL.md` preflight, then audit duplicated search/scanning/orchestration between broad Source Hunt lead generation and normalized Source Discovery candidate production. Define the exact problem, ownership boundary, non-goals and proof before code changes. Do not change Player/Verifier/save semantics merely to simplify Hunt/Discovery code.

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
- bouquet proxy transport/security ownership
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
