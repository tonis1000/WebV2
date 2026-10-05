const SERVICE='WebTV Media Catalog';
const VERSION='1.1';
const ORIGIN='https://live.ertflix.gr';
const MAX_ITEMS=48;
const MAX_BYTES=3500000;
const TIMEOUT_MS=12000;

function headers(){return {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Content-Type':'application/json; charset=utf-8'};}
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{...headers(),'Cache-Control':'public, max-age=120'}});}
function validSeriesId(value=''){
  const id=String(value||'').trim().toUpperCase();
  return /^ERT_[A-Z0-9_]+_E0$/.test(id)?id:'';
}
function officialUrl(id=''){const safe=validSeriesId(id);return safe?ORIGIN+'/details/'+safe:'';}
function imageUrl(value=''){
  const raw=String(value||'').trim();
  if(!raw)return'';
  if(raw.startsWith('/cached-images/'))return ORIGIN+raw;
  return raw.startsWith(ORIGIN+'/cached-images/')?raw:'';
}
function episodeNumber(value=''){
  const m=String(value||'').match(/^[EΕ](\d+)\b/i);
  return m?Number(m[1]):null;
}
function normalizeCatalog(payload={}){
  const out=[];const seen=new Set();
  for(const rail of Array.isArray(payload.rails)?payload.rails:[]){
    for(const row of Array.isArray(rail?.items)?rail.items:[]){
      const id=validSeriesId(row?.id);
      if(!id||seen.has(id))continue;
      const title=String(row?.title||'').trim();
      if(!title)continue;
      seen.add(id);
      out.push({
        id,title,
        year:String(row?.year||'').trim(),
        category:String(row?.category||'Series').trim()||'Series',
        rating:String(row?.rating||'').trim(),
        hasCc:Boolean(row?.hasCc),
        image:imageUrl(row?.image||row?.thumbnail),
        description:String(row?.description||'').trim().slice(0,1200),
        officialUrl:officialUrl(id),
        provider:'ertflix',
        kind:'series'
      });
      if(out.length>=MAX_ITEMS)return out;
    }
  }
  return out;
}
function normalizeDetails(payload={},requestedId=''){
  const id=validSeriesId(payload?.id)||validSeriesId(requestedId);
  if(!id)throw new Error('Invalid ERTFlix series details');
  const episodes=(Array.isArray(payload?.episodes)?payload.episodes:[]).map(row=>({
    id:String(row?.id||'').trim(),
    episodeNumber:episodeNumber(row?.title),
    title:String(row?.title||'').trim()||'Επεισόδιο',
    duration:String(row?.duration||'').trim(),
    rating:String(row?.rating||'').trim(),
    hasCc:Boolean(row?.hasCc),
    image:imageUrl(row?.image),
    description:String(row?.description||'').trim().slice(0,1200),
    provider:'ertflix',
    officialUrl:officialUrl(id)
  })).filter(row=>row.id&&row.title);
  return {
    id,
    title:String(payload?.title||'').trim()||id,
    year:String(payload?.year||'').trim(),
    category:String(payload?.category||'Series').trim()||'Series',
    rating:String(payload?.rating||'').trim(),
    image:imageUrl(payload?.poster||payload?.wallpaper),
    description:String(payload?.description||payload?.synopsis||'').trim().slice(0,1800),
    officialUrl:officialUrl(id),
    provider:'ertflix',
    episodes
  };
}
async function fetchJson(path){
  const url=new URL(path,ORIGIN);
  if(url.origin!==ORIGIN)throw new Error('provider origin rejected');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const r=await fetch(url.href,{redirect:'follow',headers:{accept:'application/json'},signal:controller.signal,cf:{cacheTtl:120}});
    if(!r.ok)throw new Error('ERTFlix HTTP '+r.status);
    if(Number(r.headers.get('content-length')||0)>MAX_BYTES)throw new Error('ERTFlix response too large');
    const raw=await r.text();
    if(new TextEncoder().encode(raw).length>MAX_BYTES)throw new Error('ERTFlix response too large');
    return JSON.parse(raw);
  }finally{clearTimeout(timer);}
}
async function catalog(){
  let payload;
  try{payload=await fetchJson('/api/template?template=Series%20Guest&lang=el_GR');}
  catch{payload=await fetchJson('/api/template?template=Series%20Guest&lang=en_GB');}
  const items=normalizeCatalog(payload);
  if(!items.length)throw new Error('No identifiable ERTFlix series found');
  return items;
}
async function details(id){
  let payload;
  try{payload=await fetchJson('/api/details?contentId='+encodeURIComponent(id)+'&lang=el_GR');}
  catch{payload=await fetchJson('/api/details?contentId='+encodeURIComponent(id)+'&lang=en_GB');}
  return normalizeDetails(payload,id);
}

export default {async fetch(request,env={}){
  const url=new URL(request.url);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers()});
  if(request.method!=='GET')return reply({error:'Method not allowed'},405);
  if(url.pathname==='/status')return reply({ok:true,service:SERVICE,version:VERSION,deploySha:String(env.DEPLOY_SHA||''),provider:'ertflix',origin:ORIGIN});
  try{
    if(url.pathname==='/api/catalog'){
      const items=await catalog();
      return reply({ok:true,service:SERVICE,version:VERSION,deploySha:String(env.DEPLOY_SHA||''),provider:'ertflix',source:ORIGIN+'/api/template',items});
    }
    const m=url.pathname.match(/^\/api\/series\/(ERT_[A-Z0-9_]+_E0)$/i);
    if(m){
      const id=validSeriesId(m[1]);if(!id)return reply({error:'Series id required'},400);
      const series=await details(id);
      return reply({ok:true,service:SERVICE,version:VERSION,deploySha:String(env.DEPLOY_SHA||''),provider:'ertflix',source:ORIGIN+'/api/details',series});
    }
    return reply({error:'Not found'},404);
  }catch(error){return reply({ok:false,service:SERVICE,version:VERSION,error:error?.message||String(error)},502);}
}};

export {validSeriesId,normalizeCatalog,normalizeDetails,episodeNumber,imageUrl};
