import { cleanUrl, normalizeId, parseIptvUrl } from './core/utils.js?v=20260924-0900';
import { saveBestSourceToCurrent } from './source-save-policy.js?v=20260923-0815';

const BUILD_ID = '20260926-current-catalog-playback-inspector';
const LEGACY_STORAGE_KEY = 'webtv_v2_saved_sources';
const $ = id => document.getElementById(id);

const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const channelName = $('channel-name');
const diagLog = $('diagnostic-log');

try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch {}

/* ==========================================================
   Existing candidate Test -> Verify -> Save Source workflow
   ========================================================== */
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
  function resetVerification(message=''){pending=null;verified=null;saveButton.hidden=true;saveButton.disabled=false;saveButton.textContent='Save Source';status.textContent=message;}
  function beginCandidateTracking(){
    const parsed=parseIptvUrl(candidateInput.value.trim()),url=parsed.url;
    const selected=window.WebTVPlaylistAPI?.getSelectedChannel?.();
    const name=selected?.name||'';
    if(!url||!/^https?:\/\//i.test(url)||!name){resetVerification();return;}
    pending={
      url,
      hasRequestHeaders:Object.keys(parsed.headers).length>0,
      channelName:name,
      channelKey:normalizeId(name),
      startedAt:Date.now(),
      oneClick:window.WebTVSourceHuntBusy===true
    };
    verified=null;saveButton.hidden=true;
    status.textContent=pending.oneClick?'Testing automatically…':'Testing… playback must start before Save Source is enabled.';
  }

  async function persistSnapshot(snapshot){
    if(!snapshot)return;
    if(snapshot.headerDependent){
      saveButton.hidden=true;
      status.textContent='Verified ✓ via temporary request headers. Not saved to D1 because persistent header metadata is not supported yet.';
      log(`SOURCE NOT SAVED ${snapshot.channelName} · header-dependent transport is temporary by policy`);
      return {kept:[],dropped:[]};
    }
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

  function inspectDiagnostics(snapshot=window.WebTVDiagnosticsAPI?.getSnapshot?.()||{}){
    if(!pending||verified)return;
    const player=String(snapshot.player||'-').trim();
    const source=cleanUrl(snapshot.source||'');
    const startupMs=Number(snapshot.startupMs||0);
    const route=String(snapshot.route||'').trim();
    if(!source||source!==pending.url)return;

    if(player!=='-'&&player!=='failed'&&startupMs>0&&snapshot.playbackState==='live'){
      const headerDependent=pending.hasRequestHeaders&&route.includes('headers');
      verified={...pending,route,player,startupMs,headerDependent,verifiedAt:new Date().toISOString()};

      if(headerDependent){
        saveButton.hidden=true;
        status.textContent=`Verified ✓ ${startupMs} ms via request headers. Temporary playback only; D1 save is intentionally disabled.`;
        log(`CANDIDATE VERIFIED TEMPORARY ${pending.channelName} · ${pending.url} · ${route} · ${startupMs} ms`);
        return;
      }

      saveButton.hidden=pending.oneClick;
      saveButton.disabled=false;
      status.textContent=pending.oneClick?`Verified ✓ ${startupMs} ms · selecting as best source…`:`Verified ✓ ${startupMs} ms. Click Save Source to keep it.`;
      log(`CANDIDATE VERIFIED ${pending.channelName} · ${pending.url} · ${route||player} · ${startupMs} ms`);
      return;
    }

    if(player==='failed'&&snapshot.playbackState==='error'){
      const failed={...pending};
      pending=null;
      saveButton.hidden=true;
      status.textContent=failed.oneClick?'Candidate failed · trying next…':'Candidate failed · only this source was tested.';
    }
  }

  testButton.addEventListener('click',beginCandidateTracking,true);
  candidateInput.addEventListener('input',()=>resetVerification());
  window.addEventListener('webtv:diagnostics-updated',event=>inspectDiagnostics(event.detail||{}));

  window.addEventListener('webtv:source-policy-saved',event=>{
    const detail=event.detail||{};
    if(verified&&!verified.headerDependent&&cleanUrl(detail.winner||'')===cleanUrl(verified.url)){
      saveButton.hidden=true;
      status.textContent=`Saved ✓ best source kept · ${(detail.kept||[]).length}/3 curated sources in D1.`;
    }
  });
  saveButton.addEventListener('click',()=>{if(verified&&!verified.headerDependent)enqueueVerified({...verified}).catch(()=>{});});
  log(`Saved Sources UI loaded · build ${BUILD_ID} · manual test supports temporary header-aware playback · explicit save required`);
}

/* ==========================================================
   Current Catalog identity + Current Playback Source Inspector
   ========================================================== */
let currentCatalog = {
  type: 'my-playlist',
  typeLabel: 'My Playlist',
  name: 'My Playlist',
  source: 'Cloudflare D1',
  mode: 'cloud',
  count: 0,
};
let catalogTrackingInstalled = false;
let membershipTimer = null;
let inspectorSelectedSource = '';
let inspectorSelectedChannel = '';
let inspectorPlaybackSnapshot = {source:'',route:'-',player:'',startupMs:0,playbackState:'idle',playbackLabel:'Idle'};

function injectInspectorStyles(){
  if($('current-playback-inspector-styles'))return;
  const style=document.createElement('style');
  style.id='current-playback-inspector-styles';
  style.textContent=`
    .current-catalog-badge{display:inline-flex;align-items:center;gap:6px;max-width:300px;padding:7px 10px;border:1px solid #35566f;border-radius:10px;background:#0d1720;color:#bfe0ff;font-size:.78rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default}
    .current-catalog-card{margin:0 0 12px;padding:11px 12px;border:1px solid #35566f;border-radius:11px;background:#0c141c;display:grid;gap:5px}
    .current-catalog-card strong{color:#d8ebff}.current-catalog-card span{font-size:.78rem;color:var(--muted);overflow-wrap:anywhere}
    .playback-inspector{margin-top:12px;padding:12px;border:1px solid #35566f;border-radius:12px;background:#0a1118}
    .playback-inspector h3{margin:0 0 8px}.playback-inspector label{display:block;margin:9px 0 5px;font-size:.75rem;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.05em}
    .playback-source-full{width:100%;min-height:86px;resize:vertical;box-sizing:border-box;padding:9px 10px;border:1px solid #385268;border-radius:9px;background:#080d12;color:#d7ebff;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}
    .playback-route-full{padding:8px 10px;border:1px solid #283b4c;border-radius:8px;background:#080d12;color:#9fc6e7;font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere;white-space:normal}
    .playback-inspector-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.playback-inspector-actions .button{padding:7px 10px}
    .playback-inspector-status{margin-top:9px;padding:7px 9px;border-radius:8px;background:#101922;color:var(--muted);font-size:.78rem;overflow-wrap:anywhere}
    .playback-inspector-status[data-tone="ok"]{color:#8ce99a;border:1px solid #245c35}.playback-inspector-status[data-tone="error"]{color:#ff9b9b;border:1px solid #6b3030}.playback-inspector-status[data-tone="busy"]{color:#ffd166;border:1px solid #675626}
    #diag-source{white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;max-width:none!important}
    @media(max-width:780px){.current-catalog-badge{max-width:170px}.playback-inspector-actions .button{flex:1 1 45%}}
  `;
  document.head.appendChild(style);
}

function inferCatalog(label='',mode='replace',result={}){
  const raw=String(label||'Temporary Playlist').trim();
  const lower=raw.toLowerCase();
  let type='saved-playlist',typeLabel='Saved Playlist',source='';
  if(/^https?:\/\//i.test(raw)){
    type='url';typeLabel='Load by URL';source=raw;
  }else if(lower.startsWith('pasted m3u')){
    type='paste';typeLabel='Paste M3U';
  }else if(lower.startsWith('xtream ·')||lower.startsWith('xtream ')){
    type='xtream';typeLabel='Xtream';
  }
  return {type,typeLabel,name:raw,source,mode:String(mode||'replace'),count:Number(result?.total||result?.imported||0)};
}

function catalogIcon(type){
  if(type==='my-playlist')return '★';
  if(type==='xtream')return '📡';
  if(type==='url')return '↗';
  if(type==='paste')return '≡';
  return '📚';
}

function ensureCatalogBadge(){
  let badge=$('current-catalog-badge');
  if(badge)return badge;
  const actions=document.querySelector('.topbar-actions');
  const playlists=$('playlist-manager-toggle');
  if(!actions)return null;
  badge=document.createElement('span');
  badge.id='current-catalog-badge';badge.className='current-catalog-badge';
  if(playlists?.nextSibling)actions.insertBefore(badge,playlists.nextSibling);else actions.appendChild(badge);
  return badge;
}

function renderCatalogIdentity(){
  const badge=ensureCatalogBadge();
  const icon=catalogIcon(currentCatalog.type);
  const merge=currentCatalog.mode==='merge'?' · merge':'';
  if(badge){
    badge.textContent=`${icon} ${currentCatalog.typeLabel}: ${currentCatalog.name}${merge}`;
    badge.title=[`Type: ${currentCatalog.typeLabel}`,`Name: ${currentCatalog.name}`,currentCatalog.source?`Source: ${currentCatalog.source}`:'',`Mode: ${currentCatalog.mode}`,currentCatalog.count?`${currentCatalog.count} channels`:''].filter(Boolean).join('\n');
  }
  const type=$('inspector-catalog-type'),name=$('inspector-catalog-name'),source=$('inspector-catalog-source');
  if(type)type.textContent=`${currentCatalog.typeLabel}${merge}`;
  if(name)name.textContent=currentCatalog.name||'-';
  if(source)source.textContent=currentCatalog.source|| (currentCatalog.type==='my-playlist'?'Cloudflare D1':'Temporary catalog');
}

function setCurrentCatalog(next={}){
  currentCatalog={...currentCatalog,...next};
  renderCatalogIdentity();
  window.dispatchEvent(new CustomEvent('webtv:catalog-changed',{detail:{...currentCatalog}}));
}

function installCatalogTracking(){
  if(catalogTrackingInstalled)return true;
  const bridge=window.WebTVPlaylistAPI;
  if(!bridge?.applyText||!bridge?.reloadCloudMyPlaylist)return false;

  const originalApply=bridge.applyText.bind(bridge);
  const originalReload=bridge.reloadCloudMyPlaylist.bind(bridge);

  bridge.applyText=(text,options={})=>{
    const result=originalApply(text,options);
    setCurrentCatalog(inferCatalog(options.label,options.mode,result));
    return result;
  };
  bridge.reloadCloudMyPlaylist=async(options={})=>{
    const result=await originalReload(options);
    setCurrentCatalog({type:'my-playlist',typeLabel:'My Playlist',name:'My Playlist',source:'Cloudflare D1',mode:'cloud',count:Number(result?.total||0)});
    return result;
  };
  bridge.getCurrentCatalog=()=>({...currentCatalog});
  bridge.__currentCatalogTracked=true;
  catalogTrackingInstalled=true;

  const mode=bridge.getCatalogMode?.();
  if(mode==='cloud')setCurrentCatalog({type:'my-playlist',typeLabel:'My Playlist',name:'My Playlist',source:'Cloudflare D1',mode:'cloud',count:Number(bridge.getCount?.()||0)});
  else setCurrentCatalog({type:'temporary',typeLabel:'Temporary',name:'Temporary Playlist',source:'Unknown origin (loaded before tracker)',mode:'replace',count:Number(bridge.getCount?.()||0)});
  return true;
}

function sameChannel(a={},b={}){
  const left=new Set([a.id,a.originalId,a.tvgId,a.name].map(value=>normalizeId(value||'')).filter(Boolean));
  return [b.id,b.originalId,b.tvgId,b.name].map(value=>normalizeId(value||'')).filter(Boolean).some(value=>left.has(value));
}
async function getMyPlaylistTarget(){
  const selected=window.WebTVPlaylistAPI?.getSelectedChannel?.();
  if(!selected)throw new Error('No channel selected');
  const list=await window.WebTVMyPlaylistAPI?.getMyPlaylist?.();
  if(!Array.isArray(list))throw new Error('My Playlist API unavailable');
  const index=list.findIndex(item=>sameChannel(selected,item));
  return {selected,list,index,target:index>=0?{...list[index],directUrls:[...(list[index].directUrls||[])]}:null};
}
async function addExactSourceToMyPlaylist(url){
  const source=cleanUrl(url);
  if(!/^https?:\/\//i.test(source))throw new Error('Valid source URL required');
  const {target}=await getMyPlaylistTarget();
  const existing=(target?.directUrls||[]).map(cleanUrl);
  if(existing.includes(source))return {channel:target,added:false};
  const api=window.WebTVMyPlaylistAPI;
  if(typeof api?.addSourceToCurrent!=='function')throw new Error('My Playlist source API unavailable');
  const channel=await api.addSourceToCurrent(source);
  return {channel,added:true};
}
async function replaceCurrentSources(urls,reason){
  const api=window.WebTVMyPlaylistAPI;
  if(typeof api?.replaceSourcesForCurrent!=='function')throw new Error('My Playlist source API unavailable');
  return api.replaceSourcesForCurrent(urls,{reason,allowEmpty:true});
}

function setInspectorStatus(text,tone='idle'){
  const el=$('playback-inspector-status');if(!el)return;el.textContent=text;el.dataset.tone=tone;
}

function ensurePlaybackInspector(){
  injectInspectorStyles();ensureCatalogBadge();
  const diagnostics=$('diagnostics');
  if(!diagnostics||$('playback-source-inspector')){renderCatalogIdentity();return;}

  const catalog=document.createElement('div');
  catalog.className='current-catalog-card';
  catalog.innerHTML=`<strong>Current Catalog</strong><span>Type: <b id="inspector-catalog-type">-</b></span><span>Name: <b id="inspector-catalog-name">-</b></span><span>Origin: <b id="inspector-catalog-source">-</b></span>`;
  const grid=diagnostics.querySelector('.diagnostic-grid');
  if(grid)diagnostics.insertBefore(catalog,grid);else diagnostics.appendChild(catalog);

  const inspector=document.createElement('section');
  inspector.id='playback-source-inspector';inspector.className='playback-inspector';
  inspector.innerHTML=`
    <h3>Current Playback Source</h3>
    <label for="playback-source-full">Original source · full URL</label>
    <textarea id="playback-source-full" class="playback-source-full" spellcheck="false" placeholder="Select and play a channel to inspect its source"></textarea>
    <label>Playback route</label>
    <div id="playback-route-full" class="playback-route-full">-</div>
    <div class="playback-inspector-actions">
      <button id="playback-source-copy" class="button ghost" type="button">Copy source</button>
      <button id="playback-source-test" class="button ghost" type="button">Test edited URL</button>
      <button id="playback-source-add" class="button" type="button">★ Add source to My Playlist</button>
      <button id="playback-source-save-edit" class="button playlists" type="button">Save edit to My Playlist</button>
      <button id="playback-source-delete" class="button danger" type="button">Delete from My Playlist</button>
    </div>
    <div id="playback-inspector-status" class="playback-inspector-status">Play a channel to inspect and manage its exact source.</div>`;
  diagnostics.appendChild(inspector);

  $('playback-source-copy')?.addEventListener('click',async()=>{
    const url=$('playback-source-full')?.value.trim()||'';if(!url)return;
    try{await navigator.clipboard.writeText(url);setInspectorStatus('Full source copied ✓','ok');}
    catch{const area=$('playback-source-full');area?.select();document.execCommand('copy');setInspectorStatus('Full source copied ✓','ok');}
  });

  $('playback-source-test')?.addEventListener('click',async()=>{
    const url=cleanUrl($('playback-source-full')?.value||'');
    if(!/^https?:\/\//i.test(url)){setInspectorStatus('Enter a valid http/https source first.','error');return;}
    const selected=window.WebTVPlaylistAPI?.getSelectedChannel?.();
    if(!selected){setInspectorStatus('Select a channel first.','error');return;}
    try{setInspectorStatus('Testing edited URL…','busy');await window.WebTVPlaybackAPI?.testCandidate?.(url,{channel:selected});setInspectorStatus('Test started. Check Player/Diagnostics result.','ok');}
    catch(error){setInspectorStatus(`Test failed · ${error.message}`,'error');}
  });

  $('playback-source-add')?.addEventListener('click',async()=>{
    const url=cleanUrl($('playback-source-full')?.value||'');
    if(!/^https?:\/\//i.test(url)){setInspectorStatus('No valid source to add.','error');return;}
    try{
      setInspectorStatus('Saving source to the matching My Playlist channel…','busy');
      const result=await addExactSourceToMyPlaylist(url);
      setInspectorStatus(result.added?'Source added to My Playlist ✓':'Source already exists in My Playlist ✓','ok');
      scheduleMembershipRefresh();
    }catch(error){setInspectorStatus(`Save failed · ${error.message}`,'error');}
  });

  $('playback-source-save-edit')?.addEventListener('click',async()=>{
    const edited=cleanUrl($('playback-source-full')?.value||'');
    const original=cleanUrl(inspectorSelectedSource||diagSource?.textContent||'');
    if(!/^https?:\/\//i.test(edited)){setInspectorStatus('Enter a valid http/https source first.','error');return;}
    try{
      setInspectorStatus('Saving edited source…','busy');
      const {selected,index,target}=await getMyPlaylistTarget();
      if(index<0||!target){
        await addExactSourceToMyPlaylist(edited);
        setInspectorStatus(`${selected.name}: edited source added as the only initial My Playlist source ✓`,'ok');
      }else{
        const old=cleanUrl(original);
        const existing=[...(target.directUrls||[])].map(cleanUrl);
        let nextUrls=[...existing];
        if(old&&existing.includes(old))nextUrls=existing.map(url=>url===old?edited:url);
        else if(!existing.includes(edited))nextUrls=[...existing,edited];
        nextUrls=[...new Set(nextUrls.filter(Boolean))];
        await replaceCurrentSources(nextUrls,'playback-inspector-edit');
        setInspectorStatus(`${target.name}: source edit saved to My Playlist ✓`,'ok');
      }
      scheduleMembershipRefresh();
    }catch(error){setInspectorStatus(`Edit failed · ${error.message}`,'error');}
  });

  $('playback-source-delete')?.addEventListener('click',async()=>{
    const url=cleanUrl(inspectorSelectedSource||diagSource?.textContent||$('playback-source-full')?.value||'');
    if(!url)return;
    try{
      const {index,target}=await getMyPlaylistTarget();
      if(index<0||!target)throw new Error('This channel is not in My Playlist');
      const before=[...(target.directUrls||[])].map(cleanUrl);
      if(!before.includes(url))throw new Error('The playing source is not stored in this My Playlist channel');
      const remaining=before.filter(item=>item!==url);
      const warning=remaining.length?`Delete this source from “${target.name}”?`:`This is the LAST source of “${target.name}”. Delete it and leave the channel with 0 sources?`;
      if(!confirm(warning))return;
      setInspectorStatus('Deleting source from My Playlist…','busy');
      await replaceCurrentSources(remaining,'playback-inspector-delete');
      setInspectorStatus(`Source deleted from ${target.name} ✓`,'ok');
      scheduleMembershipRefresh();
    }catch(error){setInspectorStatus(`Delete failed · ${error.message}`,'error');}
  });

  renderCatalogIdentity();
  syncPlaybackInspector();
}

function syncPlaybackInspector(snapshot=window.WebTVDiagnosticsAPI?.getSnapshot?.()||{}){
  const area=$('playback-source-full');
  if(!area)return;
  inspectorPlaybackSnapshot={...inspectorPlaybackSnapshot,...snapshot};
  const channel=window.WebTVPlaylistAPI?.getSelectedChannel?.();
  const channelKey=normalizeId(channel?.id||channel?.originalId||channel?.name||'');
  if(inspectorSelectedChannel&&inspectorSelectedChannel!==channelKey){inspectorSelectedSource='';inspectorSelectedChannel='';}
  if(inspectorSelectedSource){scheduleMembershipRefresh();return;}
  const source=String(inspectorPlaybackSnapshot.source||'').trim();
  const route=String(inspectorPlaybackSnapshot.route||'-').trim()||'-';
  if(source&&source!=='-'&&document.activeElement!==area)area.value=source;
  if(!source||source==='-'){if(document.activeElement!==area)area.value='';setInspectorStatus('Play a channel to inspect and manage its exact source.','idle');}
  const routeBox=$('playback-route-full');if(routeBox)routeBox.textContent=route;
  scheduleMembershipRefresh();
}

function scheduleMembershipRefresh(){
  clearTimeout(membershipTimer);
  membershipTimer=setTimeout(refreshInspectorMembership,120);
}
async function refreshInspectorMembership(){
  const add=$('playback-source-add'),edit=$('playback-source-save-edit'),del=$('playback-source-delete');
  if(!add||!edit||!del)return;
  const url=cleanUrl(inspectorSelectedSource||inspectorPlaybackSnapshot.source||'');
  const selected=window.WebTVPlaylistAPI?.getSelectedChannel?.();
  if(!selected||!url||url==='-'){
    add.disabled=true;edit.disabled=true;del.disabled=true;return;
  }
  add.disabled=false;edit.disabled=false;
  try{
    const list=await window.WebTVMyPlaylistAPI?.getMyPlaylist?.();
    const target=Array.isArray(list)?list.find(item=>sameChannel(selected,item)):null;
    const stored=target?.directUrls?.map(cleanUrl).includes(url)||false;
    del.disabled=!stored;
    del.title=stored?'Delete this exact source from the matching My Playlist channel':'This playing source is not stored in the matching My Playlist channel';
    add.textContent=stored?'✓ Source already in My Playlist':'★ Add source to My Playlist';
    add.disabled=stored;
    edit.textContent=stored?'Save edit to My Playlist':'Add edited source to My Playlist';
  }catch{
    del.disabled=true;
  }
}

function bootInspector(){
  ensurePlaybackInspector();
  window.addEventListener('webtv:inspector-source-selected',event=>{
    const channel=window.WebTVPlaylistAPI?.getSelectedChannel?.();
    inspectorSelectedChannel=normalizeId(channel?.id||channel?.originalId||channel?.name||'');
    inspectorSelectedSource=cleanUrl(event.detail?.source||'');
    scheduleMembershipRefresh();
  });
  if(!installCatalogTracking()){
    setTimeout(()=>{installCatalogTracking();renderCatalogIdentity();},500);
  }

  window.addEventListener('webtv:diagnostics-updated',event=>syncPlaybackInspector(event.detail||{}));
  window.addEventListener('webtv:catalog-changed',renderCatalogIdentity);
  syncPlaybackInspector();
}

if(window.WebTVPlaylistAPI?.ready)bootInspector();
else window.addEventListener('webtv:ready',bootInspector,{once:true});
