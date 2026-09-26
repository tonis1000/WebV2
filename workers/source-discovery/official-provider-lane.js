export const OFFICIAL_PROVIDER_LANE='official-provider-lane';
export const OFFICIAL_TIMEOUT_MS=6000;
export const OFFICIAL_MAX_PAGES=2;
export const OFFICIAL_MAX_BODY_BYTES=1200000;
export const OFFICIAL_MAX_CANDIDATES=8;

const REGISTRY=Object.freeze({
  ert1:Object.freeze({owner:'ERT',pages:['https://live.ertflix.gr/'],mediaHosts:['live.ertflix.gr','ertflix.gr','www.ertflix.gr']}),
  ert2:Object.freeze({owner:'ERT',pages:['https://live.ertflix.gr/'],mediaHosts:['live.ertflix.gr','ertflix.gr','www.ertflix.gr']}),
  ert3:Object.freeze({owner:'ERT',pages:['https://live.ertflix.gr/'],mediaHosts:['live.ertflix.gr','ertflix.gr','www.ertflix.gr']}),
  ertnews:Object.freeze({owner:'ERT',pages:['https://live.ertflix.gr/'],mediaHosts:['live.ertflix.gr','ertflix.gr','www.ertflix.gr']}),
  ant1:Object.freeze({owner:'ANT1',pages:['https://www.antenna.gr/live'],mediaHosts:['antenna.gr','www.antenna.gr']}),
  madtv:Object.freeze({
    owner:'MAD TV',
    pages:['https://www.youtube.com/@madtvgreece/live'],
    mediaHosts:[],
    embeds:['https://www.youtube-nocookie.com/embed/live_stream?channel=UCs3cho4vcDuCze0tk3W9iVQ&autoplay=1&playsinline=1&rel=0'],
  }),
});

function normalize(value=''){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9α-ω]+/gi,'').trim();}
function channelKey(channel={}){
  const values=[channel.id,channel.originalId,channel.tvgId,channel.name].map(normalize).filter(Boolean);
  const aliases=new Map([
    ['ερτ1','ert1'],['ept1','ert1'],['ert1hd','ert1'],
    ['ερτ2','ert2'],['ept2','ert2'],['ert2hd','ert2'],['ert2spor','ert2'],['ert2sporhd','ert2'],
    ['ερτ3','ert3'],['ept3','ert3'],['ert3hd','ert3'],
    ['ερτnews','ertnews'],['ertnewsgr','ertnews'],
    ['antenna1','ant1'],['ant1hd','ant1'],
    ['madtvgr','madtv'],['madtvgreece','madtv'],
  ]);
  for(const value of values){const key=aliases.get(value)||value;if(REGISTRY[key])return key;}
  return '';
}
function typeOf(url=''){if(/\.m3u8(?:[?#]|$)/i.test(url))return'hls';if(/\.mpd(?:[?#]|$)/i.test(url))return'dash';return'direct';}
function safeHttps(raw=''){
  const u=new URL(String(raw||'').trim());
  if(u.protocol!=='https:')throw new Error('Official registry only permits HTTPS');
  const h=u.hostname.toLowerCase();
  if(!h||h==='localhost'||h.endsWith('.local'))throw new Error('Private/local official target rejected');
  return u;
}
function hostAllowed(url,hosts=[]){try{return hosts.includes(safeHttps(url).hostname.toLowerCase());}catch{return false;}}
function extractMediaUrls(text='',hosts=[]){
  const out=[];const seen=new Set();
  const re=/https:\/\/[^\s"'<>\\]+?\.(?:m3u8|mpd)(?:\?[^\s"'<>\\]*)?/gi;
  for(const match of String(text).matchAll(re)){
    const value=match[0].replace(/&amp;/g,'&');
    if(!hostAllowed(value,hosts)||seen.has(value))continue;
    seen.add(value);out.push(value);if(out.length>=OFFICIAL_MAX_CANDIDATES)break;
  }
  return out;
}
async function fetchPage(url,fetchImpl=fetch){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),OFFICIAL_TIMEOUT_MS);const started=Date.now();
  try{
    const response=await fetchImpl(url,{redirect:'follow',cache:'no-store',signal:controller.signal,headers:{'user-agent':'WebTV-OfficialDiscovery/1.0','accept':'text/html,application/xhtml+xml,*/*;q=0.5'}});
    const text=response.ok?(await response.text()).slice(0,OFFICIAL_MAX_BODY_BYTES):'';
    return{url,status:response.status,elapsedMs:Date.now()-started,text,error:''};
  }catch(error){return{url,status:error?.name==='AbortError'?408:0,elapsedMs:Date.now()-started,text:'',error:error?.message||String(error)};}finally{clearTimeout(timer);}
}
function pageCandidate(channel,entry,url){return{
  channelName:String(channel.name||''),sourceType:'direct',sourceUrl:url,sourceOrigin:`official:${entry.owner}`,discoveryProvider:OFFICIAL_PROVIDER_LANE,
  discoveredAt:new Date().toISOString(),freshness:'live-official-check',matchConfidence:'HIGH',candidateKind:'official-page',trustClass:'OFFICIAL',saveEligible:false,
  officialPageUrl:url,verificationDetail:'Broadcaster-owned live page; fallback/navigation only, not a media source',
};}
function embedCandidate(channel,entry,url){return{
  channelName:String(channel.name||''),sourceType:'direct',sourceUrl:url,sourceOrigin:`official:${entry.owner}`,discoveryProvider:OFFICIAL_PROVIDER_LANE,
  discoveredAt:new Date().toISOString(),freshness:'registry-official-embed',matchConfidence:'HIGH',candidateKind:'official-embed',trustClass:'OFFICIAL',saveEligible:false,
  officialPageUrl:entry.pages?.[0]||'',verificationDetail:'Explicitly allowlisted official embed; fallback only, not a normal IPTV source',
};}
function mediaCandidate(channel,entry,url,pageUrl){return{
  channelName:String(channel.name||''),sourceType:typeOf(url),sourceUrl:url,sourceOrigin:`official:${entry.owner}`,discoveryProvider:OFFICIAL_PROVIDER_LANE,
  discoveredAt:new Date().toISOString(),freshness:'live-official-check',matchConfidence:'HIGH',candidateKind:'media',trustClass:'OFFICIAL',saveEligible:true,
  officialPageUrl:pageUrl,verificationDetail:'Extracted from an allowlisted broadcaster-owned page; media verification still required',
};}

export async function discoverOfficialProvider({channel={},freshness='7d',fetchImpl=fetch}={}){
  const key=channelKey(channel);const entry=key?REGISTRY[key]:null;
  if(!entry)return{provider:OFFICIAL_PROVIDER_LANE,recognized:false,freshnessRequested:freshness,freshnessApplied:false,candidates:[],reports:{pages:[],registryKey:'',owner:'',subrequestsUsed:0}};
  const pages=(entry.pages||[]).slice(0,OFFICIAL_MAX_PAGES);const reports=[];const candidates=[];let subrequestsUsed=0;
  for(const pageUrl of pages){
    safeHttps(pageUrl);subrequestsUsed++;const report=await fetchPage(pageUrl,fetchImpl);const media=report.status===200?extractMediaUrls(report.text,entry.mediaHosts||[]):[];
    reports.push({url:pageUrl,status:report.status,elapsedMs:report.elapsedMs,mediaMatches:media.length,error:report.error});
    if(report.status===200)candidates.push(pageCandidate(channel,entry,pageUrl));
    for(const mediaUrl of media)candidates.push(mediaCandidate(channel,entry,mediaUrl,pageUrl));
  }
  for(const embedUrl of entry.embeds||[]){safeHttps(embedUrl);candidates.push(embedCandidate(channel,entry,embedUrl));}
  const unique=[];const seen=new Set();
  for(const candidate of candidates){if(seen.has(candidate.sourceUrl))continue;seen.add(candidate.sourceUrl);unique.push(candidate);if(unique.length>=OFFICIAL_MAX_CANDIDATES)break;}
  return{
    provider:OFFICIAL_PROVIDER_LANE,recognized:true,freshnessRequested:freshness,freshnessApplied:false,
    freshnessNote:'Official pages are checked live; request time is not treated as publication time.',
    limits:{timeoutMs:OFFICIAL_TIMEOUT_MS,maxPages:OFFICIAL_MAX_PAGES,maxCandidates:OFFICIAL_MAX_CANDIDATES,maxBodyBytes:OFFICIAL_MAX_BODY_BYTES},
    candidates:unique,reports:{pages:reports,registryKey:key,owner:entry.owner,subrequestsUsed},
  };
}

export { REGISTRY as OFFICIAL_PROVIDER_REGISTRY, channelKey, extractMediaUrls, hostAllowed };
