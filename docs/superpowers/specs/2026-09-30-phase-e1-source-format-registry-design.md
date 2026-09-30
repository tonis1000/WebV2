# Phase E1 Design — Extensible Source Format Registry + URL/Type Normalization

Date: 2026-09-30
Status: DESIGN REVIEW
Base production/main SHA: `d40a2f34027318d69dd78ef88d06fbfd60dc03fb`

## 1. Problem

WebV2 currently recognizes source/media formats in multiple places with overlapping but non-identical logic:

- `src/core/utils.js` has frontend helpers such as `isHls()`, `isDash()`, and `isVideoFile()`.
- `src/discovery/candidate-model.js` owns a broader `SOURCE_TYPES` set and `detectCandidateType()` for HLS, DASH, STRM, M3U, RTSP, RTMP, Xtream, header-aware and fallback direct sources.
- `workers/webtv-source-verifier.js` has its own `inferredType()` and response-body classification logic.
- Source Hunt contains additional format-specific regex extraction, especially for `.m3u8`.

This duplication creates two risks:

1. The same URL can be classified differently depending on which path sees it.
2. Adding a future format requires scattered edits across Discovery, verifier, player/source helpers and search/discovery logic.

Phase E1 must introduce one explicit source-format contract without changing current playback behavior, STRM resolution behavior, M3U parsing behavior, Enigma2 parsing behavior, or the verified promotion contract from Phase D.

## 2. Goal

Create an extensible, pure source-format registry that becomes the canonical owner of source format identity, URL-level detection, format capabilities and safe unknown-format representation.

The immediate success condition is:

> Existing formats keep their current behavior, while a newly introduced format can be represented and detected through one descriptor/adapter plus tests, without modifying the Discovery candidate model, Source Verifier type inference, or Player compatibility helpers.

## 3. Non-goals

Phase E1 does NOT:

- rewrite the Player;
- change playback routing or fallback order;
- add browser playback for RTMP or RTSP;
- change STRM recursive resolution;
- move M3U parsing out of `channel-catalog.js`;
- migrate Enigma2 parsing;
- redesign Source Hunt discovery providers;
- change D1 schema;
- change My Playlist promotion semantics from Phase D;
- change EPG ownership from Phase C;
- claim support for a format merely because it can be detected;
- dynamically download or execute third-party format plugins.

Those remain separate follow-up phases.

## 4. Architectural decision

### Chosen approach

Introduce a shared pure module:

`src/core/source-format-registry.js`

It contains static format descriptors and pure functions only. It must have no dependency on `window`, DOM, localStorage, Cloudflare bindings, network fetches, D1, playback engines or authentication.

Browser code and Worker code may both import this module. The Source Verifier deployment workflow must therefore include the registry file in its `paths:` trigger so a registry change cannot leave a deployed verifier on stale format rules.

### Rejected alternatives

#### Frontend-only registry

Rejected because the verifier would still carry a separate source-format truth.

#### Full plugin engine with dynamic registration/runtime loading

Rejected for E1 because it adds lifecycle, trust and deployment complexity that is not required to solve the current duplication problem.

Phase E1 uses a static registry with an intentionally extension-friendly descriptor contract. Dynamic plugin loading is not part of this design.

## 5. Source format descriptor contract

Each descriptor is immutable and includes at least:

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
  savePolicy
}
```

### Required fields

#### `id`

Stable canonical format id. Examples:

- `hls`
- `dash`
- `direct-video`
- `strm`
- `m3u`
- `rtsp`
- `rtmp`
- `xtream`
- `header-aware`
- `unknown`

Existing externally visible source type strings that are already part of contracts should remain compatible through aliases or compatibility mapping rather than being silently renamed.

#### `aliases`

Known historical or external names accepted as explicit type hints.

#### `priority`

Deterministic ordering when multiple URL rules could match.

#### `detectUrl(input)`

Pure URL/scheme/path inspection. It must not perform network I/O.

It returns either no match or a confidence-bearing match result.

#### `detectBody(input)`

Pure response/body/content-type classification where applicable. E1 uses this primarily to consolidate HLS/DASH/media-body recognition currently duplicated in the verifier.

#### `capabilities`

An immutable capability object. Minimum keys:

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

Capability values describe known technical properties only. They do not imply that a particular URL has been verified.

#### `verificationMode`

Examples:

- `manifest`
- `direct-media`
- `resolve-first`
- `unsupported`
- `external-contract`

#### `resolutionMode`

Examples:

- `none`
- `strm`
- `container`
- `xtream`
- `external`

#### `savePolicy`

Describes whether a detected source type is structurally eligible for existing source-save flows. It does not replace Channel Profile or Phase D metadata promotion policy.

## 6. Canonical API

The module exposes a small stable API:

```js
detectSourceFormat(input)
getSourceFormat(id)
classifySourceBody(input)
normalizeSourceDescriptor(input)
listSourceFormats()
```

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

URL detection must work without `body` or `contentType`.

Return value is structured, never just a bare string:

```js
{
  formatId,
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

### Status values

E1 defines these source-format recognition states:

- `recognized`
- `recognized-unsupported`
- `unknown`

`recognized` means WebV2 knows the format contract. It does NOT mean a source is reachable, healthy, DRM-free or browser-playable.

`recognized-unsupported` means WebV2 can identify the format but the current runtime intentionally lacks a required capability.

`unknown` is fail-closed classification. It must not be silently converted to `direct` merely because no known extension matched.

## 7. Explicit type precedence

Explicit type hints are accepted only if they map to a registered canonical format or alias.

Rules:

1. Valid registered explicit type wins over URL inference.
2. `unknown`, empty, malformed or unregistered explicit type does not force a false known format.
3. URL inference then runs over registered descriptors in deterministic priority order.
4. If no descriptor matches, result is `unknown`.

This preserves current APIs that supply `sourceType` while preventing arbitrary future strings from being treated as authoritative known formats.

## 8. Unknown and future formats

Unknown-format preservation is a core requirement, not an error case to erase.

For a URL such as:

`foo://host/live/channel.xyz`

WebV2 should be able to return:

```js
{
  formatId: 'unknown',
  status: 'unknown',
  rawScheme: 'foo',
  rawExtension: '.xyz'
}
```

The system may display, log, inspect or retain the candidate according to the consumer's existing policy, but it must not call it HLS, DASH or `direct` without evidence.

A later phase can add a descriptor for the new format. Existing consumers should then receive the new classification through the same API without requiring format-specific edits.

## 9. Initial registry contents

Phase E1 should model the formats already represented in the codebase. Minimum initial descriptors:

### HLS

Detection:
- `.m3u8` path/URL
- HLS manifest/body markers and MPEGURL content types where body inspection is available

Capabilities:
- browser playback: yes through existing player paths
- verifier probe: yes
- requires resolver: no

### DASH

Detection:
- `.mpd`
- MPD body/content type

Capabilities:
- browser playback: according to existing player behavior
- verifier probe: yes
- requires resolver: no

### Direct video/media

Detection:
- known direct video extensions currently recognized by frontend compatibility helpers, including `.mp4` and `.webm`
- body/content-type media evidence in verifier context

Important: generic HTTP(S) with no media evidence is not automatically a confirmed direct-media format. URL-only classification may remain unknown or use a compatibility result where required by current callers, but E1 must distinguish "generic transport URL" from "known playable media" in the structured result.

### STRM

Detection:
- `.strm`

Capabilities:
- requires resolver: yes
- container/reference: yes
- direct verifier probe before resolution: no

Existing `StrmResolver` remains unchanged in E1.

### M3U

Detection:
- `.m3u`
- playlist container semantics where body inspection is explicitly provided

Capabilities:
- container: yes
- requires parse/resolve before media verification

Existing `parseM3U()` remains unchanged in E1.

### RTSP

Detection:
- `rtsp://` and existing accepted secure variant if currently represented

Status/capability:
- recognized but browser playback unsupported by current WebV2 player
- verifier behavior remains fail-closed/unsupported unless a later phase adds a resolver/gateway

### RTMP

Detection:
- `rtmp://` and existing accepted secure variant if currently represented

Status/capability:
- recognized but browser playback unsupported by current WebV2 player

### Xtream

Explicit/source-context format. URL detection alone must not infer Xtream credentials from arbitrary URL shapes.

Existing Xtream account/preview lifecycle remains outside E1.

### Header-aware

Preserve as a compatibility source-type contract where existing callers use it. Header normalization remains in existing safe header utilities during E1.

## 10. Compatibility layer

Phase E1 must preserve current public/internal contracts while moving ownership.

### `src/core/utils.js`

Existing helpers stay available:

- `isHls()`
- `isDash()`
- `isVideoFile()`

They become compatibility wrappers over the registry rather than independent regex owners.

No player consumer should require a format-specific rewrite in E1.

### `src/discovery/candidate-model.js`

`detectCandidateType()` becomes a compatibility wrapper over `detectSourceFormat()`.

The externally expected `sourceType` values must remain compatible with existing Discovery tests and APIs.

`SOURCE_TYPES` must no longer be an independently maintained source of truth. It should be derived from or validated against the registry plus any explicit compatibility-only values such as preview states.

### `workers/webtv-source-verifier.js`

`inferredType()` and format-specific body classification move to shared registry functions or thin wrappers around them.

Verifier status semantics remain unchanged in E1:

- `VERIFIED`
- `FAILED`
- `TIMEOUT`
- `HTTP 403`
- `HTTP 404`
- `DRM`
- `UNRESOLVED`

Source-format recognition status is separate from verification status.

## 11. Worker deployment consistency

The verifier imports the shared registry from repository code.

`.github/workflows/deploy-source-verifier.yml` must add `src/core/source-format-registry.js` to its push `paths:` list.

The deployment validation must prove the Worker build can import the shared module under Cloudflare Workers' module deployment model.

If direct relative module import is incompatible with the current Wrangler single-entry deployment, implementation must stop and use a build/bundle step or another explicit single-source mechanism. It must not silently copy registry logic into the Worker.

This is an implementation gate because E1's purpose is one canonical format truth.

## 12. Source Hunt boundary

E1 does not rewrite Source Hunt.

However, new tests should document that Source Hunt still contains format-specific discovery extraction and is a known follow-up boundary.

Planned follow-up:

- E2: M3U/container parsing ownership and shared playlist source extraction
- E3: STRM/Enigma2 normalization and broader Source Hunt format adapters

E1 must not claim those duplicates are removed.

## 13. Security and trust rules

The registry is classification metadata, not a trust oracle.

Therefore:

- detecting a known format does not mark a source verified;
- unknown schemes are never fetched merely to identify them;
- safe HTTP(S) target validation remains owned by server/Worker security boundaries;
- credentials are not parsed into logs/display fields by the registry;
- Xtream credentials remain handled by existing credential-aware lifecycle code;
- header-aware classification does not relax the allowed-header list;
- private/local network protection in the verifier remains unchanged;
- Phase D canonical metadata promotion rules remain unchanged.

## 14. Lifecycle relationship

E1 clarifies the candidate lifecycle as:

```text
FOUND
  -> FORMAT_CLASSIFIED
  -> RESOLVED (when required)
  -> VERIFIED_MEDIA
  -> PLAYBACK_CONFIRMED
  -> SAVED
```

Possible format outcomes at `FORMAT_CLASSIFIED`:

```text
recognized
recognized-unsupported
unknown
```

These are not verification outcomes.

A source can therefore be:

`recognized HLS + FAILED verification`

or:

`recognized RTMP + unsupported browser playback`

or:

`unknown format + inspectable candidate`

without conflating those states.

## 15. Test strategy

Implementation must use TDD.

### RED contract tests

Create dedicated Phase E1 tests before production code changes. They must fail because no shared registry exists yet.

Minimum cases:

1. HLS URL -> `hls`.
2. DASH URL -> `dash`.
3. MP4/WebM compatibility -> direct video/media classification.
4. STRM -> recognized, resolver required.
5. M3U -> recognized container, resolve/parse first.
6. RTSP -> recognized unsupported browser playback.
7. RTMP -> recognized unsupported browser playback.
8. explicit registered type overrides URL inference.
9. unregistered explicit type does not become a known format.
10. unknown scheme/extension remains `unknown`, not `direct`.
11. HLS body classification remains valid.
12. DASH body classification remains valid.
13. generic HTML response is not misclassified as playable media.
14. compatibility helpers return the same answers as before for current fixtures.
15. Discovery `sourceType` outputs preserve existing contract for current inputs.
16. Verifier outputs preserve existing verification statuses for current fixtures.

### Future-format extensibility proof

A test-only registry construction or injected descriptor set must prove that a synthetic format such as `future-test` can be added via one descriptor and then detected through the generic registry API without editing Discovery, verifier or Player consumer code.

This test must not add a fake production format to the default registry.

### Regression suite

Before merge, all existing suites must remain green, especially:

- playback/fallback regressions
- source ranking
- header-aware proxy
- STRM resolver/discovery
- M3U/import promotion contract
- Xtream lifecycle/preview routes
- Discovery candidate/verifier/browser smoke
- startup non-blocking
- frontend integration
- EPG parity
- Channel Identity/Profile

## 16. Deployment verification

E1 is DONE only when all of the following are true on the same merge SHA:

1. implementation merged to `main`;
2. frontend CI succeeds;
3. Source Verifier deploy workflow succeeds because the shared registry is in its dependency path;
4. any additionally triggered Worker workflows succeed;
5. GitHub Pages deploy succeeds;
6. controlled live Source Verifier good/dead probes succeed on the merge SHA;
7. browser smoke/startup gates succeed;
8. checkpoint/canonical documentation is updated or explicitly records any remaining checkpoint SHA mismatch.

If deployed SHA, GitHub main SHA and project checkpoint SHA differ, E1 must not be called fully canonical until that mismatch is recorded/resolved according to project governance.

## 17. Canonical documentation update

At the next authorized `WEBV2_CURRENT.md` update, record:

- Phase C DONE evidence and SHA;
- Phase D DONE evidence and SHA;
- Phase E1 architecture and eventual implementation/deployment SHA;
- Source Format Registry as canonical owner of format identity/detection after E1 is verified;
- remaining E2/E3 boundaries;
- TinyFish operational rule: all TinyFish operations are currently metered under the user's account contract and must not be used for WebV2 without explicit necessity/approval;
- any checkpoint/main/deployed SHA mismatch observed at update time.

Historical checkpoints must not override the current canonical document.

## 18. Rollback

E1 must be reversible without data migration.

Because it introduces no D1 schema change and does not alter persisted channel/source schema, rollback consists of reverting the consumer imports/wrappers and registry module on the frontend/Worker deploys.

No persisted My Playlist, Favorites, Saved Playlist or EPG data should require transformation.

## 19. Acceptance criteria

Phase E1 implementation is accepted only if:

- one canonical registry owns format definitions used by Discovery and Source Verifier;
- frontend compatibility helpers delegate to that registry;
- unknown formats fail closed and remain representable;
- recognized-but-unsupported formats are distinguishable from unknown formats;
- adding a synthetic future descriptor requires no format-specific consumer edit in the extensibility test;
- existing source/playback/import/verifier behavior remains regression-green;
- no D1 or canonical metadata schema changes are introduced;
- worker deployment cannot miss a registry-only change;
- production verification is successful on the same merge SHA.

## 20. Follow-up phases

### E2 — Shared playlist/container parsing

Consolidate M3U parsing/extraction ownership while preserving import semantics and Phase D promotion boundaries.

### E3 — Resolver and discovery adapters

Consolidate STRM, Enigma2 and broader Source Hunt source-format adapters around the registry/capability model.

Neither E2 nor E3 is started by approval or implementation of E1.
