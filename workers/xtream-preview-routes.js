const DEFAULT_REGISTRY_URL='https://webtv-registry.atonis.workers.dev';
const PREVIEW_TTL_MS=10*60*1000;
const MAX_PREVIEW_STREAMS=5000;

function cors(origin='*'){
  return{
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers':'content-type,authorization,x-webtv-session,range',
    'access-control-expose-headers':'content-length,content-range,accept-ranges',
    'access-control-max-age':'86400',
  };
}
function json(data,status=200,origin='*'){
  return new Response(JSON.stringify(data),{status,headers:{...cors(origin),'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});
}
function clean(value=''){return String(value??'').trim();}
function errorWithStatus(message,status=400){const error=new Error(message);error.status=status;return error;}
function requestOrigin(request,env){
  const allowed=clean(env.ALLOWED_ORIGIN);
  if(!allowed||allowed==='*')return '*';
  const origin=request.headers.get('origin')||'';
  return origin===allowed?origin:allowed;
}
function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function fromB64url(value){const s=String(value||'').replace(/-/g,'+').replace(/_/g,'/');const padded=s+'='.repeat((4-(s.length%4))%4);return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));}
async function hmac(secret,message){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)));}
function safeEqual(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i+=1)x|=a[i]^b[i];return x===0;}
function encryptionSecret(env){const secret=String(env.XTREAM_ENCRYPTION_KEY||'');if(secret.length<24)throw errorWithStatus('XTREAM_ENCRYPTION_KEY must be configured as a Cloudflare secret',503);return secret;}
async function encryptionKey(env){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(encryptionSecret(env)));return crypto.subtle.importKey('raw',digest,{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function encryptText(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));const key=await encryptionKey(env);const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(String(value))));return`${b64url(iv)}.${b64url(ciphertext)}`;}
async function decryptText(value,env){const[ivRaw,dataRaw]=String(value||'').split('.');if(!ivRaw||!dataRaw)throw errorWithStatus('Invalid Xtream preview token',403);const key=await encryptionKey(env);try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64url(ivRaw)},key,fromB64url(dataRaw));return new TextDecoder().decode(plain);}catch{throw errorWithStatus('Invalid Xtream preview token',403);}}

async function requireAdmin(request,env,origin){
  const customToken=clean(request.headers.get('x-webtv-session'));
  const auth=request.headers.get('authorization')||'';
  const bearerToken=auth.replace(/^Bearer\s+/i,'').trim();
  const token=customToken||bearerToken;
  if(!token)return json({error:'Trusted-device session required',authDebug:'missing-session-header'},401,origin);
  const registry=clean(env.REGISTRY_URL)||DEFAULT_REGISTRY_URL;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const init={method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token}),cache:'no-store',signal:controller.signal};
    const response=env.REGISTRY?.fetch?await env.REGISTRY.fetch(new Request('https://webtv-registry.internal/api/session/validate',init)):await fetch(`${registry.replace(/\/+$/,'')}/api/session/validate`,init);
    if(!response.ok)return json({error:'Trusted-device session required',authDebug:'registry-rejected-session'},401,origin);
    return null;
  }catch{return json({error:'Registry session validation unavailable'},503,origin);}
  finally{clearTimeout(timer);}
}

function normalizeServer(value=''){
  const parsed=new URL(clean(value));
  if(!/^https?:$/.test(parsed.protocol))throw errorWithStatus('Xtream server must use http/https');
  parsed.hash='';parsed.search='';return parsed.toString().replace(/\/+$/,'');
}
function endpoint(server,path){return new URL(path.replace(/^\//,''),`${normalizeServer(server)}/`).href;}
async function providerJson(server,username,password,action=''){
  const url=new URL(endpoint(server,'/player_api.php'));
  url.searchParams.set('username',username);url.searchParams.set('password',password);if(action)url.searchParams.set('action',action);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(url.toString(),{headers:{'User-Agent':'Mozilla/5.0 WebTV-V2 Xtream Bridge'},redirect:'follow',signal:controller.signal});
    if(!response.ok){let preview='';try{preview=(await response.text()).replace(/\s+/g,' ').slice(0,120);}catch{}const safeTarget=`${url.origin}${url.pathname}${action?`?action=${encodeURIComponent(action)}`:''}`;throw errorWithStatus(`Xtream provider HTTP ${response.status} · ${safeTarget}${preview?` · ${preview}`:''}`,502);}
    return await response.json();
  }finally{clearTimeout(timer);}
}
async function validateAccount(server,username,password){
  const data=await providerJson(server,username,password);const user=data?.user_info||{};
  const authenticated=String(user.auth??'')==='1'||String(user.status||'').toLowerCase()==='active';
  if(!authenticated)throw errorWithStatus('Xtream login rejected by provider',401);
  return{status:user.status||'Active',expiresAt:Number(user.exp_date||0)||null,maxConnections:Number(user.max_connections||0)||null,activeConnections:Number(user.active_cons||0)||null,allowedOutputFormats:Array.isArray(user.allowed_output_formats)?user.allowed_output_formats:[]};
}
async function fetchCatalog(server,username,password){
  const[categories,streams]=await Promise.all([providerJson(server,username,password,'get_live_categories'),providerJson(server,username,password,'get_live_streams')]);
  const categoryMap=new Map((Array.isArray(categories)?categories:[]).map(c=>[String(c.category_id),clean(c.category_name)||'Xtream']));
  return(Array.isArray(streams)?streams:[]).slice(0,MAX_PREVIEW_STREAMS).map(stream=>({
    streamId:String(stream.stream_id??'').trim(),
    tvgId:clean(stream.epg_channel_id||stream.tv_archive_id||stream.name||stream.stream_id),
    name:clean(stream.name)||`Stream ${stream.stream_id}`,
    logo:clean(stream.stream_icon),
    group:categoryMap.get(String(stream.category_id))||'Xtream',
    categoryId:String(stream.category_id??''),
  })).filter(item=>item.streamId);
}

async function createPreviewToken(env,{name,server,username,password}){
  const expiresAt=Date.now()+PREVIEW_TTL_MS;
  const token=await encryptText(JSON.stringify({v:1,name:clean(name),server:normalizeServer(server),username:clean(username),password:String(password||''),expiresAt}),env);
  return{token,expiresAt};
}
async function readPreviewToken(env,token){
  let payload={};
  try{payload=JSON.parse(await decryptText(token,env));}catch(error){if(error?.status)throw error;throw errorWithStatus('Invalid Xtream preview token',403);}
  if(Number(payload?.v)!==1||!payload?.server||!payload?.username||!payload?.password)throw errorWithStatus('Invalid Xtream preview token',403);
  if(!Number.isFinite(Number(payload.expiresAt))||Number(payload.expiresAt)<=Date.now())throw errorWithStatus('Xtream preview expired. Test the account again',410);
  return{name:clean(payload.name),server:normalizeServer(payload.server),username:clean(payload.username),password:String(payload.password),expiresAt:Number(payload.expiresAt)};
}
function previewPlaybackUrl(requestUrl,token,streamId){const url=new URL(requestUrl);return`${url.origin}/preview-stream/${encodeURIComponent(streamId)}.m3u8?t=${encodeURIComponent(token)}`;}
async function channelSignature(env,sourceId,streamId){const sig=await hmac(encryptionSecret(env),`xtream-channel:v1:${sourceId}:${streamId}`);return b64url(sig).slice(0,32);}
async function channelPlaybackUrl(requestUrl,env,sourceId,streamId){const url=new URL(requestUrl);const sig=await channelSignature(env,sourceId,streamId);return`${url.origin}/channel-stream/${encodeURIComponent(sourceId)}/${encodeURIComponent(streamId)}.m3u8?s=${encodeURIComponent(sig)}`;}

async function ensureTables(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS xtream_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    server TEXT NOT NULL,
    username_enc TEXT NOT NULL,
    password_enc TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS xtream_channel_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    server TEXT NOT NULL,
    username_enc TEXT NOT NULL,
    password_enc TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}
async function saveFullAccount(env,payload,nameOverride=''){
  await ensureTables(env);
  const tested=await validateAccount(payload.server,payload.username,payload.password);
  const id=`xt_${crypto.randomUUID()}`;const name=clean(nameOverride)||clean(payload.name)||new URL(payload.server).host;
  const usernameEnc=await encryptText(payload.username,env);const passwordEnc=await encryptText(payload.password,env);
  await env.DB.prepare(`INSERT INTO xtream_accounts(id,name,server,username_enc,password_enc,created_at,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(id,name,payload.server,usernameEnc,passwordEnc).run();
  return{id,name,server:payload.server,tested};
}
async function saveChannelOnly(requestUrl,env,payload,streamId,name=''){
  await ensureTables(env);
  const raw=await hmac(encryptionSecret(env),`xtream-channel-id:v1:${payload.server}:${payload.username}:${streamId}`);
  const id=`xch_${b64url(raw).slice(0,22)}`;const sourceName=clean(name)||clean(payload.name)||`Stream ${streamId}`;
  const usernameEnc=await encryptText(payload.username,env);const passwordEnc=await encryptText(payload.password,env);
  await env.DB.prepare(`INSERT INTO xtream_channel_sources(id,name,server,username_enc,password_enc,stream_id,created_at,updated_at)
    VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,server=excluded.server,username_enc=excluded.username_enc,password_enc=excluded.password_enc,stream_id=excluded.stream_id,updated_at=CURRENT_TIMESTAMP`)
    .bind(id,sourceName,payload.server,usernameEnc,passwordEnc,streamId).run();
  return{id,name:sourceName,server:payload.server,streamId,playbackUrl:await channelPlaybackUrl(requestUrl,env,id,streamId)};
}

async function deleteChannelOnly(env,sourceId){
  await ensureTables(env);
  const id=clean(sourceId);
  if(!/^xch_[A-Za-z0-9_-]{8,64}$/.test(id))throw errorWithStatus('Invalid Xtream channel source ID');
  const existing=await env.DB.prepare(`SELECT id FROM xtream_channel_sources WHERE id=?`).bind(id).first();
  if(!existing)return{id,deleted:false,reason:'not-found',references:0};
  const needle=`/channel-stream/${id}/`;
  const referenceRow=await env.DB.prepare(`SELECT COUNT(*) AS n FROM channel_sources s JOIN my_playlist m ON m.channel_id=s.channel_id WHERE s.enabled=1 AND instr(s.url, ?) > 0`).bind(needle).first();
  const references=Math.max(0,Number(referenceRow?.n||0));
  if(references>0)return{id,deleted:false,reason:'still-referenced',references};
  await env.DB.prepare(`DELETE FROM xtream_channel_sources WHERE id=?`).bind(id).run();
  return{id,deleted:true,reason:'deleted',references:0};
}

async function proxyUrlFor(requestUrl,env,absoluteTarget){const token=await encryptText(absoluteTarget,env);const base=new URL(requestUrl);return`${base.origin}/hls-proxy?u=${encodeURIComponent(token)}`;}
async function rewriteManifest(text,finalUrl,requestUrl,env){
  const rewrite=async ref=>{const value=String(ref||'').trim();if(!value||value.startsWith('data:'))return value;return proxyUrlFor(requestUrl,env,new URL(value,finalUrl).href);};
  const out=[];
  for(const rawLine of String(text).split(/\r?\n/)){
    let line=rawLine;
    if(line.startsWith('#')){const matches=[...line.matchAll(/URI="([^"]+)"/g)];for(const match of matches){const proxied=await rewrite(match[1]);line=line.replace(match[0],`URI="${proxied}"`);}out.push(line);continue;}
    if(line.trim())line=await rewrite(line.trim());out.push(line);
  }
  return out.join('\n');
}
async function fetchUpstream(targetUrl,request){const headers=new Headers();const range=request.headers.get('range');if(range)headers.set('range',range);headers.set('user-agent','Mozilla/5.0 WebTV-V2 Xtream Bridge');return fetch(targetUrl,{headers,redirect:'follow',cache:'no-store'});}
function isManifestResponse(response,targetUrl){const type=(response.headers.get('content-type')||'').toLowerCase();return type.includes('mpegurl')||type.includes('m3u8')||new URL(targetUrl).pathname.toLowerCase().endsWith('.m3u8');}
async function proxyUpstream(request,env,targetUrl,origin){
  const response=await fetchUpstream(targetUrl,request);
  if(!response.ok&&response.status!==206){let preview='';try{preview=(await response.text()).replace(/\s+/g,' ').slice(0,120);}catch{}return json({error:`Xtream stream HTTP ${response.status}${preview?` · ${preview}`:''}`},response.status,origin);}
  const headers=new Headers(cors(origin));for(const key of['content-type','content-length','content-range','accept-ranges','etag','last-modified']){const value=response.headers.get(key);if(value)headers.set(key,value);}headers.set('cache-control','no-store');
  if(isManifestResponse(response,response.url||targetUrl)){const text=await response.text();const rewritten=await rewriteManifest(text,response.url||targetUrl,request.url,env);headers.set('content-type','application/vnd.apple.mpegurl;charset=utf-8');headers.delete('content-length');return new Response(rewritten,{status:200,headers});}
  return new Response(response.body,{status:response.status,headers});
}
async function previewStream(request,env,streamId,origin){
  const token=new URL(request.url).searchParams.get('t')||'';if(!token)return json({error:'Missing Xtream preview token'},400,origin);
  const payload=await readPreviewToken(env,token);
  const upstream=`${payload.server}/live/${encodeURIComponent(payload.username)}/${encodeURIComponent(payload.password)}/${encodeURIComponent(streamId)}.m3u8`;
  return proxyUpstream(request,env,upstream,origin);
}
async function channelStream(request,env,sourceId,streamId,origin){
  await ensureTables(env);
  const row=await env.DB.prepare(`SELECT id,server,username_enc AS usernameEnc,password_enc AS passwordEnc,stream_id AS streamId FROM xtream_channel_sources WHERE id=?`).bind(sourceId).first();
  if(!row)return json({error:'Xtream channel source not found'},404,origin);
  if(String(row.streamId)!==String(streamId))return json({error:'Xtream stream ID mismatch'},403,origin);
  const supplied=fromB64url(new URL(request.url).searchParams.get('s')||'');const expected=fromB64url(await channelSignature(env,sourceId,streamId));if(!safeEqual(supplied,expected))return json({error:'Invalid playback signature'},403,origin);
  const username=await decryptText(row.usernameEnc,env);const password=await decryptText(row.passwordEnc,env);
  const upstream=`${row.server}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(streamId)}.m3u8`;
  return proxyUpstream(request,env,upstream,origin);
}

function isPhase52Path(path){return path==='/api/preview'||path==='/api/accounts/from-preview'||path==='/api/channel-sources'||/^\/api\/channel-sources\/[^/]+$/.test(path)||/^\/preview-stream\/[^/]+\.m3u8$/.test(path)||/^\/channel-stream\/[^/]+\/[^/]+\.m3u8$/.test(path);}

export async function handleXtreamPreviewRoute(request,env){
  const url=new URL(request.url);const path=url.pathname.replace(/\/+$/,'')||'/';
  if(!isPhase52Path(path))return null;
  const origin=requestOrigin(request,env);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(!env.DB)return json({error:'D1 binding DB is not configured'},503,origin);
  try{
    if(path==='/api/preview'&&request.method==='POST'){
      const denied=await requireAdmin(request,env,origin);if(denied)return denied;
      const body=await request.json();const server=normalizeServer(body.server);const username=clean(body.username);const password=String(body.password||'');if(!username||!password)throw errorWithStatus('Server, username and password are required');
      const tested=await validateAccount(server,username,password);const{name='',}=body;const preview=await createPreviewToken(env,{name,server,username,password});const channels=await fetchCatalog(server,username,password);
      const accountName=clean(name)||new URL(server).host;
      return json({ok:true,previewToken:preview.token,expiresAt:new Date(preview.expiresAt).toISOString(),account:{name:accountName,server,tested},channels:channels.map(channel=>({...channel,playbackUrl:previewPlaybackUrl(request.url,preview.token,channel.streamId)}))},200,origin);
    }
    if(path==='/api/accounts/from-preview'&&request.method==='POST'){
      const denied=await requireAdmin(request,env,origin);if(denied)return denied;
      const body=await request.json();const payload=await readPreviewToken(env,body.previewToken||'');const account=await saveFullAccount(env,payload,body.name||'');return json({ok:true,account},200,origin);
    }
    if(path==='/api/channel-sources'&&request.method==='POST'){
      const denied=await requireAdmin(request,env,origin);if(denied)return denied;
      const body=await request.json();const streamId=clean(body.streamId);if(!streamId)throw errorWithStatus('Xtream stream ID is required');const payload=await readPreviewToken(env,body.previewToken||'');const source=await saveChannelOnly(request.url,env,payload,streamId,body.name||'');return json({ok:true,source},200,origin);
    }
    const cleanupMatch=path.match(/^\/api\/channel-sources\/([^/]+)$/);
    if(cleanupMatch&&request.method==='DELETE'){const denied=await requireAdmin(request,env,origin);if(denied)return denied;const result=await deleteChannelOnly(env,decodeURIComponent(cleanupMatch[1]));return json({ok:true,...result},200,origin);}
    const previewMatch=path.match(/^\/preview-stream\/([^/]+)\.m3u8$/);if(previewMatch&&request.method==='GET')return previewStream(request,env,decodeURIComponent(previewMatch[1]),origin);
    const channelMatch=path.match(/^\/channel-stream\/([^/]+)\/([^/]+)\.m3u8$/);if(channelMatch&&request.method==='GET')return channelStream(request,env,decodeURIComponent(channelMatch[1]),decodeURIComponent(channelMatch[2]),origin);
    return json({error:'Not found'},404,origin);
  }catch(error){return json({error:error?.message||String(error)},Number(error?.status)||500,origin);}
}

export const XTREAM_PREVIEW_TTL_MS=PREVIEW_TTL_MS;
