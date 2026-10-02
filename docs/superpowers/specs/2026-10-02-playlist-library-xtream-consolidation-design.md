# Playlist / Library / Xtream Management Consolidation Design

Date: 2026-10-02
Repository: tonis1000/WebV2
Status: DRAFT FOR REVIEW
Canonical context: main/WEBV2_CURRENT.md

## Problem

The production Playlist / Library / Xtream area now has a verified canonical Xtream preview/save architecture, but one legacy compatibility layer still duplicates ownership.

The duplicate layer is `src/xtream-enhancements.js`. It currently owns three behaviors:

1. a second `Save Xtream Playlist` persistence path for already-saved Xtream accounts;
2. a second Xtream → My Playlist merge/save dialog that intercepts `#my-playlist-channel-action`;
3. presentation/load decoration for Saved Xtream Library cards:
   - person icon;
   - `Load live` wording;
   - hidden Export;
   - loading a Saved Xtream marker through the saved account instead of treating the marker M3U as normal media.

The first two behaviors overlap with newer canonical owners and should be retired. The third remains useful, but should be owned directly by Playlist Manager / Library rendering instead of a separate DOM-observer compatibility module.

## Approved product decisions

The user explicitly approved:

- retire legacy `Save Xtream Playlist`;
- Full Xtream Account persistence is available only through:
  `Test / Preview → Verify selected channel → Save Full Xtream Account`;
- retire the legacy Xtream → My Playlist merge dialog;
- verified channel persistence is available only through the canonical `Save Channel…` destination flow;
- preserve the useful Library behavior for already-saved Xtream account markers;
- move that Library behavior into Playlist Manager so `src/xtream-enhancements.js` can be removed from the production entrypoint and, if no remaining consumers exist, deleted.

## Goals

1. One persistence owner for full Xtream accounts.
2. One persistence owner for verified Xtream channels.
3. One rendering/load owner for Saved Playlist Library cards.
4. Preserve current D1 truth, IndexedDB reconciliation, secure Xtream account ownership and large-catalog behavior.
5. Reduce runtime DOM interception, mutation-observer patching and duplicate Registry/IndexedDB write logic.
6. Preserve backward compatibility for existing Saved Xtream Library markers already stored in D1/cache.

## Non-goals

This change does not:

- redesign the Playlist Manager visually;
- alter My Playlist D1-primary semantics;
- alter Custom Saved Playlist schema or membership semantics;
- alter Xtream credential storage or preview-token security;
- alter Source Verifier behavior;
- alter Unified Search, Hunt, Player or EPG ownership;
- flatten full Xtream provider catalogs into D1 playlist channel rows;
- delete unrelated legacy Discovery Local files;
- change account authentication or Registry PIN behavior.

## Current ownership

### Canonical owners that remain

`src/xtream-ui.js`
- new account credentials form;
- Test / Preview;
- bounded catalog browsing/filtering;
- verify selected preview channel;
- dispatch explicit Save Channel / Save Full Account requests;
- saved-account selector;
- load selected saved account into temporary sidebar;
- delete saved Xtream account;
- bridge settings and auth diagnostics.

`src/xtream-save-destination-ui.js`
- canonical verified channel save destination UI;
- My Playlist / existing Custom / New Custom;
- Selected source / All known sources.

`src/xtream-full-account-ui.js` + `src/xtream-full-account-save.js`
- canonical verified full-account persistence;
- secure account materialization from preview;
- Library marker write;
- compensation if Library marker write fails.

`src/cloud-read-sync.js`
- reconciled Saved Playlist snapshot/cache read ownership.

`src/playlist-manager.js`
- Saved Playlist Library rendering;
- temporary load / export / rename / delete behavior;
- My Playlist management.

### Legacy owner to retire

`src/xtream-enhancements.js`

It currently duplicates persistence and patches Playlist Manager rendering after the fact using a global MutationObserver and capture-phase click interception.

## Target architecture

### Full-account save

Only:

`xtream-ui.js`
→ verified preview candidate
→ `webtv:xtream-preview-save-account-request`
→ `xtream-full-account-ui.js`
→ `xtream-full-account-save.js`
→ secure Xtream account storage + Saved Playlist marker

The old `saveXtreamPlaylist()` path is removed.

### Verified channel save

Only:

`xtream-ui.js`
→ verified preview candidate
→ `webtv:xtream-preview-save-channel-request`
→ `xtream-save-destination-ui.js`
→ tested destination orchestration

The old capture-phase interception of `#my-playlist-channel-action` is removed.

This means selecting a channel from a loaded saved Xtream account does not expose a hidden second Xtream-specific save dialog. Persistence of previewed Xtream channels remains explicit through the verified Preview flow.

### Saved Xtream Library cards

Playlist Manager becomes the direct owner of Saved Xtream card behavior.

When rendering a Saved Playlist item with:

- `type === 'xtream'`, and
- `url/sourceUrl` in the form `xtream:<accountId>`,

Playlist Manager renders it as an account-backed Library entry:

- Xtream/person icon;
- Load action labelled `Load live`;
- Export hidden or omitted;
- Load action delegates to a narrow Xtream public API that loads that exact saved account into the temporary sidebar.

No title-text matching is used to recover account identity. The account ID comes from the Saved Playlist data model.

## Public loading contract

Playlist Manager should not manipulate the Xtream account selector as hidden UI state.

Add a narrow API to `window.WebTVXtream`:

`loadAccountById(accountId)`

Expected behavior:

- validate non-empty account ID;
- ensure trusted-device access using existing Xtream UI auth path;
- load the account channels through existing `loadXtreamChannels(accountId)`;
- reuse the same temporary-sidebar application logic as the current selected-account load;
- render the same loaded-account preview;
- update Xtream status consistently;
- not persist anything;
- not mutate My Playlist, Custom Playlists or Player except through the existing temporary-sidebar selection behavior;
- not require the account to first be selected in `#xtream-account-select`.

The existing `loadSelectedAccount()` should call the same internal load-by-id implementation so there is one load path.

## Saved Playlist model compatibility

Existing Xtream Library markers remain valid.

A cached Saved Xtream item currently has approximately:

- `id = xtpl_<accountId>`
- `type = 'xtream'`
- `url = 'xtream:<accountId>'`
- marker M3U text
- channel/group counts

The consolidation must not require a D1 migration.

Playlist Manager derives the account ID from the explicit marker reference:

`xtream:<accountId>`

If the marker refers to an account that no longer exists:

- Load live fails with a clear status;
- the Library entry remains visible until the user deletes it;
- no automatic destructive cleanup is performed in this slice.

## Export behavior

Full Xtream Account Library entries remain account references, not exported provider catalogs.

Therefore the normal `Export` action is not shown for `type='xtream'`.

This preserves the existing product behavior from `xtream-enhancements.js` and avoids exporting the synthetic marker M3U as if it were a useful channel playlist.

## Rename and delete behavior

Rename remains owned by Playlist Manager and updates the Saved Playlist marker metadata only.

Delete remains owned by Playlist Manager for the Library marker.

This consolidation does not change whether deleting a Library marker should also delete the secure Xtream account. Account deletion remains an explicit action in Xtream account management. No new cascade is introduced here.

## Removal scope

After replacement behavior is covered by tests:

- remove `import './xtream-enhancements.js...'` from `src/registry-default.js`;
- delete `src/xtream-enhancements.js` if repo-wide consumer search proves no remaining imports/workflow dependencies;
- add a permanent regression ensuring it does not return to the production entrypoint.

No unrelated cleanup is bundled into this deletion.

## Security boundaries

The consolidation must preserve:

- raw username/password never stored in Saved Playlist markers;
- preview tokens never rendered or placed in Library rows;
- full account save requires the verified preview policy;
- Saved Xtream Library Load live is read/load behavior only;
- no new Registry write path is introduced;
- no direct duplicate IndexedDB writer is introduced;
- no Unified Search/Hunt/network discovery at save time.

## Performance boundaries

Removing `xtream-enhancements.js` should reduce runtime overhead by eliminating its document-wide MutationObserver used to re-mark Saved Playlist cards.

Playlist Manager renders the correct card shape once from typed data.

Large Xtream catalog bounded rendering remains unchanged.

## Failure behavior

- Missing saved account during Load live: show error, do not alter Saved Playlist data.
- Xtream bridge/network failure: propagate existing load error and leave current catalog/player state consistent with existing load behavior.
- Malformed `xtream:` marker without account ID: render as invalid/non-loadable Xtream entry or fail clearly on Load live; do not fall back to applying its synthetic marker M3U as a real playlist.
- Canonical preview save failure behavior remains unchanged.

## Verification strategy

### RED-first ownership tests

Add/extend tests proving:

1. `registry-default.js` no longer imports `xtream-enhancements.js`;
2. no production code contains the legacy `Save Xtream Playlist` button/handler;
3. no production code contains the legacy `xtream-merge-overlay` / capture interception;
4. Playlist Manager recognizes typed Xtream Saved Playlist rows and renders:
   - Xtream icon,
   - `Load live`,
   - no Export;
5. Playlist Manager derives account identity from `xtream:<accountId>`, not card title matching;
6. `WebTVXtream.loadAccountById(accountId)` exists and both direct Saved Library loading and account-selector loading share the same core loader;
7. Saved Xtream loading performs no persistence;
8. existing preview/full-account/channel-save tests remain green.

### Regression suites

At minimum:

- Validate Xtream Save Destination
- Validate Xtream Save Destination UI
- Validate Xtream Full Account
- Validate WebTV Frontend
- Playlist Manager dialog ownership
- Xtream preview ownership contract
- non-blocking startup
- frontend integration audit

### Live acceptance

After merge/deploy, prove on production Pages:

1. no `Save Xtream Playlist` legacy button;
2. no legacy Xtream→My Playlist merge dialog;
3. Preview → Verify → Save Channel remains functional;
4. Preview → Verify → Save Full Xtream Account remains functional;
5. resulting Saved Xtream card shows account-backed presentation;
6. `Load live` loads the saved account into the temporary sidebar;
7. Export is absent for Xtream account markers;
8. My Playlist / Custom / Player behavior is unchanged outside explicit actions;
9. no console/page errors.

If paid browser automation is unavailable, use a bounded GitHub Actions Playwright verification workflow and keep it verification-only unless a reusable permanent regression is justified.

## DONE criteria

This slice is DONE only when:

- duplicate legacy persistence paths are removed;
- Saved Xtream card behavior has a direct canonical owner in Playlist Manager;
- `xtream-enhancements.js` has no production consumer and is deleted;
- focused and full regressions pass;
- exact merged SHA is deployed;
- production live verification passes;
- Project Brain records the new ownership and deletion evidence.

## Rollback

Rollback is a normal revert of the consolidation PR.

No D1 schema migration is involved, and existing Xtream Saved Playlist markers remain compatible, so rollback does not require data migration.
