import registryWorker from './webtv-registry.js';

const START_PATH='/api/project-agent/pair/start';
const FINISH_PATH='/api/project-agent/pair/finish';
const CURRENT_PATH='/api/project-agent/checkpoints/WEBV2_CURRENT.md';
const CURRENT_EDIT_PATH='/api/project-agent/checkpoints/WEBV2_CURRENT.md/edit';
const PAIRING_COOKIE='webv2_project_agent_pairing';
const PAIRING_MAX_AGE=5*60;

function htmlResponse(html,status=200,extraHeaders={}){
  return new Response(html,{status,headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extraHeaders}});
}
function escHtml(value=''){
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function startPage(){
  return htmlResponse('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebV2 Project Agent Pairing</title></head><body><main><h1>WebV2 Project Agent Pairing</h1><p>Start a one-time project-agent pairing. Opening this page alone does not create anything.</p><form method="post" action="/api/project-agent/pair/start"><button type="submit">Start Pairing</button></form></main></body></html>');
}
function formatResumeToken(resumeToken=''){
  const token=String(resumeToken||'').trim();
  const split=Math.ceil(token.length/2);
  return token.slice(0,split)+'.'+token.slice(split);
}
function pairingStartedPage(pairingId,resumeToken){
  const portableToken=formatResumeToken(resumeToken);
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebV2 Pairing Started</title></head><body><main><h1>Pairing started</h1><p>Pairing ID:</p><code>'+escHtml(pairingId)+'</code><p>One-time resume token:</p><code>'+escHtml(portableToken)+'</code><p>Approve this Pairing ID in the WebV2 admin tools. This page will finish automatically as soon as approval is available.</p><p id="pairing-status">Waiting for approval…</p><form method="post" action="/api/project-agent/pair/finish"><input type="hidden" name="pairingId" value="'+escHtml(pairingId)+'"><input type="hidden" name="resumeToken" value="'+escHtml(portableToken)+'"><button type="submit">Finish Pairing</button></form><script>(function(){let busy=false;const status=document.getElementById("pairing-status");const tick=async()=>{if(busy)return;busy=true;try{const response=await fetch(FINISH_PATH,{method:"POST"});if(response.ok){status.textContent="Pairing complete. Opening canonical state…";location.assign(CURRENT_EDIT_PATH);return;}status.textContent="Waiting for approval…";}catch{status.textContent="Waiting for approval…";}finally{busy=false;}};setInterval(tick,2000);setTimeout(tick,250);})();</script></main></body></html>';
}
function finishPage(pairingId){
  return htmlResponse('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Finish WebV2 Pairing</title></head><body><main><h1>Finish Pairing</h1><p>Pairing ID: <code>'+escHtml(pairingId)+'</code></p><p>Continue only after this Pairing ID has been approved in WebV2.</p><form method="post" action="/api/project-agent/pair/finish"><button type="submit">Finish Pairing</button></form></main></body></html>');
}
function noPairingPage(){
  return htmlResponse('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>No WebV2 Pairing</title></head><body><main><h1>No active pairing cookie</h1><p>Use the Pairing ID and one-time resume token from the Start Pairing page, or start a new pairing.</p><form method="post" action="/api/project-agent/pair/finish"><p><label>Pairing ID <input name="pairingId" autocomplete="off"></label></p><p><label>Resume token <input name="resumeToken" autocomplete="off"></label></p><button type="submit">Finish Pairing</button></form><p><a href="/api/project-agent/pair/start">Start Pairing</a></p></main></body></html>',400);
}
function completedPage(){
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebV2 Pairing Complete</title></head><body><main><h1>Pairing complete</h1><p>The persistent project-agent session is connected.</p></main></body></html>';
}
function currentEditorPage(content='',expectedSha256='',savedSha256=''){
  const saved=savedSha256?`<p><strong>Saved.</strong> SHA-256: <code>${escHtml(savedSha256)}</code></p>`:'';
  return htmlResponse(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Edit WEBV2_CURRENT.md</title></head><body><main><h1>WEBV2_CURRENT.md</h1>${saved}<form method="post" action="${CURRENT_EDIT_PATH}"><input type="hidden" name="expectedSha256" value="${escHtml(expectedSha256)}"><textarea name="content" rows="40" cols="120">${escHtml(content)}</textarea><p><button type="submit">Save canonical state</button></p></form></main></body></html>`);
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
async function portablePairing(request){
  if(request.method!=='POST')return null;
  const form=await request.formData();
  const pairingId=String(form.get('pairingId')||'').trim();
  const resumeToken=String(form.get('resumeToken')||'').trim().replace(/\./g,'');
  if(!pairingId||!resumeToken)return null;
  return{pairingId,completionSecret:resumeToken};
}
function projectAgentRequest(request,path,init={}){
  const headers=new Headers(init.headers||{});
  const cookie=request.headers.get('cookie')||'';
  if(cookie)headers.set('cookie',cookie);
  return new Request(new URL(path,request.url),{...init,headers});
}
async function startPairingInBrowser(request,env,ctx){
  const response=await registryWorker.fetch(request,env,ctx);
  if(response.status!==201)return response;
  const pairing=await response.json();
  if(!pairing?.pairingId||!pairing?.completionSecret)return htmlResponse('<h1>Pairing start failed</h1>',500);
  const resumeToken=pairing.completionSecret;
  return htmlResponse(pairingStartedPage(pairing.pairingId,resumeToken),200,{'set-cookie':temporaryPairingCookie(pairing.pairingId,pairing.completionSecret)});
}
async function finishPairingInBrowser(request,env,ctx){
  let pairing=temporaryPairing(request)||null;
  if(!pairing&&request.method==='POST')pairing=await portablePairing(request);
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
async function currentEditor(request,env,ctx){
  const session=await registryWorker.fetch(projectAgentRequest(request,'/api/project-agent/session'),env,ctx);
  if(session.status!==200)return session;
  if(request.method==='GET'){
    const current=await registryWorker.fetch(projectAgentRequest(request,CURRENT_PATH),env,ctx);
    if(current.status===404)return currentEditorPage('','');
    if(current.status!==200)return current;
    return currentEditorPage(await current.text(),current.headers.get('x-checkpoint-sha256')||'');
  }
  const form=await request.formData();
  const content=String(form.get('content')||'');
  const expectedSha256=String(form.get('expectedSha256')||'').trim();
  const payload={content};
  if(expectedSha256)payload.expectedSha256=expectedSha256;
  const saved=await registryWorker.fetch(projectAgentRequest(request,CURRENT_PATH,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),env,ctx);
  if(saved.status!==200&&saved.status!==201)return saved;
  const result=await saved.json();
  const sha=result?.checkpoint?.sha256||'';
  return currentEditorPage(content,sha,sha);
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const path=url.pathname.replace(/\/+$/,'');
    if(path===START_PATH&&request.method==='GET')return startPage();
    if(path===START_PATH&&request.method==='POST')return startPairingInBrowser(request,env,ctx);
    if(path===FINISH_PATH&&(request.method==='GET'||request.method==='POST'))return finishPairingInBrowser(request,env,ctx);
    if(path===CURRENT_EDIT_PATH&&(request.method==='GET'||request.method==='POST'))return currentEditor(request,env,ctx);
    return registryWorker.fetch(request,env,ctx);
  }
};
