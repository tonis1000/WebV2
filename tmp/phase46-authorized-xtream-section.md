
---

## 27. Source Discovery V2 Phase 4 provider #6 · Authorized Xtream Expansion · 2026-09-26

Phase 4.6 expands Discovery across Xtream accounts that the user has already saved and authorized through the existing WebTV Xtream Bridge. It does not search the public internet for Xtream credentials or providers, and it does not introduce a second credential store.

### Runtime boundary

```text
selected channel
      │ explicit Search Authorized Xtream
      ▼
src/discovery/authorized-xtream.js
      │
      ├── listXtreamAccounts()
      └── loadXtreamChannels(accountId)
              │
              ▼
existing webtv-xtream bridge
      │
      ├── trusted-device session required
      ├── encrypted credentials remain server-side
      ├── provider catalog is fetched by the existing bridge
      └── browser receives signed bridge playback URLs only
      ▼
temporary Discovery candidate
      │
      └── UNVERIFIED until separate Source Verifier runs

player + SourceRegistry + D1 My Playlist
      └── unchanged
```

This lane is distinct from the existing `Xtream loaded` local lane. The local lane can only inspect a catalog that is already loaded in Playlist Manager. `Authorized Xtream` may explicitly inspect additional saved accounts without first loading their full catalogs into the normal playlist UI.

### Authorization and credential boundary

The lane reuses the existing Xtream Bridge APIs:

```text
GET /api/accounts
GET /api/accounts/{accountId}/channels
```

Those APIs already require a trusted-device session. Xtream usernames/passwords remain encrypted in the existing bridge storage and are decrypted only inside the bridge when contacting the authorized provider.

Discovery receives only:

```text
accountRef
server metadata
streamId
signed WebTV bridge playback URL
channel metadata
```

Discovery candidate context intentionally contains:

```text
username = ""
password = ""
```

Credentials must never be copied into Discovery state, verifier payloads, logs, localStorage/sessionStorage, or the browser-visible source URL.

### Bounded expansion contract

```text
Maximum saved accounts inspected        3
Maximum channels inspected/account      5000
Maximum returned candidates             8
```

Each account catalog call remains bounded by the existing Xtream client/bridge request timeout. `Cancel Search` stops orchestration cooperatively between account calls; Phase 4.6 does not claim mid-request cancellation of an already-running Xtream Bridge catalog request.

### Matching semantics

Matching remains conservative and is based on normalized selected-channel identity against Xtream channel identifiers/names. Benign trailing labels may be normalized:

```text
HD
TV
Greece
Greek
GR
```

Examples:

```text
MEGA ↔ MEGA HD      accepted
MEGA ↔ MEGA TV      accepted
MEGA ↔ MEGA News    rejected
```

No fuzzy category-wide matching is allowed.

### Candidate contract

A matched result enters temporary Discovery state as:

```text
sourceType          = xtream
discoveryProvider   = authorized-xtream-expansion
matchConfidence     = HIGH
verificationStatus  = UNVERIFIED
freshness           = authorized-account-live-catalog
xtreamAccountRef    = saved account id
xtreamStreamId      = provider stream id
```

The source URL is the signed WebTV Xtream Bridge URL, not the provider URL containing username/password. Candidate display continues to redact Xtream source details.

The normal Source Verifier receives only the existing public verification payload (`candidateId`, `sourceType`, signed `sourceUrl`, approved headers). Xtream account context and credentials are not added to the verifier payload.

### Verification and promotion boundary

Authorized account ownership is not equivalent to stream verification. The flow remains:

```text
authorized account
→ bounded catalog match
→ temporary Xtream candidate
→ separate Source Verifier
→ VERIFIED / FAILED / DRM / timeout result
→ no persistence yet
```

Phase 5 remains the sole owner of explicit Save / Promote behavior.

### Hard Phase 4.6 prohibitions

Authorized Xtream Expansion must not:

- discover or scrape public Xtream credentials
- create a second Xtream credential store
- expose username/password in browser state or logs
- embed raw provider credentials in candidate URLs
- bypass trusted-device authorization
- treat a catalog match as VERIFIED
- save a candidate to D1
- call `WebTVMyPlaylistAPI`
- mutate `SourceRegistry`
- call the normal player
- write route health
- change permanent MANUAL/AUTO source order
- run automatically in the background

### Regression gate

Phase 4.6 adds:

```text
tests/authorized-xtream-discovery.test.mjs
```

The deterministic regression proves:

- account expansion is capped at three authorized accounts
- stream inspection and candidate caps are fixed
- `MEGA` matches `MEGA HD` but not `MEGA News`
- candidates remain `xtream` / HIGH / UNVERIFIED
- accountRef and streamId survive candidate creation
- username/password fields remain empty
- serialized Discovery output contains no encrypted credential field names or fixture password
- cancellation is honored before/between account calls

The browser smoke now exercises:

```text
Local
→ Curated
→ GitHub
→ Recent Web
→ STRM
→ Official
→ Authorized Xtream
→ Verify
```

and confirms that the authorized Xtream result enters the same separate verifier path while sidebar/player sentinels remain unchanged.

### Production evidence boundary

CI must not enumerate a user's private authorized Xtream accounts merely to prove this feature. Therefore the Phase 4.6 production gate is privacy-preserving:

- final-head PR CI must pass the deterministic authorized-account expansion test
- Chrome smoke must pass with a trusted-session fixture and signed bridge URL fixture
- the existing production `webtv-xtream` bridge must remain healthy with Registry binding and HLS proxy enabled
- the public WebTV Xtream mock provider may be used to prove the Xtream catalog surface independently of personal credentials
- main-branch CI and Pages deployment must remain green

A personal account catalog is tested only when the user explicitly presses `Search Authorized Xtream` in an authenticated WebTV session. Lack of CI access to private account catalogs is an intentional privacy boundary, not a failed production gate.

Provider #6 is complete only after final-head PR CI, canonical manual append, merge, main-branch CI, Pages deployment and the privacy-preserving Xtream live checks all succeed.
