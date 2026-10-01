const REGISTRY_URL_KEY='webtv_v2_registry_url';
const REGISTRY_TOKEN_KEY='webtv_v2_registry_token';
const DEFAULT_REGISTRY='https://webtv-registry.atonis.workers.dev';

function clean(value=''){return String(value??'').trim();}
function registryUrl(){return clean(localStorage.getItem(REGISTRY_URL_KEY)||DEFAULT_REGISTRY).replace(/\/+$/,'');}
function registryToken(){return clean(localStorage.getItem(REGISTRY_TOKEN_KEY)||'');}
async function ensureWriteSession(){
  const auth=window.WebTVRegistryAuth;
  if(auth?.ensureSession){const ok=await auth.ensureSession({interactive:true});if(!ok)throw new Error('Trusted-device session required');}
  const token=registryToken();if(!token)throw new Error('Trusted-device session required');return token;
}
async function requestJson(path,{method='GET',body,signal=null,write=false}={}){
  const headers=new Headers();
  if(body!==undefined)headers.set('content-type','application/json');
  if(write){const token=await ensureWriteSession();headers.set('authorization',`Bearer ${token}`);}
  const options={cache:'no-store',headers,body:body===undefined?undefined:JSON.stringify(body),signal:signal||undefined};
  if(method!=='GET')options.method=method;
  const response=await fetch(`${registryUrl()}${path}`,options);
  let json={};try{json=await response.json();}catch{}
  if(!response.ok)throw new Error(json.error||`Registry HTTP ${response.status}`);
  return json;
}
function safeSource(source={}){
  const url=clean(typeof source==='string'?source:source.url);
  if(!/^https?:\/\//i.test(url))return null;
  const input=typeof source==='string'?{}:source;
  return {
    url,
    origin:clean(input.origin),
    priority:Number.isFinite(Number(input.priority))?Number(input.priority):100,
    providerAccountId:clean(input.providerAccountId),
    providerEpgId:clean(input.providerEpgId),
    providerCategory:clean(input.providerCategory),
  };
}
function safeChannel(channel={}){
  return {
    channelId:clean(channel.channelId||channel.id||channel.tvgId||channel.originalId||channel.name),
    name:clean(channel.name),
    tvgId:clean(channel.tvgId||channel.originalId||channel.id||channel.name),
    logo:clean(channel.logo),
    groupName:clean(channel.groupName||channel.group)||'Other',
    position:Number.isFinite(Number(channel.position))?Number(channel.position):999999,
    providerEpgId:clean(channel.providerEpgId),
    providerCategory:clean(channel.providerCategory),
    providerOrigin:clean(channel.providerOrigin),
  };
}
export async function listCustomPlaylists({signal=null}={}){
  const json=await requestJson('/api/playlists',{signal});
  return (Array.isArray(json.playlists)?json.playlists:[]).filter(row=>row?.kind==='custom').map(row=>({...row}));
}
export async function createCustomPlaylist({name=''}){
  const json=await requestJson('/api/playlists',{method:'POST',write:true,body:{name:clean(name)||'Custom Playlist',kind:'custom'}});
  return json.playlist||null;
}
export async function deleteCustomPlaylist(playlistId){
  const id=clean(playlistId);if(!id)throw new Error('Custom playlist ID is required');
  return requestJson(`/api/playlists/${encodeURIComponent(id)}`,{method:'DELETE',write:true});
}
export async function getCustomPlaylistChannels(playlistId,{signal=null}={}){
  const id=clean(playlistId);if(!id)throw new Error('Custom playlist ID is required');
  const json=await requestJson(`/api/playlists/${encodeURIComponent(id)}/channels`,{signal});
  return Array.isArray(json.channels)?json.channels.map(row=>({...row,sources:Array.isArray(row.sources)?row.sources.map(source=>({...source})):[]})):[];
}
export async function upsertCustomPlaylistChannel(playlistId,channel,sources=[],{replaceSources=false}={}){
  const id=clean(playlistId);if(!id)throw new Error('Custom playlist ID is required');
  const payload=safeChannel(channel);if(!payload.channelId||!payload.name)throw new Error('Channel ID and name are required');
  payload.replaceSources=Boolean(replaceSources);
  payload.sources=(Array.isArray(sources)?sources:[]).map(safeSource).filter(Boolean);
  const json=await requestJson(`/api/playlists/${encodeURIComponent(id)}/channels/${encodeURIComponent(payload.channelId)}`,{method:'PUT',write:true,body:payload});
  return json.channel||null;
}
export async function removeCustomPlaylistChannel(playlistId,channelId){
  const p=clean(playlistId),c=clean(channelId);if(!p||!c)throw new Error('Playlist and channel IDs are required');
  return requestJson(`/api/playlists/${encodeURIComponent(p)}/channels/${encodeURIComponent(c)}`,{method:'DELETE',write:true});
}
export function customPlaylistExportUrl(playlistId){
  const id=clean(playlistId);if(!id)throw new Error('Custom playlist ID is required');
  return `${registryUrl()}/api/playlists/${encodeURIComponent(id)}/export.m3u`;
}
