
---

## 29. Source Discovery V2 Phase 5.2 · New Xtream Explicit Choice · 2026-09-26

Phase 5.2 extends explicit promotion to a **new user-authorized Xtream login** without silently saving the full account.

The user receives a real persistence choice only after a temporary preview candidate has passed the separate Source Verifier:

```text
New Xtream credentials
        │
        │ explicit Test New Xtream
        ▼
secure Xtream Bridge
        │
        ├── validate provider login
        ├── load bounded live catalog
        └── issue short-lived encrypted preview token
                    │
                    ▼
           temporary candidates
                    │
                    ▼
            Source Verifier
                    │
                    ▼
                VERIFIED
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
[Add only this channel] [Save Full Xtream Account]
```

### Credential boundary

The Discovery form accepts:

```text
server
username
password
optional account name
```

These values are read only for the explicit preview request and sent directly to the trusted Xtream Bridge. After the request completes, the username and password fields are cleared.

Discovery candidate/state does **not** retain raw username/password. It retains only:

```text
opaque encrypted preview token
public server metadata
streamId
preview expiry timestamp
temporary bridge playback URL
```

The display layer redacts both the temporary source URL and the opaque token.

No Phase 5.2 credential is written to `localStorage` or to a Discovery candidate as plaintext.

### Temporary preview contract

The Xtream Worker router adds:

```text
POST /api/preview
GET  /preview-stream/{streamId}.m3u8?t=<opaque-token>
```

`POST /api/preview` requires a trusted-device WebTV session. It validates the supplied Xtream login against the provider, loads a bounded live catalog, and returns a preview token encrypted with the existing `XTREAM_ENCRYPTION_KEY`.

The preview token contains the credential envelope server-side/client-opaque and expires after **10 minutes**. An expired token is refused and the user must test the account again.

The temporary preview URL is only for verification. It is explicitly blocked from the generic `Add this source` promotion path.

The preview token can appear in a temporary playback URL and therefore may pass through ordinary browser/network URL handling, but it is opaque encrypted material, has a short TTL, and is not a reusable plaintext credential.

### Add only this channel

After the preview candidate is VERIFIED, the explicit action:

```text
[Add only this channel]
```

calls:

```text
POST /api/channel-sources
```

with only the opaque preview token and the selected `streamId`.

The bridge decrypts the preview token server-side and persists a channel-scoped encrypted secret in:

```text
xtream_channel_sources
```

with the effective contract:

```text
id
name
server
username_enc
password_enc
stream_id
created_at
updated_at
```

Raw credentials are never returned to the browser.

The bridge then returns a permanent signed playback URL:

```text
/channel-stream/{sourceId}/{streamId}.m3u8?s=<signature>
```

Only that permanent channel URL is passed to the existing `source-save-policy.js` and persisted into My Playlist.

Therefore channel-only promotion means:

```text
1 encrypted channel-scoped Xtream secret
1 My Playlist source write
0 full Xtream account writes
```

The channel-scoped secret is not listed as a normal saved Xtream account.

### Save Full Xtream Account

The alternative explicit action:

```text
[Save Full Xtream Account]
```

calls:

```text
POST /api/accounts/from-preview
```

The bridge decrypts the preview token server-side, revalidates the provider login, and stores the credentials encrypted in the existing `xtream_accounts` table using the same account persistence semantics as the legacy Xtream save path.

This action does **not** automatically add the currently matched channel to My Playlist.

Therefore full-account promotion means:

```text
1 encrypted full-account Xtream write
0 automatic My Playlist writes
```

The existing account list and normal Xtream catalog workflow can then use the account later.

### Worker isolation

The existing `workers/webtv-xtream.js` implementation remains the legacy core.

Phase 5.2 adds:

```text
workers/webtv-xtream-router.js
workers/xtream-preview-routes.js
```

The router handles only the Phase 5.2 route family. Every other request is delegated to the existing Worker unchanged.

This keeps the legacy account, catalog, playback and HLS proxy behavior outside the new feature surface.

### Playback secrecy

Both temporary preview playback and permanent channel-only playback proxy provider HLS through WebTV.

Provider username/password are used only server-side when constructing the upstream Xtream URL. HLS manifests are rewritten so segment/key references pass through the bridge proxy. Returned manifests must not expose provider credentials.

Permanent channel playback uses a signed channel URL and reloads encrypted channel credentials from D1 only inside the Worker.

### Explicit-choice invariant

Phase 5.2 browser coverage proves:

```text
Test New Xtream               → 0 My Playlist writes
                               → 0 channel-secret writes
                               → 0 full-account writes
                               → username/password fields cleared

Verify preview                → 0 persistence writes

Add only this channel         → 1 channel-secret write
                               → +1 My Playlist write/reload
                               → 0 full-account writes

Save Full Xtream Account      → +1 full-account write
                               → 0 additional My Playlist writes
```

The two save choices are therefore behaviorally distinct rather than two labels for the same account-save operation.

### Existing authorized accounts

Phase 5.1 behavior remains unchanged for accounts already stored in the secure bridge:

```text
[Add this source]
[Keep Full Xtream Account]
```

Phase 5.2 does not convert an already-authorized account into the temporary preview workflow.

### Wrong-channel and verification guards

A new Xtream preview can be persisted only when:

```text
sourceType === xtream-preview
verificationStatus === VERIFIED
verified === true
preview token exists
streamId exists
preview has not expired
Discovery channel still matches the currently selected channel
```

If the user changes the selected channel after opening Discovery, both Phase 5.2 persistence actions are blocked until the correct channel context is re-established.

### Hard Phase 5.2 prohibitions

Phase 5.2 must not:

- save a new Xtream account merely because credentials were tested
- save an UNVERIFIED preview candidate
- pass a temporary preview URL through generic `Add this source`
- store raw Xtream username/password in Discovery state, candidate objects or localStorage
- return raw credentials from preview, channel-only or full-account APIs
- make channel-only promotion create a normal full Xtream account
- make full-account promotion add a channel to My Playlist automatically
- persist after preview or verification without an explicit user action
- bypass the stale/wrong-channel guard
- change normal player/sidebar state during preview/search/verification
- expose provider credentials in rewritten HLS manifests

### Regression gates

Phase 5.2 adds deterministic coverage for:

```text
tests/new-xtream-preview.test.mjs
tests/xtream-preview-routes.test.mjs
```

and extends:

```text
tests/discovery-promotion.test.mjs
tests/discovery-browser-smoke.html
```

The tests prove that:

- preview candidates contain no raw username/password
- display output redacts the opaque token and temporary preview URL
- unauthenticated preview requests are refused
- preview HLS output does not expose credentials
- channel-only D1 credentials are encrypted
- permanent channel playback does not expose credentials
- full-account-from-preview credentials are encrypted
- generic promotion refuses `xtream-preview`
- the two explicit save choices have separate write boundaries
- player/sidebar sentinels remain unchanged

### Production verification boundary

Automated production verification must not use or invent a real Xtream account and must not write to the user's real My Playlist.

The live deployment gate therefore verifies only the public/auth boundary:

```text
legacy /api/status                     → healthy existing Xtream bridge
OPTIONS /api/preview                   → 204
unauthenticated POST /api/preview      → 401
```

A real provider preview occurs only when the user explicitly supplies their own authorized Xtream credentials in the WebTV UI.

Phase 5.2 is complete only after final-head PR CI, canonical §29 append, merge, main-branch CI, live Xtream deployment gate and Pages deployment all succeed.
