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
Bootstrap merges: PR #67 + scoped-route correction PR #68, current verified main `fdf91d3274087237578a090fbb55402bef96141d`.
Problem: project knowledge was spread across conversations, historical docs, and stale current state.
Outcome: Manual/Current pointer/Roadmap/Architecture/Playbooks/Tooling/Decisions/Lessons/Cleanup now have explicit ownership and CI contract coverage; canonical Current is reconciled; routine checkpoint reads use least-privilege project-agent routes.
Future follow-up: every solved problem must enrich the appropriate Brain owner before task closure.

## Next runtime phase
### Phase E2 shared M3U/container parsing — NOT STARTED
Problem: M3U/container parsing and extraction remain duplicated across active paths.
Scope: shared parsing primitives with RED parity first.
Non-goals: no STRM/Enigma2 migration in E2; no playback/promotion behavior change.
Proof: current accepted fixtures reproduced; callers migrated one concern at a time; frontend/startup/browser regressions green; relevant deploy/live verification successful.

### Phase E3 STRM / Enigma2 normalization — FUTURE
Problem: STRM and Enigma2 parsing/resolution primitives remain duplicated.
Proof: shared primitives reproduce accepted behavior before caller migration; bouquet transport remains separate where appropriate.

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
