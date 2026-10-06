import { saveVerifiedXtreamChannel } from './xtream-save-destination.js?v=20261006-m3u-import-a';
import { listCustomPlaylists, getCustomPlaylistChannels } from './custom-playlist-client.js';

const $=id=>document.getElementById(id);
let pendingDetail=null;
let customPlaylists=[];
let openingGeneration=0;

function clean(value=''){return String(value??'').trim();}
function setStatus(text,tone='idle'){
  const el=$('xtream-status');
  if(el){el.textContent=text;el.dataset.tone=tone;}
}

function ensureDialog(){
  let dialog=$('xtream-save-destination-dialog');
  if(dialog)return dialog;
  dialog=document.createElement('dialog');
  dialog.id='xtream-save-destination-dialog';
  dialog.className='playlist-tool-card xtream-save-destination-dialog';
  dialog.innerHTML=`
    <form method="dialog" id="xtream-save-destination-form">
      <div class="playlist-tool-title">
        <span class="playlist-tool-icon">💾</span>
        <div><strong>Save Channel</strong><span id="xtream-save-destination-channel">Verified Xtream channel</span></div>
      </div>
      <label>Destination
        <select id="xtream-save-destination-select">
          <option value="my">My Playlist</option>
          <option value="new-custom">+ New Custom Playlist</option>
        </select>
      </label>
      <label id="xtream-save-new-name-wrap" hidden>New Custom Playlist name
        <input id="xtream-save-new-name" type="text" maxlength="120" placeholder="e.g. Greek Favorites">
      </label>
      <fieldset>
        <legend>Sources</legend>
        <label><input type="radio" name="xtream-save-source-scope" value="selected" checked> Selected source</label>
        <label><input type="radio" name="xtream-save-source-scope" value="all-known"> All known sources</label>
        <small>All known sources uses only sources already stored or already loaded for this channel. It does not start Search or Discovery.</small>
      </fieldset>
      <div id="xtream-save-destination-message" class="playlist-manager-status" data-tone="idle"></div>
      <div class="playlist-actions">
        <button id="xtream-save-destination-confirm" class="button playlists" type="button">Save</button>
        <button id="xtream-save-destination-cancel" class="button ghost" type="button">Cancel</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);
  dialog.addEventListener('pointerdown',event=>event.stopPropagation());
  $('xtream-save-destination-select')?.addEventListener('change',syncNewNameVisibility);
  $('xtream-save-destination-cancel')?.addEventListener('click',closeDialog);
  $('xtream-save-destination-confirm')?.addEventListener('click',persistSelection);
  dialog.addEventListener('close',()=>{pendingDetail=null;});
  return dialog;
}

function syncNewNameVisibility(){
  const wrap=$('xtream-save-new-name-wrap');
  if(wrap)wrap.hidden=$('xtream-save-destination-select')?.value!=='new-custom';
}

function renderDestinations(rows=[]){
  const select=$('xtream-save-destination-select');
  if(!select)return;
  const current=select.value;
  select.replaceChildren();
  const my=document.createElement('option');my.value='my';my.textContent='My Playlist';select.appendChild(my);
  for(const playlist of rows){
    const option=document.createElement('option');
    option.value=`custom:${playlist.id}`;
    option.textContent=clean(playlist.name)||'Custom Playlist';
    select.appendChild(option);
  }
  const create=document.createElement('option');create.value='new-custom';create.textContent='+ New Custom Playlist';select.appendChild(create);
  if([...select.options].some(option=>option.value===current))select.value=current;
  syncNewNameVisibility();
}

async function loadCustomDestinations(generation){
  try{
    const rows=await listCustomPlaylists();
    if(generation!==openingGeneration)return;
    customPlaylists=rows;
    renderDestinations(rows);
  }catch(error){
    if(generation!==openingGeneration)return;
    customPlaylists=[];
    renderDestinations([]);
    const message=$('xtream-save-destination-message');
    if(message){message.textContent=`Custom playlists unavailable · ${error.message}`;message.dataset.tone='error';}
  }
}

async function getKnownContext(){
  const myPlaylist=await window.WebTVMyPlaylistAPI?.getMyPlaylist?.()||[];
  const metadata=await listCustomPlaylists();
  const custom=await Promise.all(metadata.map(async playlist=>({
    id:playlist.id,
    name:playlist.name,
    channels:await getCustomPlaylistChannels(playlist.id),
  })));
  const savedPlaylists=await window.WebTVSavedPlaylistsReadAPI?.getAllCached?.()||[];
  const loadedCatalog=window.WebTVPlaylistAPI?.getChannels?.()||[];
  return{myPlaylist,customPlaylists:custom,savedPlaylists,loadedCatalog};
}

function destinationFromForm(){
  const value=$('xtream-save-destination-select')?.value||'my';
  if(value==='my')return{kind:'my'};
  if(value==='new-custom'){
    const name=clean($('xtream-save-new-name')?.value);
    if(!name)throw new Error('Enter a name for the New Custom Playlist');
    return{kind:'new-custom',name};
  }
  if(value.startsWith('custom:')){
    const playlistId=clean(value.slice('custom:'.length));
    if(!playlistId)throw new Error('Choose a valid Custom Playlist');
    return{kind:'custom',playlistId};
  }
  throw new Error('Choose a valid destination');
}

async function persistSelection(){
  if(!pendingDetail?.candidate||!pendingDetail?.channel){setStatus('Verified preview channel is no longer available','error');closeDialog();return;}
  const confirm=$('xtream-save-destination-confirm');
  const message=$('xtream-save-destination-message');
  try{
    if(confirm)confirm.disabled=true;
    const destination=destinationFromForm();
    const sourceScope=document.querySelector('input[name="xtream-save-source-scope"]:checked')?.value||'selected';
    if(message){message.textContent='Saving verified channel…';message.dataset.tone='busy';}
    const result=await saveVerifiedXtreamChannel({
      candidate:pendingDetail.candidate,
      channel:pendingDetail.channel,
      destination,
      sourceScope,
      deps:{getKnownContext},
    });
    const destinationName=destination.kind==='my'?'My Playlist':destination.kind==='new-custom'?(result.createdPlaylist?.name||destination.name):(customPlaylists.find(item=>item.id===destination.playlistId)?.name||'Custom Playlist');
    setStatus(`${result.channel.name} saved to ${destinationName} · ${sourceScope==='all-known'?'all known sources':'selected source'}`,'ok');
    window.dispatchEvent(new CustomEvent('webtv:xtream-channel-saved',{detail:{channelId:result.channel.id,destination:result.destination,sourceScope}}));
    window.WebTVCloudReadSync?.run?.('xtream-channel-save',{force:true});
    closeDialog();
  }catch(error){
    if(message){message.textContent=`Save failed · ${error.message}`;message.dataset.tone='error';}
    setStatus(`Xtream channel save failed · ${error.message}`,'error');
  }finally{if(confirm)confirm.disabled=false;}
}

function closeDialog(){
  openingGeneration+=1;
  const dialog=$('xtream-save-destination-dialog');
  if(dialog?.open)dialog.close();
  pendingDetail=null;
}

export async function openSaveDestination(detail={}){
  if(!detail?.candidate||!detail?.channel)throw new Error('Verified Xtream preview channel is required');
  const dialog=ensureDialog();
  pendingDetail=detail;
  const generation=++openingGeneration;
  customPlaylists=[];
  renderDestinations([]);
  const channelLabel=$('xtream-save-destination-channel');
  if(channelLabel)channelLabel.textContent=`${clean(detail.channel.name)||'Channel'} · verified preview`;
  const newName=$('xtream-save-new-name');if(newName)newName.value='';
  const selected=document.querySelector('input[name="xtream-save-source-scope"][value="selected"]');if(selected)selected.checked=true;
  const message=$('xtream-save-destination-message');if(message){message.textContent='Choose where to save this channel.';message.dataset.tone='idle';}
  if(typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal();}else dialog.setAttribute('open','');
  loadCustomDestinations(generation);
  return dialog;
}

window.addEventListener('webtv:xtream-preview-save-channel-request',event=>{
  openSaveDestination(event.detail||{}).catch(error=>setStatus(`Save destination failed · ${error.message}`,'error'));
});

window.WebTVXtreamSaveDestination=Object.freeze({open:openSaveDestination,close:closeDialog,getKnownContext});
