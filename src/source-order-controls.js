const MODE_KEY='webtv_v2_source_order_modes';
const $=id=>document.getElementById(id);

function norm(v=''){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9α-ω]+/gi,'-').replace(/^-+|-+$/g,'');}
function channelKey(c={}){return norm(c.id||c.originalId||c.name||'');}
function readModes(){try{const v=JSON.parse(localStorage.getItem(MODE_KEY)||'{}');return v&&typeof v==='object'?v:{};}catch{return {};}}
function getMode(c={}){return readModes()[channelKey(c)]==='manual'?'manual':'auto';}
function setMode(c={},mode='auto'){
  const key=channelKey(c);if(!key)return;
  const map=readModes();
  if(mode==='manual')map[key]='manual';else delete map[key];
  localStorage.setItem(MODE_KEY,JSON.stringify(map));
  window.dispatchEvent(new CustomEvent('webtv:source-order-mode',{detail:{channelId:key,mode:mode==='manual'?'manual':'auto'}}));
}
function setStatus(text,tone='ok'){
  const el=$('playlist-manager-status');if(el){el.textContent=text;el.dataset.tone=tone;}
}
function urlsFromText(text=''){return [...new Set(String(text).split(/\r?\n/).map(s=>s.trim()).filter(s=>/^https?:\/\//i.test(s)))];}
function sameOrder(a=[],b=[]){return a.length===b.length&&a.every((v,i)=>v===b[i]);}

async function myChannels(){try{return await window.WebTVMyPlaylistAPI?.getMyPlaylist?.()||[];}catch{return [];}}
async function resolveEditorChannel(){
  const title=$('source-editor-title')?.textContent||'';
  const name=title.replace(/\s*·\s*Sources\s*$/i,'').trim();
  const current=urlsFromText($('source-editor-text')?.value||'');
  const rows=(await myChannels()).filter(c=>String(c.name||'')===name);
  if(rows.length<=1)return rows[0]||null;
  let best=null,bestScore=-1;
  for(const c of rows){
    const urls=c.directUrls||[];
    const score=urls.filter(u=>current.includes(u)).length+(sameOrder(urls,current)?1000:0);
    if(score>bestScore){best=c;bestScore=score;}
  }
  return best;
}

function routeBelongsToSource(routeKey,source){
  if(routeKey===source)return true;
  try{
    const u=new URL(routeKey);
    const nested=u.searchParams.get('url');
    if(nested&&nested===source)return true;
    if(nested){try{if(decodeURIComponent(nested)===source)return true;}catch{}}
  }catch{}
  return routeKey.includes(encodeURIComponent(source));
}
function resetHealthForChannel(channel){
  const store=window.WebTVHealthStore;
  if(!store?.map||!store?.clearValues)throw new Error('Health store is not ready');
  const sources=[...new Set(channel?.directUrls||[])];
  const keys=Object.keys(store.map).filter(key=>sources.some(source=>routeBelongsToSource(key,source)));
  const removed=store.clearValues(keys);
  return removed;
}

function updateEditorModeUi(channel){
  const badge=$('source-order-mode-badge');if(!badge)return;
  const mode=getMode(channel);
  badge.textContent=mode==='manual'?'MANUAL · Your order':'AUTO · Health ranked';
  badge.dataset.mode=mode;
  $('source-order-manual')?.classList.toggle('playlists',mode==='manual');
  $('source-order-auto')?.classList.toggle('playlists',mode==='auto');
}

async function ensureEditorControls(){
  const overlay=$('source-editor-overlay');
  const editor=overlay?.querySelector('.source-editor');
  if(!editor||overlay.hidden||$('source-order-controls'))return;
  const area=$('source-editor-text');if(!area)return;
  const channel=await resolveEditorChannel();if(!channel)return;
  editor.dataset.sourceOrderChannel=channelKey(channel);
  area.dataset.initialSources=JSON.stringify(channel.directUrls||[]);

  const controls=document.createElement('div');
  controls.id='source-order-controls';
  controls.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 10px';
  controls.innerHTML=`<span id="source-order-mode-badge" class="freshness-badge"></span><button id="source-order-auto" class="button ghost mini" type="button">Use Health order</button><button id="source-order-manual" class="button ghost mini" type="button">Manual order</button><button id="source-order-reset-health" class="button danger mini" type="button">Reset Health for this channel</button>`;
  area.parentNode.insertBefore(controls,area);
  updateEditorModeUi(channel);

  $('source-order-auto').onclick=()=>{setMode(channel,'auto');updateEditorModeUi(channel);setStatus(`${channel.name}: AUTO Health order enabled`,'ok');};
  $('source-order-manual').onclick=()=>{setMode(channel,'manual');updateEditorModeUi(channel);setStatus(`${channel.name}: MANUAL source order enabled`,'ok');};
  $('source-order-reset-health').onclick=()=>{
    try{const n=resetHealthForChannel(channel);setStatus(`${channel.name}: health reset for ${n} route${n===1?'':'s'}`,'ok');refreshDiagnosticsMode();}
    catch(e){setStatus(e.message,'error');}
  };
}

// If the user changes/reorders URLs and presses Save Sources, that explicit order wins.
document.addEventListener('click',async e=>{
  if(e.target?.id!=='source-editor-save')return;
  const channel=await resolveEditorChannel();if(!channel)return;
  const before=channel.directUrls||[];
  const after=urlsFromText($('source-editor-text')?.value||'');
  if(!sameOrder(before,after)){
    setMode(channel,'manual');
    setStatus(`${channel.name}: changed source list saved as MANUAL order`,'ok');
  }
},true);

function diagnosticsOrderBox(){
  const section=$('diagnostics');if(!section)return null;
  let box=$('source-order-diagnostics');
  if(box)return box;
  const grid=section.querySelector('.diagnostic-grid');if(!grid)return null;
  box=document.createElement('div');box.id='source-order-diagnostics';box.className='metric';
  box.innerHTML='<span>Source order</span><strong id="source-order-diagnostics-value">AUTO · Health ranked</strong>';
  grid.appendChild(box);
  const head=section.querySelector('.section-heading');
  if(head&&!$('reset-selected-health')){
    const button=document.createElement('button');button.id='reset-selected-health';button.className='button danger';button.type='button';button.textContent='Reset selected channel health';
    button.addEventListener('click',()=>{
      const c=window.WebTVPlaylistAPI?.getSelectedChannel?.();
      if(!c){setStatus('Choose a channel first','error');return;}
      try{const n=resetHealthForChannel(c);const log=$('diagnostic-log');if(log)log.textContent=`[${new Date().toLocaleTimeString()}] Health reset for ${c.name} · ${n} route(s)\n${log.textContent}`;refreshDiagnosticsMode();}
      catch(err){console.warn('[WebTV] per-channel health reset failed',err);}
    });
    head.appendChild(button);
  }
  return box;
}
function refreshDiagnosticsMode(){
  diagnosticsOrderBox();
  const c=window.WebTVPlaylistAPI?.getSelectedChannel?.();
  const value=$('source-order-diagnostics-value');
  if(value)value.textContent=c?(getMode(c)==='manual'?'MANUAL · Your order':'AUTO · Health ranked'):'AUTO · Health ranked';
}

const observer=new MutationObserver(()=>{ensureEditorControls().catch(()=>{});refreshDiagnosticsMode();});
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
document.addEventListener('click',()=>setTimeout(refreshDiagnosticsMode,0));
window.addEventListener('webtv:source-order-mode',refreshDiagnosticsMode);
ensureEditorControls().catch(()=>{});refreshDiagnosticsMode();

window.WebTVSourceOrder={getMode,setMode,resetHealthForChannel};
console.info('[WebTV] Source order controls loaded · AUTO Health + MANUAL user order + per-channel health reset');
