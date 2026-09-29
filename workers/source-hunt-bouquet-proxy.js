import smartWorker from './source-hunt-smart.js';

const ALLOWED_ORIGIN='*';
const MAX_BYTES=2500000;
const TIMEOUT_MS=10000;
const ALLOWED_HOSTS=new Set(['gitlab.openpli.org']);

function cors(){return {'access-control-allow-origin':ALLOWED_ORIGIN,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'};}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors(),'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});}
function safeTarget(raw=''){
  const url=new URL(raw);
  if(url.protocol!=='https:')throw new Error('Only HTTPS bouquet URLs are allowed');
  const host=url.hostname.toLowerCase();
  if(!ALLOWED_HOSTS.has(host))throw new Error('Bouquet host is not allowed');
  return url;
}
async function fetchBouquet(raw){
  let target;try{target=safeTarget(raw);}catch(error){return json({error:error.message},400);}
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const response=await fetch(target,{redirect:'follow',signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 WebTV-Enigma2-BouquetProxy/1.0',accept:'text/plain,*/*'}});
    if(!response.ok)return json({error:`Bouquet upstream HTTP ${response.status}`},502);
    const text=(await response.text()).slice(0,MAX_BYTES);
    if(!/^#NAME\b|^#SERVICE\b/m.test(text)||!/#SERVICE\s+/m.test(text))return json({error:'Upstream response is not an Enigma2 bouquet'},422);
    return new Response(text,{status:200,headers:{...cors(),'content-type':'text/plain;charset=utf-8','cache-control':'public,max-age=300','x-webtv-proxy':'enigma2-bouquet','x-webtv-upstream-host':target.hostname}});
  }catch(error){return json({error:error?.name==='AbortError'?'Bouquet upstream timeout':error?.message||String(error)},504);}
  finally{clearTimeout(timer);}
}

export default {async fetch(request,env,ctx){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});
  const url=new URL(request.url);
  if(url.pathname==='/bouquet-proxy'){
    const target=(url.searchParams.get('url')||'').trim();
    if(!target)return json({error:'url is required'},400);
    return fetchBouquet(target);
  }
  return smartWorker.fetch(request,env,ctx);
}};
