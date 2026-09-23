import { CONFIG } from '../config.js';
import { isHls, isDash, isVideoFile } from './utils.js';

const HARD_HTTP_STATUSES = new Set([403, 404, 410]);

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

  async play(channel, routes) {
    const token = ++this.token;
    this.#resetMedia();
    this.onState('loading', 'Connecting');
    if (!routes.length) {
      this.onState('error', 'No active routes');
      throw new Error(`No active playback routes for ${channel.name}`);
    }
    let lastError = null;
    for (const route of routes) {
      if (token !== this.token) return;
      const startedAt = performance.now();
      try {
        const player = await this.#attempt(route, token);
        const startupMs = Math.round(performance.now() - startedAt);
        this.health.recordSuccess(route.playbackUrl, { startupMs, player, route: route.route });
        this.onDiagnostics({ source: route.originalUrl, route: route.route, player, startupMs });
        this.onState('live', 'Live');
        return;
      } catch (error) {
        if (token !== this.token) return;
        lastError = error;
        const httpStatus = Number(error?.httpStatus) || 0;
        const hardDead = !route.saved && HARD_HTTP_STATUSES.has(httpStatus);
        const entry = this.health.recordFailure(route.playbackUrl, {
          hardCooldownMs: hardDead ? CONFIG.failureCooldownMaxMs : 0,
          reason: httpStatus ? `HTTP ${httpStatus}` : error.message,
        });
        const cooling = (entry.cooldownUntil || 0) > Date.now();
        const permanentText = hardDead ? ` · HTTP ${httpStatus} quarantine` : '';
        this.onDiagnostics({ source: route.originalUrl, route: route.route, player: 'failed', startupMs: 0, error: cooling ? `${error.message}${permanentText} · cooldown` : `${error.message}${permanentText}` });
        this.#resetMedia();
      }
    }
    this.onState('error', 'Playback failed');
    throw lastError || new Error('All playback routes failed');
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
    const url = route.playbackUrl;
    if (isHls(url)) return this.#playHls(url, token);
    if (isDash(url)) return this.#playDash(url, token);
    if (isVideoFile(url)) return this.#playNative(url, token, 'native-video');
    throw new Error('Unsupported non-media source');
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
    if (window.Hls?.isSupported()) {
      this.hls = new window.Hls({
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
              try {
                hls.startLoad();
                return;
              } catch {}
            }
            if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
              recoveryUsed = true;
              armTimeout();
              try {
                hls.recoverMediaError();
                return;
              } catch {}
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
