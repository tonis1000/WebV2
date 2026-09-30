import {
  canonicalizeStrmReference,
  isStrmReference,
  parseStrmDocument,
} from './strm-core.js';

export { isStrmReference } from './strm-core.js';

const DEFAULT_TIMEOUT_MS = 5000;
const FAILURE_TTL_MS = 60 * 1000;
const MAX_DEPTH = 3;

function toResolverInfo(parsed = {}, resolvedUrl = '') {
  return {
    resolvedUrl,
    drm: Boolean(parsed?.drm?.detected),
    licenseType: parsed?.drm?.licenseType || '',
    licenseKey: parsed?.drm?.licenseKey || '',
  };
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
    const key = canonicalizeStrmReference(value);
    const entry = key ? this.cache.get(key) : null;
    if (!entry) return '';
    if (!entry.resolvedUrl && entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return '';
    }
    return entry.resolvedUrl || '';
  }

  peekInfo(value = '') {
    const key = canonicalizeStrmReference(value);
    const entry = key ? this.cache.get(key) : null;
    if (!entry || (!entry.resolvedUrl && entry.expiresAt <= Date.now())) return null;
    return entry.info || null;
  }

  async inspect(value = '') {
    await this.resolve(value);
    return this.peekInfo(value);
  }

  async resolve(value = '') {
    const key = canonicalizeStrmReference(value);
    if (!key || !isStrmReference(key)) return '';

    const cached = this.cache.get(key);
    if (cached && (cached.resolvedUrl || cached.expiresAt > Date.now())) {
      return cached.resolvedUrl || '';
    }
    if (this.inFlight.has(key)) return this.inFlight.get(key);

    const task = this.#resolveRecursive(key, 0)
      .then(info => {
        const resolvedUrl = info?.resolvedUrl || '';
        this.cache.set(key, {
          resolvedUrl,
          info: info || { resolvedUrl: '', drm: false, licenseType: '', licenseKey: '' },
          expiresAt: resolvedUrl ? Number.POSITIVE_INFINITY : Date.now() + FAILURE_TTL_MS,
        });
        return resolvedUrl;
      })
      .catch(() => {
        this.cache.set(key, {
          resolvedUrl: '',
          info: { resolvedUrl: '', drm: false, licenseType: '', licenseKey: '' },
          expiresAt: Date.now() + FAILURE_TTL_MS,
        });
        return '';
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, task);
    return task;
  }

  async #resolveRecursive(referenceUrl, depth) {
    if (depth >= MAX_DEPTH) return { resolvedUrl: '', drm: false, licenseType: '', licenseKey: '' };
    const text = await fetchText(referenceUrl, this.timeoutMs);
    const parsed = parseStrmDocument(text);
    const candidate = canonicalizeStrmReference(parsed.mediaUrl);
    if (!candidate) return toResolverInfo(parsed, '');

    if (!isStrmReference(candidate)) {
      return toResolverInfo(parsed, parsed.mediaUrl);
    }

    const nestedCached = this.peekInfo(candidate);
    const nested = nestedCached || await this.#resolveRecursive(candidate, depth + 1);
    return {
      ...nested,
      drm: Boolean(parsed?.drm?.detected) || Boolean(nested?.drm),
      licenseType: parsed?.drm?.licenseType || nested?.licenseType || '',
      licenseKey: parsed?.drm?.licenseKey || nested?.licenseKey || '',
    };
  }
}
