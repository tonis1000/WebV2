const CACHE_URL='https://tv-cache.atonis.workers.dev/channel-streams.json';
let remoteMap=null;
let loading=null;

function norm(v=''){
  return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9α-ω]+/gi,'-').replace(/^-+|-+$/g,'');
}
function cleanSource(raw=''){
  const value=String(raw||'').trim();
  const pipe=value.indexOf('|');
  return pipe>=0?value.slice(0,pipe):value;
}
function isHls(url=''){return /\.m3u8(?:$|[?#])/i.test(url);}
function isStrm(url=''){return /\.strm(?:$|[?#])/i.test(url);}
function shortUrl(value=''){
  try{
    const u=new URL(value);
    let p=u.pathname||'/';
    if(p.length>58)p=`…${p.slice(-55)}`;
    return `${u.hostname}${p}`;
  }catch{return value.length>72?`${value.slice(0,69)}…`:value;}
}
async function getRemoteMap(){
  if(remoteMap)return remoteMap;
  if(!loading){
    loading=fetch(CACHE_URL,{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({})).then(v=>{remoteMap=v||{};return remoteMap;});
  }
  return loading;
}
function remoteUrlsFor(channel,map={}){
  const keys=[channel?.id,channel?.originalId,channel?.name].filter(Boolean);
  const mapKeys=Object.keys(map||{});
  for(const key of keys){
    if(Array.isArray(map[key]))return map[key];
    const n=norm(key);
    const exact=mapKeys.find(k=>norm(k)===n);
    if(exact&&Array.isArray(map[exact]))return map[exact];
  }
  return [];
}
function buildRows(channel,map={}){
  const saved=(channel?.directUrls||[]).map(url=>({url,origin:'saved'}));
  const remote=remoteUrlsFor(channel,map).map(url=>({url,origin:'remote'}));
  const seen=new Set();
  const out=[];
  for(const item of [...saved,...remote]){
    const source=cleanSource(item.url);
    if(!source)continue;
    const key=`${item.origin}|${source}`;
    if(seen.has(key))continue;
    seen.add(key);
    if(isStrm(source)){
      out.push({kind:'STRM',origin:item.origin,url:source});
      continue;
    }
    if(/^https:\/\//i.test(source))out.push({kind:'DIRECT',origin:item.origin,url:source});
    if(isHls(source))out.push({kind:'WORKER',origin:item.origin,url:source});
  }
  return out;
}
function tooltipText(channel,rows){
  if(!rows.length)return 'Playback routes\nNo routes found';
  const mode=window.WebTVSourceOrder?.getMode?.(channel)==='manual'?'MANUAL order':'AUTO · Health ranked';
  const lines=[`Playback routes · ${rows.length}`,mode,''];
  rows.forEach((r,i)=>lines.push(`${i+1}. ${r.kind} · ${r.origin==='saved'?'D1/saved':'TV-cache/remote'} · ${shortUrl(r.url)}`));
  return lines.join('\n');
}
async function enrich(target){
  const row=target.closest('.channel-item');
  const id=row?.dataset?.channelId;
  const channel=window.WebTVPlaylistAPI?.getChannelById?.(id);
  if(!channel)return;
  target.title='Playback routes · loading…';
  const map=await getRemoteMap();
  if(!target.isConnected)return;
  target.title=tooltipText(channel,buildRows(channel,map));
}

document.addEventListener('mouseover',event=>{
  const target=event.target?.closest?.('.source-count');
  if(!target)return;
  if(target.dataset.routeTooltipReady==='1')return;
  target.dataset.routeTooltipReady='1';
  enrich(target).catch(()=>{target.title='Playback routes';});
});

document.addEventListener('mouseout',event=>{
  const target=event.target?.closest?.('.source-count');
  if(!target)return;
  target.dataset.routeTooltipReady='0';
});

console.info('[WebTV] Route tooltip loaded · detailed saved + remote playback routes on hover');
