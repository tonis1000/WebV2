import { CURATED_SOURCE_FEEDS } from './curated-source-catalog.js';

const SEARCH_SOURCES = Object.freeze([
  ...CURATED_SOURCE_FEEDS.map(feed=>Object.freeze({
    id:feed.id,
    label:feed.label||feed.name,
    type:feed.format,
    location:feed.url,
    enabled:feed.enabled!==false,
    priority:feed.priority||'normal',
    tier:feed.tier||'primary',
  })),
  Object.freeze({
    id:'strm-specific-discovery',
    label:'STRM Discovery',
    type:'strm',
    location:Object.freeze({ provider:'strm-specific-discovery' }),
    enabled:true,
    priority:'normal',
  }),
  Object.freeze({
    id:'authorized-xtream',
    label:'Authorized Xtream',
    type:'xtream',
    location:Object.freeze({ provider:'authorized-xtream' }),
    enabled:true,
    priority:'normal',
  }),
]);

export function listSearchSources({ enabledOnly = false } = {}) {
  const rows = enabledOnly ? SEARCH_SOURCES.filter(item => item.enabled) : SEARCH_SOURCES;
  return rows.map(item => Object.freeze({
    ...item,
    location:item.location && typeof item.location === 'object' ? Object.freeze({ ...item.location }) : item.location,
  }));
}

export function getSearchSource(id = '') {
  const key = String(id || '').trim().toLowerCase();
  if (!key) return null;
  const item = SEARCH_SOURCES.find(source => source.id.toLowerCase() === key);
  if (!item) return null;
  return Object.freeze({
    ...item,
    location:item.location && typeof item.location === 'object' ? Object.freeze({ ...item.location }) : item.location,
  });
}
