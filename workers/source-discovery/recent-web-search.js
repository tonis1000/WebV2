import { channelSignalsMatch, greekChannelAliases, normalizeChannelText } from '../../src/core/channel-identity-gr.js';
import { sanitizeCandidateUrl } from '../../src/core/source-candidate-url.js';
export const RECENT_WEB_SEARCH_PROVIDER='recent-web-search';
export const WEB_SEARCH_TIMEOUT_MS=6000;
export const WEB_MAX_SEARCHES=2;
export const WEB_MAX_PAGE_SCANS=4;
export const WEB_MAX_RESULTS=12;
export const WEB_MAX_SUBREQUESTS=8;

const BRAVE_FRESHNESS=Object.freeze({'24h':'pd','7d':'pw','30d':'pm'});
const BLOCKED_HOSTS=/^(?:x\.com|twitter\.com|tiktok\.com|www\.tiktok\.com|facebook\.com|www\.facebook\.com|instagram\.com|www\.instagram\.com|youtube\.com|www\.youtube\.com|youtu\.be)$/i;
const LIVE_URL=/https?:\/\/[^\s"'<>]+?\.(?:m3u8|mpd)(?:\?[^\s"'<>]*)?/gi;
const TRUSTED_STREAM_HOST_HINT=/(?:^|\.)(?:siliconweb\.com|antennaplus\.gr|broadpeak-aas\.com|msvdn\.net|smart-tv-data\.com|streams\.ovh|crystalweb\.net|gwebstream\.eu)$/i;

function normalize(value=''){return normalizeChannelText(value);}
function channelRelevant(text='',channel={}){
  return channelSignalsMatch([text],channel,'broad');
}
function typeOf(url=''){
  const clean=String(url).split('|')[0].trim();
  if(/\.mpd(?:[?#]|$)/i.test(clean))return 'dash';
  if(/\.m3u8(?:[?#]|$)/i.test(clean))return 'hls';
  if(/\.m3u(?:[?#]|$)/i.test(clean))return 'm3u';
  if(/\.strm(?:[?#]|$)/i.test(clean))return 'strm';
  return 'direct';
}
function safePublicUrl(raw=''){
  const u=new URL(String(raw));
  if(!/^https?:$/.test(u.protocol))throw new Error('Only http/https web results are allowed');
  const h=u.hostname.toLowerCase();
  if(BLOCKED_HOSTS.test(h))throw new Error('Blocked result host');
  if(h==='localhost'||h==='0.0.0.0'||h==='::1'||h.endsWith('.local')||h==='169.254.169.254')throw new Error('Private/local targets are not allowed');
  const m=h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(m){const a=+m[1],b=+m[2];if(a===10||a===127||a===0||(a===169&&b===254)||(a===192&&b===168)||(a===172&&b>=16&&b<=31))throw new Error('Private IP targets are not allowed');}
  return u;
}
function unique(items=[],keyFn=item=>item?.sourceUrl){const seen=new Set(),out=[];for(const item of items){const key=String(keyFn(item)||'');if(!key||seen.has(key))continue;seen.add(key);out.push(item);if(out.length>=WEB_MAX_RESULTS)break;}return out;}
function extractLive(text=''){return [...new Set((String(text).match(LIVE_URL)||[]).map(sanitizeCandidateUrl).filter(Boolean))];}
function resultDate(result={}){for(const value of [result.page_age,result.age,result.published,result.updatedAt]){if(!value)continue;const t=Date.parse(value);if(Number.isFinite(t))return new Date(t).toISOString();}return null;}
function searchesFor(channel={}){
  const name=String(channel.name||channel.originalId||channel.tvgId||channel.id||'').trim();
  const aliases=[...new Set([name,...greekChannelAliases(name),channel.originalId,channel.tvgId].map(value=>String(value||'').trim()).filter(Boolean))];
  const technical=aliases[0]||name;
  const greekish=aliases.find(value=>/[Α-Ωα-ωΆΈΉΊΌΎΏάέήίόύώ]/.test(value))||aliases.find((value,index)=>index>0&&/\s/.test(value))||technical;
  return [
    {query:`"${technical}" m3u8 mpd Greece`,language:'en'},
    {query:`"${greekish}" ζωντανά τηλεόραση m3u8`,language:'el'},
  ].slice(0,WEB_MAX_SEARCHES);
}
function braveError(body={}){
  const error=body?.error;
  if(error&&typeof error==='object')return [error.code,error.detail,error.status].filter(Boolean).join(' · ')||JSON.stringify(error);
  return String(body?.message||error||'');
}
class Budget{constructor(limit=WEB_MAX_SUBREQUESTS){this.limit=limit;this.used=0;}take(){if(this.used>=this.limit)throw new Error('Recent web provider subrequest budget exhausted');this.used++;}remaining(){return Math.max(0,this.limit-this.used);}}
async function timedFetch(url,options={}){const c=new AbortController(),timer=setTimeout(()=>c.abort(new DOMException('timeout','AbortError')),WEB_SEARCH_TIMEOUT_MS);try{return await fetch(url,{...options,signal:c.signal,redirect:'follow'});}finally{clearTimeout(timer);}}
async function braveSearch(env,searchSpec,freshness,budget){
  const query=String(searchSpec?.query||searchSpec||'');
  const language=String(searchSpec?.language||'en');
  if(!env?.BRAVE_API_KEY)throw new Error('BRAVE_API_KEY is not configured for Source Discovery');
  budget.take();const started=Date.now();
  const url=new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q',query);url.searchParams.set('count','8');url.searchParams.set('freshness',BRAVE_FRESHNESS[freshness]||'pw');url.searchParams.set('text_decorations','false');url.searchParams.set('search_lang',language);
  try{
    const response=await timedFetch(url,{headers:{Accept:'application/json','X-Subscription-Token':env.BRAVE_API_KEY}});
    const body=await response.json().catch(()=>({}));
    return {ok:response.ok,status:response.status,elapsedMs:Date.now()-started,results:response.ok?(body?.web?.results||[]):[],error:response.ok?'':braveError(body)};
  }catch(error){return {ok:false,status:error?.name==='AbortError'?408:0,elapsedMs:Date.now()-started,results:[],error:error?.message||String(error)};}
}
async function fetchPage(raw,budget){
  budget.take();const started=Date.now();
  let url;try{url=safePublicUrl(raw);}catch(error){return {ok:false,status:0,elapsedMs:0,text:'',type:'',error:error.message};}
  try{
    const response=await timedFetch(url,{headers:{'user-agent':'Mozilla/5.0 WebTV-Discovery/1.2','accept':'text/html,text/plain,application/json,application/vnd.apple.mpegurl,application/x-mpegURL,*/*'}});
    if(!response.ok)return {ok:false,status:response.status,elapsedMs:Date.now()-started,text:'',type:response.headers.get('content-type')||'',error:''};
    return {ok:true,status:response.status,elapsedMs:Date.now()-started,text:(await response.text()).slice(0,1200000),type:response.headers.get('content-type')||'',error:''};
  }catch(error){return {ok:false,status:error?.name==='AbortError'?408:0,elapsedMs:Date.now()-started,text:'',type:'',error:error?.message||String(error)};}
}
function directCandidate(url,channel,result,freshness){const clean=sanitizeCandidateUrl(url);return clean?{channelName:String(channel.name||''),sourceType:typeOf(clean),sourceUrl:clean,sourceOrigin:`web:${new URL(result.url).hostname}`,discoveryProvider:RECENT_WEB_SEARCH_PROVIDER,discoveredAt:new Date().toISOString(),freshness:resultDate(result)?`result-date:${resultDate(result)}`:`brave-window:${freshness}`,matchConfidence:'MEDIUM'}:null;}
function resultScore(result={},channel={}){const text=`${result.title||''} ${result.description||''} ${result.url||''}`;let score=channelRelevant(text,channel)?10:0;try{if(TRUSTED_STREAM_HOST_HINT.test(new URL(String(result.url||'')).hostname))score+=5;}catch{}if(/m3u8|mpd|hls|dash|live stream|ζωνταν/i.test(text))score+=3;if(/playlist|iptv|television|tv/i.test(text))score+=1;return score;}

export async function discoverRecentWebSearch({channel,freshness='7d',env={},parseM3u}={}){
  if(typeof parseM3u!=='function')throw new Error('parseM3u dependency is required');
  const braveFreshness=BRAVE_FRESHNESS[freshness]||'pw';const budget=new Budget();const searchReports=[];const pageReports=[];const candidates=[];const resultPool=[];
  for(const spec of searchesFor(channel)){
    const search=await braveSearch(env,spec,freshness,budget);
    searchReports.push({query:spec.query,language:spec.language,status:search.status,elapsedMs:search.elapsedMs,count:search.results.length,error:search.error||''});
    if(search.ok)resultPool.push(...search.results);
  }
  const relevant=unique(resultPool.filter(result=>channelRelevant(`${result.title||''} ${result.description||''} ${result.url||''}`,channel)),item=>item?.url).sort((a,b)=>resultScore(b,channel)-resultScore(a,channel)).slice(0,WEB_MAX_PAGE_SCANS);
  for(const result of relevant){
    if(budget.remaining()<=0)break;
    const resultUrl=String(result.url||'');
    try{
      safePublicUrl(resultUrl);
      if(/\.(?:m3u8|mpd)(?:[?#]|$)/i.test(resultUrl)){const direct=directCandidate(resultUrl,channel,result,freshness);if(direct)candidates.push(direct);}
    }catch{continue;}
    const page=await fetchPage(resultUrl,budget);let matches=0;
    if(page.ok){
      if(/#EXTINF:/i.test(page.text)){
        const found=parseM3u(page.text,channel,{name:`web:${new URL(resultUrl).hostname}`,provider:RECENT_WEB_SEARCH_PROVIDER,freshness:resultDate(result)?`result-date:${resultDate(result)}`:`brave-window:${freshness}`});
        candidates.push(...found);matches+=found.length;
      }
      if(channelRelevant(`${result.title||''} ${result.description||''}`,channel)){
        for(const url of extractLive(page.text)){const direct=directCandidate(url,channel,result,freshness);if(!direct)continue;candidates.push(direct);matches++;if(candidates.length>=WEB_MAX_RESULTS)break;}
      }
    }
    pageReports.push({url:resultUrl,status:page.status,elapsedMs:page.elapsedMs,matches,error:page.error||''});
    if(candidates.length>=WEB_MAX_RESULTS)break;
  }
  return {provider:RECENT_WEB_SEARCH_PROVIDER,freshnessRequested:freshness,freshnessApplied:true,freshnessNote:`Brave Search freshness=${braveFreshness}; undated results inherit only the search-window guarantee, not a fabricated publication timestamp.`,limits:{timeoutMs:WEB_SEARCH_TIMEOUT_MS,maxSearches:WEB_MAX_SEARCHES,maxPageScans:WEB_MAX_PAGE_SCANS,maxResults:WEB_MAX_RESULTS,maxSubrequests:WEB_MAX_SUBREQUESTS},candidates:unique(candidates),reports:{searches:searchReports,pages:pageReports,subrequestsUsed:budget.used}};
}
