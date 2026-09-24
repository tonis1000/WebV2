import { CONFIG } from './config.js';
import { cleanUrl, normalizeId, isHls, workerUrl } from './core/utils.js';
import { scoreSourceUrl } from './core/health-scoring.js';

const BUILD_ID = '20260924-stabilization';
const REGISTRY_URL_KEY = 'webtv_v2_registry_url';
const REGISTRY_TOKEN_KEY = 'webtv_v2_registry_token';
const DEFAULT_REGISTRY = CONFIG.registryUrl || 'https://webtv-registry.atonis.workers.dev';

function registryUrl(){
  return (localStorage.getItem(REGISTRY_URL_KEY) || DEFAULT_REGISTRY).trim().replace(/\/$/, '');
}
function registryToken(){return localStorage.getItem(REGISTRY_TOKEN_KEY) || '';}
function loadHealth(){
  try{return JSON.parse(localStorage.getItem(CONFIG.healthStorageKey) || '{}');}
  catch{return{};}
}
function sourceHealthScore(url, health){
  const source = cleanUrl(url);
  return scoreSourceUrl(source, health, {
    workerUrlForSource: value => isHls(value) && CONFIG.workerForHls ? cleanUrl(workerUrl(value)) : value,
  });
}
function sourceFamily(value=''){
  try{
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./,'');
    const parts = host.split('.').filter(Boolean);
    return parts.length >= 2 ? parts.slice(-2).join('.') : host;
  }catch{return cleanUrl(value);}
}
function uniqueUrls(values=[]){
  const seen = new Set();
  const out = [];
  for(const raw of values){
    const url = cleanUrl(raw);
    if(!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);out.push(url);
  }
  return out;
}
function chooseBestSources(winner,existing,maxSources=3){
  const health = loadHealth();
  const preferred = cleanUrl(winner);
  const pool = uniqueUrls([preferred,...existing]);
  const ranked = pool.map((url,index)=>({
    url,index,
    winner:url===preferred,
    score:sourceHealthScore(url,health),
    family:sourceFamily(url)
  })).sort((a,b)=>Number(b.winner)-Number(a.winner) || b.score-a.score || a.index-b.index);

  const chosen = [];
  const families = new Set();
  const take = item => {
    if(chosen.some(row=>row.url===item.url) || chosen.length>=maxSources) return;
    chosen.push(item);families.add(item.family);
  };
  const winnerRow = ranked.find(row=>row.winner);
  if(winnerRow) take(winnerRow);
  for(const item of ranked){
    if(chosen.length>=maxSources) break;
    if(!families.has(item.family)) take(item);
  }
  for(const item of ranked){
    if(chosen.length>=maxSources) break;
    take(item);
  }
  return {kept:chosen.map(row=>row.url),dropped:pool.filter(url=>!chosen.some(row=>row.url===url)),ranked};
}
async function ensureWriteSession(){
  const auth = window.WebTVRegistryAuth;
  if(auth?.ensureSession){
    const ok = await auth.ensureSession({interactive:true});
    if(!ok) throw new Error('D1 write cancelled');
    return;
  }
  if(!registryToken()) throw new Error('Trusted-device session is required');
}
async function putChannel(channel,position){
  await ensureWriteSession();
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),12000);
  try{
    const response = await fetch(`${registryUrl()}/api/my-playlist/channel`,{
      method:'PUT',cache:'no-store',signal:controller.signal,
      headers:{'content-type':'application/json',authorization:`Bearer ${registryToken()}`},
      body:JSON.stringify({
        id:normalizeId(channel.id||channel.originalId||channel.name),
        name:channel.name,
        tvgId:channel.originalId||channel.id||channel.name,
        logo:channel.logo||'',
        groupName:channel.group||'Other',
        directUrls:[...(channel.directUrls||[])],
        sources:(channel.directUrls||[]).map((url,i)=>({url,origin:'verified',priority:100+i})),
        position,
        replaceSources:true
      })
    });
    let json={};try{json=await response.json();}catch{}
    if(!response.ok) throw new Error(json.error||`Registry HTTP ${response.status}`);
    return json;
  }finally{clearTimeout(timer);}
}

export async function saveBestSourceToCurrent(url,{maxSources=3}={}){
  const source = cleanUrl(url);
  if(!/^https?:\/\//i.test(source)) throw new Error('Valid source URL required');
  const selected = window.WebTVPlaylistAPI?.getSelectedChannel?.();
  if(!selected) throw new Error('No channel selected');
  const list = await window.WebTVMyPlaylistAPI?.getMyPlaylist?.();
  if(!Array.isArray(list)) throw new Error('My Playlist API unavailable');

  const key = normalizeId(selected.id||selected.originalId||selected.name);
  let index = list.findIndex(item=>normalizeId(item.id||item.originalId||item.name)===key);
  let target;
  if(index<0){
    index=list.length;
    target={...selected,directUrls:[...(selected.directUrls||[])]};
  }else{
    target={...list[index],directUrls:[...(list[index].directUrls||[])]};
  }

  const selection = chooseBestSources(source,target.directUrls,Math.max(1,Math.min(3,Number(maxSources)||3)));
  target.directUrls=selection.kept;
  await putChannel(target,index);
  await window.WebTVMyPlaylistAPI?.reload?.();
  window.dispatchEvent(new CustomEvent('webtv:source-policy-saved',{detail:{channelId:key,winner:source,...selection}}));
  return {channel:target,winner:source,...selection};
}

export { chooseBestSources };
window.WebTVSourcePolicy={saveBestSourceToCurrent,chooseBestSources};
console.info(`[WebTV] Source save policy loaded · build ${BUILD_ID} · shared health scoring · verified best 3 max`);
