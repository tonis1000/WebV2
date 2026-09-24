import { CONFIG, CHANNEL_ALIASES, SOURCE_BLOCKLIST } from '../config.js?v=20260923-2215';
import { normalizeId, cleanUrl, workerUrl, isHls, isDash, isVideoFile } from './utils.js?v=20260920-1021';

function isPlayableMedia(url = '') {
  return isHls(url) || isDash(url) || isVideoFile(url);
}

function isSecureUrl(url = '') {
  return /^https:\/\//i.test(url);
}

function isWrongChannelSource(channel, url = '') {
  const channelKey = normalizeId(channel?.id || channel?.originalId || channel?.name || '');
  if (channelKey !== 'mega') return false;
  const value = String(url).toLowerCase();
  return value.includes('s99841657') || value.includes('mega%20news') || value.includes('mega-news') || value.includes('mega_news') || value.includes('/meganews');
}

const BLOCKED = new Set((SOURCE_BLOCKLIST || []).map(cleanUrl).filter(Boolean));

export class SourceRegistry {
  constructor(healthStore) {
    this.health = healthStore;
    this.remoteMap = {};
    this.aliasIndex = this.#buildAliasIndex();
  }
  #buildAliasIndex() {
    const map = new Map();
    for (const [canonical, aliases] of Object.entries(CHANNEL_ALIASES)) {
      map.set(normalizeId(canonical), canonical);
      for (const alias of aliases) map.set(normalizeId(alias), canonical);
    }
    return map;
  }
  async refresh() {
    const response = await fetch(`${CONFIG.cacheBaseUrl}/channel-streams.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`channel-streams.json HTTP ${response.status}`);
    this.remoteMap = await response.json();
    return this.remoteMap;
  }
  #candidateKeys(channel) {
    const raw = [channel.id, channel.originalId, channel.name].filter(Boolean);
    const normalized = raw.map(normalizeId);
    const canonical = normalized.map(v => this.aliasIndex.get(v)).filter(Boolean);
    return [...new Set([...raw, ...normalized, ...canonical].filter(Boolean))];
  }
  #remoteUrls(channel) {
    const keys = Object.keys(this.remoteMap || {});
    for (const candidate of this.#candidateKeys(channel)) {
      if (Array.isArray(this.remoteMap[candidate])) return this.remoteMap[candidate];
      const norm = normalizeId(candidate);
      const exact = keys.find(key => normalizeId(key) === norm);
      if (exact && Array.isArray(this.remoteMap[exact])) return this.remoteMap[exact];
    }
    return [];
  }
  #allRoutes(channel) {
    const curated = (channel.directUrls || []).map(cleanUrl).filter(Boolean);

    // Only persistent D1/My Playlist channels are trusted curated state.
    // URLs parsed from temporary external M3U playlists remain untrusted until
    // the user explicitly saves them into My Playlist.
    const temporary = channel?.sourceTrust === 'temporary';
    const trustedSet = temporary ? new Set() : new Set(curated);
    const sources = [...new Set([...curated, ...this.#remoteUrls(channel)]
      .map(cleanUrl)
      .filter(Boolean)
      .filter(isPlayableMedia)
      .filter(source => !isWrongChannelSource(channel, source))
      .filter(source => trustedSet.has(source) || !BLOCKED.has(source)))];

    const routes = [];
    for (const source of sources) {
      const trusted = trustedSet.has(source);
      if (isSecureUrl(source)) {
        routes.push({ originalUrl: source, playbackUrl: source, route: 'direct', saved: trusted });
      }
      if (isHls(source) && CONFIG.workerForHls) {
        routes.push({ originalUrl: source, playbackUrl: workerUrl(source), route: 'worker', saved: trusted });
      }
    }
    return routes.filter((item, index, arr) => arr.findIndex(other => other.playbackUrl === item.playbackUrl) === index);
  }
  getSources(channel) {
    return this.#allRoutes(channel)
      .filter(route => !this.health.isCoolingDown(route.playbackUrl))
      .sort((a, b) => {
        if (a.saved !== b.saved) return a.saved ? -1 : 1;
        if (a.originalUrl === b.originalUrl && a.route !== b.route) {
          if (a.route === 'direct') return -1;
          if (b.route === 'direct') return 1;
        }
        return this.health.score(b.playbackUrl) - this.health.score(a.playbackUrl);
      });
  }
  getStats(channel) {
    const all = this.#allRoutes(channel);
    const cooling = all.filter(route => this.health.isCoolingDown(route.playbackUrl)).length;
    return { total: all.length, active: all.length - cooling, cooling };
  }
}
