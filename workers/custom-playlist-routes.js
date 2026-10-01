function clean(value=''){return String(value??'').trim();}
function normalizeId(value=''){return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9α-ω]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,160);}
function cors(origin='*'){return{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','access-control-allow-headers':'content-type,authorization','cache-control':'no-store'};}
function json(data,status=200,origin='*'){return new Response(JSON.stringify(data),{status,headers:{...cors(origin),'content-type':'application/json;charset=utf-8'}});}
function text(data,status=200,type='text/plain;charset=utf-8',origin='*'){return new Response(data,{status,headers:{...cors(origin),'content-type':type}});}
function escAttr(value=''){return clean(value).replace(/"/g,"'").replace(/[\r\n]/g,' ');}
function requestOrigin(request,env){const allowed=clean(env?.ALLOWED_ORIGIN);if(!allowed||allowed==='*')return '*';const origin=request.headers.get('origin')||'';return origin===allowed?origin:allowed;}
async function readJson(request){try{return await request.clone().json();}catch{throw new Error('Invalid JSON body');}}
function permanentHttpUrl(value=''){try{const u=new URL(clean(value));return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return'';}}

export async function ensureCustomPlaylistTables(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS playlist_channels (
    playlist_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    tvg_id TEXT NOT NULL DEFAULT '',
    logo TEXT NOT NULL DEFAULT '',
    group_name TEXT NOT NULL DEFAULT 'Other',
    position INTEGER NOT NULL DEFAULT 999999,
    provider_epg_id TEXT NOT NULL DEFAULT '',
    provider_category TEXT NOT NULL DEFAULT '',
    provider_origin TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, channel_id)
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS playlist_channel_sources (
    playlist_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    url TEXT NOT NULL,
    origin TEXT NOT NULL DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 100,
    provider_account_id TEXT NOT NULL DEFAULT '',
    provider_epg_id TEXT NOT NULL DEFAULT '',
    provider_category TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, channel_id, url)
  )`).run();
}

async function requireRegistryWrite(request,env,registryWorker){
  const sessionRequest=new Request(new URL('/api/session',request.url),{headers:{authorization:request.headers.get('authorization')||''}});
  const response=await registryWorker.fetch(sessionRequest,env);
  return response.ok;
}

async function customParent(env,id){
  return env.DB.prepare(`SELECT id,name,kind,source_url AS sourceUrl,raw_m3u AS rawM3u,channel_count AS channelCount,group_count AS groupCount,created_at AS createdAt,updated_at AS updatedAt FROM playlists WHERE id=?`).bind(id).first();
}
async function requireCustomParent(env,id){
  const row=await customParent(env,id);
  if(!row)return{error:'Playlist not found',status:404};
  if(row.kind!=='custom')return{error:'Playlist is not custom',status:409};
  return{row};
}
async function listCustomChannels(env,playlistId){
  await ensureCustomPlaylistTables(env);
  const channels=await env.DB.prepare(`SELECT playlist_id AS playlistId,channel_id AS channelId,name,tvg_id AS tvgId,logo,group_name AS groupName,position,provider_epg_id AS providerEpgId,provider_category AS providerCategory,provider_origin AS providerOrigin FROM playlist_channels WHERE playlist_id=? ORDER BY position ASC,name COLLATE NOCASE ASC`).bind(playlistId).all();
  const sources=await env.DB.prepare(`SELECT playlist_id AS playlistId,channel_id AS channelId,url,origin,priority,provider_account_id AS providerAccountId,provider_epg_id AS providerEpgId,provider_category AS providerCategory FROM playlist_channel_sources WHERE playlist_id=? ORDER BY channel_id,priority ASC,url ASC`).bind(playlistId).all();
  const by=new Map();
  for(const source of sources.results||[]){if(!by.has(source.channelId))by.set(source.channelId,[]);by.get(source.channelId).push(source);}
  return (channels.results||[]).map(channel=>({...channel,sources:by.get(channel.channelId)||[]}));
}
function customM3u(channels=[]){
  const lines=['#EXTM3U'];
  for(const channel of channels){
    for(const source of channel.sources||[]){
      const url=permanentHttpUrl(source.url);if(!url)continue;
      lines.push(`#EXTINF:-1 tvg-id="${escAttr(channel.tvgId||channel.channelId)}" tvg-name="${escAttr(channel.name)}" tvg-logo="${escAttr(channel.logo)}" group-title="${escAttr(channel.groupName||'Other')}",${clean(channel.name)||'Unknown'}`);
      lines.push(url);
    }
  }
  return `${lines.join('\n')}\n`;
}

function routeParts(path){
  const prefix='/api/playlists/';
  if(!path.startsWith(prefix))return null;
  return path.slice(prefix.length).split('/').map(decodeURIComponent);
}

export async function handleCustomPlaylistRoute(request,env,registryWorker){
  const url=new URL(request.url);const path=url.pathname.replace(/\/+$/,'')||'/';const origin=requestOrigin(request,env);
  try{
    if(path==='/api/playlists'&&request.method==='POST'){
      const body=await readJson(request);
      if(clean(body.kind)!=='custom')return null;
      if(!await requireRegistryWrite(request,env,registryWorker))return json({error:'Locked. Enter the 6-digit PIN.'},401,origin);
      const id=clean(body.id)||`pl-${crypto.randomUUID()}`;const name=clean(body.name)||'Custom Playlist';
      await ensureCustomPlaylistTables(env);
      await env.DB.prepare(`INSERT INTO playlists(id,name,kind,source_url,raw_m3u,channel_count,group_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,source_url=excluded.source_url,raw_m3u=excluded.raw_m3u,channel_count=excluded.channel_count,group_count=excluded.group_count,updated_at=CURRENT_TIMESTAMP`).bind(id,name,'custom','', '',0,0).run();
      return json({ok:true,playlist:{id,name,kind:'custom',sourceUrl:'',channelCount:0,groupCount:0}},200,origin);
    }

    const parts=routeParts(path);if(!parts)return null;
    const [playlistId,segment,channelIdRaw]=parts; if(!playlistId)return null;

    if(segment==='channels'&&parts.length===2&&request.method==='GET'){
      const parent=await requireCustomParent(env,playlistId);if(parent.error)return json({error:parent.error},parent.status,origin);
      return json({playlist:{id:playlistId,name:parent.row.name,kind:'custom'},channels:await listCustomChannels(env,playlistId)},200,origin);
    }

    if(segment==='channels'&&parts.length===3&&request.method==='PUT'){
      if(!await requireRegistryWrite(request,env,registryWorker))return json({error:'Locked. Enter the 6-digit PIN.'},401,origin);
      const parent=await requireCustomParent(env,playlistId);if(parent.error)return json({error:parent.error},parent.status,origin);
      const body=await readJson(request);const channelId=normalizeId(channelIdRaw||body.channelId||body.id||body.tvgId||body.name);const name=clean(body.name);
      if(!channelId||!name)return json({error:'Valid channel ID and name are required'},400,origin);
      const rawSources=Array.isArray(body.sources)?body.sources:[];const seen=new Set();const sources=[];
      for(let i=0;i<rawSources.length;i++){
        const source=typeof rawSources[i]==='string'?{url:rawSources[i]}:rawSources[i]||{};const safe=permanentHttpUrl(source.url);if(!safe||seen.has(safe))continue;seen.add(safe);sources.push({...source,url:safe,priority:Number.isFinite(Number(source.priority))?Number(source.priority):100+i});
      }
      await ensureCustomPlaylistTables(env);
      const statements=[env.DB.prepare(`INSERT INTO playlist_channels(playlist_id,channel_id,name,tvg_id,logo,group_name,position,provider_epg_id,provider_category,provider_origin,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(playlist_id,channel_id) DO UPDATE SET name=excluded.name,tvg_id=excluded.tvg_id,logo=excluded.logo,group_name=excluded.group_name,position=excluded.position,provider_epg_id=excluded.provider_epg_id,provider_category=excluded.provider_category,provider_origin=excluded.provider_origin,updated_at=CURRENT_TIMESTAMP`).bind(playlistId,channelId,name,clean(body.tvgId||body.originalId||channelId),clean(body.logo),clean(body.groupName||body.group)||'Other',Number.isFinite(Number(body.position))?Number(body.position):999999,clean(body.providerEpgId),clean(body.providerCategory),clean(body.providerOrigin))];
      if(body.replaceSources)statements.push(env.DB.prepare(`DELETE FROM playlist_channel_sources WHERE playlist_id=? AND channel_id=?`).bind(playlistId,channelId));
      for(const source of sources)statements.push(env.DB.prepare(`INSERT INTO playlist_channel_sources(playlist_id,channel_id,url,origin,priority,provider_account_id,provider_epg_id,provider_category,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(playlist_id,channel_id,url) DO UPDATE SET origin=excluded.origin,priority=excluded.priority,provider_account_id=excluded.provider_account_id,provider_epg_id=excluded.provider_epg_id,provider_category=excluded.provider_category,updated_at=CURRENT_TIMESTAMP`).bind(playlistId,channelId,source.url,clean(source.origin),source.priority,clean(source.providerAccountId),clean(source.providerEpgId),clean(source.providerCategory)));
      await env.DB.batch(statements);
      return json({ok:true,channel:{playlistId,channelId,name,sources:sources.map(source=>source.url)}},200,origin);
    }

    if(segment==='channels'&&parts.length===3&&request.method==='DELETE'){
      if(!await requireRegistryWrite(request,env,registryWorker))return json({error:'Locked. Enter the 6-digit PIN.'},401,origin);
      const parent=await requireCustomParent(env,playlistId);if(parent.error)return json({error:parent.error},parent.status,origin);const channelId=normalizeId(channelIdRaw);if(!channelId)return json({error:'Invalid channel ID'},400,origin);
      await ensureCustomPlaylistTables(env);await env.DB.batch([env.DB.prepare(`DELETE FROM playlist_channel_sources WHERE playlist_id=? AND channel_id=?`).bind(playlistId,channelId),env.DB.prepare(`DELETE FROM playlist_channels WHERE playlist_id=? AND channel_id=?`).bind(playlistId,channelId)]);
      return json({ok:true,playlistId,channelId},200,origin);
    }

    if(segment==='export.m3u'&&parts.length===2&&request.method==='GET'){
      const parent=await requireCustomParent(env,playlistId);if(parent.error)return json({error:parent.error},parent.status,origin);
      return text(customM3u(await listCustomChannels(env,playlistId)),200,'audio/x-mpegurl;charset=utf-8',origin);
    }

    if(parts.length===1&&request.method==='DELETE'){
      const parent=await customParent(env,playlistId);if(!parent||parent.kind!=='custom')return null;
      if(!await requireRegistryWrite(request,env,registryWorker))return json({error:'Locked. Enter the 6-digit PIN.'},401,origin);
      await ensureCustomPlaylistTables(env);await env.DB.batch([env.DB.prepare(`DELETE FROM playlist_channel_sources WHERE playlist_id=?`).bind(playlistId),env.DB.prepare(`DELETE FROM playlist_channels WHERE playlist_id=?`).bind(playlistId),env.DB.prepare(`DELETE FROM playlists WHERE id=?`).bind(playlistId)]);
      return json({ok:true,id:playlistId},200,origin);
    }
    return null;
  }catch(error){return json({error:error?.message||'Custom playlist route failed'},400,origin);}
}
