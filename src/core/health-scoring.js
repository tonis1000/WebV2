import { CONFIG } from '../config.js';

const HEALTH_PRIOR_SUCCESS = 3;
const HEALTH_PRIOR_FAIL = 1;

function boundedNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function classifyHealthFailure(reason = '') {
  const value = String(reason || '').trim().toLowerCase();
  if (!value) return '';
  if (/timeout|timed out|abort/.test(value)) return 'timeout';
  if (/http\s*4\d\d/.test(value)) return 'http-4xx';
  if (/http\s*5\d\d/.test(value)) return 'http-5xx';
  if (/network|fetch|connection|dns|socket/.test(value)) return 'network';
  if (/manifest|media|playback|decode|hls|dash/.test(value)) return 'media';
  return 'error';
}

export function scoreHealthEntry(entry = null, now = Date.now()) {
  if (!entry) return 0;
  if (Number(entry.cooldownUntil || 0) > now) return -1000;

  const success = boundedNumber(entry.success);
  const fail = boundedNumber(entry.fail);
  const attempts = success + fail;
  const ratio = attempts
    ? (success + HEALTH_PRIOR_SUCCESS) / (attempts + HEALTH_PRIOR_SUCCESS + HEALTH_PRIOR_FAIL)
    : 0;
  const lastSuccess = boundedNumber(entry.lastSuccess);
  const recency = lastSuccess
    ? Math.max(0, 1 - ((now - lastSuccess) / CONFIG.healthMaxAgeMs))
    : 0;
  const avgStartupMs = boundedNumber(entry.avgStartupMs);
  const speed = avgStartupMs > 0
    ? Math.max(0, 1 - Math.min(avgStartupMs, 15000) / 15000)
    : 0;
  const failurePenalty = Math.min(boundedNumber(entry.consecutiveFailures) * 15, 45);

  return (ratio * 70) + (recency * 20) + (speed * 10) - failurePenalty;
}

export function summarizeHealthEntry(entry = null, now = Date.now()) {
  if (!entry) {
    return {
      score: 0,
      state: 'unknown',
      attempts: 0,
      uptimePct: null,
      lastChecked: 0,
      failureKind: '',
      consecutiveFailures: 0,
      cooling: false,
    };
  }

  const success = boundedNumber(entry.success);
  const fail = boundedNumber(entry.fail);
  const attempts = success + fail;
  const lastSuccess = boundedNumber(entry.lastSuccess);
  const lastFailure = boundedNumber(entry.lastFailure);
  const lastChecked = Math.max(lastSuccess, lastFailure);
  const consecutiveFailures = boundedNumber(entry.consecutiveFailures);
  const cooling = Number(entry.cooldownUntil || 0) > now;
  const rawScore = scoreHealthEntry(entry, now);
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));
  const uptimePct = attempts ? Math.round((success / attempts) * 100) : null;
  const failureKind = classifyHealthFailure(entry.lastFailureReason);

  let state = 'unknown';
  if (attempts > 0) {
    if (cooling) state = 'cooling';
    else if (lastFailure > lastSuccess && consecutiveFailures <= 1) state = 'watch';
    else if (score >= 80) state = 'strong';
    else if (score >= 60) state = 'healthy';
    else if (score >= 40) state = 'mixed';
    else state = 'weak';
  }

  return {
    score,
    state,
    attempts,
    uptimePct,
    lastChecked,
    failureKind,
    consecutiveFailures,
    cooling,
  };
}

export function scoreSourceUrl(url, healthMap = {}, { workerUrlForSource = null } = {}) {
  const candidates = [url];
  if (typeof workerUrlForSource === 'function') {
    const worker = workerUrlForSource(url);
    if (worker && worker !== url) candidates.push(worker);
  }
  return Math.max(...candidates.map(key => scoreHealthEntry(healthMap[key] || null)));
}
