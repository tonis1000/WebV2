import { CONFIG, CHANNEL_ALIASES } from '../config.js?v=20260923-2215';
import { normalizeId, formatTime } from './utils.js?v=20260920-1021';

const GLOBAL_EPG_KEY = '__webtv_epg_service_singleton__';
const MIN_REFRESH_GAP_MS = 60 * 1000;

function parseXmltvTime(value = '') {
  const match = String(value).trim().match(/^(\d{14})(?:\s*([+-]\d{2}:?\d{2}|Z))?$/i);
  if (!match) return null;
  const d = match[1];
  const [y, mo, day, h, mi, s] = [d.slice(0,4), d.slice(4,6), d.slice(6,8), d.slice(8,10), d.slice(10,12), d.slice(12,14)].map(Number);
  let ms = Date.UTC(y, mo - 1, day, h, mi, s);
  const tz = (match[2] || 'Z').toUpperCase();
  if (tz !== 'Z') {
    const t = tz.match(/^([+-])(\d{2}):?(\d{2})$/);
    if (!t) return null;
    const sign = t[1] === '-' ? -1 : 1;
    ms -= sign * ((Number(t[2]) * 60) + Number(t[3])) * 60000;
  }
  return new Date(ms);
}

const KNOWN_CHANNEL_KEYS = [
  'ertnews', 'ert1', 'ert2', 'ert3', 'ant1', 'alpha', 'skai', 'open', 'mega', 'star', 'action24', 'kontra'
];

function canonicalChannelKey(value = '') {
  let norm = normalizeId(String(value || ''));
  if (!norm) return '';

  norm = norm
    .replace(/\p{Lm}/gu, '')
    .replace(/[ᴴᴰ]/gu, '')
    .replace(/(?:fullhd|fhd|uhd|hd|4k)$/giu, '')
    .replace(/(?:channel|tv)$/giu, '');

  if (norm.startsWith('openbeyond')) return 'open';
  if (norm.startsWith('megachannel')) return 'mega';
  if (norm.startsWith('alphatv')) return 'alpha';
  if (norm.startsWith('skaitv')) return 'skai';
  if (norm.startsWith('startv')) return 'star';
  if (norm.startsWith('ertnews')) return 'ertnews';

  for (const key of KNOWN_CHANNEL_KEYS) {
    if (norm === key || norm.startsWith(key)) return key;
  }

  return norm;
}

function epgVariants(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return [];

  const variants = new Set([raw]);
  const cleaned = raw
    .replace(/\p{Lm}/gu, '')
    .replace(/[ᴴᴰ]/gu, '')
    .replace(/\bUHD\b/gi, '')
    .replace(/\bFULL\s*HD\b/gi, '')
    .replace(/\bFHD\b/gi, '')
    .replace(/\bHD\b/gi, '')
    .replace(/\b4K\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned) variants.add(cleaned);

  const withoutTv = cleaned.replace(/\bTV\b/gi, '').replace(/\s+/g, ' ').trim();
  if (withoutTv) variants.add(withoutTv);

  const canonical = canonicalChannelKey(raw);
  if (canonical) variants.add(canonical);

  if (/^open\s+beyond$/i.test(cleaned)) variants.add('OPEN');

  return [...variants];
}

function aliasCandidates(values = []) {
  const out = new Set();

  for (const value of values) {
    for (const variant of epgVariants(value)) out.add(variant);
  }

  const normalized = new Set([...out].flatMap(value => [normalizeId(value), canonicalChannelKey(value)]).filter(Boolean));

  for (const [canonical, aliases] of Object.entries(CHANNEL_ALIASES)) {
    const aliasNorms = [canonical, ...(aliases || [])]
      .flatMap(epgVariants)
      .flatMap(value => [normalizeId(value), canonicalChannelKey(value)])
      .filter(Boolean);

    if (aliasNorms.some(norm => normalized.has(norm))) {
      out.add(canonical);
      for (const alias of aliases || []) out.add(alias);
    }
  }

  return [...out];
}

export class EpgService {
  constructor() {
    const existing = globalThis[GLOBAL_EPG_KEY];
    if (existing) return existing;
    this.programs = new Map();
    this.resolveIndex = new Map();
    this.refreshPromise = null;
    this.lastRefreshAt = 0;
    globalThis[GLOBAL_EPG_KEY] = this;
  }

  async refresh({ force = false } = {}) {
    if (this.refreshPromise) return this.refreshPromise;
    if (!force && this.lastRefreshAt && (Date.now() - this.lastRefreshAt) < MIN_REFRESH_GAP_MS) return;

    this.refreshPromise = this.#refreshNow()
      .finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  async #refreshNow() {
    const urls = [...new Set([CONFIG.epgUrl, CONFIG.epgFallbackUrl].filter(Boolean))];
    this.programs.clear();
    this.resolveIndex.clear();

    const errors = [];
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
        const xml = await response.text();
        const merged = this.#merge(xml);
        if (!merged) throw new Error(`${url}: empty/invalid XMLTV`);
        this.#finalize();
        this.lastRefreshAt = Date.now();
        globalThis.dispatchEvent?.(new CustomEvent('webtv:epg-updated', { detail: { at: this.lastRefreshAt } }));
        return;
      } catch (error) {
        errors.push(error?.message || `EPG fetch failed · ${url}`);
        this.programs.clear();
        this.resolveIndex.clear();
      }
    }

    throw new Error(errors.join(' · ') || 'No usable EPG feed available');
  }

  #indexValue(value, id) {
    for (const variant of epgVariants(value)) {
      const norm = normalizeId(variant);
      const canonical = canonicalChannelKey(variant);
      if (norm) this.resolveIndex.set(norm, id);
      if (canonical) this.resolveIndex.set(canonical, id);
    }
  }

  #merge(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid XMLTV document');

    const channels = [...doc.querySelectorAll('channel')];
    const programmes = [...doc.querySelectorAll('programme')];
    if (!channels.length || !programmes.length) return false;

    for (const channel of channels) {
      const id = channel.getAttribute('id') || '';
      if (!id) continue;
      this.#indexValue(id, id);
      for (const name of channel.querySelectorAll('display-name')) {
        const value = (name.textContent || '').trim();
        if (value) this.#indexValue(value, id);
      }
    }

    for (const programme of programmes) {
      const channel = programme.getAttribute('channel') || '';
      const start = parseXmltvTime(programme.getAttribute('start'));
      const stop = parseXmltvTime(programme.getAttribute('stop'));
      const title = (programme.querySelector('title')?.textContent || '').trim();
      const description = (programme.querySelector('desc')?.textContent || '').trim();
      if (!channel || !start || !stop || !title) continue;
      if (!this.programs.has(channel)) this.programs.set(channel, []);
      this.programs.get(channel).push({ start, stop, title, description });
    }

    return true;
  }

  #finalize() {
    for (const [channel, list] of this.programs.entries()) {
      list.sort((a, b) => a.start - b.start);
      const seen = new Set();
      const deduped = list.filter(item => {
        const key = `${item.start.getTime()}|${item.stop.getTime()}|${item.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      this.programs.set(channel, deduped);
    }
  }

  #resolve(channel) {
    const candidates = aliasCandidates([channel.id, channel.originalId, channel.name].filter(Boolean));

    for (const candidate of candidates) {
      const norm = normalizeId(candidate);
      const canonical = canonicalChannelKey(candidate);

      if (canonical && this.resolveIndex.has(canonical)) return this.resolveIndex.get(canonical);
      if (norm && this.resolveIndex.has(norm)) return this.resolveIndex.get(norm);

      for (const key of this.programs.keys()) {
        if (canonical && canonicalChannelKey(key) === canonical) return key;
        for (const variant of epgVariants(key)) {
          if (normalizeId(variant) === norm) return key;
        }
      }
    }

    return null;
  }

  get(channel, now = new Date()) {
    const resolved = this.#resolve(channel);
    const list = resolved ? (this.programs.get(resolved) || []) : [];
    const current = list.find(p => now >= p.start && now < p.stop) || null;
    const next = list.filter(p => p.start > now).slice(0, CONFIG.maxNextPrograms);
    if (!current) return { current: null, next };
    const duration = current.stop - current.start;
    const progress = duration > 0 ? Math.max(0, Math.min(100, ((now - current.start) / duration) * 100)) : 0;
    return { current: { ...current, timeLabel: `${formatTime(current.start)} – ${formatTime(current.stop)}`, progress }, next };
  }
}
