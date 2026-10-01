import { promoteImportedChannel } from './core/import-promotion-policy.js';

function clean(value=''){return String(value??'').trim();}
function permanentHttpUrl(value=''){
  try{
    const url=new URL(clean(value));
    if(!/^https?:$/.test(url.protocol)||url.username||url.password)return '';
    return url.href;
  }catch{return '';}
}
function canonicalKey(channel={}){
  try{return clean(promoteImportedChannel(channel)?.id);}
  catch{return clean(channel.id||channel.originalId||channel.tvgId||channel.name).toLowerCase();}
}
function sourceObject(input,origin='known'){
  const raw=typeof input==='string'?{url:input}:input||{};
  const url=permanentHttpUrl(raw.url);
  if(!url)return null;
  return {
    url,
    origin:clean(raw.origin)||origin,
    priority:Number.isFinite(Number(raw.priority))?Number(raw.priority):100,
    providerAccountId:clean(raw.providerAccountId),
    providerEpgId:clean(raw.providerEpgId),
    providerCategory:clean(raw.providerCategory),
  };
}
function addSources(out,seen,items=[],origin='known'){
  for(const item of Array.isArray(items)?items:[]){
    const source=sourceObject(item,origin);
    if(!source||seen.has(source.url))continue;
    seen.add(source.url);out.push(source);
  }
}
function sameChannel(target,row){return Boolean(target&&row&&canonicalKey(target)&&canonicalKey(target)===canonicalKey(row));}

export function collectKnownSources(channel={}, {
  myPlaylist=[],
  customPlaylists=[],
  loadedCatalog=[],
  selectedSource=null,
}={}){
  const out=[];const seen=new Set();
  addSources(out,seen,selectedSource?[selectedSource]:[],'xtream');
  for(const row of Array.isArray(myPlaylist)?myPlaylist:[]){
    if(!sameChannel(channel,row))continue;
    addSources(out,seen,(row.directUrls||[]).map(url=>({url,origin:'my-playlist'})),'my-playlist');
  }
  for(const playlist of Array.isArray(customPlaylists)?customPlaylists:[]){
    for(const row of Array.isArray(playlist?.channels)?playlist.channels:[]){
      if(!sameChannel(channel,row))continue;
      addSources(out,seen,row.sources||[],'custom-playlist');
    }
  }
  for(const row of Array.isArray(loadedCatalog)?loadedCatalog:[]){
    if(!sameChannel(channel,row))continue;
    addSources(out,seen,(row.directUrls||[]).map(url=>({url,origin:'loaded-catalog'})),'loaded-catalog');
  }
  return out;
}

export { canonicalKey as canonicalKnownSourceChannelKey };
