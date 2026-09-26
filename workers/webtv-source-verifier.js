const VERSION='1.0';
const ALLOWED_ORIGIN='*';
const UPSTREAM_TIMEOUT_MS=6000;
const MAX_BODY_BYTES=512000;
const MAX_BATCH=4;
const MAX_CONCURRENCY=2;

function cors(){return {'access-control-allow-origin':ALLOWED_ORIGIN,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'};}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors(),'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});}
function now(){return Date.now();}
function cleanHeaders(input={}){
  const allowed=new Map([['user-agent','User-Agent'],['referer','Referer'],['origin','Origin']]);
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
function inferredType(url='',explicit=''){
  const type=String(explicit||'').toLowerCase();
  if(['hls','dash','direct','xtream','header-aware'].includes(type))return type;
  const clean=String(url).split('|')[0].toLowerCase();
  if(/\.m3u8(?:[?#]|$)/.test(clean))return'hls';
  if(/\.mpd(?:[?#]|$)/.test(clean))return'dash';
  return'direct';
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
function classifyBody(type,text='',contentType=''){
  const body=String(text||'');
  const ct=String(contentType||'').toLowerCase();
  const hls=body.trimStart().startsWith('#EXTM3U')&&(body.includes('#EXT-X-')||ct.includes('mpegurl'));
  const dash=/<MPD\b/i.test(body)||(ct.includes('dash+xml'));
  const drm=/widevine|playready|contentprotection|urn:uuid:/i.test(body);
  if(type==='hls'&&!hls)return{ok:false,mediaType:'',drmDetected:drm,reason:'Response is not a valid HLS manifest'};
  if(type==='dash'&&!dash)return{ok:false,mediaType:'',drmDetected:drm,reason:'Response is not a valid DASH manifest'};
  if(type==='direct'&&!(hls||dash||ct.startsWith('video/')||ct.startsWith('audio/')||ct.includes('octet-stream')))return{ok:false,mediaType:'',drmDetected:drm,reason:'Response is not recognized as playable media'};
  return{ok:true,mediaType:hls?'hls':dash?'dash':ct.split(';')[0]||type,drmDetected:drm,reason:''};
}
async function verifyOne(input={}){
  const started=now();
  const candidateId=String(input.candidateId||'');
  const sourceUrl=String(input.sourceUrl||'').trim();
  const type=inferredType(sourceUrl,input.sourceType);
  if(type==='strm'||type==='m3u')return{candidateId,status:'UNRESOLVED',verified:false,startupMs:0,lastHttpStatus:null,mediaType:'',drmDetected:false,detail:'Resolve container/reference before verification'};
  let target;
  try{target=safeHttpUrl(sourceUrl);}catch(error){return{candidateId,status:'FAILED',verified:false,startupMs:now()-started,lastHttpStatus:null,mediaType:'',drmDetected:false,detail:error.message};}
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),UPSTREAM_TIMEOUT_MS);
  try{
    const headers=new Headers(cleanHeaders(input.requiredHeaders));
    if(!headers.has('user-agent'))headers.set('user-agent',`Mozilla/5.0 WebTV-SourceVerifier/${VERSION}`);
    headers.set('accept','application/vnd.apple.mpegurl,application/x-mpegURL,application/dash+xml,video/*,audio/*,*/*;q=0.5');
    const response=await fetch(target.toString(),{method:'GET',redirect:'follow',cache:'no-store',headers,signal:controller.signal});
    const status=response.status;
    if(!response.ok&&status!==206){
      const mapped=status===403?'HTTP 403':status===404?'HTTP 404':'FAILED';
      return{candidateId,status:mapped,verified:false,startupMs:now()-started,lastHttpStatus:status,mediaType:'',drmDetected:false,detail:`Upstream HTTP ${status}`};
    }
    const text=await readLimited(response);
    const classified=classifyBody(type,text,response.headers.get('content-type')||'');
    if(classified.drmDetected)return{candidateId,status:'DRM',verified:false,startupMs:now()-started,lastHttpStatus:status,mediaType:classified.mediaType,drmDetected:true,detail:'DRM markers detected'};
    if(!classified.ok)return{candidateId,status:'FAILED',verified:false,startupMs:now()-started,lastHttpStatus:status,mediaType:classified.mediaType,drmDetected:false,detail:classified.reason};
    return{candidateId,status:'VERIFIED',verified:true,startupMs:now()-started,lastHttpStatus:status,mediaType:classified.mediaType,drmDetected:false,detail:'Manifest/media probe succeeded'};
  }catch(error){
    const timeout=error?.name==='AbortError';
    return{candidateId,status:timeout?'TIMEOUT':'FAILED',verified:false,startupMs:now()-started,lastHttpStatus:null,mediaType:'',drmDetected:false,detail:timeout?`Upstream timeout after ${UPSTREAM_TIMEOUT_MS} ms`:error?.message||String(error)};
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
    if(request.method==='GET'&&url.pathname==='/')return json({ok:true,service:'WebTV Source Verifier',version:VERSION,timeoutMs:UPSTREAM_TIMEOUT_MS,maxBatch:MAX_BATCH,maxConcurrency:MAX_CONCURRENCY});
    if(request.method==='GET'&&url.pathname==='/fixture/working.m3u8')return new Response('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:1\n#EXTINF:6,\nsegment1.ts\n',{status:200,headers:{...cors(),'content-type':'application/vnd.apple.mpegurl','cache-control':'no-store'}});
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
