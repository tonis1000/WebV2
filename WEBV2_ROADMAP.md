# WebV2 End-to-End Cleanup Roadmap

Goal: finish with a clean, functional, understandable, extensible repo with clear ownership, minimal duplication, no contradictory instructions, and evidence-backed deletion of obsolete code/docs.

## Completed foundation
### State / persistence foundation — DONE
Problem: cloud/local state ownership and startup behavior were fragmented.
Proof achieved: D1-primary My Playlist; D1-authoritative Favorites after successful cloud read; Saved Playlist D1 truth + IndexedDB cache reconciliation; non-blocking startup.
Future follow-up: keep state/API cleanup bounded and evidence-driven.

### Channel Identity — DONE
Problem: channel matching/identity duplicated across discovery paths.
Outcome: shared strict Greek channel identity core with aliases, rejects/collision guards, official refs.

### Channel Profile A/B — DONE
Problem: identity, presentation metadata, and source state were mixed.
Outcome: profile metadata separated from playback/source state; canonical visible category/logo ownership moved to profile for promoted My Playlist channels.

### Phase C EPG ownership — DONE
Prerequisite parity commit: `45e60f2af6438f7a11fa618dba3b18a9582e6f5c`.
Merge: `f5319497aa2f85d7e10fb4946382300da9de6acf`.
Outcome: EPG identity/mapping ownership moved to shared identity/profile, preserving parity and fail-closed ambiguity behavior.

### Phase D import/promotion contract — DONE
Merge: `d40a2f34027318d69dd78ef88d06fbfd60dc03fb`.
Problem: temporary M3U/Saved/Xtream metadata could leak into canonical My Playlist metadata.
Outcome: centralized promotion policy keeps imports temporary until promotion while preserving stream URLs.

### Phase E1 Source Format Registry — DONE
Merge: `d9dff4f7b251afe34605e9588b49dcb15d353951`.
Problem: source format/type recognition duplicated across frontend Discovery and Source Verifier.
Outcome: canonical extensible Source Format Registry, transport-vs-media distinction, legacy compatibility mapping, worker deployment dependency, future-format test.
Non-goals preserved: no Player rewrite, no M3U parser migration, no STRM/Enigma2 migration.

### Project Brain — DONE
Problem: project knowledge was spread across conversations, historical docs, and stale current state.
Outcome: Manual/Current/Roadmap/Architecture/Playbooks/Tooling/Decisions/Lessons/Cleanup exist and are contract-tested. Canonical project current-state ownership is GitHub `main/WEBV2_CURRENT.md`; Registry/D1 CURRENT is retained as mirror/history/fallback while `/api/project-status` remains Registry deployment truth.
Initial production merge after route-scope correction: `fdf91d3274087237578a090fbb55402bef96141d`.

### Phase E2 shared M3U/container parsing — DONE
Merge: `06383089b6fd7b4a31c468c46c7dd2c21ddfdb14` via PR #69.
Problem: M3U structural parsing was duplicated across Channel Catalog, Source Discovery, Source Hunt Worker, and frontend Source Hunt.
Outcome: one pure policy-free `src/core/m3u-container.js` owns neutral M3U structure; callers retain matching, URL acceptance, trust, ranking, resolution, verification, promotion, and playback policy.
Parity/review proof: caller-by-caller RED→GREEN contracts, historical nine-line Discovery/Hunt windows preserved with neutral `sourceOffset`, Catalog HTTP fallback preserved with ordered neutral `sourceCandidates`, mixed-case EXTINF no-steal boundary made explicit, and repo-wide active-path audit found no remaining known duplicate structural parser in the approved E2 caller set.
Production proof at exact merge SHA: Validate WebTV Frontend #558 SUCCESS; Source Discovery #57 SUCCESS with live Worker verification; Source Hunt #5 SUCCESS with live Worker/bouquet verification; Registry #88 SUCCESS with live D1/project-status verification; GitHub Pages #447 SUCCESS.
Non-goals preserved: no STRM/Enigma2 migration; no playback/promotion/verifier behavior redesign.

### Phase E3a STRM normalization — DONE
Runtime merge: `35c3f7641221b3ad24b3533269e72218d729e241` via PR #73.
Problem: active browser/Discovery/Hunt paths duplicated STRM reference/document/Kodi-header/DRM parsing and GitHub reference normalization while intentionally differing in networking and security policy.
Outcome: pure `src/core/strm-core.js` owns shared structural facts; browser `StrmResolver`, Source Discovery STRM provider, Source Discovery smart curated pre-resolver and Source Hunt remain caller-policy adapters. Route tooltip reuses canonical STRM detection.
Parity/audit proof: caller-by-caller RED→GREEN, ordered-line parity preservation, Discovery private-host/security policies retained, permanent workflow dependency contract, repo-wide duplicate-parser audit and full frontend regression suite.
Audit finding: E3a discovered an additional active smart-wrapper STRM resolver not present in the initial known-caller inventory; it was migrated rather than whitelisted.
Production proof at exact runtime SHA: Frontend #619 SUCCESS; Source Discovery #58 SUCCESS with live all-provider verification and real ERT1 STRM resolution; Source Hunt #6 SUCCESS with live Worker verification; Registry #92 SUCCESS; Pages #451 SUCCESS.
Non-goals preserved: no Enigma2 migration, Player/Verifier redesign, DRM playback, Xtream work or Hunt/Discovery consolidation.

## Current runtime phase
### Phase E3b Enigma2 normalization — NEXT
Problem: Enigma2 bouquet/service parsing is duplicated across Discovery/frontend Hunt while transport/security proxy behavior is a separate responsibility.
Proof target: one neutral shared Enigma2 structural parser with caller-owned matching/header/security/UI policy; bouquet proxy remains transport/security-only; exact regressions and deployment/live verification required.

## Later runtime phases
### Hunt / Discovery consolidation — FUTURE
Clarify broad lead hunting versus normalized candidate production; reduce duplicated search/scanning only after shared primitive parity.

### Candidate / proof / save lifecycle cleanup — FUTURE
Target conceptual lifecycle: `FOUND -> FORMAT_CLASSIFIED -> RESOLVED -> VERIFIED_MEDIA -> PLAYBACK_CONFIRMED -> SAVED`.
Strengthen proof metadata without weakening current verifier/security rules.

### Playback/source ownership cleanup — FUTURE / EVIDENCE-DRIVEN
Only change Player/source routing where concrete duplication or failure proves need. Preserve current UI/fallback behavior unless bounded work proves otherwise.

### State/API/documentation cleanup — FUTURE
Reconcile project-agent/admin/checkpoint operational surfaces and remove superseded documentation after knowledge migration.

### Dead code + duplicate removal — FUTURE
Delete only through `WEBV2_CLEANUP.md` gates.

### Final architecture audit — FUTURE
Verify one owner per responsibility, no contradictory project instructions, no hidden duplicate canonical paths.

### final repo cleanup — FUTURE
Remove obsolete code/docs/tests/compatibility layers proven unused, rewrite final project instructions to match verified architecture, and perform full deployment/live verification.
