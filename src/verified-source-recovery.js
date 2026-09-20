import { parseM3U, dedupeChannels } from './core/channel-catalog.js?v=20260920-1021';
import { cleanUrl, normalizeId } from './core/utils.js?v=20260920-1021';

const BUILD_ID = '20260920-1945';
const SOURCE_KEY = 'webtv_v2_saved_sources';
const DB_NAME = 'webtv-v2-playlists';
const STORE = 'playlists';
const MY_ID = '__my_playlist__';
const RELOAD_KEY = `webtv_v2_verified_recovery_${BUILD_ID}`;

function escAttr(value=''){return String(value||'').replace(/"/g,"'");}
function channelToLines(channel){const urls=[...new Set((channel.directUrls||[]).map(cleanUrl).filter(u=>/^https?:\/\//i.test(u)))];const ext=`#EXTINF:-1 tvg-id="${escAttr(channel.originalId||channel.id||channel.name)}" tvg-name="${escAttr(channel.name)}" tvg-logo="${escAttr(channel.logo||'')}" group-title="${escAttr(channel.group||'Other')}",${channel.name}`;if(!urls.length)return[ext,''];const lines=[];for(const url of urls)lines.push(ext,url);return lines;}
function channelsToM3U(channels){const lines=['#EXTM3U'];for(const c of channels)lines.push(...channelToLines(c));return `${lines.join('\n')}\n`;}
function readVerified(){try{return JSON.parse(localStorage.getItem(SOURCE_KEY)||'{}');}catch{return{};}}
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function getItem(db){return new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(MY_ID);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
function putItem(db,item){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(item);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
function sourceCount(channels){return channels.reduce((sum,c)=>sum+(c.directUrls||[]).length,0);}

async function recover(){
  const verified=readVerified();
  if(!verified||typeof verified!=='object'||!Object.keys(verified).length)return;
  const db=await openDb();
  const item=await getItem(db);
  if(!item?.text)return;

  const before=parseM3U(item.text);
  const beforeCount=sourceCount(before);
  let touched=false;

  const merged=before.map(channel=>{
    const keys=new Set([
      normalizeId(channel.name||''),
      normalizeId(channel.id||''),
      normalizeId(channel.originalId||'')
    ].filter(Boolean));
    const extra=[];
    for(const [key,rows] of Object.entries(verified)){
      if(!keys.has(normalizeId(key)))continue;
      for(const row of Array.isArray(rows)?rows:[]){const url=cleanUrl(row?.url||row||'');if(/^https?:\/\//i.test(url))extra.push(url);}
    }
    const urls=[...new Set([...(channel.directUrls||[]).map(cleanUrl),...extra].filter(Boolean))];
    if(urls.length!==(channel.directUrls||[]).length)touched=true;
    return {...channel,directUrls:urls};
  });

  if(!touched)return;
  const finalChannels=dedupeChannels(merged);
  const text=channelsToM3U(finalChannels);
  const groupCount=new Set(finalChannels.map(c=>c.group||'Other')).size;
  await putItem(db,{...item,text,channelCount:finalChannels.length,groupCount,updatedAt:Date.now()});

  const afterCount=sourceCount(finalChannels);
  console.info(`[WebTV] verified source recovery ${BUILD_ID}: ${beforeCount} → ${afterCount} sources`);
  if(sessionStorage.getItem(RELOAD_KEY)!=='1'){
    sessionStorage.setItem(RELOAD_KEY,'1');
    setTimeout(()=>location.reload(),150);
  }
}

recover().catch(error=>console.warn('[WebTV] verified source recovery failed',error));
