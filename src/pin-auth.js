const BUILD_ID='20260922-0718';
const DEFAULT_REGISTRY='https://webtv-registry.atonis.workers.dev';
const URL_KEY='webtv_v2_registry_url';
const TOKEN_KEY='webtv_v2_registry_token';
const TRUST_KEY='webtv_v2_trusted_device';

if(!(localStorage.getItem(URL_KEY)||'').trim())localStorage.setItem(URL_KEY,DEFAULT_REGISTRY);

function base(){return(localStorage.getItem(URL_KEY)||DEFAULT_REGISTRY).trim().replace(/\/$/,'');}
function session(){return localStorage.getItem(TOKEN_KEY)||'';}
function setStatus(text,tone='idle'){const el=document.getElementById('playlist-manager-status');if(el){el.textContent=text;el.dataset.tone=tone;}}
function setState(text,online='0'){const el=document.getElementById('registry-state');if(el){el.textContent=text;el.dataset.online=online;}}
async function request(path,options={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);try{return await fetch(`${base()}${path}`,{cache:'no-store',signal:c.signal,...options});}finally{clearTimeout(t);}}

async function validateSession(){
  const token=session();
  if(!token)return false;
  try{
    const r=await request('/api/session',{headers:{authorization:`Bearer ${token}`}});
    if(r.ok){localStorage.setItem(TRUST_KEY,'1');setState('Trusted device ✓','1');return true;}
  }catch{}
  localStorage.removeItem(TOKEN_KEY);
  setState('Read only');
  return false;
}

async function login(pin){
  if(!/^\d{6}$/.test(pin))throw new Error('Το PIN πρέπει να έχει ακριβώς 6 αριθμούς');
  const r=await request('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin})});
  let j={};try{j=await r.json();}catch{}
  if(!r.ok)throw new Error(j.error||`Login HTTP ${r.status}`);
  if(!j.token)throw new Error('Ο Worker δεν επέστρεψε session');
  localStorage.setItem(TOKEN_KEY,j.token);
  localStorage.setItem(TRUST_KEY,'1');
  setState(`Trusted device ✓ · ${j.days||30}d`,'1');
  return j;
}

async function ensureSession({interactive=true}={}){
  if(await validateSession())return true;
  if(!interactive)return false;
  const pin=window.prompt('D1 write access · βάλε το 6-digit PIN μία φορά για να γίνει trusted αυτή η συσκευή.');
  if(pin===null)return false;
  try{
    setStatus('Unlocking trusted device…','busy');
    const j=await login(String(pin).replace(/\D/g,'').slice(0,6));
    setStatus(`Trusted device enabled · ${j.days||30} days`,'ok');
    return true;
  }catch(error){
    setStatus(error.message,'error');
    throw error;
  }
}

function logout(){
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TRUST_KEY);
  setState('Read only');
}

function hideLegacyPanel(){
  if(document.getElementById('trusted-device-style'))return;
  const style=document.createElement('style');
  style.id='trusted-device-style';
  style.textContent='.cloud-library{display:none!important}';
  document.head.appendChild(style);
}

const WRITE_IDS=new Set(['playlist-save-url','playlist-save-paste','my-playlist-channel-action','save-candidate']);
const WRITE_LABELS=new Set(['Rename','Delete','Edit','Remove','Retry Save','Save Source','★ Add to My Playlist','Remove from My Playlist']);
function isWriteButton(button){
  if(!button)return false;
  if(WRITE_IDS.has(button.id))return true;
  return WRITE_LABELS.has((button.textContent||'').trim());
}

let replaying=false;
document.addEventListener('click',event=>{
  if(replaying)return;
  const button=event.target.closest('button');
  if(!isWriteButton(button))return;
  if(session())return;
  event.preventDefault();
  event.stopImmediatePropagation();
  ensureSession({interactive:true}).then(ok=>{
    if(!ok)return;
    replaying=true;
    try{button.click();}finally{queueMicrotask(()=>{replaying=false;});}
  }).catch(()=>{});
},true);

function wrapMyPlaylistApi(){
  const api=window.WebTVMyPlaylistAPI;
  if(!api||api.__trustedDeviceWrapped)return false;
  if(typeof api.addSourceToCurrent==='function'){
    const original=api.addSourceToCurrent.bind(api);
    api.addSourceToCurrent=async(...args)=>{
      if(!session())await ensureSession({interactive:true});
      return original(...args);
    };
  }
  api.__trustedDeviceWrapped=true;
  return true;
}

hideLegacyPanel();
validateSession().catch(()=>{});
if(!wrapMyPlaylistApi()){
  const observer=new MutationObserver(()=>{if(wrapMyPlaylistApi())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}

window.WebTVRegistryAuth={ensureSession,validateSession,login,logout,token:session,base};
console.info(`[WebTV] Trusted device auth loaded · build ${BUILD_ID}`);
