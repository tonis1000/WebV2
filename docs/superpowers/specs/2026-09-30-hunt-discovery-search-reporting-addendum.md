# WebV2 Unified Search Reporting Addendum

Date: 2026-09-30
Parent spec: `docs/superpowers/specs/2026-09-30-hunt-discovery-unified-search-design.md`
Status: APPROVED EXTENSION

## Purpose

Every Unified Search run must produce a structured report that explains what happened without cluttering the normal search UI. The report exists for two audiences at once: a compact human summary for everyday use and a technical diagnostic record that can be copied/exported and shared when a search or playback path behaves incorrectly.

## Product behavior

The normal Search UI remains quiet. During a run it shows a compact live summary such as sources completed, warnings, failures, timeouts, candidates and verified candidates. A `Search Report` control opens the full report only when requested.

The report supports three views over the same event stream:

1. Global search report: the whole run from start to finish.
2. Per-source/lane report: only events for one source/provider/lane.
3. Per-candidate report: the complete path for one finding, for example `Enigma2 -> HLS -> verifier -> playback status`.

No separate logging systems are allowed for these views. They are projections of one structured event stream.

## Event model

Events use a small common schema:

```js
{
  eventId,
  searchId,
  at,
  severity,       // INFO | OK | WARN | ERROR | TIMEOUT | SKIPPED
  type,           // e.g. search.started, lane.started, source.loaded, candidate.found
  laneId,
  sourceId,
  sourceLabel,
  candidateId,
  channelName,
  stage,
  durationMs,
  message,
  detail
}
```

Minimum event types:

- `search.started`
- `search.completed`
- `search.cancelled`
- `lane.started`
- `lane.completed`
- `lane.failed`
- `lane.timeout`
- `source.loaded`
- `source.failed`
- `format.detected`
- `candidate.found`
- `candidate.resolved`
- `verification.started`
- `verification.completed`
- `playback.requested`
- `playback.completed`

Adapters/providers report facts only. They do not render UI and do not claim playback success unless a real playback action actually occurred.

## Security and redaction

The reporter must redact before storage/display/export. It must never expose:

- Xtream passwords;
- Authorization/Cookie values;
- bearer/API tokens;
- private headers;
- credential-bearing URLs;
- opaque preview secrets.

Unsafe origin URLs are omitted rather than made clickable.

## Export

The report UI provides:

- `Copy report` for a compact text diagnostic;
- `Export JSON` for the structured event stream;
- optional plain-text download when implemented without adding a dependency.

Exports use the already-redacted report snapshot, not raw provider objects.

## Performance

Reporting must not become a new source of UI/player stalls:

- append events incrementally;
- keep a bounded in-memory event count per search;
- render the open report in batches/derived summaries rather than rebuilding the whole page for every event;
- closed report UI should update only compact counters;
- reporting must never call Player controls.

## Acceptance proof

For a broad `ERT` search while MEGA is playing:

1. MEGA continues uninterrupted.
2. Live report summary changes while lanes finish.
3. A deliberately failed/timeout lane appears with source, stage and reason.
4. A successful candidate can be traced from discovery source through resolved media format and verifier status.
5. Per-source and per-candidate views contain only their matching events.
6. Copy/JSON export contains the same redacted facts and no credentials.
7. A second search supersedes the first and records the first as cancelled/superseded rather than mixing both runs.
