
---

## 30. Source Discovery V2 Phase 5.3 · Xtream Channel-Source Lifecycle · 2026-09-26

Phase 5.3 closes the lifecycle of the channel-only Xtream sources introduced in Phase 5.2.

The goal is narrow:

```text
channel-only Xtream source saved
        ↓
encrypted xtream_channel_sources row
        ↓
permanent /channel-stream/xch_... URL in My Playlist
        ↓
user later removes that source/channel
        ↓
remove encrypted row only when it is truly orphaned
```

Phase 5.3 does not change full Xtream account persistence, Discovery search, verification, player routing, sidebar behavior, Registry storage semantics, or source ranking.

### Primary-write-first invariant

The My Playlist change remains the primary user operation.

Cleanup runs only after the requested My Playlist write/removal has succeeded.

For example:

```text
Remove channel
    ↓
DELETE My Playlist channel succeeds
    ↓
refresh My Playlist
    ↓
consider removed Xtream channel-only URLs for cleanup
```

and:

```text
Edit / Sources editor
    ↓
replace My Playlist sources succeeds
    ↓
refresh My Playlist
    ↓
compare previous URLs with current URLs
    ↓
consider only URLs that disappeared
```

A cleanup failure must not roll back or falsify an already successful My Playlist operation.

The browser lifecycle helper therefore reports cleanup failures separately and logs them as best-effort cleanup failures while leaving the committed My Playlist state intact.

### Cleanup candidates

Phase 5.3 considers only removed URLs that belong to the configured WebTV Xtream Bridge and match the permanent channel-only route:

```text
/channel-stream/{xch_id}/{streamId}.m3u8
```

The helper extracts only IDs matching:

```text
xch_[A-Za-z0-9_-]{8,64}
```

URLs from another origin are ignored, even if their path resembles a WebTV channel-stream URL.

Duplicate references to the same `xch_...` ID are collapsed before cleanup calls.

Temporary Phase 5.2 preview URLs are not lifecycle-delete candidates.

Full-account `/stream/{accountId}/{streamId}.m3u8` routes are not lifecycle-delete candidates.

### Frontend lifecycle helper

Phase 5.3 adds:

```text
src/xtream-channel-lifecycle.js
```

Its responsibilities are deliberately small:

```text
diffRemovedUrls(previousUrls, currentUrls)
extractXtreamChannelSourceIds(removedUrls)
cleanupRemovedXtreamChannelSources(removedUrls)
```

It does not decide whether an encrypted secret is truly orphaned. It only identifies candidate `xch_...` IDs and asks the trusted Xtream Bridge to perform the authoritative check.

### Removal paths covered

The existing `playlist-manager.js` invokes the lifecycle helper after successful writes from all user-facing source-removal paths:

```text
Remove channel
Edit channel
Sources editor → Save Sources
```

For Edit and Sources editor, the previous D1 URLs are captured before the replacement write and compared with the new URL list after the write succeeds.

For whole-channel removal, the current D1 row is read before deletion so the URLs being removed are known even after the channel disappears from My Playlist.

### Trusted cleanup endpoint

The Xtream Bridge adds:

```text
DELETE /api/channel-sources/{xch_id}
```

The endpoint requires the same trusted-device WebTV session boundary used by other protected Xtream write operations.

An unauthenticated request is refused before any D1 mutation.

### Server-side orphan guard

The browser is not trusted to decide that a channel-only secret is unused.

Because the Xtream Worker and Registry use the same D1 database, the Worker performs the authoritative active-reference check immediately before deletion.

Conceptually:

```sql
SELECT COUNT(*)
FROM channel_sources s
JOIN my_playlist m ON m.channel_id = s.channel_id
WHERE s.enabled = 1
  AND s.url references /channel-stream/{xch_id}/
```

If the count is greater than zero:

```text
deleted = false
reason = still-referenced
references = N
```

and the encrypted row is retained.

If the count is zero, the Worker deletes only the matching row from:

```text
xtream_channel_sources
```

This means a channel-only secret cannot be removed merely because one browser view believes it is unused.

### Shared-source safety

The reference guard protects the case where the same channel-only Xtream secret is referenced by more than one active My Playlist channel/source entry.

Removing one reference produces:

```text
references > 0
→ retain secret
```

Only removal of the last active My Playlist reference can produce:

```text
references = 0
→ delete encrypted secret
```

### Idempotency

Cleanup is idempotent.

If the requested `xch_...` row no longer exists, the Worker returns a non-error result equivalent to:

```text
deleted = false
reason = not-found
references = 0
```

This allows repeated cleanup attempts without turning an already-clean state into an application error.

### Failure isolation

The lifecycle helper handles each candidate secret independently.

A failure for one cleanup ID does not prevent another candidate from being processed.

The result is separated into:

```text
cleaned
retained
failed
```

Most importantly:

```text
My Playlist write succeeded
        +
Xtream cleanup failed
        =
My Playlist write remains committed
```

The UI/log must not claim that the user removal failed merely because secondary secret cleanup failed.

### Full-account isolation

Phase 5.3 does not delete or modify rows in:

```text
xtream_accounts
```

It also does not inspect or clean normal saved-account playback routes.

The lifecycle endpoint is scoped only to `xch_...` channel-only records created by Phase 5.2.

### Security boundary

Phase 5.3 never sends provider username/password to the cleanup endpoint.

The cleanup request contains only the opaque channel-source ID in the route.

The encrypted credentials remain server-side in D1 until the Worker has proved there are zero active My Playlist references and deletes the row.

### Hard Phase 5.3 prohibitions

Phase 5.3 must not:

- delete a channel-only secret before the corresponding My Playlist write succeeds
- treat the browser as the authoritative orphan checker
- delete an `xch_...` row while an active My Playlist source still references it
- delete a full Xtream account
- consider foreign-origin lookalike URLs as WebTV channel-only sources
- consider temporary preview URLs as permanent cleanup targets
- roll back a successful My Playlist edit because secondary cleanup failed
- mutate player/sidebar state as part of cleanup
- perform authenticated destructive cleanup in production CI

### Regression gates

Phase 5.3 adds:

```text
tests/xtream-channel-lifecycle.test.mjs
tests/xtream-channel-cleanup-route.test.mjs
```

The lifecycle helper regression proves:

- previous/current URL diffing identifies only removed URLs
- only same-bridge permanent channel-stream URLs yield `xch_...` IDs
- duplicate IDs are collapsed
- deleted, retained and failed results remain separate
- per-ID cleanup failures are isolated

The Worker route regression proves:

- unauthenticated DELETE is rejected
- active references retain the encrypted row
- zero active references delete the encrypted row
- repeated deletion is idempotent
- malformed channel-source IDs are rejected

The full frontend validation suite continues to run the existing Phase 5 browser smoke and frontend integration audit after the lifecycle regressions.

### Production verification boundary

Production CI must not guess a real `xch_...` ID and must not delete real user data.

The Xtream deployment live gate therefore verifies only the authentication boundary with a non-production fixture-shaped ID:

```text
unauthenticated DELETE /api/channel-sources/xch_livegate... → 401
```

The live gate also keeps the existing Phase 5.2 checks:

```text
/api/status                        → healthy legacy bridge
OPTIONS /api/preview              → 204
unauthenticated POST /api/preview → 401
```

A real lifecycle deletion occurs only after the user explicitly removes a real channel-only source from My Playlist in an authenticated WebTV session.

Phase 5.3 is complete only after final-head PR CI, canonical §30 append, merge, main-branch CI, live Xtream deployment gate and Pages deployment all succeed.
