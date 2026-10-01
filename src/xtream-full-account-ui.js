import { saveVerifiedFullXtreamAccount } from './xtream-full-account-save.js';
import { saveXtreamAccountFromPreview, deleteXtreamAccount } from './xtream-client.js';

const REGISTRY_URL_KEY='webtv_v2_registry_url';
const REGISTRY_TOKEN_KEY='webtv_v2_registry_token';
const DEFAULT_REGISTRY='https://webtv-registry.atonis.workers.dev';
const DB_NAME='webtv-v2-playlists';
const STORE='playlists';

function clean(value=''){return String(value??'').trim();}
function registryUrl(){return clean(localStorage.getItem(REGISTRY_URL_KEY)||DEFAULT_REGISTRY).replace(/\/+$/,'');}
function token(){return clean(localStorage.getItem(REGISTRY_TOKEN_KEY)||'');}
async function ensureSession(){
  const auth=window.WebTVRegistryAuth;
  if(auth?.ensureSession){const ok=await auth.ensureSession({interactive:true});if(!ok)throw new Error('Trusted-device session required');}
  if(!token())throw new Error('Trusted-device session required');
}
async function registryWrite(entry){
  await ensureSession();
  const response=await fetch(`${registryUrl()}/api/playlists`,{
    method:'POST',cache:'no-store',
    headers:{'content-type':'application/json',authorization:`Bearer ${token()}`},
    body:JSON.stringify({id:entry.id,name:entry.name,kind:'xtream',sourceUrl:entry.sourceUrl,rawM3u:entry.rawM3u,channelCount:entry.channelCount,groupCount:entry.groupCount}),
  });
  let json={};try{json=await response.json();}catch{}
  if(!response.ok)throw new Error(json.error||`Registry HTTP ${response.status}`);
  return json.playlist||json;
}
function openDb(){return new Promise((resolve,reject)=>{const q=indexedDB.open(DB_NAME,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE,{keyPath:'id'});};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
async function putLocal(entry){
  const db=await openDb();
  const item={id:entry.id,name:entry.name,type:'xtream',url:entry.sourceUrl,text:entry.rawM3u,channelCount:entry.channelCount,groupCount:entry.groupCount,createdAt:Date.now(),updatedAt:Date.now()};
  return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(item);tx.oncomplete=()=>resolve(item);tx.onerror=()=>reject(tx.error);});
}
async function writeLibraryEntry(entry){
  const saved=await registryWrite(entry);
  await putLocal(entry);
  window.dispatchEvent(new CustomEvent('webtv:cloud-read-synced',{detail:{reason:'xtream-full-account-save'}}));
  return saved;
}
function setStatus(text,tone='idle'){
  const el=document.getElementById('xtream-status');if(el){el.textContent=text;el.dataset.tone=tone;}
}
function identityFromChannel(channel={}){
  const id=clean(channel.tvgId||channel.streamId||channel.name);
  return{id,originalId:id,tvgId:clean(channel.tvgId),name:clean(channel.name)};
}

export async function handleFullAccountSaveRequest(detail={},deps={}){
  const {candidate,account,channel}=detail||{};
  const identity=identityFromChannel(channel||{});
  const suggested=`Xtream · ${clean(account?.name||account?.server)||'Account'}`;
  const askName=deps.askName||((label)=>prompt('Saved Xtream playlist name',label));
  const chosen=askName(suggested);
  if(chosen===null)return null;
  const name=clean(chosen)||suggested;
  const previewSummary=window.WebTVXtream?.getPreview?.()||{};
  const groupCount=document.querySelectorAll('#xtream-preview-group option').length>0?Math.max(0,document.querySelectorAll('#xtream-preview-group option').length-1):0;
  const preview={
    account,
    channelCount:Number(previewSummary.channelCount||0),
    groupCount,
    selected:channel||previewSummary.selected||null,
    channels:Array.isArray(detail.channels)?detail.channels:[],
  };
  setStatus('Saving verified Xtream account securely…','busy');
  const result=await saveVerifiedFullXtreamAccount({candidate,expectedChannel:identity,currentChannel:identity,preview,name},{
    saveAccount:deps.saveAccount||saveXtreamAccountFromPreview,
    writeLibraryEntry:deps.writeLibraryEntry||writeLibraryEntry,
    deleteAccount:deps.deleteAccount||deleteXtreamAccount,
  });
  await window.WebTVXtream?.refreshAccounts?.({quiet:true,interactive:false}).catch(()=>{});
  setStatus(`${result.entry.name} saved as live Xtream playlist · ${result.entry.channelCount} channels`,'ok');
  return result;
}

window.addEventListener('webtv:xtream-preview-save-account-request',event=>{
  handleFullAccountSaveRequest(event.detail||{}).catch(error=>setStatus(`Xtream account save failed · ${error.message}`,'error'));
});

window.WebTVXtreamFullAccount={handleFullAccountSaveRequest,writeLibraryEntry};
