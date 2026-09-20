import { CONFIG, CHANNEL_ALIASES } from '../config.js?v=20260920-2248';
import { normalizeId, formatTime } from './utils.js';

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

function epgVariants(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const variants = new Set([raw]);
  const cleaned = raw
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
  if (/^open\s+beyond$/i.test(cleaned)) variants.add('OPEN');
  return [...variants];
}

function aliasCandidates(values = []) {
  const out = new Set();
  for (const value of values) {
    for (const variant of epgVariants(value)) out.add(variant);
  }

  const normalized = new Set([...out].map(normalizeId));
  for (const [canonical, aliases] of Object.entries(CHANNEL_ALIASES)) {
    const aliasNorms = [canonical, ...(aliases || [])].flatMap(epgVariants).map(normalizeId);
    if (aliasNorms.some(norm => normalized.has(norm))) {
      out.add(canonical);
      for (const alias of aliases || []) out.add(alias);
    }
  }
  return [...out];
}

export class EpgService {
  constructor() {
    this.programs = new Map();
    this.resolveIndex = new Map();
  }

  async refresh() {
    const urls = [...new Set([CONFIG.epgUrl, CONFIG.epgFallbackUrl].filter(Boolean))];
    const fetched = await Promise.allSettled(urls.map(async url => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
      return { url, xml: await response.text() };
    }));

    this.programs.clear();
    this.resolveIndex.clear();

    const errors = [];
    let mergedFeeds = 0;

    for (const result of fetched) {
      if (result.status !== 'fulfilled') {
        errors.push(result.reason?.message || 'EPG fetch failed');
        continue;
      }

      try {
        const merged = this.#merge(result.value.xml);
        if (merged) mergedFeeds += 1;
        else errors.push(`${result.value.url}: empty/invalid XMLTV`);
      } catch (error) {
        errors.push(`${result.value.url}: ${error.message}`);
      }
    }

    if (!mergedFeeds) {
      throw new Error(errors.join(' · ') || 'No usable EPG feed available');
    }

    this.#finalize();
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
      for (const variant of epgVariants(id)) this.resolveIndex.set(normalizeId(variant), id);
      for (const name of channel.querySelectorAll('display-name')) {
        const value = (name.textContent || '').trim();
        for (const variant of epgVariants(value)) {
          if (variant) this.resolveIndex.set(normalizeId(variant), id);
        }
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
      if (this.resolveIndex.has(norm)) return this.resolveIndex.get(norm);
      for (const key of this.programs.keys()) {
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
