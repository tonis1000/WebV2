# Phase E2 Shared M3U Container Design

Date: 2026-09-30
Status: DESIGN REVIEW
Base main SHA: `fdf91d3274087237578a090fbb55402bef96141d`
Branch: `phase-e2/m3u-container-design`

## 1. Purpose

Phase E2 removes duplicated M3U container parsing across WebV2 without changing caller-specific policy or runtime semantics.

The shared core must own only M3U structural parsing. It must not absorb channel identity, candidate matching, source verification, ranking, trust, save eligibility, playback decisions, or promotion behavior.

The design goal is one canonical structural parser with thin caller adapters so future M3U changes are made once and propagated safely.

## 2. Problem

At least four active paths currently parse M3U structure independently:

1. `src/core/channel-catalog.js`
   - extracts `tvg-id`, `tvg-name`, `tvg-logo`, `group-title`;
   - finds a following HTTP(S) URL;
   - creates temporary imported channel objects;
   - later Phase D promotion policy controls canonical metadata.

2. `workers/webtv-source-discovery.js`
   - parses `#EXTINF` entries;
   - performs exact channel matching using Channel Identity;
   - finds following public source URLs;
   - creates Discovery candidates.

3. `workers/source-huntatonisworkersdev.js`
   - parses `#EXTINF` entries;
   - performs Hunt-specific channel filtering/ranking;
   - extracts source URLs and optional STRM resolution;
   - creates Hunt leads/candidates.

4. `src/source-hunt-engine.js`
   - performs frontend M3U scanning for HLS URLs using its own line traversal and extraction rules.

Additional Source Discovery providers depend on the Discovery parser as an injected function, so parser behavior affects multiple provider lanes.

This duplication creates drift risk: fixes to comments, blank lines, attributes, source-line traversal, query strings, or directives may be implemented differently across callers.

## 3. Core Design Decision

Create one pure shared structural module:

`src/core/m3u-container.js`

It owns:
- normalizing CRLF/LF input;
- identifying M3U container/entry structure;
- parsing `#EXTINF` attributes;
- extracting entry title/duration/raw `#EXTINF` text;
- associating an entry with its next non-comment source line according to neutral structural rules;
- preserving intervening directives/comments needed by callers;
- returning neutral ordered entries.

It does not own:
- channel matching;
- Greek identity resolution;
- format detection;
- URL scheme acceptance;
- source trust;
- verification;
- candidate ranking;
- save eligibility;
- promotion;
- playback.

Rule: **shared parser parses; caller decides.**

## 4. Proposed API

The public API should remain small and pure:

```js
parseM3uContainer(text)
parseM3uAttributes(extinfLine)
isM3uContainer(text)
```

### `parseM3uContainer(text)`

Returns ordered neutral entries. Proposed shape:

```js
{
  index,
  extinf,
  duration,
  title,
  attributes,
  sourceLine,
  directivesBeforeSource
}
```

Where:
- `index` is the entry order/index in the parsed container;
- `extinf` is the raw trimmed `#EXTINF` line;
- `duration` is parsed conservatively when possible, otherwise `null`/raw-safe representation;
- `title` is the text after the metadata comma, preserving additional commas in the display title;
- `attributes` is a normalized key/value map for parsed EXTINF attributes;
- `sourceLine` is the next structurally associated non-comment line, or empty when none exists before the next `#EXTINF`;
- `directivesBeforeSource` preserves non-empty comment/directive lines between `#EXTINF` and source.

The parser does not validate whether `sourceLine` is HTTP, HLS, DASH, RTSP, RTMP, STRM, or playable.

### `parseM3uAttributes(extinfLine)`

Parses quoted attributes and legacy bare attribute forms where existing accepted behavior requires parity.

The parser must not interpret attribute meaning beyond key/value extraction.

### `isM3uContainer(text)`

Provides conservative structural detection for callers that need to distinguish M3U text from loose text.

It must not claim media verification.

## 5. Caller Ownership After Migration

### Channel Catalog adapter

Still owns:
- channel object shape;
- `normalizeId` behavior;
- imported metadata mapping;
- HTTP(S)-only direct URL acceptance if that is current behavior;
- dedupe/merge semantics;
- `sourceTrust: 'temporary'`.

It consumes neutral M3U entries and maps them to the current `parseM3U()` public behavior.

Phase D promotion remains untouched.

### Source Discovery adapter

Still owns:
- `candidateMatches()`;
- channel identity matching;
- `validPublicUrl()`;
- candidate creation;
- `sourceType`, `saveEligible`, verification detail;
- provider metadata and limits.

The shared parser only replaces duplicated EXTINF/source-line traversal.

### Source Hunt Worker adapter

Still owns:
- Hunt-specific `classifyEntry()`;
- ranking/relevance;
- `cleanUrl()` policy;
- HLS/DASH live filtering;
- STRM resolution;
- freshness/search policy.

No STRM normalization is moved into E2.

### Frontend Source Hunt adapter

Still owns:
- relevance scoring;
- `extractM3u8()` HLS-only candidate extraction;
- Hunt UI/result scoring;
- freshness and GitHub scan policy.

The shared parser may replace line traversal only. HLS extraction policy remains local until later Hunt/Discovery consolidation.

## 6. Compatibility and Parity Rules

E2 is a migration, not a behavior redesign.

Important parity rules:

1. Do not broaden accepted source schemes for a caller merely because the shared parser can expose them.
2. Do not narrow accepted source schemes where a caller currently accepts them.
3. Do not change channel matching strictness.
4. Do not change dedupe semantics.
5. Do not change imported metadata trust/promotion behavior.
6. Do not change Discovery candidate fields/status semantics.
7. Do not change Hunt ranking/freshness behavior.
8. Do not change Player behavior.
9. Do not reinterpret generic HTTP as verified media.
10. Preserve existing ordering unless an existing caller already dedupes/reorders.

Any behavior difference discovered during migration must be treated as a separate explicit decision, not silently folded into E2.

## 7. Edge Cases to Freeze Before Migration

Create RED parity fixtures covering at least:

- `#EXTM3U` header;
- quoted `tvg-id`, `tvg-name`, `tvg-logo`, `group-title`;
- legacy bare attribute forms currently accepted by Channel Catalog;
- blank lines between `#EXTINF` and source;
- comment/directive lines between `#EXTINF` and source;
- missing source line;
- next `#EXTINF` before any source;
- titles containing commas;
- source URLs containing query strings;
- header-aware suffixes such as `|User-Agent=...` preserved structurally;
- HLS `.m3u8`;
- DASH `.mpd`;
- direct HTTP(S) media/resource URLs;
- RTSP/RTMP lines preserved structurally for callers that choose to accept them;
- STRM source lines preserved structurally but not resolved in E2;
- duplicate channel entries;
- mixed-case `#EXTINF` where legacy behavior is case-insensitive;
- CRLF and LF input;
- malformed/partial EXTINF lines handled fail-soft without throwing the whole parse.

Fixtures must represent current accepted behavior, not idealized M3U semantics.

## 8. Migration Sequence

Migration is caller-by-caller with parity after every step.

1. Add shared core with dedicated unit tests.
2. Migrate `src/core/channel-catalog.js` while preserving `parseM3U()` API/output.
3. Re-run Phase D import/promotion contract.
4. Migrate Source Discovery M3U traversal while preserving `parseM3u()` API/output.
5. Re-run all Discovery provider/regression tests.
6. Migrate Source Hunt Worker M3U traversal while preserving Hunt policy/output.
7. Re-run Source Hunt regression/live checks.
8. Migrate frontend Source Hunt structural traversal only where parity is provable.
9. Run browser smoke/startup/frontend integration suites.
10. Update deployment workflow path triggers so Source Discovery and Source Hunt redeploy when `src/core/m3u-container.js` changes.

No caller migration proceeds if the previous one introduces unexplained behavior drift.

## 9. Worker Packaging / Shared Import Constraint

The shared module must be importable by browser modules and Cloudflare Worker modules without environment-specific side effects.

Requirements:
- no DOM access;
- no `window`/`document`;
- no Node-only APIs;
- no network calls;
- deterministic pure functions;
- ES module syntax compatible with current frontend/Worker build/deploy paths.

Worker workflows must validate syntax and include the shared file in path triggers/tests.

## 10. Test Strategy

### New focused tests

Add `tests/m3u-container-core.test.mjs` for structural parsing.

Add or extend parity tests ensuring current caller outputs remain stable.

### Existing regression gates

At minimum keep green:
- `tests/import-promotion-contract.test.mjs`;
- Source Discovery Worker/provider tests;
- Channel Identity/Profile tests;
- Phase E1 Source Format Registry tests;
- Discovery browser smoke;
- non-blocking startup;
- frontend integration audit;
- Source Hunt relevant regressions;
- Xtream/Saved Playlist regressions where imported M3U flow is exercised.

### TDD rule

For each migration step:
1. add/extend parity assertion;
2. observe RED when it targets missing shared-core behavior or migration contract;
3. implement minimal GREEN;
4. run focused + relevant broader regressions.

## 11. Deployment and Verification

E2 is DONE only when implemented + deployed + actually verified.

Required evidence:

1. PR branch validation green.
2. Merge SHA identified.
3. Frontend validation green on merge SHA.
4. Source Discovery deployment triggered by shared-core change and green on the same merge SHA.
5. Source Hunt deployment triggered by shared-core change and green on the same merge SHA.
6. Pages deployment green on merge SHA.
7. Existing Source Discovery live provider verification passes.
8. Existing Source Hunt live verification passes.
9. Browser smoke/startup integration passes.
10. Canonical `WEBV2_CURRENT.md` updated only after exact-SHA verification.
11. Roadmap/Architecture/Playbooks/Lessons/Cleanup updated according to the Problem-to-Knowledge rule where E2 creates reusable knowledge.

## 12. Non-Goals

E2 does not include:
- STRM parsing/resolution migration;
- Enigma2 parsing/normalization;
- RTSP/RTMP gateway work;
- Player redesign;
- candidate lifecycle redesign;
- Source Hunt search redesign;
- Source Discovery provider redesign;
- Source Verifier behavior change;
- Channel Identity changes;
- Channel Profile changes;
- Phase D promotion changes;
- Xtream redesign;
- broad dead-code cleanup unrelated to replaced M3U parser duplication.

These remain later phases, primarily E3 and subsequent Hunt/Discovery/lifecycle cleanup.

## 13. Rollback

No schema migration is involved.

Rollback is code-only:
- restore caller-local parser behavior;
- remove shared-core imports;
- keep parity fixtures to document expected behavior;
- redeploy affected frontend/Workers.

Because migration is caller-by-caller, rollback can be scoped to the affected caller if necessary.

## 14. Documentation / Brain Updates

During E2:
- CURRENT tracks active phase/verified state only;
- ROADMAP moves Project Brain to DONE and E2 to active/in-progress then DONE after verification;
- ARCHITECTURE gains `M3U Container Core` ownership once implementation is verified;
- PLAYBOOKS gains any reusable parser-migration/deploy procedure learned;
- TOOLING is updated if tool behavior/cost limits are learned;
- DECISIONS records the durable choice that shared container parsing is policy-free;
- LESSONS records migration/failure findings;
- CLEANUP receives old parser code only after all consumers are migrated and parity is verified.

## 15. Acceptance Summary

Phase E2 succeeds when WebV2 has one canonical, pure M3U structural parser and active callers use it without changing their public/runtime behavior.

The essential invariant is:

**Container structure is shared; domain policy stays with the owning caller.**
