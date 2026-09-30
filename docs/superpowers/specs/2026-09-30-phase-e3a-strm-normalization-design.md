# Phase E3a STRM Normalization Design

Updated: 2026-09-30
Repository: `tonis1000/WebV2`
Design branch: `phase-e3a/strm-design`
Base main SHA: `16f8ef7c863ee43fc5574946dc039ca7a8382f7f`
Status: DESIGN APPROVED IN CHAT / SPEC WRITTEN / IMPLEMENTATION NOT STARTED

## 1. Problem

WebV2 already recognizes STRM as a first-class source format through the Phase E1 Source Format Registry, where STRM is a container-like format that requires resolution before verification or playback.

However, STRM parsing and resolution behavior is currently duplicated across several active paths:

- `src/core/strm-resolver.js`
  - browser/runtime STRM resolver used by `SourceRegistry` and manual candidate testing;
  - GitHub blob-to-raw normalization;
  - nested STRM recursion;
  - DRM metadata extraction from `#KODIPROP`;
  - cache and in-flight deduplication.

- `workers/source-discovery/strm-specific-discovery.js`
  - separate STRM parser and recursive resolver;
  - GitHub blob-to-raw normalization;
  - nested STRM depth handling;
  - DRM detection;
  - Kodi header suffix parsing;
  - private/local target blocking;
  - subrequest, body-size, timeout, and reporting policy.

- `workers/source-huntatonisworkersdev.js`
  - separate, simpler STRM resolver path used by Source Hunt;
  - fetches STRM references and extracts media candidates under Hunt-specific policy.

This is not only code duplication. The callers currently have different resolution and security semantics. A naive single universal resolver would risk changing browser playback, Discovery SSRF protections, Hunt behavior, or candidate reporting.

## 2. Goal

Normalize STRM ownership without changing product behavior.

Phase E3a establishes one shared set of pure STRM structural primitives while preserving caller-owned networking, security, budgets, ranking, verification, save policy, and playback policy.

Core invariant:

> STRM structure and normalization are shared; network/security/product policy stays with the owning caller.

This follows the successful Phase E2 architecture pattern for M3U containers.

## 3. Scope

Phase E3a includes:

1. Extract reusable pure STRM primitives into a shared core module.
2. Refactor the existing browser `StrmResolver` to consume those primitives while preserving its current public behavior.
3. Migrate the Source Discovery STRM-specific provider to the same structural primitives while retaining its Worker-specific security and budget policy.
4. Migrate Source Hunt STRM handling to the same structural primitives while retaining Hunt-specific policy.
5. Add parity tests for browser/runtime, Discovery, and Hunt behavior.
6. Wire shared-core changes into the relevant frontend and Worker workflows.
7. Audit active code for independent STRM document parsers after migration.
8. Update Brain owners and mark only the STRM portion of `CLEAN-004` resolved after deployment/live verification.

## 4. Explicit non-goals

Phase E3a does NOT include:

- Enigma2 normalization. That is Phase E3b.
- Player redesign.
- Source Verifier redesign.
- Source Discovery provider consolidation.
- Source Hunt search/ranking redesign.
- M3U parser changes.
- Xtream changes.
- RTSP/RTMP gateway work.
- DRM playback implementation.
- persistent DRM license storage.
- broad candidate lifecycle redesign.
- moving all STRM resolution behind the Discovery Worker.
- removing Registry/D1 application data ownership.

## 5. Existing ownership that must remain intact

### Source Format Registry

`src/core/source-format-registry.js` remains the format capability owner.

STRM remains classified as:

- `browserPlayback: false`
- `requiresResolver: true`
- `container: true`
- `verificationMode: resolve-first`
- `resolutionMode: strm`
- `savePolicy: resolve-first`

Phase E3a must not duplicate or override this format policy in the STRM structural core.

### Source Registry

`src/core/source-registry.js` remains the browser playback-route consumer.

It may continue using the browser `StrmResolver`, but it does not become the STRM parser owner.

### Player

`src/core/player.js` remains playback owner. It receives already-resolved playable media routes. No STRM parsing or resolution policy moves into Player.

### Discovery

Source Discovery keeps ownership of:

- network fetch policy;
- SSRF/private/local-host blocking;
- subrequest budget;
- timeout and max-body policy;
- provider reports;
- candidate construction;
- freshness semantics;
- verification metadata;
- provider kill switch.

### Source Hunt

Source Hunt keeps ownership of:

- when STRM references are inspected;
- Hunt budgets;
- ranking/relevance;
- candidate construction;
- search lane behavior;
- save/test eligibility.

## 6. Proposed architecture

```text
STRM reference
      |
      v
+-------------------------+
| shared STRM core        |
| pure structure only     |
+-------------------------+
      |        |        |
      v        v        v
 browser   Discovery   Hunt
 adapter    adapter    adapter
      |        |        |
      +-- caller policy -+
```

The shared core MUST NOT perform network fetches itself.

## 7. Shared STRM core

Recommended module:

`src/core/strm-core.js`

The exact exported names may change during implementation if tests reveal a cleaner API, but responsibilities should stay bounded.

Candidate pure primitives:

```js
canonicalizeStrmReference(value)
isStrmReference(value)
parseStrmDocument(text)
parseKodiHeaderSuffix(value)
classifyStrmTarget(value)
```

### 7.1 `canonicalizeStrmReference`

Responsibilities:

- trim/sanitize the reference;
- remove transport/header suffix where appropriate for reference identity;
- parse only valid HTTP(S) references;
- normalize GitHub `blob` URLs to `raw.githubusercontent.com` equivalents;
- return a normalized reference representation without fetching it.

It MUST NOT:

- allow/block a host based on SSRF policy;
- perform DNS/IP classification;
- fetch the target;
- decide save eligibility.

### 7.2 `isStrmReference`

Pure path/extension recognition over a canonicalizable reference.

It MUST remain compatible with current `.strm` URL behavior, including query strings where applicable.

### 7.3 `parseStrmDocument`

Parse STRM text into neutral structural metadata.

Proposed neutral result:

```js
{
  mediaUrl: '',
  requiredHeaders: {},
  drm: {
    detected: false,
    licenseType: '',
    licenseKey: ''
  },
  directives: [],
  valueLines: []
}
```

The parser should preserve enough ordered structure for caller parity if needed.

Expected behavior includes:

- ignore blank lines;
- recognize `#KODIPROP:` case-insensitively;
- extract `inputstream.adaptive.license_type`;
- extract `inputstream.adaptive.license_key`;
- identify the first eligible non-comment media/reference line according to the approved structural contract;
- parse Kodi-style header suffixes into neutral `requiredHeaders` metadata where present.

The structural parser MUST NOT:

- fetch nested references;
- block private hosts;
- mark a candidate VERIFIED;
- rank a source;
- decide whether DRM means reject or inspect-only;
- decide whether the target is saveable.

### 7.4 Header suffix parsing

Shared parsing may normalize supported transport metadata such as:

- `User-Agent`
- `Referer` / `Referrer`
- `Origin`

The core may parse and normalize syntax, but caller policy decides whether those headers may be used, persisted, proxied, or exposed.

## 8. Browser/runtime adapter

`src/core/strm-resolver.js` remains the browser-facing resolver class.

It should be refactored to consume the shared core rather than own its own STRM document parser.

Behavior to preserve:

- constructor timeout option;
- cache behavior;
- failure TTL behavior;
- in-flight deduplication;
- nested STRM recursion;
- current maximum recursion semantics;
- `resolve()` public behavior;
- `peek()` behavior;
- `peekInfo()` behavior;
- `inspect()` behavior;
- DRM metadata propagation across nested references;
- browser-side failure behavior.

`SourceRegistry` and `main.js` should not need product-level behavior changes.

## 9. Source Discovery adapter

`workers/source-discovery/strm-specific-discovery.js` should stop owning its own STRM document parser and reference canonicalization primitives where parity permits.

It retains:

- `STRM_TIMEOUT_MS`;
- `STRM_MAX_REFERENCES`;
- `STRM_MAX_DEPTH`;
- `STRM_MAX_SUBREQUESTS`;
- `STRM_MAX_BODY_BYTES`;
- private/local target blocking;
- provider-specific User-Agent / Accept headers;
- request budget accounting;
- resolution chain reporting;
- provider candidate shape;
- `drmDetected` reporting;
- final `sourceType` mapping;
- freshness behavior;
- provider kill switch and router wiring.

Important security rule:

> Moving parsing into shared core must not weaken Discovery SSRF/private-target protection.

The shared core must remain incapable of silently bypassing caller validation.

## 10. Source Hunt adapter

The STRM logic in `workers/source-huntatonisworkersdev.js` should consume the same structural primitives.

Hunt retains:

- when a candidate is worth resolving;
- fetch limits and timeouts;
- Hunt ranking and relevance;
- candidate metadata;
- save/test policy;
- existing search behavior.

E3a must not turn Source Hunt into a general STRM service.

## 11. Nested STRM semantics

Nested STRM references are part of the existing behavior and must remain supported.

The shared core may expose enough metadata to identify that the parsed target is another STRM reference, but recursion itself stays with caller adapters because callers own:

- maximum depth;
- network fetch policy;
- request budgets;
- security validation;
- reporting.

This prevents a pure parser from accidentally becoming a hidden network resolver.

## 12. DRM semantics

STRM parsing may discover DRM metadata.

Shared core responsibility:

- parse and expose DRM metadata neutrally.

Caller responsibilities:

- browser playback may refuse candidate playback when DRM licensing is unsupported;
- Discovery may retain/report a candidate with `drmDetected` metadata;
- Hunt may expose or reject based on its existing policy.

E3a does not implement DRM playback.

## 13. Compatibility and parity requirements

### Browser/runtime parity

Tests must preserve:

- plain STRM to HLS resolution;
- plain STRM to DASH resolution where currently supported;
- nested STRM resolution;
- GitHub blob-to-raw normalization;
- DRM metadata extraction;
- DRM metadata inheritance through nested references;
- cache success behavior;
- failure cache TTL behavior;
- in-flight deduplication;
- malformed/non-STRM input behavior.

### Discovery parity

Tests must preserve:

- live STRM feed resolution behavior;
- duplicate reference collapse;
- nested depth reporting;
- Kodi headers extraction;
- DRM detection;
- private/local target rejection;
- request budget limits;
- max body limits;
- candidate/report shape;
- no fabricated freshness.

### Hunt parity

Tests must preserve:

- existing STRM candidate resolution behavior;
- existing accepted final media types;
- existing failure behavior;
- ranking/relevance ownership;
- no new automatic save behavior.

## 14. Workflow/deployment contract

Shared STRM core changes must trigger all affected validation/deployment paths.

At minimum:

### Frontend validation

Must run shared STRM core tests and browser/runtime STRM parity tests.

### Source Discovery deployment

Must watch the shared STRM core module and STRM parity tests.

Existing live ERT1 STRM gate must remain intact and continue proving:

- STRM provider available;
- public feed reachable;
- at least one STRM resolution succeeds;
- resulting candidates are returned;
- Source Discovery smart feature contract remains present.

### Source Hunt deployment

Must watch shared STRM core changes if the Worker imports or otherwise consumes that core.

Live Source Hunt verification must remain intact and must not be weakened merely to make E3a deploy easier.

## 15. Cleanup ownership

`WEBV2_CLEANUP.md` item `CLEAN-004` must be split or annotated after E3a verification:

- STRM duplicate primitives: RESOLVED only after implementation + deployment + live verification.
- Enigma2 duplicate primitives: still PENDING / BLOCKED ON E3b.

E3a does not resolve the full CLEAN-004 item if Enigma2 duplication still exists.

## 16. Brain updates after implementation

Before closure, update only the correct owners:

- `WEBV2_CURRENT.md` for verified E3a outcome;
- `WEBV2_ROADMAP.md` for E3a DONE / E3b next;
- `WEBV2_ARCHITECTURE.md` for shared STRM ownership;
- `WEBV2_DECISIONS.md` for the shared-structure/local-policy decision;
- `WEBV2_LESSONS.md` for any parity/security lesson actually learned;
- `WEBV2_PLAYBOOKS.md` only if a reusable procedure emerges;
- `WEBV2_TOOLING.md` only if tooling capability/limit changes;
- `WEBV2_CLEANUP.md` for CLEAN-004 partial resolution.

Do not duplicate the same fact across all Brain files.

## 17. Proof of success

Phase E3a is DONE only when all of the following are true:

1. One shared STRM structural core exists.
2. Browser `StrmResolver` uses it.
3. Discovery STRM provider uses it for shared structural concerns.
4. Source Hunt uses it for shared structural concerns.
5. No active independent STRM document parser remains in the approved caller set.
6. Browser/runtime STRM parity tests pass.
7. Discovery STRM parity/security tests pass.
8. Hunt STRM parity tests pass.
9. Existing Phase E1 and E2 regression suites pass.
10. Frontend/browser smoke/startup/integration regressions pass.
11. Source Discovery deploy succeeds at the exact merge SHA.
12. Existing live ERT1 STRM resolution gate passes at that deployment.
13. Source Hunt deploy/live verification succeeds if its Worker changed.
14. GitHub Pages/frontend deployment succeeds where applicable.
15. Brain owners are updated with exact evidence.
16. `CLEAN-004` records STRM resolved while Enigma2 remains pending.

## 18. Failure conditions

Do not merge if any of these occur without an explicit design reconciliation:

- browser STRM playback semantics change unexpectedly;
- Discovery private/local target blocking becomes weaker;
- DRM metadata is lost;
- Kodi header metadata is lost;
- nested STRM behavior changes unintentionally;
- Source Hunt starts accepting/saving sources it previously rejected;
- the shared core performs network fetches;
- Player or Verifier becomes a STRM parser owner;
- implementation expands into Enigma2 work.

## 19. Implementation strategy

Use TDD and migrate one consumer at a time:

1. shared core RED tests;
2. minimal pure core GREEN;
3. browser/runtime parity RED → GREEN;
4. Discovery parity/security RED → GREEN;
5. Hunt parity RED → GREEN;
6. workflow trigger/test wiring RED → GREEN;
7. repo-wide duplicate-parser audit;
8. full regression;
9. code review;
10. PR/merge;
11. exact-SHA deploy/live verification;
12. Brain closure.

The existing `src/core/strm-resolver.js` is the behavioral reference for browser/runtime behavior. It should be refactored incrementally, not replaced wholesale.

## 20. Approved design summary

Chosen approach: **shared pure STRM core + caller-owned adapters/policy**.

Rejected alternatives:

- one universal resolver containing all browser/Worker/security/product policy;
- moving all STRM resolution behind Source Discovery.

Reason:

The chosen architecture reduces duplication while preserving WebV2's established ownership boundaries, security model, playback behavior, Phase E1 capability contract, and Phase E2 shared-structure/local-policy pattern.
