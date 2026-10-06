import { CONFIG } from '../config.js';
import { resolveGreekIdentity } from './channel-identity-gr.js';
import { getChannelProfileById } from './channel-profile-gr.js';
import { normalizeId, formatTime } from './utils.js';

const GLOBAL_EPG_KEY = '__webtv_epg_service_singleton__';
const MIN_REFRESH_GAP_MS = 60 * 1000;
const EPG_FETCH_RETRY_DELAYS_MS=Object.freeze([0,1200,4000]);
const IDENTITY_INDEX_PREFIX='@identity:';

function sleep(ms=0){return ms>0?new Promise(resolve=>setTimeout(resolve,ms)):Promise.resolve();}
function sanitizeXmltvForBrowser(xml=''){
  return String(xml||'')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
    .replace(/&(?!#\d+;|#x[0-9a-f]+;|amp;|lt;|gt;|quot;|apos;)/gi,'&amp;');
}
function parseXmltvDocument(xmlText=''){
  const raw=String(xmlText||'');
  const parser=new DOMParser();
  let doc=parser.parseFromString(raw,'application/xml');
  if(!doc.querySelector('parsererror'))return doc;
  const sanitized=sanitizeXmltvForBrowser(raw);
  if(sanitized===raw)return doc;
  doc=parser.parseFromString(sanitized,'application/xml');
  return doc;
}

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
    this.guidePrograms = new Map();
    this.guideResolveIndex = new Map();
    this.guideProgramKeyIndex = new Map();
    this.refreshPromise = null;
    this.lastRefreshAt = 0;
    this.lastGuideRefreshAt = 0;
    this.lastGuideScopeKey = '';
    globalThis[GLOBAL_EPG_KEY] = this;
  }

  async refresh({ force = false, channels = [] } = {}) {
    if (this.refreshPromise) return this.refreshPromise;
    if (!force && this.lastRefreshAt && (Date.now() - this.lastRefreshAt) < MIN_REFRESH_GAP_MS) return;

    this.refreshPromise = this.#refreshNow(channels,{mode:'viewer'})
      .finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  async refreshGuide({ force = false, channels = [], from = null, to = null } = {}) {
    if (this.refreshPromise) {
      try { await this.refreshPromise; } catch {}
    }
    const scopeKey=`${from?new Date(from).getTime():''}|${to?new Date(to).getTime():''}|${(Array.isArray(channels)?channels:[]).map(channel=>channel?.id||channel?.originalId||channel?.name||'').join(',')}`;
    if (!force && this.lastGuideScopeKey===scopeKey && this.lastGuideRefreshAt && (Date.now() - this.lastGuideRefreshAt) < MIN_REFRESH_GAP_MS) return;

    this.refreshPromise = this.#refreshNow(channels,{mode:'guide',from,to,scopeKey})
      .finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  async #refreshNow(channels = [],{mode='viewer',from=null,to=null,scopeKey=''}={}) {
    const primary = this.#scopedUrl(CONFIG.epgUrl, channels,{mode,from,to});
    const urls = [primary].filter(Boolean);
    const previous={
      programs:this.programs,
      resolveIndex:this.resolveIndex,
      programKeyIndex:this.programKeyIndex,
    };
    const errors = [];

    for (const url of urls) {
      for (let attempt=0;attempt<EPG_FETCH_RETRY_DELAYS_MS.length;attempt+=1) {
        await sleep(EPG_FETCH_RETRY_DELAYS_MS[attempt]);
        this.programs=new Map();
        this.resolveIndex=new Map();
        this.programKeyIndex=new Map();
        try {
          const requestUrl=new URL(url);
          if(attempt>0)requestUrl.searchParams.set('epg-retry',`${Date.now()}-${attempt}`);
          const response = await fetch(requestUrl.toString(), { cache: 'default' });
          if (!response.ok) throw new Error(`${requestUrl} HTTP ${response.status}`);
          let merged=false;
          if(mode==='viewer'){
            const data=await response.json();
            merged=this.#mergeCompact(data);
          }else{
            const xml = await response.text();
            merged=this.#merge(xml);
          }
          if (!merged) throw new Error(`${requestUrl}: empty/invalid EPG payload`);
          this.#finalize();
          const refreshedAt=Date.now();
          if(mode==='guide'){
            this.guidePrograms=this.programs;
            this.guideResolveIndex=this.resolveIndex;
            this.guideProgramKeyIndex=this.programKeyIndex;
            this.programs=previous.programs;
            this.resolveIndex=previous.resolveIndex;
            this.programKeyIndex=previous.programKeyIndex;
            this.lastGuideRefreshAt=refreshedAt;
            this.lastGuideScopeKey=scopeKey;
          }else{
            this.lastRefreshAt=refreshedAt;
          }
          globalThis.dispatchEvent?.(new CustomEvent('webtv:epg-updated', { detail: { at: refreshedAt, mode } }));
          return;
        } catch (error) {
          errors.push(`attempt ${attempt+1}: ${error?.message || `EPG fetch failed · ${url}`}`);
        }
      }
    }

    this.programs=previous.programs;
    this.resolveIndex=previous.resolveIndex;
    this.programKeyIndex=previous.programKeyIndex;
    throw new Error(errors.join(' · ') || 'No usable EPG feed available');
  }

  #scopedUrl(base, channels = [],{mode='viewer',from=null,to=null}={}) {
    if (!base) return '';
    const terms = [...new Set((Array.isArray(channels) ? channels : []).map(channel =>
      String(channel?.id || channel?.originalId || channel?.name || '').trim()
    ).filter(Boolean))].slice(0, 80);
    try {
      const url = new URL(base);
      if(mode==='viewer')url.pathname=url.pathname.replace(/\/(?:epg(?:\.xml)?)$/,'/now-next.json');
      if(terms.length)url.searchParams.set('channels', terms.join(','));
      if(mode==='guide'&&from&&to){
        const fromMs=new Date(from).getTime(),toMs=new Date(to).getTime();
        if(Number.isFinite(fromMs)&&Number.isFinite(toMs)&&toMs>fromMs){url.searchParams.set('from',String(fromMs));url.searchParams.set('to',String(toMs));}
      }
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

  #mergeCompact(data) {
    const rows=Array.isArray(data?.channels)?data.channels:[];
    if(!rows.length)return false;
    let count=0;
    for(const row of rows){
      const id=String(row?.id||'').trim();if(!id)continue;
      this.#indexValue(id,id);
      for(const name of Array.isArray(row?.names)?row.names:[])this.#indexValue(name,id);
      const items=[row?.current,...(Array.isArray(row?.next)?row.next:[])].filter(Boolean);
      for(const item of items){
        const start=new Date(item?.start),stop=new Date(item?.stop),title=String(item?.title||'').trim();
        if(Number.isNaN(start.getTime())||Number.isNaN(stop.getTime())||!title)continue;
        if(!this.programs.has(id))this.programs.set(id,[]);
        this.programs.get(id).push({start,stop,title,description:String(item?.description||''),category:String(item?.category||''),image:String(item?.image||'')});
        count+=1;
      }
    }
    return count>0;
  }

  #merge(xmlText) {
    const doc = parseXmltvDocument(xmlText);
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

  #resolve(channel,{resolveIndex=this.resolveIndex,programKeyIndex=this.programKeyIndex}={}) {
    const values=[channel?.id,channel?.originalId,channel?.name].map(value=>String(value||'').trim()).filter(Boolean);
    const {identity,conflict}=identityState(values);
    if(conflict)return null;

    const profile=identity&&!identity.legacy?getChannelProfileById(identity.id):null;
    const identityKey=identity?identityIndexKey(identity.id):'';
    if(identityKey&&resolveIndex.has(identityKey))return resolveIndex.get(identityKey);
    if(identityKey&&programKeyIndex.has(identityKey))return programKeyIndex.get(identityKey);

    for(const candidate of candidateValues(values,identity,profile)){
      for(const variant of epgVariants(candidate)){
        const norm=normalizeId(variant);
        if(norm&&resolveIndex.has(norm))return resolveIndex.get(norm);
        if(norm&&programKeyIndex.has(norm))return programKeyIndex.get(norm);
      }
    }

    return null;
  }

  getSchedule(channel, { from = null, to = null, limit = 240 } = {}) {
    const useGuide=this.guidePrograms.size>0;
    const resolved = useGuide
      ? this.#resolve(channel,{resolveIndex:this.guideResolveIndex,programKeyIndex:this.guideProgramKeyIndex})
      : this.#resolve(channel);
    const list = resolved ? ((useGuide?this.guidePrograms:this.programs).get(resolved) || []) : [];
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
