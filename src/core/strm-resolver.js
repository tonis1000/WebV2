const DEFAULT_TIMEOUT_MS = 5000;
const FAILURE_TTL_MS = 60 * 1000;
const MAX_DEPTH = 3;

function canonicalReferenceUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.hostname === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      const blobIndex = parts.indexOf('blob');
      if (blobIndex === 2 && parts.length > 4) {
        const [owner, repo] = parts;
        const ref = parts[3];
        const path = parts.slice(4).join('/');
        return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
      }
    }
    return url.href;
  } catch {
    return '';
  }
}

export function isStrmReference(value = '') {
  const url = canonicalReferenceUrl(value);
  if (!url) return false;
  try {
    return /\.strm$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function extractHttpUrl(text = '') {
  for (const rawLine of String(text).replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (!/^https?:\/\//i.test(line)) continue;
    // Kodi-style URL options after "|" require custom request headers that the
    // browser player cannot apply. Keep the underlying HTTP media URL.
    const browserUrl = line.split('|', 1)[0].trim();
    if (browserUrl) return browserUrl;
  }
  return '';
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`STRM HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export class StrmResolver {
  constructor({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.timeoutMs = timeoutMs;
    this.cache = new Map();
    this.inFlight = new Map();
  }

  peek(value = '') {
    const key = canonicalReferenceUrl(value);
    const entry = key ? this.cache.get(key) : null;
    if (!entry) return '';
    if (!entry.resolvedUrl && entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return '';
    }
    return entry.resolvedUrl || '';
  }

  async resolve(value = '') {
    const key = canonicalReferenceUrl(value);
    if (!key || !isStrmReference(key)) return '';

    const cached = this.cache.get(key);
    if (cached && (cached.resolvedUrl || cached.expiresAt > Date.now())) {
      return cached.resolvedUrl || '';
    }
    if (this.inFlight.has(key)) return this.inFlight.get(key);

    const task = this.#resolveRecursive(key, 0)
      .then(resolvedUrl => {
        this.cache.set(key, {
          resolvedUrl,
          expiresAt: resolvedUrl ? Number.POSITIVE_INFINITY : Date.now() + FAILURE_TTL_MS,
        });
        return resolvedUrl;
      })
      .catch(() => {
        this.cache.set(key, { resolvedUrl: '', expiresAt: Date.now() + FAILURE_TTL_MS });
        return '';
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, task);
    return task;
  }

  async #resolveRecursive(referenceUrl, depth) {
    if (depth >= MAX_DEPTH) return '';
    const text = await fetchText(referenceUrl, this.timeoutMs);
    const candidate = canonicalReferenceUrl(extractHttpUrl(text));
    if (!candidate) return '';
    if (!isStrmReference(candidate)) return candidate;

    const nestedCached = this.peek(candidate);
    if (nestedCached) return nestedCached;
    return this.#resolveRecursive(candidate, depth + 1);
  }
}
