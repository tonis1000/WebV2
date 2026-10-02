import './source-hunt-discovery-integration.js?v=20260928-source-hunt-playlist-provenance';

const DB_NAME='webtv-v2-playlists';
const STORE='playlists';
const REGISTRY_URL_KEY='webtv_v2_registry_url';
const REGISTRY_TOKEN_KEY='webtv_v2_registry_token';
const DEFAULT_REGISTRY='https://webtv-registry.atonis.workers.dev';

function registryUrl(){return (localStorage.getItem(REGISTRY_URL_KEY)||DEFAULT_REGISTRY).trim().replace(/\/$/,'');}
function token(){return localStorage.getItem(REGISTRY_TOKEN_KEY)||'';}
async function ensureSession(){const auth=window.WebTVRegistryAuth;if(auth?.ensureSession){const ok=await auth.ensureSession({interactive:true});if(!ok)throw new Error('Save cancelled');return;}if(!token())throw new Error('Trusted-device session is required');}
async function request(path,options={}){const headers={...(options.headers||{})};if(options.json)headers['content-type']='application/json';if(token())headers.authorization=`Bearer ${token()}`;const r=await fetch(`${registryUrl()}${path}`,{cache:'no-store',...options,headers});let j={};try{j=await r.json();}catch{}if(!r.ok)throw new Error(j.error||`Registry HTTP ${r.status}`);return j;}
function slug(value=''){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9α-ω]+/gi,'-').replace(/^-+|-+$/g,'');}
function esc(value=''){return String(value||'').replace(/"/g,"'");}
function channelM3U(channel,url){return `#EXTM3U\n#EXTINF:-1 tvg-id="${esc(channel.tvgId||channel.originalId||channel.name)}" tvg-name="${esc(channel.name)}" tvg-logo="${esc(channel.logo||'')}" group-title="${esc(channel.group||'Discovered')}",${channel.name}\n${url}\n`;}
function appendChannelM3U(text,channel,url){let base=String(text||'').trim();if(!base.startsWith('#EXTM3U'))base='#EXTM3U';const id=slug(channel.tvgId||channel.originalId||channel.name);const name=String(channel.name||'').toLowerCase();if(base.toLowerCase().includes(`tvg-id="${id}"`)||base.toLowerCase().includes(`tvg-name="${name}"`))return base+'\n';return `${base}\n${channelM3U(channel,url).replace(/^#EXTM3U\n/,'')}`;}
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function savedPlaylists(){const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).getAll();req.onsuccess=()=>resolve((req.result||[]).filter(x=>x.id!=='__my_playlist__'));req.onerror=()=>reject(req.error);});}
async function putLocal(item){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(item);tx.oncomplete=()=>resolve(item);tx.onerror=()=>reject(tx.error);});}
async function saveMyPlaylist(channel,url){const api=window.WebTVMyPlaylistAPI;if(!api?.saveDiscoveredChannel)throw new Error('My Playlist discovered-channel API unavailable');await api.saveDiscoveredChannel(channel,[{url,origin:'source-hunt',priority:100}],{reason:'source-hunt-save'});window.dispatchEvent(new CustomEvent('webtv:source-hunt-saved',{detail:{destination:'my-playlist',channel,url}}));return 'Saved to My Playlist';}
async function pushSaved(item){await ensureSession();await request('/api/playlists',{method:'POST',json:true,body:JSON.stringify({id:item.id,name:item.name,kind:item.type||'saved',sourceUrl:item.url||'',rawM3u:item.text,channelCount:item.channelCount||1,groupCount:item.groupCount||1})});await putLocal(item);window.dispatchEvent(new Event('webtv:cloud-read-synced'));return item;}
async function saveExisting(channel,url,id){const rows=await savedPlaylists();const item=rows.find(x=>x.id===id);if(!item)throw new Error('Saved Playlist not found');const text=appendChannelM3U(item.text,channel,url);const count=(text.match(/^#EXTINF/gm)||[]).length;await pushSaved({...item,text,channelCount:count,updatedAt:Date.now()});return `Saved to ${item.name}`;}
async function saveNew(channel,url,name){const clean=String(name||'').trim();if(!clean)throw new Error('Playlist name required');const now=Date.now();const item={id:`pl_${now.toString(36)}_${Math.random().toString(36).slice(2,8)}`,name:clean,type:'paste',url:'',text:channelM3U(channel,url),channelCount:1,groupCount:1,createdAt:now,updatedAt:now};await pushSaved(item);return `Created ${clean}`;}

export async function showSaveDestination({channel,url}){
  document.getElementById('hunt-save-destination')?.remove();
  const panel=document.getElementById('source-hunt');if(!panel)return;
  const rows=await savedPlaylists().catch(()=>[]);
  const box=document.createElement('div');box.id='hunt-save-destination';box.className='hunt-auto';
  box.innerHTML=`<div class="hunt-auto-head"><div><strong>Working stream ✓ · Save channel</strong><span>${channel.name}</span></div></div><div class="inline-form"><select id="hunt-save-target"><option value="my">My Playlist</option>${rows.map(x=>`<option value="saved:${x.id}">${x.name}</option>`).join('')}<option value="new">+ New Playlist</option></select><input id="hunt-save-new-name" type="text" placeholder="New playlist name" hidden><button id="hunt-save-confirm" class="button" type="button">Save</button></div><div id="hunt-save-status" class="muted small">Choose destination. Nothing is saved until you press Save.</div>`;
  const advanced=document.getElementById('hunt-advanced');if(advanced)panel.insertBefore(box,advanced);else panel.appendChild(box);
  const target=box.querySelector('#hunt-save-target'),newName=box.querySelector('#hunt-save-new-name'),button=box.querySelector('#hunt-save-confirm'),status=box.querySelector('#hunt-save-status');
  target.addEventListener('change',()=>{newName.hidden=target.value!=='new';});
  button.addEventListener('click',async()=>{button.disabled=true;status.textContent='Saving…';try{let message='';if(target.value==='my')message=await saveMyPlaylist(channel,url);else if(target.value==='new')message=await saveNew(channel,url,newName.value);else message=await saveExisting(channel,url,target.value.slice(6));status.textContent=`${message} ✓`;}catch(error){status.textContent=`Save failed · ${error.message}`;}finally{button.disabled=false;}});
}

window.WebTVSourceHuntSave={showSaveDestination};
