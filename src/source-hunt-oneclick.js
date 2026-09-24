import { saveBestSourceToCurrent } from './source-save-policy.js?v=20260923-0815';
import { officialFallbackFor } from './core/official-fallbacks.js?v=20260924-1435';

const BUILD_ID = '20260924-1435';
const $ = id => document.getElementById(id);

const panel = $('source-hunt');
const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const diagSource = $('diag-source');
const diagPlayer = $('diag-player');
const diagStartup = $('diag-startup');
const playbackStatus = $('playback-status');
const diagLog = $('diagnostic-log');

function log(message){
  if(!diagLog) return;
  const stamp = new Date().toLocaleTimeString();
  diagLog.textContent = `[${stamp}] ${message}\n${diagLog.textContent}`.slice(0, 18000);
}
function clean(value=''){return String(value || '').split('#')[0].trim();}
function selectedChannel(){return window.WebTVPlaylistAPI?.getSelectedChannel?.() || null;}
function currentOfficialFallback(){const selected=selectedChannel();return selected ? officialFallbackFor(selected) : null;}

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
function waitForPlayback(url,timeoutMs=15000){
  return new Promise(resolve=>{
    let done=false;
    const finish=result=>{if(done)return;done=true;clearTimeout(timer);observer.disconnect();resolve(result);};
    const inspect=()=>{
      const source=clean(diagSource?.textContent||'');
      const player=(diagPlayer?.textContent||'').trim();
      const startup=Number.parseInt(diagStartup?.textContent||'',10)||0;
      const live=playbackStatus?.classList.contains('live');
      const error=playbackStatus?.classList.contains('error');
      if(source===url&&player&&player!=='-'&&player!=='failed'&&startup>0&&live)finish({ok:true,startup,player});
      if(source===url&&player==='failed'&&error)finish({ok:false,startup:0,player:'failed'});
    };
    const observer=new MutationObserver(inspect);
    [diagSource,diagPlayer,diagStartup,playbackStatus].filter(Boolean).forEach(node=>observer.observe(node,{childList:true,characterData:true,subtree:true,attributes:true}));
    const timer=setTimeout(()=>finish({ok:false,startup:0,player:'timeout'}),timeoutMs);inspect();
  });
}
function restoreSelectedPlayback(){
  document.querySelector('.channel-item.active')?.click();
}
function useOfficialFallback(status,channelName,reason){
  const fallback=currentOfficialFallback();
  if(!fallback)return false;
  status.textContent=`${reason} · ${fallback.label || 'Official fallback'}`;
  log(`ONE-CLICK FALLBACK ${channelName} · ${reason} · ${fallback.route || 'official-fallback'} · not saved to D1`);
  restoreSelectedPlayback();
  return true;
}
async function runOneClick(){
  const runHuntButton=$('run-hunt'),button=$('hunt-oneclick'),status=$('hunt-oneclick-status');
  const channelName=$('channel-name')?.textContent?.trim();
  if(!button||!status||!runHuntButton||!candidateInput||!testButton)return;
  if(!channelName||channelName==='Επίλεξε κανάλι'){status.textContent='Select a channel first';return;}

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
      candidateInput.value=url;candidateInput.dispatchEvent(new Event('input',{bubbles:true}));
      const playback=waitForPlayback(url);
      testButton.click();
      log(`ONE-CLICK TEST ${channelName} · ${i+1}/${limit} · ${url}`);
      const result=await playback;
      if(!result.ok)continue;

      status.textContent=`Working stream ✓ ${result.startup} ms · saving best…`;
      try{
        const saved=await saveBestSourceToCurrent(url,{maxSources:3});
        status.textContent=`Best stream saved ✓ · ${saved.kept.length}/3 kept`;
        log(`ONE-CLICK SUCCESS ${channelName} · winner ${url} · ${result.startup} ms · kept ${saved.kept.length} · dropped ${saved.dropped.length}`);
      }catch(error){
        status.textContent=`Working stream ✓ ${result.startup} ms · save failed`;
        log(`ONE-CLICK SAVE FAILED ${channelName} · ${url} · ${error.message}`);
      }
      return;
    }

    if(useOfficialFallback(status,channelName,`No working stream in first ${limit}`))return;
    status.textContent=`No working stream in first ${limit} · restored`;
    log(`ONE-CLICK DONE ${channelName} · no working stream candidate in ${limit} · no verified official fallback`);
    restoreSelectedPlayback();
  }catch(error){
    if(useOfficialFallback(status,channelName,`Stream hunt failed: ${error.message}`))return;
    status.textContent=`Failed · ${error.message}`;
    log(`ONE-CLICK ERROR ${channelName} · ${error.message}`);
    restoreSelectedPlayback();
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
console.info(`[WebTV] One-click Source Hunt loaded · build ${BUILD_ID} · stream-first · verified official fallback last`);
