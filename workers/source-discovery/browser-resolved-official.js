import { OFFICIAL_PROVIDER_REGISTRY, channelKey, hostAllowed } from './official-provider-lane.js';

export const BROWSER_RESOLVED_OFFICIAL_PROVIDER='browser-resolved-official';
export const BROWSER_RESOLVER_TIMEOUT_MS=12000;
export const BROWSER_RESOLVER_MAX_CANDIDATES=8;

const APPROVED_HEADER_NAMES=new Set(['user-agent','referer','origin']);

function typeOf(url=''){
  if(/\.m3u8(?:[?#]|$)/i.test(url))return'hls';
  if(/\.mpd(?:[?#]|$)/i.test(url))return'dash';
  if(/\.(?:mp4|webm)(?:[?#]|$)/i.test(url))return'video';
  return'';
}
function safeResolverUrl(value=''){
  const url=new URL(String(value||'').trim());
  if(url.protocol!=='https:')throw new Error('Browser resolver endpoint must use HTTPS');
  if(!url.hostname||url.hostname==='localhost'||url.hostname.endsWith('.local'))throw new Error('Browser resolver endpoint rejected');
  if(url.pathname==='/'||!url.pathname)url.pathname='/resolve';
  return url;
}
function sanitizeHeaders(headers={}){
  const out={};
  for(const [key,value] of Object.entries(headers||{})){
    const name=String(key||'').toLowerCase();
    if(!APPROVED_HEADER_NAMES.has(name))continue;
    const text=String(value||'').trim();
    if(!text||text.length>2048)continue;
    const canonical=name==='user-agent'?'User-Agent':name[0].toUpperCase()+name.slice(1);
    out[canonical]=text;
  }
  return out;
}
function mediaCandidate(channel,entry,observation,pageUrl){
  const sourceUrl=String(observation?.url||'').trim();
  return{
    channelName:String(channel.name||''),
    sourceType:typeOf(sourceUrl),
    sourceUrl,
    requiredHeaders:sanitizeHeaders(observation?.headers),
    sourceOrigin:`official-browser:${entry.owner}`,
    discoveryProvider:BROWSER_RESOLVED_OFFICIAL_PROVIDER,
    discoveredAt:new Date().toISOString(),
    freshness:'live-browser-resolution',
    matchConfidence:'HIGH',
    candidateKind:'media',
    trustClass:'OFFICIAL',
    saveEligible:true,
    officialPageUrl:pageUrl,
    verificationDetail:'Observed from an allowlisted official page after browser execution; verifier still required',
  };
}

async function resolvePage({pageUrl,channel,entry,env={},fetchImpl=fetch}){
  const endpoint=safeResolverUrl(env.BROWSER_RESOLVER_URL);
  const token=String(env.BROWSER_RESOLVER_TOKEN||'').trim();
  if(!token)throw new Error('BROWSER_RESOLVER_TOKEN is not configured');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new DOMException('browser resolver timeout','AbortError')),BROWSER_RESOLVER_TIMEOUT_MS);
  try{
    const headers={'content-type':'application/json','accept':'application/json','authorization':`Bearer ${token}`};
    const response=await fetchImpl(endpoint.href,{
      method:'POST',headers,signal:controller.signal,cache:'no-store',
      body:JSON.stringify({
        url:pageUrl,
        channel:{id:String(channel.id||''),originalId:String(channel.originalId||''),name:String(channel.name||''),tvgId:String(channel.tvgId||'')},
        capture:{extensions:['m3u8','mpd','mp4','webm'],includeRequestHeaders:true,timeoutMs:BROWSER_RESOLVER_TIMEOUT_MS},
      }),
    });
    let payload={};try{payload=await response.json();}catch{}
    if(!response.ok)throw new Error(payload?.error||`Browser resolver HTTP ${response.status}`);
    const observations=Array.isArray(payload?.observations)?payload.observations:[];
    const candidates=[];const seen=new Set();
    for(const observation of observations){
      const url=String(observation?.url||'').trim();
      if(!typeOf(url)||!hostAllowed(url,entry.mediaHosts||[])||seen.has(url))continue;
      seen.add(url);candidates.push(mediaCandidate(channel,entry,observation,pageUrl));
      if(candidates.length>=BROWSER_RESOLVER_MAX_CANDIDATES)break;
    }
    return{status:response.status,candidates,observationCount:observations.length,error:''};
  }catch(error){
    return{status:error?.name==='AbortError'?408:0,candidates:[],observationCount:0,error:error?.message||String(error)};
  }finally{clearTimeout(timer);}
}

export async function discoverBrowserResolvedOfficial({channel={},freshness='7d',env={},fetchImpl=fetch}={}){
  if(!env.BROWSER_RESOLVER_URL||!env.BROWSER_RESOLVER_TOKEN)return{
    provider:BROWSER_RESOLVED_OFFICIAL_PROVIDER,recognized:false,available:false,freshnessRequested:freshness,freshnessApplied:false,candidates:[],
    reports:{pages:[],registryKey:'',owner:'',reason:'Browser resolver URL/token are not configured'},
  };
  const key=channelKey(channel);const entry=key?OFFICIAL_PROVIDER_REGISTRY[key]:null;
  if(!entry)return{provider:BROWSER_RESOLVED_OFFICIAL_PROVIDER,recognized:false,available:true,freshnessRequested:freshness,freshnessApplied:false,candidates:[],reports:{pages:[],registryKey:'',owner:'',reason:'channel not in official registry'}};
  const reports=[];const candidates=[];const seen=new Set();
  for(const pageUrl of (entry.pages||[]).slice(0,2)){
    const result=await resolvePage({pageUrl,channel,entry,env,fetchImpl});
    reports.push({url:pageUrl,status:result.status,observations:result.observationCount,matches:result.candidates.length,error:result.error});
    for(const candidate of result.candidates){if(seen.has(candidate.sourceUrl))continue;seen.add(candidate.sourceUrl);candidates.push(candidate);if(candidates.length>=BROWSER_RESOLVER_MAX_CANDIDATES)break;}
    if(candidates.length>=BROWSER_RESOLVER_MAX_CANDIDATES)break;
  }
  return{
    provider:BROWSER_RESOLVED_OFFICIAL_PROVIDER,recognized:true,available:true,freshnessRequested:freshness,freshnessApplied:false,
    freshnessNote:'Official pages are resolved live in a browser backend; discovery time is not publication time.',
    limits:{timeoutMs:BROWSER_RESOLVER_TIMEOUT_MS,maxCandidates:BROWSER_RESOLVER_MAX_CANDIDATES},
    candidates,reports:{pages:reports,registryKey:key,owner:entry.owner},
  };
}

export { sanitizeHeaders, safeResolverUrl, typeOf };
