import { parseM3U, dedupeChannels } from './core/channel-catalog.js?v=20260920-1021';

const BUILD_ID = '20260921-0012';
const DB_NAME = 'webtv-v2-playlists';
const STORE = 'playlists';
const MY_ID = '__my_playlist__';
const URL_KEY = 'webtv_v2_registry_url';
const TOKEN_KEY = 'webtv_v2_registry_token';
const DEFAULT_REGISTRY = 'https://webtv-registry.atonis.workers.dev';
const SYNC_INTERVAL_MS = 60000;

let dbPromise;
let syncing = null;

function registryUrl(){
  return (localStorage.getItem(URL_KEY) || DEFAULT_REGISTRY).trim().replace(/\/$/, '');
}

function token(){
  return localStorage.getItem(TOKEN_KEY) || '';
}

function normalize(value=''){
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9α-ω]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

function escAttr(value=''){
  return String(value || '').replace(/"/g, "'");
}

function channelToLines(channel){
  const urls = [...new Set((channel.directUrls || []).filter(u => /^https?:\/\//i.test(u)))];
  const ext = `#EXTINF:-1 tvg-id="${escAttr(channel.originalId || channel.id || channel.name)}" tvg-name="${escAttr(channel.name)}" tvg-logo="${escAttr(channel.logo || '')}" group-title="${escAttr(channel.group || 'Other')}",${channel.name}`;
  if(!urls.length) return [ext, ''];
  const lines = [];
  for(const url of urls) lines.push(ext, url);
  return lines;
}

function channelsToM3U(channels){
  const lines = ['#EXTM3U'];
  for(const channel of channels) lines.push(...channelToLines(channel));
  return `${lines.join('\n')}\n`;
}

function summarize(text){
  const channels = parseM3U(text);
  const groups = new Set(channels.map(c => c.group || 'Other'));
  return { channels, count: channels.length, groups: groups.size };
}

function openDb(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function getSaved(id){
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function putSaved(item){
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

async function mergeRemoteIntoMyPlaylist(remote){
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.get(MY_ID);
    let result = { remote: remote.length, merged: remote.length };

    req.onsuccess = () => {
      const current = req.result || null;
      const local = current?.text ? parseM3U(current.text) : [];

      // IMPORTANT: this merge happens inside the same read/write transaction.
      // A cloud read may ADD remote channels/sources, but it must never replace
      // a newer local channel/source that was just saved by the user.
      const merged = dedupeChannels([...local, ...remote]);
      const text = channelsToM3U(merged);
      const summary = summarize(text);
      const now = Date.now();
      result = { remote: remote.length, merged: merged.length };

      if(!current || current.text !== text){
        store.put({
          id: MY_ID,
          name: 'My Playlist',
          type: 'curated',
          url: '',
          text,
          channelCount: summary.count,
          groupCount: summary.groups,
          createdAt: current?.createdAt || now,
          updatedAt: now,
        });
      }
    };

    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

async function fetchJson(path){
  const base = registryUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try{
    let response = await fetch(`${base}${path}`, { cache: 'no-store', signal: controller.signal });
    if((response.status === 401 || response.status === 403) && token()){
      response = await fetch(`${base}${path}`, {
        cache: 'no-store',
        signal: controller.signal,
        headers: { authorization: `Bearer ${token()}` },
      });
    }
    let json = {};
    try{ json = await response.json(); }catch{}
    if(!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
    return json;
  }finally{
    clearTimeout(timeout);
  }
}

async function syncMyPlaylist(){
  const json = await fetchJson('/api/my-playlist');
  const remote = (json.channels || []).map(c => ({
    id: normalize(c.id || c.tvgId || c.name),
    originalId: c.tvgId || c.id || c.name,
    name: c.name,
    logo: c.logo || '',
    group: c.groupName || 'Other',
    directUrls: (c.sources || []).map(s => s.url).filter(Boolean),
  }));

  return mergeRemoteIntoMyPlaylist(remote);
}

async function syncSavedPlaylists(){
  const list = await fetchJson('/api/playlists');
  let pulled = 0;

  for(const meta of list.playlists || []){
    try{
      const detailJson = await fetchJson(`/api/playlists/${encodeURIComponent(meta.id)}`);
      const detail = detailJson.playlist;
      if(!detail?.rawM3u) continue;

      const remoteUpdatedAt = Date.parse(detail.updatedAt) || 0;
      const local = await getSaved(detail.id);

      // Never let an older cloud copy overwrite a newer local edit.
      if(local && (local.updatedAt || 0) > remoteUpdatedAt && remoteUpdatedAt > 0){
        continue;
      }

      const summary = summarize(detail.rawM3u);
      await putSaved({
        id: detail.id,
        name: detail.name,
        type: detail.kind || 'saved',
        url: detail.sourceUrl || '',
        text: detail.rawM3u,
        channelCount: detail.channelCount || summary.count,
        groupCount: detail.groupCount || summary.groups,
        createdAt: Date.parse(detail.createdAt) || local?.createdAt || Date.now(),
        updatedAt: remoteUpdatedAt || Date.now(),
      });
      pulled += 1;
    }catch(error){
      console.warn('[WebTV] Saved playlist read skipped', meta?.id, error);
    }
  }

  return pulled;
}

async function runSync(reason='manual'){
  if(syncing) return syncing;
  syncing = (async () => {
    const result = { reason, myPlaylist: null, savedPlaylists: 0 };
    try{
      result.myPlaylist = await syncMyPlaylist();
    }catch(error){
      console.warn('[WebTV] Curated cloud read unavailable', error);
    }
    try{
      result.savedPlaylists = await syncSavedPlaylists();
    }catch(error){
      console.warn('[WebTV] Saved playlists cloud read unavailable', error);
    }
    window.dispatchEvent(new CustomEvent('webtv:cloud-read-synced', { detail: result }));
    console.info(`[WebTV] Cloud read sync · ${reason} · curated ${result.myPlaylist?.merged ?? '-'} · saved ${result.savedPlaylists}`);
    return result;
  })().finally(() => { syncing = null; });
  return syncing;
}

// Pull cloud data on every page load, even in read-only mode.
runSync('startup');

// Keep another device/browser reasonably fresh without requiring manual Pull.
setInterval(() => runSync('timer'), SYNC_INTERVAL_MS);
window.addEventListener('focus', () => runSync('focus'));
document.addEventListener('visibilitychange', () => {
  if(!document.hidden) runSync('visible');
});

document.getElementById('playlist-manager-toggle')?.addEventListener('click', () => {
  runSync('open-playlists');
}, { capture: true });

console.info(`[WebTV] Cloud read sync loaded · build ${BUILD_ID}`);
