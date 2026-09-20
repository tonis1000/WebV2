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

export class EpgService {
  constructor() {
    this.programs = new Map();
    this.resolveIndex = new Map();
  }

  async refresh() {
    const urls = [...new Set([CONFIG.epgUrl, CONFIG.epgFallbackUrl].filter(Boolean))];
    const results = await Promise.allSettled(urls.map(async url => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
      return { url, xml: await response.text() };
    }));

    const feeds = results.filter(result => result.status === 'fulfilled').map(result => result.value);
    if (!feeds.length) {
      const reasons = results.map(result => result.status === 'rejected' ? result.reason?.message : '').filter(Boolean).join(' · ');
      throw new Error(reasons || 'No EPG feed available');
    }

    this.programs.clear();
    this.resolveIndex.clear();
    for (const feed of feeds) this.#merge(feed.xml);
    this.#finalize();
  }

  #merge(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid XMLTV document');

    for (const channel of doc.querySelectorAll('channel')) {
      const id = channel.getAttribute('id') || '';
      if (!id) continue;
      this.resolveIndex.set(normalizeId(id), id);
      for (const name of channel.querySelectorAll('display-name')) {
        const value = (name.textContent || '').trim();
        if (value) this.resolveIndex.set(normalizeId(value), id);
      }
    }

    for (const programme of doc.querySelectorAll('programme')) {
      const channel = programme.getAttribute('channel') || '';
      const start = parseXmltvTime(programme.getAttribute('start'));
      const stop = parseXmltvTime(programme.getAttribute('stop'));
      const title = (programme.querySelector('title')?.textContent || '').trim();
      const description = (programme.querySelector('desc')?.textContent || '').trim();
      if (!channel || !start || !stop || !title) continue;
      if (!this.programs.has(channel)) this.programs.set(channel, []);
      this.programs.get(channel).push({ start, stop, title, description });
    }
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
    const candidates = [channel.id, channel.originalId, channel.name].filter(Boolean);
    for (const value of [...candidates]) candidates.push(...(CHANNEL_ALIASES[normalizeId(value)] || []));
    for (const candidate of candidates) {
      const norm = normalizeId(candidate);
      if (this.resolveIndex.has(norm)) return this.resolveIndex.get(norm);
      for (const key of this.programs.keys()) if (normalizeId(key) === norm) return key;
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
