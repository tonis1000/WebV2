const SAVED_DB='webtv-v2-playlists';
const SAVED_STORE='playlists';

function cloneChannel(channel={}) {
  return {
    id:String(channel.id||''),
    originalId:String(channel.originalId||''),
    tvgId:String(channel.tvgId||''),
    name:String(channel.name||''),
    group:String(channel.group||channel.groupName||''),
    directUrls:[...(channel.directUrls||[])],
  };
}

function cloneSavedPlaylist(item={}) {
  return {
    id:String(item.id||''),
    name:String(item.name||''),
    type:String(item.type||''),
    text:String(item.text||''),
    updatedAt:Number(item.updatedAt)||0,
  };
}

function cloneLoadedXtream(loaded=null) {
  if (!loaded?.account || !Array.isArray(loaded.channels)) return null;
  return {
    account:{
      id:String(loaded.account.id||''),
      name:String(loaded.account.name||''),
      server:String(loaded.account.server||''),
    },
    channels:loaded.channels.map(channel=>({
      id:String(channel.id||''),
      tvgId:String(channel.tvgId||''),
      name:String(channel.name||''),
      group:String(channel.group||channel.categoryName||''),
      streamId:String(channel.streamId||''),
      playbackUrl:String(channel.playbackUrl||''),
    })),
  };
}

async function existingSavedPlaylistCache() {
  if (!globalThis.indexedDB || typeof indexedDB.databases!=='function') return [];
  let databases=[];
  try { databases=await indexedDB.databases(); }
  catch { return []; }
  if (!databases.some(db=>db?.name===SAVED_DB)) return [];

  return new Promise(resolve=>{
    const request=indexedDB.open(SAVED_DB);
    request.onupgradeneeded=()=>{
      try { request.transaction?.abort(); } catch {}
      resolve([]);
    };
    request.onerror=()=>resolve([]);
    request.onsuccess=()=>{
      const db=request.result;
      if (!db.objectStoreNames.contains(SAVED_STORE)) {db.close();resolve([]);return;}
      try {
        const tx=db.transaction(SAVED_STORE,'readonly');
        const getAll=tx.objectStore(SAVED_STORE).getAll();
        getAll.onerror=()=>{db.close();resolve([]);};
        getAll.onsuccess=()=>{
          const rows=(getAll.result||[]).filter(item=>item?.id!=='__my_playlist__').map(cloneSavedPlaylist);
          db.close();resolve(rows);
        };
      } catch {db.close();resolve([]);}
    };
  });
}

export async function readLocalSourceContext() {
  const playlistApi=window.WebTVPlaylistAPI;
  const catalogMode=playlistApi?.getCatalogMode?.()||'';
  const myPlaylistChannels=catalogMode==='cloud'
    ? (playlistApi?.getChannels?.()||[]).map(cloneChannel)
    : [];

  const savedPlaylists=await existingSavedPlaylistCache();
  const loadedXtream=cloneLoadedXtream(window.WebTVXtream?.getLoaded?.()||null);

  return Object.freeze({
    catalogMode,
    myPlaylistAvailable:catalogMode==='cloud',
    myPlaylistChannels:Object.freeze(myPlaylistChannels),
    savedPlaylists:Object.freeze(savedPlaylists),
    loadedXtream:loadedXtream ? Object.freeze({
      account:Object.freeze(loadedXtream.account),
      channels:Object.freeze(loadedXtream.channels.map(Object.freeze)),
    }) : null,
  });
}
