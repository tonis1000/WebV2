import { saveBestSourceToCurrent } from './source-save-policy.js';
import { officialFallbackFor } from './core/official-fallbacks.js';
import { channelMatchScore, canonicalGreekChannelName, makeSyntheticChannel } from './channel-identity-gr.js';
import { showSaveDestination } from './source-hunt-save-destination.js';

const BUILD_ID = '20260928-oneclick-failure-diagnostics';
const $ = id => document.getElementById(id);
const panel = $('source-hunt');
const diagLog = $('diagnostic-log');
let queryDirty=false;

function log(message){if(!diagLog)return;const stamp=new Date().toLocaleTimeString();diagLog.textContent=`[${stamp}] ${message}\n${diagLog.textContent}`.slice(0,18000);}
function clean(value=''){return String(value||'').split('#')[0].trim();}
function selectedChannel(){return window.WebTVPlaylistAPI?.getSelectedChannel?.()||null;}
function playbackApi(){return window.WebTVPlaybackAPI||null;}
function huntQuery(){return clean($('hunt-query')?.value)||selectedChannel()?.name||'';}
function huntMode(){return $('hunt-match-mode')?.value||'exact';}
function selectedMatchesQuery(){const selected=selectedChannel();if(!selected)return false;return canonicalGreekChannelName(selected.name)===canonicalGreekChannelName(huntQuery());}
function currentOfficialFallback(){const selected=selectedChannel();return selected&&selectedMatchesQuery()?officialFallbackFor(selected):null;}
function directCandidateTester(){if(!panel)return null;return [...panel.children].find(node=>node.classList?.contains('candidate-tester'))||null;}
function compactFailure(value=''){const text=String(value||'').replace(/\s+/g,' ').trim();return text.length>150?`${text.slice(0,147)}…`:text;}

function ensureSearchUi(){
  if(!panel||$('hunt-search-box'))return;
  const heading=panel.querySelector('.section-heading');if(!heading)return;
  const wrap=document.createElement('div');wrap.id='hunt-search-box';wrap.className='hunt-oneclick-wrap';
  wrap.innerHTML=`<input id="hunt-query" type="search" placeholder="Search channel / provider e.g. ANT1 Comedy, Nova" autocomplete="off"><select id="hunt-match-mode" aria-label="Search mode"><option value="exact">Exact channel</option><option value="broad">Broad / family</option></select>`;
  heading.appendChild(wrap);
  const input=$('hunt-query');
  const selected=selectedChannel();if(selected)input.value=selected.name;
  input.addEventListener('input',()=>{queryDirty=true;});
  input.addEventListener('keydown',e=>{if(e.key==='Enter')$('hunt-oneclick')?.click();});
  const name=$('channel-name');if(name)new MutationObserver(()=>{if(queryDirty)return;const selected=selectedChannel();if(selected&&input)input.value=selected.name;}).observe(name,{childList:true,characterData:true,subtree:true});
}
function ensureAdvancedUi(){
  if(!panel)return;let details=$('hunt-advanced');if(!details){details=document.createElement('details');details.id='hunt-advanced';details.className='hunt-advanced';const summary=document.createElement('summary');summary.textContent='Advanced stream results';const hint=document.createElement('span');hint.className='muted small';hint.textContent='Curated feeds, Seeds, GitHub, Web, Forums and manual stream candidate lists';details.append(summary,hint);const tester=directCandidateTester();if(tester&&tester.parentElement===panel)panel.insertBefore(details,tester);else panel.appendChild(details);}for(const id of ['hunt-auto','hunt-external']){const node=$(id);if(node&&node!==details&&node.parentElement!==details)details.appendChild(node);}}
function ensureUi(){
  const runHuntButton=$('run-hunt');if(!panel||!runHuntButton)return false;ensureSearchUi();if(!$('hunt-oneclick')){const heading=panel.querySelector('.section-heading');if(!heading)return false;const wrap=document.createElement('div');wrap.className='hunt-oneclick-wrap';wrap.innerHTML=`<button id="hunt-oneclick" class="button hunt-primary" type="button">Find & Test Best</button><span id="hunt-oneclick-status" class="hunt-oneclick-status">Ready · exact identity check · streams first</span>`;heading.appendChild(wrap);}ensureAdvancedUi();const button=$('hunt-oneclick');if(button&&button.dataset.oneclickBound!=='1'){button.dataset.oneclickBound='1';button.addEventListener('click',runOneClick);}return true;
}
function candidateMatches(node,query,mode){if(!query)return true;const card=node?.closest?.('.hunt-result');return channelMatchScore(card?.dataset?.channelName||card?.textContent||node?.textContent||'',query,mode)>0;}
function collectCandidateUrls(){
  const query=huntQuery(),mode=huntMode();const selectors=['#hunt-results code','#hunt-curated-results code','#hunt-seed-results code','#hunt-web-results code','#hunt-forum-results code'];const seen=new Set(),urls=[];
  for(const selector of selectors)for(const node of document.querySelectorAll(selector)){const card=node.closest('.hunt-result');if(card?.querySelector('button')===null && selector.includes('curated'))continue;const url=clean(node.textContent);if(!/^https?:\/\//i.test(url)||seen.has(url))continue;if(!candidateMatches(node,query,mode)){card?.setAttribute('data-identity-rejected','1');continue;}seen.add(url);urls.push(url);}return urls;
}
function waitForDiscovery({maxMs=32000,quietMs=1800,minMs=4500}={}){return new Promise(resolve=>{const roots=[$('hunt-auto'),$('hunt-external')].filter(Boolean);const startedAt=Date.now();let quietTimer=null,done=false;const finish=()=>{if(done)return;done=true;clearTimeout(quietTimer);clearTimeout(maxTimer);observer.disconnect();resolve(collectCandidateUrls());};const schedule=()=>{clearTimeout(quietTimer);quietTimer=setTimeout(()=>{const elapsed=Date.now()-startedAt,urls=collectCandidateUrls();if(urls.length&&elapsed>=minMs)finish();else if(urls.length)quietTimer=setTimeout(finish,Math.max(0,minMs-elapsed));},quietMs);};const observer=new MutationObserver(schedule);roots.forEach(root=>observer.observe(root,{childList:true,subtree:true,characterData:true}));const maxTimer=setTimeout(finish,maxMs);schedule();});}
async function restoreSelectedPlayback(){const api=playbackApi();if(api?.replaySelected)return api.replaySelected();return null;}
function useOfficialFallback(status,channelName,reason){const fallback=currentOfficialFallback();if(!fallback)return false;status.textContent=`${reason} · ${fallback.label||'Official fallback'}`;log(`ONE-CLICK FALLBACK ${channelName} · ${reason} · ${fallback.route||'official-fallback'} · not saved to D1`);restoreSelectedPlayback().catch(error=>log(`ONE-CLICK FALLBACK restore failed · ${error.message}`));return true;}
function fireUnderlyingHunt(query){const button=$('run-hunt');const header=$('channel-name');if(!button)return;const original=header?.textContent||'';const selected=selectedChannel();const free=!!query&&(!selected||canonicalGreekChannelName(query)!==canonicalGreekChannelName(selected.name));if(free&&header)header.textContent=query;button.click();if(free&&header)setTimeout(()=>{header.textContent=original;},120);}

async function runOneClick(){
  const runHuntButton=$('run-hunt'),button=$('hunt-oneclick'),status=$('hunt-oneclick-status');const selected=selectedChannel();const query=huntQuery();const canonical=canonicalGreekChannelName(query);const freeSearch=!selectedMatchesQuery();const channel=freeSearch?makeSyntheticChannel(query):selected;const api=playbackApi();
  if(!button||!status||!runHuntButton)return;if(!query){status.textContent='Type a channel or select one first';return;}if(!api?.testCandidate){status.textContent='Playback API unavailable';return;}
  button.disabled=true;window.WebTVSourceHuntBusy=true;status.textContent=`Searching ${canonical}…`;log(`ONE-CLICK HUNT START ${canonical} · mode ${huntMode()} · ${freeSearch?'free search':'selected channel'}`);
  try{
    document.getElementById('hunt-save-destination')?.remove();document.querySelectorAll('#hunt-results,#hunt-curated-results,#hunt-seed-results,#hunt-web-results,#hunt-forum-results').forEach(el=>{el.innerHTML='';});
    fireUnderlyingHunt(query);const urls=await waitForDiscovery();
    if(!urls.length){if(!freeSearch&&useOfficialFallback(status,canonical,'No fresh stream candidate'))return;status.textContent=`No identity-matched stream candidates for ${canonical}`;log(`ONE-CLICK HUNT ${canonical} · no identity-matched candidates`);return;}
    status.textContent=`${urls.length} identity-matched candidates · testing…`;const limit=Math.min(urls.length,8);let lastFailure='';
    for(let i=0;i<limit;i++){
      const url=urls[i];status.textContent=`Testing stream ${i+1}/${limit}`;log(`ONE-CLICK TEST ${canonical} · ${i+1}/${limit} · ${url}`);let result=null;
      try{result=await api.testCandidate(url,{channel});}
      catch(error){lastFailure=compactFailure(error?.message||error);status.textContent=`Stream ${i+1}/${limit} failed · ${lastFailure}`;log(`ONE-CLICK TEST FAILED ${canonical} · ${url} · ${lastFailure}`);continue;}
      if(!result?.ok||result?.fallback){lastFailure=compactFailure(result?.error||result?.detail||result?.verificationDetail||'Candidate did not produce verified stream playback');status.textContent=`Stream ${i+1}/${limit} failed · ${lastFailure}`;log(`ONE-CLICK TEST REJECTED ${canonical} · ${url} · ${lastFailure}`);continue;}
      if(freeSearch){status.textContent=`Working stream ✓ ${result.startupMs||0} ms · choose where to save`;await showSaveDestination({channel:{...channel,name:canonical},url});log(`ONE-CLICK FREE RESULT ${canonical} · winner ${url} · waiting for save destination`);return;}
      status.textContent=`Working stream ✓ ${result.startupMs||0} ms · saving best…`;
      try{const saved=await saveBestSourceToCurrent(url,{maxSources:3});status.textContent=`Best stream saved ✓ · ${saved.kept.length}/3 kept`;log(`ONE-CLICK SUCCESS ${canonical} · winner ${url} · kept ${saved.kept.length}`);}catch(error){status.textContent=`Working stream ✓ ${result.startupMs||0} ms · save failed`;log(`ONE-CLICK SAVE FAILED ${canonical} · ${url} · ${error.message}`);}return;
    }
    const finalReason=lastFailure?` · last failure: ${lastFailure}`:'';
    if(!freeSearch&&useOfficialFallback(status,canonical,`No working stream in first ${limit}${finalReason}`))return;status.textContent=`No working identity-matched stream in first ${limit}${finalReason}`;if(!freeSearch)await restoreSelectedPlayback();
  }catch(error){if(!freeSearch&&useOfficialFallback(status,canonical,`Stream hunt failed: ${error.message}`))return;status.textContent=`Failed · ${error.message}`;log(`ONE-CLICK ERROR ${canonical} · ${error.message}`);if(!freeSearch)await restoreSelectedPlayback().catch(()=>{});}finally{window.WebTVSourceHuntBusy=false;button.disabled=false;}
}

if(!ensureUi()){const observer=new MutationObserver(()=>{if(ensureUi())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>{ensureUi();observer.disconnect();},5000);}window.addEventListener('webtv:ready',ensureUi);window.WebTVSourceHuntQuery={get:huntQuery,getMode:huntMode,resetToSelected(){queryDirty=false;const s=selectedChannel();if($('hunt-query'))$('hunt-query').value=s?.name||'';}};console.info(`[WebTV] One-click Source Hunt loaded · build ${BUILD_ID} · candidate headers preserved + exact test failure status`);
