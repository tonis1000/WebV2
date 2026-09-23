const BUILD_ID = '20260923-0745';
const LEGACY_LOCAL_KEYS = ['webtv_v2_saved_sources'];
const DB_NAME = 'webtv-v2-playlists';
const STORE = 'playlists';

for(const key of LEGACY_LOCAL_KEYS){
  try{localStorage.removeItem(key);}catch{}
}

async function cleanupLegacyIndexedDb(){
  try{
    if(typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return;
    const databases = await indexedDB.databases();
    if(!databases.some(db => db?.name === DB_NAME)) return;

    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => {
      try{
        const db = req.result;
        if(!db.objectStoreNames.contains(STORE)){db.close();return;}
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete('__my_playlist__');
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
        tx.onabort = () => db.close();
      }catch{}
    };
  }catch{}
}

cleanupLegacyIndexedDb();
console.info(`[WebTV] Browser state cleanup loaded · build ${BUILD_ID} · legacy permanent playlist/source state removed`);
