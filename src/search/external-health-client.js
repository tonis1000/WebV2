const DEFAULT_ENDPOINT='https://tv-cache.atonis.workers.dev';
const REQUEST_TIMEOUT_MS=6000;

function linkedSignal(timeoutMs=REQUEST_TIMEOUT_MS){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new DOMException('External health timed out','AbortError')),timeoutMs);
  return{signal:controller.signal,cleanup:()=>clearTimeout(timer)};
}

export async function fetchExternalHealth(sourceUrl,{endpoint=DEFAULT_ENDPOINT,fetchImpl=fetch,timeoutMs=REQUEST_TIMEOUT_MS}={}){
  const value=String(sourceUrl||'').trim();
  if(!/^https?:\/\//i.test(value))return{source:'channel-signal',advisory:true,state:'invalid',detail:'Valid http/https source URL required.'};
  const linked=linkedSignal(timeoutMs);
  try{
    const base=String(endpoint||DEFAULT_ENDPOINT).replace(/\/+$/,'');
    const response=await fetchImpl(`${base}/external-health?url=${encodeURIComponent(value)}`,{cache:'no-store',signal:linked.signal});
    let body={};try{body=await response.json();}catch{}
    if(!response.ok)return{source:'channel-signal',advisory:true,state:'unavailable',detail:body?.detail||body?.error||`External health HTTP ${response.status}`};
    return{
      source:'channel-signal',
      advisory:true,
      state:String(body?.state||'not-found'),
      channel:String(body?.channel||''),
      list:String(body?.list||''),
      checkedAt:String(body?.checkedAt||''),
      lastSwept:String(body?.lastSwept||''),
      detail:String(body?.detail||''),
    };
  }catch(error){
    return{source:'channel-signal',advisory:true,state:'unavailable',detail:error?.message||String(error)};
  }finally{linked.cleanup();}
}

export const EXTERNAL_HEALTH_DEFAULT_ENDPOINT=DEFAULT_ENDPOINT;
