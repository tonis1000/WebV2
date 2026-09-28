const root=document.documentElement;
const trigger=document.getElementById('admin-unlock-trigger');
let unlocking=false;

function setUnlocked(unlocked){
  root.classList.toggle('admin-locked',!unlocked);
  root.classList.toggle('admin-unlocked',unlocked);
  trigger?.setAttribute('aria-expanded',String(unlocked));
  trigger?.setAttribute('aria-label',unlocked?"Lock TONI'S WEBTV controls":"Unlock TONI'S WEBTV controls");
  if(!unlocked){
    for(const id of ['playlist-manager','source-hunt','diagnostics','source-editor-overlay']){
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

// Refresh always starts with the administration UI closed, even on a trusted device.
setUnlocked(false);
