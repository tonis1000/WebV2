const REGISTRY='https://webtv-registry.atonis.workers.dev';
const DB_NAME='webtv-v2-playlists';
const STORE='playlists';
const TOKEN_KEY='webtv_v2_registry_token';
const $=id=>document.getElementById(id);

function norm(v=''){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9α-ω]+/gi,'-').replace(/^-+|-+$/g,'');}
function isXtreamChannel(c){return (c?.directUrls||[]).some(u=>/\/stream\/xt_[^/]+\/\d+\.m3u8/i.test(String(u||'')));}
function xtreamSource(c){return (c?.directUrls||[]).find(u=>/\/stream\/xt_[^/]+\/\d+\.m3u8/i.test(String(u||'')))||'';}
function token(){try{return localStorage.getItem(TOKEN_KEY)||'';}catch{return '';}}
async function ensureSession(){const a=window.WebTVRegistryAuth;if(a?.ensureSession){const ok=await a.ensureSession({interactive:true});if(!ok)throw new Error('Trusted-device session required');}if(!token())throw new Error('Trusted-device session required');}
async function reg(path,options={}){const h=new Headers(options.headers||{});if(token())h.set('authorization',`Bearer ${token()}`);const r=await fetch(`${REGISTRY}${path}`,{cache:'no-store',...options,headers:h});let j={};try{j=await r.json();}catch{}if(!r.ok)throw new Error(j.error||`Registry HTTP ${r.status}`);return j;}
function openDb(){return new Promise((resolve,reject)=>{const q=indexedDB.open(DB_NAME,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE,{keyPath:'id'});};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
async function putLocal(item){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(item);tx.oncomplete=()=>resolve(item);tx.onerror=()=>reject(tx.error);});}
async function allLocal(){const db=await openDb();return new Promise((resolve,reject)=>{const q=db.transaction(STORE,'readonly').objectStore(STORE).getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>reject(q.error);});}
function setStatus(text,tone='ok'){const e=$('xtream-status')||$('playlist-manager-status');if(e){e.textContent=text;e.dataset.tone=tone;}}

async function saveXtreamPlaylist(){
  try{
    await ensureSession();
    let loaded=window.WebTVXtream?.getLoaded?.();
    const select=$('xtream-account-select');
    const accountId=select?.value||loaded?.account?.id||'';
    if(!accountId)throw new Error('Choose an Xtream account first');
    if(!loaded?.account||loaded.account.id!==accountId){await window.WebTVXtream?.loadSelectedAccount?.();loaded=window.WebTVXtream?.getLoaded?.();}
    if(!loaded?.channels?.length)throw new Error('Load the Xtream channels first');
    const account=loaded.account||{};
    const name=(prompt('Saved Xtream playlist name',`Xtream · ${account.name||account.server||'Account'}`)||'').trim();
    if(!name)return;
    const id=`xtpl_${accountId}`;
    const groups=new Set(loaded.channels.map(c=>c.group||c.categoryName||'Xtream')).size;
    const marker=`#EXTM3U\n#EXT-X-WEBTV-XTREAM-ACCOUNT:${accountId}\n#EXTINF:-1 group-title="WebTV System",Xtream account reference\nhttps://webtv.invalid/xtream/${encodeURIComponent(accountId)}\n`;
    const item={id,name,type:'xtream',url:`xtream:${accountId}`,text:marker,channelCount:loaded.channels.length,groupCount:groups,createdAt:Date.now(),updatedAt:Date.now()};
    await reg('/api/playlists',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,name,kind:'xtream',sourceUrl:item.url,rawM3u:marker,channelCount:item.channelCount,groupCount:item.groupCount})});
    await putLocal(item);
    setStatus(`${name} saved as live Xtream playlist · ${item.channelCount} channels`,'ok');
    window.dispatchEvent(new CustomEvent('webtv:cloud-read-synced',{detail:{reason:'xtream-save'}}));
  }catch(e){setStatus(e.message,'error');}
}

function ensureSaveButton(){
  const card=$('xtream-tool-card');if(!card||$('xtream-save-playlist'))return;
  const row=document.createElement('div');row.className='playlist-actions';
  const b=document.createElement('button');b.id='xtream-save-playlist';b.className='button playlists';b.type='button';b.textContent='Save Xtream Playlist';
  b.addEventListener('click',saveXtreamPlaylist);row.appendChild(b);
  const details=card.querySelector('.xtream-advanced');card.insertBefore(row,details||null);
}

async function markXtreamSavedCards(){
  const rows=(await allLocal()).filter(x=>x.type==='xtream'&&String(x.url||'').startsWith('xtream:'));
  const box=$('saved-playlists');if(!box)return;
  for(const card of box.querySelectorAll('.playlist-card')){
    const title=card.querySelector('.playlist-card-title strong')?.textContent||'';
    const item=rows.find(x=>x.name===title);if(!item)continue;
    card.dataset.xtreamAccount=item.url.slice(7);
    const icon=card.querySelector('.playlist-card-icon');if(icon)icon.textContent='👤';
    const buttons=[...card.querySelectorAll('button')];
    const load=buttons.find(b=>b.textContent.trim()==='Load');if(load)load.textContent='Load live';
    const exp=buttons.find(b=>b.textContent.trim()==='Export');if(exp)exp.hidden=true;
  }
}

async function loadSavedXtream(accountId){
  try{
    await window.WebTVXtream?.refreshAccounts?.({quiet:true,interactive:true});
    const select=$('xtream-account-select');if(!select)throw new Error('Xtream panel is not ready');
    select.value=accountId;if(select.value!==accountId)throw new Error('Saved Xtream account no longer exists');
    await window.WebTVXtream?.loadSelectedAccount?.();
    setStatus('Saved Xtream playlist loaded live from account','ok');
  }catch(e){setStatus(e.message,'error');}
}

document.addEventListener('click',e=>{
  const b=e.target.closest?.('.playlist-card button');if(!b||b.textContent.trim()!=='Load live')return;
  const card=b.closest('.playlist-card');const accountId=card?.dataset.xtreamAccount;if(!accountId)return;
  e.preventDefault();e.stopImmediatePropagation();loadSavedXtream(accountId);
},true);

function closeMergeDialog(){document.getElementById('xtream-merge-overlay')?.remove();}
async function openMergeDialog(channel){
  const source=xtreamSource(channel);if(!source)return;
  const mine=await window.WebTVMyPlaylistAPI?.getMyPlaylist?.()||[];
  closeMergeDialog();
  const overlay=document.createElement('div');overlay.id='xtream-merge-overlay';overlay.className='source-editor-overlay';
  const options=mine.map((c,i)=>`<option value="${i}">${String(c.name||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('');
  overlay.innerHTML=`<section class="source-editor" role="dialog" aria-modal="true"><div class="source-editor-head"><div><p class="eyebrow">XTREAM → MY PLAYLIST</p><h3>${channel.name}</h3></div><button id="xtream-merge-close" class="button ghost" type="button">Close</button></div><p class="muted small">Διάλεξε αν το κανάλι θα αποθηκευτεί ξεχωριστά ή αν η Xtream πηγή θα προστεθεί σε υπάρχον κανάλι της My Playlist.</p><div style="display:grid;gap:10px"><button id="xtream-save-separate" class="button playlists" type="button">Save as separate channel</button><select id="xtream-merge-target"><option value="">Choose existing channel…</option>${options}</select><button id="xtream-merge-source" class="button" type="button">Add Xtream source to selected channel</button></div></section>`;
  document.body.appendChild(overlay);
  $('xtream-merge-close').onclick=closeMergeDialog;overlay.addEventListener('pointerdown',ev=>{if(ev.target===overlay)closeMergeDialog();});
  $('xtream-save-separate').onclick=async()=>{try{await window.WebTVMyPlaylistAPI.addCurrent();closeMergeDialog();}catch(err){setStatus(err.message,'error');}};
  $('xtream-merge-source').onclick=async()=>{
    const idx=Number($('xtream-merge-target').value);if(!Number.isInteger(idx)||!mine[idx]){setStatus('Choose a My Playlist channel first','error');return;}
    const target=mine[idx];
    try{
      await ensureSession();
      const urls=[...new Set([...(target.directUrls||[]),source])];
      const payload={id:norm(target.id||target.originalId||target.name),name:target.name,tvgId:target.originalId||target.id||target.name,logo:target.logo||'',groupName:target.group||'Other',directUrls:urls,sources:urls.map((url,i)=>({url,origin:url===source?'xtream':'curated',priority:100+i})),position:Number.isFinite(target.position)?target.position:idx,replaceSources:true};
      await reg('/api/my-playlist/channel',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      await window.WebTVMyPlaylistAPI?.reload?.();
      setStatus(`${channel.name} Xtream source added to ${target.name}`,'ok');closeMergeDialog();
    }catch(err){setStatus(err.message,'error');}
  };
}

document.addEventListener('click',e=>{
  const b=e.target.closest?.('#my-playlist-channel-action');if(!b)return;
  const c=window.WebTVPlaylistAPI?.getSelectedChannel?.();if(!isXtreamChannel(c))return;
  e.preventDefault();e.stopImmediatePropagation();openMergeDialog(c).catch(err=>setStatus(err.message,'error'));
},true);

const observer=new MutationObserver(()=>{ensureSaveButton();markXtreamSavedCards().catch(()=>{});});
observer.observe(document.documentElement,{childList:true,subtree:true});
ensureSaveButton();markXtreamSavedCards().catch(()=>{});

console.info('[WebTV] Xtream enhancements loaded · save live playlist + explicit source merge');
