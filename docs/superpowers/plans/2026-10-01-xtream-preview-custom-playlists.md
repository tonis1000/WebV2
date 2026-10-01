# WebV2 Xtream Preview + Custom Saved Playlists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehome safe New Xtream preview into production Xtream account management, add mixed-source Custom Saved Playlists with playlist-specific source ownership, preserve strict preview/promotion security, and keep large Xtream catalogs responsive.

**Architecture:** Keep My Playlist, existing source-backed Saved Playlists, Player, Unified Search, Phase C EPG and Phase D promotion ownership unchanged. Extend the existing Registry-backed Library with `kind=custom` normalized child tables; make `src/xtream-ui.js` the production owner of Test/Preview and explicit persistence; keep full Xtream accounts live/account-backed; use bounded catalog rendering and deterministic large mock catalogs for no-freeze proof.

**Tech Stack:** Vanilla ES modules, Cloudflare Workers + D1, IndexedDB cache for Saved Playlist list metadata, existing Xtream bridge/preview token contract, existing Source Verifier client, Node `.mjs` regression tests, GitHub Actions and GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-01-xtream-preview-custom-playlists-design.md`

## Preflight State Used For This Plan

- GitHub `main` before this plan: `e06fcfc84b4d7bde5c702e9d89a3c4e50c919dbc`.
- Full canonical `WEBV2_CURRENT.md` was re-read before planning and still names New Xtream preview ownership as the next safe audit action.
- `/api/project-status` and `/api/project-checkpoints` were attempted again but are not readable through the available web tool, so this plan does **not** claim checkpoint SHA or deployed SHA equality from direct endpoint readback.
- Exact `e06fcfc...` action query showed GitHub Pages #460 SUCCESS and Deploy WebTV Registry Worker #102 SUCCESS. This docs-only head is not treated as evidence that Xtream runtime changed.
- Relevant workflows inspected: `validate-frontend.yml`, `deploy-webtv-registry.yml`, `deploy-webtv-xtream.yml`, `deploy-webtv-xtream-mock.yml`.

## Global Constraints

- GitHub `main/WEBV2_CURRENT.md` remains canonical project-state truth; `main` is never assumed to equal production.
- DONE means implemented + deployed + actually verified at exact relevant SHA(s).
- My Playlist remains D1-primary and its current `channels` / `my_playlist` / `channel_sources` ownership is not migrated.
- Existing source-backed Saved Playlists remain D1-authoritative with IndexedDB reconciliation.
- `kind=custom` D1 rows are authoritative; IndexedDB may cache list metadata only and must not become a second authority for custom channel/source membership.
- Phase C EPG identity/profile ownership remains unchanged and fail-closed ambiguity remains intact.
- Phase D import/promotion remains the canonical identity boundary for temporary/imported channels.
- Unified Search remains the only automatic discovery surface; Save actions never launch Unified Search/discovery.
- Player state must not change during Test/Preview, verification, destination selection, or save. Only an explicit Play action may change playback.
- Raw Xtream username/password and opaque preview tokens must never be stored in Saved Playlist content, rendered in normal UI, copied into logs, or serialized into public candidate state.
- Preserve the current stricter preview-promotion safety gate: persistence from a New Xtream preview requires a VERIFIED preview candidate, a non-expired token, a stream ID, and the expected channel identity. Do not weaken this gate silently.
- Full-account save also uses the existing VERIFIED preview-choice gate in this implementation. Changing that policy later requires a separate approved design.
- Existing preview ceiling of 5,000 streams remains a safety ceiling, not a render target.
- No whole-library migration, no new provider EPG schedule engine, no country inference, no broad Player/UI redesign in this work.

## Resolved Implementation Decisions

### Custom D1 schema

Create lazily with `CREATE TABLE IF NOT EXISTS` in the Registry Worker:

```sql
CREATE TABLE IF NOT EXISTS playlist_channels (
  playlist_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tvg_id TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL DEFAULT 'Other',
  position INTEGER NOT NULL DEFAULT 999999,
  provider_epg_id TEXT NOT NULL DEFAULT '',
  provider_category TEXT NOT NULL DEFAULT '',
  provider_origin TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (playlist_id, channel_id)
);

CREATE TABLE IF NOT EXISTS playlist_channel_sources (
  playlist_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  url TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 100,
  provider_account_id TEXT NOT NULL DEFAULT '',
  provider_epg_id TEXT NOT NULL DEFAULT '',
  provider_category TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (playlist_id, channel_id, url)
);
```

Do not introduce foreign-key enforcement in this slice. Parent-kind validation and explicit child cleanup remain Worker-owned so existing production D1 behavior is not changed globally.

### Custom Playlist API

- `POST /api/playlists` accepts `kind:'custom'` with no `rawM3u`; old kinds still require valid `#EXTINF` content.
- `GET /api/playlists/:id/channels` returns custom channel rows with nested sources.
- `PUT /api/playlists/:id/channels/:channelId` upserts one canonical channel and merges or replaces the supplied source set in one D1 batch after confirming parent `kind='custom'`.
- `DELETE /api/playlists/:id/channels/:channelId` removes one custom membership and its playlist-local sources in one batch.
- `GET /api/playlists/:id/export.m3u` projects current D1 custom state to M3U without making the M3U authoritative.
- `DELETE /api/playlists/:id` removes custom child sources + channels + parent in one batch when the parent is custom; existing kinds keep current deletion behavior.

### Known-source meaning for this slice

`Save with all known sources` may read only already-materialized/known sources from:

1. the selected VERIFIED Xtream source being saved;
2. current My Playlist sources for the same canonical channel;
3. existing Custom Saved Playlist sources for the same canonical channel through the Registry owner API;
4. current in-memory/loaded catalog `directUrls` only when they already belong to the same canonical channel identity.

It must **not** parse every unopened raw Saved Playlist, invoke Local scan, Unified Search, Discovery, Source Hunt, or the network to discover more. Mining archived raw Saved Playlists belongs to the later Local ownership audit, not this implementation.

### Large-catalog rendering threshold

- `XTREAM_PAGE_SIZE = 100` maximum rendered channel entries at one time.
- Text filter input is debounced at 150 ms.
- Group/category changes and query changes use a monotonically increasing render generation; stale work is ignored.
- Account/preview network loads use AbortController where the existing client supports it; starting another account/catalog load aborts or supersedes the previous one.
- Channel logos use `loading="lazy"` and only exist for the visible page.
- Structural acceptance: a 5,000-channel fixture never creates more than 100 channel rows for the catalog page.
- Live acceptance: opening/filtering/paging the 5,000-channel mock must remain interactable without a visible multi-second freeze. If browser performance tooling is available, investigate any catalog-render long task above 250 ms rather than accepting it silently.

## Review Focus

- Preview expires between verification and Save: persistence must fail closed and leave no destination write.
- Xtream channel secret is materialized but destination write fails: run compensating `deleteXtreamChannelSource`; no orphan should remain when reference count is zero.
- The same canonical channel exists in two Custom Saved Playlists: each playlist must keep its own independent source set.
- A 5,000-channel preview/filter/page interaction: rendered rows remain bounded to 100 and stale filter/account work cannot overwrite newer state.
- Deleting a Custom Playlist/channel containing an Xtream channel source: Xtream secret cleanup must count references from both My Playlist and Custom Saved Playlists before deleting the encrypted secret.
- Full account is saved but creation of its Library marker fails: run compensating account deletion for the just-created account and report failure rather than presenting a half-saved success.

---

### Task 1: Registry Custom Playlist Persistence Contract

**Files:**
- Modify: `workers/webtv-registry.js`
- Create: `tests/custom-playlist-registry.test.mjs`
- Modify: `.github/workflows/validate-frontend.yml`

**Interfaces:**
- Existing `POST /api/playlists` stays backward compatible.
- New routes: `GET/PUT/DELETE /api/playlists/:id/channels...`, `GET /api/playlists/:id/export.m3u`.
- Produces playlist-specific channel/source membership and generated M3U projection.

- [ ] **Step 1: Write a fake-D1 Registry test harness** in `tests/custom-playlist-registry.test.mjs` covering existing source playlist creation plus new `kind=custom` creation without `rawM3u`.
- [ ] **Step 2: Add failing tests** that old non-custom playlist creation without `#EXTINF` still rejects, while `kind=custom` succeeds with zero channels.
- [ ] **Step 3: Add failing tests** for custom channel upsert with one source, duplicate upsert dedupe, merge of a second source, and `replaceSources:true` replacing only that playlist/channel source set.
- [ ] **Step 4: Add failing isolation test** showing the same `channel_id` in Custom Playlist A and B can hold different source URLs.
- [ ] **Step 5: Add failing tests** for custom channel delete, custom playlist delete cascading its child rows, and generated export M3U containing current child rows but not becoming stored truth.
- [ ] **Step 6: Run** `node tests/custom-playlist-registry.test.mjs` and confirm RED for the new routes/model.
- [ ] **Step 7: Implement `ensureCustomPlaylistTables(env)`** and helper reads/writes in `workers/webtv-registry.js` using the schema above.
- [ ] **Step 8: Change `upsertSavedPlaylist()` minimally** so only `kind==='custom'` may omit `rawM3u`; leave all existing kinds on the current validation path.
- [ ] **Step 9: Implement the new custom routes** with parent-kind checks, normalized `channel_id`, URL validation limited to safe permanent `http/https` playback references, dedupe by composite primary key, and D1 batch writes.
- [ ] **Step 10: Ensure channel + source upsert is one D1 batch** after parent validation; no child write if the parent is missing/non-custom.
- [ ] **Step 11: Implement custom M3U projection** using stored channel/source rows. Never persist the projection back to `raw_m3u`.
- [ ] **Step 12: Run** `node tests/custom-playlist-registry.test.mjs` and confirm GREEN.
- [ ] **Step 13: Add the new test to `validate-frontend.yml`** immediately after Registry regression tests.
- [ ] **Step 14: Run existing Registry/My Playlist tests** including `node tests/project-checkpoint-write-api.test.mjs` and relevant frontend integration tests; confirm no My Playlist semantic change.
- [ ] **Step 15: Commit** `feat: add D1 custom saved playlist membership`.

### Task 2: Frontend Custom Playlist Client and D1-Authoritative Cache Semantics

**Files:**
- Create: `src/custom-playlist-client.js`
- Modify: `src/cloud-read-sync.js`
- Modify: `src/playlist-manager.js`
- Create: `tests/custom-playlist-client.test.mjs`
- Create: `tests/custom-playlist-cache.test.mjs`
- Modify: `tests/startup-nonblocking.test.mjs`
- Modify: `.github/workflows/validate-frontend.yml`

**Interfaces:**
- `listCustomPlaylists()`
- `createCustomPlaylist({name})`
- `getCustomPlaylistChannels(playlistId,{signal})`
- `upsertCustomPlaylistChannel(playlistId,channel,sources,{replaceSources=false})`
- `removeCustomPlaylistChannel(playlistId,channelId)`
- `customPlaylistExportUrl(playlistId)` or equivalent authenticated fetch helper.

- [ ] **Step 1: Write failing client tests** for route/payload shape, auth/session requirement on writes, response normalization, AbortSignal forwarding on reads, and no preview token/username/password accepted into payloads.
- [ ] **Step 2: Run** `node tests/custom-playlist-client.test.mjs` and confirm RED.
- [ ] **Step 3: Implement the small Registry client** in `src/custom-playlist-client.js`; keep Registry URL/token handling consistent with existing owners and do not introduce another auth store.
- [ ] **Step 4: Write failing cache tests** proving `cloud-read-sync.js` keeps a metadata shell for remote `kind=custom` rows even when `rawM3u` is absent, while child channel/source data is not copied into IndexedDB.
- [ ] **Step 5: Add failing startup regression** proving custom metadata reconciliation remains deferred/non-blocking behind `webtv:ready` like current Saved Playlist sync.
- [ ] **Step 6: Run cache/startup tests** and confirm RED.
- [ ] **Step 7: Update `cloud-read-sync.js`**: for custom detail, cache `id/name/type='custom'/counts/timestamps` with empty/non-authoritative `text`; fetch custom channels live from D1 only when opened.
- [ ] **Step 8: Update `playlist-manager.js` rendering** to identify Custom Saved Playlists and load their live D1 child rows through `custom-playlist-client.js`; existing URL/paste Saved Playlist Load/Rename/Export/Delete behavior remains unchanged.
- [ ] **Step 9: Implement Custom Playlist export** through the Registry projection endpoint; do not generate from stale IndexedDB metadata.
- [ ] **Step 10: Run** `node tests/custom-playlist-client.test.mjs`, `node tests/custom-playlist-cache.test.mjs`, `node tests/startup-nonblocking.test.mjs` and confirm GREEN.
- [ ] **Step 11: Add tests to frontend workflow** and run `node tests/frontend-integration.test.mjs`.
- [ ] **Step 12: Commit** `feat: add D1-authoritative custom playlist client and cache shell`.

### Task 3: Reference-Safe Xtream Channel Secret Cleanup Across My + Custom Playlists

**Files:**
- Modify: `workers/xtream-preview-routes.js`
- Modify: `tests/xtream-channel-cleanup-route.test.mjs`
- Modify: `src/xtream-channel-lifecycle.js` only if return metadata must change.
- Modify: `tests/xtream-channel-lifecycle.test.mjs` if needed.

**Interfaces:**
- Existing `DELETE /api/channel-sources/:id` stays reference-safe.
- Reference count expands from My Playlist only to My Playlist + Custom Saved Playlist source membership.

- [ ] **Step 1: Extend cleanup-route test fake D1** to model My Playlist references and `playlist_channel_sources` references independently.
- [ ] **Step 2: Add failing tests**: zero My references + one custom reference must retain secret; one My + one custom returns two references; zero total deletes.
- [ ] **Step 3: Run** `node tests/xtream-channel-cleanup-route.test.mjs` and confirm RED.
- [ ] **Step 4: Update `deleteChannelOnly()`** to ensure custom tables exist where necessary and sum both reference counts using the `/channel-stream/<xch_id>/` needle.
- [ ] **Step 5: Do not let absence of custom tables break old deployments**; lazy table creation or safe empty count is required.
- [ ] **Step 6: Run cleanup + lifecycle tests** and confirm GREEN.
- [ ] **Step 7: Commit** `fix: protect Xtream channel secrets referenced by custom playlists`.

### Task 4: Neutral Xtream Preview Choice Policy and Compensating Writes

**Files:**
- Create: `src/xtream-preview-policy.js`
- Modify: `src/discovery/promotion.js`
- Modify: `tests/discovery-promotion.test.mjs`
- Create: `tests/xtream-preview-policy.test.mjs`
- Modify: `src/xtream-client.js`
- Modify: `tests/xtream-client.test.mjs`

**Interfaces:**
- Move/share pure policy, not Discovery UI ownership.
- `previewChoiceBlockReason(candidate,{now,selectedChannel})`
- `assertPreviewChoice(...)`
- `materializePreviewChannel(candidate,{saveChannel,writeDestination,deleteChannelSource})`
- `materializePreviewAccount(candidate,{saveAccount,writeLibraryEntry,deleteAccount})` or equivalent orchestration helper.

- [ ] **Step 1: Write failing neutral-policy tests** for UNVERIFIED, expired, missing token, missing stream ID and selected-channel drift; preserve exact current fail-closed semantics.
- [ ] **Step 2: Add failing success test** for VERIFIED + unexpired + same-channel candidate.
- [ ] **Step 3: Add failing compensation test**: channel secret materializes, destination write fails, `deleteXtreamChannelSource(id)` is called exactly once.
- [ ] **Step 4: Add failing account compensation test**: account saves from preview, Library marker write fails, `deleteXtreamAccount(id)` is called exactly once for the newly created account.
- [ ] **Step 5: Run** `node tests/xtream-preview-policy.test.mjs` and confirm RED.
- [ ] **Step 6: Implement `src/xtream-preview-policy.js`** with no DOM, no raw credentials and dependency-injected write functions.
- [ ] **Step 7: Refactor `src/discovery/promotion.js`** to consume/re-export the shared preview-choice policy while keeping existing public functions/tests compatible. Discovery remains a legacy caller, not the production UI owner.
- [ ] **Step 8: Ensure `deleteXtreamAccount(id)` is usable as compensation** in `xtream-client.js`; no new credential surface is introduced.
- [ ] **Step 9: Run** `node tests/xtream-preview-policy.test.mjs`, `node tests/discovery-promotion.test.mjs`, `node tests/xtream-client.test.mjs` and confirm GREEN.
- [ ] **Step 10: Commit** `refactor: share strict Xtream preview persistence policy`.

### Task 5: Production Test/Preview Ownership in Xtream Account Management

**Files:**
- Modify: `src/xtream-ui.js`
- Modify: `src/xtream-client.js` only if preview AbortSignal support is required.
- Create: `src/xtream-catalog-view.js`
- Create: `tests/xtream-ui-preview-contract.test.mjs`
- Create: `tests/xtream-catalog-view.test.mjs`
- Modify: `tests/discovery-entrypoint-ownership.test.mjs`
- Modify: `.github/workflows/validate-frontend.yml`

**Interfaces:**
- `Test & Save` becomes `Test / Preview`.
- Production preview uses `previewXtreamAccount()` only.
- Catalog helper exports `XTREAM_PAGE_SIZE=100`, `filterXtreamChannels()`, `pageXtreamChannels()`, `summarizeXtreamGroups()`.
- Selected preview channel can be verified through the existing verifier client; verification result becomes a compatible preview candidate for the shared policy.

- [ ] **Step 1: Write failing UI ownership contract** asserting `src/xtream-ui.js` imports/calls `previewXtreamAccount`, does not call `saveXtreamAccount` from the Test/Preview handler, clears username **and** password after every preview attempt, and keeps preview token out of rendered text.
- [ ] **Step 2: Add failing ownership assertion** that `registry-default.js` still does not import legacy `discovery/discovery-ui.js`, while production Xtream modules remain loaded.
- [ ] **Step 3: Write failing catalog helper tests** for 50, 500 and 5,000 channel arrays: max page length 100, stable group filtering, query filtering and deterministic pagination.
- [ ] **Step 4: Run** `node tests/xtream-ui-preview-contract.test.mjs` and `node tests/xtream-catalog-view.test.mjs`; confirm RED.
- [ ] **Step 5: Implement catalog pure helpers** with `XTREAM_PAGE_SIZE=100`.
- [ ] **Step 6: Replace `connectAndSave()` with preview state machine** in `xtream-ui.js`: `idle -> previewing -> preview-ready -> verifying -> verified/failed -> persisting -> saved/error/expired`.
- [ ] **Step 7: Clear raw username/password fields in `finally`** after preview attempt. Keep only opaque token + safe account/catalog metadata in in-memory state.
- [ ] **Step 8: Render provider summary + group selector + search + one page only**. Debounce search 150 ms, lazy-load visible logos, use a generation counter so stale filter renders cannot overwrite the newest query/category.
- [ ] **Step 9: Add Cancel** that aborts/supersedes current preview/catalog work and drops in-memory preview token/state without persistence.
- [ ] **Step 10: Add selected-channel Verify action** using the existing Source Verifier client and `withVerification()` candidate model. Do not auto-verify all 5,000 channels.
- [ ] **Step 11: Enable persistence buttons only when the selected preview candidate satisfies the shared strict VERIFIED policy**. Full-account save remains gated by a selected VERIFIED preview channel in this implementation.
- [ ] **Step 12: Do not call `WebTVPlaylistAPI.applyText()` merely to browse a preview**. Preview browsing stays inside the Xtream card and does not alter sidebar/Player state.
- [ ] **Step 13: Keep existing saved-account management reachable**. If the old “Load channels” temporary-sidebar action remains, keep it explicit and separate from preview browsing; do not invoke it automatically.
- [ ] **Step 14: Run UI/catalog/entrypoint tests** plus `node tests/discovery-isolation.test.mjs`; confirm GREEN.
- [ ] **Step 15: Add new tests to frontend workflow**.
- [ ] **Step 16: Commit** `feat: make Xtream management own safe preview`.

### Task 6: Save Channel Destination + Selected/All-Known Source Scope

**Files:**
- Create: `src/known-source-collector.js`
- Create: `src/xtream-save-destination.js`
- Modify: `src/xtream-ui.js`
- Modify: `src/playlist-manager.js` only for exposing safe Custom Playlist selection/refresh API if needed.
- Create: `tests/known-source-collector.test.mjs`
- Create: `tests/xtream-save-destination.test.mjs`
- Modify: `tests/import-promotion-contract.test.mjs` only if a new caller contract needs explicit coverage.

**Interfaces:**
- `collectKnownSources(channel,{myPlaylist,customPlaylists,loadedCatalog,selectedSource}) -> source[]`
- `saveVerifiedXtreamChannel({candidate,destination,sourceScope,...deps})`
- Destination: `{kind:'my'}` or `{kind:'custom',playlistId}` or `{kind:'new-custom',name}`.
- Source scope: `'selected' | 'all-known'`.

- [ ] **Step 1: Write failing known-source tests** showing selected source is always included once, duplicates dedupe, My Playlist/custom/in-memory sources for the same canonical identity merge, and different-channel sources are excluded.
- [ ] **Step 2: Add a hard failing contract** that the collector source code does not import/call Unified Search, Discovery external clients, Local scan, Source Hunt or generic network `fetch`.
- [ ] **Step 3: Run** `node tests/known-source-collector.test.mjs` and confirm RED.
- [ ] **Step 4: Implement the pure collector** using existing canonical identity normalization/promotion helpers; no network.
- [ ] **Step 5: Write failing destination tests** for selected-source save to My Playlist, selected-source save to Custom Playlist, new Custom Playlist + first channel, and all-known scope.
- [ ] **Step 6: Add failing two-playlist isolation test**: MEGA in `Greek` may hold Xtream A only while MEGA in `Backup` holds Xtream A + M3U B.
- [ ] **Step 7: Add failing compensation test** for materialized Xtream source + destination write failure.
- [ ] **Step 8: Run** `node tests/xtream-save-destination.test.mjs` and confirm RED.
- [ ] **Step 9: Implement destination orchestration**. Materialize the selected Xtream channel only after strict preview policy passes. Use existing My Playlist APIs for My destination and `custom-playlist-client.js` for custom destination.
- [ ] **Step 10: For a new custom destination**, create the custom parent first, then write the channel. If channel write fails, delete the just-created empty parent and compensate the Xtream secret.
- [ ] **Step 11: Preserve Phase D canonical promotion** before writing a new canonical channel identity. Do not use provider `epg_channel_id` as canonical identity by itself.
- [ ] **Step 12: Persist allowed provenance** per source: origin, provider account/reference when permanent and non-secret, provider EPG ID/category. Never persist preview token or raw credentials.
- [ ] **Step 13: Wire `Save Channel…` UI** with Destination selector, `+ New Custom Playlist`, default `Selected source`, optional `All known sources`, and explicit final Save.
- [ ] **Step 14: Run destination/collector/Phase D tests** and confirm GREEN.
- [ ] **Step 15: Commit** `feat: save verified Xtream channels to my or custom playlists`.

### Task 7: Explicit Full Xtream Account Save + Account-Backed Library Entry

**Files:**
- Modify: `src/xtream-ui.js`
- Modify: `src/xtream-enhancements.js`
- Modify: `src/playlist-manager.js` if account-backed marker rendering needs a formal owner hook.
- Modify: `src/xtream-client.js` only if needed for metadata returned from preview/account save.
- Create: `tests/xtream-full-account-save.test.mjs`
- Modify: `tests/xtream-preview-routes.test.mjs` only if returned safe metadata is extended.

**Interfaces:**
- `Save Full Xtream Account` is a second explicit action after VERIFIED preview choice.
- Secure account is saved with `saveXtreamAccountFromPreview()`.
- Library entry remains account-backed, e.g. `kind:'xtream'`, `sourceUrl:'xtream:<accountId>'`; it does not flatten channels into custom child tables.

- [ ] **Step 1: Write failing full-account test** proving preview itself creates zero account/library writes and the second explicit action creates exactly one secure account write + one account-backed Saved Playlist marker.
- [ ] **Step 2: Add failing test** proving the marker never contains username/password/preview token and does not contain thousands of channel rows/raw provider catalog.
- [ ] **Step 3: Add failing metadata contract** proving preview/account catalog keeps `streamId`, `name`, `logo`, provider category/group and provider EPG/TVG ID where returned; missing country is not invented.
- [ ] **Step 4: Add failing compensation test**: Registry marker write fails after just-created account save, so the account is deleted and UI reports failure.
- [ ] **Step 5: Run** `node tests/xtream-full-account-save.test.mjs` and confirm RED.
- [ ] **Step 6: Refactor existing `xtream-enhancements.js` marker creation into a callable owner/helper** instead of relying only on loaded-account DOM enhancement. Keep existing saved Xtream playlists compatible.
- [ ] **Step 7: Wire explicit full-account save** through shared preview policy and compensation path.
- [ ] **Step 8: Use preview summary for safe marker counts** where available; do not reload the full catalog just to create the Library entry.
- [ ] **Step 9: Ensure opening an account-backed playlist loads catalog only on explicit open/browse**; no startup fetch.
- [ ] **Step 10: Run full-account, preview-route, startup and frontend integration tests** and confirm GREEN.
- [ ] **Step 11: Commit** `feat: save verified full Xtream accounts as live library entries`.

### Task 8: Deterministic 50/500/5000 Xtream Mock and No-Freeze Proof

**Files:**
- Modify: `workers/webtv-xtream-mock.js`
- Modify: `.github/workflows/deploy-webtv-xtream-mock.yml`
- Modify: `tests/xtream-mock-deploy-contract.test.mjs`
- Create: `tests/xtream-large-catalog.test.mjs`
- Modify: `.github/workflows/validate-frontend.yml`

**Interfaces:**
- Preserve existing `test_user` / `test_pass` 4-channel fixture.
- Add deterministic fixture usernames with same non-secret test password:
  - `test_50` -> 50 channels
  - `test_500` -> 500 channels
  - `test_5000` -> 5,000 channels
- Generated streams have deterministic category IDs/names and `epg_channel_id` values.

- [ ] **Step 1: Update deploy-contract tests first** to expect a new mock version while preserving `test_user` = 4 compatibility and adding `test_5000` = 5,000 stream verification.
- [ ] **Step 2: Write failing large-catalog test** for generated 50/500/5000 counts, multiple groups, deterministic EPG IDs and valid playback redirect for a generated stream.
- [ ] **Step 3: Add failing UI-structure assertion** that filtering/paging 5,000 fixture rows through `xtream-catalog-view.js` returns/render-models at most 100 rows.
- [ ] **Step 4: Run** `node tests/xtream-mock-deploy-contract.test.mjs` and `node tests/xtream-large-catalog.test.mjs`; confirm RED.
- [ ] **Step 5: Implement mock profile selection** by username without generating 5,000 global objects during Worker module startup if avoidable; generate deterministic arrays per request/profile.
- [ ] **Step 6: Keep `test_user` behavior exact** for existing smoke coverage; do not break the known MEGA fixture.
- [ ] **Step 7: Update mock deploy live gate**: verify service/version, legacy 4-channel login, and a `test_5000` `get_live_streams` response with exactly 5,000 entries. Do not attempt playback of all streams.
- [ ] **Step 8: Run both tests** and syntax check Worker.
- [ ] **Step 9: Add large-catalog test to frontend validation**.
- [ ] **Step 10: Commit** `test: add scalable Xtream catalog fixtures`.

### Task 9: Remove Legacy New Xtream UI Ownership Without Deleting Remaining Discovery Responsibilities

**Files:**
- Modify: `src/discovery/discovery-ui.js`
- Modify: `tests/discovery-entrypoint-ownership.test.mjs`
- Modify: `tests/discovery-isolation.test.mjs`
- Modify: `tests/new-xtream-preview.test.mjs` only if imports move; preserve core candidate/security tests.

**Interfaces:**
- Production owner is `src/xtream-ui.js`.
- Legacy Discovery shell no longer renders or binds New Xtream credential/test/save controls.
- Local/Promotion code needed by later audits is not broadly deleted.

- [ ] **Step 1: Write failing ownership assertions** that legacy `discovery-ui.js` no longer contains New Xtream credential fields, Test New Xtream handler or preview persistence buttons, while production `xtream-ui.js` owns Test/Preview.
- [ ] **Step 2: Run ownership/isolation tests** and confirm RED.
- [ ] **Step 3: Remove only New Xtream UI wiring from legacy Discovery shell**. Keep remaining Local/provider/promotion structures until their own audit proves retirement.
- [ ] **Step 4: Keep reusable New Xtream candidate tests/core temporarily if production policy or regression still depends on them; do not delete safe core just because UI moved.
- [ ] **Step 5: Run** `node tests/discovery-entrypoint-ownership.test.mjs`, `node tests/discovery-isolation.test.mjs`, `node tests/new-xtream-preview.test.mjs`, `node tests/discovery-promotion.test.mjs` and confirm GREEN.
- [ ] **Step 6: Commit** `refactor: retire legacy New Xtream UI ownership`.

### Task 10: Full Regression, Deployment, Real-Source Verification and Brain Closure

**Files:**
- Modify as evidence requires: `.github/workflows/validate-frontend.yml`
- Modify at verified closure only: `WEBV2_CURRENT.md`, `WEBV2_DECISIONS.md`, `WEBV2_CLEANUP.md`, `WEBV2_LESSONS.md` and/or the correct existing Brain owners.
- Create execution evidence note if useful: `docs/superpowers/notes/2026-10-01-xtream-preview-custom-playlists-execution-ledger.md`.

**Interfaces:**
- Produces exact implementation/deploy/live-verification evidence. Docs record only verified reality.

- [ ] **Step 1: Run targeted suite locally/CI-equivalent**:
  - `node tests/custom-playlist-registry.test.mjs`
  - `node tests/custom-playlist-client.test.mjs`
  - `node tests/custom-playlist-cache.test.mjs`
  - `node tests/xtream-preview-policy.test.mjs`
  - `node tests/xtream-ui-preview-contract.test.mjs`
  - `node tests/xtream-catalog-view.test.mjs`
  - `node tests/known-source-collector.test.mjs`
  - `node tests/xtream-save-destination.test.mjs`
  - `node tests/xtream-full-account-save.test.mjs`
  - `node tests/xtream-large-catalog.test.mjs`
  - all existing Xtream/Discovery/Phase D/startup/frontend integration tests touched by the workflows.
- [ ] **Step 2: Run JS syntax checks** for all modified `src/` and Worker files.
- [ ] **Step 3: Run the full `Validate WebTV Frontend` workflow** and require SUCCESS at the exact implementation head.
- [ ] **Step 4: Deploy Registry Worker** if Registry code changed; require its live D1-primary/My Playlist/project-agent gates SUCCESS and record exact SHA.
- [ ] **Step 5: Deploy Xtream Worker** because cleanup/reference behavior changes; require `/api/status`, preview OPTIONS/auth and cleanup auth live gates SUCCESS at exact SHA.
- [ ] **Step 6: Deploy Xtream Mock Worker** and require both legacy 4-channel and 5,000-channel live catalog checks SUCCESS.
- [ ] **Step 7: Require GitHub Pages deployment** for the frontend head and record exact deployment SHA/run.
- [ ] **Step 8: Re-check `/api/project-status` and `/api/project-checkpoints`** after deployment. If direct access remains unavailable, say so explicitly and use workflow live evidence without claiming endpoint equality.
- [ ] **Step 9: Live deterministic mock acceptance** in production UI:
  1. enter mock credentials and Test/Preview;
  2. confirm no account/Saved Playlist appears before explicit save;
  3. preview `test_5000` and confirm UI remains responsive, page <=100 rows, group/search/paging responsive;
  4. select one channel, Verify it, save selected source to My Playlist;
  5. save a channel to a new Custom Playlist;
  6. create a second Custom Playlist with same canonical channel but different source set;
  7. use All known sources and verify no search/discovery starts;
  8. save Full Account and confirm its own account-backed playlist/categories/provider EPG IDs remain available;
  9. confirm Player does not change except on explicit Play.
- [ ] **Step 10: Research a real authorized/public Xtream test source** only at verification time. Prefer an official demo/test endpoint or a user-authorized account. Do not use or commit scraped/pirated credentials. If no suitable public source exists, record that limitation and perform the real-world test with a user-provided authorized account while keeping credentials outside repo/logs.
- [ ] **Step 11: Real-source acceptance** with enough channels/categories to exercise browse/filter and one verified playable channel. Record counts/categories/behavior but redact server credentials/tokens.
- [ ] **Step 12: Failure-path live spot checks**: expired/cancelled preview does not save; bad credentials do not persist; deleting one custom reference does not delete an Xtream secret still referenced elsewhere.
- [ ] **Step 13: Only after all required evidence is green**, update canonical Brain docs with implemented SHA, deployed SHA(s), workflow run numbers, live proof and any known limitations. Do not mark full provider EPG ingestion or country support DONE unless actually implemented/verified.
- [ ] **Step 14: Final repo audit**: Unified Search unchanged, legacy Discovery production import still absent, My Playlist startup remains non-blocking, no raw credentials/token literals in persisted UI/library code, no duplicate New Xtream production panel.
- [ ] **Step 15: Commit docs closure** only after verified runtime evidence: `docs: close Xtream preview and custom playlist ownership`.

## Expected Commit Sequence

1. `feat: add D1 custom saved playlist membership`
2. `feat: add D1-authoritative custom playlist client and cache shell`
3. `fix: protect Xtream channel secrets referenced by custom playlists`
4. `refactor: share strict Xtream preview persistence policy`
5. `feat: make Xtream management own safe preview`
6. `feat: save verified Xtream channels to my or custom playlists`
7. `feat: save verified full Xtream accounts as live library entries`
8. `test: add scalable Xtream catalog fixtures`
9. `refactor: retire legacy New Xtream UI ownership`
10. verified deployment/evidence closure docs commit.

## Stop / Re-scope Conditions

Stop implementation and return to design if any of these become necessary:

- changing My Playlist D1 authority or migrating its tables;
- weakening VERIFIED preview persistence semantics;
- making Unified Search participate automatically in Save;
- full provider EPG schedule ingestion;
- a new broad Library/Player redesign;
- a need to store raw Xtream credentials outside the existing encrypted Xtream Worker tables;
- performance requires changing the global sidebar/Player rendering architecture rather than the bounded Xtream catalog view.

## Definition of Done

This feature is DONE only when the production Xtream card owns safe zero-persistence Test/Preview, explicit verified channel save works to My Playlist and Custom Saved Playlists, selected/all-known scope behaves exactly as designed, full accounts remain secure live account-backed playlists with provider metadata preserved, 5,000-channel mock browsing is bounded/responsive, a real authorized source has been exercised if available, relevant CI/deployments are green, live behavior is verified, and canonical Project Brain records that verified reality.