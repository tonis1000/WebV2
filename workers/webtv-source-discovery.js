import { GITHUB_PUBLIC_PLAYLISTS_PROVIDER, discoverGithubPublicPlaylists } from './source-discovery/github-public-playlists.js';
import { RECENT_WEB_SEARCH_PROVIDER, discoverRecentWebSearch } from './source-discovery/recent-web-search.js';
import { STRM_SPECIFIC_DISCOVERY_PROVIDER, discoverStrmSpecific } from './source-discovery/strm-specific-discovery.js';
import { OFFICIAL_PROVIDER_LANE, discoverOfficialProvider } from './source-discovery/official-provider-lane.js';
import { BROWSER_RESOLVED_OFFICIAL_PROVIDER, discoverBrowserResolvedOfficial } from './source-discovery/browser-resolved-official.js';
import { OFFICIAL_API_RESOLVER_PROVIDER, discoverOfficialApi } from './source-discovery/official-api-resolver.js';

const VERSION='1.7';
const CURATED_REMOTE_FEEDS_PROVIDER='curated-remote-feeds';
const FETCH_TIMEOUT_MS=3500;
const MAX_FETCH_BYTES=4000000;
const MAX_CONCURRENCY=4;
const MAX_RESULTS=12;
const FALLBACK_TRIGGER_COUNT=3;
const ALLOWED_FRESHNESS=new Set(['24h','7d','30d']);

const FEEDS=Object.freeze([
  Object.freeze({name:'hitnickgr/iptv',url:'https://raw.githubusercontent.com/hitnickgr/iptv/refs/heads/main/GreekChannels',format:'m3u',tier:'primary'}),
  Object.freeze({name:'jimgate07/grtv',url:'https://raw.githubusercontent.com/jimgate07/grtv/refs/heads/master/android.m3u',format:'m3u',tier:'primary'}),
  Object.freeze({name:'Michatec/Greek-IPTV',url:'https://raw.githubusercontent.com/Michatec/Greek-IPTV/refs/heads/main/greek-iptv.m3u8',format:'m3u',tier:'primary'}),
  Object.freeze({name:'Don24crk',url:'https://raw.githubusercontent.com/don24crk/Don24crk-Repository/refs/heads/master/android.m3u',format:'m3u',tier:'primary'}),
  Object.freeze({name:'iptv-org Greece',url:'https://iptv-org.github.io/iptv/countries/gr.m3u',format:'m3u',tier:'primary'}),
  Object.freeze({name:'HansSettings Greece',url:'https://gitlab.openpli.org/openpli/hanssettings/-/raw/master/e2_hanssettings_9e_13e_19e_23e_28e_AND_rotating/userbouquet.stream_griekenland__gr_.tv?ref_type=heads',format:'enigma2',tier:'primary'}),
  Object.freeze({name:'HansSettings Sport',url:'https://gitlab.openpli.org/openpli/hanssettings/-/raw/master/e2_hanssettings_9e_13e_19e_23e_28e_AND_rotating/userbouquet.stream_sport.tv?ref_type=heads',format:'enigma2',tier:'primary'}),
  Object.freeze({name:'Ciefp IPTV Mix',url:'https://raw.githubusercontent.com/ciefp/ciefpsettings-enigma2/master/ciefp-E2-1sat-19E/userbouquet.ciefpsettings_iptv_mix.tv',format:'enigma2',tier:'fallback'}),
  Object.freeze({name:'Free-TV/IPTV',url:'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',format:'m3u',tier:'fallback'}),
  Object.freeze({name:'b2og iptv-org All',url:'https://iptv.b2og.com/o_all.m3u',format:'m3u',tier:'fallback'}),
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
function matchesSignals(signals=[],channel={}){
  const targets=identitySet(channel);
  if(!targets.size)return false;
  return signals.filter(Boolean).some(signal=>{
    const n=normalize(signal),b=benignBase(signal);
    return (n&&targets.has(n))||(b&&targets.has(b));
  });
}
function attr(line='',name=''){
  const match=String(line).match(new RegExp(`${name}="([^"]*)"`,'i'));
  return match?.[1]?.trim()||'';
}
function titleOf(line=''){const index=String(line).lastIndexOf(',');return index>=0?String(line).slice(index+1).trim():'';}
function candidateMatches(extinf='',channel={}){
  return matchesSignals([titleOf(extinf),attr(extinf,'tvg-name'),attr(extinf,'tvg-id')],channel);
}
function typeOf(url=''){
  const clean=String(url).split('|')[0].trim();
  if(/^rtsps?:\/\//i.test(clean))return 'rtsp';
  if(/^rtmps?:\/\//i.test(clean))return 'rtmp';
  if(/\.strm(?:[?#]|$)/i.test(clean))return 'strm';
  if(/\.mpd(?:[?#]|$)/i.test(clean))return 'dash';
  if(/\.m3u8(?:[?#]|$)/i.test(clean))return 'hls';
  if(/\.m3u(?:[?#]|$)/i.test(clean))return 'm3u';
  return 'direct';
}
function validPublicUrl(value=''){
  try{const url=new URL(String(value).split('|')[0].trim());return /^(https?|rtsp|rtsps|rtmp|rtmps):$/.test(url.protocol);}catch{return false;}
}
function safeDecode(value=''){
  try{return decodeURIComponent(String(value));}catch{return String(value).replace(/%3a/ig,':').replace(/%2f/ig,'/').replace(/%7c/ig,'|').replace(/%20/ig,' ');}
}
function makeCandidate({channel,sourceUrl,sourceOrigin,freshness='live-feed-check'}){
  return {
    channelName:String(channel.name||''),
    sourceType:typeOf(sourceUrl),
    sourceUrl,
    sourceOrigin,
    discoveryProvider:CURATED_REMOTE_FEEDS_PROVIDER,
    discoveredAt:new Date().toISOString(),
    freshness,
    matchConfidence:'HIGH',
    saveEligible:!['rtsp','rtmp'].includes(typeOf(sourceUrl)),
    verificationDetail:['rtsp','rtmp'].includes(typeOf(sourceUrl))?'Requires an authorized RTSP/RTMP to HLS gateway; browser playback has not been tested':'',
  };
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
    results.push(makeCandidate({channel:{...channel,name:channel.name||titleOf(extinf)},sourceUrl,sourceOrigin:feed.name,freshness:feed.freshness||'live-feed-check'}));
  }
  return results;
}
function parseEnigma2(text='',channel={},feed={}){
  const lines=String(text).replace(/\r/g,'').split('\n');
  const results=[];
  for(let i=0;i<lines.length&&results.length<MAX_RESULTS;i++){
    const line=lines[i].trim();
    if(!/^#SERVICE\s+(?:4097|5001|5002):/i.test(line))continue;
    const parts=line.split(':');
    if(parts.length<11)continue;
    const sourceUrl=safeDecode(parts[10]).trim();
    const inlineName=safeDecode(parts.slice(11).join(':')).trim();
    const description=/^#DESCRIPTION\s+/i.test(lines[i+1]?.trim()||'')?String(lines[i+1]).trim().replace(/^#DESCRIPTION\s+/i,'').trim():'';
    if(!validPublicUrl(sourceUrl))continue;
    if(!matchesSignals([inlineName,description],channel))continue;
    results.push(makeCandidate({channel:{...channel,name:channel.name||description||inlineName},sourceUrl,sourceOrigin:feed.name,freshness:feed.freshness||'live-feed-check'}));
  }
  return results;
}
function parseFeed(text='',channel={},feed={}){
  return feed.format==='enigma2'?parseEnigma2(text,channel,feed):parseM3u(text,channel,feed);
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
    if(!response.ok)return {feed:feed.name,tier:feed.tier||'primary',format:feed.format||'m3u',status:response.status,candidates:[],elapsedMs:Date.now()-started};
    const text=(await response.text()).slice(0,MAX_FETCH_BYTES);
    return {feed:feed.name,tier:feed.tier||'primary',format:feed.format||'m3u',status:response.status,candidates:parseFeed(text,channel,{...feed,provider:CURATED_REMOTE_FEEDS_PROVIDER}),elapsedMs:Date.now()-started};
  }catch(error){return {feed:feed.name,tier:feed.tier||'primary',format:feed.format||'m3u',status:error?.name==='AbortError'?408:0,candidates:[],elapsedMs:Date.now()-started,error:error?.message||String(error)};}
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
async function discoverCurated(channel,freshness,env={}){
  if(String(env.DISABLE_CURATED_REMOTE_FEEDS||'')==='1')return json({error:'Provider disabled',provider:CURATED_REMOTE_FEEDS_PROVIDER},503);
  const primaryFeeds=FEEDS.filter(feed=>(feed.tier||'primary')==='primary');
  const fallbackFeeds=FEEDS.filter(feed=>feed.tier==='fallback');
  const primaryReports=await mapBounded(primaryFeeds,MAX_CONCURRENCY,feed=>scanFeed(feed,channel));
  let reports=[...primaryReports];
  let candidates=dedupe(primaryReports.flatMap(report=>report.candidates||[]));
  if(candidates.length<FALLBACK_TRIGGER_COUNT&&fallbackFeeds.length){
    const fallbackReports=await mapBounded(fallbackFeeds,MAX_CONCURRENCY,feed=>scanFeed(feed,channel));
    reports=[...reports,...fallbackReports];
    candidates=dedupe([...candidates,...fallbackReports.flatMap(report=>report.candidates||[])]);
  }
  return json({
    service:'WebTV Source Discovery',version:VERSION,provider:CURATED_REMOTE_FEEDS_PROVIDER,enabled:true,
    freshnessRequested:freshness,freshnessApplied:false,freshnessNote:'Curated feeds are checked live. Primary Greek-focused feeds run first; broad fallback feeds run only when fewer than three matches are found.',
    limits:{timeoutMs:FETCH_TIMEOUT_MS,maxConcurrency:MAX_CONCURRENCY,maxResults:MAX_RESULTS,feeds:FEEDS.length,fallbackTriggerCount:FALLBACK_TRIGGER_COUNT},
    candidates,reports:reports.map(({feed,tier,format,status,elapsedMs,candidates,error})=>({feed,tier,format,status,elapsedMs,count:candidates?.length||0,error:error||''})),
  });
}
async function discover(request,env={}){
  let body;try{body=await request.json();}catch{return json({error:'Invalid JSON'},400);}
  const provider=String(body?.provider||'');
  const freshness=ALLOWED_FRESHNESS.has(body?.freshness)?body.freshness:'7d';
  const channel=body?.channel&&typeof body.channel==='object'?body.channel:{};
  if(!String(channel.name||'').trim())return json({error:'channel.name is required'},400);
  if(provider===CURATED_REMOTE_FEEDS_PROVIDER)return discoverCurated(channel,freshness,env);
  if(provider===GITHUB_PUBLIC_PLAYLISTS_PROVIDER){
    if(String(env.DISABLE_GITHUB_PUBLIC_PLAYLISTS||'')==='1')return json({error:'Provider disabled',provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER},503);
    try{
      const result=await discoverGithubPublicPlaylists({channel,freshness,parseM3u});
      return json({service:'WebTV Source Discovery',version:VERSION,enabled:true,...result});
    }catch(error){return json({error:error?.message||String(error),provider:GITHUB_PUBLIC_PLAYLISTS_PROVIDER},502);}
  }
  if(provider===RECENT_WEB_SEARCH_PROVIDER){
    if(String(env.DISABLE_RECENT_WEB_SEARCH||'')==='1')return json({error:'Provider disabled',provider:RECENT_WEB_SEARCH_PROVIDER},503);
    if(!env.BRAVE_API_KEY)return json({error:'BRAVE_API_KEY is not configured for Source Discovery',provider:RECENT_WEB_SEARCH_PROVIDER},503);
    try{
      const result=await discoverRecentWebSearch({channel,freshness,env,parseM3u});
      return json({service:'WebTV Source Discovery',version:VERSION,enabled:true,...result});
    }catch(error){return json({error:error?.message||String(error),provider:RECENT_WEB_SEARCH_PROVIDER},502);}
  }
  if(provider===STRM_SPECIFIC_DISCOVERY_PROVIDER){
    if(String(env.DISABLE_STRM_SPECIFIC_DISCOVERY||'')==='1')return json({error:'Provider disabled',provider:STRM_SPECIFIC_DISCOVERY_PROVIDER},503);
    try{
      const result=await discoverStrmSpecific({channel,freshness,parseM3u,feeds:FEEDS.filter(feed=>feed.format!=='enigma2')});
      return json({service:'WebTV Source Discovery',version:VERSION,enabled:true,...result});
    }catch(error){return json({error:error?.message||String(error),provider:STRM_SPECIFIC_DISCOVERY_PROVIDER},502);}
  }
  if(provider===OFFICIAL_PROVIDER_LANE){
    if(String(env.DISABLE_OFFICIAL_PROVIDER_LANE||'')==='1')return json({error:'Provider disabled',provider:OFFICIAL_PROVIDER_LANE},503);
    try{
      const result=await discoverOfficialProvider({channel,freshness});
      return json({service:'WebTV Source Discovery',version:VERSION,enabled:true,...result});
    }catch(error){return json({error:error?.message||String(error),provider:OFFICIAL_PROVIDER_LANE},502);}
  }
  if(provider===OFFICIAL_API_RESOLVER_PROVIDER){
    if(String(env.DISABLE_OFFICIAL_API_RESOLVER||'')==='1')return json({error:'Provider disabled',provider:OFFICIAL_API_RESOLVER_PROVIDER},503);
    try{
      const result=await discoverOfficialApi({channel,freshness,verifierBinding:env.SOURCE_VERIFIER,verifierUrl:env.SOURCE_VERIFIER_URL});
      return json({service:'WebTV Source Discovery',version:VERSION,enabled:true,...result});
    }catch(error){return json({error:error?.message||String(error),provider:OFFICIAL_API_RESOLVER_PROVIDER},502);}
  }
  if(provider===BROWSER_RESOLVED_OFFICIAL_PROVIDER){
    if(String(env.DISABLE_BROWSER_RESOLVED_OFFICIAL||'')==='1')return json({error:'Provider disabled',provider:BROWSER_RESOLVED_OFFICIAL_PROVIDER},503);
    if(!env.BROWSER_RESOLVER_URL||!env.BROWSER_RESOLVER_TOKEN)return json({error:'Browser resolver URL/token are not configured',provider:BROWSER_RESOLVED_OFFICIAL_PROVIDER,available:false},503);
    try{
      const result=await discoverBrowserResolvedOfficial({channel,freshness,env});
      return json({service:'WebTV Source Discovery',version:VERSION,enabled:true,...result});
    }catch(error){return json({error:error?.message||String(error),provider:BROWSER_RESOLVED_OFFICIAL_PROVIDER},502);}
  }
  return json({error:'Unsupported provider'},400);
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/')return json({service:'WebTV Source Discovery',version:VERSION,providers:{
      [CURATED_REMOTE_FEEDS_PROVIDER]:String(env?.DISABLE_CURATED_REMOTE_FEEDS||'')!=='1',
      [GITHUB_PUBLIC_PLAYLISTS_PROVIDER]:String(env?.DISABLE_GITHUB_PUBLIC_PLAYLISTS||'')!=='1',
      [RECENT_WEB_SEARCH_PROVIDER]:String(env?.DISABLE_RECENT_WEB_SEARCH||'')!=='1'&&Boolean(env?.BRAVE_API_KEY),
      [STRM_SPECIFIC_DISCOVERY_PROVIDER]:String(env?.DISABLE_STRM_SPECIFIC_DISCOVERY||'')!=='1',
      [OFFICIAL_PROVIDER_LANE]:String(env?.DISABLE_OFFICIAL_PROVIDER_LANE||'')!=='1',
      [OFFICIAL_API_RESOLVER_PROVIDER]:String(env?.DISABLE_OFFICIAL_API_RESOLVER||'')!=='1',
      [BROWSER_RESOLVED_OFFICIAL_PROVIDER]:String(env?.DISABLE_BROWSER_RESOLVED_OFFICIAL||'')!=='1'&&Boolean(env?.BROWSER_RESOLVER_URL)&&Boolean(env?.BROWSER_RESOLVER_TOKEN),
    },limits:{timeoutMs:FETCH_TIMEOUT_MS,maxConcurrency:MAX_CONCURRENCY,maxResults:MAX_RESULTS,feeds:FEEDS.length,fallbackTriggerCount:FALLBACK_TRIGGER_COUNT}});
    if(request.method==='POST'&&url.pathname==='/discover')return discover(request,env);
    return json({error:'Not found'},404);
  }
};

export { FEEDS, CURATED_REMOTE_FEEDS_PROVIDER as PROVIDER, GITHUB_PUBLIC_PLAYLISTS_PROVIDER, RECENT_WEB_SEARCH_PROVIDER, STRM_SPECIFIC_DISCOVERY_PROVIDER, OFFICIAL_PROVIDER_LANE, OFFICIAL_API_RESOLVER_PROVIDER, BROWSER_RESOLVED_OFFICIAL_PROVIDER, FETCH_TIMEOUT_MS, MAX_CONCURRENCY, MAX_RESULTS, FALLBACK_TRIGGER_COUNT, normalize, benignBase, candidateMatches, parseM3u, parseEnigma2, parseFeed };
