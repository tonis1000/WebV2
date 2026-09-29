import registryWorker from './webtv-registry.js';

const START_PATH='/api/project-agent/pair/start';
const FINISH_PATH='/api/project-agent/pair/finish';
const PAIRING_COOKIE='webv2_project_agent_pairing';
const PAIRING_MAX_AGE=5*60;

function htmlResponse(html,status=200,extraHeaders={}){
  return new Response(html,{status,headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extraHeaders}});
}
function startPage(){
  return htmlResponse('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebV2 Project Agent Pairing</title></head><body><main><h1>WebV2 Project Agent Pairing</h1><p>Start a one-time project-agent pairing. Opening this page alone does not create anything.</p><form method="post" action="/api/project-agent/pair/start"><button type="submit">Start Pairing</button></form></main></body></html>');
}
function pairingStartedPage(pairingId){
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebV2 Pairing Started</title></head><body><main><h1>Pairing started</h1><p>Pairing ID:</p><code>'+pairingId+'</code><p>Approve this Pairing ID in the WebV2 admin tools, then continue with Finish Pairing.</p><p><a href="/api/project-agent/pair/finish">Finish Pairing</a></p></main></body></html>';
}
function finishPage(pairingId){
  return htmlResponse('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Finish WebV2 Pairing</title></head><body><main><h1>Finish Pairing</h1><p>Pairing ID: <code>'+pairingId+'</code></p><p>Continue only after this Pairing ID has been approved in WebV2.</p><form method="post" action="/api/project-agent/pair/finish"><button type="submit">Finish Pairing</button></form></main></body></html>');
}
function noPairingPage(){
  return htmlResponse('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>No WebV2 Pairing</title></head><body><main><h1>No active pairing</h1><p>Start a new pairing first.</p><p><a href="/api/project-agent/pair/start">Start Pairing</a></p></main></body></html>',400);
}
function completedPage(){
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebV2 Pairing Complete</title></head><body><main><h1>Pairing complete</h1><p>The persistent project-agent session is connected.</p></main></body></html>';
}
function cookieValue(request,name){
  const raw=request.headers.get('cookie')||'';
  for(const part of raw.split(';')){
    const i=part.indexOf('=');
    if(i<0)continue;
    if(part.slice(0,i).trim()===name){
      try{return decodeURIComponent(part.slice(i+1).trim());}catch{return'';}
    }
  }
  return'';
}
function temporaryPairingCookie(pairingId,completionSecret,maxAge=PAIRING_MAX_AGE){
  const value=maxAge>0?encodeURIComponent(pairingId+':'+completionSecret):'';
  return `${PAIRING_COOKIE}=${value}; Max-Age=${Math.max(0,Math.floor(maxAge))}; Path=${FINISH_PATH}; Secure; HttpOnly; SameSite=Strict`;
}
function temporaryPairing(request){
  const value=cookieValue(request,PAIRING_COOKIE);
  const i=value.indexOf(':');
  if(i<=0)return null;
  const pairingId=value.slice(0,i),completionSecret=value.slice(i+1);
  if(!pairingId||!completionSecret)return null;
  return{pairingId,completionSecret};
}
async function startPairingInBrowser(request,env,ctx){
  const response=await registryWorker.fetch(request,env,ctx);
  if(response.status!==201)return response;
  const pairing=await response.json();
  if(!pairing?.pairingId||!pairing?.completionSecret)return htmlResponse('<h1>Pairing start failed</h1>',500);
  return htmlResponse(pairingStartedPage(pairing.pairingId),200,{'set-cookie':temporaryPairingCookie(pairing.pairingId,pairing.completionSecret)});
}
async function finishPairingInBrowser(request,env,ctx){
  const pairing=temporaryPairing(request);
  if(!pairing)return noPairingPage();
  if(request.method==='GET')return finishPage(pairing.pairingId);
  const completionRequest=new Request(new URL('/api/project-agent/pair/complete',request.url),{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(pairing)
  });
  const completed=await registryWorker.fetch(completionRequest,env,ctx);
  if(completed.status!==200)return completed;
  const projectAgentCookie=completed.headers.get('set-cookie')||'';
  if(!projectAgentCookie)return htmlResponse('<h1>Pairing completion failed</h1>',500);
  const headers=new Headers({'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  headers.append('set-cookie',projectAgentCookie);
  headers.append('set-cookie',temporaryPairingCookie('','',0));
  return new Response(completedPage(),{status:200,headers});
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const path=url.pathname.replace(/\/+$/,'');
    if(path===START_PATH&&request.method==='GET')return startPage();
    if(path===START_PATH&&request.method==='POST')return startPairingInBrowser(request,env,ctx);
    if(path===FINISH_PATH&&(request.method==='GET'||request.method==='POST'))return finishPairingInBrowser(request,env,ctx);
    return registryWorker.fetch(request,env,ctx);
  }
};
