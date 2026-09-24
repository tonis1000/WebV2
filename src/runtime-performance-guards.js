const BUILD_ID = '20260924-0635';
const CLOUD_PLAYLIST_CACHE_TTL_MS = 3000;
const TEMPORARY_PLAYLIST_CACHE_TTL_MS = 5 * 60 * 1000;
const BAD_LOGO_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="42" height="42"%3E%3Crect width="100%25" height="100%25" rx="8" fill="%2310161c"/%3E%3C/svg%3E';
const SLOW_LOGO_URLS = new Set([
  'https://i.ibb.co/f2rCKjh/mega.jpg',
]);

function sanitizeImageUrl(value = '') {
  const url = String(value || '').trim();
  if (!url) return url;
  if (/^https?:\/\/goo\.gl\//i.test(url)) return BAD_LOGO_PLACEHOLDER;
  if (SLOW_LOGO_URLS.has(url)) return BAD_LOGO_PLACEHOLDER;
  return url;
}

const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
if (srcDescriptor?.set && srcDescriptor?.get) {
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: srcDescriptor.configurable,
    enumerable: srcDescriptor.enumerable,
    get: srcDescriptor.get,
    set(value) {
      if (this.id !== 'channel-logo' && !this.loading) this.loading = 'lazy';
      if (!this.decoding) this.decoding = 'async';
      return srcDescriptor.set.call(this, sanitizeImageUrl(value));
    },
  });
}

const nativeFetch = window.fetch.bind(window);
let cachedResponse = null;
let cachedAt = 0;
let inFlight = null;
let generation = 0;

function requestInfo(input, init = {}) {
  const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input?.url || '';
  const method = String(init.method || input?.method || 'GET').toUpperCase();
  let url = null;
  try { url = new URL(rawUrl, location.href); } catch {}
  return { url, method };
}

function isRegistryHost(url) {
  return url?.hostname === 'webtv-registry.atonis.workers.dev';
}

function isMyPlaylistRead(url, method) {
  return method === 'GET' && isRegistryHost(url) && url.pathname === '/api/my-playlist';
}

function isMyPlaylistWrite(url, method) {
  return method !== 'GET' && isRegistryHost(url) && url.pathname.startsWith('/api/my-playlist');
}

function myPlaylistCacheTtlMs() {
  const temporary = window.WebTVPlaylistAPI?.getCatalogMode?.() === 'temporary';
  return temporary ? TEMPORARY_PLAYLIST_CACHE_TTL_MS : CLOUD_PLAYLIST_CACHE_TTL_MS;
}

function invalidateMyPlaylistCache() {
  cachedResponse = null;
  cachedAt = 0;
  generation += 1;
}

window.fetch = async function webTvFetch(input, init = {}) {
  const { url, method } = requestInfo(input, init);

  if (isMyPlaylistWrite(url, method)) {
    invalidateMyPlaylistCache();
    const response = await nativeFetch(input, init);
    invalidateMyPlaylistCache();
    return response;
  }

  if (!isMyPlaylistRead(url, method)) return nativeFetch(input, init);

  const ttl = myPlaylistCacheTtlMs();
  if (cachedResponse && cachedAt && (Date.now() - cachedAt) < ttl) return cachedResponse.clone();
  if (inFlight) return (await inFlight).clone();

  const startGeneration = generation;
  inFlight = nativeFetch(input, init)
    .then(response => {
      if (response.ok && startGeneration === generation) {
        cachedResponse = response.clone();
        cachedAt = Date.now();
      }
      return response;
    })
    .finally(() => { inFlight = null; });

  return (await inFlight).clone();
};

window.WebTVRuntimeGuards = {
  buildId: BUILD_ID,
  invalidateMyPlaylistCache,
  sanitizeImageUrl,
};

console.info(`[WebTV] Runtime performance guards loaded · build ${BUILD_ID} · adaptive D1 read cache + image guard`);
