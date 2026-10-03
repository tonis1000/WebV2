import './right-rail-preview.js?v=20261003-epg-guide-rail';

const BUILD_ID = '20260929-d1-authoritative-favorites';
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

const toolbar = document.querySelector('.sidebar .toolbar');
const channelActions = document.querySelector('.channel-actions');
let favoritesOnly = localStorage.getItem(FILTER_KEY) === '1';

function load(){
  try{return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').map(String));}
  catch{return new Set();}
}
function save(set){
  try{localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));}catch{}
}
function isMyPlaylistCatalog(){return window.WebTVPlaylistAPI?.getCatalogMode?.()==='cloud';}
function selectedId(){
  if(!isMyPlaylistCatalog())return '';
  const channel = window.WebTVPlaylistAPI?.getSelectedChannel?.();
  return channel?.id ? String(channel.id) : '';
}
function isFavorite(id){return load().has(String(id));}
function presentationState(){
  return {favorites:[...load()],favoritesOnly:isMyPlaylistCatalog()&&favoritesOnly};
}
function notifyPresentation(){
  window.dispatchEvent(new CustomEvent('webtv:favorites-presentation-changed',{detail:presentationState()}));
}
window.WebTVFavoritesPresentationAPI={getState:presentationState};

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
      if(!isMyPlaylistCatalog())return;
      favoritesOnly = !favoritesOnly;
      try{localStorage.setItem(FILTER_KEY,favoritesOnly?'1':'0');}catch{}
      button.classList.toggle('active', favoritesOnly);
      button.textContent = favoritesOnly ? '★ Favorites only' : '☆ Favorites';
      notifyPresentation();
    });
  }

  if(channelActions && !$('favorite-channel')){
    const button = document.createElement('button');
    button.id = 'favorite-channel';
    button.type = 'button';
    button.className = 'button ghost favorite-channel';
    button.hidden = true;
    button.textContent = '☆ Favorite';
    button.addEventListener('click',async()=>{
      if(!isMyPlaylistCatalog())return;
      const id = selectedId();
      if(!id) return;
      const set = load();
      if(set.has(id)) set.delete(id); else set.add(id);
      save(set);
      await saveCloud(set);
      updateSelectedButton();
      notifyPresentation();
    });
    channelActions.insertBefore(button, channelActions.firstChild);
  }
}

function updateSelectedButton(){
  const button = $('favorite-channel');
  if(!button) return;
  const myPlaylist=isMyPlaylistCatalog();
  const id = selectedId();
  button.hidden = !myPlaylist || !id;
  if(!id){
    button.textContent = '☆ Favorite';
    button.classList.remove('active');
    button.title = 'Select a channel first';
    return;
  }
  const fav = isFavorite(id);
  button.textContent = fav ? '★ Favorite' : '☆ Favorite';
  button.classList.toggle('active', fav);
  button.title = fav ? 'Remove from favorites' : 'Pin as favorite';
}

function syncUiScope(){
  const myPlaylist=isMyPlaylistCatalog();
  const filter=$('favorites-filter');
  if(filter)filter.hidden=!myPlaylist;
  updateSelectedButton();
}

ensureUi();
syncUiScope();
window.addEventListener('webtv:channel-selected',()=>{syncUiScope();notifyPresentation();});
window.addEventListener('webtv:ready',()=>{ensureUi();syncUiScope();notifyPresentation();});
loadCloud().then(()=>{syncUiScope();notifyPresentation();});
notifyPresentation();
console.info(`[WebTV] Favorites UI loaded · build ${BUILD_ID} · D1-authoritative cloud favorites with local fallback`);
