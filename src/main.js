import { CONFIG, OFFICIAL_LIVE } from './config.js';
import { parseM3U, dedupeChannels } from './core/channel-catalog.js?v=20261006-m3u-import-a';
import { resolveChannelProfile } from './core/channel-profile-gr.js';
import { canonicalDefaultChannelName } from './channel-display-name.js';
import { resolveChannelLogo } from './core/channel-logo.js';
import { promoteImportedChannel } from './core/import-promotion-policy.js';
import { HealthStore } from './core/health-store.js?v=20261006-health-v2';
import { SourceRegistry, SOURCE_REGISTRY_BUILD_ID } from './core/source-registry.js';
import { EpgService } from './core/epg.js?v=20261006-epg-performance-a';
import { PlayerController } from './core/player.js';
import { formatTime, normalizeId, parseIptvUrl, isHls, workerUrl } from './core/utils.js';
import { safeLogo, prepareLazyLogo, applyImmediateLogo } from './logo-utils.js';
import { StrmResolver, isStrmReference } from './core/strm-resolver.js';
import { discoverCuratedRemoteFeeds, discoverGithubPublicPlaylists, discoverStrmSpecific } from './discovery/external-discovery-client.js';
import { verifySearchCandidates } from './search/search-verification.js';
import { refreshReferencesForSourceRows, runSourceSelfHeal } from './source-self-heal.js';

const BUILD_ID = '20261007-my-playlist-self-heal-a';
const REGISTRY_URL_KEY = 'webtv_v2_registry_url';
const MY_PLAYLIST_STARTUP_CACHE_KEY = 'webtv_v2_my_playlist_startup_cache_v1';
const MY_PLAYLIST_STARTUP_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_REGISTRY = CONFIG.registryUrl || 'https://webtv-registry.atonis.workers.dev';
const DEBUG_FLAGS = new Set((new URLSearchParams(location.search).get('debug') || '').split(',').map(v => v.trim()).filter(Boolean));
const DEBUG_STORAGE = DEBUG_FLAGS.has('storage') || DEBUG_FLAGS.has('all');
const candidateStrmResolver = new StrmResolver();
const $ = id => document.getElementById(id);

const els = {
  clock:$('clock'), list:$('channel-list'), summary:$('channel-summary'), search:$('search'), group:$('group-filter'),
  logo:$('channel-logo'), channelName:$('channel-name'), channelGroup:$('channel-group'), status:$('playback-status'), officialLive:$('official-live'),
  video:$('video'), iframe:$('iframe'), empty:$('empty-state'), programTitle:$('program-title'), programDescription:$('program-description'), programTime:$('program-time'),
  progress:$('epg-progress'), progressBar:$('epg-progress').querySelector('span'), next:$('next-programs'), diagnostics:$('diagnostics'), diagToggle:$('diagnostics-toggle'),
  diagSource:$('diag-source'), diagRoute:$('diag-route'), diagPlayer:$('diag-player'), diagStartup:$('diag-startup'), diagLog:$('diagnostic-log'), clearHealth:$('clear-health'),
  sourceHuntToggle:$('source-hunt-toggle'), sourceHunt:$('source-hunt'), huntChannel:$('hunt-channel'), candidateUrl:$('candidate-url'), testCandidate:$('test-candidate')
};

const health = new HealthStore();
const sources = new SourceRegistry(health);
const epg = new EpgService();
let epgCatalogRefreshTimer=0;
function refreshEpgForCatalog({force=false}={}){
  if(epgCatalogRefreshTimer)clearTimeout(epgCatalogRefreshTimer);
  return new Promise(resolve=>{
    epgCatalogRefreshTimer=setTimeout(()=>{
      epgCatalogRefreshTimer=0;
      epg.refresh({force,channels}).then(()=>{renderEpg();resolve(true);}).catch(error=>{log(`EPG refresh failed: ${error.message}`);resolve(false);});
    },80);
  });
}
let channels = [];
let selected = null;
let catalogMode = 'cloud';
let selectionToken = 0;
const channelRows = new Map();

const selfHealHistory=[];
let diagnosticsState={
  source:'',
  playbackUrl:'',
  route:'',
  player:'',
  startupMs:0,
  error:'',
  fallback:false,
  playbackState:'idle',
  playbackLabel:'Idle',
};
window.WebTVDiagnosticsAPI={
  buildId:BUILD_ID,
  lastRoutePlan:[],
  getSnapshot:()=>({...diagnosticsState}),
  getSourceHealthRows:channel=>sources.getCuratedRouteDiagnostics(channel),
  healthSummary:()=>({entries:Object.keys(health.map||{}).length,storageKey:health.storageKey}),
  getSelfHealHistory:()=>selfHealHistory.map(item=>({...item,detail:item.detail&&typeof item.detail==='object'?{...item.detail}:item.detail})),
};

const player = new PlayerController({
  video:els.video,
  iframe:els.iframe,
  emptyState:els.empty,
  health,
  onState:setPlaybackState,
  onDiagnostics:updateDiagnostics
});

function log(message){
  const stamp=new Date().toLocaleTimeString();
  els.diagLog.textContent=`[${stamp}] ${message}\n${els.diagLog.textContent}`.slice(0,18000);
}
function storageProbe(){
  if(!DEBUG_STORAGE)return null;
  const key='webtv_v2_health_probe';
  const previous=localStorage.getItem(key);
  const next=String((Number(previous)||0)+1);
  let writeOk=false, readBack='', error='';
  try{
    localStorage.setItem(key,next);
    readBack=localStorage.getItem(key)||'';
    writeOk=readBack===next;
  }catch(e){error=e?.message||String(e);}
  return {previous:previous||'',next,readBack,writeOk,error,origin:location.origin,href:location.href};
}
function registryUrl(){
  return (localStorage.getItem(REGISTRY_URL_KEY) || DEFAULT_REGISTRY).trim().replace(/\/$/,'');
}
function sourceLabel(value=''){
  try{
    const url=new URL(value);
    const path=url.pathname.length>70?`…${url.pathname.slice(-67)}`:url.pathname;
    return `${url.hostname}${path}`;
  }catch{return value||'-';}
}
function renderSourceHunt(channel){
  if(!channel){els.sourceHuntToggle.hidden=true;els.sourceHunt.hidden=true;return;}
  els.sourceHuntToggle.hidden=false;
  els.huntChannel.textContent=channel.name;
}
function publishDiagnostics(){
  window.dispatchEvent(new CustomEvent('webtv:diagnostics-updated',{detail:{...diagnosticsState}}));
}
function setPlaybackState(state,label){
  els.status.className=`status-pill ${state}`;
  els.status.textContent=label;
  diagnosticsState={...diagnosticsState,playbackState:state||'',playbackLabel:label||''};
  publishDiagnostics();
}
function clearDiagnostics(){
  els.diagSource.textContent='-';
  els.diagRoute.textContent='-';
  els.diagPlayer.textContent='-';
  els.diagStartup.textContent='-';
  diagnosticsState={...diagnosticsState,source:'',playbackUrl:'',route:'',player:'',startupMs:0,error:'',fallback:false};
  publishDiagnostics();
}
function updateDiagnostics(info){
  diagnosticsState={
    ...diagnosticsState,
    source:info.source||'',
    playbackUrl:info.playbackUrl||'',
    route:info.route||'',
    player:info.player||'',
    startupMs:Number(info.startupMs||0),
    error:info.error||'',
    fallback:Boolean(info.fallback),
  };
  els.diagSource.textContent=diagnosticsState.source||'-';
  els.diagRoute.textContent=diagnosticsState.route||'-';
  els.diagPlayer.textContent=diagnosticsState.player||'-';
  els.diagStartup.textContent=diagnosticsState.startupMs?`${diagnosticsState.startupMs} ms`:'-';
  publishDiagnostics();
  const source=sourceLabel(diagnosticsState.source);
  if(diagnosticsState.error)log(`FAIL ${diagnosticsState.route} · ${source} · ${diagnosticsState.error}`);
  else log(`${diagnosticsState.fallback?'FALLBACK':'OK'} ${diagnosticsState.player} via ${diagnosticsState.route} · ${source} · ${diagnosticsState.startupMs} ms`);
}
function setOfficialLive(channel){
  const key=normalizeId(channel?.id||channel?.originalId||channel?.name||'');
  const url=OFFICIAL_LIVE[key]||'';
  els.officialLive.hidden=!url;els.officialLive.href=url||'#';
  return url;
}

function renderGroups(){
  const previous=els.group.value||'all';
  const groups=[...new Set(channels.map(c=>c.group||'Other'))].sort((a,b)=>a.localeCompare(b));
  els.group.innerHTML='';
  const all=document.createElement('option');all.value='all';all.textContent='Όλες οι κατηγορίες';els.group.appendChild(all);
  for(const group of groups){
    const option=document.createElement('option');option.value=group;option.textContent=group;els.group.appendChild(option);
  }
  els.group.value=groups.includes(previous)?previous:'all';
}
function favoritesPresentationState(){
  const state=window.WebTVFavoritesPresentationAPI?.getState?.()||{};
  const favorites=new Set((Array.isArray(state.favorites)?state.favorites:[]).map(String));
  return {favorites,favoritesOnly:catalogMode==='cloud'&&Boolean(state.favoritesOnly)};
}
function filteredChannels(){
  const q=els.search.value.trim().toLowerCase(),group=els.group.value;
  const presentation=favoritesPresentationState();
  return channels
    .filter(channel=>(!q||`${channel.name} ${channel.originalId}`.toLowerCase().includes(q))&&(group==='all'||channel.group===group))
    .map((channel,index)=>({channel,index,fav:presentation.favorites.has(String(channel.id||''))}))
    .filter(entry=>!presentation.favoritesOnly||entry.fav)
    .sort((a,b)=>Number(b.fav)-Number(a.fav)||a.index-b.index)
    .map(entry=>entry.channel);
}
function statsText(channel){
  const stats=sources.getStats(channel);
  return {
    text:stats.cooling?`${stats.active}/${stats.total}`:`${stats.total}`,
    title:stats.pending?`${stats.pending} STRM source(s) resolve on first playback`:stats.cooling?`${stats.cooling} route(s) in cooldown`:'Playback routes'
  };
}
function syncActiveChannelRow(previousId=''){
  if(previousId){channelRows.get(String(previousId))?.classList.remove('active');}
  if(selected?.id){channelRows.get(String(selected.id))?.classList.add('active');}
}
function updateChannelRowStats(channel){
  const row=channelRows.get(String(channel?.id||''));
  const count=row?.querySelector('.source-count');
  if(!count)return;
  const stats=statsText(channel);
  count.textContent=stats.text;
  count.title=stats.title;
}
function renderChannels(){
  const visible=filteredChannels();
  const presentation=favoritesPresentationState();
  els.summary.textContent=`${visible.length} / ${channels.length} κανάλια`;
  channelRows.clear();
  const fragment=document.createDocumentFragment();
  for(const channel of visible){
    const button=document.createElement('button');
    button.type='button';
    const favorite=presentation.favorites.has(String(channel.id||''));
    button.className=`channel-item${selected?.id===channel.id?' active':''}${favorite?' favorite':''}`;
    button.title=favorite?'Favorite channel':'';
    button.setAttribute('role','listitem');
    button.dataset.channelId=String(channel.id||'');
    const logo=document.createElement('img');
    prepareLazyLogo(logo,channel.logo);
    logo.dataset.logoTrust=channel.logoMeta?.trust||'none';
    logo.dataset.logoSourceKind=channel.logoMeta?.sourceKind||'';
    const meta=document.createElement('div');
    const name=document.createElement('strong');name.textContent=channel.name;
    const group=document.createElement('span');group.textContent=channel.group||'Other';
    meta.append(name,group);
    const stats=statsText(channel);
    const count=document.createElement('span');count.className='source-count';
    count.textContent=stats.text;
    count.title=stats.title;
    button.append(logo,meta,count);
    button.addEventListener('click',()=>selectChannel(channel));
    channelRows.set(String(channel.id||''),button);
    fragment.appendChild(button);
  }
  els.list.replaceChildren(fragment);
}
function clearSelectedIfMissing(){
  if(!selected)return;
  const replacement=channels.find(c=>String(c.id)===String(selected.id))||null;
  if(replacement){
    if(replacement!==selected){
      selectionToken+=1;
      selected=replacement;
    }
    return;
  }
  selectionToken+=1;
  selected=null;
  els.channelName.textContent='Επίλεξε κανάλι';els.channelGroup.textContent='WEBTV';els.logo.hidden=true;
  els.officialLive.hidden=true;els.sourceHuntToggle.hidden=true;els.sourceHunt.hidden=true;player.stop?.();
}
function applyPlaylistText(text,{mode='replace',label='Playlist'}={}){
  const imported=parseM3U(text).map(channel=>{
    const profile=resolveChannelProfile(channel.id||channel.originalId||channel.name);
    const logoMeta=resolveChannelLogo({
      id:channel.id,
      tvgId:channel.originalId,
      name:channel.name,
      profile,
      providedLogo:safeLogo(channel.logo),
      providedSourceKind:'playlist-tvg-logo',
    });
    return {...channel,name:canonicalDefaultChannelName(channel),logo:logoMeta.url,logoMeta,sourceTrust:'temporary'};
  });
  if(!imported.length)throw new Error('No #EXTINF channels found');
  channels=mode==='merge'?dedupeChannels([...channels,...imported]):dedupeChannels(imported);
  catalogMode='temporary';
  clearSelectedIfMissing();renderGroups();renderChannels();
  emitChannelSelection('catalog-import');
  refreshEpgForCatalog({force:true});
  log(`Playlist applied · ${label} · ${mode} · ${imported.length} imported · ${channels.length} total`);
  return{imported:imported.length,total:channels.length};
}

function mapRegistryChannel(c){
  const id=normalizeId(c.id||c.tvgId||c.name);
  const profile=resolveChannelProfile(id||c.tvgId||c.name);
  const fallbackLogo=safeLogo(c.logo||'');
  const logoMeta=resolveChannelLogo({
    id,
    tvgId:c.tvgId||c.id||'',
    name:c.name,
    profile,
    providedLogo:fallbackLogo,
    providedSourceKind:String(c.logoSourceKind||'').trim()||'registry-channel',
    providedSourceUrl:String(c.logoSourceUrl||'').trim(),
  });
  const sourceRows=(c.sources||[]).map((source,index)=>({url:String(source?.url||'').trim(),origin:String(source?.origin||'curated').trim()||'curated',priority:Number.isFinite(Number(source?.priority))?Number(source.priority):100+index})).filter(source=>source.url);
  return {
    id,
    originalId: c.tvgId||c.id||c.name,
    name: c.name,
    logo: logoMeta.url,
    logoMeta,
    group: profile?.category?.primary||c.groupName||'Other',
    directUrls: [...new Set(sourceRows.map(source=>source.url))],
    sourceRows,
    position: Number(c.position)||0,
    sourceTrust: 'curated'
  };
}
function loadStartupMyPlaylistCache(){
  try{
    const parsed=JSON.parse(localStorage.getItem(MY_PLAYLIST_STARTUP_CACHE_KEY)||'null');
    if(!parsed||!Array.isArray(parsed.channels))return[];
    const savedAt=Number(parsed.savedAt||0);
    if(!savedAt||Date.now()-savedAt>MY_PLAYLIST_STARTUP_CACHE_MAX_AGE_MS){
      localStorage.removeItem(MY_PLAYLIST_STARTUP_CACHE_KEY);
      return[];
    }
    return parsed.channels
      .filter(row=>row&&typeof row==='object'&&row.id&&row.name)
      .map(row=>({...row,directUrls:[...(row.directUrls||[])],sourceRows:Array.isArray(row.sourceRows)?row.sourceRows.map(source=>({...source})):[]}));
  }catch{return[];}
}
function saveStartupMyPlaylistCache(rows){
  try{
    const channels=(Array.isArray(rows)?rows:[])
      .filter(row=>row&&typeof row==='object'&&row.id&&row.name)
      .map(row=>({...row,directUrls:[...(row.directUrls||[])],sourceRows:Array.isArray(row.sourceRows)?row.sourceRows.map(source=>({...source})):[]}));
    localStorage.setItem(MY_PLAYLIST_STARTUP_CACHE_KEY,JSON.stringify({savedAt:Date.now(),channels}));
  }catch{}
}
function applyCachedStartupPlaylist(rows){
  if(!Array.isArray(rows)||!rows.length)return false;
  channels=rows.map(row=>({...row,directUrls:[...(row.directUrls||[])],sourceRows:Array.isArray(row.sourceRows)?row.sourceRows.map(source=>({...source})):[]}));
  catalogMode='cloud';
  clearSelectedIfMissing();
  renderGroups();
  renderChannels();
  log(`Startup cache painted · ${channels.length} channels`);
  return true;
}

async function fetchCloudMyPlaylist(){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(`${registryUrl()}/api/my-playlist`,{cache:'no-store',signal:controller.signal});
    let json={};try{json=await response.json();}catch{}
    if(!response.ok)throw new Error(json.error||`Registry HTTP ${response.status}`);
    return (json.channels||[]).map(mapRegistryChannel);
  }finally{clearTimeout(timer);}
}
async function loadCloudMyPlaylist({reason='manual',preserveSelection=true}={}){
  const oldSelectedId=preserveSelection?selected?.id:null;
  const remote=await fetchCloudMyPlaylist();
  saveStartupMyPlaylistCache(remote);
  channels=remote;
  catalogMode='cloud';
  if(oldSelectedId){
    selected=channels.find(c=>String(c.id)===String(oldSelectedId))||null;
  }else if(selected){
    selected=null;
  }
  clearSelectedIfMissing();
  renderGroups();renderChannels();
  if(selected){
    renderSourceHunt(selected);
    els.channelName.textContent=selected.name;
    els.channelGroup.textContent=selected.group||'WEBTV';
    applyImmediateLogo(els.logo,selected.logo);
    setOfficialLive(selected);
  }
  emitChannelSelection(`catalog-cloud:${reason}`);
  if(reason!=='startup')refreshEpgForCatalog({force:true});
  log(`D1 MY PLAYLIST LOADED · ${channels.length} channels · ${reason}`);
  return {total:channels.length,channels:[...channels]};
}

function selectedChannelSnapshot(){
  return selected
    ? (catalogMode==='temporary'
      ? promoteImportedChannel(selected)
      : {...selected,directUrls:[...(selected.directUrls||[])]})
    : null;
}
function emitChannelSelection(reason='selection'){
  window.dispatchEvent(new CustomEvent('webtv:channel-selected',{
    detail:{reason,catalogMode,channel:selectedChannelSnapshot()}
  }));
}

function applyLogoCandidate({channelId,url,sourceKind='curated-third-party',sourceUrl='',provider=''}={}){
  const key=String(channelId||'').trim();
  if(!key)return{applied:false,reason:'channel-id-required'};
  const normalizedKey=normalizeId(key);
  const channel=channels.find(item=>
    String(item.id||'')===key||
    String(item.originalId||'')===key||
    normalizeId(item.id||item.originalId||item.name||'')===normalizedKey
  )||null;
  if(!channel)return{applied:false,reason:'channel-not-found'};
  if(channel.logoMeta?.trust==='verified'&&sourceKind!=='registry-verified'){
    return{applied:false,reason:'verified-logo-kept',channelId:channel.id,url:channel.logo,logoMeta:channel.logoMeta};
  }
  const candidate=safeLogo(url);
  if(!candidate)return{applied:false,reason:'invalid-logo'};
  const profile=resolveChannelProfile(channel.id||channel.originalId||channel.name);
  const logoMeta=resolveChannelLogo({
    id:channel.id,
    tvgId:channel.originalId,
    name:channel.name,
    profile,
    providedLogo:candidate,
    providedSourceKind:sourceKind,
    providedSourceUrl:sourceUrl,
  });
  channel.logo=logoMeta.url;
  channel.logoMeta={...logoMeta,provider:String(provider||'')};
  renderChannels();
  if(selected&&String(selected.id)===String(channel.id)){
    selected=channel;
    applyImmediateLogo(els.logo,channel.logo);
    els.logo.dataset.logoTrust=channel.logoMeta?.trust||'none';
    els.logo.dataset.logoSourceKind=channel.logoMeta?.sourceKind||'';
  }
  window.dispatchEvent(new CustomEvent('webtv:channel-logo-updated',{detail:{channelId:channel.id,logo:channel.logo,logoMeta:channel.logoMeta}}));
  return{applied:channel.logo===candidate,reason:channel.logo===candidate?'applied':'higher-trust-logo-kept',channelId:channel.id,url:channel.logo,logoMeta:channel.logoMeta};
}

window.WebTVPlaylistAPI={
  ready:false,
  applyText:applyPlaylistText,
  reloadCloudMyPlaylist:loadCloudMyPlaylist,
  getCount:()=>channels.length,
  getCatalogMode:()=>catalogMode,
  getChannelById:id=>channels.find(channel=>String(channel.id)===String(id))||null,
  getSelectedChannel:selectedChannelSnapshot,
  getChannels:()=>channels.map(c=>({...c,directUrls:[...(c.directUrls||[])]})),
  applyLogoCandidate
};

window.WebTVEPGAPI={
  refreshForChannels:(rows=channels,{force=false}={})=>epg.refresh({force,channels:Array.isArray(rows)?rows:channels}),
  refreshGuideForChannels:(rows=channels,{force=false,from=null,to=null}={})=>epg.refreshGuide({force,from,to,channels:Array.isArray(rows)?rows:channels}),
  getSchedule:(channel,options={})=>epg.getSchedule(channel,options),
  getNow:(channel,now=new Date())=>epg.get(channel,now),
  getChannels:()=>channels.map(channel=>({...channel,directUrls:[...(channel.directUrls||[])]})),
};

function recordSelfHeal(type,channel,detail={}){
  const event={at:new Date().toISOString(),type:String(type||'event'),channelId:String(channel?.id||channel?.originalId||channel?.name||''),channelName:String(channel?.name||''),detail:detail&&typeof detail==='object'?detail:{message:String(detail||'')}};
  selfHealHistory.push(event);if(selfHealHistory.length>120)selfHealHistory.splice(0,selfHealHistory.length-120);
  const summary=[event.type,event.channelName,event.detail?.provider,event.detail?.familyIds?.length?`families=${event.detail.familyIds.join(',')}`:'',event.detail?.message].filter(Boolean).join(' · ');
  log(`SELF HEAL · ${summary}`);
  window.dispatchEvent(new CustomEvent('webtv:source-self-heal-report',{detail:event}));
  return event;
}
function selfHealDiscovery(provider=''){
  if(provider==='curated-remote-feeds')return discoverCuratedRemoteFeeds;
  if(provider==='github-public-playlists')return discoverGithubPublicPlaylists;
  if(provider==='strm-specific-discovery')return discoverStrmSpecific;
  return null;
}
function combinedRefreshRefs(channel={}){
  const rows=refreshReferencesForSourceRows(channel?.sourceRows||[]);
  if(!rows.length)return[{provider:'curated-remote-feeds',familyIds:[],urls:[...(channel?.directUrls||[])]}];
  const by=new Map();
  for(const row of rows){
    const key=`${row.provider}|${(row.familyIds||[]).slice().sort().join(',')}`;
    if(!by.has(key))by.set(key,{provider:row.provider,familyIds:[...(row.familyIds||[])],urls:[]});
    if(row.url)by.get(key).urls.push(row.url);
  }
  return [...by.values()].map(ref=>({...ref,urls:[...new Set(ref.urls)]}));
}
async function attemptMyPlaylistSelfHeal(channel,{selectionTokenAtStart}={}){
  if(catalogMode!=='cloud')return null;
  const playlistApi=window.WebTVMyPlaylistAPI;
  if(typeof playlistApi?.autoRefreshVerifiedSource!=='function')return null;
  const existingRows=Array.isArray(channel?.sourceRows)?channel.sourceRows:[];
  if(!((channel?.directUrls||[]).length||existingRows.length))return null;

  setPlaybackState('loading','Refreshing source');
  const refs=combinedRefreshRefs(channel);
  const result=await runSourceSelfHeal({
    channel,
    refs,
    failedSavedUrls:[...(channel?.directUrls||[])],
    discoverProvider:provider=>{
      const discover=selfHealDiscovery(provider);
      if(!discover)return null;
      return (target,ref)=>discover(target,{freshness:'24h',sourceFamilyIds:provider==='curated-remote-feeds'?ref.familyIds:[]});
    },
    verifyCandidates:candidates=>verifySearchCandidates(candidates,{concurrency:2}),
    playCandidate:(_candidate,playbackRef)=>testCandidate(playbackRef,{channel}),
    persistCandidate:(candidate,playbackRef,ref)=>playlistApi.autoRefreshVerifiedSource(channel,{
      url:playbackRef,
      provider:candidate.discoveryProvider||ref.provider,
      discoveryProvider:candidate.discoveryProvider||ref.provider,
      sourceFamilyId:candidate.sourceFamilyId||'',
      sourceObservations:Array.isArray(candidate.sourceObservations)?candidate.sourceObservations:[],
      browserPlayable:candidate.browserPlayable===true,
      drmDetected:Boolean(candidate.drmDetected),
    },{
      reason:'playback-self-heal',
      verified:true,
      streamKind:String(candidate.streamKind||'unknown').toLowerCase(),
      playbackConfirmed:true,
      failedUrls:ref.urls?.length?ref.urls:[...(channel?.directUrls||[])],
    }),
    onEvent:(type,detail)=>recordSelfHeal(type,channel,detail),
    isCurrent:()=>selectionTokenAtStart===selectionToken&&selected===channel,
    maxVerifyCandidates:12,
  });
  return result?.ok?result.playbackResult:null;
}

async function selectChannel(channel){
  const token=++selectionToken;
  const previousId=selected?.id||'';
  selected=channel;
  syncActiveChannelRow(previousId);
  renderSourceHunt(channel);
  els.channelName.textContent=channel.name;els.channelGroup.textContent=channel.group||'WEBTV';
  applyImmediateLogo(els.logo,channel.logo);
  clearDiagnostics();const officialUrl=setOfficialLive(channel);renderEpg();
  emitChannelSelection('user-select');
  const before=sources.getStats(channel);
  setPlaybackState('loading',before.pending?'Resolving source':'Connecting');
  try{
    const routes=await sources.getSources(channel);
    if(token!==selectionToken || selected!==channel)return null;
    const routePlan = routes.map((route,index) => {
      const entry = health.get(route.playbackUrl);
      return {
        rank:index+1,
        source:route.originalUrl,
        route:route.route,
        origin:route.saved?'D1/saved':'TV-cache/remote',
        score:Number(health.score(route.playbackUrl).toFixed(2)),
        attempts:Number(entry?.success||0)+Number(entry?.fail||0),
        success:Number(entry?.success||0),
        fail:Number(entry?.fail||0),
        cooling:health.isCoolingDown(route.playbackUrl),
      };
    });
    window.WebTVDiagnosticsAPI.lastRoutePlan=routePlan;
    log(`PLAYBACK PLAN · ${channel.name} · ${routePlan.map(r=>`#${r.rank} ${r.route} ${r.origin} score=${r.score} ${sourceLabel(r.source)}`).join(' | ')}`);
    const stats=sources.getStats(channel);
    log(`${channel.name}: ${stats.active}/${stats.total} active routes${stats.cooling?`, ${stats.cooling} cooling`:''}`);
    let result;
    if(catalogMode!=='cloud'){
      result=await player.play(channel,routes);
    }else{
      try{
        result=await player.play(channel,routes,{allowOfficialFallback:false});
      }catch(primaryError){
        if(token!==selectionToken||selected!==channel)return null;
        recordSelfHeal('primary.failed',channel,{message:primaryError?.message||String(primaryError)});
        const healed=await attemptMyPlaylistSelfHeal(channel,{selectionTokenAtStart:token});
        if(healed)result=healed;
        else{
          recordSelfHeal('official-fallback.started',channel,{message:'Self-heal exhausted; delegating to canonical Player fallback'});
          result=await player.play(channel,[],{allowOfficialFallback:true});
        }
      }
    }
    const postPlan = routes.map((route,index) => ({
      rank:index+1,
      route:route.route,
      source:route.originalUrl,
      score:Number(health.score(route.playbackUrl).toFixed(2)),
      attempts:(health.get(route.playbackUrl)?.success||0)+(health.get(route.playbackUrl)?.fail||0),
    }));
    log(`HEALTH AFTER PLAY · ${postPlan.map(r=>`#${r.rank} ${r.route} score=${r.score} tries=${r.attempts} ${sourceLabel(r.source)}`).join(' | ')}`);
    if(DEBUG_STORAGE){
      const hd=health.diagnostics();
      log(`HEALTH PERSIST · memory=${hd.memoryEntries} · primary=${hd.primaryEntries} (${hd.primaryBytes}B) · backup=${hd.backupEntries} (${hd.backupBytes}B)`);
    }
    return result;
  }
  catch(error){
    if(token!==selectionToken || selected!==channel)return null;
    log(`${channel.name}: ${error.message}`);if(officialUrl)setPlaybackState('error','Official fallback unavailable');
    throw error;
  }
  finally{if(token===selectionToken && selected===channel)updateChannelRowStats(channel);}
}

function buildCandidateRoutes(raw){
  const parsed=parseIptvUrl(raw);
  const url=parsed.url;
  if(!/^https?:\/\//i.test(url))throw new Error('Valid http/https URL required');
  const routes=[];
  if(/^https:\/\//i.test(url))routes.push({originalUrl:url,playbackUrl:url,route:'candidate-direct',requestHeaders:{},saved:false});
  if(isHls(url)&&CONFIG.workerForHls){
    const hasHeaders=Object.keys(parsed.headers).length>0;
    routes.push({
      originalUrl:url,
      playbackUrl:workerUrl(url,parsed.headers),
      route:hasHeaders?'candidate-worker+headers':'candidate-worker',
      requestHeaders:parsed.headers,
      saved:false
    });
  }
  if(!routes.length)throw new Error(`Unsupported or insecure non-HLS URL · ${sourceLabel(url)}`);
  return {url,routes};
}

async function testCandidate(raw,{channel=selected}={}){
  if(!channel)throw new Error('Select a channel first');
  const parsed=parseIptvUrl(raw);
  if(isStrmReference(parsed.url)){
    const resolved=await candidateStrmResolver.resolve(parsed.url);
    const info=candidateStrmResolver.peekInfo(parsed.url);
    if(info?.drm)throw new Error('STRM requires DRM license');
    if(!resolved)throw new Error('STRM could not resolve to media URL');
    log(`Candidate STRM resolved · ${sourceLabel(parsed.url)} → ${sourceLabel(resolved)}`);
    const options=new URLSearchParams(parsed.headers);
    raw=resolved+(options.size?`|${options}`:'');
  }
  const {url,routes}=buildCandidateRoutes(raw);
  clearDiagnostics();
  log(`Candidate test for ${channel.name} · ${sourceLabel(url)} · ${routes.length} route(s)`);
  try{
    const result=await player.play({...channel,name:`${channel.name} candidate`},routes,{allowOfficialFallback:false});
    if(!result || result.fallback)throw new Error('Candidate did not produce verified stream playback');
    return result;
  }catch(error){
    log(`Candidate failed · ${sourceLabel(url)} · ${error.message}`);
    throw error;
  }
}

async function testCandidateUrl(){
  if(!selected)return;
  const raw=els.candidateUrl.value.trim();
  try{await testCandidate(raw,{channel:selected});}
  catch(error){log(`Manual candidate test failed · ${error.message}`);}
}

window.WebTVPlaybackAPI={
  testCandidate,
  playChannelById:id=>{
    const channel=channels.find(item=>String(item.id)===String(id));
    return channel?selectChannel(channel):Promise.reject(new Error('Channel not found'));
  },
  replaySelected:()=>selected?selectChannel(selected):Promise.resolve(null),
  stop:()=>player.stop(),
};

function renderEpg(){
  if(!selected)return;
  const{current,next}=epg.get(selected);
  if(!current){
    els.programTitle.textContent='Δεν υπάρχουν τρέχοντα δεδομένα EPG';els.programDescription.textContent='';els.programTime.textContent='';els.progress.hidden=true;
  }else{
    els.programTitle.textContent=current.title;els.programDescription.textContent=current.description||'';els.programTime.textContent=current.timeLabel;
    els.progress.hidden=false;els.progressBar.style.width=`${current.progress}%`;
  }
  els.next.innerHTML='';
  for(const item of next){
    const card=document.createElement('div');card.className='next-card';
    const time=document.createElement('time');time.textContent=`${formatTime(item.start)} – ${formatTime(item.stop)}`;
    const title=document.createElement('strong');title.textContent=item.title;card.append(time,title);els.next.appendChild(card);
  }
}
function startClock(){const tick=()=>{els.clock.textContent=new Date().toLocaleString('de-DE');};tick();setInterval(tick,1000);}

async function loadStartupCloudPlaylist(){
  let lastError=null;
  for(let attempt=1;attempt<=2;attempt++){
    try{
      return await loadCloudMyPlaylist({reason:attempt===1?'startup':`startup-retry-${attempt}`,preserveSelection:false});
    }catch(error){
      lastError=error;
      log(`Startup My Playlist read failed · attempt ${attempt}/2 · ${error.message}`);
      if(channels.length){
        log(`Cached My Playlist remains visible while live D1 retry is pending · ${channels.length} channels`);
      }
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,700));
    }
  }
  throw lastError||new Error('My Playlist unavailable');
}

async function boot(){
  const startedAt=performance.now();
  startClock();setPlaybackState('idle','Idle');clearDiagnostics();
  els.officialLive.hidden=true;els.sourceHuntToggle.hidden=true;els.sourceHunt.hidden=true;
  const cachedPlaylist=loadStartupMyPlaylistCache();
  applyCachedStartupPlaylist(cachedPlaylist);
  // D1 health is optional for the public landing view. A slow session check must
  // never delay the primary playlist, EPG, or source catalog.
  health.loadCloud().then(cloudHealth=>{
    log(`${cloudHealth?'Health loaded from D1':'Health cloud unavailable · unlock the D1 session to synchronize'} · ${Math.round(performance.now()-startedAt)} ms`);
    if(cloudHealth&&window.WebTVPlaylistAPI?.ready)renderChannels();
  }).catch(error=>log(`Health cloud unavailable · ${error.message}`));

  sources.refresh()
    .then(()=>{
      log(`Source registry loaded · build ${SOURCE_REGISTRY_BUILD_ID||'dev'} · ${Math.round(performance.now()-startedAt)} ms`);
      if(window.WebTVPlaylistAPI?.ready)renderChannels();
    })
    .catch(error=>log(`Source registry unavailable: ${error.message}`));
  await loadStartupCloudPlaylist();
  log(`Startup playlist ready · ${channels.length} channels · ${Math.round(performance.now()-startedAt)} ms`);
  const epgTask=epg.refresh({channels})
    .then(()=>{log(`EPG loaded for ${channels.length} sidebar channels · ${Math.round(performance.now()-startedAt)} ms`);renderEpg();})
    .catch(error=>log(`EPG unavailable: ${error.message}`));
  if(DEBUG_STORAGE){
    const hd=health.diagnostics();
    log(`HEALTH STORE · memory=${hd.memoryEntries} · primary=${hd.primaryEntries} (${hd.primaryBytes}B) · backup=${hd.backupEntries} (${hd.backupBytes}B) · key ${hd.storageKey}`);
    const probe=storageProbe();
    if(probe)log(`STORAGE PROBE · origin=${probe.origin} · previous=${probe.previous||'∅'} · wrote=${probe.next} · read=${probe.readBack||'∅'} · ${probe.writeOk?'OK':'FAIL'}${probe.error?` · ${probe.error}`:''}`);
  }

  window.WebTVPlaylistAPI.ready=true;
  log(`Startup interactive · ${Math.round(performance.now()-startedAt)} ms`);
  window.dispatchEvent(new CustomEvent('webtv:ready'));
  await epgTask;
  setInterval(renderEpg,30000);
  setInterval(()=>epg.refresh({channels}).then(renderEpg).catch(error=>log(`EPG refresh failed: ${error.message}`)),CONFIG.epgRefreshMs);
}

els.search.addEventListener('input',renderChannels);
els.group.addEventListener('change',renderChannels);
window.addEventListener('webtv:favorites-presentation-changed',renderChannels);
els.diagToggle.addEventListener('click',()=>{els.diagnostics.hidden=!els.diagnostics.hidden;});
$('diagnostics-close')?.addEventListener('click',()=>{els.diagnostics.hidden=true;els.diagToggle.setAttribute('aria-expanded','false');});
els.sourceHuntToggle.addEventListener('click',()=>{if(selected){renderSourceHunt(selected);els.sourceHunt.hidden=!els.sourceHunt.hidden;}});
$('source-hunt-close')?.addEventListener('click',()=>{els.sourceHunt.hidden=true;els.sourceHuntToggle.setAttribute('aria-expanded','false');});
document.addEventListener('pointerdown',event=>{
  if(els.sourceHunt.hidden)return;
  if(els.sourceHunt.contains(event.target)||els.sourceHuntToggle.contains(event.target))return;
  els.sourceHunt.hidden=true;
});
els.clearHealth.addEventListener('click',async()=>{try{if(!await window.WebTVRegistryAuth?.ensureSession({interactive:true}))return;health.clear();await health.cloudQueue;log('Health data cleared in D1');renderChannels();}catch(error){log(`D1 health reset failed · ${error.message}`);}});
els.testCandidate.addEventListener('click',testCandidateUrl);
els.candidateUrl.addEventListener('keydown',event=>{if(event.key==='Enter')testCandidateUrl();});

boot().catch(error=>{
  setPlaybackState('error','Boot failed');
  log(`BOOT ERROR: ${error.message}`);
  console.error(error);
});
window.addEventListener('webtv:registry-authenticated',()=>health.loadCloud().then(ok=>log(ok?'Health synchronized with D1':'Health D1 synchronization failed')));

console.info(`[WebTV] Main loaded · build ${BUILD_ID} · clean playback API · fast channel switching · STRM resolution · shared health scoring · D1 My Playlist is primary`);
