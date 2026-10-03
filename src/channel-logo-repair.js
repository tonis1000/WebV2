import { resolveChannelProfile } from './core/channel-profile-gr.js';

const BUILD_ID='20261003-logo-repair-b';
const BATCH_LIMIT=25;
const attemptedBackground=new Set();
const brokenChannels=new Set();
const inflight=new Map();

const $=id=>document.getElementById(id);
const keyOf=channel=>String(channel?.id||channel?.originalId||channel?.name||'').trim();

function log(message){console.info('[WebTV Logo Repair]',message);}
function api(){return window.WebTVPlaylistAPI||null;}
function auth(){return window.WebTVRegistryAuth||null;}
function selected(){return api()?.getSelectedChannel?.()||null;}

function inferCountry(channel={}){
  const profile=resolveChannelProfile(channel.id||channel.originalId||channel.name||'');
  if(profile?.country)return profile.country;
  const tvg=String(channel.originalId||channel.tvgId||'').trim();
  const suffix=tvg.match(/\.([a-z]{2})$/i)?.[1];
  if(suffix)return suffix.toUpperCase();
  const haystack=`${channel.group||''} ${channel.name||''}`.toLowerCase();
  if(/german|deutsch|deutschland/.test(haystack))return'DE';
  if(/greek|greece|ελλαδ|ελλην/.test(haystack))return'GR';
  return'';
}

let findResetTimer=0;
function setFindState(text,{busy=false,title='',resetMs=0}={}){
  const button=$('channel-logo-find');
  if(!button)return;
  if(findResetTimer){clearTimeout(findResetTimer);findResetTimer=0;}
  button.textContent=text;
  button.disabled=busy||!selected();
  button.title=title;
  if(resetMs>0){
    findResetTimer=setTimeout(()=>{
      findResetTimer=0;
      setFindState('Find logo',{busy:false,title:'Find and save a curated logo for the selected channel'});
    },resetMs);
  }
}

function setBatchState(text,{busy=false,title=''}={}){
  const button=$('channel-logo-repair-missing');
  if(!button)return;
  button.textContent=text;
  button.disabled=busy;
  button.title=title;
}
function setManagerStatus(text,tone='idle'){
  const el=$('playlist-manager-status');
  if(!el)return;
  el.textContent=text;
  el.dataset.tone=tone;
}

function lookupPayload(channel){
  return{
    channelId:keyOf(channel),
    name:String(channel?.name||'').trim(),
    tvgId:String(channel?.originalId||channel?.tvgId||'').trim(),
    country:inferCountry(channel)
  };
}

async function lookupAndApply(channel,{interactive=false,reason='manual'}={}){
  const key=keyOf(channel);
  if(!key)return{found:false,reason:'channel-id-required'};
  if(inflight.has(key))return inflight.get(key);
  const task=(async()=>{
    const registryAuth=auth();
    if(!registryAuth?.ensureSession||!registryAuth?.base||!registryAuth?.token)return{found:false,reason:'auth-unavailable'};
    const ok=await registryAuth.ensureSession({interactive});
    if(!ok)return{found:false,reason:'auth-required'};
    const token=registryAuth.token();
    const response=await fetch(`${registryAuth.base()}/api/channel-logos/lookup`,{
      method:'POST',cache:'no-store',
      headers:{'content-type':'application/json',authorization:`Bearer ${token}`},
      body:JSON.stringify(lookupPayload(channel))
    });
    let json={};try{json=await response.json();}catch{}
    if(!response.ok)throw new Error(json.error||`Logo lookup HTTP ${response.status}`);
    if(!json.found||!json.override?.logoUrl)return{found:false,reason:'not-found'};
    const applied=api()?.applyLogoCandidate?.({
      channelId:key,
      url:json.override.logoUrl,
      sourceKind:json.override.sourceKind||'curated-third-party',
      sourceUrl:json.override.sourceUrl||'',
      provider:json.override.provider||''
    })||{applied:false,reason:'playlist-api-unavailable'};
    brokenChannels.delete(key);
    log(`${reason} · ${channel.name||key} · ${json.override.provider} · ${applied.reason||'applied'}`);
    return{found:true,override:json.override,applied};
  })().finally(()=>inflight.delete(key));
  inflight.set(key,task);
  return task;
}

async function manualFind(){
  const channel=selected();
  if(!channel)return;
  setFindState('Finding…',{busy:true,title:'Looking up a curated logo'});
  try{
    const result=await lookupAndApply(channel,{interactive:true,reason:'manual-find'});
    if(!result.found){
      setFindState('Not found',{title:'No curated logo found in the configured providers',resetMs:2200});
      setManagerStatus(`No curated logo found for ${channel.name}`,'idle');
      return;
    }
    if(result.applied?.reason==='verified-logo-kept'){
      setFindState('Verified ✓',{title:'Existing verified logo kept',resetMs:2200});
      setManagerStatus(`${channel.name}: verified logo kept · repair candidate saved as lower-trust metadata`,'ok');
      return;
    }
    setFindState('Found ✓',{title:`Last match: ${result.override.provider}`,resetMs:2200});
    setManagerStatus(`${channel.name}: logo found via ${result.override.provider} and saved to D1`,'ok');
  }catch(error){
    setFindState('Error',{title:error.message,resetMs:2200});
    setManagerStatus(`Logo lookup failed · ${error.message}`,'error');
  }
}

function needsRepair(channel){
  const key=keyOf(channel);
  return Boolean(key)&&(!String(channel?.logo||'').trim()||channel?.logoMeta?.trust==='none'||brokenChannels.has(key));
}

async function repairMissing(){
  const registryAuth=auth();
  if(!registryAuth?.ensureSession){setManagerStatus('Registry auth is not ready','error');return;}
  const ok=await registryAuth.ensureSession({interactive:true});
  if(!ok)return;
  const all=api()?.getChannels?.()||[];
  const missing=all.filter(needsRepair);
  if(!missing.length){setManagerStatus('No missing/broken logos in the current catalog','ok');return;}
  const batch=missing.slice(0,BATCH_LIMIT);
  setBatchState(`Repairing 0/${batch.length}…`,{busy:true});
  let found=0;
  try{
    for(let i=0;i<batch.length;i+=1){
      setBatchState(`Repairing ${i+1}/${batch.length}…`,{busy:true});
      setManagerStatus(`Logo repair ${i+1}/${batch.length} · ${batch[i].name}`,'busy');
      try{
        const result=await lookupAndApply(batch[i],{interactive:false,reason:'manual-batch'});
        if(result.found)found+=1;
      }catch(error){log(`batch warning · ${batch[i].name} · ${error.message}`);}
    }
    const remaining=Math.max(0,missing.length-batch.length);
    setManagerStatus(`Logo repair finished · ${found}/${batch.length} found${remaining?` · ${remaining} still queued for another batch`:''}`,'ok');
  }finally{
    setBatchState('Repair missing',{busy:false,title:`Repair up to ${BATCH_LIMIT} missing/broken logos in the current channel list`});
  }
}

async function loadSavedOverrides(){
  const registryAuth=auth();
  if(!registryAuth?.base)return;
  try{
    const response=await fetch(`${registryAuth.base()}/api/channel-logos`,{cache:'no-store'});
    if(!response.ok)return;
    const json=await response.json();
    for(const item of Array.isArray(json.overrides)?json.overrides:[]){
      api()?.applyLogoCandidate?.({
        channelId:item.channelId,
        url:item.logoUrl,
        sourceKind:item.sourceKind||'curated-third-party',
        sourceUrl:item.sourceUrl||'',
        provider:item.provider||''
      });
    }
    if(json.count)log(`loaded ${json.count} sparse D1 logo override(s)`);
  }catch(error){log(`override load warning · ${error.message}`);}
}

function scheduleBackgroundRepair(channel,reason='missing'){
  const key=keyOf(channel);
  if(!key||attemptedBackground.has(key))return;
  attemptedBackground.add(key);
  setTimeout(async()=>{
    try{
      const current=api()?.getChannelById?.(channel.id)||channel;
      if(reason==='missing'&&!needsRepair(current))return;
      await lookupAndApply(current,{interactive:false,reason:`background-${reason}`});
    }catch(error){log(`background warning · ${channel.name||key} · ${error.message}`);}
  },350);
}

function ensureControls(){
  const actions=document.querySelector('.channel-actions');
  if(actions&&!$('channel-logo-find')){
    const button=document.createElement('button');
    button.id='channel-logo-find';button.type='button';button.className='button ghost';button.textContent='Find logo';button.disabled=true;
    button.title='Find and save a curated logo for the selected channel';
    button.addEventListener('click',manualFind);
    actions.insertBefore(button,actions.firstChild);
  }
  if(actions&&!$('channel-logo-repair-missing')){
    const button=document.createElement('button');
    button.id='channel-logo-repair-missing';button.type='button';button.className='button ghost';button.textContent='Repair missing';
    button.title=`Repair up to ${BATCH_LIMIT} missing/broken logos in the current channel list`;
    button.addEventListener('click',repairMissing);
    const find=$('channel-logo-find');
    actions.insertBefore(button,find?.nextSibling||actions.firstChild);
  }
}

function onSelected(channel){
  ensureControls();
  setFindState('Find logo',{busy:false,title:channel?'Find and save a curated logo for this channel':'Select a channel first'});
  if(channel&&needsRepair(channel))scheduleBackgroundRepair(channel,'missing');
}

document.addEventListener('error',event=>{
  const img=event.target;
  if(!(img instanceof HTMLImageElement))return;
  let channel=null;
  const row=img.closest?.('#channel-list [data-channel-id]');
  if(row)channel=api()?.getChannelById?.(row.dataset.channelId)||null;
  else if(img.id==='channel-logo')channel=selected();
  if(!channel)return;
  const key=keyOf(channel);if(key)brokenChannels.add(key);
  scheduleBackgroundRepair(channel,'broken');
},true);

function boot(){
  ensureControls();
  onSelected(selected());
  loadSavedOverrides();
  window.addEventListener('webtv:channel-selected',event=>onSelected(event.detail?.channel||selected()));
}

if(api()?.ready)boot();
else window.addEventListener('webtv:ready',boot,{once:true});

console.info(`[WebTV] Channel Logo Repair loaded · build ${BUILD_ID} · sparse D1 overrides · batch ${BATCH_LIMIT}`);
