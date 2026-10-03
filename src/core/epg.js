import { CONFIG } from '../config.js';
import { resolveGreekIdentity } from './channel-identity-gr.js';
import { getChannelProfileById } from './channel-profile-gr.js';
import { normalizeId, formatTime } from './utils.js';

const GLOBAL_EPG_KEY = '__webtv_epg_service_singleton__';
const MIN_REFRESH_GAP_MS = 60 * 1000;
const IDENTITY_INDEX_PREFIX='@identity:';

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

  return [...variants];
}

function identityIndexKey(id=''){return `${IDENTITY_INDEX_PREFIX}${String(id||'').trim()}`;}

function identityState(values=[]){
  const identities=values.map(resolveGreekIdentity).filter(Boolean);
  const unique=new Map(identities.map(identity=>[identity.id,identity]));
  if(unique.size>1)return{identity:null,conflict:true};
  return{identity:unique.values().next().value||null,conflict:false};
}

function candidateValues(values=[],identity=null,profile=null){
  return [...new Set([
    ...values,
    ...(profile?.epg?.aliases||[]),
    ...(identity?.aliases||[]),
  ].map(value=>String(value||'').trim()).filter(Boolean))];
}

export class EpgService {
  constructor() {
    const existing = globalThis[GLOBAL_EPG_KEY];
    if (existing) return existing;
    this.programs = new Map();
    this.resolveIndex = new Map();
    this.programKeyIndex = new Map();
    this.refreshPromise = null;
    this.lastRefreshAt = 0;
    globalThis[GLOBAL_EPG_KEY] = this;
  }

  async refresh({ force = false, channels = [] } = {}) {
    if (this.refreshPromise) return this.refreshPromise;
    if (!force && this.lastRefreshAt && (Date.now() - this.lastRefreshAt) < MIN_REFRESH_GAP_MS) return;

    this.refreshPromise = this.#refreshNow(channels)
      .finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  async #refreshNow(channels = []) {
    const primary = this.#scopedUrl(CONFIG.epgUrl, channels);
    const urls = [...new Set([primary, CONFIG.epgFallbackUrl].filter(Boolean))];
    this.programs.clear();
    this.resolveIndex.clear();
    this.programKeyIndex.clear();

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
        this.programKeyIndex.clear();
      }
    }

    throw new Error(errors.join(' · ') || 'No usable EPG feed available');
  }

  #scopedUrl(base, channels = []) {
    if (!base) return '';
    const terms = [...new Set((Array.isArray(channels) ? channels : []).map(channel =>
      String(channel?.id || channel?.originalId || channel?.name || '').trim()
    ).filter(Boolean))].slice(0, 80);
    if (!terms.length) return base;
    try {
      const url = new URL(base);
      url.searchParams.set('channels', terms.join(','));
      return url.toString();
    } catch {
      return base;
    }
  }

  #indexValue(value, id) {
    for (const variant of epgVariants(value)) {
      const norm = normalizeId(variant);
      if (norm) this.resolveIndex.set(norm, id);
      const identity=resolveGreekIdentity(variant);
      if(identity)this.resolveIndex.set(identityIndexKey(identity.id),id);
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
      const category = (programme.querySelector('category')?.textContent || '').trim();
      const image = programme.querySelector('icon')?.getAttribute('src') || '';
      if (!channel || !start || !stop || !title) continue;
      if (!this.programs.has(channel)) this.programs.set(channel, []);
      this.programs.get(channel).push({ start, stop, title, description, category, image });
    }

    return true;
  }

  #finalize() {
    this.programKeyIndex.clear();
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

      for (const variant of epgVariants(channel)) {
        const norm = normalizeId(variant);
        if (norm && !this.programKeyIndex.has(norm)) this.programKeyIndex.set(norm, channel);
        const identity=resolveGreekIdentity(variant);
        const identityKey=identity?identityIndexKey(identity.id):'';
        if(identityKey&&!this.programKeyIndex.has(identityKey))this.programKeyIndex.set(identityKey,channel);
      }
    }
  }

  #resolve(channel) {
    const values=[channel?.id,channel?.originalId,channel?.name].map(value=>String(value||'').trim()).filter(Boolean);
    const {identity,conflict}=identityState(values);
    if(conflict)return null;

    const profile=identity&&!identity.legacy?getChannelProfileById(identity.id):null;
    const identityKey=identity?identityIndexKey(identity.id):'';
    if(identityKey&&this.resolveIndex.has(identityKey))return this.resolveIndex.get(identityKey);
    if(identityKey&&this.programKeyIndex.has(identityKey))return this.programKeyIndex.get(identityKey);

    for(const candidate of candidateValues(values,identity,profile)){
      for(const variant of epgVariants(candidate)){
        const norm=normalizeId(variant);
        if(norm&&this.resolveIndex.has(norm))return this.resolveIndex.get(norm);
        if(norm&&this.programKeyIndex.has(norm))return this.programKeyIndex.get(norm);
      }
    }

    return null;
  }

  getSchedule(channel, { from = null, to = null, limit = 240 } = {}) {
    const resolved = this.#resolve(channel);
    const list = resolved ? (this.programs.get(resolved) || []) : [];
    const fromMs = from ? new Date(from).getTime() : -Infinity;
    const toMs = to ? new Date(to).getTime() : Infinity;
    return list
      .filter(item => item.stop.getTime() > fromMs && item.start.getTime() < toMs)
      .slice(0, Math.max(1, Number(limit) || 240))
      .map(item => ({ ...item }));
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
