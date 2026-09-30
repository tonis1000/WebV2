# WebV2 Decision Log

## DEC-001 D1-primary My Playlist
Decision: D1 is the primary persistent My Playlist truth.
Reason: avoid fragmented cloud/local ownership.
Reconsider when: only if a replacement persistence model is explicitly designed and migrated.

## DEC-002 D1-authoritative Favorites after cloud read
Decision: after successful cloud read, D1 wins; localStorage is offline fallback.

## DEC-003 Browser Resolver retired
Decision: retire Browser Resolver/browser-resolved-official path; retain `official-api-resolver` and official-provider lane.

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
