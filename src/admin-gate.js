
const root=document.documentElement;
const trigger=document.getElementById('admin-unlock-trigger');
let unlocking=false;
const SPORT_RETURN_KEY='webtv_v2_sport_return_unlocked';

function rememberSportReturn(unlocked){
  try{if(unlocked)sessionStorage.setItem(SPORT_RETURN_KEY,'1');else sessionStorage.removeItem(SPORT_RETURN_KEY);}catch{}
}

function setUnlocked(unlocked){
  root.classList.toggle('admin-locked',!unlocked);
  root.classList.toggle('admin-unlocked',unlocked);
  trigger?.setAttribute('aria-expanded',String(unlocked));
  trigger?.setAttribute('aria-label',unlocked?"Lock TONI'S WEBTV controls":"Unlock TONI'S WEBTV controls");
  if(!unlocked){
    rememberSportReturn(false);
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

document.getElementById('sport-toggle')?.addEventListener('click',()=>{
  rememberSportReturn(root.classList.contains('admin-unlocked'));
});

// Only a same-tab SPORT return may restore an explicit UI unlock, and only
// after the canonical auth owner confirms the existing Registry session.
let restoreSportReturn=false;
try{
  restoreSportReturn=new URLSearchParams(location.search).get('from')==='sport'&&sessionStorage.getItem(SPORT_RETURN_KEY)==='1';
  sessionStorage.removeItem(SPORT_RETURN_KEY);
}catch{}
setUnlocked(false);
if(restoreSportReturn){
  unlocking=true;
  Promise.resolve().then(()=>window.WebTVRegistryAuth?.validateSession())
    .then(valid=>{if(valid)setUnlocked(true);})
    .catch(()=>{})
    .finally(()=>{unlocking=false;});
}
