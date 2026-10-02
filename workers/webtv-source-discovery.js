import { GITHUB_PUBLIC_PLAYLISTS_PROVIDER, discoverGithubPublicPlaylists } from './source-discovery/github-public-playlists.js';
import { RECENT_WEB_SEARCH_PROVIDER, discoverRecentWebSearch } from './source-discovery/recent-web-search.js';
import { STRM_SPECIFIC_DISCOVERY_PROVIDER, discoverStrmSpecific } from './source-discovery/strm-specific-discovery.js';
import { channelSignalsMatch, normalizeChannelText } from '../src/core/channel-identity-gr.js';
import { parseM3uContainer, splitM3uSourceAlternatives } from '../src/core/m3u-container.js';
import { parseEnigma2Bouquet } from '../src/core/enigma2-core.js';
import { CURATED_SOURCE_FEEDS } from '../src/search/curated-source-catalog.js';
import { familySignalsMatch } from '../src/search/family-matching.js';

const VERSION='1.7';
const CURATED_REMOTE_FEEDS_PROVIDER='curated-remote-feeds';
const FETCH_TIMEOUT_MS=3500;
const MAX_FETCH_BYTES=4000000;
const MAX_CONCURRENCY=4;
const MAX_RESULTS=12;
const FALLBACK_TRIGGER_COUNT=3;
const ALLOWED_FRESHNESS=new Set(['24h','7d','30d']);
const FEEDS=CURATED_SOURCE_FEEDS;

function cors(){return {'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'};}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors(),'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});}
function normalize(value=''){return normalizeChannelText(value);}
function benignBase(value=''){
  let out=normalize(value);
  for(let i=0;i<3;i++){
    const next=out.replace(/\s+(?:hd|tv|channel|greece|greek|gr)$/i,'').trim();
    if(next===out)break;
    out=next;
  }
  return out;
}
function attr(line='',name=''){
  const match=String(line).match(new RegExp(`${name}="([^"]*)"`,'i'));
  return match?.[1]?.trim()||'';
}
function titleOf(line=''){const index=String(line).lastIndexOf(',');return index>=0?String(line).slice(index+1).trim():'';}
function signalsMatch(signals=[],channel={}){
  return channel?.familyQuery===true?familySignalsMatch(signals,channel):channelSignalsMatch(signals,channel,'exact');
}
function candidateMatches(extinf='',channel={}){
  return signalsMatch([titleOf(extinf),attr(extinf,'tvg-name'),attr(extinf,'tvg-id')],channel);
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
  const results=[];
  for(const entry of parseM3uContainer(text)){
    if(results.length>=MAX_RESULTS)break;
    const extinf=entry.extinf;
    if(!candidateMatches(extinf,channel))continue;
    if(entry.sourceOffset===null||entry.sourceOffset>=10)continue;
    const matchedName=titleOf(extinf)||attr(extinf,'tvg-name')||attr(extinf,'tvg-id')||channel.name||'';
    const resultName=channel.familyQuery===true?matchedName:(channel.name||matchedName);
    for(const sourceUrl of splitM3uSourceAlternatives(entry.sourceLine)){
      if(results.length>=MAX_RESULTS)break;
      if(!validPublicUrl(sourceUrl))continue;
      results.push(makeCandidate({channel:{...channel,name:resultName},sourceUrl,sourceOrigin:feed.name,freshness:feed.freshness||'live-feed-check'}));
    }
  }
  return results;
}
function parseEnigma2(text='',channel={},feed={}){
  const results=[];
  for(const service of parseEnigma2Bouquet(text).services){
    if(results.length>=MAX_RESULTS)break;
    if(!['4097','5001','5002'].includes(service.serviceType))continue;
    const sourceUrl=service.decodedReferenceOnce;
    const inlineName=service.inlineNameDecodedOnce;
    const description=service.rawDescription;
    if(!validPublicUrl(sourceUrl))continue;
    if(!signalsMatch([inlineName,description],channel))continue;
    const matchedName=description||inlineName||channel.name||'';
    const resultName=channel.familyQuery===true?matchedName:(channel.name||matchedName);
    results.push(makeCandidate({channel:{...channel,name:resultName},sourceUrl,sourceOrigin:feed.name,freshness:feed.freshness||'live-feed-check'}));
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
  for(const item of candidates){const key=String(item?.sourceUrl||'').trim();if(!key||seen.has(key))continue;seen.add(key);out.push(item);if(out.length>=MAX_RESULTS)break;}
  return out;
}
async function discoverCurated(channel,freshness,env={}){
  if(String(env.DISABLE_CURATED_REMOTE_FEEDS||'')==='1')return json({error:'Provider disabled',provider:CURATED_REMOTE_FEEDS_PROVIDER},503);
  const enabledFeeds=FEEDS.filter(feed=>feed.enabled!==false);
  const primaryFeeds=enabledFeeds.filter(feed=>(feed.tier||'primary')==='primary');
  const fallbackFeeds=enabledFeeds.filter(feed=>feed.tier==='fallback');
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
    limits:{timeoutMs:FETCH_TIMEOUT_MS,maxConcurrency:MAX_CONCURRENCY,maxResults:MAX_RESULTS,feeds:enabledFeeds.length,fallbackTriggerCount:FALLBACK_TRIGGER_COUNT},
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
      const result=await discoverStrmSpecific({channel,freshness,parseM3u,feeds:FEEDS.filter(feed=>feed.enabled!==false&&feed.format!=='enigma2')});
      return json({service:'WebTV Source Discovery',version:VERSION,enabled:true,...result});
    }catch(error){return json({error:error?.message||String(error),provider:STRM_SPECIFIC_DISCOVERY_PROVIDER},502);}
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
    },limits:{timeoutMs:FETCH_TIMEOUT_MS,maxConcurrency:MAX_CONCURRENCY,maxResults:MAX_RESULTS,feeds:FEEDS.filter(feed=>feed.enabled!==false).length,fallbackTriggerCount:FALLBACK_TRIGGER_COUNT}});
    if(request.method==='POST'&&url.pathname==='/discover')return discover(request,env);
    return json({error:'Not found'},404);
  }
};

export { FEEDS, CURATED_REMOTE_FEEDS_PROVIDER as PROVIDER, GITHUB_PUBLIC_PLAYLISTS_PROVIDER, RECENT_WEB_SEARCH_PROVIDER, STRM_SPECIFIC_DISCOVERY_PROVIDER, FETCH_TIMEOUT_MS, MAX_CONCURRENCY, MAX_RESULTS, FALLBACK_TRIGGER_COUNT, normalize, benignBase, candidateMatches, parseM3u, parseEnigma2, parseFeed };