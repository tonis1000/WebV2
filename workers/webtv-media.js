const SERVICE='WebTV Media Catalog';
const VERSION='1.0';
const ORIGIN='https://live.ertflix.gr';
const MAX_ITEMS=36;
const MAX_BYTES=2500000;
const TIMEOUT_MS=10000;

function headers(){return {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Content-Type':'application/json; charset=utf-8'};}
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{...headers(),'Cache-Control':'public, max-age=120'}});}
function decode(value=''){return String(value||'').replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('\\u0026','&').replaceAll('\\u003c','<').replaceAll('\\u003e','>').replaceAll('\\/','/');}
function text(value=''){return decode(String(value||'')).replace(/<[^>]+>/g,' ').replace(/\\[nrt]/g,' ').replace(/\s+/g,' ').trim();}
function validId(value=''){const id=String(value||'').toUpperCase();return /^ERT_[A-Z0-9_]+_E\d+$/.test(id)?id:'';}
function pageUrl(id=''){const safe=validId(id);return safe?ORIGIN+'/details/'+safe:'';}
function titleNear(html,pos,id){
  const s=decode(html).slice(Math.max(0,pos-650),pos+650);
  const candidates=[];
  for(const re of [/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi,/["'](?:Title|title)["']\s*:\s*["']([^"']{2,160})["']/gi,/alt=["']([^"']{2,160})["']/gi]){
    for(const m of s.matchAll(re)){const v=text(m[1]);if(v&&v!==id&&!/^ERT[_ ]/i.test(v))candidates.push(v);}
  }
  return candidates.at(-1)||'';
}
function refs(html=''){
  const raw=decode(html);const out=[];const seen=new Set();
  for(const a of raw.matchAll(/<a\b[^>]*href=["'][^"']*\/details\/(ERT_[A-Z0-9_]+_E\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const id=validId(a[1]);if(!id||seen.has(id))continue;seen.add(id);
    out.push({id,title:text(a[2]).replace(/^Play\s*/i,'').trim(),officialUrl:pageUrl(id),provider:'ertflix'});
  }
  for(const m of raw.matchAll(/\/details\/(ERT_[A-Z0-9_]+_E\d+)/gi)){
    const id=validId(m[1]);if(!id||seen.has(id))continue;seen.add(id);
    out.push({id,title:titleNear(raw,m.index||0,id),officialUrl:pageUrl(id),provider:'ertflix'});
  }
  return out;
}
function pageTitle(html='',id=''){
  const raw=decode(html);
  const h=text((raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||'');
  if(h&&h!==id&&!/^ERT[_ ]/i.test(h))return h;
  const p=raw.indexOf(id);
  return titleNear(raw,p<0?0:p,id)||id;
}
function description(html=''){
  const raw=decode(html);
  const m=raw.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i);
  return text(m?.[1]||'').slice(0,1000);
}
function seriesFromHtml(html,id){
  const episodes=refs(html).filter(x=>x.id!==id&&!/_E0$/i.test(x.id)).map(x=>{
    const n=Number((x.id.match(/_E(\d+)$/i)||[])[1]||0)||null;
    return {...x,episodeNumber:n,title:x.title||('Επεισόδιο '+(n||''))};
  }).sort((a,b)=>(a.episodeNumber||9999)-(b.episodeNumber||9999));
  return {id,title:pageTitle(html,id),description:description(html),officialUrl:pageUrl(id),provider:'ertflix',episodes};
}
async function fetchHtml(path){
  const url=new URL(path,ORIGIN);if(url.origin!==ORIGIN)throw new Error('provider origin rejected');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const r=await fetch(url.href,{redirect:'follow',headers:{accept:'text/html'},signal:controller.signal,cf:{cacheTtl:120}});
    if(!r.ok)throw new Error('ERTFlix HTTP '+r.status);
    if(Number(r.headers.get('content-length')||0)>MAX_BYTES)throw new Error('ERTFlix response too large');
    const body=await r.text();if(new TextEncoder().encode(body).length>MAX_BYTES)throw new Error('ERTFlix response too large');
    return body;
  }finally{clearTimeout(timer);}
}
async function catalog(){
  const pages=await Promise.allSettled([fetchHtml('/'),fetchHtml('/series')]);
  const all=[];const seen=new Set();
  for(const page of pages){
    if(page.status!=='fulfilled')continue;
    for(const row of refs(page.value)){
      if(!/_E0$/i.test(row.id)||seen.has(row.id))continue;seen.add(row.id);all.push({...row,kind:'series'});
      if(all.length>=MAX_ITEMS)break;
    }
  }
  const named=all.filter(x=>x.title&&x.title!==x.id);
  if(!named.length)throw new Error('No identifiable ERTFlix series found');
  return named;
}

export default {async fetch(request,env={}){
  const url=new URL(request.url);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers()});
  if(request.method!=='GET')return reply({error:'Method not allowed'},405);
  if(url.pathname==='/status')return reply({ok:true,service:SERVICE,version:VERSION,deploySha:String(env.DEPLOY_SHA||''),provider:'ertflix',origin:ORIGIN});
  try{
    if(url.pathname==='/api/catalog'){
      const items=await catalog();
      return reply({ok:true,service:SERVICE,version:VERSION,deploySha:String(env.DEPLOY_SHA||''),provider:'ertflix',source:ORIGIN,items});
    }
    const m=url.pathname.match(/^\/api\/series\/(ERT_[A-Z0-9_]+_E\d+)$/i);
    if(m){
      const id=validId(m[1]);if(!id||!/_E0$/i.test(id))return reply({error:'Series id required'},400);
      const body=await fetchHtml('/details/'+id);
      return reply({ok:true,service:SERVICE,version:VERSION,deploySha:String(env.DEPLOY_SHA||''),provider:'ertflix',series:seriesFromHtml(body,id)});
    }
    return reply({error:'Not found'},404);
  }catch(error){return reply({ok:false,service:SERVICE,version:VERSION,error:error?.message||String(error)},502);}
}};

export {refs,seriesFromHtml,validId,pageTitle};
