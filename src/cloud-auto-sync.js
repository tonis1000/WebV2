const BUILD_ID='20260920-2358';
const URL_KEY='webtv_v2_registry_url';
const TOKEN_KEY='webtv_v2_registry_token';
const $=id=>document.getElementById(id);

let armed=false;
let timer=null;
let syncing=false;
let lastSyncAt=0;

function configured(){return !!((localStorage.getItem(URL_KEY)||'').trim()&&(localStorage.getItem(TOKEN_KEY)||'').trim());}
function setCloudState(text,online='1'){const el=$('registry-state');if(!el)return;el.textContent=text;el.dataset.online=online;}
function schedule(reason='change'){
  if(!armed||!configured()||syncing)return;
  clearTimeout(timer);
  timer=setTimeout(()=>sync(reason),1400);
}
async function sync(reason){
  if(syncing||!configured())return;
  const push=$('registry-sync-up');
  if(!push)return;
  syncing=true;
  setCloudState('Auto syncing…','1');
  try{
    push.click();
    lastSyncAt=Date.now();
    setTimeout(()=>{
      const state=$('registry-state');
      if(state&&configured())setCloudState('Auto sync ✓','1');
    },1800);
    console.info(`[WebTV] Auto cloud sync · ${reason}`);
  }finally{
    setTimeout(()=>{syncing=false;},2200);
  }
}

function attach(){
  const my=$('my-playlist-channels');
  const saved=$('saved-playlists');
  if(!my||!saved)return false;
  const observer=new MutationObserver(mutations=>{
    if(!armed)return;
    if(mutations.some(m=>m.type==='childList'))schedule('library changed');
  });
  observer.observe(my,{childList:true,subtree:true});
  observer.observe(saved,{childList:true,subtree:true});

  // Saving a new playlist or an imported source can finish before a DOM mutation is visible.
  for(const id of ['playlist-save-url','playlist-save-paste']){
    $(id)?.addEventListener('click',()=>setTimeout(()=>schedule('playlist saved'),900));
  }

  // Existing session is reused automatically. Startup pull gets time to finish first.
  setTimeout(()=>{
    armed=true;
    if(configured()){
      setCloudState('Auto sync on','1');
      schedule('startup reconcile');
    }
  },6500);
  return true;
}

if(!attach()){
  const wait=new MutationObserver(()=>{if(attach())wait.disconnect();});
  wait.observe(document.documentElement,{childList:true,subtree:true});
}

window.addEventListener('storage',event=>{
  if(event.key===TOKEN_KEY||event.key===URL_KEY){
    if(configured()){setCloudState('Auto sync on','1');schedule('cloud settings changed');}
  }
});

console.info(`[WebTV] Cloud auto sync loaded · build ${BUILD_ID}`);
