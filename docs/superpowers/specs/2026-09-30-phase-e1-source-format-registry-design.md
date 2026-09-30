# Phase E1 Design — Extensible Source Format Registry + URL/Type Normalization

Date: 2026-09-30
Status: DESIGN REVIEW
Base production/main SHA: `d40a2f34027318d69dd78ef88d06fbfd60dc03fb`

## 1. Problem

WebV2 currently recognizes source/media formats in multiple places with overlapping but non-identical logic:

- `src/core/utils.js` owns frontend helpers such as `isHls()`, `isDash()` and `isVideoFile()`.
- `src/discovery/candidate-model.js` owns a broader `SOURCE_TYPES` set and `detectCandidateType()` for HLS, DASH, STRM, M3U, RTSP, RTMP, Xtream, header-aware and fallback direct sources.
- `workers/webtv-source-verifier.js` has its own `inferredType()` and response-body classification.
- Source Hunt contains additional format-specific regex extraction, especially for `.m3u8`.

This creates two risks: the same source can be classified differently by different paths, and every future format requires scattered edits.

Phase E1 introduces one explicit source-format contract without changing playback behavior, STRM resolution, M3U parsing, Enigma2 parsing, EPG ownership, Phase D promotion semantics, or persisted schemas.

## 2. Goal

Create an extensible pure Source Format Registry that becomes the canonical owner of source format identity, URL-level detection, format capabilities, safe unknown representation, and transport-vs-media distinction.

Success means:

> Existing inputs retain their externally expected behavior, while a new format can be added through one descriptor plus tests without format-specific edits to Discovery, Source Verifier, or Player compatibility consumers.

## 3. Non-goals

Phase E1 does NOT:

- rewrite Player or playback fallback;
- add RTMP/RTSP browser playback;
- change STRM recursive resolution;
- move M3U parsing out of `channel-catalog.js`;
- migrate Enigma2 parsing;
- redesign Source Hunt providers;
- change D1 or My Playlist schema;
- change Phase D metadata promotion;
- change EPG ownership;
- dynamically load third-party plugins.

## 4. Architectural decision

Introduce:

`src/core/source-format-registry.js`

The module is pure and side-effect free. It must not depend on DOM/window, localStorage, Cloudflare bindings, network I/O, D1, playback engines, auth, or credentials.

Browser and Worker code consume this same module. The Source Verifier deploy workflow must include the registry file in its `paths:` trigger so a registry-only change cannot leave the deployed verifier stale.

Rejected alternatives:

- frontend-only registry, because verifier drift remains;
- full dynamic plugin engine, because E1 needs one canonical static contract, not runtime plugin trust/lifecycle complexity.

## 5. Classification model: transport is not media format

E1 explicitly separates **transport/resource classification** from **confirmed media format**.

Example:

`https://example.com/live?id=123`

From URL inspection alone, WebV2 can know it is an HTTP(S) resource. It cannot know that it is playable video.

Therefore the canonical structured classification may be:

```js
{
  formatId: 'http-resource',
  mediaFormatId: 'unknown',
  status: 'recognized',
  confidence: 'transport-only'
}
```

If body/content-type later proves HLS, DASH or direct media, `mediaFormatId` becomes that format.

This resolves the current ambiguity around `direct`:

- canonical registry truth does not equate generic HTTP(S) with playable direct media;
- existing consumers that historically expect `sourceType: 'direct'` may receive it through an explicit compatibility mapping from `http-resource`;
- unknown non-HTTP schemes/extensions remain truly `unknown` rather than being silently called `direct`.

## 6. Descriptor contract

Each immutable descriptor contains at least:

```js
{
  id,
  aliases,
  priority,
  detectUrl,
  detectBody,
  capabilities,
  verificationMode,
  resolutionMode,
  savePolicy,
  compatibilityType
}
```

### `id`

Stable canonical id. Initial ids include:

- `hls`
- `dash`
- `direct-video`
- `http-resource`
- `strm`
- `m3u`
- `rtsp`
- `rtmp`
- `xtream`
- `header-aware`
- `unknown`

### `aliases`

Accepted historical/external explicit type names.

### `priority`

Deterministic ordering when more than one descriptor could match.

### `detectUrl(input)`

Pure scheme/path/extension detection. No network I/O.

### `detectBody(input)`

Pure body/content-type detection where relevant.

### `capabilities`

Minimum immutable capability keys:

```js
{
  browserPlayback,
  verifierProbe,
  requiresResolver,
  container,
  credentialed,
  live,
  vod
}
```

Capabilities describe format/runtime properties only. They never mean a particular URL is healthy or verified.

### `verificationMode`

Examples: `manifest`, `direct-media`, `resolve-first`, `unsupported`, `external-contract`, `transport-probe`.

### `resolutionMode`

Examples: `none`, `strm`, `container`, `xtream`, `external`.

### `savePolicy`

Structural source-save eligibility only. It does not replace Channel Profile or Phase D promotion policy.

### `compatibilityType`

Optional legacy source type exposed to existing consumers while canonical structured classification remains richer.

Example: `http-resource` may map to legacy `direct` where current API parity requires it.

## 7. Canonical API

The module exposes:

```js
createSourceFormatRegistry(descriptors)
detectSourceFormat(input, registry?)
getSourceFormat(id, registry?)
classifySourceBody(input, registry?)
normalizeSourceDescriptor(input)
listSourceFormats(registry?)
toLegacySourceType(classification)
```

`createSourceFormatRegistry()` enables deterministic test injection and future extension without dynamic runtime plugin loading.

The default export/registry remains static and production-controlled.

### `detectSourceFormat(input)`

Input may contain:

```js
{
  sourceUrl,
  explicitType,
  contentType,
  body
}
```

Return value is structured:

```js
{
  formatId,
  mediaFormatId,
  status,
  confidence,
  explicitType,
  rawScheme,
  rawExtension,
  capabilities,
  verificationMode,
  resolutionMode,
  savePolicy
}
```

Recognition status values:

- `recognized`
- `recognized-unsupported`
- `unknown`

These are format-recognition states, not source-verification states.

## 8. Explicit type precedence

1. A valid registered explicit type or alias wins over URL inference.
2. Empty, malformed, `unknown`, or unregistered explicit values do not force a false known format.
3. URL inference runs over registered descriptors in deterministic priority order.
4. Generic HTTP(S) without stronger evidence becomes `http-resource`, not confirmed media.
5. Unsupported/non-HTTP unknown schemes with no matching descriptor remain `unknown`.

Xtream must not be inferred from arbitrary URL shapes containing credentials. It remains explicit/context-driven.

## 9. Unknown and future formats

For:

`foo://host/live/channel.xyz`

classification should preserve evidence:

```js
{
  formatId: 'unknown',
  mediaFormatId: 'unknown',
  status: 'unknown',
  rawScheme: 'foo',
  rawExtension: '.xyz'
}
```

Consumers may display, retain or inspect it according to their own policy, but must not call it HLS, DASH or direct media without evidence.

A later descriptor can teach the registry the format without requiring format-specific edits to generic consumers.

## 10. Initial registry contents

### HLS

Detect `.m3u8`, HLS manifest markers and MPEGURL content types where body inspection exists.

Current browser playback and verifier behavior remain unchanged.

### DASH

Detect `.mpd`, MPD XML/body markers and DASH content types.

### Direct video/media

Detect currently supported known direct media extensions such as `.mp4` and `.webm`, plus direct video/audio content types in verifier context.

This is distinct from generic `http-resource`.

### HTTP resource

Detect generic `http://` and `https://` resources that have no stronger known format evidence.

It is recognized transport, not confirmed playable media.

Legacy mapping may expose `direct` to existing callers where parity requires it.

### STRM

Detect `.strm`; mark resolver required and container/reference semantics. `StrmResolver` remains unchanged.

### M3U

Detect `.m3u` and explicit playlist-container evidence. Existing `parseM3U()` remains unchanged.

### RTSP

Detect existing RTSP scheme variants. Recognized but current browser playback remains unsupported.

### RTMP

Detect existing RTMP scheme variants. Recognized but current browser playback remains unsupported.

### Xtream

Explicit/context-driven. Existing Xtream credential/account/preview lifecycle stays outside E1.

### Header-aware

Compatibility contract only. Existing safe header normalization and allowed-header policy remain unchanged.

## 11. Compatibility boundaries

### `src/core/utils.js`

Keep public helpers:

- `isHls()`
- `isDash()`
- `isVideoFile()`

They become thin registry wrappers. Player consumers do not get format-specific rewrites in E1.

### `src/discovery/candidate-model.js`

`detectCandidateType()` becomes a compatibility wrapper over registry classification plus `toLegacySourceType()`.

Existing externally expected `sourceType` values stay compatible.

`SOURCE_TYPES` must be derived from or validated against registry descriptors plus explicit compatibility-only states such as preview types, rather than being independently maintained format truth.

### `workers/webtv-source-verifier.js`

Its `inferredType()` and format-specific body recognition become thin wrappers around shared registry functions.

Verifier outcome semantics stay unchanged:

- `VERIFIED`
- `FAILED`
- `TIMEOUT`
- `HTTP 403`
- `HTTP 404`
- `DRM`
- `UNRESOLVED`

A source can therefore be `recognized HLS + FAILED verification` or `recognized RTMP + unsupported playback` without mixing the state machines.

## 12. Worker deployment consistency

`.github/workflows/deploy-source-verifier.yml` must add:

`src/core/source-format-registry.js`

to push path dependencies.

The deployment must prove Wrangler can include the shared relative ES module from the Worker entry point.

If the current single-entry deployment cannot do this safely, implementation stops and introduces an explicit bundle/build step or equivalent single-source mechanism. Copy-pasting registry logic into Worker code is forbidden because it recreates the duplication E1 exists to remove.

## 13. Source Hunt boundary

E1 does not rewrite Source Hunt. Its current `.m3u8`-heavy extraction remains a known duplicate/format-specific boundary.

Follow-up architecture:

- **E2:** shared M3U/container parsing and playlist-source extraction;
- **E3:** STRM/Enigma2 normalization and broader Source Hunt format adapters.

E1 must not claim E2/E3 work is complete.

## 14. Security and trust

The registry classifies. It does not trust or verify.

Rules:

- known format != verified source;
- unknown schemes are never fetched merely for classification;
- private/local target blocking stays in Worker security boundaries;
- credentials are not exposed in classification/logging;
- Xtream credentials stay in credential-aware lifecycle code;
- header-aware detection does not relax allowed headers;
- Phase D canonical metadata promotion remains unchanged;
- safe HTTP(S) validation remains a server/Worker concern, not a format-registry concern.

## 15. Lifecycle relationship

E1 formalizes:

```text
FOUND
  -> FORMAT_CLASSIFIED
  -> RESOLVED (when required)
  -> VERIFIED_MEDIA
  -> PLAYBACK_CONFIRMED
  -> SAVED
```

`FORMAT_CLASSIFIED` may be:

- `recognized`
- `recognized-unsupported`
- `unknown`

These states do not imply verification.

## 16. TDD strategy

Implementation starts with RED tests proving the registry does not yet exist.

Minimum contract cases:

1. HLS URL -> `hls`.
2. DASH URL -> `dash`.
3. MP4/WebM -> `direct-video`.
4. generic HTTP(S) -> `http-resource`, media unknown.
5. compatibility mapping of generic HTTP(S) -> legacy `direct` where current consumers require it.
6. STRM -> recognized, resolver required.
7. M3U -> recognized container/parse first.
8. RTSP -> recognized unsupported browser playback.
9. RTMP -> recognized unsupported browser playback.
10. valid explicit registered type overrides URL inference.
11. unregistered explicit type does not become a known format.
12. unknown non-HTTP scheme/extension stays `unknown`, not `direct`.
13. HLS body detection remains valid.
14. DASH body detection remains valid.
15. generic HTML response is not playable media.
16. current `isHls/isDash/isVideoFile` fixtures preserve outputs.
17. Discovery sourceType outputs preserve existing contract.
18. Source Verifier fixtures preserve verification results.

### Future-format extensibility proof

A test-only registry created with `createSourceFormatRegistry()` must add a synthetic `future-test` descriptor and demonstrate generic detection through `detectSourceFormat()` without edits to Discovery, verifier or Player consumer code.

The synthetic format must not be added to the production default registry.

### Regression suite

Before merge, preserve green results for playback/fallback, source ranking, header-aware proxy, STRM, M3U/import promotion, Xtream, Discovery candidate/verifier/browser smoke, startup non-blocking, frontend integration, EPG parity and Channel Identity/Profile.

## 17. Deployment verification

E1 is DONE only when the same merge SHA has:

1. implementation merged to `main`;
2. frontend CI success;
3. Source Verifier deployment success triggered by shared-registry dependency;
4. any additionally triggered Worker workflows successful;
5. GitHub Pages deployment success;
6. controlled live Source Verifier good/dead probes success;
7. browser smoke/startup gates success;
8. project checkpoint/canonical documentation updated, or any checkpoint/main/deployed mismatch explicitly recorded.

If checkpoint SHA, GitHub main SHA and deployed SHA differ, E1 must not be called fully canonical until project governance records/resolves the mismatch.

## 18. Canonical documentation update

At the next authorized `WEBV2_CURRENT.md` update, record:

- Phase C DONE evidence/SHA;
- Phase D DONE evidence/SHA;
- Phase E1 design and eventual implementation/deployment SHA;
- Source Format Registry ownership after E1 verification;
- E2/E3 remaining boundaries;
- TinyFish rule: all current TinyFish operations are metered and must not be used for WebV2 without explicit necessity/approval;
- checkpoint/main/deployed mismatch, if any.

Historical checkpoints never override current `WEBV2_CURRENT.md`.

## 19. Rollback

No schema migration is introduced. Rollback is code-only: revert registry imports/wrappers and redeploy affected frontend/Worker artifacts.

Persisted My Playlist, Favorites, Saved Playlist and EPG data require no transformation.

## 20. Acceptance criteria

E1 is accepted only if:

- one canonical registry owns format definitions used by Discovery and Source Verifier;
- frontend compatibility helpers delegate to it;
- transport recognition is distinct from confirmed media format;
- unknown formats fail closed and remain representable;
- recognized-but-unsupported differs from unknown;
- synthetic future format extension requires descriptor/test only, not consumer-specific format code;
- existing behavior remains regression-green;
- no D1/persisted metadata schema change occurs;
- Worker deployment cannot miss registry-only changes;
- production verification succeeds on the same merge SHA.

## 21. Follow-up phases

### E2 — Shared playlist/container parsing

Consolidate M3U parsing/extraction ownership while preserving import semantics and Phase D boundaries.

### E3 — Resolver and discovery adapters

Consolidate STRM, Enigma2 and broader Source Hunt format adapters around the registry/capability model.

Neither E2 nor E3 starts automatically with E1.
