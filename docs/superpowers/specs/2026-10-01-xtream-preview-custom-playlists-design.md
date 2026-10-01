# Xtream Preview Ownership + Custom Saved Playlists Design

Date: 2026-10-01
Repository: `tonis1000/WebV2`
Status: DESIGN FOR REVIEW
Base main SHA reviewed: `5695b90244bd7273e0b7f8264f284625c91e472f`

## 1. Problem Statement

The safe New Xtream preview path still exists in code, tests, and the Xtream Worker, but after the legacy Discovery Beta production entrypoint cleanup it no longer has a normal production UI owner. At the same time, the current production Xtream card in Playlist Manager uses a single `Test & Save` action that validates and persists a full account in one step.

This creates two problems:

1. The safer temporary-before-persistence boundary is orphaned from normal production UI ownership.
2. Saved Playlists currently model source-backed playlists well, but they do not yet model user-created mixed playlists where channels from different origins can coexist with playlist-specific source membership.

The solution must rehome safe Xtream preview into Xtream account management and extend Saved Playlists with an explicit custom-playlist model, without weakening existing My Playlist, Xtream, Player, Unified Search, EPG, startup, or D1 ownership boundaries.

## 2. Success Criteria

The change is successful only when all of the following are true:

- Xtream account testing is a true preview operation and causes zero persistence by itself.
- Full-account persistence requires a separate explicit user action.
- A previewed channel can be saved explicitly to My Playlist or to a user-selected Custom Saved Playlist.
- A Custom Saved Playlist may contain channels from multiple source families/providers.
- Default channel save stores only the selected source.
- `Save with all known sources` stores only already-known sources for that canonical channel and never launches Unified Search or discovery.
- The same canonical channel may exist in multiple Custom Saved Playlists with different source sets.
- A full saved Xtream account remains account-backed and keeps provider-native catalog metadata rather than being flattened into thousands of persisted channel rows.
- Existing Saved Playlist types and My Playlist behavior remain compatible.
- Large Xtream catalogs do not freeze or materially block the WebV2 UI.
- Completion requires implemented + deployed + live verified behavior, including a large-catalog test and a real authorized/public Xtream test source if one is available.

## 3. Canonical Constraints

This design preserves the current project contracts:

- GitHub `main/WEBV2_CURRENT.md` remains canonical project-state truth.
- My Playlist remains D1-primary.
- Existing Saved Playlist D1 truth + IndexedDB reconciliation remains intact for existing playlist kinds.
- Startup remains non-blocking.
- Phase C EPG identity/profile ownership remains intact.
- Phase D import/promotion safety remains intact.
- Unified Search remains the single automatic discovery surface.
- Search and Now Playing remain independent; only explicit Play changes the Player.
- New Xtream preview remains temporary before persistence.
- Xtream credentials and preview tokens must never leak into normal UI display, serialized candidates, logs, or Saved Playlist content.
- Existing Player and Xtream playback behavior remains unchanged unless a separately proven requirement demands a bounded change.

## 4. Chosen Architecture

The selected approach is to extend the existing Saved Playlist library model instead of creating a parallel Collections subsystem and instead of encoding Custom Saved Playlists only as generated M3U text.

### 4.1 Library kinds

The Library has four conceptual owners:

1. **My Playlist**
   - Existing primary WebV2 playlist.
   - Existing D1 ownership remains unchanged.

2. **Source Saved Playlist**
   - Existing URL/pasted M3U and other source-backed playlists.
   - Existing persistence remains unchanged.

3. **Custom Saved Playlist**
   - User-created playlist.
   - May contain channels from different providers/source families.
   - Each playlist owns its own channel membership and its own source membership.

4. **Xtream Account Saved Playlist**
   - Live account-backed library entry.
   - References a securely stored Xtream account.
   - Provider catalog is loaded from the Xtream bridge when opened.
   - The account catalog is not flattened into thousands of permanent Saved Playlist rows.

## 5. Xtream Preview UX

### 5.1 Entry point

The existing production `Xtream · User & Pass` card in Playlist Manager becomes the owner of safe Xtream preview.

The current `Test & Save` action is replaced by:

`Test / Preview`

Inputs remain account name/server/username/password as appropriate.

### 5.2 Preview behavior

When the user presses `Test / Preview`:

- the browser calls the existing secure preview API;
- account credentials are validated;
- an opaque short-lived preview token is returned;
- no full account and no channel is persisted;
- raw username/password fields are cleared after the attempt;
- the preview token is never displayed;
- the UI shows account validity and bounded catalog summary/preview information.

The existing preview-token expiration boundary remains in force.

### 5.3 Preview result actions

After successful preview, the UI exposes explicit actions:

- `Save Channel…`
- `Save Full Xtream Account`
- `Cancel`

Nothing persists automatically.

## 6. Save Channel Flow

When a channel is selected from the preview, `Save Channel…` opens a destination and source-scope chooser.

### 6.1 Destination

The destination may be:

- My Playlist
- any existing Custom Saved Playlist
- `+ New Custom Playlist`

Source-backed Saved Playlists are not mutated as arbitrary custom collections unless explicitly converted by a future design.

### 6.2 Source scope

The user chooses:

- `Selected source` (default)
- `All known sources`

`All known sources` means a snapshot of sources already known to WebV2 for the same canonical channel identity.

It MUST NOT:

- launch Unified Search;
- launch source discovery;
- scan the internet;
- mutate other playlists;
- silently add sources discovered later.

### 6.3 My Playlist behavior

If the canonical channel already exists in My Playlist:

- merge/dedupe the explicitly selected source set using existing My Playlist policies.

If it does not exist:

- create/import through the existing channel identity and promotion boundary;
- do not create an Xtream-specific alternate identity system.

### 6.4 Custom Saved Playlist behavior

If the canonical channel already exists in the selected Custom Saved Playlist:

- merge/dedupe the explicit source set into that playlist's channel membership.

If it does not exist:

- create the playlist-local channel membership and requested source membership.

The same canonical channel may therefore have different source sets in different Custom Saved Playlists.

## 7. Custom Saved Playlist Persistence Model

The existing `playlists` table remains the Library index.

Existing playlist kinds continue to use their current fields and behavior.

For `kind=custom`, add normalized child ownership rather than treating raw M3U as canonical truth.

Conceptual schema:

```text
playlists
  id
  name
  kind = custom
  ...existing metadata

playlist_channels
  playlist_id
  channel_id
  name
  tvg_id
  logo
  group_name
  position
  provider metadata fields only where required

playlist_channel_sources
  playlist_id
  channel_id
  source identity / playback reference
  origin
  priority
  provider provenance fields only where required
```

Exact SQL column design is an implementation-plan concern, but these ownership rules are fixed:

- Custom Playlist truth is normalized D1 state.
- Generated M3U is a projection/export/playback representation, not a second authority.
- Custom Playlist sources belong to `(playlist_id, channel_id)` rather than globally to `channel_id`.
- My Playlist tables are not migrated into this new model.
- Existing `channel_sources` ownership for My Playlist remains unchanged.

## 8. Xtream Secret Ownership

Custom Saved Playlists must never become credential owners.

For Xtream channel-only persistence:

- raw credentials remain encrypted in secure Xtream storage;
- Custom/My Playlist rows retain only the safe playback/source reference and allowed provenance metadata;
- opaque preview credentials/tokens are never persisted as ordinary playlist content.

Full-account persistence continues to use the secure account path.

## 9. Full Xtream Account Behavior

`Save Full Xtream Account` is a separate explicit second action after preview.

It:

- persists the full account securely;
- creates or updates the account's own Xtream Saved Playlist/library entry;
- does not automatically populate My Playlist;
- does not automatically populate any Custom Saved Playlist;
- does not duplicate the full live catalog into custom-playlist child tables.

The Xtream Saved Playlist remains a live account-backed view.

## 10. Provider Metadata Ownership

A full Xtream account keeps provider-native channel/catalog metadata that the bridge actually returns, including where available:

- stream ID
- channel name
- logo
- category/group
- provider EPG/TVG identity
- country/region metadata if the provider API genuinely exposes it
- other safe channel-level provider metadata proven necessary by implementation

The system must not invent country/region metadata when the provider does not supply it.

### 10.1 Full account view

Within the account-backed Xtream playlist:

- provider category/group structure remains provider-native;
- future UI filters may organize it, but must not silently rewrite the source metadata;
- provider EPG identity is preserved for use by account-native EPG features where supported.

### 10.2 Channel copied into My/Custom Playlist

A copied channel keeps only useful channel/source-level metadata and provenance, not the entire provider taxonomy.

The copied channel remains subject to existing WebV2 canonical channel identity and Phase C EPG/profile ownership.

Provider EPG identifiers are preserved as metadata where useful, but they do not replace the established WebV2 EPG ownership contract without a separate proven change.

## 11. Performance / No-Freeze Contract

Large catalogs must not freeze the UI.

Required behavior:

- full Xtream account catalogs are not loaded during normal WebV2 startup;
- account catalog work begins only when the user explicitly previews/opens that account;
- the UI must not create thousands of channel DOM rows synchronously;
- channel rendering uses bounded batching, lazy rendering, virtualization, pagination, or another measured non-blocking technique selected during implementation;
- logos load lazily and must not trigger thousands of simultaneous requests;
- category/group browsing should permit bounded/on-demand channel rendering;
- filtering/search over a large catalog must avoid long blocking work on the main thread;
- stale account/category/filter work must be cancellable or safely ignored;
- `Save Channel` persists only the requested channel/source set and does not rescan the entire account;
- `Save with all known sources` does not trigger discovery;
- the existing preview maximum is treated as a safety ceiling, never as a requirement to render every item at once.

Performance acceptance must be measured with at least:

- small catalog: approximately 50 channels;
- medium catalog: several hundred channels;
- large catalog: at least 1,000 channels, preferably several thousand up to the safe preview ceiling.

Implementation planning must define concrete measurable responsiveness thresholds before coding the rendering change.

## 12. Verification Source Strategy

Performance and behavior verification use two complementary sources:

1. **Deterministic test fixture/mock Xtream source**
   - reproducible 50 / medium / 1,000+ / several-thousand-channel catalogs;
   - multiple categories/groups;
   - provider metadata/EPG-ID variations;
   - used for regression and performance proof.

2. **Real authorized/public Xtream source**
   - researched separately before live verification;
   - must be legally/contractually appropriate for testing;
   - should expose enough channels/categories to exercise real-world behavior;
   - credentials/tokens must not be committed to the repository.

A real-source test complements but does not replace deterministic regression fixtures.

## 13. Failure and Atomicity Behavior

- Preview authentication failure: zero persistence.
- Preview expiration: require a fresh preview before persistence.
- Channel save failure: no partial playlist/channel/source state may remain.
- Full-account persistence failure: do not create a misleading successful Saved Playlist entry.
- Duplicate channel/source save: merge/dedupe rather than create duplicate memberships.
- New Custom Playlist + initial channel save should behave atomically from the user's point of view.
- Security-sensitive failures must fail closed.

## 14. Compatibility and Migration

This is additive migration, not a whole-library rewrite.

- Existing M3U/pasted Saved Playlists remain unchanged.
- Existing Xtream account-backed Saved Playlists remain compatible.
- Existing My Playlist D1 model remains unchanged.
- Only `kind=custom` uses the new normalized playlist-specific channel/source membership.
- Existing Saved Playlists are not automatically converted into Custom Playlists.
- Unified Search remains unchanged.
- Player ownership remains unchanged.
- Legacy Discovery UI is not deleted wholesale as part of this design; New Xtream preview ownership may be removed from it only after the production Xtream owner is implemented and verified, and remaining Promotion/Local ownership audits are respected.

## 15. Production Ownership Migration

The safe preview mechanism should move from legacy Discovery ownership to Xtream account management ownership.

Preferred staged approach:

1. Production Xtream UI consumes the existing safe preview core/worker contract.
2. Tests prove `Test / Preview` is non-persistent and explicit persistence paths work.
3. Neutral Xtream preview/persistence policy may then be moved out of the `discovery/` namespace if that can be done without broad churn.
4. Only after the new production owner is verified may legacy New Xtream UI wiring be retired.

This design does not put New Xtream Preview into Unified Search.

## 16. Required Test Contracts

Before implementation is accepted, tests must prove at minimum:

- `Test / Preview` calls preview only and does not call full-account persistence.
- credentials are cleared after preview attempts.
- raw username/password/preview token are not rendered or serialized into ordinary candidate/library state.
- full-account save requires a second explicit action.
- channel-only save requires an explicit destination and explicit source scope.
- selected-source save writes exactly the selected source after dedupe.
- all-known-sources save reads only existing known sources and never invokes Unified Search/discovery.
- the same canonical channel can have different source sets in two Custom Saved Playlists.
- duplicate channel/source saves merge rather than duplicate.
- full Xtream account remains account-backed.
- available provider category/EPG/provenance metadata survives the appropriate path.
- preview expiration and selected-channel identity drift fail closed where the existing promotion contract requires it.
- existing My Playlist, Saved Playlist, startup, Xtream, Unified Search, and Player regression suites remain green.

## 17. Deployment and Live Verification

The feature is not DONE at merge time.

Required closure sequence:

1. RED-first targeted tests for new ownership/persistence behavior.
2. Minimal implementation.
3. Targeted tests green.
4. Full relevant frontend/registry/Xtream test suites green.
5. Required Worker/Pages deployments complete for the components actually changed.
6. Live verification of:
   - zero-persistence preview;
   - explicit full-account save;
   - selected-source save to My Playlist;
   - selected-source save to Custom Saved Playlist;
   - all-known-source snapshot behavior;
   - mixed-source Custom Saved Playlist;
   - full Xtream account categories/metadata behavior;
   - large-catalog responsiveness;
   - real authorized/public source behavior.
7. Only after successful live proof, update the correct Project Brain owners and mark the work DONE.

## 18. Explicit Non-Goals

This design does not include:

- a new automatic Xtream discovery lane in Unified Search;
- full provider EPG schedule ingestion unless separately scoped and proven necessary;
- automatic country inference from channel names;
- automatic category translation/remapping;
- silent background mutation of Custom Saved Playlist source sets;
- broad Player redesign;
- broad visual redesign of the whole application;
- automatic conversion of all existing Saved Playlists into Custom Playlists.

## 19. Open Implementation Questions for the Plan Stage

The implementation plan must resolve, with tests before production changes:

- exact D1 schema/migration SQL for custom playlist membership;
- exact API routes and payloads for Custom Playlist CRUD and channel/source membership;
- how existing IndexedDB reconciliation should treat `kind=custom` without creating dual authority;
- the safest adapter for collecting already-known sources across allowed stores;
- the exact verification gate for full-account save versus channel-only save, preserving current promotion safety unless deliberately changed in a separate approved design;
- the chosen large-catalog rendering strategy and measurable responsiveness threshold;
- which existing production UI module owns the new dialog/state machine;
- how provider-native EPG/category metadata is represented without violating Phase C ownership.

No implementation should begin until this written design is reviewed and approved, followed by a written implementation plan.