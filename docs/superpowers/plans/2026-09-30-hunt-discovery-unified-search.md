# WebV2 Hunt / Discovery Unified Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the overlapping Hunt/Discovery user flow with one polished, non-blocking unified search that supports channel, group, subgroup and free-text queries, produces one normalized candidate stream with provenance, and never interrupts the currently playing channel.

**Architecture:** Keep Player, Verifier, Save, Channel Identity/Profile and existing M3U/STRM/Enigma2 structural cores as owners of their current responsibilities. Add a small search subsystem with explicit search intent/state, a configurable source registry, adapter/orchestration boundaries and one normalized candidate store; reuse existing Discovery providers and unique Hunt exploration intelligence behind that boundary, then retire only duplicate browser scanning after parity is proven.

**Tech Stack:** Vanilla ES modules, Cloudflare Workers, existing WebV2 shared cores, Node `.mjs` regression tests, GitHub Actions, hls.js/dash.js remain unchanged in Player.

**Spec:** `docs/superpowers/specs/2026-09-30-hunt-discovery-unified-search-design.md`

## Global Constraints

- GitHub `main/WEBV2_CURRENT.md` remains canonical project-state truth; `main` must never be assumed to equal production.
- DONE means implemented + deployed + actually verified at exact deployed SHA(s).
- Search must never reset, reload, stop or auto-switch the active Player.
- Official provider/page/API discovery is excluded from the new unified search UX.
- Player, Verifier and Save semantics stay unchanged in this phase.
- Existing shared M3U, STRM and Enigma2 cores remain canonical structural owners.
- Existing Source Format Registry remains canonical for browser-playable / resolve-first / unsupported capability.
- Xtream credentials, authorization headers and private metadata must never be exposed in provenance UI.
- New search UI must look native to WebV2: clean cards, restrained default detail, responsive layout, technical metadata behind Details/Advanced rather than permanently visible.
- New source of an existing format should be configuration-only where practical; a new format gets a new adapter rather than a new parallel search engine.

## Review Focus

- A new search started while another search is active: previous lane work must be cancelled/ignored without touching playback.
- A slow or failed provider: completed lane results must remain visible and usable.
- Ambiguous group names / substring collisions: identity-backed targets must win over naive text matching; uncertain queries fall back to free-text.
- Provenance URLs containing credentials or unsafe schemes: `Open source` must be hidden/rejected rather than rendered.
- Large group result sets: rendering must remain incremental/bounded and must not cause noticeable playback/UI stalls.

---

### Task 1: Independent Search Intent and State

**Files:**
- Create: `src/search/search-intent.js`
- Create: `src/search/search-state.js`
- Test: `tests/search-intent.test.mjs`
- Test: `tests/search-state.test.mjs`

**Interfaces:**
- Consumes: existing Channel Identity/Profile normalization helpers.
- Produces: `resolveSearchIntent(query, context) -> { type, query, targets }`; `UnifiedSearchState` with `beginSearch`, `cancelSearch`, `mergeLaneResult`, `setLaneStatus`, `snapshot`.

- [ ] **Step 1: Write failing intent tests** for `ERT1 -> channel`, `ERT -> group`, `COSMOTE SPORT -> subgroup`, unknown text -> `free-text`, and an ambiguous substring that must not be promoted to a known group without identity evidence.
- [ ] **Step 2: Run** `node tests/search-intent.test.mjs` and confirm RED.
- [ ] **Step 3: Implement `resolveSearchIntent(query, context)`** in `src/search/search-intent.js`; use identity/profile metadata where available and preserve the original query for free-text fallback.
- [ ] **Step 4: Run** `node tests/search-intent.test.mjs` and confirm GREEN.
- [ ] **Step 5: Write failing state tests** proving search state is independent of selected/playing channel, a second search supersedes the first, and lane results merge progressively.
- [ ] **Step 6: Run** `node tests/search-state.test.mjs` and confirm RED.
- [ ] **Step 7: Implement `UnifiedSearchState`** in `src/search/search-state.js` with a monotonically increasing search token and immutable snapshots.
- [ ] **Step 8: Run both tests** and confirm GREEN.
- [ ] **Step 9: Commit** `feat: add independent unified search intent and state`.

### Task 2: Source Registry and Adapter Contract

**Files:**
- Create: `src/search/source-registry.js`
- Create: `src/search/adapter-registry.js`
- Test: `tests/unified-source-registry.test.mjs`
- Test: `tests/search-adapter-contract.test.mjs`

**Interfaces:**
- Consumes: `src/core/source-format-registry.js` for format capabilities only.
- Produces: `listSearchSources()`, `getSearchSource(id)`, `registerSearchAdapter(type, adapter)`, `getSearchAdapter(type)`; adapter signature `search({ target, source, signal }) -> Promise<{ candidates, leads, reports }>`.

- [ ] **Step 1: Write failing registry tests** for M3U, Enigma2, STRM and authorized Xtream source descriptors; assert Official sources are absent from unified search registry.
- [ ] **Step 2: Run** `node tests/unified-source-registry.test.mjs` and confirm RED.
- [ ] **Step 3: Implement source descriptors** with `id`, `label`, `type`, `location/context`, `enabled`, `priority`; do not duplicate format capability flags.
- [ ] **Step 4: Write failing adapter-contract tests** proving duplicate adapter types are rejected and missing adapters fail explicitly.
- [ ] **Step 5: Implement adapter registry** with the exact `search({target,source,signal})` contract.
- [ ] **Step 6: Run both tests** and confirm GREEN.
- [ ] **Step 7: Commit** `feat: add unified search source and adapter registries`.

### Task 3: Candidate Provenance and Capability Metadata

**Files:**
- Modify: `src/discovery/candidate-model.js`
- Modify: `src/discovery/external-discovery-client.js`
- Test: `tests/discovery-candidate-model.test.mjs`
- Test: `tests/discovery-external.test.mjs`

**Interfaces:**
- Consumes: existing `detectSourceFormat()` and provider payloads.
- Produces additional candidate fields: `sourceOriginUrl`, `sourceOriginLabel`, `inputFormatId`, `resolvedMediaFormatId`, `browserPlayable`; display redaction must preserve current Xtream protections.

- [ ] **Step 1: Extend failing candidate-model tests** for provenance separation (`sourceUrl` vs `sourceOriginUrl`), HLS/DASH/direct-video browser capability, M3U/STRM/Enigma2 resolve-first display, and RTMP/RTSP recognized-but-not-playable display.
- [ ] **Step 2: Add failing security tests** proving credential-bearing Xtream origins and non-http(s) origins are never exposed by `candidateForDisplay()`.
- [ ] **Step 3: Run** `node tests/discovery-candidate-model.test.mjs` and confirm RED.
- [ ] **Step 4: Implement the minimal metadata extension** by deriving capability from Source Format Registry rather than hard-coded UI rules.
- [ ] **Step 5: Update external client mapping** so provider origin URL/label survives normalization when safe.
- [ ] **Step 6: Run candidate and external tests** and confirm GREEN.
- [ ] **Step 7: Commit** `feat: preserve search candidate provenance and capability`.

### Task 4: Progressive Search Orchestrator

**Files:**
- Create: `src/search/search-orchestrator.js`
- Create: `src/search/adapters/discovery-provider-adapter.js`
- Create: `src/search/adapters/hunt-exploration-adapter.js`
- Test: `tests/search-orchestrator.test.mjs`

**Interfaces:**
- Consumes: `resolveSearchIntent`, `UnifiedSearchState`, Source Registry, adapter registry, existing Discovery client/provider calls and unique Hunt exploration endpoint(s).
- Produces: `runUnifiedSearch({ query, context, onUpdate }) -> { cancel, done }`; progressive lane updates contain normalized candidates/leads only.

- [ ] **Step 1: Write failing orchestrator tests** with fake adapters proving bounded concurrency, per-lane timeout, progressive `onUpdate`, failed-lane isolation, and cancellation of a superseded search.
- [ ] **Step 2: Add a failing playback-isolation contract test** using a sentinel Player API spy and assert orchestrator never calls `play`, `stop`, `testCandidate` or selection mutation during search.
- [ ] **Step 3: Run** `node tests/search-orchestrator.test.mjs` and confirm RED.
- [ ] **Step 4: Implement orchestrator** with AbortController/search token semantics and a small fixed concurrency cap; completed lane results are emitted immediately.
- [ ] **Step 5: Implement Discovery adapter** by wrapping current structured provider calls rather than re-parsing M3U/STRM/Enigma2.
- [ ] **Step 6: Implement Hunt exploration adapter** only for unique forum/Reddit/GitHub-issue/unknown-page lead intelligence; do not duplicate GitHub playlist/recent-web candidate crawling already owned by Discovery.
- [ ] **Step 7: Run orchestrator tests** and confirm GREEN.
- [ ] **Step 8: Commit** `feat: add progressive non-blocking unified search orchestration`.

### Task 5: One Normalized Candidate Store and Grouped Results

**Files:**
- Modify: `src/discovery/discovery-state.js`
- Create: `src/search/result-grouper.js`
- Test: `tests/search-result-grouper.test.mjs`
- Modify/Test as needed: `tests/discovery-state.test.mjs`

**Interfaces:**
- Consumes: normalized candidates from Task 3/4.
- Produces: `groupCandidatesByChannel(candidates, intent) -> [{ channelKey, channelName, candidates }]`; candidate dedupe key remains based on normalized playable source identity rather than DOM text.

- [ ] **Step 1: Write failing grouping tests** for `ERT` returning distinct ERT1/ERT2/ERT3 groups, multiple sources under one channel, free-text unknown group, and duplicate playable URLs from multiple origins preserving combined provenance.
- [ ] **Step 2: Run grouping/state tests** and confirm RED.
- [ ] **Step 3: Implement grouper** using identity-backed channel keys where available and conservative normalized-name fallback otherwise.
- [ ] **Step 4: Extend state merge** to accept incremental lane batches without resetting candidates from completed lanes.
- [ ] **Step 5: Run tests** and confirm GREEN.
- [ ] **Step 6: Commit** `feat: group unified search candidates by channel identity`.

### Task 6: Polished Unified Search UI Without Player Coupling

**Files:**
- Create: `src/search/search-ui.js`
- Create: `unified-search.css`
- Modify: `index.html`
- Modify: `src/main.js` only for exposing safe explicit Play integration if current `WebTVPlaybackAPI` is insufficient; no search-driven playback calls.
- Test: `tests/unified-search-ui-contract.test.mjs`
- Modify: `.github/workflows/validate-frontend.yml`

**Interfaces:**
- Consumes: `runUnifiedSearch`, grouped results, candidate display model, existing explicit playback API.
- Produces: one user-facing Search surface with `Now Playing` visually independent, progressive lane/status chips, grouped channel cards, compact candidate rows, `Play`, `Open source`, `Copy URL` where permitted, and `Details` for technical metadata.

- [ ] **Step 1: Write failing UI contract tests** asserting exactly one unified search entry point, no Official search control, independent Now Playing markup, safe `target="_blank" rel="noopener noreferrer"` source links, and result cards with collapsed technical details by default.
- [ ] **Step 2: Add a failing contract test** that starting search does not invoke Player/selection APIs and clicking `Play` is the only UI path that invokes candidate playback.
- [ ] **Step 3: Run** `node tests/unified-search-ui-contract.test.mjs` and confirm RED.
- [ ] **Step 4: Implement `search-ui.js`** with one search box; default mode auto-resolves channel/group/subgroup/free-text, while any advanced source/status detail stays under `Details`/Advanced.
- [ ] **Step 5: Add `unified-search.css`** matching the existing dark WebV2 visual language: clear hierarchy, restrained status colors, responsive grouped cards, readable mobile layout, no inline injected style blob.
- [ ] **Step 6: Wire `index.html`** to the new module/CSS with an atomic cache key; keep the existing Player card visible and independent while search panel opens/runs.
- [ ] **Step 7: Update frontend validation workflow** to syntax-check/load-contract the new module and stylesheet references.
- [ ] **Step 8: Run UI contract test and existing frontend tests** and confirm GREEN.
- [ ] **Step 9: Commit** `feat: add polished unified search interface`.

### Task 7: Replace One-Click DOM Scraping, Preserve Explicit Playback Testing

**Files:**
- Modify: `src/source-hunt-oneclick.js`
- Modify: `src/discovery/discovery-ui.js`
- Modify: `index.html`
- Test: `tests/unified-search-oneclick-parity.test.mjs`
- Test: relevant existing `tests/*discovery*.test.mjs`

**Interfaces:**
- Consumes: normalized store/orchestrator from prior tasks.
- Produces: no `collectLegacyCandidates()`/DOM-result scraping in the active unified path; real playback testing remains explicit and uses existing Player behavior.

- [ ] **Step 1: Write failing parity tests** proving unified search can consume Discovery candidates and Hunt leads without reading `#hunt-results`, `#hunt-web-results`, `#hunt-forum-results` or other result DOM nodes.
- [ ] **Step 2: Add failing regression test** proving free-text search still runs when current sidebar/playing channel differs from the query.
- [ ] **Step 3: Run parity tests** and confirm RED.
- [ ] **Step 4: Refactor One-Click integration** to consume normalized state/API; remove the active dependency on `collectLegacyCandidates()` and `waitForLegacyDiscovery()` only after test parity exists.
- [ ] **Step 5: Retire/redirect the visible `Discovery Beta` control** into the unified search UX; keep underlying provider code available until later duplicate-retirement proof.
- [ ] **Step 6: Ensure Official provider controls are absent from unified UX** but do not delete old Official provider worker code in this phase.
- [ ] **Step 7: Run all Discovery/Hunt/frontend regression tests** and confirm GREEN.
- [ ] **Step 8: Commit** `refactor: route hunt and discovery through unified candidate flow`.

### Task 8: Group/Subgroup Catalog and Source Addition Ergonomics

**Files:**
- Modify: `src/core/channel-profile-gr.js` or the existing canonical profile metadata owner only if it is the correct owner after audit.
- Create: `src/search/source-catalog.js` only if source entries cannot cleanly live in `source-registry.js`.
- Test: `tests/search-group-catalog.test.mjs`
- Test: `tests/unified-source-registry.test.mjs`

**Interfaces:**
- Consumes: canonical Channel Identity/Profile ownership.
- Produces: explicit searchable brand/group aliases and target membership for ERT, ANT1, Nova, Cosmote and subgroup examples such as Cosmote Sport; source additions stay declarative.

- [ ] **Step 1: Audit canonical profile owner** and document the exact existing field that can represent search family/group membership; do not create a duplicate identity database if an existing owner fits.
- [ ] **Step 2: Write failing group catalog tests** for ERT, ANT1, Nova, Cosmote and Cosmote Sport membership and alias behavior.
- [ ] **Step 3: Implement the minimum metadata extension** in the canonical owner.
- [ ] **Step 4: Add a fixture/config-only test** proving a new M3U source can be registered without parser/orchestrator changes.
- [ ] **Step 5: Run group/registry tests** and confirm GREEN.
- [ ] **Step 6: Commit** `feat: add identity-backed search groups and declarative sources`.

### Task 9: Duplicate Retirement, CI, Deployment and Live Proof

**Files:**
- Modify only after audit/parity: legacy browser Hunt GitHub/web scanning files that are proven fully replaced.
- Modify: `.github/workflows/deploy-source-discovery.yml`
- Modify: `.github/workflows/deploy-source-hunt.yml` only for dependencies that remain active.
- Modify: `.github/workflows/validate-frontend.yml`
- Modify: `WEBV2_CURRENT.md`, `WEBV2_ARCHITECTURE.md`, `WEBV2_ROADMAP.md`, `WEBV2_CLEANUP.md`, `WEBV2_LESSONS.md` at closure.

**Interfaces:**
- Consumes: all prior tasks and exact deployment evidence.
- Produces: verified production unified search; Brain records verified reality only.

- [ ] **Step 1: Run a repo-wide duplicate audit** and list exact active legacy functions/files now superseded by normalized provider/adapters; delete nothing that still owns unique Hunt issue/forum/provenance behavior.
- [ ] **Step 2: Remove only proven duplicate active browser GitHub/web candidate scanning** and corresponding dead script wiring.
- [ ] **Step 3: Run full local regression suite** including shared core parity, Discovery provider, Hunt parity, Player/Verifier/save and new unified-search tests.
- [ ] **Step 4: Merge through normal review path**; do not call the phase DONE at merge.
- [ ] **Step 5: Verify relevant GitHub Actions** for frontend, Source Discovery and Source Hunt dependencies.
- [ ] **Step 6: Deploy exact merged runtime SHA(s)** through the existing workflows.
- [ ] **Step 7: Perform live acceptance proof:** start MEGA; search `ERT`; confirm MEGA continues uninterrupted; confirm progressive grouped ERT results; force/observe a slow lane without blocking other results; search `ERT1` while another channel remains selected; run free-text search; open a safe provenance link in a new tab; verify Xtream provenance remains redacted; explicitly Play one result and confirm only then does Player change.
- [ ] **Step 8: Record exact deployed SHA and live evidence**; compare GitHub main, Registry project-status where readable, checkpoint/mirror when authorized, and component workflow evidence.
- [ ] **Step 9: Update Project Brain** only after implementation + deployment + live verification are proven.
- [ ] **Step 10: Commit** `docs: close unified hunt discovery search phase`.
