const BUILD_ID = '20260924-2030';
const STORAGE_KEY = 'webtv_v2_favorites_v1';
const FILTER_KEY = 'webtv_v2_favorites_filter_v1';
const $ = id => document.getElementById(id);
const DEFAULT_REGISTRY = 'https://webtv-registry.atonis.workers.dev';
function registryBase(){return (localStorage.getItem('webtv_v2_registry_url')||DEFAULT_REGISTRY).trim().replace(/\/$/,'');}
let cloudReady=false;
async function loadCloud(){
  try{
    const r=await fetch(`${registryBase()}/api/favorites`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const j=await r.json(),set=new Set((j.favorites||[]).map(String));
    save(set);cloudReady=true;return set;
  }catch{return load();}
}
async function saveCloud(set){
  try{
    const auth=window.WebTVRegistryAuth;
    if(!auth?.ensureSession)return false;
    if(!auth.token?.())await auth.ensureSession({interactive:true});
    const token=auth.token?.()||'';
    const r=await fetch(`${registryBase()}/api/favorites`,{method:'PUT',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({favorites:[...set]})});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    cloudReady=true;return true;
  }catch{return false;}
}

const list = $('channel-list');
const toolbar = document.querySelector('.sidebar .toolbar');
const channelActions = document.querySelector('.channel-actions');
const channelName = $('channel-name');
let favoritesOnly = localStorage.getItem(FILTER_KEY) === '1';
let scheduled = false;

function load(){
  try{return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').map(String));}
  catch{return new Set();}
}
function save(set){
  try{localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));}catch{}
}
function selectedId(){
  const channel = window.WebTVPlaylistAPI?.getSelectedChannel?.();
  return channel?.id ? String(channel.id) : '';
}
function isFavorite(id){return load().has(String(id));}

function ensureUi(){
  if(toolbar && !$('favorites-filter')){
    const button = document.createElement('button');
    button.id = 'favorites-filter';
    button.type = 'button';
    button.className = 'button ghost favorites-filter';
    button.textContent = '☆ Favorites';
    button.title = 'Show only favorite channels';
    toolbar.appendChild(button);
    button.classList.toggle('active', favoritesOnly);
    button.textContent = favoritesOnly ? '★ Favorites only' : '☆ Favorites';
    button.addEventListener('click',()=>{
      favoritesOnly = !favoritesOnly;
      try{localStorage.setItem(FILTER_KEY,favoritesOnly?'1':'0');}catch{}
      button.classList.toggle('active', favoritesOnly);
      button.textContent = favoritesOnly ? '★ Favorites only' : '☆ Favorites';
      scheduleApply();
    });
  }

  if(channelActions && !$('favorite-channel')){
    const button = document.createElement('button');
    button.id = 'favorite-channel';
    button.type = 'button';
    button.className = 'button ghost favorite-channel';
    button.hidden = true;
    button.addEventListener('click',async()=>{
      const id = selectedId();
      if(!id) return;
      const set = load();
      if(set.has(id)) set.delete(id); else set.add(id);
      save(set);
      await saveCloud(set);
      updateSelectedButton();
      scheduleApply();
    });
    channelActions.insertBefore(button, channelActions.firstChild);
  }
}

function updateSelectedButton(){
  const button = $('favorite-channel');
  if(!button) return;
  const id = selectedId();
  button.hidden = !id;
  if(!id) return;
  const fav = isFavorite(id);
  button.textContent = fav ? '★ Favorite' : '☆ Favorite';
  button.classList.toggle('active', fav);
  button.title = fav ? 'Remove from favorites' : 'Pin as favorite';
}

function apply(){
  scheduled = false;
  if(!list) return;
  const set = load();
  const items = [...list.querySelectorAll('.channel-item')];
  const decorated = items.map((item,index)=>({item,index,fav:set.has(String(item.dataset.channelId || ''))}));
  decorated.forEach(({item,fav})=>{
    item.classList.toggle('favorite', fav);
    item.hidden = favoritesOnly && !fav;
    item.title = fav ? 'Favorite channel' : '';
  });

  const sorted = [...decorated].sort((a,b)=>Number(b.fav)-Number(a.fav) || a.index-b.index);
  const changed = sorted.some((entry,index)=>entry.item !== items[index]);
  if(changed){
    const fragment = document.createDocumentFragment();
    sorted.forEach(entry=>fragment.appendChild(entry.item));
    list.appendChild(fragment);
  }
  updateSelectedButton();
}

function scheduleApply(){
  if(scheduled) return;
  scheduled = true;
  requestAnimationFrame(apply);
}

ensureUi();
if(list) new MutationObserver(scheduleApply).observe(list,{childList:true,subtree:false});
if(channelName) new MutationObserver(updateSelectedButton).observe(channelName,{childList:true,characterData:true,subtree:true});
window.addEventListener('webtv:ready',async()=>{ensureUi();await loadCloud();scheduleApply();});
loadCloud().then(scheduleApply);
scheduleApply();
console.info(`[WebTV] Favorites UI loaded · build ${BUILD_ID} · D1 cloud favorites + persistent filter state`);
