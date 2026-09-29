const BUILD_ID='20260929-project-agent-pairing';
const PANEL_ID='project-agent-pairing-admin';

function ensurePanel(){
  let panel=document.getElementById(PANEL_ID);
  if(panel)return panel;
  panel=document.createElement('section');
  panel.id=PANEL_ID;
  panel.hidden=true;
  panel.setAttribute('aria-label','Project Agent Pairing');
  panel.style.cssText='position:fixed;right:16px;bottom:16px;z-index:10050;max-width:360px;padding:12px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:#11151b;box-shadow:0 12px 36px rgba(0,0,0,.4);font:inherit;color:inherit';
  panel.innerHTML='<strong>Project Agent Pairing</strong><p class="muted small" style="margin:6px 0 10px">Approve a pairing ID only when you started this connection yourself.</p><div style="display:flex;gap:8px"><input id="project-agent-pairing-id" type="text" autocomplete="off" spellcheck="false" placeholder="Pairing ID" style="min-width:0;flex:1"><button id="project-agent-pairing-approve" class="button" type="button">Approve</button></div><p id="project-agent-pairing-status" class="muted small" style="margin:8px 0 0">Ready</p>';
  document.body.appendChild(panel);
  panel.querySelector('#project-agent-pairing-approve')?.addEventListener('click',async()=>{
    const input=panel.querySelector('#project-agent-pairing-id');
    const status=panel.querySelector('#project-agent-pairing-status');
    const pairingId=String(input?.value||'').trim();
    if(!pairingId){if(status)status.textContent='Pairing ID required.';return;}
    if(status)status.textContent='Approving…';
    try{
      await approve(pairingId);
      if(status)status.textContent='Approved. The project agent can now complete pairing.';
      if(input)input.value='';
    }catch(error){if(status)status.textContent=error?.message||String(error);}
  });
  return panel;
}

function setVisible(unlocked){ensurePanel().hidden=!unlocked;}

async function approve(pairingId){
  const id=String(pairingId||'').trim();
  if(!id)throw new Error('Pairing ID required');
  if(!window.WebTVRegistryAuth)throw new Error('Registry authentication is not ready');
  const ok=await window.WebTVRegistryAuth.ensureSession({interactive:true});
  if(!ok)throw new Error('Admin authentication required');
  const token=window.WebTVRegistryAuth.token();
  const registry=window.WebTVRegistryAuth.base();
  if(!token)throw new Error('Admin session unavailable');
  const response=await fetch(`${registry}/api/project-agent/pair/approve`,{
    method:'POST',
    cache:'no-store',
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify({pairingId:id}),
  });
  let payload={};try{payload=await response.json();}catch{}
  if(!response.ok)throw new Error(payload.error||`Pairing approval HTTP ${response.status}`);
  return payload;
}

window.addEventListener('webtv:admin-visibility',event=>setVisible(Boolean(event.detail?.unlocked)));
setVisible(document.documentElement.classList.contains('admin-unlocked'));
window.WebTVProjectAgentPairingAdmin={approve};
console.info(`[WebTV] Project agent pairing admin loaded · build ${BUILD_ID}`);
