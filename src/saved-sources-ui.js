import { cleanUrl, normalizeId } from './core/utils.js?v=20260920-1021';

const STORAGE_KEY = 'webtv_v2_saved_sources';
const BUILD_ID = '20260920-1935';
const $ = id => document.getElementById(id);

const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const channelName = $('channel-name');
const diagSource = $('diag-source');
const diagRoute = $('diag-route');
const diagPlayer = $('diag-player');
const diagStartup = $('diag-startup');
const diagLog = $('diagnostic-log');

if (candidateInput && testButton && channelName) {
  const saveButton = document.createElement('button');
  saveButton.id = 'save-candidate';
  saveButton.type = 'button';
  saveButton.className = 'button';
  saveButton.textContent = 'Save Source';
  saveButton.hidden = true;
  testButton.insertAdjacentElement('afterend', saveButton);

  const status = document.createElement('p');
  status.className = 'muted small';
  status.style.margin = '8px 0 0';
  testButton.closest('.candidate-tester')?.appendChild(status);

  let pending = null;
  let verified = null;
  let saveQueue = Promise.resolve();

  function log(message){if(!diagLog)return;const stamp=new Date().toLocaleTimeString();diagLog.textContent=`[${stamp}] ${message}\n${diagLog.textContent}`.slice(0,18000);}
  function readStore(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch{return{};}}
  function resetVerification(message=''){pending=null;verified=null;saveButton.hidden=true;saveButton.disabled=false;saveButton.textContent='Save Source';status.textContent=message;}
  function beginCandidateTracking(){const url=cleanUrl(candidateInput.value.trim()),name=channelName.textContent.trim();if(!url||!/^https?:\/\//i.test(url)||!name||name==='Επίλεξε κανάλι'){resetVerification();return;}pending={url,channelName:name,channelKey:normalizeId(name),startedAt:Date.now()};verified=null;saveButton.hidden=true;status.textContent='Testing… η πηγή θα αποθηκευτεί αυτόματα μόνο αν ξεκινήσει πραγματικό playback.';}

  async function persistSnapshot(snapshot){
    if(!snapshot)return;
    saveButton.hidden=false;
    saveButton.disabled=true;
    saveButton.textContent='Saving…';
    status.textContent=`Verified ✓ ${snapshot.route||snapshot.player}${snapshot.startupMs?` · ${snapshot.startupMs} ms`:''}. Saving automatically…`;

    const store=readStore(),key=snapshot.channelKey,existing=Array.isArray(store[key])?store[key]:[],withoutSame=existing.filter(item=>cleanUrl(item?.url||item)!==snapshot.url);
    store[key]=[{url:snapshot.url,channelName:snapshot.channelName,verifiedAt:snapshot.verifiedAt,route:snapshot.route,player:snapshot.player,startupMs:snapshot.startupMs},...withoutSame].slice(0,12);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(store));

    let myPlaylistText='';
    try{
      if(window.WebTVMyPlaylistAPI?.addSourceToCurrent){
        await window.WebTVMyPlaylistAPI.addSourceToCurrent(snapshot.url);
        myPlaylistText=' · My Playlist updated';
      }
      saveButton.textContent='Saved ✓';
      status.textContent=`Saved automatically ✓ source pool${myPlaylistText}. If D1 is unlocked, cloud sync is included.`;
      log(`AUTO-SAVED ${snapshot.channelName} · ${snapshot.url} · ${snapshot.route||snapshot.player}${snapshot.startupMs?` · ${snapshot.startupMs} ms`:''}${myPlaylistText}`);
    }catch(error){
      saveButton.disabled=false;
      saveButton.textContent='Retry Save';
      status.textContent=`Playback verified, but My Playlist/D1 save failed: ${error.message}`;
      log(`AUTO-SAVE FAILED ${snapshot.channelName} · ${error.message}`);
      throw error;
    }
  }

  function enqueueVerified(snapshot){
    saveQueue=saveQueue.catch(()=>{}).then(()=>persistSnapshot(snapshot));
    return saveQueue;
  }

  function inspectDiagnostics(){
    if(!pending||verified)return;
    const player=diagPlayer?.textContent?.trim()||'-';
    const source=cleanUrl(diagSource?.textContent?.trim()||'');
    const startupMs=Number.parseInt(diagStartup?.textContent||'',10)||0;
    const route=diagRoute?.textContent?.trim()||'';
    if(player==='-'||player==='failed'||!source||source!==pending.url||startupMs<=0)return;
    verified={...pending,route,player,startupMs,verifiedAt:new Date().toISOString()};
    const snapshot={...verified};
    enqueueVerified(snapshot).catch(()=>{});
  }

  testButton.addEventListener('click',beginCandidateTracking,true);
  candidateInput.addEventListener('input',()=>resetVerification());
  const observer=new MutationObserver(inspectDiagnostics);
  if(diagPlayer)observer.observe(diagPlayer,{childList:true,characterData:true,subtree:true});
  if(diagSource)observer.observe(diagSource,{childList:true,characterData:true,subtree:true});
  if(diagStartup)observer.observe(diagStartup,{childList:true,characterData:true,subtree:true});

  saveButton.addEventListener('click',()=>{if(verified)enqueueVerified({...verified}).catch(()=>{});});
  log(`Saved Sources UI loaded · build ${BUILD_ID} · verified source saves are serialized`);
}
