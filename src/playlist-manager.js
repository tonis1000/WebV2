import { parseM3U, dedupeChannels } from './core/channel-catalog.js?v=20260920-1021';

const BUILD_ID = '20260922-2115';
const DB_NAME = 'webtv-v2-playlists';
const STORE = 'playlists';
const REGISTRY_URL_KEY = 'webtv_v2_registry_url';
const REGISTRY_TOKEN_KEY = 'webtv_v2_registry_token';
const DEFAULT_REGISTRY = 'https://webtv-registry.atonis.workers.dev';
const DEFAULT_WORKER = 'https://source-huntatonisworkersdev.atonis.workers.dev';
const $ = id => document.getElementById(id);

let dbPromise;
let tested = null;
let myCache = [];

function log(message){
  const box=$('diagnostic-log');
  if(!box)return;
  const stamp=new Date().toLocaleTimeString();
  box.textContent=`[${stamp}] ${message}\n${box.textContent}`.slice(0,18000);
}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function escAttr(value=''){return String(value||'').replace(/"/g,"'");}
function normalize(value=''){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9α-ω]+/gi,'-').replace(/^-+|-+$/g,'');}
function uid(){return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}

function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}
async function allSaved(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const req=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
    req.onsuccess=()=>resolve((req.result||[]).filter(x=>x.id!=='__my_playlist__').sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)));
    req.onerror=()=>reject(req.error);
  });
}
async function putSaved(item){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete=()=>resolve(item);
    tx.onerror=()=>reject(tx.error);
  });
}
async function removeSaved(id){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });
}

function registryUrl(){
  return (localStorage.getItem(REGISTRY_URL_KEY)||DEFAULT_REGISTRY).trim().replace(/\/$/,'');
}
function registryToken(){return localStorage.getItem(REGISTRY_TOKEN_KEY)||'';}
function registryHeaders({json=false,auth=false}={}){
  const headers={};
  if(json)headers['content-type']='application/json';
  if(auth&&registryToken())headers.authorization=`Bearer ${registryToken()}`;
  return headers;
}
async function registryFetch(path,options={}){
  const c=new AbortController();
  const timer=setTimeout(()=>c.abort(),12000);
  try{return await fetch(`${registryUrl()}${path}`,{cache:'no-store',signal:c.signal,...options});}
  finally{clearTimeout(timer);}
}
async function ensureWriteSession(){
  const auth=window.WebTVRegistryAuth;
  if(auth?.ensureSession){
    const ok=await auth.ensureSession({interactive:true});
    if(!ok)throw new Error('D1 write cancelled');
    return;
  }
  if(!registryToken())throw new Error('Trusted-device session is required');
}
async function readJsonResponse(response){
  let json={};
  try{json=await response.json();}catch{}
  if(!response.ok)throw new Error(json.error||`Registry HTTP ${response.status}`);
  return json;
}
async function fetchMyPlaylist(){
  const response=await registryFetch('/api/my-playlist');
  const json=await readJsonResponse(response);
  return (json.channels||[]).map((c,index)=>({
    id:normalize(c.id||c.tvgId||c.name),
    originalId:c.tvgId||c.id||c.name,
    name:c.name,
    logo:c.logo||'',
    group:c.groupName||'Other',
    directUrls:[...new Set((c.sources||[]).map(s=>s?.url).filter(Boolean))],
    position:Number.isFinite(Number(c.position))?Number(c.position):index
  }));
}

function setStatus(text,tone='idle'){
  const el=$('playlist-manager-status');
  if(!el)return;
  el.textContent=text;el.dataset.tone=tone;
}
function selectedMode(){return document.querySelector('input[name="playlist-mode"]:checked')?.value||'replace';}
function summarize(text){
  const channels=parseM3U(text);
  const groups=[...new Set(channels.map(c=>c.group||'Other'))];
  return{channels,count:channels.length,groups:groups.length,sample:channels.slice(0,8).map(c=>c.name)};
}
function channelToLines(channel){
  const urls=[...new Set((channel.directUrls||[]).filter(u=>/^https?:\/\//i.test(u)))];
  const ext=`#EXTINF:-1 tvg-id="${escAttr(channel.originalId||channel.id||channel.name)}" tvg-name="${escAttr(channel.name)}" tvg-logo="${escAttr(channel.logo||'')}" group-title="${escAttr(channel.group||'Other')}",${channel.name}`;
  if(!urls.length)return[ext,''];
  const lines=[];
  for(const url of urls)lines.push(ext,url);
  return lines;
}
function channelsToM3U(channels){
  const lines=['#EXTM3U'];
  for(const c of channels)lines.push(...channelToLines(c));
  return `${lines.join('\n')}\n`;
}
function channelPayload(channel,position=999999,replaceSources=true){
  return{
    id:normalize(channel.id||channel.originalId||channel.name),
    name:channel.name,
    tvgId:channel.originalId||channel.id||channel.name,
    logo:channel.logo||'',
    groupName:channel.group||'Other',
    directUrls:[...(channel.directUrls||[])],
    sources:(channel.directUrls||[]).map((url,i)=>({url,origin:'curated',priority:100+i})),
    position,
    replaceSources
  };
}
function api(){return window.WebTVPlaylistAPI||null;}
function selectedChannel(){return api()?.getSelectedChannel?.()||null;}

async function refreshPrimary({forceSidebar=false,reason='write'}={}){
  myCache=await fetchMyPlaylist();
  await renderMyPlaylist({reuseCache:true});
  await updateMyAction();
  const bridge=api();
  if(bridge?.reloadCloudMyPlaylist && (forceSidebar || bridge.getCatalogMode?.()==='cloud')){
    await bridge.reloadCloudMyPlaylist({reason,preserveSelection:true});
  }
  return myCache;
}

function renderPreview(summary,label='M3U preview'){
  const box=$('playlist-preview');
  if(!box)return;
  box.innerHTML='';
  const top=document.createElement('div');
  top.className='playlist-preview-top';
  top.innerHTML=`<strong>${escapeHtml(label)}</strong><span>${summary.count} channels · ${summary.groups} groups</span>`;
  box.appendChild(top);
  const chips=document.createElement('div');chips.className='playlist-preview-chips';
  for(const name of summary.sample){const chip=document.createElement('span');chip.textContent=name;chips.appendChild(chip);}
  if(summary.count>summary.sample.length){const more=document.createElement('span');more.textContent=`+${summary.count-summary.sample.length} more`;chips.appendChild(more);}
  box.appendChild(chips);
}
async function fetchWithTimeout(url,timeout=9000){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
  try{return await fetch(url,{cache:'no-store',signal:c.signal});}
  finally{clearTimeout(t);}
}
async function fetchPlaylist(url){
  const clean=String(url||'').trim();
  if(!/^https?:\/\//i.test(clean))throw new Error('Valid http/https playlist URL required');
  try{
    const r=await fetchWithTimeout(clean,9000);
    if(r.ok){const text=await r.text();if(summarize(text).count)return{text,via:'direct'};}
  }catch{}
  const proxy=`${DEFAULT_WORKER}/playlist-proxy?url=${encodeURIComponent(clean)}`;
  const r=await fetchWithTimeout(proxy,12000);
  if(!r.ok){
    let detail='';
    try{detail=(await r.json())?.error||'';}catch{}
    throw new Error(`Playlist fetch failed${detail?` · ${detail}`:` · HTTP ${r.status}`}`);
  }
  const text=await r.text();
  if(!summarize(text).count)throw new Error('No #EXTINF channels found');
  return{text,via:'worker'};
}
async function applyText(text,mode,label){
  const bridge=api();
  if(!bridge)throw new Error('WebTV playlist bridge is not ready');
  const result=bridge.applyText(text,{mode,label});
  setStatus(`${label} loaded temporarily · ${result.imported} channels · ${mode}`,'ok');
  log(`PLAYLIST TEMP ${mode.toUpperCase()} · ${label} · ${result.imported} imported · ${result.total} total`);
  return result;
}

async function testUrl(){
  const url=$('playlist-add-url')?.value.trim();
  if(!url)return;
  setStatus('Fetching playlist URL…','busy');
  try{
    const fetched=await fetchPlaylist(url),summary=summarize(fetched.text);
    tested={text:fetched.text,url,type:'url',summary};
    renderPreview(summary,`URL test · ${fetched.via}`);
    setStatus(`Valid M3U · ${summary.count} channels`,'ok');
  }catch(error){setStatus(error.message,'error');log(`PLAYLIST URL TEST FAILED · ${error.message}`);}
}
function testPaste(){
  const text=$('playlist-paste')?.value||'',summary=summarize(text);
  if(!summary.count){setStatus('No #EXTINF channels found in pasted text','error');return;}
  tested={text,type:'paste',summary};
  renderPreview(summary,'Pasted M3U test');
  setStatus(`Valid M3U · ${summary.count} channels`,'ok');
}
async function currentPayload(kind){
  if(kind==='url'){
    const url=$('playlist-add-url')?.value.trim();
    if(!url)throw new Error('Playlist URL is empty');
    if(tested?.type==='url'&&tested.url===url)return tested;
    const fetched=await fetchPlaylist(url);
    return{text:fetched.text,url,type:'url',summary:summarize(fetched.text)};
  }
  const text=$('playlist-paste')?.value||'',summary=summarize(text);
  if(!summary.count)throw new Error('No channels found in pasted M3U');
  return{text,type:'paste',summary};
}
async function loadTemporary(kind){
  try{
    setStatus('Preparing temporary playlist…','busy');
    const p=await currentPayload(kind),label=kind==='url'?(p.url||'External URL'):'Pasted M3U';
    await applyText(p.text,selectedMode(),label);
    renderPreview(p.summary,'Loaded temporarily');
  }catch(error){setStatus(error.message,'error');}
}

async function pushSavedPlaylistToRegistry(item){
  await ensureWriteSession();
  const r=await registryFetch('/api/playlists',{
    method:'POST',
    headers:registryHeaders({json:true,auth:true}),
    body:JSON.stringify({id:item.id,name:item.name,kind:item.type||'saved',sourceUrl:item.url||'',rawM3u:item.text,channelCount:item.channelCount||0,groupCount:item.groupCount||0})
  });
  return readJsonResponse(r);
}
async function saveCurrent(kind){
  try{
    setStatus('Saving playlist to D1…','busy');
    const p=await currentPayload(kind);
    const nameInput=kind==='url'?$('playlist-url-name'):$('playlist-paste-name');
    const fallback=kind==='url'?new URL(p.url).hostname:`Playlist ${new Date().toLocaleDateString('de-DE')}`;
    const name=(nameInput?.value||'').trim()||fallback,now=Date.now();
    const item={id:uid(),name,type:kind,url:p.url||'',text:p.text,channelCount:p.summary.count,groupCount:p.summary.groups,createdAt:now,updatedAt:now};
    await pushSavedPlaylistToRegistry(item);
    await putSaved(item);
    if(nameInput)nameInput.value='';
    setStatus(`${name} saved · ${p.summary.count} channels · D1`,'ok');
    log(`SAVED PLAYLIST · ${name} · ${p.summary.count} channels · D1`);
    await renderSaved();
  }catch(error){setStatus(error.message,'error');}
}
function downloadM3UText(name,text){
  const blob=new Blob([text],{type:'audio/x-mpegurl;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`${String(name||'playlist').replace(/[^a-z0-9α-ω_-]+/gi,'_')||'playlist'}.m3u`;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function tinyButton(label,cls='ghost'){
  const b=document.createElement('button');
  b.type='button';b.className=`button ${cls} mini`;b.textContent=label;
  return b;
}

function ensureMyUi(){
  if($('my-playlist-library'))return;
  const savedHead=document.querySelector('.saved-playlists-head');
  if(!savedHead)return;
  const section=document.createElement('section');
  section.id='my-playlist-library';section.className='my-playlist-library';
  section.innerHTML=`<div class="my-playlist-hero"><div class="my-playlist-mark">★</div><div><p class="eyebrow">PRIMARY · D1</p><h3>My Playlist</h3><p class="muted small">Η μοναδική live playlist του WebTV. Φορτώνει αυτόματα στο sidebar από Cloudflare D1.</p></div><div class="my-playlist-hero-actions"><span id="my-playlist-count" class="freshness-badge">0 channels</span><button id="my-playlist-use" class="button" type="button">Show My Playlist</button><button id="my-playlist-export" class="button ghost" type="button">Export M3U</button></div></div><div id="my-playlist-channels" class="my-playlist-channels"></div>`;
  savedHead.parentNode.insertBefore(section,savedHead);
  $('my-playlist-use')?.addEventListener('click',async()=>{
    try{
      await api()?.reloadCloudMyPlaylist?.({reason:'playlist-manager',preserveSelection:false});
      await refreshPrimary({reason:'playlist-manager'});
      setStatus('My Playlist loaded from D1','ok');
    }catch(error){setStatus(error.message,'error');}
  });
  $('my-playlist-export')?.addEventListener('click',async()=>{
    const channels=await fetchMyPlaylist();
    downloadM3UText('My_Playlist',channelsToM3U(channels));
  });
}
async function renderMyPlaylist({reuseCache=false}={}){
  ensureMyUi();
  const box=$('my-playlist-channels'),count=$('my-playlist-count');
  if(!box)return;
  if(!reuseCache)myCache=await fetchMyPlaylist();
  const channels=myCache;
  if(count)count.textContent=`${channels.length} channel${channels.length===1?'':'s'}`;
  box.innerHTML='';
  if(!channels.length){
    box.innerHTML='<div class="my-playlist-empty"><strong>My Playlist is empty.</strong><span>Add a channel from a Saved Playlist or another temporary playlist.</span></div>';
    return;
  }
  channels.forEach((channel,index)=>{
    const row=document.createElement('article');row.className='my-channel-row';
    const logo=document.createElement('div');logo.className='my-channel-logo';
    if(channel.logo){const img=document.createElement('img');img.src=channel.logo;img.alt='';logo.append(img);}else logo.textContent='TV';
    const main=document.createElement('div');main.className='my-channel-main';
    const title=document.createElement('strong');title.textContent=channel.name;
    const meta=document.createElement('span');meta.textContent=`#${index+1} · ${channel.group||'Other'} · ${(channel.directUrls||[]).length} source${(channel.directUrls||[]).length===1?'':'s'}`;
    main.append(title,meta);
    const actions=document.createElement('div');actions.className='my-channel-actions';
    const up=tinyButton('↑','ghost');up.title='Move up';up.disabled=index===0;up.addEventListener('click',()=>moveMyChannel(index,index-1));
    const down=tinyButton('↓','ghost');down.title='Move down';down.disabled=index===channels.length-1;down.addEventListener('click',()=>moveMyChannel(index,index+1));
    const edit=tinyButton('Edit','ghost');edit.addEventListener('click',()=>editMyChannel(channel));
    const src=tinyButton('Sources','ghost');src.addEventListener('click',()=>showSources(channel));
    const remove=tinyButton('Remove','danger');remove.addEventListener('click',()=>removeMyChannel(channel));
    actions.append(up,down,edit,src,remove);
    row.append(logo,main,actions);box.append(row);
  });
}

async function putRegistryChannel(channel,position=999999,replaceSources=true){
  await ensureWriteSession();
  const r=await registryFetch('/api/my-playlist/channel',{
    method:'PUT',
    headers:registryHeaders({json:true,auth:true}),
    body:JSON.stringify(channelPayload(channel,position,replaceSources))
  });
  return readJsonResponse(r);
}
async function deleteRegistryChannel(id){
  await ensureWriteSession();
  const r=await registryFetch(`/api/my-playlist/channel/${encodeURIComponent(normalize(id))}`,{
    method:'DELETE',headers:registryHeaders({auth:true})
  });
  return readJsonResponse(r);
}
async function updateRegistryOrder(channels){
  await ensureWriteSession();
  const r=await registryFetch('/api/my-playlist/order',{
    method:'PATCH',
    headers:registryHeaders({json:true,auth:true}),
    body:JSON.stringify({ids:channels.map(c=>normalize(c.id||c.originalId||c.name))})
  });
  return readJsonResponse(r);
}

async function myContains(channel){
  if(!channel)return false;
  if(!myCache.length)myCache=await fetchMyPlaylist();
  const key=normalize(channel.id||channel.originalId||channel.name);
  return myCache.some(c=>normalize(c.id||c.originalId||c.name)===key);
}
function ensureMyActionButton(){
  let b=$('my-playlist-channel-action');
  if(b)return b;
  const actions=document.querySelector('.channel-actions');
  if(!actions)return null;
  b=document.createElement('button');
  b.id='my-playlist-channel-action';b.type='button';b.className='button my-add';b.hidden=true;
  actions.prepend(b);b.addEventListener('click',toggleSelectedInMy);
  return b;
}
async function updateMyAction(){
  const b=ensureMyActionButton();
  if(!b)return;
  const channel=selectedChannel();
  if(!channel){b.hidden=true;return;}
  const inside=await myContains(channel);
  b.hidden=false;b.dataset.inside=inside?'1':'0';
  b.textContent=inside?'Remove from My Playlist':'★ Add to My Playlist';
}
async function toggleSelectedInMy(){
  const channel=selectedChannel();
  if(!channel)return;
  if(await myContains(channel))await removeMyChannel(channel);
  else await addMyChannel(channel);
}
async function addMyChannel(channel){
  try{
    myCache=await fetchMyPlaylist();
    const key=normalize(channel.id||channel.originalId||channel.name);
    if(myCache.some(c=>normalize(c.id||c.originalId||c.name)===key)){
      setStatus(`${channel.name} is already in My Playlist`,'idle');return;
    }
    const add={...channel,directUrls:[...(channel.directUrls||[])]};
    if(!add.directUrls.length){
      const candidate=$('candidate-url')?.value.trim();
      if(/^https?:\/\//i.test(candidate))add.directUrls=[candidate];
    }
    await putRegistryChannel(add,myCache.length,true);
    setStatus(`${channel.name} added to My Playlist`,'ok');
    log(`MY PLAYLIST ADD · ${channel.name} · ${add.directUrls.length} source(s) · D1`);
    await refreshPrimary({reason:'add-channel'});
  }catch(error){setStatus(error.message,'error');log(`D1 ADD CHANNEL FAILED · ${error.message}`);}
}
async function removeMyChannel(channel){
  if(!confirm(`Remove “${channel.name}” from My Playlist?`))return;
  try{
    await deleteRegistryChannel(channel.id||channel.originalId||channel.name);
    setStatus(`${channel.name} removed from My Playlist`,'idle');
    log(`MY PLAYLIST REMOVE · ${channel.name} · D1`);
    await refreshPrimary({reason:'remove-channel'});
    if(myCache.length)await updateRegistryOrder(myCache).catch(()=>{});
  }catch(error){setStatus(error.message,'error');log(`D1 REMOVE CHANNEL FAILED · ${error.message}`);}
}
async function editMyChannel(channel){
  const name=prompt('Channel name',channel.name);
  if(name===null||!name.trim())return;
  const group=prompt('Group',channel.group||'Other');
  if(group===null)return;
  const urlsText=prompt('Sources, one URL per line',(channel.directUrls||[]).join('\n'));
  if(urlsText===null)return;
  const urls=[...new Set(urlsText.split(/\r?\n|,/).map(s=>s.trim()).filter(s=>/^https?:\/\//i.test(s)))];
  try{
    myCache=await fetchMyPlaylist();
    const key=normalize(channel.id||channel.originalId||channel.name);
    const index=myCache.findIndex(c=>normalize(c.id||c.originalId||c.name)===key);
    if(index<0)throw new Error('Channel is no longer in My Playlist');
    const edited={...myCache[index],name:name.trim(),group:(group||'Other').trim(),directUrls:urls};
    await putRegistryChannel(edited,index,true);
    setStatus(`${edited.name} updated`,'ok');
    log(`MY PLAYLIST EDIT · ${edited.name} · ${urls.length} source(s) · D1`);
    await refreshPrimary({reason:'edit-channel'});
  }catch(error){setStatus(error.message,'error');log(`D1 EDIT CHANNEL FAILED · ${error.message}`);}
}
async function moveMyChannel(from,to){
  if(to<0)return;
  try{
    myCache=await fetchMyPlaylist();
    if(from<0||from>=myCache.length||to<0||to>=myCache.length)return;
    const moved=myCache.splice(from,1)[0];myCache.splice(to,0,moved);
    await updateRegistryOrder(myCache);
    setStatus(`${moved.name} moved to position ${to+1}`,'ok');
    log(`MY PLAYLIST REORDER · ${moved.name} · ${from+1} → ${to+1} · D1 positions only`);
    await refreshPrimary({reason:'reorder'});
  }catch(error){
    setStatus(`Reorder failed · ${error.message}`,'error');
    myCache=await fetchMyPlaylist().catch(()=>[]);
    await renderMyPlaylist({reuseCache:true});
  }
}
function showSources(channel){
  const urls=channel.directUrls||[];
  alert(urls.length?`${channel.name}\n\n${urls.map((u,i)=>`${i+1}. ${u}`).join('\n\n')}`:`${channel.name}\n\nNo stream source stored.`);
}

async function renderSaved(){
  const box=$('saved-playlists'),count=$('saved-playlist-count');
  if(!box)return;
  const rows=await allSaved();
  if(count)count.textContent=`${rows.length} saved`;
  box.innerHTML='';
  if(!rows.length){
    box.innerHTML='<div class="playlist-preview-empty">No Saved Playlists yet.</div>';
    return;
  }
  for(const item of rows){
    const card=document.createElement('article');card.className='playlist-card';
    const icon=document.createElement('div');icon.className='playlist-card-icon';icon.textContent=item.type==='url'?'↗':'≡';
    const main=document.createElement('div');main.className='playlist-card-main';
    const title=document.createElement('div');title.className='playlist-card-title';
    const strong=document.createElement('strong');strong.textContent=item.name;title.appendChild(strong);
    const meta=document.createElement('span');
    let host='';try{host=item.url?new URL(item.url).hostname:'';}catch{}
    meta.textContent=`${item.channelCount||0} channels · ${item.groupCount||0} groups${host?` · ${host}`:''}`;
    main.append(title,meta);
    const actions=document.createElement('div');actions.className='playlist-card-actions';
    const load=tinyButton('Load');load.addEventListener('click',()=>applyText(item.text,selectedMode(),item.name).catch(e=>setStatus(e.message,'error')));
    const rename=tinyButton('Rename','ghost');rename.addEventListener('click',async()=>{
      const name=prompt('Playlist name',item.name);if(!name?.trim())return;
      try{
        const changed={...item,name:name.trim(),updatedAt:Date.now()};
        await pushSavedPlaylistToRegistry(changed);await putSaved(changed);await renderSaved();
      }catch(error){setStatus(error.message,'error');}
    });
    const exportBtn=tinyButton('Export','ghost');exportBtn.addEventListener('click',()=>downloadM3UText(item.name,item.text));
    const del=tinyButton('Delete','danger');del.addEventListener('click',async()=>{
      if(!confirm(`Delete “${item.name}”?`))return;
      try{
        await ensureWriteSession();
        const r=await registryFetch(`/api/playlists/${encodeURIComponent(item.id)}`,{method:'DELETE',headers:registryHeaders({auth:true})});
        await readJsonResponse(r);await removeSaved(item.id);await renderSaved();setStatus(`${item.name} deleted`,'idle');
      }catch(error){setStatus(error.message,'error');}
    });
    actions.append(load,rename,exportBtn,del);
    card.append(icon,main,actions);box.appendChild(card);
  }
}

async function startup(){
  ensureMyUi();
  try{
    myCache=await fetchMyPlaylist();
    await renderMyPlaylist({reuseCache:true});
  }catch(error){
    setStatus(`My Playlist D1 read failed · ${error.message}`,'error');
  }
  await renderSaved();
  await updateMyAction();
}
function bind(){
  $('playlist-manager-toggle')?.addEventListener('click',()=>{
    const p=$('playlist-manager');
    if(!p)return;
    p.hidden=!p.hidden;
    if(!p.hidden){renderMyPlaylist().catch(e=>setStatus(e.message,'error'));renderSaved().catch(()=>{});}
  });
  $('playlist-manager-close')?.addEventListener('click',()=>{const p=$('playlist-manager');if(p)p.hidden=true;});
  $('playlist-test-url')?.addEventListener('click',testUrl);
  $('playlist-load-url')?.addEventListener('click',()=>loadTemporary('url'));
  $('playlist-save-url')?.addEventListener('click',()=>saveCurrent('url'));
  $('playlist-test-paste')?.addEventListener('click',testPaste);
  $('playlist-load-paste')?.addEventListener('click',()=>loadTemporary('paste'));
  $('playlist-save-paste')?.addEventListener('click',()=>saveCurrent('paste'));
  $('playlist-add-url')?.addEventListener('keydown',e=>{if(e.key==='Enter')testUrl();});
  $('channel-list')?.addEventListener('click',()=>setTimeout(()=>{myCache=[];updateMyAction();},0));
  const observer=new MutationObserver(()=>{myCache=[];updateMyAction();});
  const name=$('channel-name');
  if(name)observer.observe(name,{childList:true,characterData:true,subtree:true});
  window.addEventListener('webtv:cloud-read-synced',()=>renderSaved().catch(()=>{}));
}

window.WebTVMyPlaylistAPI={
  addCurrent:()=>{
    const c=selectedChannel();
    return c?addMyChannel(c):Promise.reject(new Error('No channel selected'));
  },
  addSourceToCurrent:async(url)=>{
    const c=selectedChannel();
    if(!c)throw new Error('No channel selected');
    myCache=await fetchMyPlaylist();
    const key=normalize(c.id||c.originalId||c.name);
    let index=myCache.findIndex(x=>normalize(x.id||x.originalId||x.name)===key);
    let target;
    if(index<0){
      target={...c,directUrls:[...(c.directUrls||[])]};
      index=myCache.length;
    }else target={...myCache[index],directUrls:[...(myCache[index].directUrls||[])]};
    target.directUrls=[...new Set([...target.directUrls,url].filter(Boolean))];
    await putRegistryChannel(target,index,true);
    log(`MY PLAYLIST SOURCE SAVED · ${target.name} · ${url}`);
    await refreshPrimary({reason:'source-save'});
    return target;
  },
  getMyPlaylist:async()=>fetchMyPlaylist(),
  reload:()=>refreshPrimary({forceSidebar:true,reason:'api-reload'})
};

bind();
ensureMyUi();
window.addEventListener('webtv:ready',()=>startup().catch(error=>setStatus(`Startup failed · ${error.message}`,'error')),{once:true});
if(window.WebTVPlaylistAPI?.ready)startup().catch(()=>{});

log(`Playlist Manager loaded · build ${BUILD_ID} · D1 My Playlist is primary`);
