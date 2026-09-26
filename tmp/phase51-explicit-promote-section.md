
---

## 28. Source Discovery V2 Phase 5.1 · Explicit Save / Promote · 2026-09-26

Phase 5.1 is the first Discovery phase allowed to persist a verified media result into `My Playlist`. Persistence is always an explicit user action. Search, candidate creation and verification remain read-only.

### Runtime boundary

```text
Discovery candidate
      │
      ├── UNVERIFIED → cannot save
      │
      └── separate Source Verifier
              │
              ▼
          VERIFIED
              │
              │ explicit user click only
              ▼
      [Add this source]
              │
              ▼
existing source-save-policy.js
              │
              ▼
My Playlist / D1
```

Discovery does not introduce a second My Playlist writer. `src/discovery/promotion.js` delegates media persistence to the existing `saveBestSourceToCurrent()` policy, which keeps at most the best three source URLs and uses the existing trusted-device Registry write path.

### Promotion prerequisites

A candidate can be promoted only when all of the following are true:

```text
verificationStatus === VERIFIED
verified === true
saveEligible !== false
candidateKind is normal media
sourceUrl is http/https
requiredHeaders is empty
Discovery channel still matches currently selected channel
```

The last condition is the stale-result / wrong-channel guard. If Discovery was opened for `MEGA` and the user subsequently selects `SKAI`, an old MEGA result is refused until Discovery is reopened for the current channel.

### Persistent-header boundary

Phase 5.1 does not persist candidates that require request headers such as `Referer`, `Origin` or `User-Agent`.

The current Registry `channel_sources` persistence contract stores source URL/origin/priority and health metadata but does not yet have a persistent approved-header schema. Therefore a header-dependent candidate may be verified temporarily, but its card shows that the headers are not persistable and the Add action stays disabled.

This preserves the existing Saved Sources policy rather than silently dropping required transport metadata.

### Official fallback boundary

`official-page` and `official-embed` candidates are not media sources and cannot be promoted to `My Playlist` through Phase 5.1.

Official provenance does not bypass media verification or the source persistence model.

### Xtream channel versus full account

For a VERIFIED Xtream candidate the UI exposes two distinct user choices:

```text
[Add this source]
[Keep Full Xtream Account]
```

`Add this source` persists only the signed WebTV Xtream Bridge playback URL for the selected channel through the normal My Playlist source policy.

`Keep Full Xtream Account` does not copy credentials into Discovery and does not write another My Playlist source. Phase 4.6 Authorized Xtream candidates originate only from accounts that are already stored in the secure Xtream Bridge, so Phase 5.1 verifies that `accountRef` still exists and reports the account as already stored securely.

Browser-visible Xtream context remains limited to:

```text
accountRef
server metadata
streamId
signed WebTV bridge playback URL
```

Username/password remain encrypted server-side in the Xtream Bridge and are never requested, returned or rewritten by `src/discovery/promotion.js`.

### Explicit-write invariant

The Phase 5.1 browser gate proves:

```text
Discovery scans completed      → 0 My Playlist writes
Verify All completed           → 0 My Playlist writes
explicit promoteOne() click    → exactly 1 My Playlist write
                               → exactly 1 My Playlist reload
Keep Full Xtream Account       → no additional My Playlist write
```

There is no automatic promote after verification and no background persistence.

### Player/sidebar isolation

Search and Verify continue to leave the normal player and sidebar untouched. The only bridge from Discovery into the primary application is the explicit persistence action.

```text
PLAYER / SIDEBAR
      │
      └── already-loaded catalog/playback only

DISCOVERY
      ├── searches
      ├── temporary candidates
      └── verification
              │
              │ explicit Add only
              ▼
        My Playlist / D1
```

The browser smoke keeps player/sidebar sentinels unchanged throughout Discovery, verification and promotion-policy execution.

### Hard Phase 5.1 prohibitions

Phase 5.1 must not:

- save an UNVERIFIED candidate
- auto-save immediately after verification
- save an official page/embed as an IPTV source
- silently discard required request headers
- promote a stale result to a different currently selected channel
- create a second My Playlist writer
- expose or request Xtream username/password
- rewrite an already stored Xtream account just because a channel matched
- make `Keep Full Xtream Account` add channels automatically
- change permanent MANUAL source order implicitly
- invoke the normal player as part of Search/Verify
- persist any candidate without an explicit user action

### Regression gate

Phase 5.1 adds:

```text
src/discovery/promotion.js
tests/discovery-promotion.test.mjs
```

and extends the existing Discovery browser smoke.

The deterministic regression proves:

- VERIFIED is required
- `saveEligible=false` is blocked
- official fallback pages are blocked
- persistent headers are blocked
- wrong-channel promotion is blocked before the writer runs
- successful media promotion delegates to `saveBestSourceToCurrent(..., {maxSources:3})`
- Xtream full-account keep uses only `accountRef` and the existing account list
- the promotion module neither imports `saveXtreamAccount` nor handles passwords

### Production evidence boundary

CI and automated live gates must not add sources to the user's real `My Playlist` merely to prove Phase 5.1. The write proof therefore uses a browser fixture that counts Registry writes and validates the exact explicit-write boundary.

Completion requires:

- final-head PR CI green
- deterministic promotion regression green
- Chrome Discovery smoke green
- integration audit green
- canonical §28 appended
- main-branch CI green
- Pages deployment green

A real production My Playlist write occurs only when the user explicitly presses `Add this source` in an authenticated WebTV session.
