# WebV2 System Audit & UX Consolidation Design

Date: 2026-10-01
Status: Design for review
Repository: `tonis1000/WebV2`
Canonical runtime truth: `WEBV2_CURRENT.md` on `main`

## Goal

Continue the WebV2 cleanup after Unified Search by reducing duplicate or legacy product surfaces while preserving verified behavior. The final product should be internally coherent and externally simple: each capability has one clear owner, one clear user purpose, and one appropriate place in the page.

This phase does **not** start with visual redesign. It first removes architectural/UI overlap, then later uses the cleaned ownership model to redesign the page layout.

## Success criteria

The cleanup is successful only when all of the following are true:

1. Automatic source discovery has one user-facing surface: Unified Search.
2. Manual testing remains separate and explicit.
3. Playlist/library management remains separate from discovery and playback.
4. Diagnostics remain observational and do not become a second control path.
5. Admin-only capabilities remain available but are not mixed into normal viewing/search UX.
6. No D1 persistence, Favorites, My Playlist, EPG, Player, Verifier, Xtream, or Project Agent semantics are changed without a dedicated bounded problem statement.
7. Every removed or moved surface has an explicit parity check proving no required capability was lost.
8. Final page-layout work happens only after the capability/ownership cleanup is verified.

## Canonical constraints to preserve

The following existing boundaries from `WEBV2_CURRENT.md` remain protected:

- D1-primary My Playlist.
- D1-authoritative Favorites after successful cloud read.
- Saved Playlist D1 truth with IndexedDB reconciliation.
- Non-blocking startup.
- Channel Identity and EPG ownership.
- Import/promotion boundary.
- Source Format Registry and shared M3U / STRM / Enigma2 structural cores.
- Unified Search as the single automatic discovery surface.
- Search / Now Playing independence.
- Explicit Play as the only Search action that changes Player state.
- Source Verifier security/status semantics.
- Existing Player/Xtream behavior unless a separate bounded change proves necessity.
- Project Agent least-privilege pairing path.

## Current ownership map

### Viewer path

`Sidebar channel selection -> SourceRegistry -> health-ranked routes -> PlayerController -> EPG rendering`

Primary owners:
- `src/main.js`
- `src/core/source-registry.js`
- `src/core/player.js`
- `src/core/epg.js`

### Unified Search

`query -> search context -> unified lanes -> candidate normalization -> verification -> grouped results -> explicit Play`

Primary owners:
- `src/search/search-ui.js`
- `src/search/search-orchestrator.js`
- `src/search/search-runtime.js`
- `src/search/adapters/*`

Current automatic Unified Search lanes are:
- Curated sources
- GitHub playlists
- Recent web
- STRM sources
- Authorized Xtream
- Hunt exploration / leads

Official discovery is intentionally excluded.

### Manual Source Test

`manual URL -> candidate route build / STRM resolution -> Player test -> verified playback -> optional explicit source save`

Primary owners:
- `src/main.js`
- `src/saved-sources-ui.js`

This remains a separate explicit tool.

### Playlist / library management

Primary owner:
- `src/playlist-manager.js`

Responsibilities:
- D1 My Playlist management
- Saved Playlists
- Load by URL
- Paste M3U
- Temporary replace/merge catalog views
- channel add/remove/reorder/edit/source editing

### Favorites

Primary owner:
- `src/favorites-ui.js`

Two separate purposes are valid and not duplicates:
- sidebar Favorites filter
- add/remove selected channel from Favorites

### Diagnostics / source health

Primary owners:
- `src/main.js`
- `src/source-health-ui.js`
- diagnostics overlay helpers

Diagnostics are observational. They may expose route/source state and allow explicit inspection/testing, but must not become an automatic discovery or persistence path.

### Project Agent Pairing

Primary owner:
- `src/project-agent-pairing-admin.js`

Admin-only least-privilege function. It remains outside normal viewing/search UX.

### Desktop right rail

Primary owner:
- `src/right-rail-preview.js`

The rail is currently a layout/movement layer, not business-logic ownership. It relocates controls owned by other modules.

## First cleanup target: Discovery Beta overlap

`src/discovery/discovery-ui.js` still creates a complete `Discovery Beta` UI and is still imported by `src/registry-default.js`.

This overlaps with Unified Search for these automatic source-search capabilities:

- curated feeds
- GitHub playlists
- recent web search
- STRM discovery
- authorized Xtream search
- candidate verification

Those capabilities are now owned by Unified Search and must not remain exposed as a second automatic search universe.

However, Discovery Beta also contains capabilities that are **not** currently part of Unified Search and must not be deleted blindly:

- explicit New Xtream Account preview/test flow
- explicit Xtream account/channel promotion actions
- legacy Official provider search
- local snapshot/source inspection paths

Therefore the first cleanup is not "delete discovery directory". It is a controlled split between duplicated automatic search UI and unique admin/maintenance capabilities.

## Cleanup strategy

### Stage A: Stop exposing duplicate automatic Discovery UI

Desired outcome:
- the normal product has no `Discovery Beta` button/panel competing with Unified Search;
- Unified Search remains the only automatic source discovery UX;
- no underlying provider code is deleted in this stage.

Implementation boundary:
- remove/disable the production import/installation of the legacy Discovery Beta shell;
- do not change Unified Search lanes, Player, Verifier, D1 write semantics, or provider Workers;
- retain reusable discovery modules still consumed by Unified Search.

Proof:
- live desktop page has no `Discovery Beta` control;
- Unified Search still returns candidates from Curated, GitHub, Recent Web, STRM, Authorized Xtream and Hunt lanes;
- Unified Search explicit Play remains functional;
- Manual Test remains functional;
- frontend validation and unified-search validation pass.

### Stage B: Inventory unique Discovery-only capabilities

For each remaining unique capability, assign one of:

- `KEEP AS ADMIN TOOL`
- `MOVE TO EXISTING ADMIN SURFACE`
- `MERGE INTO PLAYLIST/XTREAM MANAGEMENT`
- `LEGACY / REMOVE CANDIDATE`

Expected direction:

- New Xtream Account preview/test belongs with Xtream/account management, not general discovery.
- Official provider search stays excluded from Unified Search unless a separate product requirement reintroduces it.
- local source inspection should be compared against Diagnostics, Source Health, Playlist Manager and Manual Test before retaining another surface.

No code deletion occurs until parity is established.

### Stage C: Remove orphaned legacy UI/state code

After Stage B migration decisions are implemented and verified:

- remove unused `DiscoveryState` UI orchestration where no longer referenced;
- remove legacy DOM/style code for the Discovery Beta panel;
- retain lower-level provider/client modules that remain consumed by Unified Search or dedicated admin tools;
- add permanent tests preventing reintroduction of a second automatic discovery surface.

### Stage D: Continue system-wide overlap audit

Proceed through these domains one by one:

1. Playlist Manager vs temporary catalog controls vs Xtream management.
2. Manual Test vs Diagnostics / Source Health / Playback Inspector.
3. Favorites controls and My Playlist controls.
4. Desktop rail layout helpers vs canonical ownership.
5. Admin-only controls vs normal viewer UX.
6. startup/sync modules and duplicated cloud/cache responsibilities.

Each domain gets a bounded decision before code changes.

### Stage E: UX consolidation and visual redesign

Only after functional ownership cleanup is complete:

- decide permanent desktop information architecture;
- separate viewer actions, library actions, search, and admin/debug tools;
- reduce visual density;
- preserve responsive/mobile behavior;
- create the final attractive, functional page layout.

The design target is not merely fewer buttons. It is a page where controls appear where their purpose is naturally understood.

## Classification rules

Every audited surface/module receives one classification:

- `KEEP`: distinct purpose and correct owner.
- `KEEP / SIMPLIFY`: distinct purpose but overcomplicated presentation.
- `MERGE`: duplicate user purpose should be unified.
- `MOVE`: valid capability in the wrong UI location/owner.
- `LEGACY`: superseded path retained temporarily for migration safety.
- `REMOVE CANDIDATE`: no unique required capability remains.
- `VERIFY`: insufficient evidence to decide safely.

## Data-flow safety rules

Cleanup must not silently change persistence or playback semantics.

For every change, explicitly check:

- Does it read/write D1?
- Does it read/write IndexedDB or localStorage?
- Does it mutate My Playlist or Favorites?
- Does it invoke Player directly?
- Does it invoke Source Verifier?
- Does it create/delete Xtream secrets or account references?
- Does it alter startup timing or cloud-read behavior?

If yes, the change is promoted to a separately scoped task.

## Verification model

A cleanup item is DONE only when all three are true:

1. **Implemented**: code path changed as designed.
2. **Deployed**: relevant production component deployed.
3. **Verified**: live behavior proves the intended result and protected behavior still works.

For UI cleanup, verification includes live browser checks, not CI alone.

For Stage A specifically, minimum acceptance evidence is:

- `Discovery Beta` absent from production UI.
- Unified Search present and usable.
- one real Unified Search request completes and exposes lane/result/report state.
- explicit Play still changes the Player only after user action.
- Manual Test still opens and tests a manual candidate.
- Playlists, Favorites, My Playlist and Diagnostics remain available according to admin-lock rules.
- relevant CI/workflows succeed for the exact deployed SHA.

## Non-goals for the first cleanup slice

Stage A does not:

- redesign the final page layout;
- change Player formats or streaming support;
- change verifier semantics;
- change D1 schemas;
- delete discovery provider implementations used by Unified Search;
- migrate New Xtream Account management yet;
- alter Official-provider policy;
- change mobile layout.

## First implementation slice

The first implementation slice after approval is intentionally small:

**Remove the legacy Discovery Beta UI entry point from production while keeping the underlying shared discovery provider modules intact.**

Before changing code, add a regression check proving that the production entry graph no longer installs `discovery-ui.js` while Unified Search still references the required provider modules through its adapters.

This gives the cleanup an observable first win without risking the unique admin capabilities that still need a separate migration decision.
