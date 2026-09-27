import { OFFICIAL_PROVIDER_REGISTRY, channelKey, hostAllowed } from './official-provider-lane.js';

export const OFFICIAL_API_RESOLVER_PROVIDER='official-api-resolver';
export const OFFICIAL_API_TIMEOUT_MS=6000;
export const OFFICIAL_API_VERIFIER_TIMEOUT_MS=7000;
export const DEFAULT_SOURCE_VERIFIER_URL='https://webtv-source-verifier.atonis.workers.dev/verify';

const ERT_API_BASE='https://live.ertflix.gr/api/stream';
const ERT_KEYS=new Set(['ert1','ert2','ert3','ertnews']);
const ERT_BROWSER_UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';

function withTimeout(ms){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new DOMException('timeout','AbortError')),ms);
  return{controller,timer};
}
function safeVerifierUrl(raw=''){
  const u=new URL(String(raw||DEFAULT_SOURCE_VERIFIER_URL).trim());
  if(u.protocol!=='https:')throw new Error('Verifier must use HTTPS');
  if(!u.hostname||u.hostname==='localhost'||u.hostname.endsWith('.local'))throw new Error('Verifier target rejected');
  if(!u.pathname||u.pathname==='/'||u.pathname==='/verify/')u.pathname='/verify';
  if(u.pathname!=='/verify')throw new Error('Verifier endpoint path must be /verify');
  u.search='';u.hash='';
  return u;
}
function safeMediaSummary(raw=''){
  try{const u=new URL(String(raw||''));return{host:u.hostname.toLowerCase(),pathname:u.pathname};}catch{return{host:'',pathname:''};}
}
function safeDiagnosticTarget(input){
  if(!input||typeof input!=='object')return null;
  const host=String(input.host||'').trim().toLowerCase();
  const pathname=String(input.pathname||'').trim();
  if(!host||!pathname||host.length>253||pathname.length>2048)return null;
  if(/[?#\r\n\0]/.test(host)||/[?#\r\n\0]/.test(pathname))return null;
  const rawKeys=Array.isArray(input.queryKeys)?input.queryKeys:[];
  const queryKeys=[...new Set(rawKeys.map(k=>String(k||'').trim()).filter(k=>k&&k.length<=100&&!/[=&?#\r\n\0]/.test(k)))].sort().slice(0,20);
  const rawCount=Number(input.queryCount);
  const queryCount=Number.isInteger(rawCount)&&rawCount>=0&&rawCount<=100?rawCount:queryKeys.length;
  return{host,pathname,queryCount,queryKeys};
}
function safeRedirectDiagnostics(input){
  if(!Array.isArray(input))return[];
  const out=[];
  for(const item of input.slice(0,5)){
    const from=safeDiagnosticTarget(item?.from);const to=safeDiagnosticTarget(item?.to);
    const status=Number(item?.status);
    if(!from||!to||![301,302,303,307,308].includes(status))continue;
    out.push({status,from,to,hostChanged:Boolean(item?.hostChanged)});
  }
  return out;
}
function inferredType(url=''){
  if(/\.mpd(?:[?#]|$)/i.test(url))return'dash';
  if(/\.m3u8(?:[?#]|$)/i.test(url))return'hls';
  return'direct';
}
function officialHeaders(key){return{
  'User-Agent':ERT_BROWSER_UA,
  'Referer':`https://live.ertflix.gr/live/${key}`,
  'Origin':'https://live.ertflix.gr',
};}
async function fetchDescriptor(key,fetchImpl=fetch){
  const url=new URL(ERT_API_BASE);url.searchParams.set('channel',key);
  const {controller,timer}=withTimeout(OFFICIAL_API_TIMEOUT_MS);
  const started=Date.now();
  try{
    const response=await fetchImpl(url.href,{method:'GET',redirect:'follow',cache:'no-store',signal:controller.signal,headers:{accept:'application/json',...officialHeaders(key)}});
    let body={};try{body=await response.json();}catch{}
    return{status:response.status,elapsedMs:Date.now()-started,body,error:''};
  }catch(error){return{status:error?.name==='AbortError'?408:0,elapsedMs:Date.now()-started,body:{},error:error?.message||String(error)};}
  finally{clearTimeout(timer);}
}
function chooseMediaUrl(body={}){
  for(const value of [body?.primaryUrl,body?.url,body?.fallbackUrl]){
    const text=String(value||'').trim();
    if(text)return text;
  }
  return'';
}
async function verifyMedia({sourceUrl,sourceType,requiredHeaders,verifierBinding=null,verifierUrl=DEFAULT_SOURCE_VERIFIER_URL,fetchImpl=fetch}){
  const endpoint=verifierBinding?.fetch?null:safeVerifierUrl(verifierUrl);
  const {controller,timer}=withTimeout(OFFICIAL_API_VERIFIER_TIMEOUT_MS);
  const started=Date.now();
  try{
    const init={method:'POST',cache:'no-store',signal:controller.signal,headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({candidate:{candidateId:'official-api',sourceType,sourceUrl,requiredHeaders}})};
    const response=verifierBinding?.fetch
      ? await verifierBinding.fetch(new Request('https://source-verifier.internal/verify',init))
      : await fetchImpl(endpoint.href,init);
    let payload={};try{payload=await response.json();}catch{}
    const result=Array.isArray(payload?.results)?payload.results[0]:null;
    return{
      transport:verifierBinding?.fetch?'service-binding':'https',
      serviceStatus:response.status,
      status:String(result?.status||''),
      verified:Boolean(result?.verified),
      lastHttpStatus:Number.isFinite(Number(result?.lastHttpStatus))?Number(result.lastHttpStatus):null,
      mediaType:String(result?.mediaType||''),
      drmDetected:Boolean(result?.drmDetected),
      detail:String(result?.detail||'').slice(0,200),
      redirects:safeRedirectDiagnostics(result?.redirects),
      finalTarget:safeDiagnosticTarget(result?.finalTarget),
      elapsedMs:Date.now()-started,
    };
  }catch(error){return{transport:verifierBinding?.fetch?'service-binding':'https',serviceStatus:error?.name==='AbortError'?408:0,status:error?.name==='AbortError'?'TIMEOUT':'FAILED',verified:false,lastHttpStatus:null,mediaType:'',drmDetected:false,detail:error?.message||String(error),redirects:[],finalTarget:null,elapsedMs:Date.now()-started};}
  finally{clearTimeout(timer);}
}
function mediaCandidate(channel,entry,key,sourceUrl,verification){return{
  channelName:String(channel.name||''),
  sourceType:inferredType(sourceUrl),
  sourceUrl,
  requiredHeaders:officialHeaders(key),
  sourceOrigin:`official-api:${entry.owner}`,
  discoveryProvider:OFFICIAL_API_RESOLVER_PROVIDER,
  discoveredAt:new Date().toISOString(),
  freshness:'live-official-api',
  matchConfidence:'HIGH',
  candidateKind:'media',
  trustClass:'OFFICIAL',
  saveEligible:true,
  officialPageUrl:`https://live.ertflix.gr/live/${key}`,
  browserResponseStatus:null,
  verificationStatus:verification.status,
  verificationHttpStatus:verification.lastHttpStatus,
  verificationMediaType:verification.mediaType,
  verificationDetail:'Resolved from broadcaster-owned API and independently verified before promotion',
};}

export async function discoverOfficialApi({channel={},freshness='7d',fetchImpl=fetch,verifierFetch=fetch,verifierBinding=null,verifierUrl=DEFAULT_SOURCE_VERIFIER_URL}={}){
  const key=channelKey(channel);const entry=key?OFFICIAL_PROVIDER_REGISTRY[key]:null;
  if(!entry||entry.owner!=='ERT'||!ERT_KEYS.has(key))return{provider:OFFICIAL_API_RESOLVER_PROVIDER,recognized:false,available:true,freshnessRequested:freshness,freshnessApplied:false,candidates:[],reports:{registryKey:key||'',owner:entry?.owner||'',api:null,verification:null,reason:'No supported official API resolver for channel'}};
  const descriptor=await fetchDescriptor(key,fetchImpl);
  const sourceUrl=chooseMediaUrl(descriptor.body);
  const sourceType=inferredType(sourceUrl);
  const safeSource=safeMediaSummary(sourceUrl);
  const strict=Boolean(sourceUrl)&&hostAllowed(sourceUrl,entry.mediaHosts||[]);
  const apiReport={endpoint:'live.ertflix.gr/api/stream',queryNames:['channel'],status:descriptor.status,elapsedMs:descriptor.elapsedMs,mediaHost:safeSource.host,mediaPath:safeSource.pathname,mediaType:sourceType,error:descriptor.error};
  if(descriptor.status!==200||!sourceUrl||!strict)return{provider:OFFICIAL_API_RESOLVER_PROVIDER,recognized:true,available:true,freshnessRequested:freshness,freshnessApplied:false,candidates:[],reports:{registryKey:key,owner:entry.owner,api:apiReport,verification:null,reason:descriptor.status!==200?'Official API did not return HTTP 200':!sourceUrl?'Official API returned no media URL':'Official API media host is not allowlisted'}};
  const requiredHeaders=officialHeaders(key);
  const verification=await verifyMedia({sourceUrl,sourceType,requiredHeaders,verifierBinding,verifierUrl,fetchImpl:verifierFetch});
  const verificationReport={transport:verification.transport,serviceStatus:verification.serviceStatus,status:verification.status,verified:verification.verified,lastHttpStatus:verification.lastHttpStatus,mediaType:verification.mediaType,drmDetected:verification.drmDetected,elapsedMs:verification.elapsedMs,detail:verification.detail,redirects:verification.redirects,finalTarget:verification.finalTarget,requestContext:{userAgentFamily:'Chrome',refererHost:'live.ertflix.gr',refererPath:`/live/${key}`,originHost:'live.ertflix.gr',redirectMode:'manual-preserve-context'}};
  const candidates=verification.verified&&verification.status==='VERIFIED'?[mediaCandidate(channel,entry,key,sourceUrl,verification)]:[];
  return{
    provider:OFFICIAL_API_RESOLVER_PROVIDER,recognized:true,available:true,freshnessRequested:freshness,freshnessApplied:false,
    freshnessNote:'Official API is queried live; media URLs are promoted only after independent verification.',
    limits:{apiTimeoutMs:OFFICIAL_API_TIMEOUT_MS,verifierTimeoutMs:OFFICIAL_API_VERIFIER_TIMEOUT_MS,maxCandidates:1},
    candidates,reports:{registryKey:key,owner:entry.owner,api:apiReport,verification:verificationReport,reason:candidates.length?'Verified official media source':'Official API source was not promoted because verification did not succeed'},
  };
}

export { ERT_API_BASE, ERT_KEYS, ERT_BROWSER_UA, safeVerifierUrl, safeMediaSummary, inferredType, officialHeaders, chooseMediaUrl, fetchDescriptor, verifyMedia };
