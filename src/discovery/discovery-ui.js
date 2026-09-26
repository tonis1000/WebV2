import { candidateForDisplay, withVerification } from './candidate-model.js';
import { DiscoveryState, FRESHNESS_OPTIONS } from './discovery-state.js';
import { readLocalSourceContext } from './local-data-reader.js';
import { collectLocalCandidates } from './local-candidates.js';
import { discoverAuthorizedXtream, AUTHORIZED_XTREAM_DISCOVERY_PROVIDER } from './authorized-xtream.js';
import { discoverNewXtreamPreview, NEW_XTREAM_PREVIEW_PROVIDER } from './new-xtream-preview.js';
import { discoverCuratedRemoteFeeds, discoverGithubPublicPlaylists, discoverRecentWebSearch, discoverStrmSpecific, discoverOfficialProvider, CURATED_REMOTE_FEEDS_PROVIDER, GITHUB_PUBLIC_PLAYLISTS_PROVIDER, RECENT_WEB_SEARCH_PROVIDER, STRM_SPECIFIC_DISCOVERY_PROVIDER, OFFICIAL_PROVIDER_LANE } from './external-discovery-client.js';
import { verifyCandidates, verifyWithConcurrency } from './verifier-client.js';
import { promoteCandidate, keepXtreamAccount, promotePreviewXtreamChannel, saveFullXtreamAccountFromCandidate } from './promotion.js';

const BUILD_ID='20260926-discovery-phase52-new-xtream-choice';
const state=new DiscoveryState();
const $=id=>document.getElementById(id);
let verificationController=null;
let externalController=null;
const promotionBusy=new Set();
const promotionMessages=new Map();

function ensureStyles(){
  if ($('webtv-discovery-phase4-styles')) return;
  const style=document.createElement('style');
  style.id='webtv-discovery-phase4-styles';
  style.textContent=`
    .button.discovery-beta{background:#1e2736;border-color:#4f7099;color:#d9e9ff}
    .discovery-shell{position:fixed;top:76px;right:18px;width:min(680px,calc(100vw - 28px));max-height:calc(100vh - 92px);overflow:auto;z-index:1100;padding:16px;background:rgba(19,23,28,.995);border:1px solid #4f7099;border-radius:16px;box-shadow:0 28px 90px rgba(0,0,0,.68);color:var(--text)}
    .discovery-shell-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.discovery-shell-head h2{margin:0}.discovery-phase{color:#9ecbff;font-size:.78rem;font-weight:800;letter-spacing:.08em}.discovery-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.discovery-controls button{padding:6px 10px}.discovery-controls button[aria-pressed="true"]{border-color:var(--accent-2);background:#17293b;color:#d9e9ff}.discovery-note{padding:10px 12px;border:1px solid #3c4f65;border-radius:10px;background:#0d141d;color:var(--muted);font-size:.8rem;line-height:1.4}.discovery-new-xtream{margin-top:10px;padding:10px 12px;border:1px solid #3c4f65;border-radius:10px;background:#0c1219}.discovery-new-xtream summary{cursor:pointer;font-weight:800}.discovery-new-xtream-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.discovery-new-xtream-grid input{min-width:0}.discovery-new-xtream-hint{display:block;margin-top:7px;color:var(--muted);font-size:.75rem}.discovery-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}.discovery-scan-status{color:var(--muted);font-size:.78rem;margin-top:5px}.discovery-lanes{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.discovery-lanes span{padding:5px 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:.72rem;background:#0b1117}.discovery-results{display:grid;gap:9px;margin-top:12px}.discovery-card{padding:11px;border:1px solid var(--line);border-radius:11px;background:#0b1117}.discovery-card-head{display:flex;justify-content:space-between;gap:10px}.discovery-card strong{font-size:.9rem}.discovery-card span,.discovery-card code{display:block;margin-top:4px;color:var(--muted);font-size:.75rem}.discovery-card code{color:#bfe0ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.discovery-status{color:#ffd166;font-weight:800}.discovery-status[data-state="VERIFIED"]{color:#69db7c}.discovery-status[data-state="FAILED"],.discovery-status[data-state="HTTP 403"],.discovery-status[data-state="HTTP 404"],.discovery-status[data-state="TIMEOUT"],.discovery-status[data-state="DRM"]{color:#ff8787}.discovery-card-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:9px}.discovery-promote-message{margin-top:7px;color:#9ecbff!important}.discovery-empty{padding:16px;border:1px dashed var(--line);border-radius:10px;color:var(--muted)}
    @media(max-width:780px){.discovery-shell{top:70px;right:10px;width:calc(100vw - 20px);max-height:calc(100vh - 84px)}.discovery-new-xtream-grid{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
}

function selectedChannelSnapshot(){
  const channel=window.WebTVPlaylistAPI?.getSelectedChannel?.();
  return channel ? {id:channel.id,originalId:channel.originalId,name:channel.name,group:channel.group,tvgId:channel.tvgId} : null;
}
function sameChannel(a,b){return Boolean(a&&b&&(String(a.id||'')===String(b.id||'')||String(a.name||'')===String(b.name||'')));}
function syncSelectedChannel(){
  const selected=selectedChannelSnapshot();const current=state.snapshot().channel;
  if(!selected){if(current)state.setChannel(null);return null;}
  if(!sameChannel(current,selected))state.setChannel(selected);return selected;
}

function ensureUi(){
  ensureStyles();let button=$('discovery-beta-toggle');
  if (!button) {button=document.createElement('button');button.id='discovery-beta-toggle';button.type='button';button.className='button discovery-beta';button.textContent='Discovery Beta 🔬';const actions=document.querySelector('.topbar-actions');const hunt=$('source-hunt-toggle');if (actions) actions.insertBefore(button,hunt?.nextSibling||null);}
  let panel=$('discovery-shell');
  if (!panel) {
    panel=document.createElement('section');panel.id='discovery-shell';panel.className='discovery-shell';panel.hidden=true;panel.setAttribute('aria-label','Source Discovery Phase 5');
    panel.innerHTML=`<div class="discovery-shell-head"><div><div class="discovery-phase">DISCOVERY · PHASE 5.2 · EXPLICIT XTREAM CHOICE</div><h2 id="discovery-channel">No channel selected</h2></div><button id="discovery-close" class="button ghost" type="button">Close</button></div><div class="discovery-note">Discovery and verification remain isolated from the player/sidebar. Nothing is saved automatically. Existing authorized Xtream accounts keep credentials server-side. For a new Xtream login, Test creates only a short-lived encrypted preview; after VERIFIED you explicitly choose Add only this channel or Save Full Xtream Account.</div><details id="discovery-new-xtream" class="discovery-new-xtream"><summary>Test New Xtream Account</summary><div class="discovery-new-xtream-grid"><input id="discovery-xtream-name" type="text" placeholder="Account name (optional)"><input id="discovery-xtream-server" type="url" placeholder="http://server.example:8080"><input id="discovery-xtream-username" type="text" autocomplete="username" placeholder="Username"><input id="discovery-xtream-password" type="password" autocomplete="current-password" placeholder="Password"></div><div class="discovery-actions"><button id="discovery-preview-xtream" class="button" type="button">Test New Xtream</button></div><span class="discovery-new-xtream-hint">Username/password are sent directly to the secure Xtream bridge and cleared from these fields after the test. Discovery stores only an opaque short-lived preview token.</span></details><div class="discovery-controls" id="discovery-freshness" aria-label="Freshness window"></div><div class="discovery-actions"><button id="discovery-scan-local" class="button" type="button">Find Local Sources</button><button id="discovery-scan-curated" class="button" type="button">Find Curated Feeds</button><button id="discovery-scan-github" class="button" type="button">Search GitHub Playlists</button><button id="discovery-scan-web" class="button" type="button">Search Recent Web</button><button id="discovery-scan-strm" class="button" type="button">Resolve STRM Sources</button><button id="discovery-scan-official" class="button" type="button">Find Official Sources</button><button id="discovery-scan-xtream" class="button" type="button">Search Authorized Xtream</button><button id="discovery-cancel-external" class="button ghost" type="button" hidden>Cancel Search</button><button id="discovery-verify-all" class="button ghost" type="button">Verify All</button><button id="discovery-cancel-verify" class="button ghost" type="button" hidden>Cancel Verify</button></div><div id="discovery-scan-status" class="discovery-scan-status">Ready · no scan yet</div><div id="discovery-external-status" class="discovery-scan-status"></div><div id="discovery-verify-status" class="discovery-scan-status"></div><div id="discovery-lanes" class="discovery-lanes"></div><div id="discovery-results" class="discovery-results"></div>`;
    document.body.appendChild(panel);
  }
  const controls=$('discovery-freshness');
  if (controls && !controls.children.length) {
    const label=document.createElement('span');label.textContent='Recent window:';label.className='muted small';controls.appendChild(label);
    for (const option of FRESHNESS_OPTIONS) {const control=document.createElement('button');control.type='button';control.className='button ghost';control.dataset.freshness=option.id;control.textContent=option.label;control.addEventListener('click',()=>{state.setFreshness(option.id);render();});controls.appendChild(control);}
    const hint=document.createElement('span');hint.className='muted small';hint.textContent='GitHub applies this to repository pushed_at. Recent Web sends the same window to Brave. Curated, STRM, Official and Xtream lanes are live checks.';controls.appendChild(hint);
  }
  if (button.dataset.bound!=='1') {
    button.dataset.bound='1';button.addEventListener('click',openPanel);$('discovery-close')?.addEventListener('click',closePanel);$('discovery-preview-xtream')?.addEventListener('click',previewNewXtreamSources);$('discovery-scan-local')?.addEventListener('click',scanLocalSources);$('discovery-scan-curated')?.addEventListener('click',()=>scanExternalProvider(CURATED_REMOTE_FEEDS_PROVIDER));$('discovery-scan-github')?.addEventListener('click',()=>scanExternalProvider(GITHUB_PUBLIC_PLAYLISTS_PROVIDER));$('discovery-scan-web')?.addEventListener('click',()=>scanExternalProvider(RECENT_WEB_SEARCH_PROVIDER));$('discovery-scan-strm')?.addEventListener('click',()=>scanExternalProvider(STRM_SPECIFIC_DISCOVERY_PROVIDER));$('discovery-scan-official')?.addEventListener('click',()=>scanExternalProvider(OFFICIAL_PROVIDER_LANE));$('discovery-scan-xtream')?.addEventListener('click',scanAuthorizedXtreamSources);$('discovery-cancel-external')?.addEventListener('click',cancelExternalDiscovery);$('discovery-verify-all')?.addEventListener('click',verifyAll);$('discovery-cancel-verify')?.addEventListener('click',cancelVerification);
  }
  return {button,panel};
}

function renderLanes(snapshot){
  const lanes=$('discovery-lanes');if (!lanes) return;lanes.replaceChildren();
  const rows=[['My Playlist',snapshot.lanes.myPlaylist],['Saved Playlists',snapshot.lanes.savedPlaylists],['Xtream loaded',snapshot.lanes.xtream],['Curated feeds',snapshot.lanes.curatedRemoteFeeds],['GitHub recent',snapshot.lanes.githubPublicPlaylists],['Recent web',snapshot.lanes.recentWebSearch],['STRM resolved',snapshot.lanes.strmSpecific],['Official',snapshot.lanes.officialProvider],['Authorized Xtream',snapshot.lanes.authorizedXtream],['New Xtream preview',snapshot.lanes.newXtreamPreview],['Unique',snapshot.lanes.total]];
  for (const [label,count] of rows) {const chip=document.createElement('span');chip.textContent=`${label}: ${count}`;lanes.appendChild(chip);}
}
function verificationSummary(snapshot){const counts={VERIFIED:0,FAILED:0,OTHER:0};for(const item of snapshot.candidates){if(item.verificationStatus==='VERIFIED')counts.VERIFIED++;else if(['FAILED','TIMEOUT','HTTP 403','HTTP 404','DRM','UNRESOLVED'].includes(item.verificationStatus))counts.FAILED++;else counts.OTHER++;}return counts;}

function render(){
  const snapshot=state.snapshot();const panel=$('discovery-shell');if (!panel) return;panel.hidden=!snapshot.open;$('discovery-channel').textContent=snapshot.channel?.name || 'No channel selected';document.querySelectorAll('#discovery-freshness [data-freshness]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.freshness===snapshot.freshness)));
  const verifyBusy=snapshot.verifyStatus==='loading';const externalBusy=snapshot.externalStatus==='loading';const localBusy=snapshot.scanStatus==='loading';const disabled=localBusy||externalBusy||verifyBusy||!snapshot.channel;
  for(const id of ['discovery-preview-xtream','discovery-scan-local','discovery-scan-curated','discovery-scan-github','discovery-scan-web','discovery-scan-strm','discovery-scan-official','discovery-scan-xtream']){const control=$(id);if(control)control.disabled=disabled;}
  const cancelExternal=$('discovery-cancel-external');if(cancelExternal)cancelExternal.hidden=!externalBusy;const verifyAllBtn=$('discovery-verify-all');if(verifyAllBtn)verifyAllBtn.disabled=verifyBusy||externalBusy||localBusy||!snapshot.candidates.length;const cancel=$('discovery-cancel-verify');if(cancel)cancel.hidden=!verifyBusy;
  const status=$('discovery-scan-status');if(status)status.textContent=snapshot.scanMessage || (snapshot.channel?'Local: ready':'Select a channel first');const externalStatus=$('discovery-external-status');if(externalStatus)externalStatus.textContent=snapshot.externalMessage || (snapshot.channel?'External: ready · Curated + GitHub + Recent Web + STRM + Official + Authorized Xtream + New Xtream Preview':'');const verifyStatus=$('discovery-verify-status');if(verifyStatus){const counts=verificationSummary(snapshot);verifyStatus.textContent=snapshot.verifyMessage || (snapshot.candidates.length?`Verified ${counts.VERIFIED} · failed ${counts.FAILED} · pending ${counts.OTHER}`:'');}
  renderLanes(snapshot);const results=$('discovery-results');results.replaceChildren();
  if (!snapshot.channel) {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent='Select a channel first. Opening Discovery never changes the current selection.';results.appendChild(empty);return;}
  if (!snapshot.candidates.length && (localBusy||externalBusy)) {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent=externalBusy?'Searching external provider…':'Reading local source snapshots…';results.appendChild(empty);return;}
  if (!snapshot.candidates.length && snapshot.scanStatus==='error' && snapshot.externalStatus!=='done') {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent=snapshot.scanMessage||'Local scan failed';results.appendChild(empty);return;}
  if (!snapshot.candidates.length && snapshot.externalStatus==='error' && snapshot.scanStatus!=='done') {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent=snapshot.externalMessage||'External discovery failed';results.appendChild(empty);return;}
  if (!snapshot.candidates.length && snapshot.scanStatus==='idle' && snapshot.externalStatus==='idle') {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent='No scan yet. Local and external candidates remain temporary and are never saved automatically.';results.appendChild(empty);return;}
  if (!snapshot.candidates.length) {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent='No candidate matched this channel. Nothing was written or tested.';results.appendChild(empty);return;}
  for (const raw of snapshot.candidates) {
    const item=candidateForDisplay(raw);const card=document.createElement('article');card.className='discovery-card';card.dataset.candidateId=item.candidateId;const head=document.createElement('div');head.className='discovery-card-head';const type=document.createElement('strong');type.textContent=item.sourceType.toUpperCase();const verification=document.createElement('span');verification.className='discovery-status';verification.dataset.state=item.verificationStatus;verification.textContent=item.verificationStatus;head.append(type,verification);const origin=document.createElement('span');origin.textContent=`Origin: ${item.sourceOrigin} · Provider: ${item.discoveryProvider} · Match: ${item.matchConfidence}${item.trustClass?` · Trust: ${item.trustClass}`:''}`;const freshness=document.createElement('span');freshness.textContent=item.freshness?`Freshness: ${item.freshness}`:'';const url=document.createElement('code');url.textContent=item.sourceUrl;card.append(head,origin);if(item.freshness)card.appendChild(freshness);card.appendChild(url);
    if(item.sourceType==='xtream'){const xt=document.createElement('span');xt.textContent=`Xtream account: ${item.xtreamAccountRef||'-'} · stream ID: ${item.xtreamStreamId||'-'}${item.xtreamContext?.server?` · server: ${item.xtreamContext.server}`:''} · credentials stay server-side`;card.appendChild(xt);}
    if(item.sourceType==='xtream-preview'){const xt=document.createElement('span');xt.textContent=`New Xtream preview · stream ID: ${item.xtreamStreamId||'-'}${item.xtreamPreviewServer?` · server: ${item.xtreamPreviewServer}`:''}${item.xtreamPreviewExpiresAt?` · expires: ${item.xtreamPreviewExpiresAt}`:''} · raw credentials are not stored in Discovery`;card.appendChild(xt);}
    if(item.drmDetected){const drm=document.createElement('span');drm.textContent='DRM hint detected in STRM metadata';card.appendChild(drm);}
    if(item.startupMs!==null||item.lastHttpStatus!==null||item.mediaType||item.verificationDetail){const detail=document.createElement('span');detail.textContent=[item.startupMs!==null?`${item.startupMs} ms`:'',item.lastHttpStatus!==null?`HTTP ${item.lastHttpStatus}`:'',item.mediaType||'',item.verificationDetail||''].filter(Boolean).join(' · ');card.appendChild(detail);}
    const actions=document.createElement('div');actions.className='discovery-card-actions';const verify=document.createElement('button');verify.type='button';verify.className='button ghost mini';const verifiable=!['official-page','official-embed'].includes(item.candidateKind);verify.textContent=verifiable?'Verify':'Official fallback';verify.disabled=verifyBusy||externalBusy||localBusy||promotionBusy.has(item.candidateId)||!verifiable;verify.addEventListener('click',()=>verifyOne(item.candidateId));actions.appendChild(verify);
    if(verifiable&&item.verificationStatus==='VERIFIED'&&item.saveEligible!==false&&item.sourceType!=='xtream-preview'){const add=document.createElement('button');add.type='button';add.className='button mini discovery-promote-source';add.textContent=Object.keys(item.requiredHeaders||{}).length?'Headers not persistable':'Add this source';add.disabled=verifyBusy||externalBusy||localBusy||promotionBusy.has(item.candidateId)||Object.keys(item.requiredHeaders||{}).length>0;add.addEventListener('click',()=>promoteOne(item.candidateId));actions.appendChild(add);}
    if(item.sourceType==='xtream'&&item.xtreamAccountRef){const keep=document.createElement('button');keep.type='button';keep.className='button ghost mini discovery-keep-xtream';keep.textContent='Keep Full Xtream Account';keep.disabled=promotionBusy.has(item.candidateId);keep.addEventListener('click',()=>keepXtreamAccountOne(item.candidateId));actions.appendChild(keep);}
    if(item.sourceType==='xtream-preview'&&item.verificationStatus==='VERIFIED'){
      const addChannel=document.createElement('button');addChannel.type='button';addChannel.className='button mini discovery-promote-xtream-channel';addChannel.textContent='Add only this channel';addChannel.disabled=promotionBusy.has(item.candidateId);addChannel.addEventListener('click',()=>promotePreviewXtreamChannelOne(item.candidateId));actions.appendChild(addChannel);
      const saveFull=document.createElement('button');saveFull.type='button';saveFull.className='button ghost mini discovery-save-full-xtream';saveFull.textContent='Save Full Xtream Account';saveFull.disabled=promotionBusy.has(item.candidateId);saveFull.addEventListener('click',()=>saveFullXtreamAccountOne(item.candidateId));actions.appendChild(saveFull);
    }
    card.appendChild(actions);const promotionMessage=promotionMessages.get(item.candidateId);if(promotionMessage){const message=document.createElement('span');message.className='discovery-promote-message';message.textContent=promotionMessage;card.appendChild(message);}results.appendChild(card);
  }
}

async function scanLocalSources(){
  cancelVerification();const selected=syncSelectedChannel();if(!selected){render();return;}state.setScanning('Reading local source snapshots…');render();
  try{const context=await readLocalSourceContext();const result=collectLocalCandidates(selected,context);const notes=[];if (!context.myPlaylistAvailable) notes.push('My Playlist snapshot skipped while temporary catalog is active');if (!context.loadedXtream) notes.push('Xtream loaded lane uses only an account already loaded in Playlist Manager');const base=`Local scan complete · ${result.candidates.length} unique local candidate${result.candidates.length===1?'':'s'}`;state.setScanResult({candidates:result.candidates,lanes:result.lanes,message:notes.length?`${base} · ${notes.join(' · ')}`:base});} catch (error) {state.setScanError(error?.message||String(error));}render();
}

function cancelExternalDiscovery(){if(externalController&&!externalController.signal.aborted)externalController.abort(new DOMException('External discovery cancelled','AbortError'));externalController=null;}
async function previewNewXtreamSources(){
  cancelVerification();cancelExternalDiscovery();const selected=syncSelectedChannel();if(!selected){render();return;}
  const name=$('discovery-xtream-name')?.value.trim()||'';const server=$('discovery-xtream-server')?.value.trim()||'';const username=$('discovery-xtream-username')?.value.trim()||'';const password=$('discovery-xtream-password')?.value||'';
  if(!server||!username||!password){state.setExternalError('New Xtream preview requires server, username and password');render();return;}
  state.setExternalScanning('Testing new Xtream login and loading a short-lived preview…');render();
  try{
    const result=await discoverNewXtreamPreview(selected,{name,server,username,password});
    state.mergeExternalResult({provider:NEW_XTREAM_PREVIEW_PROVIDER,lane:'newXtreamPreview',candidates:result.candidates,count:result.candidates.length,message:`New Xtream preview complete · ${result.candidates.length} matching candidate${result.candidates.length===1?'':'s'} · ${result.streamsScanned} streams scanned · preview expires ${result.expiresAt||'soon'} · nothing saved`});
  }catch(error){state.setExternalError(`New Xtream preview failed · ${error?.message||error}`);}
  finally{const userInput=$('discovery-xtream-username');const passInput=$('discovery-xtream-password');if(userInput)userInput.value='';if(passInput)passInput.value='';render();}
}
async function scanAuthorizedXtreamSources(){
  cancelVerification();cancelExternalDiscovery();const selected=syncSelectedChannel();if(!selected){render();return;}
  externalController=new AbortController();state.setExternalScanning('Searching saved authorized Xtream accounts…');render();
  try{const result=await discoverAuthorizedXtream(selected,{signal:externalController.signal});state.mergeExternalResult({provider:AUTHORIZED_XTREAM_DISCOVERY_PROVIDER,lane:'authorizedXtream',candidates:result.candidates,count:result.candidates.length,message:`Authorized Xtream complete · ${result.candidates.length} candidate${result.candidates.length===1?'':'s'} · ${result.reports.length} account${result.reports.length===1?'':'s'} checked · credentials stayed in Xtream bridge`});}
  catch(error){if(error?.name==='AbortError')state.setExternalIdle('Authorized Xtream cancelled');else state.setExternalError(`Authorized Xtream failed · ${error?.message||error}`);}finally{externalController=null;render();}
}
async function scanExternalProvider(provider){
  cancelVerification();cancelExternalDiscovery();const selected=syncSelectedChannel();if(!selected){render();return;}const freshness=state.snapshot().freshness;
  const meta=provider===GITHUB_PUBLIC_PLAYLISTS_PROVIDER?{label:'GitHub Public Playlists',lane:'githubPublicPlaylists',run:discoverGithubPublicPlaylists}:provider===RECENT_WEB_SEARCH_PROVIDER?{label:'Recent Web Search',lane:'recentWebSearch',run:discoverRecentWebSearch}:provider===STRM_SPECIFIC_DISCOVERY_PROVIDER?{label:'STRM Discovery',lane:'strmSpecific',run:discoverStrmSpecific}:provider===OFFICIAL_PROVIDER_LANE?{label:'Official Sources',lane:'officialProvider',run:discoverOfficialProvider}:{label:'Curated Remote Feeds',lane:'curatedRemoteFeeds',run:discoverCuratedRemoteFeeds};
  externalController=new AbortController();state.setExternalScanning(`Searching ${meta.label} · requested window ${freshness}…`);render();
  try{const result=await meta.run(selected,{freshness,signal:externalController.signal});const note=result.freshnessApplied?`freshness applied · ${result.freshnessRequested}`:provider===STRM_SPECIFIC_DISCOVERY_PROVIDER?'live STRM resolution; publication age unavailable':provider===OFFICIAL_PROVIDER_LANE?'live official registry check; publication age unavailable':'live feed check; per-entry age unavailable';state.mergeExternalResult({provider,lane:meta.lane,candidates:result.candidates,count:result.candidates.length,message:`${meta.label} complete · ${result.candidates.length} candidate${result.candidates.length===1?'':'s'} · ${note}`});}
  catch(error){if(error?.name==='AbortError')state.setExternalIdle(`${meta.label} cancelled`);else state.setExternalError(`${meta.label} failed · ${error?.message||error}`);}finally{externalController=null;render();}
}
async function scanExternalSources(){return scanExternalProvider(CURATED_REMOTE_FEEDS_PROVIDER);}
async function scanGithubSources(){return scanExternalProvider(GITHUB_PUBLIC_PLAYLISTS_PROVIDER);}
async function scanRecentWebSources(){return scanExternalProvider(RECENT_WEB_SEARCH_PROVIDER);}
async function scanStrmSources(){return scanExternalProvider(STRM_SPECIFIC_DISCOVERY_PROVIDER);}
async function scanOfficialSources(){return scanExternalProvider(OFFICIAL_PROVIDER_LANE);}

function cancelVerification(){if(verificationController&&!verificationController.signal.aborted)verificationController.abort(new DOMException('Verification cancelled','AbortError'));verificationController=null;}
async function verifyOne(candidateId){cancelVerification();const candidate=state.snapshot().candidates.find(item=>item.candidateId===candidateId);if(!candidate||['official-page','official-embed'].includes(candidate.candidateKind))return;verificationController=new AbortController();state.setVerificationRunning(`Verifying ${candidate.sourceType.toUpperCase()} candidate…`);render();try{const [result]=await verifyCandidates([candidate],{signal:verificationController.signal});if(result)state.replaceCandidate(withVerification(candidate,result));state.setVerificationMessage(result?`Verification complete · ${result.status}`:'Verifier returned no result','done');}catch(error){state.setVerificationMessage(error?.name==='AbortError'?'Verification cancelled':`Verification failed · ${error?.message||error}`,error?.name==='AbortError'?'idle':'error');}finally{verificationController=null;render();}}
async function verifyAll(){cancelVerification();const candidates=state.snapshot().candidates.filter(item=>!['official-page','official-embed'].includes(item.candidateKind));if(!candidates.length){state.setVerificationMessage('No media candidates require verification','done');render();return;}verificationController=new AbortController();state.setVerificationRunning(`Verifying ${candidates.length} candidate${candidates.length===1?'':'s'} · max 2 concurrently…`);render();let completed=0;try{await verifyWithConcurrency(candidates,{signal:verificationController.signal,onResult:(result,_index,original)=>{if(result)state.replaceCandidate(withVerification(original,result));completed++;state.setVerificationRunning(`Verification ${completed}/${candidates.length} complete…`);render();}});const summary=verificationSummary(state.snapshot());state.setVerificationMessage(`Verification complete · ${summary.VERIFIED} verified · ${summary.FAILED} failed`,'done');}catch(error){state.setVerificationMessage(error?.name==='AbortError'?`Verification cancelled · ${completed}/${candidates.length} completed`:`Verification failed · ${error?.message||error}`,error?.name==='AbortError'?'idle':'error');}finally{verificationController=null;render();}}

async function promoteOne(candidateId){
  const snapshot=state.snapshot();const candidate=snapshot.candidates.find(item=>item.candidateId===candidateId);if(!candidate)throw new Error('Candidate not found');promotionBusy.add(candidateId);promotionMessages.set(candidateId,'Saving verified source to My Playlist…');render();
  try{const result=await promoteCandidate(candidate,{expectedChannel:snapshot.channel});promotionMessages.set(candidateId,`Saved ✓ best source kept · ${result.result?.kept?.length||0}/3 source${(result.result?.kept?.length||0)===1?'':'s'} in My Playlist`);window.dispatchEvent(new CustomEvent('webtv:discovery-promoted',{detail:{candidateId,kind:'source'}}));return result;}
  catch(error){promotionMessages.set(candidateId,`Save blocked · ${error?.message||error}`);throw error;}
  finally{promotionBusy.delete(candidateId);render();}
}
async function keepXtreamAccountOne(candidateId){
  const candidate=state.snapshot().candidates.find(item=>item.candidateId===candidateId);if(!candidate)throw new Error('Candidate not found');promotionBusy.add(candidateId);promotionMessages.set(candidateId,'Checking secure Xtream account…');render();
  try{const result=await keepXtreamAccount(candidate);promotionMessages.set(candidateId,`Full Xtream account already stored securely ✓ · ${result.account.name||result.account.server||result.account.id}`);window.dispatchEvent(new CustomEvent('webtv:discovery-promoted',{detail:{candidateId,kind:'xtream-account',accountRef:result.account.id}}));return result;}
  catch(error){promotionMessages.set(candidateId,`Xtream account check failed · ${error?.message||error}`);throw error;}
  finally{promotionBusy.delete(candidateId);render();}
}
async function promotePreviewXtreamChannelOne(candidateId){
  const snapshot=state.snapshot();const candidate=snapshot.candidates.find(item=>item.candidateId===candidateId);if(!candidate)throw new Error('Candidate not found');promotionBusy.add(candidateId);promotionMessages.set(candidateId,'Creating permanent channel-only Xtream source…');render();
  try{const result=await promotePreviewXtreamChannel(candidate,{expectedChannel:snapshot.channel});promotionMessages.set(candidateId,`Channel-only Xtream source saved ✓ · full account was not added`);window.dispatchEvent(new CustomEvent('webtv:discovery-promoted',{detail:{candidateId,kind:'xtream-channel',sourceId:result.source.id}}));return result;}
  catch(error){promotionMessages.set(candidateId,`Channel-only save failed · ${error?.message||error}`);throw error;}
  finally{promotionBusy.delete(candidateId);render();}
}
async function saveFullXtreamAccountOne(candidateId){
  const snapshot=state.snapshot();const candidate=snapshot.candidates.find(item=>item.candidateId===candidateId);if(!candidate)throw new Error('Candidate not found');promotionBusy.add(candidateId);promotionMessages.set(candidateId,'Saving full Xtream account securely…');render();
  try{const result=await saveFullXtreamAccountFromCandidate(candidate,{expectedChannel:snapshot.channel});promotionMessages.set(candidateId,`Full Xtream account saved securely ✓ · ${result.account.name||result.account.server||result.account.id} · channel was not added automatically`);window.dispatchEvent(new CustomEvent('webtv:discovery-promoted',{detail:{candidateId,kind:'xtream-account',accountRef:result.account.id}}));return result;}
  catch(error){promotionMessages.set(candidateId,`Full Xtream account save failed · ${error?.message||error}`);throw error;}
  finally{promotionBusy.delete(candidateId);render();}
}

function openPanel(){ensureUi();state.setChannel(selectedChannelSnapshot());state.setOpen(true);render();}
function closePanel(){cancelExternalDiscovery();cancelVerification();state.setOpen(false);state.setExternalIdle('');state.setVerificationMessage('','idle');render();}

ensureUi();
const api=Object.freeze({buildId:BUILD_ID,open:openPanel,close:closePanel,scanLocal:scanLocalSources,scanExternal:scanExternalSources,scanGithub:scanGithubSources,scanRecentWeb:scanRecentWebSources,scanStrm:scanStrmSources,scanOfficial:scanOfficialSources,scanAuthorizedXtream:scanAuthorizedXtreamSources,previewNewXtream:previewNewXtreamSources,verifyOne,verifyAll,promoteOne,keepXtreamAccount:keepXtreamAccountOne,promotePreviewXtreamChannel:promotePreviewXtreamChannelOne,saveFullXtreamAccount:saveFullXtreamAccountOne,cancelExternalDiscovery,cancelVerification,snapshot:()=>state.snapshot()});
window.WebTVDiscovery=api;
window.WebTVDiscoveryPhase1=api;
console.info(`[WebTV] Discovery Phase 5.2 loaded · ${BUILD_ID} · explicit new-Xtream channel/full-account choice · raw credentials are not stored in Discovery`);
