import { CONFIG } from '../config.js?v=20260923-2215';
import { cleanUrl } from './utils.js?v=20260920-1021';

const HEALTH_BACKUP_KEY_SUFFIX = '__backup';

export class HealthStore {
  constructor(storageKey = CONFIG.healthStorageKey) {
    this.storageKey = storageKey;
    this.map = this.#load();
    this.#prune();
  }
  #load() {
    const parse = raw => {
      if (!raw) return null;
      try {
        const value = JSON.parse(raw);
        return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
      } catch { return null; }
    };
    try {
      const primary = parse(localStorage.getItem(this.storageKey));
      const backup = parse(localStorage.getItem(this.storageKey + HEALTH_BACKUP_KEY_SUFFIX));
      const primaryCount = primary ? Object.keys(primary).length : 0;
      const backupCount = backup ? Object.keys(backup).length : 0;
      if (primaryCount || !backupCount) return primary || {};
      console.warn('[WebTV] HealthStore primary empty; recovered backup', backupCount);
      return backup || {};
    } catch (error) {
      console.warn('[WebTV] HealthStore load failed', error);
      return {};
    }
  }
  #save() {
    try {
      const serialized = JSON.stringify(this.map);
      localStorage.setItem(this.storageKey, serialized);
      localStorage.setItem(this.storageKey + HEALTH_BACKUP_KEY_SUFFIX, serialized);
      return true;
    } catch (error) {
      console.warn('[WebTV] HealthStore persist failed', error);
      return false;
    }
  }
  refresh() {
    // Merge persisted state into the live map. Never replace newer in-memory
    // observations with an empty/stale storage snapshot.
    const persisted = this.#load();
    for (const [key, incoming] of Object.entries(persisted)) {
      const current = this.map[key];
      if (!current) {
        this.map[key] = incoming;
        continue;
      }
      const currentTs = Math.max(current.lastSuccess || 0, current.lastFailure || 0);
      const incomingTs = Math.max(incoming.lastSuccess || 0, incoming.lastFailure || 0);
      if (incomingTs > currentTs) this.map[key] = incoming;
    }
    this.#prune();
    return this.map;
  }
  #key(value) { return cleanUrl(value); }
  #entry(value) {
    const key = this.#key(value);
    if (!this.map[key]) this.map[key] = { success: 0, fail: 0, consecutiveFailures: 0, cooldownUntil: 0, lastSuccess: 0, lastFailure: 0, avgStartupMs: 0, player: '', route: '', lastFailureReason: '' };
    return this.map[key];
  }
  recordSuccess(value, { startupMs = 0, player = '', route = '' } = {}) {
    const entry = this.#entry(value);
    entry.success += 1;
    entry.consecutiveFailures = 0;
    entry.cooldownUntil = 0;
    entry.lastSuccess = Date.now();
    entry.player = player || entry.player;
    entry.route = route || entry.route;
    entry.lastFailureReason = '';
    if (startupMs > 0) entry.avgStartupMs = entry.avgStartupMs ? Math.round((entry.avgStartupMs * .7) + (startupMs * .3)) : Math.round(startupMs);
    this.#save();
    return entry;
  }
  recordFailure(value, { hardCooldownMs = 0, reason = '' } = {}) {
    const entry = this.#entry(value);
    entry.fail += 1;
    entry.consecutiveFailures = (entry.consecutiveFailures || 0) + 1;
    entry.lastFailure = Date.now();
    entry.lastFailureReason = reason || entry.lastFailureReason || '';
    if (hardCooldownMs > 0) {
      entry.cooldownUntil = Math.max(entry.cooldownUntil || 0, Date.now() + hardCooldownMs);
    } else if (entry.consecutiveFailures >= CONFIG.failureCooldownThreshold) {
      const exponent = entry.consecutiveFailures - CONFIG.failureCooldownThreshold;
      const delay = Math.min(CONFIG.failureCooldownBaseMs * (2 ** exponent), CONFIG.failureCooldownMaxMs);
      entry.cooldownUntil = Date.now() + delay;
    }
    this.#save();
    return entry;
  }
  quarantine(value, { cooldownMs = CONFIG.failureCooldownMaxMs, reason = '' } = {}) {
    const entry = this.#entry(value);
    entry.cooldownUntil = Math.max(entry.cooldownUntil || 0, Date.now() + Math.max(0, Number(cooldownMs) || 0));
    if (reason) entry.lastFailureReason = reason;
    this.#save();
    return entry;
  }
  get(value) { return this.map[this.#key(value)] || null; }
  isCoolingDown(value) { return (this.get(value)?.cooldownUntil || 0) > Date.now(); }
  cooldownRemainingMs(value) { return Math.max(0, (this.get(value)?.cooldownUntil || 0) - Date.now()); }
  score(value) {
    const entry = this.get(value);
    if (!entry) return 0;
    if (this.isCoolingDown(value)) return -1000;
    const attempts = entry.success + entry.fail;
    const ratio = attempts ? entry.success / attempts : 0;
    const recency = entry.lastSuccess ? Math.max(0, 1 - ((Date.now() - entry.lastSuccess) / CONFIG.healthMaxAgeMs)) : 0;
    const speed = entry.avgStartupMs > 0 ? Math.max(0, 1 - Math.min(entry.avgStartupMs, 15000) / 15000) : 0;
    const failurePenalty = Math.min((entry.consecutiveFailures || 0) * 15, 45);
    return (ratio * 70) + (recency * 20) + (speed * 10) - failurePenalty;
  }
  clear() {
    this.map = {};
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.storageKey + HEALTH_BACKUP_KEY_SUFFIX);
    } catch {}
  }
  diagnostics() {
    let primaryRaw = null, backupRaw = null;
    try {
      primaryRaw = localStorage.getItem(this.storageKey);
      backupRaw = localStorage.getItem(this.storageKey + HEALTH_BACKUP_KEY_SUFFIX);
    } catch {}
    const count = raw => {
      try { return raw ? Object.keys(JSON.parse(raw) || {}).length : 0; } catch { return -1; }
    };
    return {
      memoryEntries:Object.keys(this.map || {}).length,
      primaryEntries:count(primaryRaw),
      backupEntries:count(backupRaw),
      primaryBytes:primaryRaw?.length || 0,
      backupBytes:backupRaw?.length || 0,
      storageKey:this.storageKey,
    };
  }
  #prune() {
    const cutoff = Date.now() - CONFIG.healthMaxAgeMs;
    let changed = false;
    for (const [key, entry] of Object.entries(this.map)) {
      const newest = Math.max(entry.lastSuccess || 0, entry.lastFailure || 0);
      if (newest && newest < cutoff) { delete this.map[key]; changed = true; }
    }
    if (changed) this.#save();
  }
}
