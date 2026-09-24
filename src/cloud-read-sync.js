const BUILD_ID = '20260924-0635';
const DB_NAME = 'webtv-v2-playlists';
const STORE = 'playlists';
const URL_KEY = 'webtv_v2_registry_url';
const DEFAULT_REGISTRY = 'https://webtv-registry.atonis.workers.dev';
const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const VISIBLE_STALE_MS = 5 * 60 * 1000;

let dbPromise;
let syncing = null;
let lastSyncAt = 0;

function registryUrl(){
  return (localStorage.getItem(URL_KEY) || DEFAULT_REGISTRY).trim().replace(/\/$/, '');
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

async function fetchJson(path){
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try{
    const response = await fetch(`${registryUrl()}${path}`, { cache: 'no-store', signal: controller.signal });
    let json = {};
    try{ json = await response.json(); }catch{}
    if(!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
    return json;
  }finally{
    clearTimeout(timeout);
  }
}

function countM3U(text=''){
  const channels=(String(text).match(/^#EXTINF:/gm)||[]).length;
  const groups=new Set([...String(text).matchAll(/group-title="([^"]*)"/g)].map(m=>m[1]||'Other')).size;
  return {channels,groups};
}

async function syncSavedPlaylists(){
  const list = await fetchJson('/api/playlists');
  let pulled = 0;
  let skipped = 0;

  for(const meta of list.playlists || []){
    try{
      const local = await getSaved(meta.id);
      const metaUpdatedAt = Date.parse(meta.updatedAt) || 0;
      if(local && metaUpdatedAt > 0 && (local.updatedAt || 0) >= metaUpdatedAt){
        skipped += 1;
        continue;
      }

      const detailJson = await fetchJson(`/api/playlists/${encodeURIComponent(meta.id)}`);
      const detail = detailJson.playlist;
      if(!detail?.rawM3u) continue;

      const remoteUpdatedAt = Date.parse(detail.updatedAt) || 0;
      if(local && (local.updatedAt || 0) > remoteUpdatedAt && remoteUpdatedAt > 0){
        skipped += 1;
        continue;
      }

      const summary = countM3U(detail.rawM3u);
      await putSaved({
        id: detail.id,
        name: detail.name,
        type: detail.kind || 'saved',
        url: detail.sourceUrl || '',
        text: detail.rawM3u,
        channelCount: detail.channelCount || summary.channels,
        groupCount: detail.groupCount || summary.groups,
        createdAt: Date.parse(detail.createdAt) || local?.createdAt || Date.now(),
        updatedAt: remoteUpdatedAt || Date.now(),
      });
      pulled += 1;
    }catch(error){
      console.warn('[WebTV] Saved playlist read skipped', meta?.id, error);
    }
  }
  return { pulled, skipped };
}

async function runSync(reason='manual', { force=false }={}){
  if(syncing) return syncing;
  const age = Date.now() - lastSyncAt;
  if(!force && lastSyncAt && age < VISIBLE_STALE_MS){
    return { reason, savedPlaylists: 0, skipped: 0, throttled: true };
  }

  syncing = (async () => {
    const result = { reason, savedPlaylists: 0, skipped: 0 };
    try{
      const sync = await syncSavedPlaylists();
      result.savedPlaylists = sync.pulled;
      result.skipped = sync.skipped;
      lastSyncAt = Date.now();
    }catch(error){
      console.warn('[WebTV] Saved playlists cloud read unavailable', error);
    }
    window.dispatchEvent(new CustomEvent('webtv:cloud-read-synced', { detail: result }));
    console.info(`[WebTV] Saved Playlists cloud read · ${reason} · ${result.savedPlaylists} pulled · ${result.skipped} unchanged`);
    return result;
  })().finally(() => { syncing = null; });
  return syncing;
}

runSync('startup', { force:true });
setInterval(() => runSync('timer', { force:true }), SYNC_INTERVAL_MS);
document.addEventListener('visibilitychange', () => {
  if(!document.hidden) runSync('visible');
});
document.getElementById('playlist-manager-toggle')?.addEventListener('click', () => {
  runSync('open-playlists');
}, { capture: true });

console.info(`[WebTV] Cloud read sync loaded · build ${BUILD_ID} · 15m background sync; 5m open/visible throttle`);
