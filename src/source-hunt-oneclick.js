import { saveBestSourceToCurrent } from './source-save-policy.js';
import { officialFallbackFor } from './core/official-fallbacks.js';

const BUILD_ID = '20260924-stabilization';
const $ = id => document.getElementById(id);

const panel = $('source-hunt');
const diagLog = $('diagnostic-log');

function log(message){
  if(!diagLog) return;
  const stamp = new Date().toLocaleTimeString();
  diagLog.textContent = `[${stamp}] ${message}\n${diagLog.textContent}`.slice(0, 18000);
}
function clean(value=''){return String(value || '').split('#')[0].trim();}
function selectedChannel(){return window.WebTVPlaylistAPI?.getSelectedChannel?.() || null;}
function currentOfficialFallback(){const selected=selectedChannel();return selected ? officialFallbackFor(selected) : null;}
function playbackApi(){return window.WebTVPlaybackAPI || null;}

function directCandidateTester(){
  if(!panel) return null;
  return [...panel.children].find(node=>node.classList?.contains('candidate-tester')) || null;
}
function ensureAdvancedUi(){
  if(!panel) return;
  let details=$('hunt-advanced');
  if(!details){
    details=document.createElement('details');
    details.id='hunt-advanced';
    details.className='hunt-advanced';
    const summary=document.createElement('summary');
    summary.textContent='Advanced stream results';
    const hint=document.createElement('span');
    hint.className='muted small';
    hint.textContent='Seeds, GitHub, Web, Forums and manual stream candidate lists';
    details.append(summary,hint);
    const tester=directCandidateTester();
    if(tester && tester.parentElement===panel) panel.insertBefore(details,tester);
    else panel.appendChild(details);
  }
  for(const id of ['hunt-auto','hunt-external']){
    const node=$(id);
    if(node && node!==details && node.parentElement!==details) details.appendChild(node);
  }
}
function ensureUi(){
  const runHuntButton = $('run-hunt');
  if(!panel || !runHuntButton) return false;
  if(!$('hunt-oneclick')){
    const heading = panel.querySelector('.section-heading');
    if(!heading) return false;
    const wrap = document.createElement('div');
    wrap.className = 'hunt-oneclick-wrap';
    wrap.innerHTML = `
      <button id="hunt-oneclick" class="button hunt-primary" type="button">Find & Test Best</button>
      <span id="hunt-oneclick-status" class="hunt-oneclick-status">Ready · streams first · official fallback last</span>`;
    heading.appendChild(wrap);
  }
  ensureAdvancedUi();
  const button = $('hunt-oneclick');
  if(button && button.dataset.oneclickBound !== '1'){
    button.dataset.oneclickBound = '1';
    button.addEventListener('click', runOneClick);
  }
  return true;
}
function collectCandidateUrls(){
  const selectors=['#hunt-results code','#hunt-seed-results code','#hunt-web-results code','#hunt-forum-results code'];
  const seen=new Set(),urls=[];
  for(const selector of selectors){
    for(const node of document.querySelectorAll(selector)){
      const url=clean(node.textContent);
      if(!/^https?:\/\//i.test(url)||seen.has(url))continue;
      seen.add(url);urls.push(url);
    }
  }
  return urls;
}
function waitForDiscovery({maxMs=32000,quietMs=1800,minMs=4500}={}){
  return new Promise(resolve=>{
    const roots=[$('hunt-auto'),$('hunt-external')].filter(Boolean);
    const startedAt=Date.now();let quietTimer=null,done=false;
    const finish=()=>{if(done)return;done=true;clearTimeout(quietTimer);clearTimeout(maxTimer);observer.disconnect();resolve(collectCandidateUrls());};
    const schedule=()=>{clearTimeout(quietTimer);quietTimer=setTimeout(()=>{const elapsed=Date.now()-startedAt,urls=collectCandidateUrls();if(urls.length&&elapsed>=minMs)finish();else if(urls.length)quietTimer=setTimeout(finish,Math.max(0,minMs-elapsed));},quietMs);};
    const observer=new MutationObserver(schedule);roots.forEach(root=>observer.observe(root,{childList:true,subtree:true,characterData:true}));
    const maxTimer=setTimeout(finish,maxMs);schedule();
  });
}
async function restoreSelectedPlayback(){
  const api=playbackApi();
  if(api?.replaySelected) return api.replaySelected();
  return null;
}
function useOfficialFallback(status,channelName,reason){
  const fallback=currentOfficialFallback();
  if(!fallback)return false;
  status.textContent=`${reason} · ${fallback.label || 'Official fallback'}`;
  log(`ONE-CLICK FALLBACK ${channelName} · ${reason} · ${fallback.route || 'official-fallback'} · not saved to D1`);
  restoreSelectedPlayback().catch(error=>log(`ONE-CLICK FALLBACK restore failed · ${error.message}`));
  return true;
}
async function runOneClick(){
  const runHuntButton=$('run-hunt'),button=$('hunt-oneclick'),status=$('hunt-oneclick-status');
  const selected=selectedChannel();
  const channelName=selected?.name || '';
  const api=playbackApi();
  if(!button||!status||!runHuntButton)return;
  if(!selected){status.textContent='Select a channel first';return;}
  if(!api?.testCandidate){status.textContent='Playback API unavailable';return;}

  button.disabled=true;window.WebTVSourceHuntBusy=true;
  status.textContent=`Searching ${channelName}…`;log(`ONE-CLICK HUNT START ${channelName} · stream candidates first`);
  try{
    document.querySelectorAll('#hunt-results,#hunt-seed-results,#hunt-web-results,#hunt-forum-results').forEach(el=>{el.innerHTML='';});
    runHuntButton.click();
    const urls=await waitForDiscovery();
    if(!urls.length){
      if(useOfficialFallback(status,channelName,'No fresh stream candidate'))return;
      status.textContent='No fresh stream candidates · check Official Fallback Discovery';
      log(`ONE-CLICK HUNT ${channelName} · no stream candidates · no verified official fallback`);
      return;
    }

    status.textContent=`${urls.length} stream candidates · testing…`;
    const limit=Math.min(urls.length,8);
    for(let i=0;i<limit;i++){
      const url=urls[i];
      status.textContent=`Testing stream ${i+1}/${limit}`;
      log(`ONE-CLICK TEST ${channelName} · ${i+1}/${limit} · ${url}`);
      let result=null;
      try{
        result=await api.testCandidate(url,{channel:selected});
      }catch(error){
        log(`ONE-CLICK TEST FAILED ${channelName} · ${url} · ${error.message}`);
        continue;
      }
      if(!result?.ok || result?.fallback)continue;

      status.textContent=`Working stream ✓ ${result.startupMs||0} ms · saving best…`;
      try{
        const saved=await saveBestSourceToCurrent(url,{maxSources:3});
        status.textContent=`Best stream saved ✓ · ${saved.kept.length}/3 kept`;
        log(`ONE-CLICK SUCCESS ${channelName} · winner ${url} · ${result.startupMs||0} ms · kept ${saved.kept.length} · dropped ${saved.dropped.length}`);
      }catch(error){
        status.textContent=`Working stream ✓ ${result.startupMs||0} ms · save failed`;
        log(`ONE-CLICK SAVE FAILED ${channelName} · ${url} · ${error.message}`);
      }
      return;
    }

    if(useOfficialFallback(status,channelName,`No working stream in first ${limit}`))return;
    status.textContent=`No working stream in first ${limit} · restored`;
    log(`ONE-CLICK DONE ${channelName} · no working stream candidate in ${limit} · no verified official fallback`);
    await restoreSelectedPlayback();
  }catch(error){
    if(useOfficialFallback(status,channelName,`Stream hunt failed: ${error.message}`))return;
    status.textContent=`Failed · ${error.message}`;
    log(`ONE-CLICK ERROR ${channelName} · ${error.message}`);
    await restoreSelectedPlayback().catch(()=>{});
  }finally{
    window.WebTVSourceHuntBusy=false;button.disabled=false;
  }
}

if(!ensureUi()){
  const observer=new MutationObserver(()=>{if(ensureUi())observer.disconnect();});
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>{ensureUi();observer.disconnect();},5000);
}
window.addEventListener('webtv:ready',ensureUi);
console.info(`[WebTV] One-click Source Hunt loaded · build ${BUILD_ID} · direct playback API · stream-first · verified official fallback last`);
