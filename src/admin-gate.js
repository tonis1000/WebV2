
const root=document.documentElement;
const trigger=document.getElementById('admin-unlock-trigger');
let unlocking=false;
const SPORT_RETURN_KEY='webtv_v2_sport_return_unlocked';

function clearSportReturn(){
  try{sessionStorage.removeItem(SPORT_RETURN_KEY);}catch{}
}

async function sessionFingerprint(token){
  if(!token)return '';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function setUnlocked(unlocked){
  root.classList.toggle('admin-locked',!unlocked);
  root.classList.toggle('admin-unlocked',unlocked);
  trigger?.setAttribute('aria-expanded',String(unlocked));
  trigger?.setAttribute('aria-label',unlocked?"Lock TONI'S WEBTV controls":"Unlock TONI'S WEBTV controls");
  if(!unlocked){
    clearSportReturn();
    for(const id of ['playlist-manager','source-hunt','diagnostics','source-editor-overlay','unified-search-panel','epg-guide-overlay','epg-program-dialog']){
      const panel=document.getElementById(id);if(panel)panel.hidden=true;
    }
  }
  window.dispatchEvent(new CustomEvent('webtv:admin-visibility',{detail:{unlocked}}));
}

trigger?.addEventListener('click',async()=>{
  if(unlocking)return;
  if(root.classList.contains('admin-unlocked')){setUnlocked(false);return;}
  // The PIN is verified by the Registry Worker; its value is never present in this repository.
  const pin=window.prompt('TONI’S WEBTV · βάλε το υπάρχον 6-digit PIN για τα εργαλεία διαχείρισης.');
  if(pin===null)return;
  unlocking=true;
  try{
    await window.WebTVRegistryAuth.login(pin.trim());
    setUnlocked(true);
  }catch(error){
    window.alert(`Δεν ξεκλειδώθηκε: ${error.message}`);
  }finally{unlocking=false;}
});

const sport=document.getElementById('sport-toggle');
sport?.addEventListener('click',async event=>{
  if(event.defaultPrevented||event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  clearSportReturn();
  try{
    if(root.classList.contains('admin-unlocked')){
      const token=window.WebTVRegistryAuth?.token?.();
      const fingerprint=await sessionFingerprint(token);
      if(fingerprint&&root.classList.contains('admin-unlocked')&&window.WebTVRegistryAuth?.token?.()===token)sessionStorage.setItem(SPORT_RETURN_KEY,fingerprint);
    }
  }catch{}
  location.assign(sport.href);
});

// Only a same-tab SPORT return may restore an explicit UI unlock, and only
// after the canonical auth owner confirms the existing Registry session.
let restoreSportReturn='';
try{
  if(new URLSearchParams(location.search).get('from')==='sport')restoreSportReturn=sessionStorage.getItem(SPORT_RETURN_KEY)||'';
  sessionStorage.removeItem(SPORT_RETURN_KEY);
}catch{}
setUnlocked(false);
if(restoreSportReturn){
  unlocking=true;
  Promise.resolve().then(async()=>{
    const auth=window.WebTVRegistryAuth;
    const existingToken=auth?.token?.();
    if(!existingToken||await sessionFingerprint(existingToken)!==restoreSportReturn)return false;
    const valid=await auth.validateSession();
    return valid&&auth.token()===existingToken;
  })
    .then(valid=>{if(valid)setUnlocked(true);})
    .catch(()=>{})
    .finally(()=>{unlocking=false;});
}
