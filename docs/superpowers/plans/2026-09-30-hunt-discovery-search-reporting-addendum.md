# WebV2 Unified Search Reporting Implementation Addendum

> **For agentic workers:** This addendum extends `docs/superpowers/plans/2026-09-30-hunt-discovery-unified-search.md` and is binding for the same branch. Implement reporting before the search UI task so orchestration, provenance and UI consume one shared reporter instead of inventing separate logs.

**Goal:** Add one structured, redacted Search Reporter that powers live summary, global timeline, per-source/per-candidate diagnostics and safe export without touching Player semantics.

**Spec:** `docs/superpowers/specs/2026-09-30-hunt-discovery-search-reporting-addendum.md`

## Placement in parent plan

Execute this task after parent Task 3 (candidate provenance) and before parent Task 4 (progressive orchestrator). Parent Task 4 must emit reporter events, and parent Task 6 UI must render them.

### Task R1: Structured Search Reporter

**Files:**
- Create: `src/search/search-reporter.js`
- Test: `tests/search-reporter.test.mjs`
- Later integrate in: `src/search/search-orchestrator.js`, `src/search/search-ui.js`

**Interfaces:**
- Produces: `createSearchReporter({ searchId, maxEvents = 1000 })` returning `{ emit, snapshot, summary, filterBySource, filterByCandidate, exportText, exportJson }`.
- `emit(event)` accepts the event schema from the reporting spec and returns the normalized redacted event.
- `snapshot()` returns an immutable, already-redacted event list.
- `summary()` returns counters for total/completed/failed/timeout/warnings/candidates/verified plus run status.

- [ ] **Step 1: Write failing reporter tests** proving chronological append, immutable snapshots, summary counters, per-source filtering, per-candidate filtering and bounded event retention.
- [ ] **Step 2: Write failing redaction tests** for URL userinfo, `username/password` query pairs, Authorization/Cookie/token-like fields and Xtream credential objects.
- [ ] **Step 3: Write failing export tests** proving text and JSON export are generated only from the redacted snapshot.
- [ ] **Step 4: Run** `node tests/search-reporter.test.mjs` and confirm RED because `src/search/search-reporter.js` does not exist.
- [ ] **Step 5: Implement the minimal reporter** with severity/type normalization, redaction-before-storage and bounded append-only events.
- [ ] **Step 6: Run** `node tests/search-reporter.test.mjs` and confirm GREEN.
- [ ] **Step 7: Commit** `feat: add structured unified search reporter`.

## Parent-plan integration amendments

When executing parent Task 4:
- `runUnifiedSearch` creates/receives one reporter per `searchId`.
- emit `search.started`, lane start/completion/failure/timeout, source facts, candidate discovery/resolution and `search.completed/cancelled`.
- a superseded run must be marked cancelled and later events from its token ignored.
- reporting must not call Player/selection APIs.

When executing parent Task 6:
- add a compact `Search Report` summary control with warning/error badge;
- report panel defaults closed;
- global timeline, source filter and candidate drill-down all read from the same reporter snapshot;
- add `Copy report` and `Export JSON` actions;
- technical report rendering lives under Details/Advanced and is responsive;
- do not render or export raw provider payloads.

When executing final live proof:
- broad ERT search while MEGA is playing must produce a report that identifies at least one successful lane and any observed failure/timeout without interrupting playback;
- exported report must be inspected for secret leakage before phase closure.
