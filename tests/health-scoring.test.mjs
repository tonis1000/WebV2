import assert from 'node:assert/strict';
import { scoreHealthEntry, summarizeHealthEntry } from '../src/core/health-scoring.js';

const now = 1_800_000_000_000;

const healthyWithOneRecentFailure = {
  success: 10,
  fail: 1,
  consecutiveFailures: 1,
  lastSuccess: now - 60_000,
  lastFailure: now - 1_000,
  avgStartupMs: 1200,
  cooldownUntil: 0,
  lastFailureReason: 'Playback timed out',
};

const resilientScore = scoreHealthEntry(healthyWithOneRecentFailure, now);
assert.ok(
  resilientScore >= 60,
  `one recent failure must not erase a strong history; received ${resilientScore}`
);

const summary = summarizeHealthEntry(healthyWithOneRecentFailure, now);
assert.equal(summary.uptimePct, 91);
assert.equal(summary.lastChecked, healthyWithOneRecentFailure.lastFailure);
assert.equal(summary.failureKind, 'timeout');
assert.equal(summary.state, 'watch');
assert.equal(summary.attempts, 11);
assert.ok(summary.score >= 60 && summary.score <= 100);

const firstFailure = {
  success: 0,
  fail: 1,
  consecutiveFailures: 1,
  lastSuccess: 0,
  lastFailure: now - 500,
  avgStartupMs: 0,
  cooldownUntil: 0,
  lastFailureReason: 'HTTP 503',
};
assert.ok(
  scoreHealthEntry(firstFailure, now) > 0,
  'a single failure should lower confidence without collapsing health to a terminal/dead score'
);
assert.equal(summarizeHealthEntry(firstFailure, now).failureKind, 'http-5xx');

const cooling = {
  ...healthyWithOneRecentFailure,
  consecutiveFailures: 2,
  cooldownUntil: now + 60_000,
};
assert.equal(scoreHealthEntry(cooling, now), -1000, 'active cooldown remains a hard ranking penalty');
assert.equal(summarizeHealthEntry(cooling, now).state, 'cooling');

const unknown = summarizeHealthEntry(null, now);
assert.equal(unknown.state, 'unknown');
assert.equal(unknown.attempts, 0);
assert.equal(unknown.uptimePct, null);

console.log('Nexus-style Health scoring regression PASS');
