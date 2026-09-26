export const STRM_SPECIFIC_DISCOVERY_PROVIDER='strm-specific-discovery';
export const STRM_TIMEOUT_MS=6000;
export const STRM_MAX_REFERENCES=6;
export const STRM_MAX_DEPTH=3;
export const STRM_MAX_SUBREQUESTS=12;
export const STRM_MAX_BODY_BYTES=256000;

class Budget{
  constructor(limit=STRM_MAX_SUBREQUESTS){this.limit=limit;this.used=0;}
  take(){if(this.used>=this.limit)throw new Error('STRM provider subrequest budget exhausted');this.used++;}
  remaining(){return Math.max(0,this.limit-this.used);}
}

function canonicalHttpUrl(raw=''){
  const clean=String(raw||'').split('|')[0].trim();
  const url=new URL(clean);
  if(!/^https?:$/.test(url.protocol))throw new Error('Only http/https STRM targets are allowed');
  const host=url.hostname.toLowerCase();
  if(host==='localhost'||host==='0.0.0.0'||host==='::1'||host.endsWith('.local')||host==='169.254.169.254')throw new Error('Private/local STRM targets are not allowed');
  const ipv4=host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(ipv4){const [a,b]=ipv4.slice(1).map(Number);if(a===10||a===127||a===0||(a===169&&b===254)||(a===192&&b===168)||(a===172&&b>=16&&b<=31))throw new Error('Private IP STRM targets are not allowed');}
  if(host==='github.com'){
    const parts=url.pathname.split('/').filter(Boolean);const blob=parts.indexOf('blob');
    if(blob===2&&parts.length>4)return new URL(`https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts[3]}/${parts.slice(4).join('/')}`);
  }
  return url;
}
function isStrm(raw=''){try{return /\.strm$/i.test(canonicalHttpUrl(raw).pathname);}catch{return false;}}
function sourceType(raw=''){
  const clean=String(raw||'').split('|')[0].trim();
  if(/\.m3u8(?:[?#]|$)/i.test(clean))return'hls';
  if(/\.mpd(?:[?#]|$)/i.test(clean))return'dash';
  if(/\.m3u(?:[?#]|$)/i.test(clean))return'm3u';
  return'direct';
}
function kodiHeaders(raw=''){
  const index=String(raw).indexOf('|');if(index<0)return{};
  const query=String(raw).slice(index+1).replace(/;/g,'&');const params=new URLSearchParams(query);const out={};
  for(const [key,value] of params){const k=key.toLowerCase();const text=String(value||'').trim();if(!text||/[\r\n\0]/.test(text))continue;if(k==='user-agent'||k==='user_agent')out['User-Agent']=text;else if(k==='referer'||k==='referrer')out.Referer=text;else if(k==='origin')out.Origin=text;}
  return out;
}
function parseStrm(text=''){
  let mediaUrl='',licenseType='',licenseKey='';
  for(const rawLine of String(text).replace(/\r/g,'').split('\n')){
    const line=rawLine.trim();if(!line)continue;
    const prop=line.match(/^#KODIPROP:([^=]+)=(.*)$/i);
    if(prop){const key=prop[1].trim().toLowerCase(),value=prop[2].trim();if(key==='inputstream.adaptive.license_type')licenseType=value;if(key==='inputstream.adaptive.license_key')licenseKey=value;continue;}
    if(!line.startsWith('#')&&/^https?:\/\//i.test(line)&&!mediaUrl)mediaUrl=line;
  }
  return{mediaUrl,drmDetected:Boolean(licenseType||licenseKey),licenseType,licenseKey};
}
async function fetchText(raw,budget){
  budget.take();const url=canonicalHttpUrl(raw);const controller=new AbortController();const timer=setTimeout(()=>controller.abort(new DOMException('timeout','AbortError')),STRM_TIMEOUT_MS);const started=Date.now();
  try{const response=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':'WebTV-Discovery-STRM/1.0','accept':'text/plain,application/vnd.apple.mpegurl,application/x-mpegURL,*/*'}});if(!response.ok)return{ok:false,status:response.status,text:'',url:url.toString(),elapsedMs:Date.now()-started};return{ok:true,status:response.status,text:(await response.text()).slice(0,STRM_MAX_BODY_BYTES),url:url.toString(),elapsedMs:Date.now()-started};}
  catch(error){return{ok:false,status:error?.name==='AbortError'?408:0,text:'',url:url.toString(),elapsedMs:Date.now()-started,error:error?.message||String(error)};}
  finally{clearTimeout(timer);}
}
async function resolveReference(raw,budget,depth=0,chain=[],inheritedDrm=false){
  if(depth>=STRM_MAX_DEPTH)return{ok:false,status:0,error:'Maximum STRM depth reached',chain,drmDetected:inheritedDrm};
  let canonical;try{canonical=canonicalHttpUrl(raw).toString();}catch(error){return{ok:false,status:0,error:error.message,chain,drmDetected:inheritedDrm};}
  const fetched=await fetchText(canonical,budget);const nextChain=[...chain,canonical];
  if(!fetched.ok)return{ok:false,status:fetched.status,error:fetched.error||`STRM HTTP ${fetched.status}`,chain:nextChain,drmDetected:inheritedDrm};
  const parsed=parseStrm(fetched.text);const drmDetected=inheritedDrm||parsed.drmDetected;
  if(!parsed.mediaUrl)return{ok:false,status:fetched.status,error:'STRM did not contain an HTTP media target',chain:nextChain,drmDetected};
  if(isStrm(parsed.mediaUrl))return resolveReference(parsed.mediaUrl,budget,depth+1,nextChain,drmDetected);
  let target;try{target=canonicalHttpUrl(parsed.mediaUrl).toString();}catch(error){return{ok:false,status:0,error:error.message,chain:nextChain,drmDetected};}
  return{ok:true,status:fetched.status,resolvedUrl:target,sourceType:sourceType(parsed.mediaUrl),requiredHeaders:kodiHeaders(parsed.mediaUrl),drmDetected,depth:depth+1,chain:nextChain};
}
function unique(items=[],key=item=>item?.sourceUrl){const seen=new Set(),out=[];for(const item of items){const value=String(key(item)||'');if(!value||seen.has(value))continue;seen.add(value);out.push(item);}return out;}

export async function discoverStrmSpecific({channel,freshness='7d',parseM3u,feeds=[]}={}){
  if(typeof parseM3u!=='function')throw new Error('parseM3u dependency is required');
  const budget=new Budget();const feedReports=[];const references=[];
  for(const feed of feeds){
    if(budget.remaining()<=0||references.length>=STRM_MAX_REFERENCES)break;
    const fetched=await fetchText(feed.url,budget);
    if(!fetched.ok){feedReports.push({feed:feed.name,status:fetched.status,matches:0,error:fetched.error||''});continue;}
    const found=parseM3u(fetched.text,channel,{name:`strm:${feed.name}`,provider:STRM_SPECIFIC_DISCOVERY_PROVIDER,freshness:'live-strm-check'}).filter(item=>item.sourceType==='strm');
    for(const item of found){if(references.length>=STRM_MAX_REFERENCES)break;references.push(item);}
    feedReports.push({feed:feed.name,status:fetched.status,matches:found.length,error:''});
  }
  const refs=unique(references,item=>item.sourceUrl).slice(0,STRM_MAX_REFERENCES);const candidates=[];const resolutions=[];
  for(const ref of refs){
    if(budget.remaining()<=0)break;
    let result;try{result=await resolveReference(ref.sourceUrl,budget);}catch(error){result={ok:false,status:0,error:error?.message||String(error),chain:[]};}
    resolutions.push({reference:ref.sourceUrl,status:result.status||0,resolved:Boolean(result.ok),resolvedType:result.sourceType||'',depth:result.depth||0,drmDetected:Boolean(result.drmDetected),chainLength:result.chain?.length||0,error:result.error||''});
    if(!result.ok||!result.resolvedUrl)continue;
    candidates.push({channelName:String(channel.name||ref.channelName||''),sourceType:result.sourceType,sourceUrl:result.resolvedUrl,sourceOrigin:`strm:${ref.sourceOrigin}`,discoveryProvider:STRM_SPECIFIC_DISCOVERY_PROVIDER,discoveredAt:new Date().toISOString(),freshness:'live-strm-check',requiredHeaders:result.requiredHeaders||{},drmDetected:Boolean(result.drmDetected),matchConfidence:ref.matchConfidence||'HIGH',verificationDetail:'Resolved from STRM reference; final media is not verified yet'});
  }
  return{provider:STRM_SPECIFIC_DISCOVERY_PROVIDER,freshnessRequested:freshness,freshnessApplied:false,freshnessNote:'Public STRM-bearing feeds are checked live; STRM/file publication age is not fabricated from request time.',limits:{timeoutMs:STRM_TIMEOUT_MS,maxReferences:STRM_MAX_REFERENCES,maxDepth:STRM_MAX_DEPTH,maxSubrequests:STRM_MAX_SUBREQUESTS,maxBodyBytes:STRM_MAX_BODY_BYTES},candidates:unique(candidates),reports:{feeds:feedReports,resolutions,subrequestsUsed:budget.used}};
}
