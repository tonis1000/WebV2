const BUILD_ID = '20260923-0715';
const STORAGE_KEY = 'webtv_v2_favorites_v1';
const $ = id => document.getElementById(id);

const list = $('channel-list');
const toolbar = document.querySelector('.sidebar .toolbar');
const channelActions = document.querySelector('.channel-actions');
const channelName = $('channel-name');
let favoritesOnly = false;
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
    button.addEventListener('click',()=>{
      favoritesOnly = !favoritesOnly;
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
    button.addEventListener('click',()=>{
      const id = selectedId();
      if(!id) return;
      const set = load();
      if(set.has(id)) set.delete(id); else set.add(id);
      save(set);
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
window.addEventListener('webtv:ready',()=>{ensureUi();scheduleApply();});
scheduleApply();
console.info(`[WebTV] Favorites UI loaded · build ${BUILD_ID} · local UI preference only`);
