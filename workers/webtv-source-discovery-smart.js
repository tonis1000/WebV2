import baseWorker, { consolidateCuratedCandidates, MAX_CURATED_RETURNED_CANDIDATES } from './webtv-source-discovery.js';
import {
  canonicalizeStrmReference,
  isStrmReference,
  parseStrmDocument,
} from '../src/core/strm-core.js';
import {
  IPTV_ORG_STRUCTURED_STREAMS_URL,
  IPTV_ORG_STRUCTURED_MAX_BYTES,
  parseIptvOrgIdentity,
  selectIptvOrgStreamRows,
} from './source-discovery/iptv-org-structured.js';

const VERSION='1.15';
const MAX_STRM_RESOLVES=4;
const STRM_TIMEOUT_MS=6000;
const STRM_MAX_DEPTH=3;
const STRM_MAX_BYTES=256000;
const IPTV_ORG_TIMEOUT_MS=6000;
const IPTV_ORG_CACHE_TTL_MS=300000;
let iptvOrgStreamsCache={text:'',expiresAt:0};

function jsonResponse(response,payload){
  const headers=new Headers(response.headers);headers.set('content-type','application/json;charset=utf-8');headers.set('cache-control','no-store');headers.set('x-webtv-source-discovery-smart',VERSION);
  return new Response(JSON.stringify(payload),{status:response.status,headers});
}
function privateHost(host=''){
  const h=String(host).toLowerCase();
  if(h==='localhost'||h==='0.0.0.0'||h==='::1'||h.endsWith('.local')||h==='169.254.169.254')return true;
  const m=h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);if(!m)return false;
  const a=+m[1],b=+m[2];return a===10||a===127||a===0||(a===169&&b===254)||(a===192&&b===168)||(a===172&&b>=16&&b<=31);
}
function canonicalUrl(raw=''){
  const canonical=canonicalizeStrmReference(raw);
  if(!canonical)throw new Error('Only http/https STRM targets are allowed');
  const url=new URL(canonical);
  if(privateHost(url.hostname))throw new Error('Private/local STRM targets are not allowed');
  return url;
}
function typeOf(raw=''){
  const clean=String(raw||'').split('|')[0].trim();
  if(/\.m3u8(?:[?#]|$)/i.test(clean))return'hls';if(/\.mpd(?:[?#]|$)/i.test(clean))return'dash';if(/\.m3u(?:[?#]|$)/i.test(clean))return'm3u';if(isStrmReference(clean))return'strm';return'direct';
}
async function fetchText(raw){
  const url=canonicalUrl(raw);const c=new AbortController(),timer=setTimeout(()=>c.abort(new DOMException('timeout','AbortError')),STRM_TIMEOUT_MS);
  try{const response=await fetch(url,{redirect:'follow',signal:c.signal,headers:{'user-agent':`WebTV-Discovery/${VERSION} STRM resolver`,accept:'text/plain,application/vnd.apple.mpegurl,application/x-mpegURL,*/*'}});if(!response.ok)return{ok:false,status:response.status,text:'',url:url.toString()};return{ok:true,status:response.status,text:(await response.text()).slice(0,STRM_MAX_BYTES),url:url.toString()};}
  catch(error){return{ok:false,status:error?.name==='AbortError'?408:0,text:'',url:url.toString(),error:error?.message||String(error)};}finally{clearTimeout(timer);}
}
async function resolveStrm(raw,depth=0,chain=[]){
  if(depth>=STRM_MAX_DEPTH)return{ok:false,error:'Maximum STRM depth reached',chain};
  let fetched;try{fetched=await fetchText(raw);}catch(error){return{ok:false,error:error.message,chain};}
  const next=[...chain,fetched.url];if(!fetched.ok)return{ok:false,status:fetched.status,error:fetched.error||`STRM HTTP ${fetched.status}`,chain:next};
  const parsed=parseStrmDocument(fetched.text);if(parsed.drm?.detected)return{ok:false,status:fetched.status,error:'DRM-marked STRM is not auto-promoted',chain:next,drmDetected:true};
  if(!parsed.mediaUrl)return{ok:false,status:fetched.status,error:'STRM did not contain an HTTP media target',chain:next};
  if(isStrmReference(parsed.mediaUrl))return resolveStrm(parsed.mediaUrl,depth+1,next);
  let target;try{target=canonicalUrl(parsed.mediaUrl).toString();}catch(error){return{ok:false,error:error.message,chain:next};}
  return{ok:true,status:fetched.status,resolvedUrl:target,sourceType:typeOf(parsed.mediaUrl),requiredHeaders:parsed.requiredHeaders||{},chain:next};
}
function isAllowedCuratedCandidate(item={}){
  try{
    const raw=String(item?.sourceUrl||'').split('|')[0].trim();
    const url=new URL(raw);
    return !privateHost(url.hostname);
  }catch{return false;}
}
function safeRequiredHeaders(row={}){
  const out={};
  const ua=String(row.userAgent||'').trim(),ref=String(row.referrer||'').trim();
  if(ua&&!/[\r\n\0]/.test(ua))out['User-Agent']=ua;
  if(ref&&!/[\r\n\0]/.test(ref))out.Referer=ref;
  return out;
}
function structuredCandidate(row={},channel={}){
  const raw=String(row.url||'').trim();
  try{
    const clean=raw.split('|')[0].trim(),url=new URL(clean);
    if(!/^https?:$/.test(url.protocol)||privateHost(url.hostname))return null;
  }catch{return null;}
  const requiredHeaders=safeRequiredHeaders(row);
  return {
    channelName:String(channel.name||''),
    sourceType:typeOf(raw),
    sourceUrl:raw,
    sourceOrigin:'iptv-org structured streams',
    discoveryProvider:'curated-remote-feeds',
    discoveredAt:new Date().toISOString(),
    freshness:'live-api-check',
    matchConfidence:'HIGH',
    saveEligible:true,
    verificationDetail:'iptv-org structured stream candidate; final media still requires WebV2 verification and playback proof',
    sourceOriginUrl:IPTV_ORG_STRUCTURED_STREAMS_URL,
    inputFormatId:'iptv-org-streams-json',
    iptvOrgChannelId:row.channel||'',
    iptvOrgFeedId:row.feed||'',
    streamTitle:row.title||'',
    quality:row.quality||'',
    labels:Array.isArray(row.labels)?row.labels:[],
    ...(Object.keys(requiredHeaders).length?{requiredHeaders}:{}),
    sourceObservations:[{
      sourceOrigin:'iptv-org structured streams',
      sourceOriginUrl:IPTV_ORG_STRUCTURED_STREAMS_URL,
      inputFormatId:'iptv-org-streams-json',
      freshness:'live-api-check',
      requiredHeaderNames:Object.keys(requiredHeaders),
      unsupportedDirectiveNames:[],
      enigma2ServiceType:'',
      enigma2Bouquet:'',
    }],
  };
}
async function readBoundedText(response,maxBytes){
  if(!response?.body||typeof response.body.getReader!=='function')return (await response.text()).slice(0,maxBytes);
  const reader=response.body.getReader(),decoder=new TextDecoder();let out='',used=0,limited=false;
  try{
    while(used<maxBytes){
      const {done,value}=await reader.read();if(done)break;if(!value?.byteLength)continue;
      const remaining=maxBytes-used,chunk=value.byteLength>remaining?value.subarray(0,remaining):value;
      out+=decoder.decode(chunk,{stream:true});used+=chunk.byteLength;
      if(value.byteLength>remaining||used>=maxBytes){limited=true;break;}
    }
    if(!limited)out+=decoder.decode();
  }finally{
    if(limited){try{await reader.cancel('structured iptv-org byte budget reached');}catch{}}
    try{reader.releaseLock();}catch{}
  }
  return out;
}
async function loadIptvOrgStreamsText(){
  const now=Date.now();
  if(iptvOrgStreamsCache.text&&iptvOrgStreamsCache.expiresAt>now)return{ok:true,status:200,text:iptvOrgStreamsCache.text,cacheHit:true};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new DOMException('timeout','AbortError')),IPTV_ORG_TIMEOUT_MS);
  try{
    const response=await fetch(IPTV_ORG_STRUCTURED_STREAMS_URL,{redirect:'follow',signal:controller.signal,headers:{'user-agent':`WebTV-Discovery/${VERSION} iptv-org structured`,accept:'application/json'}});
    if(!response.ok)return{ok:false,status:response.status,text:'',cacheHit:false};
    const declared=Number(response.headers.get('content-length')||0);
    if(declared>IPTV_ORG_STRUCTURED_MAX_BYTES)return{ok:false,status:413,text:'',cacheHit:false,error:'dataset exceeds byte budget'};
    const text=await readBoundedText(response,IPTV_ORG_STRUCTURED_MAX_BYTES);
    iptvOrgStreamsCache={text,expiresAt:Date.now()+IPTV_ORG_CACHE_TTL_MS};
    return{ok:true,status:response.status,text,cacheHit:false};
  }catch(error){
    return{ok:false,status:error?.name==='AbortError'?408:0,text:'',cacheHit:false,error:error?.message||String(error)};
  }finally{clearTimeout(timer);}
}
async function enrichIptvOrgStructured(payload={},channel={}){
  const identity=parseIptvOrgIdentity(channel);
  if(!identity||identity.countryCode==='gr')return {...payload,version:VERSION};
  const started=Date.now(),loaded=await loadIptvOrgStreamsText();
  if(!loaded.ok)return {...payload,version:VERSION,structuredIptvOrg:{attempted:true,status:loaded.status,count:0,elapsedMs:Date.now()-started,cacheHit:false,error:loaded.error||''}};
  const rows=selectIptvOrgStreamRows(loaded.text,channel,12);
  const structured=rows.map(row=>structuredCandidate(row,channel)).filter(Boolean);
  const existing=Array.isArray(payload.candidates)?payload.candidates:[];
  const consolidation=consolidateCuratedCandidates([...structured,...existing],{maxResults:MAX_CURATED_RETURNED_CANDIDATES});
  const actions=[...(Array.isArray(payload.actions)?payload.actions:[]),...consolidation.actions,{type:'structured.iptv-org.completed',message:'Structured iptv-org exact-stream enrichment completed',detail:{matched:structured.length,status:loaded.status,cacheHit:loaded.cacheHit}}];
  return {...payload,version:VERSION,candidates:consolidation.candidates,actions,planning:{...(payload.planning||{}),structuredIptvOrg:true,structuredRawCandidateCount:structured.length,structuredReturnedCandidateCount:consolidation.candidates.length,structuredTruncatedCandidateCount:consolidation.truncatedCount},structuredIptvOrg:{attempted:true,status:loaded.status,count:structured.length,elapsedMs:Date.now()-started,maxBytes:IPTV_ORG_STRUCTURED_MAX_BYTES,cacheHit:loaded.cacheHit,cacheTtlMs:IPTV_ORG_CACHE_TTL_MS}};
}
async function resolveCuratedStrm(payload={}){
  const input=Array.isArray(payload.candidates)?payload.candidates:[],out=[],reports=[];let attempts=0;
  for(const item of input){
    if(!isAllowedCuratedCandidate(item)){reports.push({reference:item?.sourceUrl||'',resolved:false,error:'Non-public curated target rejected'});continue;}
    if(item?.sourceType!=='strm'){out.push(item);continue;}
    if(attempts>=MAX_STRM_RESOLVES){reports.push({reference:item.sourceUrl,resolved:false,error:'STRM resolve limit reached'});continue;}
    attempts++;
    const result=await resolveStrm(item.sourceUrl);
    reports.push({reference:item.sourceUrl,resolved:Boolean(result.ok),status:result.status||0,resolvedUrl:result.resolvedUrl||'',sourceType:result.sourceType||'',requiredHeaders:Object.keys(result.requiredHeaders||{}),chainLength:result.chain?.length||0,error:result.error||'',drmDetected:Boolean(result.drmDetected)});
    if(!result.ok||!result.resolvedUrl)continue;
    out.push({...item,sourceUrl:result.resolvedUrl,sourceType:result.sourceType,sourceOrigin:`${item.sourceOrigin||'curated'} · STRM resolved`,requiredHeaders:result.requiredHeaders||{},resolvedFrom:item.sourceUrl,verificationDetail:'Resolved from STRM reference; final media still requires playback verification'});
  }
  const consolidation=consolidateCuratedCandidates(out,{maxResults:MAX_CURATED_RETURNED_CANDIDATES});
  const strmActions=reports.map(item=>({type:item.resolved?'strm.resolved':'strm.rejected',sourceUrl:item.resolvedUrl||item.reference||'',message:item.resolved?'STRM reference resolved to media candidate':'STRM reference rejected or unresolved',detail:{status:item.status||0,sourceType:item.sourceType||'',chainLength:item.chainLength||0,error:item.error||'',drmDetected:Boolean(item.drmDetected)}}));
  return {...payload,version:VERSION,candidates:consolidation.candidates,actions:[...(Array.isArray(payload.actions)?payload.actions:[]),...strmActions,...consolidation.actions],planning:{...(payload.planning||{}),strmReturnedCandidateCount:consolidation.candidates.length,strmTruncatedCandidateCount:consolidation.truncatedCount},strmResolution:{attempted:attempts,resolved:reports.filter(x=>x.resolved).length,rejected:reports.filter(x=>!x.resolved).length,reports}};
}

export default {async fetch(request,env,ctx){
  const bodyRequest=request.method==='POST'?request.clone():null;
  const response=await baseWorker.fetch(request,env,ctx);const url=new URL(request.url);const type=response.headers.get('content-type')||'';
  if(!type.includes('application/json'))return response;
  let payload;try{payload=await response.clone().json();}catch{return response;}
  if(url.pathname==='/'&&response.ok)payload={...payload,version:VERSION,features:[...(payload.features||[]),'curated STRM pre-resolution','iptv-org structured exact streams']};
  else if(url.pathname==='/discover'&&response.ok&&request.method==='POST'){
    let body={};try{body=bodyRequest?await bodyRequest.json():{};}catch{}
    if(String(body?.provider||'')==='curated-remote-feeds'){payload=await enrichIptvOrgStructured(payload,body?.channel||{});payload=await resolveCuratedStrm(payload);}else payload={...payload,version:VERSION};
  }
  return jsonResponse(response,payload);
}};
