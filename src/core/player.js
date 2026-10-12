import { CONFIG, OFFICIAL_FALLBACKS } from '../config.js';
import { isHls, isDash, isVideoFile, normalizeId } from './utils.js';

const HARD_HTTP_STATUSES = new Set([403, 404, 410]);
const TERMINAL_SIBLING_STATUSES = new Set([404, 410]);
const VINDRAL_DEMO_CHANNELS = new Set([
  'vindral_demo1_ci_099ee1fa-80f3-455e-aa23-3d184e93e04f',
  'vindral_demo2_ci_dbd1ca98-4e05-4a36-8215-0e8bca295ed2',
  'vindral_demo3_ci_e922b823-3746-481d-bdde-57f356989f71',
]);

const EMBED_PROVIDER_POLICIES = Object.freeze([
  Object.freeze({
    id: 'youtube-embed',
    provider: 'youtube',
    matches(url) {
      return url.hostname === 'www.youtube-nocookie.com' && url.pathname.startsWith('/embed/');
    },
  }),
  Object.freeze({
    id: 'vindral-demo-embed',
    provider: 'vindral',
    matches(url) {
      const channelId = url.searchParams.get('core.channelId') || '';
      return url.hostname === 'player.vindral.com'
        && url.pathname === '/'
        && VINDRAL_DEMO_CHANNELS.has(channelId)
        && !url.searchParams.has('core.authenticationToken');
    },
  }),
]);
const MEDIA_LIBRARIES = {
  hls: {url:'https://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.min.js',ready:()=>Boolean(window.Hls?.isSupported)},
  dash: {url:'https://cdn.dashjs.org/v4.7.4/dash.all.min.js',ready:()=>Boolean(window.dashjs?.MediaPlayer)},
};
const mediaLibraryLoads = new Map();
function loadMediaLibrary(kind) {
  const library=MEDIA_LIBRARIES[kind];
  if(library.ready())return Promise.resolve();
  if(mediaLibraryLoads.has(kind))return mediaLibraryLoads.get(kind);
  const promise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=library.url;script.async=true;
    const timer=setTimeout(()=>{script.remove();reject(new Error(`${kind} player library timed out`));},12000);
    script.onload=()=>{clearTimeout(timer);library.ready()?resolve():reject(new Error(`${kind} player library unavailable`));};
    script.onerror=()=>{clearTimeout(timer);reject(new Error(`${kind} player library failed to load`));};
    document.head.appendChild(script);
  }).catch(error=>{mediaLibraryLoads.delete(kind);throw error;});
  mediaLibraryLoads.set(kind,promise);
  return promise;
}

function readHttpStatus(data = {}) {
  const candidates = [
    data?.response?.code,
    data?.response?.status,
    data?.networkDetails?.status,
    data?.networkDetails?.statusCode,
    data?.networkDetails?.response?.status,
  ];
  for (const value of candidates) {
    const status = Number(value);
    if (Number.isFinite(status) && status >= 100) return status;
  }
  return 0;
}

export function routeMediaType(route = {}) {
  const mediaUrl = route.originalUrl || route.playbackUrl || '';
  if (isHls(mediaUrl)) return 'hls';
  if (isDash(mediaUrl)) return 'dash';
  if (isVideoFile(mediaUrl)) return 'video';
  return '';
}

export function normalizeEmbedRoute(route = {}) {
  const value = String(route.embedUrl || route.playbackUrl || '').trim();
  if (!value) throw new Error('Embed URL is required');

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Embed URL is invalid');
  }
  if (url.protocol !== 'https:') throw new Error('Embed URL is not allowed');

  const policy = EMBED_PROVIDER_POLICIES.find(item => item.matches(url));
  if (!policy) throw new Error('Embed URL is not allowed');

  const providerHint = String(route.provider || '').trim().toLowerCase();
  if (providerHint && providerHint !== policy.provider) {
    throw new Error('Embed provider does not match URL policy');
  }

  return {
    ...route,
    originalUrl: route.originalUrl || url.href,
    playbackUrl: url.href,
    route: route.route || 'embed',
    provider: policy.provider,
    player: 'embed',
    verifiedPlayback: false,
  };
}

export function resolvePlaybackProvider(route = {}) {
  const mediaType = routeMediaType(route);
  if (mediaType === 'hls') return Object.freeze({ id: 'hls', kind: 'media', verifiedPlayback: true });
  if (mediaType === 'dash') return Object.freeze({ id: 'dash', kind: 'media', verifiedPlayback: true });
  if (mediaType === 'video') return Object.freeze({ id: 'native-video', kind: 'media', verifiedPlayback: true });

  const embedCandidate = route.player === 'embed'
    || route.route === 'embed'
    || Boolean(route.provider)
    || Boolean(route.embedUrl);
  if (!embedCandidate) return null;

  try {
    const normalized = normalizeEmbedRoute(route);
    const url = new URL(normalized.playbackUrl);
    const policy = EMBED_PROVIDER_POLICIES.find(item => item.matches(url));
    return policy ? Object.freeze({ id: policy.id, kind: 'embed', verifiedPlayback: false }) : null;
  } catch {
    return null;
  }
}

export function officialFallbackFor(channel = {}) {
  const key = normalizeId(channel?.id || channel?.originalId || channel?.name || '');
  return OFFICIAL_FALLBACKS[key] || null;
}

function isTrustedEmbedUrl(value = '') {
  try {
    return Boolean(resolvePlaybackProvider({ playbackUrl: value, route: 'embed' }));
  } catch {
    return false;
  }
}

export class PlayerController {
  constructor({ video, iframe, emptyState, health, onState, onDiagnostics }) {
    this.video = video;
    this.iframe = iframe;
    this.emptyState = emptyState;
    this.health = health;
    this.onState = onState || (() => {});
    this.onDiagnostics = onDiagnostics || (() => {});
    this.hls = null;
    this.dash = null;
    this.token = 0;
  }

  async play(channel, routes, { allowOfficialFallback = true, allowUnverifiedEmbed = false } = {}) {
    const token = ++this.token;
    const officialFallback = allowOfficialFallback ? officialFallbackFor(channel) : null;
    this.#resetMedia();
    this.onState('loading', 'Connecting');

    if (!routes.length) {
      if (officialFallback) return this.#playOfficialFallback(officialFallback, token);
      this.onState('error', 'No active routes');
      throw new Error(`No active playback routes for ${channel.name}`);
    }

    let lastError = null;
    const terminalOriginals = new Set();
    for (const route of routes) {
      if (token !== this.token) return null;
      if (!route.saved && terminalOriginals.has(route.originalUrl)) continue;
      const startedAt = performance.now();
      try {
        const attempt = await this.#attempt(route, token);
        const startupMs = Math.round(performance.now() - startedAt);
        const player = typeof attempt === 'string' ? attempt : attempt.player;
        const verifiedPlayback = typeof attempt === 'string' ? true : Boolean(attempt.verifiedPlayback);

        if (!verifiedPlayback && !allowUnverifiedEmbed) {
          lastError = new Error('Embed loaded but playback not confirmed');
          this.onDiagnostics({
            source: route.originalUrl,
            playbackUrl: route.playbackUrl,
            route: route.route,
            player,
            startupMs,
            verifiedPlayback: false,
            error: lastError.message,
          });
          this.#resetMedia();
          continue;
        }

        if (verifiedPlayback) {
          this.health.recordSuccess(route.playbackUrl, { startupMs, player, route: route.route });
        }
        const result = {
          ok: true,
          source: route.originalUrl,
          playbackUrl: route.playbackUrl,
          route: route.route,
          player,
          startupMs,
          fallback: false,
          verifiedPlayback,
        };
        this.onDiagnostics(result);
        this.onState(verifiedPlayback ? 'live' : 'fallback', verifiedPlayback ? 'Live' : 'Embed loaded');
        return result;
      } catch (error) {
        if (token !== this.token) return null;
        lastError = error;
        const httpStatus = Number(error?.httpStatus) || 0;
        const hardDead = !route.saved && HARD_HTTP_STATUSES.has(httpStatus);
        const entry = this.health.recordFailure(route.playbackUrl, {
          hardCooldownMs: hardDead ? CONFIG.failureCooldownMaxMs : 0,
          reason: httpStatus ? `HTTP ${httpStatus}` : error.message,
        });

        if (hardDead && TERMINAL_SIBLING_STATUSES.has(httpStatus)) {
          terminalOriginals.add(route.originalUrl);
          for (const sibling of routes) {
            if (sibling === route || sibling.saved || sibling.originalUrl !== route.originalUrl) continue;
            this.health.quarantine(sibling.playbackUrl, {
              cooldownMs: CONFIG.failureCooldownMaxMs,
              reason: `HTTP ${httpStatus} sibling source`,
            });
          }
        }

        const cooling = (entry.cooldownUntil || 0) > Date.now();
        const permanentText = hardDead ? ` · HTTP ${httpStatus} quarantine` : '';
        this.onDiagnostics({ source: route.originalUrl, route: route.route, player: 'failed', startupMs: 0, error: cooling ? `${error.message}${permanentText} · cooldown` : `${error.message}${permanentText}` });
        this.#resetMedia();
      }
    }

    if (officialFallback && token === this.token) {
      try {
        return await this.#playOfficialFallback(officialFallback, token);
      } catch (error) {
        lastError = error;
      }
    }

    this.onState('error', 'Playback failed');
    throw lastError || new Error('All playback routes failed');
  }

  // Manual source selection is deliberately a single-route attempt. The
  // existing automatic mode retains multi-route retries and official fallback.
  async playSelectedRoute(channel, route) {
    if (!route?.playbackUrl && !route?.embedUrl) {
      throw new Error('A playback route must be selected');
    }
    const isEmbed = route.player === 'embed'
      || route.route === 'embed'
      || Boolean(route.embedUrl);
    const selected = isEmbed ? normalizeEmbedRoute(route) : route;
    return this.play(channel, [selected], {
      allowOfficialFallback: false,
      allowUnverifiedEmbed: isEmbed,
    });
  }

  stop() {
    this.token += 1;
    this.#resetMedia();
    this.onState('idle', 'Idle');
  }

  #resetMedia() {
    if (this.hls) { try { this.hls.destroy(); } catch {} this.hls = null; }
    if (this.dash) { try { this.dash.reset(); } catch {} this.dash = null; }
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.video.hidden = true;
    this.iframe.onload = null;
    this.iframe.onerror = null;
    this.iframe.src = 'about:blank';
    this.iframe.hidden = true;
    this.emptyState.hidden = false;
  }

  async #attempt(route, token) {
    const provider = resolvePlaybackProvider(route);
    if (!provider) throw new Error('Unsupported non-media source');

    const url = route.playbackUrl;
    if (provider.id === 'hls') return this.#playHls(url, token);
    if (provider.id === 'dash') return this.#playDash(url, token);
    if (provider.id === 'native-video') return this.#playNative(url, token, 'native-video');
    if (provider.kind === 'embed') return this.#playEmbed(route, provider, token);
    throw new Error('Unsupported playback provider');
  }

  async #playEmbed(route, provider, token) {
    const normalized = normalizeEmbedRoute(route);
    this.#resetMedia();
    this.onState('loading', provider.id);
    this.emptyState.hidden = true;
    this.video.hidden = true;
    this.iframe.hidden = false;

    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timeout);
        this.iframe.onload = null;
        this.iframe.onerror = null;
      };
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      };
      const onLoad = () => {
        if (token !== this.token) return done(reject, new Error('Superseded'));
        done(resolve, { player: provider.id, verifiedPlayback: false });
      };
      const onError = () => done(reject, new Error(`${provider.id} iframe error`));
      const timeout = setTimeout(
        () => done(reject, new Error(`${provider.id} startup timeout`)),
        CONFIG.startupTimeoutMs
      );
      this.iframe.onload = onLoad;
      this.iframe.onerror = onError;
      this.iframe.src = normalized.playbackUrl;
    });
  }

  async #playOfficialFallback(fallback, token) {
    const embedUrl = String(fallback?.embedUrl || '');
    if (!isTrustedEmbedUrl(embedUrl)) throw new Error('Official fallback rejected: untrusted embed URL');

    this.#resetMedia();
    this.onState('loading', fallback.label || 'Official fallback');
    this.emptyState.hidden = true;
    this.video.hidden = true;
    this.iframe.hidden = false;

    const startedAt = performance.now();
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timeout);
        this.iframe.onload = null;
        this.iframe.onerror = null;
      };
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      };
      const onLoad = () => {
        if (token !== this.token) return done(reject, new Error('Superseded'));
        const startupMs = Math.round(performance.now() - startedAt);
        const playerName = fallback.player || 'iframe';
        const routeName = fallback.route || 'official-fallback';
        const result = {
          ok: true,
          source: fallback.externalUrl || embedUrl,
          playbackUrl: embedUrl,
          route: routeName,
          player: playerName,
          startupMs,
          fallback: true,
          verifiedPlayback: false,
        };
        this.onDiagnostics(result);
        this.onState('fallback', fallback.label || 'Official loaded');
        done(resolve, result);
      };
      const onError = () => done(reject, new Error('Official fallback iframe error'));
      const timeout = setTimeout(() => done(reject, new Error('Official fallback startup timeout')), CONFIG.startupTimeoutMs);
      this.iframe.onload = onLoad;
      this.iframe.onerror = onError;
      this.iframe.src = embedUrl;
    });
  }

  #showVideo() {
    this.emptyState.hidden = true;
    this.iframe.hidden = true;
    this.video.hidden = false;
  }

  #waitForVideo(token, playerName) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timeout);
        this.video.removeEventListener('playing', onPlaying);
        this.video.removeEventListener('error', onError);
      };
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      };
      const onPlaying = () => token === this.token ? done(resolve, playerName) : done(reject, new Error('Superseded'));
      const onError = () => done(reject, new Error(`${playerName} media error`));
      const timeout = setTimeout(() => done(reject, new Error(`${playerName} startup timeout`)), CONFIG.startupTimeoutMs);
      this.video.addEventListener('playing', onPlaying, { once: true });
      this.video.addEventListener('error', onError, { once: true });
    });
  }

  async #playHls(url, token) {
    this.#showVideo();
    if(!this.video.canPlayType('application/vnd.apple.mpegurl'))await loadMediaLibrary('hls');
    if(token!==this.token)throw new Error('Superseded');
    if (window.Hls?.isSupported()) {
      this.hls = new window.Hls({
        enableWorker: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 10,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        manifestLoadingTimeOut: CONFIG.requestTimeoutMs,
        levelLoadingTimeOut: CONFIG.requestTimeoutMs,
        fragLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 1,
        levelLoadingMaxRetry: 1,
        fragLoadingMaxRetry: 2,
      });
      const hls = this.hls;
      return new Promise((resolve, reject) => {
        let settled = false;
        let recoveryUsed = false;
        let timeout = null;

        const armTimeout = () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => done(reject, new Error('hls.js startup timeout')), CONFIG.startupTimeoutMs);
        };
        const cleanup = () => {
          clearTimeout(timeout);
          this.video.removeEventListener('playing', onPlaying);
          this.video.removeEventListener('error', onVideoError);
          try { hls.off(window.Hls.Events.ERROR, onHlsError); } catch {}
        };
        const done = (fn, value) => {
          if (settled) return;
          settled = true;
          cleanup();
          fn(value);
        };
        const onPlaying = () => token === this.token ? done(resolve, recoveryUsed ? 'hls.js+recovery' : 'hls.js') : done(reject, new Error('Superseded'));
        const onVideoError = () => done(reject, new Error('hls.js media error'));
        const onHlsError = (_event, data) => {
          if (!data?.fatal) return;
          const detail = data.details || data.type || 'fatal error';
          const httpStatus = readHttpStatus(data);

          if (HARD_HTTP_STATUSES.has(httpStatus)) {
            const error = new Error(`hls.js ${detail} · HTTP ${httpStatus}`);
            error.httpStatus = httpStatus;
            done(reject, error);
            return;
          }

          if (!recoveryUsed && token === this.token) {
            if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
              recoveryUsed = true;
              armTimeout();
              try { hls.startLoad(); return; } catch {}
            }
            if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
              recoveryUsed = true;
              armTimeout();
              try { hls.recoverMediaError(); return; } catch {}
            }
          }

          const error = new Error(`hls.js ${detail}${recoveryUsed ? ' after recovery' : ''}${httpStatus ? ` · HTTP ${httpStatus}` : ''}`);
          if (httpStatus) error.httpStatus = httpStatus;
          done(reject, error);
        };

        this.video.addEventListener('playing', onPlaying, { once: true });
        this.video.addEventListener('error', onVideoError, { once: true });
        hls.on(window.Hls.Events.ERROR, onHlsError);
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
          if (token === this.token) this.video.play().catch(() => {});
        });
        armTimeout();
        hls.loadSource(url);
        hls.attachMedia(this.video);
      });
    }
    if (this.video.canPlayType('application/vnd.apple.mpegurl')) return this.#playNative(url, token, 'native-hls');
    throw new Error('HLS is not supported');
  }

  async #playDash(url, token) {
    await loadMediaLibrary('dash');
    if(token!==this.token)throw new Error('Superseded');
    if (!window.dashjs?.MediaPlayer) throw new Error('dash.js unavailable');
    this.#showVideo();
    this.dash = window.dashjs.MediaPlayer().create();
    this.dash.initialize(this.video, url, true);
    return this.#waitForVideo(token, 'dash.js');
  }

  async #playNative(url, token, name) {
    this.#showVideo();
    this.video.src = url;
    this.video.load();
    this.video.play().catch(() => {});
    return this.#waitForVideo(token, name);
  }
}
