const BUILD_ID = '20260922-2115';
const DB_NAME = 'webtv-v2-playlists';
const STORE = 'playlists';
const URL_KEY = 'webtv_v2_registry_url';
const DEFAULT_REGISTRY = 'https://webtv-registry.atonis.workers.dev';
const SYNC_INTERVAL_MS = 60000;

let dbPromise;
let syncing = null;

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

  for(const meta of list.playlists || []){
    try{
      const detailJson = await fetchJson(`/api/playlists/${encodeURIComponent(meta.id)}`);
      const detail = detailJson.playlist;
      if(!detail?.rawM3u) continue;

      const remoteUpdatedAt = Date.parse(detail.updatedAt) || 0;
      const local = await getSaved(detail.id);
      if(local && (local.updatedAt || 0) > remoteUpdatedAt && remoteUpdatedAt > 0) continue;

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
  return pulled;
}

async function runSync(reason='manual'){
  if(syncing) return syncing;
  syncing = (async () => {
    const result = { reason, savedPlaylists: 0 };
    try{
      result.savedPlaylists = await syncSavedPlaylists();
    }catch(error){
      console.warn('[WebTV] Saved playlists cloud read unavailable', error);
    }
    window.dispatchEvent(new CustomEvent('webtv:cloud-read-synced', { detail: result }));
    console.info(`[WebTV] Saved Playlists cloud read · ${reason} · ${result.savedPlaylists}`);
    return result;
  })().finally(() => { syncing = null; });
  return syncing;
}

runSync('startup');
setInterval(() => runSync('timer'), SYNC_INTERVAL_MS);
window.addEventListener('focus', () => runSync('focus'));
document.addEventListener('visibilitychange', () => {
  if(!document.hidden) runSync('visible');
});
document.getElementById('playlist-manager-toggle')?.addEventListener('click', () => {
  runSync('open-playlists');
}, { capture: true });

console.info(`[WebTV] Cloud read sync loaded · build ${BUILD_ID} · Saved Playlists only; My Playlist is read directly by main`);
