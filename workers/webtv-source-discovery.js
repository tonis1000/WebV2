import { GITHUB_PUBLIC_PLAYLISTS_PROVIDER, discoverGithubPublicPlaylists } from './source-discovery/github-public-playlists.js';
import { RECENT_WEB_SEARCH_PROVIDER, discoverRecentWebSearch } from './source-discovery/recent-web-search.js';
import { STRM_SPECIFIC_DISCOVERY_PROVIDER, discoverStrmSpecific } from './source-discovery/strm-specific-discovery.js';
import { channelSignalsMatch, createChannelSignalsMatcher, normalizeChannelText } from '../src/core/channel-identity-gr.js';
import { selectM3uContainerEntries, splitM3uSourceAlternatives } from '../src/core/m3u-container.js';
import { selectEnigma2BouquetServices } from '../src/core/enigma2-core.js';
import { parseIptvUrl } from '../src/core/utils.js';
import { CURATED_SOURCE_FEEDS } from '../src/search/curated-source-catalog.js';
import { familySignalsMatch } from '../src/search/family-matching.js';

const VERSION='1.13';
const CURATED_REMOTE_FEEDS_PROVIDER='curated-remote-feeds';
const FETCH_TIMEOUT_MS=3500;
const MAX_FETCH_BYTES=4000000;
const MAX_CONCURRENCY=4;
const MAX_RESULTS=12;
const FALLBACK_TRIGGER_COUNT=3;
const MAX_PRIMARY_FEEDS_PER_REQUEST=2;
const MAX_FALLBACK_FEEDS_PER_REQUEST=1;
const MAX_INTELLIGENCE_FEEDS_PER_REQUEST=1;
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
function prepareSignalsMatcher(channel={}){
  if(channel?.familyQuery===true)return signals=>familySignalsMatch(signals,channel);
  return createChannelSignalsMatcher(channel,'exact');
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
function makeCandidate({channel,sourceUrl,sourceOrigin,sourceOriginUrl='',freshness='live-feed-check',extra={}}){
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
    sourceOriginUrl,
    ...extra,
  };
}
function curatedM3uRequiredHeaders(entry={},sourceUrl=''){
  const directives={};
  for(const directive of Array.isArray(entry?.directivesBeforeSource)?entry.directivesBeforeSource:[]){
    const match=String(directive||'').match(/^#EXTVLCOPT:http-(user-agent|referr?er)=(.*)$/i);
    if(!match)continue;
    if(match[1].toLowerCase()==='user-agent')directives['User-Agent']=match[2];
    else directives.Referer=match[2];
  }
  const attributes={
    'User-Agent':entry?.attributes?.['http-user-agent']||'',
    Referer:entry?.attributes?.['http-referrer']||entry?.attributes?.['http-referer']||'',
  };
  const inline=parseIptvUrl(sourceUrl).headers||{};
  const merged={...normalizeRequiredHeaders(directives),...normalizeRequiredHeaders(attributes)};
  for(const key of ['User-Agent','Referer']){
    if(inline[key])merged[key]=inline[key];
  }
  return merged;
}
function parseM3u(text='',channel={},feed={}){
  const results=[];
  const matches=prepareSignalsMatcher(channel);
  for(const entry of selectM3uContainerEntries(text,{acceptExtinf:extinf=>matches([titleOf(extinf),attr(extinf,'tvg-name'),attr(extinf,'tvg-id')]),limit:MAX_RESULTS})){
    if(results.length>=MAX_RESULTS)break;
    const extinf=entry.extinf;
    if(entry.sourceOffset===null||entry.sourceOffset>=10)continue;
    const matchedName=titleOf(extinf)||attr(extinf,'tvg-name')||attr(extinf,'tvg-id')||channel.name||'';
    const resultName=channel.familyQuery===true?matchedName:(channel.name||matchedName);
    for(const sourceUrl of splitM3uSourceAlternatives(entry.sourceLine)){
      if(results.length>=MAX_RESULTS)break;
      if(!validPublicUrl(sourceUrl))continue;
      const requiredHeaders=curatedM3uRequiredHeaders(entry,sourceUrl);
      results.push(makeCandidate({
        channel:{...channel,name:resultName},
        sourceUrl,
        sourceOrigin:feed.name,
        freshness:feed.freshness||'live-feed-check',
        extra:Object.keys(requiredHeaders).length?{requiredHeaders}:{},
      }));
    }
  }
  return results;
}
function parseEnigma2(text='',channel={},feed={}){
  const results=[];
  const matches=prepareSignalsMatcher(channel);
  const bouquet=selectEnigma2BouquetServices(text,{
    acceptService:service=>{
      if(!['4097','5001','5002'].includes(service.serviceType))return false;
      const inlineName=service.inlineName||service.inlineNameDecodedOnce||'';
      const description=service.description||service.rawDescription||'';
      return matches([inlineName,description]);
    },
  });
  for(const service of bouquet.services){
    if(results.length>=MAX_RESULTS)break;
    const sourceUrl=[service.decodedReference,service.embeddedReference,service.decodedReferenceOnce].find(validPublicUrl)||'';
    const inlineName=service.inlineName||service.inlineNameDecodedOnce||'';
    const description=service.description||service.rawDescription||'';
    if(!sourceUrl)continue;
    const matchedName=description||inlineName||channel.name||'';
    const resultName=channel.familyQuery===true?matchedName:(channel.name||matchedName);
    results.push(makeCandidate({
      channel:{...channel,name:resultName},
      sourceUrl,
      sourceOrigin:feed.name,
      sourceOriginUrl:feed.url||'',
      freshness:feed.freshness||'live-feed-check',
      extra:{
        inputFormatId:'enigma2',
        enigma2ServiceType:service.serviceType,
        enigma2Description:description,
        enigma2InlineName:inlineName,
        enigma2Bouquet:bouquet.name||'',
      },
    }));
  }
  return results;
}
function normalizeRequiredHeaders(headers={}){
  if(!headers||typeof headers!=='object')return {};
  const allowed=['User-Agent','Referer','Origin','X-Roku-Reserved-Dev-Id'];
  const out={};
  for(const [key,value] of Object.entries(headers)){
    const canonical=allowed.find(item=>item.toLowerCase()===String(key).toLowerCase());
    const text=String(value??'').trim();
    if(canonical&&text&&!/[\r\n\0]/.test(text))out[canonical]=text;
  }
  return out;
}
function parseAliveGrJson(text='',channel={},feed={}){
  let payload;
  try{payload=JSON.parse(String(text||''));}catch{return [];}
  const rows=Array.isArray(payload?.channels)?payload.channels:[];
  const matches=prepareSignalsMatcher(channel);
  const results=[];
  for(const row of rows){
    if(results.length>=MAX_RESULTS)break;
    const name=String(row?.name||'').trim();
    if(!name||!matches([name]))continue;
    for(const stream of Array.isArray(row?.streams)?row.streams:[]){
      if(results.length>=MAX_RESULTS)break;
      const sourceUrl=String(stream?.url||'').trim();
      if(!sourceUrl||!validPublicUrl(sourceUrl))continue;
      if(stream?.drm)continue;
      results.push(makeCandidate({
        channel:{...channel,name:channel.familyQuery===true?name:(channel.name||name)},
        sourceUrl,
        sourceOrigin:feed.name||'AliveGR',
        sourceOriginUrl:feed.url||'',
        freshness:feed.freshness||'live-feed-check',
        extra:{
          inputFormatId:'alivegr-json',
          requiredHeaders:normalizeRequiredHeaders(stream?.headers||{}),
          verificationDetail:'AliveGR live intelligence candidate; final media still requires WebV2 verification and playback proof',
        },
      }));
    }
  }
  return results;
}
function parseFeed(text='',channel={},feed={}){
  if(feed.format==='enigma2')return parseEnigma2(text,channel,feed);
  if(feed.format==='alivegr-json')return parseAliveGrJson(text,channel,feed);
  return parseM3u(text,channel,feed);
}
async function timedFetch(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new DOMException('timeout','AbortError')),FETCH_TIMEOUT_MS);
  try{return await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':`WebTV-Discovery/${VERSION}`,'accept':'text/plain,application/vnd.apple.mpegurl,application/x-mpegURL,*/*'}});}finally{clearTimeout(timer);}
}
async function readTextBounded(response,maxBytes=MAX_FETCH_BYTES){
  if(!response?.body||typeof response.body.getReader!=='function'){
    return (await response.text()).slice(0,maxBytes);
  }
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let text='',used=0,reachedLimit=false;
  try{
    while(used<maxBytes){
      const {done,value}=await reader.read();
      if(done)break;
      if(!value?.byteLength)continue;
      const remaining=maxBytes-used;
      const chunk=value.byteLength>remaining?value.subarray(0,remaining):value;
      text+=decoder.decode(chunk,{stream:true});
      used+=chunk.byteLength;
      if(value.byteLength>remaining||used>=maxBytes){reachedLimit=true;break;}
    }
    if(!reachedLimit)text+=decoder.decode();
  }finally{
    if(reachedLimit){try{await reader.cancel('Source Discovery byte budget reached');}catch{}}
    try{reader.releaseLock();}catch{}
  }
  return text;
}
async function scanFeed(feed,channel){
  const started=Date.now();
  try{
    const response=await timedFetch(feed.url);
    if(!response.ok)return {feed:feed.name,tier:feed.tier||'primary',format:feed.format||'m3u',status:response.status,candidates:[],elapsedMs:Date.now()-started};
    const text=await readTextBounded(response,MAX_FETCH_BYTES);
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
function iptvOrgCountryCode(channel={}){
  const value=String(channel?.tvgId||'').trim();
  const match=value.match(/\.([a-z]{2})(?:@[^@\s]+)?$/i);
  return match?.[1]?.toLowerCase()||'';
}
function iptvOrgCountryFeed(countryCode=''){
  const code=String(countryCode||'').trim().toLowerCase();
  if(!/^[a-z]{2}$/.test(code))return null;
  return Object.freeze({
    id:`iptv-org-country-${code}`,
    name:`iptv-org ${code.toUpperCase()}`,
    label:`iptv-org ${code.toUpperCase()}`,
    url:`https://iptv-org.github.io/iptv/countries/${code}.m3u`,
    format:'m3u',
    tier:'primary',
    enabled:true,
    priority:'high',
    sourceRole:'query-aware-country',
  });
}
function selectCuratedFeedPlan(feeds=FEEDS,channel={}){
  const enabled=feeds.filter(feed=>feed.enabled!==false);
  const primary=enabled.filter(feed=>(feed.tier||'primary')==='primary');
  const fallback=enabled.filter(feed=>feed.tier==='fallback');
  const countryCode=iptvOrgCountryCode(channel);
  if(countryCode&&countryCode!=='gr'){
    const countryFeed=iptvOrgCountryFeed(countryCode);
    const b2og=fallback.find(feed=>feed.id==='b2og-iptv-org-all');
    return {
      primary:countryFeed?[countryFeed]:[],
      fallback:b2og?[b2og]:[],
      intelligence:[],
      totalEnabled:enabled.length,
      strategy:'iptv-org-country',
      countryCode,
    };
  }
  const intelligence=enabled.filter(feed=>feed.tier==='intelligence').slice(0,MAX_INTELLIGENCE_FEEDS_PER_REQUEST);
  const hans=primary.find(feed=>feed.id==='hanssettings-gr');
  const ciefp=fallback.find(feed=>feed.id==='ciefp-iptv-mix');
  const primaryPlan=[];
  const fallbackPlan=[];
  if(hans)primaryPlan.push(hans);
  for(const feed of primary){
    if(primaryPlan.length>=MAX_PRIMARY_FEEDS_PER_REQUEST)break;
    if(feed===hans)continue;
    primaryPlan.push(feed);
  }
  if(ciefp)fallbackPlan.push(ciefp);
  for(const feed of fallback){
    if(fallbackPlan.length>=MAX_FALLBACK_FEEDS_PER_REQUEST)break;
    if(feed===ciefp)continue;
    fallbackPlan.push(feed);
  }
  return {
    primary:primaryPlan,
    fallback:fallbackPlan,
    intelligence,
    totalEnabled:enabled.length,
    strategy:'greece-curated',
    countryCode:countryCode||'',
  };
}
async function discoverCurated(channel,freshness,env={}){
  if(String(env.DISABLE_CURATED_REMOTE_FEEDS||'')==='1')return json({error:'Provider disabled',provider:CURATED_REMOTE_FEEDS_PROVIDER},503);
  const enabledFeeds=FEEDS.filter(feed=>feed.enabled!==false);
  const plan=selectCuratedFeedPlan(enabledFeeds,channel);
  const primaryFeeds=plan.primary;
  const fallbackFeeds=plan.fallback;
  const intelligenceFeeds=plan.intelligence||[];
  const firstWave=[...intelligenceFeeds,...primaryFeeds];
  const primaryReports=await mapBounded(firstWave,MAX_CONCURRENCY,feed=>scanFeed(feed,channel));
  let reports=[...primaryReports];
  let candidates=dedupe(primaryReports.flatMap(report=>report.candidates||[]));
  if(candidates.length<FALLBACK_TRIGGER_COUNT&&fallbackFeeds.length){
    const fallbackReports=await mapBounded(fallbackFeeds,MAX_CONCURRENCY,feed=>scanFeed(feed,channel));
    reports=[...reports,...fallbackReports];
    candidates=dedupe([...candidates,...fallbackReports.flatMap(report=>report.candidates||[])]);
  }
  return json({
    service:'WebTV Source Discovery',version:VERSION,provider:CURATED_REMOTE_FEEDS_PROVIDER,enabled:true,
    freshnessRequested:freshness,freshnessApplied:false,freshnessNote:plan.strategy==='iptv-org-country'?'Curated feeds are checked live. A foreign exact tvg-id uses one bounded native iptv-org country playlist first, then b2og All only as the single mirror fallback when fewer than three matches are found.':'Curated feeds are checked live. A bounded Greece-first primary plan runs first; when fewer than three matches are found, one CPU-bounded fallback feed runs, prioritizing the Ciefp Enigma2 acceptance corpus.',
    planning:{strategy:plan.strategy||'greece-curated',countryCode:plan.countryCode||''},
    limits:{timeoutMs:FETCH_TIMEOUT_MS,maxConcurrency:MAX_CONCURRENCY,maxResults:MAX_RESULTS,feeds:enabledFeeds.length,fallbackTriggerCount:FALLBACK_TRIGGER_COUNT,maxPrimaryFeedsPerRequest:MAX_PRIMARY_FEEDS_PER_REQUEST,maxFallbackFeedsPerRequest:MAX_FALLBACK_FEEDS_PER_REQUEST,maxIntelligenceFeedsPerRequest:MAX_INTELLIGENCE_FEEDS_PER_REQUEST},
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
    if(body?.allowPaidFallback!==true)return json({error:'Explicit paid fallback opt-in is required',provider:RECENT_WEB_SEARCH_PROVIDER,paidFallbackRequired:true},409);
    if(!env.BRAVE_API_KEY)return json({error:'BRAVE_API_KEY is not configured for Source Discovery',provider:RECENT_WEB_SEARCH_PROVIDER},503);
    try{
      const result=await discoverRecentWebSearch({channel,freshness,env,parseM3u});
      return json({service:'WebTV Source Discovery',version:VERSION,enabled:true,...result});
    }catch(error){return json({error:error?.message||String(error),provider:RECENT_WEB_SEARCH_PROVIDER},502);}
  }
  if(provider===STRM_SPECIFIC_DISCOVERY_PROVIDER){
    if(String(env.DISABLE_STRM_SPECIFIC_DISCOVERY||'')==='1')return json({error:'Provider disabled',provider:STRM_SPECIFIC_DISCOVERY_PROVIDER},503);
    try{
      const result=await discoverStrmSpecific({channel,freshness,parseM3u,feeds:FEEDS.filter(feed=>feed.enabled!==false&&feed.format==='m3u')});
      return json({service:'WebTV Source Discovery',version:VERSION,enabled:true,...result});
    }catch(error){return json({error:error?.message||String(error),provider:STRM_SPECIFIC_DISCOVERY_PROVIDER},502);}
  }
  return json({error:'Unsupported provider'},400);
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/')return json({service:'WebTV Source Discovery',version:VERSION,costPolicy:'free-first',paidFallbackProviders:[RECENT_WEB_SEARCH_PROVIDER],providers:{
      [CURATED_REMOTE_FEEDS_PROVIDER]:String(env?.DISABLE_CURATED_REMOTE_FEEDS||'')!=='1',
      [GITHUB_PUBLIC_PLAYLISTS_PROVIDER]:String(env?.DISABLE_GITHUB_PUBLIC_PLAYLISTS||'')!=='1',
      [RECENT_WEB_SEARCH_PROVIDER]:String(env?.DISABLE_RECENT_WEB_SEARCH||'')!=='1'&&Boolean(env?.BRAVE_API_KEY),
      [STRM_SPECIFIC_DISCOVERY_PROVIDER]:String(env?.DISABLE_STRM_SPECIFIC_DISCOVERY||'')!=='1',
    },limits:{timeoutMs:FETCH_TIMEOUT_MS,maxConcurrency:MAX_CONCURRENCY,maxResults:MAX_RESULTS,feeds:FEEDS.filter(feed=>feed.enabled!==false).length,fallbackTriggerCount:FALLBACK_TRIGGER_COUNT,maxIntelligenceFeedsPerRequest:MAX_INTELLIGENCE_FEEDS_PER_REQUEST}});
    if(request.method==='POST'&&url.pathname==='/discover')return discover(request,env);
    return json({error:'Not found'},404);
  }
};

export { FEEDS, CURATED_REMOTE_FEEDS_PROVIDER as PROVIDER, GITHUB_PUBLIC_PLAYLISTS_PROVIDER, RECENT_WEB_SEARCH_PROVIDER, STRM_SPECIFIC_DISCOVERY_PROVIDER, FETCH_TIMEOUT_MS, MAX_FETCH_BYTES, MAX_CONCURRENCY, MAX_RESULTS, FALLBACK_TRIGGER_COUNT, MAX_PRIMARY_FEEDS_PER_REQUEST, MAX_FALLBACK_FEEDS_PER_REQUEST, MAX_INTELLIGENCE_FEEDS_PER_REQUEST, selectCuratedFeedPlan, readTextBounded, normalize, benignBase, candidateMatches, parseM3u, parseEnigma2, parseAliveGrJson, parseFeed };