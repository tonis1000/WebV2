# WebV2 Discovery Cleanup Decisions

Date: 2026-10-01
Branch: `design/discovery-orphan-cleanup`
Base runtime: `53467ff29cfcb7b71cae4e4a74fd9a4cde33e713`

This note records product decisions agreed during the WebV2 System Audit & UX Consolidation workstream. It does not by itself mark any runtime cleanup as DONE.

## Product rule

WebV2 Search should spend UI space, runtime effort and maintenance cost on sources that are genuinely useful to discover. It should not prioritize functionality that the user can easily perform manually.

## Discovery decisions

### Legacy Discovery Beta UI

Status: REMOVE / already removed from the production entry graph by PR #81.

The legacy Discovery Beta shell must not return as a second automatic discovery surface. Unified Search remains the single automatic discovery surface.

### Shared discovery engines

Status: KEEP.

Curated feeds, GitHub playlists, recent web, STRM discovery, Authorized Xtream and Hunt exploration remain shared capabilities used by Unified Search.

### New Xtream preview

Status: KEEP, MOVE TO XTREAM MANAGEMENT.

The short-lived Xtream preview is useful because it can inspect a new account before permanent account/channel persistence. It does not belong to a general Discovery UI. Its eventual product home is Xtream / Playlist management.

### Promotion policy

Status: KEEP AS SHARED SAVE/PROMOTION POLICY.

Verification, save eligibility, temporary-preview handling and channel-consistency checks remain useful safety/persistence rules. They must not be deleted merely because the legacy Discovery UI is retired.

### Local source scan

Status: KEEP AS BACKGROUND INTELLIGENCE, NOT A USER-FACING SEARCH LANE.

Local scan may be reused for dedupe, already-known-source awareness and fallback context across My Playlist, Saved Playlists and loaded Xtream data. It should not normally show the user sources they already have as if they were new search findings.

### Official discovery / official-source resolver

Status: REMOVE CANDIDATE.

The user explicitly does not want WebV2 to spend product surface or search effort discovering official broadcaster sources. Official pages and official streams are considered easy enough to locate manually and therefore do not justify their own WebV2 feature.

Consequences for the next cleanup slice:

- Do not add Official discovery to Unified Search.
- Do not keep Official discovery as a hidden/background fallback merely for product completeness.
- Audit all consumers of `official-provider-lane.js`, `official-api-resolver.js`, their browser client wiring, Worker provider flags, tests and deployment verification.
- Remove these modules only after dependency evidence shows that doing so will not damage shared provider infrastructure or unrelated Source Discovery behavior.

## Verification rule for orphan cleanup

Before any deletion, prove:

1. the module is no longer a production entrypoint or required dependency;
2. retained capabilities have another explicit owner;
3. CI no longer depends on tests that exist solely for the retired feature;
4. Source Discovery still serves the retained providers required by Unified Search;
5. Unified Search, Manual Source Test, Xtream management, Player, Verifier, D1 persistence and startup behavior remain unchanged unless separately scoped.

DONE continues to mean implemented + deployed + actually verified.
