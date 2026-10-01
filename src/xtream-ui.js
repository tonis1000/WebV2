import {
  listXtreamAccounts,
  previewXtreamAccount,
  deleteXtreamAccount,
  loadXtreamChannels,
  xtreamChannelsToM3U,
  summarizeXtreamChannels,
  xtreamBridgeUrl,
  setXtreamBridgeUrl,
} from './xtream-client.js?v=20261001-xtream-preview-owner';
import { XTREAM_PAGE_SIZE, filterXtreamChannels, pageXtreamChannels, summarizeXtreamGroups } from './xtream-catalog-view.js';
import { createCandidate, withVerification } from './discovery/candidate-model.js';
import { verifyCandidates } from './discovery/verifier-client.js';
import { previewChoiceBlockReason } from './xtream-preview-policy.js';

const $ = id => document.getElementById(id);
const FILTER_DEBOUNCE_MS=150;
let accounts = [];
let loaded = null;
let previewController=null;
let filterTimer=null;
let previewGeneration=0;
let previewState={phase:'idle',previewToken:'',expiresAt:'',account:null,channels:[],group:'',query:'',page:0,selected:null,candidate:null};

function setStatus(text, tone = 'idle') {
  const el = $('xtream-status');
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone;
}

async function ensureUiSession() {
  const auth = window.WebTVRegistryAuth;
  if (!auth?.ensureSession) throw new Error('Trusted-device auth is not ready. Reload the page once.');
  setStatus('Checking trusted-device access…', 'busy');
  const ok = await auth.ensureSession({ interactive: true });
  if (!ok) throw new Error('Trusted-device session required');
  return true;
}

function selectedMode() {
  return document.querySelector('input[name="playlist-mode"]:checked')?.value || 'replace';
}

function activateLoadedAccountChannel(channel) {
  const bridge = window.WebTVPlaylistAPI;
  const catalog = bridge?.getChannels?.() || [];
  const wantedId = String(channel?.tvgId || channel?.id || channel?.streamId || channel?.name || '');
  const match = catalog.find(item => {
    const itemId = String(item?.originalId || item?.id || item?.name || '');
    return (wantedId && itemId === wantedId) || String(item?.name || '') === String(channel?.name || '');
  });
  if (!match) {
    setStatus(`Could not find ${channel?.name || 'channel'} in the temporary sidebar`, 'error');
    return;
  }
  const row = [...document.querySelectorAll('#channel-list [data-channel-id]')]
    .find(el => String(el.dataset.channelId || '') === String(match.id || ''));
  if (!row) {
    setStatus(`Channel row for ${channel?.name || 'channel'} is not available`, 'error');
    return;
  }
  row.click();
  setStatus(`${channel.name} selected · close Playlist Manager to view playback`, 'ok');
}

function renderLoadedAccountPreview(channels, account) {
  const box = $('playlist-preview');
  if (!box) return;
  const summary = summarizeXtreamChannels(channels);
  box.innerHTML = '';
  const top = document.createElement('div');
  top.className = 'playlist-preview-top';
  top.innerHTML = `<strong>Xtream · ${escapeHtml(account?.name || 'Account')}</strong><span>${summary.count} channels · ${summary.groups} groups</span>`;
  box.appendChild(top);
  const chips = document.createElement('div');
  chips.className = 'playlist-preview-chips';
  for (const channel of channels.slice(0, 8)) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'button ghost mini';
    chip.textContent = channel.name;
    chip.title = `Play ${channel.name}`;
    chip.addEventListener('click', () => activateLoadedAccountChannel(channel));
    chips.appendChild(chip);
  }
  if (summary.count > 8) {
    const more = document.createElement('span');
    more.textContent = `+${summary.count - 8} more`;
    chips.appendChild(more);
  }
  box.appendChild(chips);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

function renderAccounts() {
  const select = $('xtream-account-select');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Choose account</option>';
  for (const account of accounts) {
    const option = document.createElement('option');
    option.value = account.id;
    option.textContent = `${account.name || account.server} · ${account.server}`;
    select.appendChild(option);
  }
  if (accounts.some(a => a.id === current)) select.value = current;
}

async function refreshAccounts({ quiet = false, interactive = true } = {}) {
  try {
    if (interactive) await ensureUiSession();
    if (!quiet) setStatus('Loading Xtream accounts…', 'busy');
    accounts = await listXtreamAccounts();
    renderAccounts();
    if (!quiet) setStatus(`${accounts.length} Xtream account${accounts.length === 1 ? '' : 's'} ready`, 'ok');
    return accounts;
  } catch (error) {
    if (!quiet) setStatus(error.message, 'error');
    throw error;
  }
}

function selectedPreviewIdentity(channel=previewState.selected){
  if(!channel)return null;
  return {id:String(channel.tvgId||channel.streamId||channel.name||''),originalId:String(channel.tvgId||channel.streamId||channel.name||''),tvgId:String(channel.tvgId||''),name:String(channel.name||'')};
}
function previewPersistenceReason(){
  const identity=selectedPreviewIdentity();
  if(!identity||!previewState.candidate)return 'Verify one preview channel first';
  return previewChoiceBlockReason(previewState.candidate,{expectedChannel:identity,currentChannel:identity});
}
function updatePreviewActions(){
  const verify=$('xtream-preview-verify');
  const saveChannel=$('xtream-preview-save-channel');
  const saveAccount=$('xtream-preview-save-account');
  if(verify)verify.disabled=!previewState.selected||previewState.phase==='verifying';
  const blocked=Boolean(previewPersistenceReason());
  if(saveChannel)saveChannel.disabled=blocked;
  if(saveAccount)saveAccount.disabled=blocked;
}
function createPreviewCandidate(channel){
  return createCandidate({
    channelName:String(channel?.name||''),
    sourceType:'xtream-preview',
    sourceUrl:String(channel?.playbackUrl||''),
    sourceOrigin:`Xtream preview · ${previewState.account?.name||previewState.account?.server||'New account'}`,
    discoveryProvider:'xtream-account-management-preview',
    verificationStatus:'UNVERIFIED',
    matchConfidence:'HIGH',
    candidateKind:'xtream-preview',
    saveEligible:false,
    xtreamStreamId:String(channel?.streamId||''),
    xtreamPreviewToken:previewState.previewToken,
    xtreamPreviewServer:String(previewState.account?.server||''),
    xtreamPreviewExpiresAt:previewState.expiresAt,
  });
}
function renderPreviewSelection(){
  const out=$('xtream-preview-selection');
  if(!out)return;
  out.replaceChildren();
  if(!previewState.selected){out.textContent='Select one channel to verify before saving.';updatePreviewActions();return;}
  const strong=document.createElement('strong');strong.textContent=previewState.selected.name||`Stream ${previewState.selected.streamId}`;
  const detail=document.createElement('span');detail.textContent=`${previewState.selected.group||'Xtream'} · ${previewState.candidate?.verificationStatus||'UNVERIFIED'}`;
  out.append(strong,detail);
  updatePreviewActions();
}
function selectPreviewChannel(channel){
  previewState.selected=channel;
  previewState.candidate=createPreviewCandidate(channel);
  previewState.phase='preview-ready';
  renderPreviewCatalog();
  renderPreviewSelection();
  setStatus(`${channel.name} selected for verification · nothing saved`, 'idle');
}
function filteredPreviewChannels(){return filterXtreamChannels(previewState.channels,{group:previewState.group,query:previewState.query});}
function renderPreviewCatalog(){
  const box=$('xtream-preview-catalog');
  if(!box)return;
  box.replaceChildren();
  const filtered=filteredPreviewChannels();
  const totalPages=Math.max(1,Math.ceil(filtered.length/XTREAM_PAGE_SIZE));
  previewState.page=Math.min(Math.max(0,previewState.page),totalPages-1);
  const rows=pageXtreamChannels(filtered,previewState.page);
  for(const channel of rows){
    const row=document.createElement('button');row.type='button';row.className='xtream-preview-row button ghost';row.dataset.streamId=String(channel.streamId||'');
    if(String(previewState.selected?.streamId||'')===String(channel.streamId||''))row.setAttribute('aria-pressed','true');
    if(channel.logo){const img=document.createElement('img');img.src=channel.logo;img.alt='';img.loading='lazy';img.width=28;img.height=28;row.appendChild(img);}
    const text=document.createElement('span');const name=document.createElement('strong');name.textContent=channel.name||`Stream ${channel.streamId}`;const group=document.createElement('small');group.textContent=channel.group||'Xtream';text.append(name,group);row.appendChild(text);row.addEventListener('click',()=>selectPreviewChannel(channel));box.appendChild(row);
  }
  const pageInfo=$('xtream-preview-page-info');if(pageInfo)pageInfo.textContent=`${filtered.length} matches · page ${previewState.page+1}/${totalPages} · max ${XTREAM_PAGE_SIZE} visible`;
  const prev=$('xtream-preview-prev');if(prev)prev.disabled=previewState.page<=0;
  const next=$('xtream-preview-next');if(next)next.disabled=previewState.page>=totalPages-1;
}
function renderPreviewControls(){
  const group=$('xtream-preview-group');if(!group)return;
  const current=previewState.group;group.replaceChildren();
  const all=document.createElement('option');all.value='';all.textContent='All groups';group.appendChild(all);
  for(const item of summarizeXtreamGroups(previewState.channels)){const option=document.createElement('option');option.value=item.group;option.textContent=`${item.group} (${item.count})`;group.appendChild(option);}
  group.value=current;
  const summary=$('xtream-preview-summary');if(summary){const expires=previewState.expiresAt?new Date(previewState.expiresAt).toLocaleTimeString():'';summary.textContent=`${previewState.account?.name||previewState.account?.server||'Account'} · ${previewState.channels.length} channels · ${summarizeXtreamGroups(previewState.channels).length} groups${expires?` · preview until ${expires}`:''}`;}
}
function renderPreviewReady(){
  const panel=$('xtream-preview-panel');if(panel)panel.hidden=false;
  renderPreviewControls();renderPreviewCatalog();renderPreviewSelection();
}
function clearPreviewState({message='Preview cancelled'}={}){
  previewGeneration+=1;
  previewController?.abort(new DOMException('Xtream preview cancelled','AbortError'));
  previewController=null;
  if(filterTimer){clearTimeout(filterTimer);filterTimer=null;}
  previewState={phase:'idle',previewToken:'',expiresAt:'',account:null,channels:[],group:'',query:'',page:0,selected:null,candidate:null};
  const panel=$('xtream-preview-panel');if(panel)panel.hidden=true;
  setStatus(message,'idle');
}
async function testPreviewAccount(){
  const button=$('xtream-connect-save');
  const name=$('xtream-name')?.value.trim()||'';
  const server=$('xtream-server')?.value.trim()||'';
  const username=$('xtream-username')?.value.trim()||'';
  const password=$('xtream-password')?.value||'';
  if(!server||!username||!password){setStatus('Server, username and password are required','error');return;}
  const generation=++previewGeneration;
  previewController?.abort(new DOMException('Superseded by a newer Xtream preview','AbortError'));
  previewController=new AbortController();
  previewState={phase:'previewing',previewToken:'',expiresAt:'',account:null,channels:[],group:'',query:'',page:0,selected:null,candidate:null};
  try{
    if(button)button.disabled=true;
    await ensureUiSession();
    setStatus('Testing Xtream login · preview only · nothing will be saved…','busy');
    const result=await previewXtreamAccount({name,server,username,password},{signal:previewController.signal});
    if(generation!==previewGeneration)return;
    if(!result.previewToken)throw new Error('Xtream bridge did not return a preview token');
    previewState={phase:'preview-ready',previewToken:result.previewToken,expiresAt:String(result.expiresAt||''),account:result.account||{name,server},channels:Array.isArray(result.channels)?result.channels:[],group:'',query:'',page:0,selected:null,candidate:null};
    renderPreviewReady();
    setStatus(`Preview ready · ${previewState.channels.length} live channels · nothing saved`, 'ok');
  }catch(error){
    if(generation!==previewGeneration)return;
    if(error?.name==='AbortError')setStatus('Xtream preview cancelled','idle');
    else setStatus(`Xtream preview failed · ${error.message}`,'error');
  }finally{
    if($('xtream-username')) $('xtream-username').value = '';
    if($('xtream-password')) $('xtream-password').value = '';
    if(button)button.disabled=false;
  }
}
async function verifySelectedPreview(){
  const candidate=previewState.candidate;if(!candidate||!previewState.selected){setStatus('Select a preview channel first','error');return;}
  const generation=previewGeneration;const streamId=String(previewState.selected.streamId||'');previewState.phase='verifying';updatePreviewActions();setStatus(`Verifying ${previewState.selected.name}…`,'busy');
  try{
    const [result]=await verifyCandidates([candidate]);
    if(generation!==previewGeneration||streamId!==String(previewState.selected?.streamId||''))return;
    previewState.candidate=withVerification(candidate,result||{status:'FAILED',verified:false,detail:'No verifier result'});
    previewState.phase=previewState.candidate.verificationStatus==='VERIFIED'?'verified':'failed';
    renderPreviewSelection();
    const reason=previewPersistenceReason();
    setStatus(reason?`${previewState.selected.name} · ${previewState.candidate.verificationStatus} · ${reason}`:`${previewState.selected.name} VERIFIED · explicit save actions unlocked`,reason?'error':'ok');
  }catch(error){
    if(generation!==previewGeneration)return;
    previewState.phase='failed';setStatus(`Verification failed · ${error.message}`,'error');renderPreviewSelection();
  }
}
function requestPreviewPersistence(kind){
  const reason=previewPersistenceReason();if(reason){setStatus(reason,'error');return;}
  window.dispatchEvent(new CustomEvent(kind==='channel'?'webtv:xtream-preview-save-channel-request':'webtv:xtream-preview-save-account-request',{detail:{candidate:previewState.candidate,account:previewState.account,channel:previewState.selected}}));
  setStatus(kind==='channel'?'Verified channel ready for destination selection':'Verified preview ready for explicit full-account save','ok');
}

async function loadSelectedAccount() {
  const accountId = $('xtream-account-select')?.value || '';
  if (!accountId) {setStatus('Choose an Xtream account first', 'error');return;}
  try {
    await ensureUiSession();
    setStatus('Loading saved Xtream live channels into temporary sidebar…', 'busy');
    loaded = await loadXtreamChannels(accountId);
    if (!loaded.channels.length) throw new Error('No live channels returned by this Xtream account');
    const text = xtreamChannelsToM3U(loaded.channels, loaded.account || {});
    const bridge = window.WebTVPlaylistAPI;
    if (!bridge?.applyText) throw new Error('WebTV playlist bridge is not ready');
    const label = `Xtream · ${loaded.account?.name || loaded.account?.server || accountId}`;
    const result = bridge.applyText(text, { mode: selectedMode(), label });
    renderLoadedAccountPreview(loaded.channels, loaded.account);
    setStatus(`${result.imported} saved-account channels loaded temporarily · ${selectedMode()}`, 'ok');
  } catch (error) {setStatus(error.message, 'error');}
}

async function removeSelectedAccount() {
  const accountId = $('xtream-account-select')?.value || '';
  if (!accountId) return;
  const account = accounts.find(a => a.id === accountId);
  if (!confirm(`Delete Xtream account “${account?.name || account?.server || accountId}”? Channels already saved in My Playlist will stop working until their source is replaced.`)) return;
  try {await ensureUiSession();setStatus('Deleting Xtream account…', 'busy');await deleteXtreamAccount(accountId);loaded = null;await refreshAccounts({ quiet: true, interactive: false });setStatus('Xtream account deleted', 'idle');}
  catch (error) {setStatus(error.message, 'error');}
}

function saveBridgeSetting() {
  const input = $('xtream-bridge-url');if (!input) return;
  try {const url = setXtreamBridgeUrl(input.value);input.value = url;setStatus('Xtream bridge URL saved on this device', 'ok');}
  catch (error) {setStatus(error.message, 'error');}
}

async function runAuthDiagnostics() {
  const out = $('xtream-diagnostics-output');const button = $('xtream-auth-diagnostics');if (!out) return;if (button) button.disabled = true;out.hidden = false;out.textContent = 'Running diagnostics…';
  const lines = [];const token = localStorage.getItem('webtv_v2_registry_token') || '';lines.push(`Token present: ${token ? 'YES' : 'NO'}${token ? ` (${token.length} chars)` : ''}`);
  try {const r = await fetch('https://webtv-registry.atonis.workers.dev/api/session', {headers: token ? { authorization: `Bearer ${token}` } : {},cache: 'no-store'});lines.push(`Registry /api/session: ${r.status}`);} catch (error) {lines.push(`Registry /api/session: ERROR ${error.message}`);}
  try {const r = await fetch('https://webtv-registry.atonis.workers.dev/api/session/validate', {method: 'POST',headers: { 'content-type': 'application/json' },body: JSON.stringify({ token }),cache: 'no-store'});let body = '';try { body = await r.text(); } catch {}lines.push(`Registry /api/session/validate: ${r.status}${body ? ` · ${body.slice(0, 160)}` : ''}`);} catch (error) {lines.push(`Registry /api/session/validate: ERROR ${error.message}`);}
  try {const r = await fetch(`${xtreamBridgeUrl()}/api/status?diag=${Date.now()}`, { cache: 'no-store' });let body = {};try { body = await r.json(); } catch {}lines.push(`Xtream bridge /api/status: ${r.status} · version ${body.version || '?'} · service ${body.service || '?'}`);} catch (error) {lines.push(`Xtream bridge /api/status: ERROR ${error.message}`);}
  try {const r = await fetch(`${xtreamBridgeUrl()}/api/accounts?diag=${Date.now()}`, {headers: token ? { 'x-webtv-session': token, authorization: `Bearer ${token}` } : {},cache: 'no-store'});let body = '';try { body = await r.text(); } catch {}lines.push(`Xtream /api/accounts auth: ${r.status}${body ? ` · ${body.slice(0, 180)}` : ''}`);} catch (error) {lines.push(`Xtream /api/accounts auth: ERROR ${error.message}`);}
  out.textContent = lines.join('\n');if (button) button.disabled = false;
}

function bindPreviewControls(){
  $('xtream-connect-save')?.addEventListener('click',testPreviewAccount);
  $('xtream-preview-cancel')?.addEventListener('click',()=>clearPreviewState({message:'Xtream preview cancelled · nothing saved'}));
  $('xtream-preview-verify')?.addEventListener('click',verifySelectedPreview);
  $('xtream-preview-save-channel')?.addEventListener('click',()=>requestPreviewPersistence('channel'));
  $('xtream-preview-save-account')?.addEventListener('click',()=>requestPreviewPersistence('account'));
  $('xtream-preview-group')?.addEventListener('change',event=>{previewState.group=event.target.value;previewState.page=0;previewGeneration+=1;renderPreviewCatalog();renderPreviewSelection();});
  $('xtream-preview-query')?.addEventListener('input',event=>{const value=event.target.value;if(filterTimer)clearTimeout(filterTimer);const generation=++previewGeneration;filterTimer=setTimeout(()=>{if(generation!==previewGeneration)return;previewState.query=value;previewState.page=0;renderPreviewCatalog();},FILTER_DEBOUNCE_MS);});
  $('xtream-preview-prev')?.addEventListener('click',()=>{previewState.page=Math.max(0,previewState.page-1);renderPreviewCatalog();});
  $('xtream-preview-next')?.addEventListener('click',()=>{previewState.page+=1;renderPreviewCatalog();});
}

function injectUi() {
  const grid = document.querySelector('#playlist-manager .playlist-manager-grid');
  if (!grid || $('xtream-tool-card')) return;
  const card = document.createElement('article');card.id = 'xtream-tool-card';card.className = 'playlist-tool-card xtream-tool-card';
  card.innerHTML = `
    <div class="playlist-tool-title"><span class="playlist-tool-icon">👤</span><div><strong>Xtream · User & Pass</strong><span>Test credentials safely first. Preview stays temporary until you explicitly verify a channel and choose what to save.</span></div></div>
    <input id="xtream-name" type="text" placeholder="Account name (π.χ. Provider A)">
    <input id="xtream-server" type="url" placeholder="http://server.example:8080">
    <div class="xtream-credentials-row"><input id="xtream-username" type="text" autocomplete="username" placeholder="Username"><input id="xtream-password" type="password" autocomplete="current-password" placeholder="Password"></div>
    <div class="playlist-actions"><button id="xtream-connect-save" class="button playlists" type="button">Test / Preview</button><button id="xtream-preview-cancel" class="button ghost" type="button">Cancel Preview</button><button id="xtream-refresh-accounts" class="button ghost" type="button">Refresh Saved</button></div>
    <section id="xtream-preview-panel" class="xtream-preview-panel" hidden>
      <div id="xtream-preview-summary" class="playlist-manager-status"></div>
      <div class="xtream-credentials-row"><select id="xtream-preview-group" aria-label="Preview group"><option value="">All groups</option></select><input id="xtream-preview-query" type="search" placeholder="Filter preview channels" autocomplete="off"></div>
      <div id="xtream-preview-catalog" class="xtream-preview-catalog"></div>
      <div class="playlist-actions"><button id="xtream-preview-prev" class="button ghost mini" type="button">Previous</button><span id="xtream-preview-page-info" class="muted small"></span><button id="xtream-preview-next" class="button ghost mini" type="button">Next</button></div>
      <div id="xtream-preview-selection" class="playlist-manager-status">Select one channel to verify before saving.</div>
      <div class="playlist-actions"><button id="xtream-preview-verify" class="button ghost" type="button" disabled>Verify selected channel</button><button id="xtream-preview-save-channel" class="button playlists" type="button" disabled>Save Channel…</button><button id="xtream-preview-save-account" class="button playlists" type="button" disabled>Save Full Xtream Account</button></div>
    </section>
    <select id="xtream-account-select"><option value="">Choose saved account</option></select>
    <div class="playlist-actions"><button id="xtream-load" class="button" type="button">Load saved account channels</button><button id="xtream-delete" class="button danger" type="button">Delete account</button></div>
    <details class="xtream-advanced"><summary>Bridge settings</summary><div class="inline-form"><input id="xtream-bridge-url" type="url" value="${escapeHtml(xtreamBridgeUrl())}" aria-label="Xtream bridge URL"><button id="xtream-save-bridge" class="button ghost" type="button">Save</button></div></details>
    <div class="playlist-actions"><button id="xtream-auth-diagnostics" class="button ghost" type="button">Auth diagnostics</button></div>
    <pre id="xtream-diagnostics-output" class="diagnostic-log" hidden style="white-space:pre-wrap;max-height:220px;overflow:auto"></pre>
    <div id="xtream-status" class="playlist-manager-status" data-tone="idle">Xtream ready · Test / Preview saves nothing</div>`;
  grid.appendChild(card);
  bindPreviewControls();
  $('xtream-refresh-accounts')?.addEventListener('click', () => refreshAccounts());
  $('xtream-load')?.addEventListener('click', loadSelectedAccount);
  $('xtream-delete')?.addEventListener('click', removeSelectedAccount);
  $('xtream-save-bridge')?.addEventListener('click', saveBridgeSetting);
  $('xtream-auth-diagnostics')?.addEventListener('click', runAuthDiagnostics);
  const token = window.WebTVRegistryAuth?.token?.() || '';
  if (token) refreshAccounts({ quiet: true, interactive: false }).catch(() => {});
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectUi, { once: true });
else injectUi();

window.WebTVXtream = {
  refreshAccounts,
  loadSelectedAccount,
  runAuthDiagnostics,
  cancelPreview:clearPreviewState,
  getPreview:()=>({phase:previewState.phase,expiresAt:previewState.expiresAt,account:previewState.account,channelCount:previewState.channels.length,selected:previewState.selected,candidate:previewState.candidate}),
  getLoaded: () => loaded,
};
