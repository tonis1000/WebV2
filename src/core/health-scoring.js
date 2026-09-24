import { CONFIG } from '../config.js';

export function scoreHealthEntry(entry = null, now = Date.now()) {
  if (!entry) return 0;
  if (Number(entry.cooldownUntil || 0) > now) return -1000;

  const success = Number(entry.success || 0);
  const fail = Number(entry.fail || 0);
  const attempts = success + fail;
  const ratio = attempts ? success / attempts : 0;
  const lastSuccess = Number(entry.lastSuccess || 0);
  const recency = lastSuccess
    ? Math.max(0, 1 - ((now - lastSuccess) / CONFIG.healthMaxAgeMs))
    : 0;
  const avgStartupMs = Number(entry.avgStartupMs || 0);
  const speed = avgStartupMs > 0
    ? Math.max(0, 1 - Math.min(avgStartupMs, 15000) / 15000)
    : 0;
  const failurePenalty = Math.min(Number(entry.consecutiveFailures || 0) * 15, 45);

  return (ratio * 70) + (recency * 20) + (speed * 10) - failurePenalty;
}

export function scoreSourceUrl(url, healthMap = {}, { workerUrlForSource = null } = {}) {
  const candidates = [url];
  if (typeof workerUrlForSource === 'function') {
    const worker = workerUrlForSource(url);
    if (worker && worker !== url) candidates.push(worker);
  }
  return Math.max(...candidates.map(key => scoreHealthEntry(healthMap[key] || null)));
}
