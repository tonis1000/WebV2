import { CONFIG } from './config.js';
import { cleanUrl, normalizeId, isHls, workerUrl } from './core/utils.js';
import { scoreSourceUrl } from './core/health-scoring.js';

const BUILD_ID = '20260928-source-save-api';

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

export async function saveBestSourceToCurrent(url,{maxSources=3}={}){
  const source = cleanUrl(url);
  if(!/^https?:\/\//i.test(source)) throw new Error('Valid source URL required');
  const selected = window.WebTVPlaylistAPI?.getSelectedChannel?.();
  if(!selected) throw new Error('No channel selected');

  const playlistApi = window.WebTVMyPlaylistAPI;
  if(!playlistApi?.getMyPlaylist || !playlistApi?.replaceSourcesForCurrent){
    throw new Error('My Playlist source API unavailable');
  }

  const list = await playlistApi.getMyPlaylist();
  if(!Array.isArray(list)) throw new Error('My Playlist API unavailable');

  const key = normalizeId(selected.id||selected.originalId||selected.name);
  const current = list.find(item=>normalizeId(item.id||item.originalId||item.name)===key);
  const existing = [...(current?.directUrls||selected.directUrls||[])];
  const selection = chooseBestSources(source,existing,Math.max(1,Math.min(3,Number(maxSources)||3)));

  const target = await playlistApi.replaceSourcesForCurrent(selection.kept,{reason:'source-hunt-winner'});
  window.dispatchEvent(new CustomEvent('webtv:source-policy-saved',{detail:{channelId:key,winner:source,...selection}}));
  return {channel:target,winner:source,...selection};
}

export { chooseBestSources };
window.WebTVSourcePolicy={saveBestSourceToCurrent,chooseBestSources};
console.info(`[WebTV] Source save policy loaded · build ${BUILD_ID} · My Playlist API write path · verified best 3 max`);
