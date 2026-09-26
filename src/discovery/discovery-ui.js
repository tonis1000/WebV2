import { candidateForDisplay, withVerification } from './candidate-model.js';
import { DiscoveryState, FRESHNESS_OPTIONS } from './discovery-state.js';
import { readLocalSourceContext } from './local-data-reader.js';
import { collectLocalCandidates } from './local-candidates.js';
import { discoverCuratedRemoteFeeds } from './external-discovery-client.js';
import { verifyCandidates, verifyWithConcurrency } from './verifier-client.js';

const BUILD_ID='20260926-discovery-phase4-curated-feeds';
const state=new DiscoveryState();
const $=id=>document.getElementById(id);
let verificationController=null;
let externalController=null;

function ensureStyles(){
  if ($('webtv-discovery-phase4-styles')) return;
  const style=document.createElement('style');
  style.id='webtv-discovery-phase4-styles';
  style.textContent=`
    .button.discovery-beta{background:#1e2736;border-color:#4f7099;color:#d9e9ff}
    .discovery-shell{position:fixed;top:76px;right:18px;width:min(680px,calc(100vw - 28px));max-height:calc(100vh - 92px);overflow:auto;z-index:1100;padding:16px;background:rgba(19,23,28,.995);border:1px solid #4f7099;border-radius:16px;box-shadow:0 28px 90px rgba(0,0,0,.68);color:var(--text)}
    .discovery-shell-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.discovery-shell-head h2{margin:0}.discovery-phase{color:#9ecbff;font-size:.78rem;font-weight:800;letter-spacing:.08em}.discovery-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.discovery-controls button{padding:6px 10px}.discovery-controls button[aria-pressed="true"]{border-color:var(--accent-2);background:#17293b;color:#d9e9ff}.discovery-note{padding:10px 12px;border:1px solid #3c4f65;border-radius:10px;background:#0d141d;color:var(--muted);font-size:.8rem;line-height:1.4}.discovery-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}.discovery-scan-status{color:var(--muted);font-size:.78rem;margin-top:5px}.discovery-lanes{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.discovery-lanes span{padding:5px 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:.72rem;background:#0b1117}.discovery-results{display:grid;gap:9px;margin-top:12px}.discovery-card{padding:11px;border:1px solid var(--line);border-radius:11px;background:#0b1117}.discovery-card-head{display:flex;justify-content:space-between;gap:10px}.discovery-card strong{font-size:.9rem}.discovery-card span,.discovery-card code{display:block;margin-top:4px;color:var(--muted);font-size:.75rem}.discovery-card code{color:#bfe0ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.discovery-status{color:#ffd166;font-weight:800}.discovery-status[data-state="VERIFIED"]{color:#69db7c}.discovery-status[data-state="FAILED"],.discovery-status[data-state="HTTP 403"],.discovery-status[data-state="HTTP 404"],.discovery-status[data-state="TIMEOUT"],.discovery-status[data-state="DRM"]{color:#ff8787}.discovery-card-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:9px}.discovery-empty{padding:16px;border:1px dashed var(--line);border-radius:10px;color:var(--muted)}
    @media(max-width:780px){.discovery-shell{top:70px;right:10px;width:calc(100vw - 20px);max-height:calc(100vh - 84px)}}`;
  document.head.appendChild(style);
}

function selectedChannelSnapshot(){
  const channel=window.WebTVPlaylistAPI?.getSelectedChannel?.();
  return channel ? {id:channel.id,originalId:channel.originalId,name:channel.name,group:channel.group,tvgId:channel.tvgId} : null;
}
function sameChannel(a,b){return Boolean(a&&b&&(String(a.id||'')===String(b.id||'')||String(a.name||'')===String(b.name||'')));}
function syncSelectedChannel(){
  const selected=selectedChannelSnapshot();
  const current=state.snapshot().channel;
  if(!selected){if(current)state.setChannel(null);return null;}
  if(!sameChannel(current,selected))state.setChannel(selected);
  return selected;
}

function ensureUi(){
  ensureStyles();
  let button=$('discovery-beta-toggle');
  if (!button) {
    button=document.createElement('button');button.id='discovery-beta-toggle';button.type='button';button.className='button discovery-beta';button.textContent='Discovery Beta 🔬';
    const actions=document.querySelector('.topbar-actions');const hunt=$('source-hunt-toggle');if (actions) actions.insertBefore(button,hunt?.nextSibling||null);
  }
  let panel=$('discovery-shell');
  if (!panel) {
    panel=document.createElement('section');panel.id='discovery-shell';panel.className='discovery-shell';panel.hidden=true;panel.setAttribute('aria-label','Source Discovery Phase 4');
    panel.innerHTML=`<div class="discovery-shell-head"><div><div class="discovery-phase">DISCOVERY · PHASE 4 · CURATED REMOTE FEEDS</div><h2 id="discovery-channel">No channel selected</h2></div><button id="discovery-close" class="button ghost" type="button">Close</button></div><div class="discovery-note">Local discovery remains read-only. External discovery is explicit and currently uses only the Curated Remote Feeds provider. Results stay temporary. Verification remains separate and nothing is saved automatically.</div><div class="discovery-controls" id="discovery-freshness" aria-label="Freshness window"></div><div class="discovery-actions"><button id="discovery-scan-local" class="button" type="button">Find Local Sources</button><button id="discovery-scan-external" class="button" type="button">Find External Sources</button><button id="discovery-cancel-external" class="button ghost" type="button" hidden>Cancel Search</button><button id="discovery-verify-all" class="button ghost" type="button">Verify All</button><button id="discovery-cancel-verify" class="button ghost" type="button" hidden>Cancel Verify</button></div><div id="discovery-scan-status" class="discovery-scan-status">Ready · no scan yet</div><div id="discovery-external-status" class="discovery-scan-status"></div><div id="discovery-verify-status" class="discovery-scan-status"></div><div id="discovery-lanes" class="discovery-lanes"></div><div id="discovery-results" class="discovery-results"></div>`;
    document.body.appendChild(panel);
  }
  const controls=$('discovery-freshness');
  if (controls && !controls.children.length) {
    const label=document.createElement('span');label.textContent='Recent window:';label.className='muted small';controls.appendChild(label);
    for (const option of FRESHNESS_OPTIONS) {const control=document.createElement('button');control.type='button';control.className='button ghost';control.dataset.freshness=option.id;control.textContent=option.label;control.addEventListener('click',()=>{state.setFreshness(option.id);render();});controls.appendChild(control);}
    const hint=document.createElement('span');hint.className='muted small';hint.textContent='Sent to external providers. Curated feed entries are checked live and may not expose reliable publication age.';controls.appendChild(hint);
  }
  if (button.dataset.bound!=='1') {
    button.dataset.bound='1';button.addEventListener('click',openPanel);
    $('discovery-close')?.addEventListener('click',closePanel);
    $('discovery-scan-local')?.addEventListener('click',scanLocalSources);
    $('discovery-scan-external')?.addEventListener('click',scanExternalSources);
    $('discovery-cancel-external')?.addEventListener('click',cancelExternalDiscovery);
    $('discovery-verify-all')?.addEventListener('click',verifyAll);
    $('discovery-cancel-verify')?.addEventListener('click',cancelVerification);
  }
  return {button,panel};
}

function renderLanes(snapshot){
  const lanes=$('discovery-lanes');if (!lanes) return;lanes.replaceChildren();
  const rows=[['My Playlist',snapshot.lanes.myPlaylist],['Saved Playlists',snapshot.lanes.savedPlaylists],['Xtream loaded',snapshot.lanes.xtream],['Curated feeds',snapshot.lanes.curatedRemoteFeeds],['Unique',snapshot.lanes.total]];
  for (const [label,count] of rows) {const chip=document.createElement('span');chip.textContent=`${label}: ${count}`;lanes.appendChild(chip);}
}
function verificationSummary(snapshot){
  const counts={VERIFIED:0,FAILED:0,OTHER:0};
  for(const item of snapshot.candidates){if(item.verificationStatus==='VERIFIED')counts.VERIFIED++;else if(['FAILED','TIMEOUT','HTTP 403','HTTP 404','DRM','UNRESOLVED'].includes(item.verificationStatus))counts.FAILED++;else counts.OTHER++;}
  return counts;
}

function render(){
  const snapshot=state.snapshot();const panel=$('discovery-shell');if (!panel) return;panel.hidden=!snapshot.open;
  $('discovery-channel').textContent=snapshot.channel?.name || 'No channel selected';
  document.querySelectorAll('#discovery-freshness [data-freshness]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.freshness===snapshot.freshness)));
  const verifyBusy=snapshot.verifyStatus==='loading';const externalBusy=snapshot.externalStatus==='loading';const localBusy=snapshot.scanStatus==='loading';
  const scan=$('discovery-scan-local');if(scan)scan.disabled=localBusy||externalBusy||verifyBusy||!snapshot.channel;
  const external=$('discovery-scan-external');if(external)external.disabled=localBusy||externalBusy||verifyBusy||!snapshot.channel;
  const cancelExternal=$('discovery-cancel-external');if(cancelExternal)cancelExternal.hidden=!externalBusy;
  const verifyAllBtn=$('discovery-verify-all');if(verifyAllBtn)verifyAllBtn.disabled=verifyBusy||externalBusy||localBusy||!snapshot.candidates.length;
  const cancel=$('discovery-cancel-verify');if(cancel)cancel.hidden=!verifyBusy;
  const status=$('discovery-scan-status');if(status)status.textContent=snapshot.scanMessage || (snapshot.channel?'Local: ready':'Select a channel first');
  const externalStatus=$('discovery-external-status');if(externalStatus)externalStatus.textContent=snapshot.externalMessage || (snapshot.channel?'External: ready · Curated Remote Feeds':'');
  const verifyStatus=$('discovery-verify-status');if(verifyStatus){const counts=verificationSummary(snapshot);verifyStatus.textContent=snapshot.verifyMessage || (snapshot.candidates.length?`Verified ${counts.VERIFIED} · failed ${counts.FAILED} · pending ${counts.OTHER}`:'');}
  renderLanes(snapshot);
  const results=$('discovery-results');results.replaceChildren();
  if (!snapshot.channel) {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent='Select a channel first. Opening Discovery never changes the current selection.';results.appendChild(empty);return;}
  if (!snapshot.candidates.length && (localBusy||externalBusy)) {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent=externalBusy?'Searching curated remote feeds…':'Reading local source snapshots…';results.appendChild(empty);return;}
  if (!snapshot.candidates.length && snapshot.scanStatus==='error' && snapshot.externalStatus!=='done') {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent=snapshot.scanMessage||'Local scan failed';results.appendChild(empty);return;}
  if (!snapshot.candidates.length && snapshot.externalStatus==='error' && snapshot.scanStatus!=='done') {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent=snapshot.externalMessage||'External discovery failed';results.appendChild(empty);return;}
  if (!snapshot.candidates.length && snapshot.scanStatus==='idle' && snapshot.externalStatus==='idle') {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent='No scan yet. Local and external candidates remain temporary and are never saved automatically.';results.appendChild(empty);return;}
  if (!snapshot.candidates.length) {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent='No candidate matched this channel. Nothing was written or tested.';results.appendChild(empty);return;}
  for (const raw of snapshot.candidates) {
    const item=candidateForDisplay(raw);const card=document.createElement('article');card.className='discovery-card';card.dataset.candidateId=item.candidateId;
    const head=document.createElement('div');head.className='discovery-card-head';const type=document.createElement('strong');type.textContent=item.sourceType.toUpperCase();const verification=document.createElement('span');verification.className='discovery-status';verification.dataset.state=item.verificationStatus;verification.textContent=item.verificationStatus;head.append(type,verification);
    const origin=document.createElement('span');origin.textContent=`Origin: ${item.sourceOrigin} · Provider: ${item.discoveryProvider} · Match: ${item.matchConfidence}`;
    const freshness=document.createElement('span');freshness.textContent=item.freshness?`Freshness: ${item.freshness}`:'';
    const url=document.createElement('code');url.textContent=item.sourceUrl;card.append(head,origin);if(item.freshness)card.appendChild(freshness);card.appendChild(url);
    if(item.startupMs!==null||item.lastHttpStatus!==null||item.mediaType||item.verificationDetail){const detail=document.createElement('span');detail.textContent=[item.startupMs!==null?`${item.startupMs} ms`:'',item.lastHttpStatus!==null?`HTTP ${item.lastHttpStatus}`:'',item.mediaType||'',item.verificationDetail||''].filter(Boolean).join(' · ');card.appendChild(detail);}
    const actions=document.createElement('div');actions.className='discovery-card-actions';const verify=document.createElement('button');verify.type='button';verify.className='button ghost mini';verify.textContent='Verify';verify.disabled=verifyBusy||externalBusy||localBusy;verify.addEventListener('click',()=>verifyOne(item.candidateId));actions.appendChild(verify);card.appendChild(actions);results.appendChild(card);
  }
}

async function scanLocalSources(){
  cancelVerification();
  const selected=syncSelectedChannel();if(!selected){render();return;}
  state.setScanning('Reading local source snapshots…');render();
  try{
    const context=await readLocalSourceContext();const result=collectLocalCandidates(selected,context);const notes=[];
    if (!context.myPlaylistAvailable) notes.push('My Playlist snapshot skipped while temporary catalog is active');
    if (!context.loadedXtream) notes.push('Xtream lane uses only an account already loaded in Playlist Manager');
    const base=`Local scan complete · ${result.candidates.length} unique local candidate${result.candidates.length===1?'':'s'}`;
    state.setScanResult({candidates:result.candidates,lanes:result.lanes,message:notes.length?`${base} · ${notes.join(' · ')}`:base});
  } catch (error) {state.setScanError(error?.message||String(error));}
  render();
}

function cancelExternalDiscovery(){
  if(externalController&&!externalController.signal.aborted)externalController.abort(new DOMException('External discovery cancelled','AbortError'));
  externalController=null;
}
async function scanExternalSources(){
  cancelVerification();cancelExternalDiscovery();
  const selected=syncSelectedChannel();if(!selected){render();return;}
  externalController=new AbortController();state.setExternalScanning(`Searching Curated Remote Feeds · requested window ${state.snapshot().freshness}…`);render();
  try{
    const result=await discoverCuratedRemoteFeeds(selected,{freshness:state.snapshot().freshness,signal:externalController.signal});
    const note=result.freshnessApplied?`freshness ${result.freshnessRequested}`:'live feed check; per-entry age unavailable';
    state.mergeExternalResult({candidates:result.candidates,count:result.candidates.length,message:`External scan complete · ${result.candidates.length} curated candidate${result.candidates.length===1?'':'s'} · ${note}`});
  }catch(error){
    if(error?.name==='AbortError')state.setExternalIdle('External discovery cancelled');
    else state.setExternalError(`External discovery failed · ${error?.message||error}`);
  }finally{externalController=null;render();}
}

function cancelVerification(){if(verificationController&&!verificationController.signal.aborted)verificationController.abort(new DOMException('Verification cancelled','AbortError'));verificationController=null;}
async function verifyOne(candidateId){
  cancelVerification();const candidate=state.snapshot().candidates.find(item=>item.candidateId===candidateId);if(!candidate)return;
  verificationController=new AbortController();state.setVerificationRunning(`Verifying ${candidate.sourceType.toUpperCase()} candidate…`);render();
  try{const [result]=await verifyCandidates([candidate],{signal:verificationController.signal});if(result)state.replaceCandidate(withVerification(candidate,result));state.setVerificationMessage(result?`Verification complete · ${result.status}`:'Verifier returned no result','done');}
  catch(error){state.setVerificationMessage(error?.name==='AbortError'?'Verification cancelled':`Verification failed · ${error?.message||error}`,error?.name==='AbortError'?'idle':'error');}
  finally{verificationController=null;render();}
}
async function verifyAll(){
  cancelVerification();const candidates=state.snapshot().candidates;if(!candidates.length)return;
  verificationController=new AbortController();state.setVerificationRunning(`Verifying ${candidates.length} candidate${candidates.length===1?'':'s'} · max 2 concurrently…`);render();let completed=0;
  try{await verifyWithConcurrency(candidates,{signal:verificationController.signal,onResult:(result,_index,original)=>{if(result)state.replaceCandidate(withVerification(original,result));completed++;state.setVerificationRunning(`Verification ${completed}/${candidates.length} complete…`);render();}});const summary=verificationSummary(state.snapshot());state.setVerificationMessage(`Verification complete · ${summary.VERIFIED} verified · ${summary.FAILED} failed`,'done');}
  catch(error){state.setVerificationMessage(error?.name==='AbortError'?`Verification cancelled · ${completed}/${candidates.length} completed`:`Verification failed · ${error?.message||error}`,error?.name==='AbortError'?'idle':'error');}
  finally{verificationController=null;render();}
}

function openPanel(){ensureUi();state.setChannel(selectedChannelSnapshot());state.setOpen(true);render();}
function closePanel(){cancelExternalDiscovery();cancelVerification();state.setOpen(false);state.setExternalIdle('');state.setVerificationMessage('','idle');render();}

ensureUi();
const api=Object.freeze({buildId:BUILD_ID,open:openPanel,close:closePanel,scanLocal:scanLocalSources,scanExternal:scanExternalSources,verifyOne,verifyAll,cancelExternalDiscovery,cancelVerification,snapshot:()=>state.snapshot()});
window.WebTVDiscovery=api;
window.WebTVDiscoveryPhase1=api;
console.info(`[WebTV] Discovery Phase 4 loaded · ${BUILD_ID} · curated remote feeds + separate verifier · no save`);
