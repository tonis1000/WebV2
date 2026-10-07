import { detectSourceFormat, classifySourceBody, toLegacySourceType } from '../src/core/source-format-registry.js';
import { parseIptvUrl } from '../src/core/utils.js';

const VERSION='1.3';
const ALLOWED_ORIGIN='*';
const UPSTREAM_TIMEOUT_MS=6000;
const MAX_BODY_BYTES=512000;
const MAX_BATCH=4;
const MAX_CONCURRENCY=2;
const MAX_REDIRECTS=5;

function cors(){return {'access-control-allow-origin':ALLOWED_ORIGIN,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'};}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors(),'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});}
function now(){return Date.now();}
function cleanHeaders(input={}){
  const allowed=new Map([['user-agent','User-Agent'],['referer','Referer'],['origin','Origin'],['x-roku-reserved-dev-id','X-Roku-Reserved-Dev-Id']]);
  const out={};
  if(!input||typeof input!=='object')return out;
  for(const [rawKey,rawValue] of Object.entries(input)){
    const key=allowed.get(String(rawKey).toLowerCase());
    const value=String(rawValue??'').trim();
    if(!key||!value||/[\r\n\0]/.test(value)||value.length>1024)continue;
    out[key]=value;
  }
  return out;
}
function safeHttpUrl(raw=''){
  const u=new URL(String(raw||'').trim());
  if(!/^https?:$/.test(u.protocol))throw new Error('Only http/https sources are allowed');
  const h=u.hostname.toLowerCase();
  if(!h)throw new Error('Source hostname is required');
  if(h==='localhost'||h==='0.0.0.0'||h==='::1'||h.endsWith('.local')||h==='169.254.169.254')throw new Error('Private/local targets are not allowed');
  const ipv4=h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(ipv4){
    const octets=ipv4.slice(1).map(Number);
    if(octets.some(n=>n<0||n>255))throw new Error('Invalid IPv4 target');
    const [a,b]=octets;
    if(a===10||a===127||a===0||(a===169&&b===254)||(a===192&&b===168)||(a===172&&b>=16&&b<=31))throw new Error('Private IP targets are not allowed');
  }
  return u;
}
function safeUrlSummary(value){
  const u=value instanceof URL?value:safeHttpUrl(value);
  const queryKeys=[...new Set([...u.searchParams.keys()].map(k=>String(k).slice(0,100)).filter(Boolean))].sort().slice(0,20);
  return{host:u.hostname.toLowerCase(),pathname:u.pathname||'/',queryCount:[...u.searchParams.keys()].length,queryKeys};
}
function safeResponseHeaderSummary(headers){
  if(!headers||typeof headers.keys!=='function')return{headerNames:[],hasSetCookie:false,hasWwwAuthenticate:false};
  const headerNames=[...new Set([...headers.keys()].map(name=>String(name||'').trim().toLowerCase()).filter(Boolean))].sort().slice(0,40);
  return{headerNames,hasSetCookie:headerNames.includes('set-cookie'),hasWwwAuthenticate:headerNames.includes('www-authenticate')};
}
async function finalRouteFingerprint(finalUrl='',headers){
  const allowlisted=['origin','referer','user-agent','x-roku-reserved-dev-id'];
  const pairs=[];
  for(const key of allowlisted){
    const value=String(headers?.get?.(key)||'').trim();
    if(value)pairs.push(`${key}:${value}`);
  }
  const payload=`${String(finalUrl||'').trim()}\n${pairs.join('\n')}`;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));
  return `sha256:${[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')}`;
}
async function readLimited(response){
  const reader=response.body?.getReader?.();
  if(!reader)return(await response.text()).slice(0,MAX_BODY_BYTES);
  const chunks=[];let total=0;
  while(total<MAX_BODY_BYTES){
    const {done,value}=await reader.read();
    if(done)break;
    if(value){
      const remaining=MAX_BODY_BYTES-total;
      chunks.push(value.slice(0,remaining));
      total+=Math.min(value.length,remaining);
    }
  }
  try{await reader.cancel();}catch{}
  const merged=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder().decode(merged);
}
function streamKindFromMedia(media='',body=''){
  const text=String(body||'');
  if(media==='direct-video')return 'vod';
  if(media==='hls'){
    if(/#EXT-X-PLAYLIST-TYPE\s*:\s*VOD/i.test(text)||/#EXT-X-ENDLIST\b/i.test(text))return 'vod';
    if(/#EXT-X-MEDIA-SEQUENCE\s*:/i.test(text)&&/#EXTINF\s*:/i.test(text))return 'live';
    return 'unknown';
  }
  if(media==='dash'){
    const opening=text.match(/<MPD\b[^>]*>/i)?.[0]||'';
    if(/\btype\s*=\s*["']dynamic["']/i.test(opening))return 'live';
    if(/\btype\s*=\s*["']static["']/i.test(opening))return 'vod';
    return 'unknown';
  }
  return 'unknown';
}
function firstHlsVariantUrl(body='',baseUrl=''){
  const lines=String(body||'').split(/\r?\n/).map(line=>line.trim());
  for(let i=0;i<lines.length;i++){
    if(!/^#EXT-X-STREAM-INF\s*:/i.test(lines[i]))continue;
    for(let j=i+1;j<lines.length;j++){
      const value=lines[j];
      if(!value)continue;
      if(value.startsWith('#'))break;
      try{return safeHttpUrl(new URL(value,baseUrl).toString()).toString();}catch{return '';}
    }
  }
  return '';
}
async function hlsStreamKindFromMaster(body='',baseUrl='',headers,signal){
  let text=String(body||''),current=String(baseUrl||'');
  for(let hop=0;hop<3;hop++){
    const kind=streamKindFromMedia('hls',text);
    if(kind!=='unknown')return kind;
    const variant=firstHlsVariantUrl(text,current);
    if(!variant)return 'unknown';
    const fetched=await fetchWithRedirectDiagnostics(safeHttpUrl(variant),headers,signal);
    const response=fetched.response;
    if(!response.ok&&response.status!==206)return 'unknown';
    text=await readLimited(response);
    current=response.url||variant;
  }
  return streamKindFromMedia('hls',text);
}
function mediaProbeResult(type,text='',contentType=''){
  const body=String(text||'');
  const ct=String(contentType||'').toLowerCase();
  const classified=classifySourceBody({body,contentType:ct});
  const media=classified.mediaFormatId;
  const drm=/widevine|playready|contentprotection|urn:uuid:/i.test(body);
  if(type==='hls'&&media!=='hls')return{ok:false,mediaType:'',drmDetected:drm,reason:'Response is not a valid HLS manifest'};
  if(type==='dash'&&media!=='dash')return{ok:false,mediaType:'',drmDetected:drm,reason:'Response is not a valid DASH manifest'};
  if(type==='direct'&&media==='unknown')return{ok:false,mediaType:'',drmDetected:drm,reason:'Response is not recognized as playable media'};
  const mediaType=media==='hls'?'hls':media==='dash'?'dash':ct.split(';')[0]||type;
  return{ok:true,mediaType,streamKind:streamKindFromMedia(media,body),drmDetected:drm,reason:''};
}
function isRedirectStatus(status){return[301,302,303,307,308].includes(status);}
async function fetchWithRedirectDiagnostics(target,headers,signal){
  let current=safeHttpUrl(target.toString());
  const redirects=[];
  for(let hop=0;hop<=MAX_REDIRECTS;hop++){
    const response=await fetch(current.toString(),{method:'GET',redirect:'manual',cache:'no-store',headers,signal});
    const responseHeaders=safeResponseHeaderSummary(response.headers);
    if(!isRedirectStatus(response.status))return{response,redirects,finalTarget:safeUrlSummary(current),finalResponseHeaders:responseHeaders,finalUrl:current.toString()};
    const location=response.headers.get('location');
    if(!location)return{response,redirects,finalTarget:safeUrlSummary(current),finalResponseHeaders:responseHeaders,finalUrl:current.toString()};
    if(hop>=MAX_REDIRECTS)throw new Error(`Too many redirects (>${MAX_REDIRECTS})`);
    const next=safeHttpUrl(new URL(location,current).toString());
    redirects.push({status:response.status,from:safeUrlSummary(current),to:safeUrlSummary(next),hostChanged:current.hostname.toLowerCase()!==next.hostname.toLowerCase(),responseHeaders});
    try{await response.body?.cancel?.();}catch{}
    current=next;
  }
  throw new Error(`Too many redirects (>${MAX_REDIRECTS})`);
}
async function verifyOne(input={}){
  const started=now();
  const candidateId=String(input.candidateId||'');
  const rawSourceUrl=String(input.sourceUrl||'').trim();
  const parsedSource=parseIptvUrl(rawSourceUrl);
  const sourceUrl=parsedSource.url;
  const format=detectSourceFormat({sourceUrl,explicitType:input.sourceType});
  const type=toLegacySourceType(format);
  if(format.verificationMode==='resolve-first'||type==='strm'||type==='m3u')return{candidateId,status:'UNRESOLVED',verified:false,startupMs:0,lastHttpStatus:null,mediaType:'',drmDetected:false,detail:'Resolve container/reference before verification',redirects:[],finalTarget:null,finalResponseHeaders:null};
  let target;
  try{target=safeHttpUrl(sourceUrl);}catch(error){return{candidateId,status:'FAILED',verified:false,startupMs:now()-started,lastHttpStatus:null,mediaType:'',drmDetected:false,detail:error.message,redirects:[],finalTarget:null,finalResponseHeaders:null};}
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),UPSTREAM_TIMEOUT_MS);
  let redirects=[];let finalTarget=safeUrlSummary(target);let finalResponseHeaders=null;
  try{
    const headers=new Headers(cleanHeaders({...parsedSource.headers,...(input.requiredHeaders||{})}));
    if(!headers.has('user-agent'))headers.set('user-agent',`Mozilla/5.0 WebTV-SourceVerifier/${VERSION}`);
    headers.set('accept','application/vnd.apple.mpegurl,application/x-mpegURL,application/dash+xml,video/*,audio/*,*/*;q=0.5');
    const fetched=await fetchWithRedirectDiagnostics(target,headers,controller.signal);
    const response=fetched.response;redirects=fetched.redirects;finalTarget=fetched.finalTarget;finalResponseHeaders=fetched.finalResponseHeaders;const finalRouteKey=await finalRouteFingerprint(fetched.finalUrl,headers);
    const status=response.status;
    if(!response.ok&&status!==206){
      const mapped=status===403?'HTTP 403':status===404?'HTTP 404':'FAILED';
      return{candidateId,status:mapped,verified:false,startupMs:now()-started,lastHttpStatus:status,mediaType:'',drmDetected:false,detail:`Upstream HTTP ${status}`,redirects,finalTarget,finalResponseHeaders,finalRouteKey};
    }
    const text=await readLimited(response);
    const classified=mediaProbeResult(type,text,response.headers.get('content-type')||'');
    if(classified.ok&&classified.mediaType==='hls'&&classified.streamKind==='unknown'){
      classified.streamKind=await hlsStreamKindFromMaster(text,response.url||target.toString(),headers,controller.signal);
    }
    if(classified.drmDetected)return{candidateId,status:'DRM',verified:false,startupMs:now()-started,lastHttpStatus:status,mediaType:classified.mediaType,streamKind:classified.streamKind||'unknown',drmDetected:true,detail:'DRM markers detected',redirects,finalTarget,finalResponseHeaders,finalRouteKey};
    if(!classified.ok)return{candidateId,status:'FAILED',verified:false,startupMs:now()-started,lastHttpStatus:status,mediaType:classified.mediaType,streamKind:classified.streamKind||'unknown',drmDetected:false,detail:classified.reason,redirects,finalTarget,finalResponseHeaders,finalRouteKey};
    return{candidateId,status:'VERIFIED',verified:true,startupMs:now()-started,lastHttpStatus:status,mediaType:classified.mediaType,streamKind:classified.streamKind||'unknown',drmDetected:false,detail:'Manifest/media probe succeeded',redirects,finalTarget,finalResponseHeaders,finalRouteKey};
  }catch(error){
    const timeout=error?.name==='AbortError';
    return{candidateId,status:timeout?'TIMEOUT':'FAILED',verified:false,startupMs:now()-started,lastHttpStatus:null,mediaType:'',drmDetected:false,detail:timeout?`Upstream timeout after ${UPSTREAM_TIMEOUT_MS} ms`:error?.message||String(error),redirects,finalTarget,finalResponseHeaders,finalRouteKey};
  }finally{clearTimeout(timer);}
}
async function mapBounded(items,limit,fn){
  const out=new Array(items.length);let next=0;
  async function worker(){while(true){const index=next++;if(index>=items.length)return;out[index]=await fn(items[index],index);}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return out;
}

export default{
  async fetch(request){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/')return json({ok:true,service:'WebTV Source Verifier',version:VERSION,timeoutMs:UPSTREAM_TIMEOUT_MS,maxBatch:MAX_BATCH,maxConcurrency:MAX_CONCURRENCY,maxRedirects:MAX_REDIRECTS});
    if(request.method==='GET'&&url.pathname==='/fixture/working.m3u8')return new Response('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:1\n#EXTINF:6,\nsegment1.ts\n',{status:200,headers:{...cors(),'content-type':'application/vnd.apple.mpegurl','cache-control':'no-store'}});
    if(request.method==='GET'&&url.pathname==='/fixture/header-aware.m3u8'){
      const ua=request.headers.get('user-agent')||'';
      const roku=request.headers.get('x-roku-reserved-dev-id')||'';
      if(ua!=='Roku/DVP-14.6'||roku!=='device-123')return new Response('forbidden',{status:403,headers:cors()});
      return new Response('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:1\n#EXTINF:6,\nsegment1.ts\n',{status:200,headers:{...cors(),'content-type':'application/vnd.apple.mpegurl','cache-control':'no-store'}});
    }
    if(request.method==='GET'&&url.pathname==='/fixture/dead')return new Response('gone',{status:404,headers:cors()});
    if(request.method==='POST'&&url.pathname==='/verify'){
      let body={};try{body=await request.json();}catch{return json({error:'Invalid JSON'},400);}
      const items=Array.isArray(body.candidates)?body.candidates:[body.candidate||body];
      if(!items.length)return json({error:'No candidates supplied'},400);
      if(items.length>MAX_BATCH)return json({error:`Maximum ${MAX_BATCH} candidates per request`},413);
      const results=await mapBounded(items,MAX_CONCURRENCY,verifyOne);
      return json({ok:true,results,version:VERSION});
    }
    return json({error:'Not found'},404);
  }
};
