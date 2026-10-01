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

Why they are kept:

- **Curated feeds:** they give WebV2 a maintained set of known source collections so the user does not have to remember or manually inspect each feed.
- **GitHub playlists:** they search public playlist repositories where useful sources can appear without being easy to locate manually.
- **Recent web:** it can discover fresh source leads outside the fixed catalog, which is precisely the kind of work the user should not have to repeat by hand.
- **STRM discovery/resolution:** it turns `.strm` references into the actual underlying media target, a technical resolution step that is not practical manual browsing.
- **Authorized Xtream:** it searches accounts the user has explicitly authorized while keeping credentials inside the Xtream bridge; this is useful discovery over private account data without exposing secrets.
- **Hunt exploration:** it covers wider leads such as forums/Reddit-style source hunting that can surface non-obvious candidates and therefore adds discovery value beyond a simple official-site lookup.

These engines are retained because they reduce manual investigation or safely bridge source formats/accounts. They are not being kept merely because code already exists.

### New Xtream preview

Status: KEEP, MOVE TO XTREAM MANAGEMENT.

The short-lived Xtream preview is useful because it can inspect a new account before permanent account/channel persistence. It does not belong to a general Discovery UI. Its eventual product home is Xtream / Playlist management.

Why it is kept: it provides a safe temporary inspection step before credentials/account state become persistent. That is useful account-management behavior even after the legacy Discovery UI disappears.

### Promotion policy

Status: KEEP AS SHARED SAVE/PROMOTION POLICY.

Verification, save eligibility, temporary-preview handling and channel-consistency checks remain useful safety/persistence rules. They must not be deleted merely because the legacy Discovery UI is retired.

Why it is kept: it is the safety boundary between a temporary candidate and a permanent saved source/account. Removing it together with the UI would weaken persistence guarantees rather than simplify presentation.

### Local source scan

Status: KEEP AS BACKGROUND INTELLIGENCE, NOT A USER-FACING SEARCH LANE.

Local scan may be reused for dedupe, already-known-source awareness and fallback context across My Playlist, Saved Playlists and loaded Xtream data. It should not normally show the user sources they already have as if they were new search findings.

Why it is kept: the system benefits from knowing what already exists so it can avoid duplicate discoveries and understand known alternatives, while the user does not need another visible lane full of sources they already own.

### Official discovery / official-source resolver

Status: REMOVE CANDIDATE.

The user explicitly does not want WebV2 to spend product surface or search effort discovering official broadcaster sources. Official pages and official streams are considered easy enough to locate manually and therefore do not justify their own WebV2 feature.

Why it is removed: unlike the retained engines, Official discovery mostly automates something the user can already do quickly by going to the broadcaster's site. Keeping it adds broadcaster-specific registries, API resolver logic, verifier coupling, tests and deployment checks without enough product value for this WebV2 use case.

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
