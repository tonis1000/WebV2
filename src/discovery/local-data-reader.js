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

export async function readLocalSourceContext() {
  const playlistApi=window.WebTVPlaylistAPI;
  const catalogMode=playlistApi?.getCatalogMode?.()||'';
  const myPlaylistChannels=catalogMode==='cloud'
    ? (playlistApi?.getChannels?.()||[]).map(cloneChannel)
    : [];

  let savedPlaylists=[];
  const savedApi=window.WebTVSavedPlaylistsReadAPI;
  if (savedApi?.getAllCached) {
    const rows=await savedApi.getAllCached();
    savedPlaylists=(rows||[]).map(cloneSavedPlaylist);
  }

  const loadedXtream=cloneLoadedXtream(window.WebTVXtream?.getLoaded?.()||null);

  return Object.freeze({
    catalogMode,
    myPlaylistAvailable:catalogMode==='cloud',
    savedPlaylistsAvailable:Boolean(savedApi?.getAllCached),
    myPlaylistChannels:Object.freeze(myPlaylistChannels),
    savedPlaylists:Object.freeze(savedPlaylists),
    loadedXtream:loadedXtream ? Object.freeze({
      account:Object.freeze(loadedXtream.account),
      channels:Object.freeze(loadedXtream.channels.map(Object.freeze)),
    }) : null,
  });
}
