import { CONFIG, CHANNEL_ALIASES, SOURCE_BLOCKLIST } from '../config.js?v=20260924-1115';
import { normalizeId, cleanUrl, parseIptvUrl, workerUrl, isHls, isDash, isVideoFile } from './utils.js?v=20260924-0900';
import { StrmResolver, isStrmReference } from './strm-resolver.js?v=20260924-1919';

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

function headerIdentity(headers = {}) {
  return JSON.stringify(Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)));
}

const BLOCKED = new Set((SOURCE_BLOCKLIST || []).map(cleanUrl).filter(Boolean));
export const SOURCE_REGISTRY_BUILD_ID = '20260924-2215';

export function rankRoutesByHealth(routes = [], health) {
  const families = new Map();
  routes.forEach((route, index) => {
    const key = `${route.saved ? 'saved' : 'remote'}|${route.originalUrl}`;
    if (!families.has(key)) families.set(key, { routes: [], firstIndex: index });
    families.get(key).routes.push(route);
  });

  const score = route => Number(health?.score?.(route.playbackUrl) || 0);
  return [...families.values()]
    .sort((a, b) => {
      const aSaved = a.routes.some(route => route.saved);
      const bSaved = b.routes.some(route => route.saved);
      if (aSaved !== bSaved) return aSaved ? -1 : 1;

      const aScore = Math.max(...a.routes.map(score));
      const bScore = Math.max(...b.routes.map(score));
      if (aScore !== bScore) return bScore - aScore;
      return a.firstIndex - b.firstIndex;
    })
    .flatMap(family => family.routes.sort((a, b) => {
      if (a.route === b.route) return 0;
      if (a.route === 'direct') return -1;
      if (b.route === 'direct') return 1;
      return score(b) - score(a);
    }));
}

export class SourceRegistry {
  constructor(healthStore) {
    this.health = healthStore;
    this.remoteMap = {};
    this.aliasIndex = this.#buildAliasIndex();
    this.strm = new StrmResolver({ timeoutMs: Math.min(CONFIG.requestTimeoutMs || 5000, 5000) });
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
  #cachedCuratedSources(channel) {
    const out = [];
    for (const source of channel.directUrls || []) {
      if (!isStrmReference(source)) {
        out.push(source);
        continue;
      }
      const resolved = this.strm.peek(source);
      const info = this.strm.peekInfo(source);
      // DRM STRM references need license configuration that the current
      // PlayerController does not provide. Do not inject them as fake fallbacks.
      if (resolved && !info?.drm) out.push(resolved);
    }
    return out;
  }
  async #resolvedCuratedSources(channel) {
    const resolved = await Promise.all((channel.directUrls || []).map(async source => {
      if (!isStrmReference(source)) return source;
      const resolvedUrl = await this.strm.resolve(source);
      const info = this.strm.peekInfo(source);
      // Keep DRM references visible to diagnostics, but skip them in playback
      // until PlayerController has explicit EME/Widevine license support.
      return info?.drm ? '' : resolvedUrl;
    }));
    return resolved.filter(Boolean);
  }
  #allRoutes(channel, curatedOverride = null) {
    const curatedRaw = curatedOverride || this.#cachedCuratedSources(channel);
    const curated = curatedRaw
      .map(raw => ({ raw, ...parseIptvUrl(raw) }))
      .filter(item => item.url);

    // Only persistent D1/My Playlist channels are trusted curated state.
    // URLs parsed from temporary external M3U playlists remain untrusted until
    // the user explicitly saves them into My Playlist.
    const temporary = channel?.sourceTrust === 'temporary';
    const trustedSet = temporary ? new Set() : new Set(curated.map(item => item.url));

    const seen = new Set();
    const sources = [];
    for (const raw of [...curatedRaw, ...this.#remoteUrls(channel)]) {
      const parsed = parseIptvUrl(raw);
      const source = parsed.url;
      if (!source || !isPlayableMedia(source)) continue;
      if (isWrongChannelSource(channel, source)) continue;
      if (!trustedSet.has(source) && BLOCKED.has(source)) continue;

      const key = `${source}|${headerIdentity(parsed.headers)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push({ ...parsed, trusted: trustedSet.has(source) });
    }

    const routes = [];
    for (const source of sources) {
      if (isSecureUrl(source.url)) {
        routes.push({
          originalUrl: source.url,
          playbackUrl: source.url,
          route: 'direct',
          saved: source.trusted,
          requestHeaders: {},
        });
      }
      if (isHls(source.url) && CONFIG.workerForHls) {
        routes.push({
          originalUrl: source.url,
          playbackUrl: workerUrl(source.url, source.headers),
          route: Object.keys(source.headers).length ? 'worker+headers' : 'worker',
          saved: source.trusted,
          requestHeaders: source.headers,
        });
      }
    }

    return routes.filter((item, index, arr) => arr.findIndex(other => other.playbackUrl === item.playbackUrl) === index);
  }
  async getSources(channel) {
    // localStorage is the canonical route-health state. Refresh immediately
    // before every selection so ranking cannot use a stale in-memory snapshot.
    this.health.refresh?.();
    const curated = await this.#resolvedCuratedSources(channel);
    const all = this.#allRoutes(channel, curated);
    const activeDirectOriginals = new Set(all
      .filter(route => route.route === 'direct' && !this.health.isCoolingDown(route.playbackUrl))
      .map(route => route.originalUrl));

    const active = all.filter(route => {
      if (!this.health.isCoolingDown(route.playbackUrl)) return true;
      // Keep one cooled Worker route available as a rescue sibling while the
      // direct HLS route is still eligible. PlayerController already suppresses
      // sibling retries for terminal 404/410, so this specifically restores
      // proxy rescue after direct CORS/403 or transient browser failures.
      return route.route.startsWith('worker') && activeDirectOriginals.has(route.originalUrl);
    });

    // Rank complete source families. A proven-good family must beat older weak
    // families, while DIRECT remains the first attempt inside that family.
    return rankRoutesByHealth(active, this.health);
  }
  getStats(channel) {
    const all = this.#allRoutes(channel);
    const unresolvedReferences = (channel.directUrls || []).filter(source => isStrmReference(source) && !this.strm.peek(source)).length;
    const cooling = all.filter(route => this.health.isCoolingDown(route.playbackUrl)).length;
    return {
      total: all.length + unresolvedReferences,
      active: all.length - cooling + unresolvedReferences,
      cooling,
      pending: unresolvedReferences,
    };
  }
}
