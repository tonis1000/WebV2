const DEFAULT_VERIFIER='https://webtv-source-verifier.atonis.workers.dev';
const REQUEST_TIMEOUT_MS=7000;
const MAX_BATCH=4;
const MAX_CONCURRENCY=2;

function publicCandidate(candidate={}){
  return {
    candidateId:String(candidate.candidateId||''),
    sourceType:String(candidate.sourceType||''),
    sourceUrl:String(candidate.sourceUrl||''),
    requiredHeaders:{...(candidate.requiredHeaders||{})},
  };
}

function linkedSignal(parent,timeoutMs=REQUEST_TIMEOUT_MS){
  const controller=new AbortController();
  let parentAbort=null;
  if(parent){
    if(parent.aborted)controller.abort(parent.reason);
    else{
      parentAbort=()=>controller.abort(parent.reason);
      parent.addEventListener('abort',parentAbort,{once:true});
    }
  }
  const timer=setTimeout(()=>controller.abort(new DOMException('Verification timed out','AbortError')),timeoutMs);
  return{signal:controller.signal,cleanup:()=>{clearTimeout(timer);if(parent&&parentAbort)parent.removeEventListener('abort',parentAbort);}};
}

export async function verifyCandidates(candidates=[],{
  endpoint=DEFAULT_VERIFIER,
  signal,
  fetchImpl=fetch,
  timeoutMs=REQUEST_TIMEOUT_MS,
}={}){
  const items=(candidates||[]).slice(0,MAX_BATCH).map(publicCandidate);
  if(!items.length)return[];
  const base=String(endpoint||DEFAULT_VERIFIER).replace(/\/+$/,'');
  const linked=linkedSignal(signal,timeoutMs);
  try{
    const response=await fetchImpl(`${base}/verify`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({candidates:items}),
      cache:'no-store',
      signal:linked.signal,
    });
    let body={};try{body=await response.json();}catch{}
    if(!response.ok)throw new Error(body.error||`Verifier HTTP ${response.status}`);
    return Array.isArray(body.results)?body.results:[];
  }finally{linked.cleanup();}
}

export async function verifyWithConcurrency(candidates=[],{
  concurrency=MAX_CONCURRENCY,
  signal,
  onResult,
  ...options
}={}){
  const list=[...(candidates||[])];
  const results=new Array(list.length);
  let next=0;
  const limit=Math.max(1,Math.min(MAX_CONCURRENCY,Number(concurrency)||MAX_CONCURRENCY));
  async function worker(){
    while(true){
      if(signal?.aborted)throw signal.reason||new DOMException('Verification cancelled','AbortError');
      const index=next++;
      if(index>=list.length)return;
      const [result]=await verifyCandidates([list[index]],{...options,signal});
      results[index]=result||null;
      onResult?.(result||null,index,list[index]);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,list.length)},worker));
  return results;
}

export const VERIFIER_DEFAULT_ENDPOINT=DEFAULT_VERIFIER;
export const VERIFIER_REQUEST_TIMEOUT_MS=REQUEST_TIMEOUT_MS;
export const VERIFIER_MAX_BATCH=MAX_BATCH;
export const VERIFIER_MAX_CONCURRENCY=MAX_CONCURRENCY;
