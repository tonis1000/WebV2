import baseWorker from './webtv-source-discovery.js';
import {
  canonicalizeStrmReference,
  isStrmReference,
  parseStrmDocument,
} from '../src/core/strm-core.js';

const VERSION='1.13';
const MAX_STRM_RESOLVES=4;
const STRM_TIMEOUT_MS=6000;
const STRM_MAX_DEPTH=3;
const STRM_MAX_BYTES=256000;

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
  const seen=new Set(),deduped=out.filter(item=>{const key=String(item?.sourceUrl||'');if(!key||seen.has(key))return false;seen.add(key);return true;});
  return {...payload,version:VERSION,candidates:deduped,strmResolution:{attempted:attempts,resolved:reports.filter(x=>x.resolved).length,rejected:reports.filter(x=>!x.resolved).length,reports}};
}

export default {async fetch(request,env,ctx){
  const bodyRequest=request.method==='POST'?request.clone():null;
  const response=await baseWorker.fetch(request,env,ctx);const url=new URL(request.url);const type=response.headers.get('content-type')||'';
  if(!type.includes('application/json'))return response;
  let payload;try{payload=await response.clone().json();}catch{return response;}
  if(url.pathname==='/'&&response.ok)payload={...payload,version:VERSION,features:[...(payload.features||[]),'curated STRM pre-resolution']};
  else if(url.pathname==='/discover'&&response.ok&&request.method==='POST'){
    let body={};try{body=bodyRequest?await bodyRequest.json():{};}catch{}
    if(String(body?.provider||'')==='curated-remote-feeds')payload=await resolveCuratedStrm(payload);else payload={...payload,version:VERSION};
  }
  return jsonResponse(response,payload);
}};
