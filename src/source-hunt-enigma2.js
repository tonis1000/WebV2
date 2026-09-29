import { channelMatchScore } from './channel-identity-gr.js';

const BUILD_ID='20260929-enigma2-visible-proxy';
const $=id=>document.getElementById(id);
const FETCH_TIMEOUT_MS=9000;
const MAX_CANDIDATES=900;
const DEFAULT_WORKER='https://source-huntatonisworkersdev.atonis.workers.dev';

const SEEDS=Object.freeze([
  {name:'HansSettings Greece',url:'https://gitlab.openpli.org/openpli/hanssettings/-/raw/master/e2_hanssettings_9e_13e_19e_23e_28e_AND_rotating/userbouquet.stream_griekenland__gr_.tv?ref_type=heads',viaWorker:true},
  {name:'HansSettings Sport',url:'https://gitlab.openpli.org/openpli/hanssettings/-/raw/master/e2_hanssettings_9e_13e_19e_23e_28e_AND_rotating/userbouquet.stream_sport.tv?ref_type=heads',viaWorker:true},
  {name:'Ciefp IPTV Mix',url:'https://raw.githubusercontent.com/ciefp/ciefpsettings-enigma2/master/ciefp-E2-1sat-19E/userbouquet.ciefpsettings_iptv_mix.tv'},
  {name:'Ciefp IPTV News Music',url:'https://raw.githubusercontent.com/ciefp/ciefpsettings-enigma2/master/ciefp-E2-1sat-19E/userbouquet.ciefpsettings_iptv_news_music.tv'},
  {name:'OpenLD IPTV Unicast',url:'https://raw.githubusercontent.com/OpenLD/enigma2-plugin-settings-defaultsatld/master/etc/enigma2/userbouquet.iptv_unicast.tv'},
]);

let currentCandidates=[];
let currentReports=[];
let currentScanPromise=Promise.resolve([]);
let installed=false;
let originalApi=null;
let wrappedApi=null;

function log(message){const box=$('diagnostic-log');if(!box)return;const stamp=new Date().toLocaleTimeString();box.textContent=`[${stamp}] ${message}\n${box.textContent}`.slice(0,18000);}
function workerEndpoint(){return (localStorage.getItem('webtv_hunt_web_endpoint')||DEFAULT_WORKER).trim().replace(/\/$/,'');}
function safeDecode(value=''){let out=String(value||'');for(let i=0;i<2;i++){try{const next=decodeURIComponent(out);if(next===out)break;out=next;}catch{break;}}return out;}
function normalizeText(value=''){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9α-ω]+/gi,' ').replace(/\s+/g,' ').trim();}
function currentQuery(){return String(window.WebTVSourceHuntQuery?.get?.()||window.WebTVPlaylistAPI?.getSelectedChannel?.()?.name||$('channel-name')?.textContent||'').trim();}
function currentMode(){return String(window.WebTVSourceHuntQuery?.getMode?.()||'exact');}
function candidateMatches(item,query=currentQuery(),mode=currentMode()){return !query||channelMatchScore(String(item?.channelName||''),query,mode)>0;}
function matchedCandidates(){const query=currentQuery(),mode=currentMode();return currentCandidates.filter(item=>candidateMatches(item,query,mode));}
function isPrivateHost(host=''){
  const h=String(host||'').toLowerCase();
  if(!h||h==='localhost'||h==='0.0.0.0'||h==='::1'||h.endsWith('.local'))return true;
  const m=h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);if(!m)return false;
  const a=+m[1],b=+m[2];
  return a===0||a===10||a===127||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
}
function classifyUrl(url=''){
  const clean=String(url||'').split('|')[0].trim();
  if(/\.m3u8(?:[?#]|$)/i.test(clean))return 'hls';
  if(/\.mpd(?:[?#]|$)/i.test(clean))return 'dash';
  if(/\.strm(?:[?#]|$)/i.test(clean))return 'strm';
  if(/^rtmp:/i.test(clean))return 'rtmp';
  if(/^rtsp:/i.test(clean))return 'rtsp';
  return 'direct';
}
function safeHeadersFromSuffix(value=''){
  const out={};const raw=String(value||'').trim();if(!raw)return out;
  const params=new URLSearchParams(raw.replace(/^\?/,'').replace(/^\|/,''));
  for(const [k,v] of params){const key=k.trim().toLowerCase(),value=String(v||'').trim();if(!value||/[\r\n\0]/.test(value))continue;if(key==='user-agent'||key==='user_agent'||key==='useragent')out['User-Agent']=value;else if(key==='referer'||key==='referrer')out.Referer=value;else if(key==='origin')out.Origin=value;}
  return out;
}
function splitHeaders(url=''){
  const decoded=String(url||'');const pipe=decoded.indexOf('|');if(pipe<0)return{url:decoded.trim(),headers:{}};
  return{url:decoded.slice(0,pipe).trim(),headers:safeHeadersFromSuffix(decoded.slice(pipe+1))};
}
function testValueFor(item={}){const url=String(item.sourceUrl||'').trim();const entries=Object.entries(item.requiredHeaders||{});if(!entries.length)return url;const params=new URLSearchParams();for(const [key,value] of entries)params.set(key,value);return `${url}|${params.toString()}`;}
function extractService(line='',nextDescription=''){
  if(!String(line).startsWith('#SERVICE '))return null;
  const raw=String(line).slice(9).trim();const serviceType=raw.split(':',1)[0]||'';
  const schemeMatch=raw.match(/(?:https?|rtmp|rtsp)(?::|%3a)\/\//i);if(!schemeMatch)return null;
  const start=schemeMatch.index;let payload=raw.slice(start);let label='';
  const lastColon=payload.lastIndexOf(':');
  if(lastColon>0){label=safeDecode(payload.slice(lastColon+1)).trim();payload=payload.slice(0,lastColon);}
  const decoded=safeDecode(payload).replace(/%25/gi,'%').trim();const parts=splitHeaders(decoded);if(!parts.url)return null;
  let parsed=null;try{parsed=new URL(parts.url);}catch{return null;}
  const channelName=label||safeDecode(nextDescription||'').replace(/^#DESCRIPTION\s*/i,'').trim()||parsed.hostname;
  return{serviceType,channelName,url:parts.url,requiredHeaders:parts.headers,privateTarget:isPrivateHost(parsed.hostname)};
}
function parseBouquet(text='',seed={}){
  const lines=String(text||'').split(/\r?\n/);const candidates=[];let localOnly=0,unsupported=0,decoded=0;
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();if(!line.startsWith('#SERVICE '))continue;
    const next=lines[i+1]?.trim()||'';const entry=extractService(line,next.startsWith('#DESCRIPTION')?next:'');if(!entry)continue;decoded++;
    if(entry.privateTarget){localOnly++;continue;}
    const type=classifyUrl(entry.url);if(type==='rtmp'||type==='rtsp'){unsupported++;continue;}
    if(!/^https?:\/\//i.test(entry.url)){unsupported++;continue;}
    candidates.push({
      candidateId:`enigma2:${seed.name}:${i}:${entry.url}`,
      channelName:entry.channelName,
      normalizedChannelName:normalizeText(entry.channelName),
      sourceType:type,
      sourceUrl:entry.url,
      sourceOrigin:`${seed.name} · ${seed.url}`,
      discoveryProvider:'enigma2-bouquet',
      discoveredAt:new Date().toISOString(),
      freshness:'live-seed-scan',
      requiredHeaders:entry.requiredHeaders,
      verificationStatus:'UNVERIFIED',
      verified:false,
      matchConfidence:'MEDIUM',
      candidateKind:'direct-media',
      trustClass:'PUBLIC_DISCOVERY',
      saveEligible:true,
      playlistSourceUrl:seed.url,
      playlistSourceName:seed.name,
      enigmaServiceType:entry.serviceType,
    });
    if(candidates.length>=MAX_CANDIDATES)break;
  }
  return{candidates,decoded,localOnly,unsupported};
}
async function directFetchText(url){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);try{const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return{text:await response.text(),status:response.status,via:'direct'};}finally{clearTimeout(timer);}}
async function workerFetchText(url){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS+3000);try{const proxy=`${workerEndpoint()}/bouquet-proxy?url=${encodeURIComponent(url)}`;const response=await fetch(proxy,{cache:'no-store',signal:controller.signal});if(!response.ok){let detail='';try{detail=(await response.json())?.error||'';}catch{}throw new Error(`Worker ${response.status}${detail?` · ${detail}`:''}`);}return{text:await response.text(),status:response.status,via:'worker-proxy'};}finally{clearTimeout(timer);}}
async function fetchSeedText(seed){if(seed.viaWorker)return workerFetchText(seed.url);try{return await directFetchText(seed.url);}catch(error){log(`ENIGMA2 DIRECT FETCH FAILED · ${seed.name} · ${error?.message||error} · trying Worker`);return workerFetchText(seed.url);}}
function ensureUi(){
  const external=$('hunt-external');const curated=$('hunt-curated-results');if(!external||!curated)return false;
  if($('hunt-enigma2-results'))return true;
  const head=document.createElement('div');head.id='hunt-enigma2-head';head.className='hunt-auto-head';head.innerHTML='<div><strong>Enigma2 Bouquets</strong><span id="hunt-enigma2-count">Not scanned yet</span></div>';
  const results=document.createElement('div');results.id='hunt-enigma2-results';results.className='hunt-results';
  curated.insertAdjacentElement('afterend',results);results.insertAdjacentElement('beforebegin',head);return true;
}
function renderUi(){
  if(!ensureUi())return;
  const box=$('hunt-enigma2-results'),count=$('hunt-enigma2-count');if(!box)return;box.replaceChildren();
  const query=currentQuery()||'selected channel',matches=matchedCandidates();const ok=currentReports.filter(r=>r.ok).length;const publicCount=currentReports.reduce((n,r)=>n+Number(r.candidates||0),0);const localOnly=currentReports.reduce((n,r)=>n+Number(r.localOnly||0),0);const unsupported=currentReports.reduce((n,r)=>n+Number(r.unsupported||0),0);
  if(count)count.textContent=currentReports.length?`${currentReports.length} bouquets · ${ok} read · ${publicCount} public scanned · ${matches.length} matched ${query} · ${localOnly} local-only · ${unsupported} unsupported`:'Not scanned yet';
  if(!currentReports.length){const empty=document.createElement('div');empty.className='hunt-empty';empty.textContent='Δεν έχει γίνει ακόμη Enigma2 scan.';box.appendChild(empty);return;}
  const bySeed=new Map();for(const item of matches){const key=item.playlistSourceName||'Enigma2';if(!bySeed.has(key))bySeed.set(key,[]);bySeed.get(key).push(item);}
  for(const report of currentReports){
    const row=document.createElement('div');row.className='hunt-result';row.dataset.channelName=query;
    const meta=document.createElement('div'),strong=document.createElement('strong'),detail=document.createElement('span');strong.textContent=report.name;const matched=bySeed.get(report.name)?.length||0;const bits=[report.ok?(report.via==='worker-proxy'?'Worker proxy':'direct'):'fetch failed',report.ok?`HTTP ${report.status||200}`:(report.error||'failed'),`${report.candidates||0} public`,`${matched} match${matched===1?'':'es'}`];if(Number.isFinite(report.elapsedMs))bits.push(`${report.elapsedMs} ms`);detail.textContent=bits.join(' · ');meta.append(strong,detail);row.append(meta);box.appendChild(row);
    for(const item of (bySeed.get(report.name)||[]).slice(0,8)){
      const card=document.createElement('div');card.className='hunt-result';card.dataset.channelName=item.channelName||query;const body=document.createElement('div'),name=document.createElement('strong'),info=document.createElement('span'),code=document.createElement('code');name.textContent=`${report.name} · ${item.channelName}`;info.textContent=`${String(item.sourceType||'stream').toUpperCase()} · Enigma2 ${item.enigmaServiceType||''} · identity matched`;code.textContent=testValueFor(item);body.append(name,info,code);const test=document.createElement('button');test.className='button';test.type='button';test.textContent='Test';test.addEventListener('click',()=>{const input=$('candidate-url');if(input){input.value=testValueFor(item);input.dispatchEvent(new Event('input',{bubbles:true}));}$('test-candidate')?.click();log(`ENIGMA2 MANUAL TEST · ${query} · ${report.name} · ${item.channelName} · ${item.sourceUrl}`);});card.append(body,test);box.appendChild(card);
    }
  }
}
async function scanAll(){
  const started=performance.now();const reports=[];const merged=[];const seen=new Set();
  await Promise.all(SEEDS.map(async seed=>{
    const t0=performance.now();try{const fetched=await fetchSeedText(seed);const parsed=parseBouquet(fetched.text,seed);for(const item of parsed.candidates){const key=`${item.sourceUrl}|${JSON.stringify(item.requiredHeaders||{})}`;if(seen.has(key))continue;seen.add(key);merged.push(item);}reports.push({name:seed.name,url:seed.url,ok:true,status:fetched.status,via:fetched.via,decoded:parsed.decoded,candidates:parsed.candidates.length,localOnly:parsed.localOnly,unsupported:parsed.unsupported,elapsedMs:Math.round(performance.now()-t0)});}catch(error){reports.push({name:seed.name,url:seed.url,ok:false,error:error?.message||String(error),decoded:0,candidates:0,localOnly:0,unsupported:0,elapsedMs:Math.round(performance.now()-t0)});}
  }));
  currentCandidates=merged.slice(0,MAX_CANDIDATES);currentReports=reports.sort((a,b)=>SEEDS.findIndex(s=>s.name===a.name)-SEEDS.findIndex(s=>s.name===b.name));renderUi();
  const ok=reports.filter(r=>r.ok).length,localOnly=reports.reduce((n,r)=>n+r.localOnly,0),unsupported=reports.reduce((n,r)=>n+r.unsupported,0),matches=matchedCandidates();
  log(`ENIGMA2 HUNT DONE · ${ok}/${SEEDS.length} bouquets · ${currentCandidates.length} public scanned · ${matches.length} identity-matched ${currentQuery()||'channel'} · ${localOnly} local-only filtered · ${unsupported} unsupported filtered · ${Math.round(performance.now()-started)} ms`);
  return matches;
}
function startScan(){ensureUi();const count=$('hunt-enigma2-count');if(count)count.textContent=`Scanning Enigma2 bouquets for ${currentQuery()||'selected channel'}…`;currentScanPromise=scanAll().catch(error=>{log(`ENIGMA2 HUNT FAILED · ${error?.message||error}`);currentCandidates=[];currentReports=[];renderUi();return[];});return currentScanPromise;}
function snapshotWithEnigma(snapshot){
  const base=snapshot||{};const baseCandidates=Array.isArray(base.candidates)?base.candidates:[];const matched=matchedCandidates();const all=[...baseCandidates,...matched];
  const lanes={...(base.lanes||{}),enigma2:matched.length};if(Number.isFinite(Number(lanes.total)))lanes.total=Number(lanes.total)+matched.length;
  return{...base,candidates:all,lanes,enigma2:{buildId:BUILD_ID,scanned:currentCandidates.length,matched:matched.length,reports:currentReports.map(r=>({...r}))}};
}
function installApiWrapper(){
  const api=window.WebTVDiscovery;if(!api||api===wrappedApi)return false;
  originalApi=api;
  wrappedApi=Object.freeze({...api,snapshot:()=>snapshotWithEnigma(api.snapshot?.()),verifyAll:async(...args)=>{await currentScanPromise.catch(()=>{});return api.verifyAll?.(...args);}});
  window.WebTVDiscovery=wrappedApi;if(window.WebTVDiscoveryPhase1===api)window.WebTVDiscoveryPhase1=wrappedApi;
  return true;
}
function bindOneClick(){
  const button=$('hunt-oneclick');if(!button||button.dataset.enigma2Bound==='1')return false;
  button.dataset.enigma2Bound='1';button.addEventListener('click',()=>{startScan();},{capture:true});return true;
}
function install(){if(installed)return;installed=true;const tick=()=>{installApiWrapper();bindOneClick();ensureUi();};tick();window.addEventListener('webtv:ready',tick);new MutationObserver(tick).observe(document.body,{childList:true,subtree:true});console.info(`[WebTV] Enigma2 Source Hunt lane loaded · ${BUILD_ID} · ${SEEDS.length} bouquet seeds · HansSettings via Worker proxy · visible identity-matched results`);}

install();
window.WebTVEnigma2Hunt={buildId:BUILD_ID,scan:startScan,getCandidates:()=>matchedCandidates().map(item=>({...item,requiredHeaders:{...(item.requiredHeaders||{})}})),getAllCandidates:()=>currentCandidates.map(item=>({...item,requiredHeaders:{...(item.requiredHeaders||{})}})),getReports:()=>currentReports.map(item=>({...item})),seeds:SEEDS.map(item=>({...item}))};
