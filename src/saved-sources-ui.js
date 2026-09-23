import { cleanUrl, normalizeId } from './core/utils.js?v=20260920-1021';
import { saveBestSourceToCurrent } from './source-save-policy.js?v=20260923-0815';

const BUILD_ID = '20260923-0825';
const LEGACY_STORAGE_KEY = 'webtv_v2_saved_sources';
const $ = id => document.getElementById(id);

const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const channelName = $('channel-name');
const playbackStatus = $('playback-status');
const diagSource = $('diag-source');
const diagRoute = $('diag-route');
const diagPlayer = $('diag-player');
const diagStartup = $('diag-startup');
const diagLog = $('diagnostic-log');

try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch {}

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
  let restoreTimer = null;

  function log(message){if(!diagLog)return;const stamp=new Date().toLocaleTimeString();diagLog.textContent=`[${stamp}] ${message}\n${diagLog.textContent}`.slice(0,18000);}
  function resetVerification(message=''){pending=null;verified=null;clearTimeout(restoreTimer);saveButton.hidden=true;saveButton.disabled=false;saveButton.textContent='Save Source';status.textContent=message;}
  function beginCandidateTracking(){
    const url=cleanUrl(candidateInput.value.trim()),name=channelName.textContent.trim();
    if(!url||!/^https?:\/\//i.test(url)||!name||name==='Επίλεξε κανάλι'){resetVerification();return;}
    pending={url,channelName:name,channelKey:normalizeId(name),startedAt:Date.now(),oneClick:window.WebTVSourceHuntBusy===true};
    verified=null;clearTimeout(restoreTimer);saveButton.hidden=true;
    status.textContent=pending.oneClick?'Testing automatically…':'Testing… playback must start before Save Source is enabled.';
  }
  function restoreSelectedPlayback(){
    const active=document.querySelector('.channel-item.active');
    if(!active)return;
    clearTimeout(restoreTimer);
    restoreTimer=setTimeout(()=>{
      active.click();
      log('CANDIDATE FAILED · restored selected channel playback');
    },250);
  }

  async function persistSnapshot(snapshot){
    if(!snapshot)return;
    saveButton.hidden=false;saveButton.disabled=true;saveButton.textContent='Saving…';
    status.textContent=`Verified ✓ ${snapshot.route||snapshot.player}${snapshot.startupMs?` · ${snapshot.startupMs} ms`:''}. Keeping best sources…`;
    try{
      const result=await saveBestSourceToCurrent(snapshot.url,{maxSources:3});
      saveButton.textContent='Saved ✓';
      status.textContent=`Saved ✓ best source kept · ${result.kept.length}/3 curated source${result.kept.length===1?'':'s'} in D1.`;
      log(`SOURCE SAVED POLICY ${snapshot.channelName} · winner ${snapshot.url} · kept ${result.kept.length} · dropped ${result.dropped.length}`);
      return result;
    }catch(error){
      saveButton.disabled=false;saveButton.textContent='Retry Save';
      status.textContent=`Playback verified, but D1 save failed: ${error.message}`;
      log(`SOURCE SAVE POLICY FAILED ${snapshot.channelName} · ${error.message}`);
      throw error;
    }
  }
  function enqueueVerified(snapshot){saveQueue=saveQueue.catch(()=>{}).then(()=>persistSnapshot(snapshot));return saveQueue;}

  function inspectDiagnostics(){
    if(!pending||verified)return;
    const player=diagPlayer?.textContent?.trim()||'-';
    const source=cleanUrl(diagSource?.textContent?.trim()||'');
    const startupMs=Number.parseInt(diagStartup?.textContent||'',10)||0;
    const route=diagRoute?.textContent?.trim()||'';
    if(!source||source!==pending.url)return;

    if(player!=='-'&&player!=='failed'&&startupMs>0&&playbackStatus?.classList.contains('live')){
      verified={...pending,route,player,startupMs,verifiedAt:new Date().toISOString()};
      saveButton.hidden=pending.oneClick;
      saveButton.disabled=false;
      status.textContent=pending.oneClick?`Verified ✓ ${startupMs} ms · selecting as best source…`:`Verified ✓ ${startupMs} ms. Click Save Source to keep it.`;
      log(`CANDIDATE VERIFIED ${pending.channelName} · ${pending.url} · ${route||player} · ${startupMs} ms`);
      return;
    }

    if(player==='failed'&&playbackStatus?.classList.contains('error')){
      const failed={...pending};
      pending=null;
      saveButton.hidden=true;
      status.textContent=failed.oneClick?'Candidate failed · trying next…':'Candidate failed · restoring previous working playback…';
      if(!failed.oneClick)restoreSelectedPlayback();
    }
  }

  testButton.addEventListener('click',beginCandidateTracking,true);
  candidateInput.addEventListener('input',()=>resetVerification());
  const observer=new MutationObserver(inspectDiagnostics);
  if(diagPlayer)observer.observe(diagPlayer,{childList:true,characterData:true,subtree:true});
  if(diagSource)observer.observe(diagSource,{childList:true,characterData:true,subtree:true});
  if(diagStartup)observer.observe(diagStartup,{childList:true,characterData:true,subtree:true});
  if(playbackStatus)observer.observe(playbackStatus,{childList:true,characterData:true,subtree:true,attributes:true});

  window.addEventListener('webtv:source-policy-saved',event=>{
    const detail=event.detail||{};
    if(verified&&cleanUrl(detail.winner||'')===cleanUrl(verified.url)){
      saveButton.hidden=true;
      status.textContent=`Saved ✓ best source kept · ${(detail.kept||[]).length}/3 curated sources in D1.`;
    }
  });
  saveButton.addEventListener('click',()=>{if(verified)enqueueVerified({...verified}).catch(()=>{});});
  log(`Saved Sources UI loaded · build ${BUILD_ID} · manual test requires explicit save`);
}
