const VERSION='1.0';
const PROVIDER='curated-remote-feeds';
const FETCH_TIMEOUT_MS=6000;
const MAX_FETCH_BYTES=1200000;
const MAX_CONCURRENCY=2;
const MAX_RESULTS=12;
const ALLOWED_FRESHNESS=new Set(['24h','7d','30d']);

const FEEDS=Object.freeze([
  Object.freeze({name:'hitnickgr/iptv',url:'https://raw.githubusercontent.com/hitnickgr/iptv/refs/heads/main/GreekChannels'}),
  Object.freeze({name:'jimgate07/grtv',url:'https://raw.githubusercontent.com/jimgate07/grtv/refs/heads/master/android.m3u'}),
  Object.freeze({name:'Michatec/Greek-IPTV',url:'https://raw.githubusercontent.com/Michatec/Greek-IPTV/refs/heads/main/greek-iptv.m3u8'}),
  Object.freeze({name:'Don24crk',url:'https://raw.githubusercontent.com/don24crk/Don24crk-Repository/refs/heads/master/android.m3u'}),
]);

function cors(){return {'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'};}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors(),'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});}
function normalize(value=''){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9α-ω]+/gi,' ').replace(/\s+/g,' ').trim();}
function benignBase(value=''){
  let out=normalize(value);
  for(let i=0;i<3;i++){
    const next=out.replace(/\s+(?:hd|tv|channel|greece|greek|gr)$/i,'').trim();
    if(next===out)break;
    out=next;
  }
  return out;
}
function identitySet(channel={}){
  const values=[channel.name,channel.id,channel.originalId,channel.tvgId].filter(Boolean);
  const out=new Set();
  for(const value of values){const n=normalize(value),b=benignBase(value);if(n)out.add(n);if(b)out.add(b);}
  return out;
}
function attr(line='',name=''){
  const match=String(line).match(new RegExp(`${name}="([^"]*)"`,'i'));
  return match?.[1]?.trim()||'';
}
function titleOf(line=''){const index=String(line).lastIndexOf(',');return index>=0?String(line).slice(index+1).trim():'';}
function candidateMatches(extinf='',channel={}){
  const targets=identitySet(channel);
  if(!targets.size)return false;
  const signals=[titleOf(extinf),attr(extinf,'tvg-name'),attr(extinf,'tvg-id')].filter(Boolean);
  return signals.some(signal=>{
    const n=normalize(signal),b=benignBase(signal);
    return (n&&targets.has(n))||(b&&targets.has(b));
  });
}
function typeOf(url=''){
  const clean=String(url).split('|')[0].trim();
  if(/\.strm(?:[?#]|$)/i.test(clean))return 'strm';
  if(/\.mpd(?:[?#]|$)/i.test(clean))return 'dash';
  if(/\.m3u8(?:[?#]|$)/i.test(clean))return 'hls';
  if(/\.m3u(?:[?#]|$)/i.test(clean))return 'm3u';
  return 'direct';
}
function validPublicUrl(value=''){
  try{const url=new URL(String(value).split('|')[0].trim());return /^https?:$/.test(url.protocol);}catch{return false;}
}
function parseM3u(text='',channel={},feed={}){
  const lines=String(text).replace(/\r/g,'').split('\n');
  const results=[];
  for(let i=0;i<lines.length&&results.length<MAX_RESULTS;i++){
    const extinf=lines[i].trim();
    if(!/^#EXTINF:/i.test(extinf)||!candidateMatches(extinf,channel))continue;
    let sourceUrl='';
    for(let j=i+1;j<Math.min(lines.length,i+10);j++){
      const next=lines[j].trim();
      if(!next||next.startsWith('#'))continue;
      if(validPublicUrl(next))sourceUrl=next;
      break;
    }
    if(!sourceUrl)continue;
    results.push({
      channelName:String(channel.name||titleOf(extinf)||''),
      sourceType:typeOf(sourceUrl),
      sourceUrl,
      sourceOrigin:feed.name,
      discoveryProvider:PROVIDER,
      discoveredAt:new Date().toISOString(),
      freshness:'live-feed-check',
      matchConfidence:'HIGH',
    });
  }
  return results;
}
async function timedFetch(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new DOMException('timeout','AbortError')),FETCH_TIMEOUT_MS);
  try{return await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':`WebTV-Discovery/${VERSION}`,'accept':'text/plain,application/vnd.apple.mpegurl,application/x-mpegURL,*/*'}});}finally{clearTimeout(timer);}
}
async function scanFeed(feed,channel){
  const started=Date.now();
  try{
    const response=await timedFetch(feed.url);
    if(!response.ok)return {feed:feed.name,status:response.status,candidates:[],elapsedMs:Date.now()-started};
    const text=(await response.text()).slice(0,MAX_FETCH_BYTES);
    return {feed:feed.name,status:response.status,candidates:parseM3u(text,channel,feed),elapsedMs:Date.now()-started};
  }catch(error){return {feed:feed.name,status:error?.name==='AbortError'?408:0,candidates:[],elapsedMs:Date.now()-started,error:error?.message||String(error)};}
}
async function mapBounded(items,limit,task){
  const out=new Array(items.length);let next=0;
  const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const index=next++;if(index>=items.length)return;out[index]=await task(items[index],index);}});
  await Promise.all(workers);return out;
}
function dedupe(candidates=[]){
  const seen=new Set();const out=[];
  for(const item of candidates){const key=String(item.sourceUrl||'').trim();if(!key||seen.has(key))continue;seen.add(key);out.push(item);if(out.length>=MAX_RESULTS)break;}
  return out;
}
async function discover(request,env={}){
  if(String(env.DISABLE_CURATED_REMOTE_FEEDS||'')==='1')return json({error:'Provider disabled',provider:PROVIDER},503);
  let body;try{body=await request.json();}catch{return json({error:'Invalid JSON'},400);}
  if(body?.provider!==PROVIDER)return json({error:'Unsupported provider'},400);
  const freshness=ALLOWED_FRESHNESS.has(body?.freshness)?body.freshness:'7d';
  const channel=body?.channel&&typeof body.channel==='object'?body.channel:{};
  if(!String(channel.name||'').trim())return json({error:'channel.name is required'},400);
  const reports=await mapBounded(FEEDS,MAX_CONCURRENCY,feed=>scanFeed(feed,channel));
  const candidates=dedupe(reports.flatMap(report=>report.candidates||[]));
  return json({
    service:'WebTV Source Discovery',version:VERSION,provider:PROVIDER,enabled:true,
    freshnessRequested:freshness,freshnessApplied:false,freshnessNote:'Curated feeds are checked live; individual entries do not expose reliable publication timestamps.',
    limits:{timeoutMs:FETCH_TIMEOUT_MS,maxConcurrency:MAX_CONCURRENCY,maxResults:MAX_RESULTS,feeds:FEEDS.length},
    candidates,reports:reports.map(({feed,status,elapsedMs,candidates,error})=>({feed,status,elapsedMs,count:candidates?.length||0,error:error||''})),
  });
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/')return json({service:'WebTV Source Discovery',version:VERSION,providers:{[PROVIDER]:String(env?.DISABLE_CURATED_REMOTE_FEEDS||'')!=='1'},limits:{timeoutMs:FETCH_TIMEOUT_MS,maxConcurrency:MAX_CONCURRENCY,maxResults:MAX_RESULTS,feeds:FEEDS.length}});
    if(request.method==='POST'&&url.pathname==='/discover')return discover(request,env);
    return json({error:'Not found'},404);
  }
};

export { FEEDS, PROVIDER, FETCH_TIMEOUT_MS, MAX_CONCURRENCY, MAX_RESULTS, normalize, benignBase, candidateMatches, parseM3u };
