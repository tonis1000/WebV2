import { runUnifiedSearch } from './search-orchestrator.js';
import { listUnifiedSearchLanes, getUnifiedSearchRuntimeAdapter } from './search-runtime.js';
import { verifySearchCandidates } from './search-verification.js';
import { UnifiedNowPlayingState } from './now-playing-state.js';
import { safePublicActionUrl } from './public-url-policy.js';
import { buildSearchContext } from './search-group-catalog.js';
import { groupCandidatesByChannel } from './result-grouper.js';
import { candidateForDisplay, normalizeChannelName } from '../discovery/candidate-model.js';

const BUILD_ID='20261005-floating-tool-windows-a';
const $=id=>document.getElementById(id);
const nowPlayingState=new UnifiedNowPlayingState();
const playbackConfirmedCandidates=new Set();
const savedCandidateIds=new Set();
let activeRun=null;
let latestUpdate=null;
let latestIntent=null;
let installed=false;

function ensureStylesheet(){
  if(document.querySelector('link[data-unified-search-style]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./unified-search.css?v=20261002-search-status';
  link.dataset.unifiedSearchStyle='1';
  document.head.appendChild(link);
}

function sidebarNowPlayingName(){try{return String(window.WebTVPlaylistAPI?.getSelectedChannel?.()?.name||'').trim()||'—';}catch{return '—';}}
function displayNowPlayingName(){return nowPlayingState.value(sidebarNowPlayingName());}
function playlistChannels(){try{return window.WebTVPlaylistAPI?.getChannels?.()||[];}catch{return[];}}
function searchContext(){return buildSearchContext(playlistChannels());}
function syncSearchQueryToSidebarSelection(){
  const query=$('unified-search-query');if(!query)return;
  let selectedChannel=null;try{selectedChannel=window.WebTVPlaylistAPI?.getSelectedChannel?.()||null;}catch{}
  const selectedName=String(selectedChannel?.name||'').trim();if(selectedName)query.value=selectedName;
}

function createUi(){
  if($('unified-search-panel'))return $('unified-search-panel');
  const playerCard=document.querySelector('.player-card');
  if(!playerCard?.parentElement)return null;
  const panel=document.createElement('section');
  panel.id='unified-search-panel';
  panel.className='unified-search-panel panel';
  panel.hidden=true;
  panel.setAttribute('aria-label','Unified source search');
  panel.innerHTML=`
    <div class="unified-search-head">
      <div class="unified-search-head-copy"><p class="eyebrow">SEARCH</p><h2>Find channels & sources</h2><p class="muted small">Search one channel, a group such as ERT / Nova / Cosmote, or any free text. Search never changes the player by itself.</p></div>
      <div class="unified-search-head-actions"><div class="unified-search-now"><span>Now Playing</span><strong id="unified-search-now-playing">${escapeHtml(displayNowPlayingName())}</strong></div><button id="unified-search-close" class="button ghost" type="button">Close</button></div>
    </div>
    <form id="unified-search-form" class="unified-search-form">
      <input id="unified-search-query" type="search" autocomplete="off" placeholder="ERT1, ERT, Nova, Cosmote Sport…" aria-label="Search channels or groups">
      <button id="unified-search-submit" class="button" type="submit">Search</button>
      <button id="unified-search-cancel" class="button ghost unified-search-cancel" type="button" hidden>Cancel</button>
    </form>
    <div id="unified-search-status-banner" class="unified-search-status-banner" data-status="idle" aria-live="polite" aria-atomic="true">
      <span class="unified-search-spinner" aria-hidden="true"></span>
      <strong id="unified-search-status-title">Ready</strong>
      <span id="unified-search-status-detail">Start a search when you are ready.</span>
    </div>
    <div id="unified-search-progress" class="unified-search-progress" aria-live="polite"><span class="unified-search-chip">Ready</span></div>
    <div id="unified-search-results" class="unified-search-grid"><div class="unified-search-empty">Search for a channel or group. The current stream keeps playing while sources are checked.</div></div>
    <details id="unified-search-report" class="unified-report">
      <summary><span class="unified-report-headline">Search Report <span id="unified-search-report-badge" class="unified-report-badge">no run</span></span></summary>
      <div class="unified-report-body">
        <div id="unified-search-report-summary" class="unified-report-summary"></div>
        <div class="unified-report-toolbar">
          <select id="unified-search-report-source" aria-label="Report source filter"><option value="">All sources</option></select>
          <button id="unified-search-report-copy" class="button ghost" type="button">Copy report</button>
          <button id="unified-search-report-json" class="button ghost" type="button">Export JSON</button>
        </div>
        <div id="unified-search-report-timeline" class="unified-report-timeline"></div>
      </div>
    </details>`;
  playerCard.insertAdjacentElement('afterend',panel);
  return panel;
}

function ensureSearchToggle(){
  let toggle=$('unified-search-toggle');
  if(toggle)return toggle;
  const actions=document.querySelector('.topbar-actions');
  if(!actions)return null;
  toggle=document.createElement('button');
  toggle.id='unified-search-toggle';
  toggle.type='button';
  toggle.className='button search-tools';
  toggle.textContent='Find channels & sources';
  toggle.setAttribute('aria-controls','unified-search-panel');
  toggle.setAttribute('aria-expanded','false');
  const before=$('source-hunt-toggle')||$('diagnostics-toggle');
  actions.insertBefore(toggle,before?.parentNode===actions?before:null);
  toggle.addEventListener('click',()=>{
    const panel=$('unified-search-panel');if(!panel)return;
    const opening=panel.hidden;
    panel.hidden=!opening;
    toggle.setAttribute('aria-expanded',String(opening));
    if(opening)setTimeout(()=>$('unified-search-query')?.focus(),0);
  });
  window.addEventListener('webtv:admin-visibility',event=>{
    if(event.detail?.unlocked)return;
    const panel=$('unified-search-panel');if(panel)panel.hidden=true;
    toggle.setAttribute('aria-expanded','false');
  });
  return toggle;
}

function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function formatSource(value=''){
  const safe=safePublicActionUrl(value);
  try{
    const url=new URL(safe||String(value||''));
    return safe?`${url.hostname}${url.pathname}`:`${url.hostname}/[protected URL]`;
  }catch{return safe?'source':'[protected URL]';}
}
function headersForPlayback(headers={}){const params=new URLSearchParams();for(const [key,value] of Object.entries(headers||{}))if(value)params.set(key,value);return params.toString();}
function playbackValue(candidate={}){const suffix=headersForPlayback(candidate.requiredHeaders);return `${candidate.sourceUrl||''}${suffix?`|${suffix}`:''}`;}
function playableCandidate(candidate={}){return candidate.browserPlayable===true&&/^https?:\/\//i.test(String(candidate.sourceUrl||''));}
function normalizedSelectedChannelKeys(){
  let selected=null;try{selected=window.WebTVPlaylistAPI?.getSelectedChannel?.()||null;}catch{}
  return new Set([selected?.id,selected?.originalId,selected?.name].map(value=>normalizeChannelName(value||'')).filter(Boolean));
}
function candidateMatchesSelectedChannel(candidate={},channelName=''){
  const selected=normalizedSelectedChannelKeys();if(!selected.size)return false;
  const candidateKeys=[candidate.normalizedChannelName,candidate.channelName,channelName].map(value=>normalizeChannelName(value||'')).filter(Boolean);
  return candidateKeys.some(key=>selected.has(key));
}
function genericSaveBlocked(candidate={}){
  return Boolean(candidate.xtreamContext)||String(candidate.sourceType||'').toLowerCase()==='xtream'||String(candidate.discoveryProvider||'').toLowerCase().includes('authorized-xtream');
}
function saveCandidateState(candidate={},channelName=''){
  if(savedCandidateIds.has(candidate.candidateId))return{enabled:false,label:'Saved ✓',title:'This source is already saved in this search session'};
  if(genericSaveBlocked(candidate))return{enabled:false,label:'Save via Xtream Preview',title:'Authorized Xtream sources must use Xtream Preview → Verify → Save Channel…'};
  if(String(candidate.verificationStatus||'').toUpperCase()!=='VERIFIED')return{enabled:false,label:'Save source',title:'Wait for this source to reach VERIFIED_MEDIA first'};
  if(!playbackConfirmedCandidates.has(candidate.candidateId))return{enabled:false,label:'Save source',title:'Play this source successfully before saving it'};
  if(!candidateMatchesSelectedChannel(candidate,channelName))return{enabled:false,label:'Save source',title:`Select ${channelName||candidate.channelName||'this channel'} in the sidebar before saving`};
  return{enabled:true,label:'Save source',title:'Save this playback-confirmed source to the selected My Playlist channel'};
}

function renderProgress(snapshot={},summary={}){
  const root=$('unified-search-progress');if(!root)return;
  root.replaceChildren();
  const add=(text,tone='')=>{const chip=document.createElement('span');chip.className='unified-search-chip';if(tone)chip.dataset.tone=tone;chip.textContent=text;root.appendChild(chip);};
  const status=String(snapshot.status||'idle');
  const lanes=Object.values(snapshot.lanes||{});const done=lanes.filter(item=>item.status==='done').length;
  const candidateCount=snapshot.candidates?.length||0;
  const banner=$('unified-search-status-banner'),title=$('unified-search-status-title'),detail=$('unified-search-status-detail'),submit=$('unified-search-submit');
  const running=status==='running';
  if(submit){submit.disabled=running;submit.textContent=running?'Searching…':'Search';}
  if(banner)banner.dataset.status=status;
  if(title)title.textContent=running?'Searching…':status==='completed'?'Finished':status==='cancelled'?'Search cancelled':'Ready';
  if(detail){
    if(running)detail.textContent=lanes.length?`Checking sources · Lanes: ${done}/${lanes.length} · ${candidateCount} found so far`:'Preparing discovery lanes…';
    else if(status==='completed')detail.textContent=`${candidateCount} source${candidateCount===1?'':'s'} found · Lanes: ${done}/${lanes.length||0}${summary.failed?` · ${summary.failed} error${summary.failed===1?'':'s'}`:''}${summary.timeouts?` · ${summary.timeouts} timeout${summary.timeouts===1?'':'s'}`:''}`;
    else if(status==='cancelled')detail.textContent='The search stopped before all lanes finished.';
    else detail.textContent='Start a search when you are ready.';
  }
  add(running?'Searching…':status==='completed'?'Finished':status==='cancelled'?'Search cancelled':'Ready',status==='completed'?'ok':status==='cancelled'?'warn':'');
  if(snapshot.intent?.type)add(`Intent: ${snapshot.intent.type}`);
  add(`Candidates: ${candidateCount}`,candidateCount>0?'ok':'');
  if(snapshot.leads?.length)add(`Leads: ${snapshot.leads.length}`,'warn');
  if(summary.timeouts)add(`Timeouts: ${summary.timeouts}`,'warn');
  if(summary.failed)add(`Errors: ${summary.failed}`,'error');
  if(lanes.length)add(`Lanes: ${done}/${lanes.length}`);
}

function sourceLinks(candidate={}){
  const sources=Array.isArray(candidate.provenanceSources)&&candidate.provenanceSources.length?candidate.provenanceSources:[{label:candidate.sourceOriginLabel||candidate.sourceOrigin,url:candidate.sourceOriginUrl,provider:candidate.discoveryProvider}];
  const wrap=document.createElement('div');wrap.className='unified-provenance';
  for(const item of sources){
    const safe=safePublicActionUrl(item?.url||'');
    if(!safe)continue;
    const link=document.createElement('a');link.className='unified-source-link';link.href=safe;link.target='_blank';link.rel='noopener noreferrer';link.textContent=`Open source ↗${item.label?` · ${item.label}`:''}`;wrap.appendChild(link);
  }
  return wrap;
}

function candidateReportEvents(candidateId=''){
  try{return activeRun?.reporter?.filterByCandidate?.(candidateId)||[];}catch{return[];}
}

function candidateRow(raw,channelName){
  const candidate=candidateForDisplay(raw);const row=document.createElement('div');row.className='unified-candidate-row';
  const main=document.createElement('div');main.className='unified-candidate-main';
  const title=document.createElement('div');title.className='unified-candidate-title';
  const source=document.createElement('span');source.textContent=candidate.sourceOriginLabel||candidate.sourceOrigin||candidate.discoveryProvider||'Source';
  const capability=document.createElement('span');capability.className=candidate.browserPlayable?'unified-playable':'unified-unplayable';capability.textContent=candidate.browserPlayable?'Playable':'Not browser-playable';
  title.append(source,capability);
  const meta=document.createElement('div');meta.className='unified-candidate-meta';
  for(const text of [`${candidate.inputFormatId||candidate.sourceType||'unknown'} → ${candidate.resolvedMediaFormatId||'unknown'}`,`Verifier: ${candidate.verificationStatus||'UNVERIFIED'}`,`Via: ${candidate.discoveryProvider||'unknown'}`]){const span=document.createElement('span');span.textContent=text;meta.appendChild(span);}
  const url=document.createElement('code');url.className='unified-candidate-url';url.textContent=formatSource(raw.sourceUrl);
  const details=document.createElement('details');details.className='unified-details';
  const detailSummary=document.createElement('summary');detailSummary.textContent='Details';
  const grid=document.createElement('div');grid.className='unified-detail-grid';
  const facts=[['Input format',candidate.inputFormatId||candidate.sourceType||'unknown'],['Resolved media',candidate.resolvedMediaFormatId||'unknown'],['Browser playback',candidate.browserPlayable?'yes':'no'],['Verification',candidate.verificationStatus||'UNVERIFIED'],['HTTP',candidate.lastHttpStatus||'—'],['Candidate ID',candidate.candidateId||'—']];
  for(const [label,value] of facts){const cell=document.createElement('div');const l=document.createElement('span');l.textContent=label;const v=document.createElement('code');v.textContent=String(value);cell.append(l,v);grid.appendChild(cell);}
  details.append(detailSummary,grid,sourceLinks(raw));
  const candidateEvents=candidateReportEvents(candidate.candidateId);if(candidateEvents.length){const pre=document.createElement('div');pre.className='unified-report-timeline';for(const event of candidateEvents.slice(-30))pre.appendChild(reportEventRow(event));details.appendChild(pre);}
  main.append(title,meta,url,details);
  const actions=document.createElement('div');actions.className='unified-candidate-actions';
  const play=document.createElement('button');play.type='button';play.className='button';play.textContent='Play';play.disabled=!playableCandidate(raw);play.title=play.disabled?'This resolved format is not playable by the current browser Player':'Play this candidate';
  play.addEventListener('click',()=>playCandidate(raw,channelName,play));actions.appendChild(play);
  const saveState=saveCandidateState(raw,channelName);const save=document.createElement('button');save.type='button';save.className='button playlists';save.textContent=saveState.label;save.disabled=!saveState.enabled;save.title=saveState.title;
  save.addEventListener('click',()=>saveCandidateSource(raw,channelName,save));actions.appendChild(save);
  const safeOrigin=safePublicActionUrl(candidate.sourceOriginUrl);if(safeOrigin){const link=document.createElement('a');link.className='button ghost';link.href=safeOrigin;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open source ↗';actions.appendChild(link);}
  const copyUrl=safePublicActionUrl(raw.sourceUrl);if(copyUrl&&!raw.xtreamContext){const copy=document.createElement('button');copy.type='button';copy.className='button ghost';copy.textContent='Copy URL';copy.addEventListener('click',()=>navigator.clipboard?.writeText?.(copyUrl));actions.appendChild(copy);}
  row.append(main,actions);return row;
}

function renderLeads(leads=[]){
  if(!Array.isArray(leads)||!leads.length)return null;
  const card=document.createElement('article');card.className='unified-channel-card';
  const head=document.createElement('div');head.className='unified-channel-head';
  const name=document.createElement('strong');name.textContent='Exploration leads';
  const count=document.createElement('span');count.className='unified-channel-count';count.textContent=`${leads.length} lead${leads.length===1?'':'s'}`;
  head.append(name,count);
  const list=document.createElement('div');list.className='unified-candidate-list';
  for(const lead of leads){
    const row=document.createElement('div');row.className='unified-candidate-row';
    const main=document.createElement('div');main.className='unified-candidate-main';
    const title=document.createElement('div');title.className='unified-candidate-title';
    const label=document.createElement('span');label.textContent=lead.title||lead.sourceOriginLabel||'Inspectable lead';
    const status=document.createElement('span');status.className='unified-unplayable';status.textContent=lead.leadStatus||'Needs inspection';
    title.append(label,status);
    const meta=document.createElement('div');meta.className='unified-candidate-meta';
    const via=document.createElement('span');via.textContent=`Via: ${lead.discoveryProvider||'hunt-exploration'}`;meta.appendChild(via);
    if(lead.snippet){const snippet=document.createElement('span');snippet.textContent=lead.snippet;meta.appendChild(snippet);}
    main.append(title,meta);
    const actions=document.createElement('div');actions.className='unified-candidate-actions';
    const safe=safePublicActionUrl(lead.sourceOriginUrl||lead.sourceUrl);if(safe){const link=document.createElement('a');link.className='button ghost';link.href=safe;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open source ↗';actions.appendChild(link);}
    row.append(main,actions);list.appendChild(row);
  }
  card.append(head,list);return card;
}

function renderResults(snapshot={}){
  const root=$('unified-search-results');if(!root)return;
  const grouped=groupCandidatesByChannel(snapshot.candidates||[],snapshot.intent||latestIntent||{});const leads=Array.isArray(snapshot.leads)?snapshot.leads:[];root.replaceChildren();
  if(!grouped.length&&!leads.length){const empty=document.createElement('div');empty.className='unified-search-empty';empty.textContent=snapshot.status==='running'?'Searching sources… results will appear here as lanes finish.':snapshot.status==='completed'?'No candidates or leads found for this search.':'Search for a channel or group.';root.appendChild(empty);return;}
  for(const group of grouped){const card=document.createElement('article');card.className='unified-channel-card';const head=document.createElement('div');head.className='unified-channel-head';const name=document.createElement('strong');name.textContent=group.channelName;const count=document.createElement('span');count.className='unified-channel-count';count.textContent=`${group.candidates.length} source${group.candidates.length===1?'':'s'}`;head.append(name,count);const list=document.createElement('div');list.className='unified-candidate-list';for(const candidate of group.candidates)list.appendChild(candidateRow(candidate,group.channelName));card.append(head,list);root.appendChild(card);}
  const leadCard=renderLeads(leads);if(leadCard)root.appendChild(leadCard);
}

function reportEventRow(event={}){const row=document.createElement('div');row.className='unified-report-event';row.dataset.severity=event.severity||'INFO';const time=document.createElement('time');time.textContent=String(event.at||'').slice(11,19);const severity=document.createElement('strong');severity.textContent=event.severity||'INFO';const message=document.createElement('div');message.className='unified-report-message';const scope=[event.type,event.sourceLabel||event.sourceId,event.channelName,event.message].filter(Boolean).join(' · ');message.textContent=scope;row.append(time,severity,message);return row;}

function renderReport(report=[],summary={}){
  const badge=$('unified-search-report-badge'),summaryRoot=$('unified-search-report-summary'),timeline=$('unified-search-report-timeline'),filter=$('unified-search-report-source');if(!badge||!summaryRoot||!timeline||!filter)return;
  const problems=(summary.failed||0)+(summary.timeouts||0)+(summary.warnings||0);badge.textContent=report.length?`${report.length} events${problems?` · ${problems} issue${problems===1?'':'s'}`:''}`:'no run';
  summaryRoot.replaceChildren();for(const [label,value,tone] of [['Events',summary.total||report.length],['Candidates',summary.candidates||0,'ok'],['Verified',summary.verified||0,'ok'],['Warnings',summary.warnings||0,'warn'],['Timeouts',summary.timeouts||0,'warn'],['Errors',summary.failed||0,'error']]){const chip=document.createElement('span');chip.className='unified-search-chip';if(tone&&value)chip.dataset.tone=tone;chip.textContent=`${label}: ${value}`;summaryRoot.appendChild(chip);}
  const previous=filter.value;const sources=new Map();for(const event of report)if(event.sourceId)sources.set(event.sourceId,event.sourceLabel||event.sourceId);filter.replaceChildren(new Option('All sources',''));for(const [id,label] of sources)filter.appendChild(new Option(label,id));if([...filter.options].some(option=>option.value===previous))filter.value=previous;
  const selected=filter.value;const rows=(selected?report.filter(event=>event.sourceId===selected):report).slice(-250);timeline.replaceChildren();if(!rows.length){const empty=document.createElement('div');empty.className='muted small';empty.textContent='No report events yet.';timeline.appendChild(empty);}else for(const event of rows)timeline.appendChild(reportEventRow(event));
}

function renderUpdate(update={}){latestUpdate=update;latestIntent=update.snapshot?.intent||latestIntent;renderProgress(update.snapshot||{},update.summary||{});renderResults(update.snapshot||{});renderReport(update.report||[],update.summary||{});const cancel=$('unified-search-cancel');if(cancel)cancel.hidden=update.snapshot?.status!=='running';const now=$('unified-search-now-playing');if(now)now.textContent=displayNowPlayingName();}

async function saveCandidateSource(candidate,channelName,button){
  const state=saveCandidateState(candidate,channelName);if(!state.enabled){button.disabled=true;button.textContent=state.label;button.title=state.title;return;}
  const api=window.WebTVMyPlaylistAPI;if(typeof api?.addSourceToCurrent!=='function')return;
  button.disabled=true;const old=button.textContent;button.textContent='Saving…';
  try{
    await api.addSourceToCurrent(playbackValue(candidate));
    savedCandidateIds.add(candidate.candidateId);
    activeRun?.reporter?.emit?.({type:'source.saved',severity:'OK',candidateId:candidate.candidateId,channelName,stage:'save',message:'Saved to My Playlist'});
    button.textContent='Saved ✓';button.title='Saved to My Playlist';
  }catch(error){
    activeRun?.reporter?.emit?.({type:'source.save-failed',severity:'ERROR',candidateId:candidate.candidateId,channelName,stage:'save',message:error?.message||String(error)});
    button.textContent='Save failed';button.classList.add('danger');button.title=error?.message||String(error);
    setTimeout(()=>{const retry=saveCandidateState(candidate,channelName);button.disabled=!retry.enabled;button.textContent=old;button.title=retry.title;button.classList.remove('danger');},1400);
  }
  const report=activeRun?.reporter?.snapshot?.()||latestUpdate?.report||[];renderReport(report,activeRun?.reporter?.summary?.()||latestUpdate?.summary||{});
}

async function playCandidate(candidate,channelName,button){
  const api=window.WebTVPlaybackAPI;if(!api?.testCandidate)return;button.disabled=true;const old=button.textContent;button.textContent='Connecting…';
  try{
    activeRun?.reporter?.emit?.({type:'playback.requested',severity:'INFO',candidateId:candidate.candidateId,channelName,stage:'playback'});
    const result=await api.testCandidate(playbackValue(candidate),{channel:{id:candidate.normalizedChannelName||channelName,name:channelName,originalId:channelName}});
    activeRun?.reporter?.emit?.({type:'playback.completed',severity:'OK',candidateId:candidate.candidateId,channelName,stage:'playback',durationMs:result?.startupMs||null,detail:{player:result?.player||'',route:result?.route||''}});
    playbackConfirmedCandidates.add(candidate.candidateId);nowPlayingState.setCandidate(channelName);button.textContent='Playing';const now=$('unified-search-now-playing');if(now)now.textContent=displayNowPlayingName();renderResults(latestUpdate?.snapshot||{});
  }catch(error){activeRun?.reporter?.emit?.({type:'playback.completed',severity:'ERROR',candidateId:candidate.candidateId,channelName,stage:'playback',message:error?.message||String(error)});button.textContent='Failed';button.classList.add('danger');}
  finally{setTimeout(()=>{button.disabled=!playableCandidate(candidate);button.textContent=old;button.classList.remove('danger');const report=activeRun?.reporter?.snapshot?.()||latestUpdate?.report||[];renderReport(report,activeRun?.reporter?.summary?.()||latestUpdate?.summary||{});},1200);}
}

function startSearch(event){
  event?.preventDefault?.();const query=$('unified-search-query')?.value.trim();if(!query)return;
  playbackConfirmedCandidates.clear();savedCandidateIds.clear();activeRun?.cancel?.('superseded');const context=searchContext();
  const run=runUnifiedSearch({query,context,sources:listUnifiedSearchLanes(),resolveAdapter:getUnifiedSearchRuntimeAdapter,verifyBatch:verifySearchCandidates,concurrency:3,laneTimeoutMs:10000,onUpdate:update=>{if(activeRun===run)renderUpdate(update);}});
  activeRun=run;latestIntent=null;
  run.done.then(result=>{if(activeRun!==run)return;renderUpdate({snapshot:result.snapshot,report:result.report,summary:result.summary});}).catch(error=>{if(activeRun!==run)return;renderProgress({status:'cancelled',candidates:[],lanes:{}},{failed:1});console.error('[WebTV] Unified Search failed',error);});
}

async function copyReport(){const text=activeRun?.reporter?.exportText?.()||'';if(!text)return;await navigator.clipboard?.writeText?.(text);}
function exportJson(){const json=activeRun?.reporter?.exportJson?.();if(!json)return;const blob=new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`webtv-search-report-${activeRun.searchId||'run'}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);}

function bind(){const form=$('unified-search-form');if(!form||form.dataset.bound==='1')return;form.dataset.bound='1';form.addEventListener('submit',startSearch);$('unified-search-close')?.addEventListener('click',()=>{const panel=$('unified-search-panel');if(panel)panel.hidden=true;$('unified-search-toggle')?.setAttribute('aria-expanded','false');});$('unified-search-cancel')?.addEventListener('click',()=>activeRun?.cancel?.('user'));$('unified-search-report-copy')?.addEventListener('click',()=>copyReport().catch(()=>{}));$('unified-search-report-json')?.addEventListener('click',exportJson);$('unified-search-report-source')?.addEventListener('change',()=>renderReport(activeRun?.reporter?.snapshot?.()||latestUpdate?.report||[],activeRun?.reporter?.summary?.()||latestUpdate?.summary||{}));}

export function installUnifiedSearchUI(){if(installed)return true;ensureStylesheet();const panel=createUi();if(!panel)return false;ensureSearchToggle();installed=true;bind();syncSearchQueryToSidebarSelection();window.addEventListener('webtv:channel-selected',()=>{nowPlayingState.sidebarChanged();syncSearchQueryToSidebarSelection();const now=$('unified-search-now-playing');if(now)now.textContent=displayNowPlayingName();});console.info(`[WebTV] Unified Search UI loaded · ${BUILD_ID}`);return true;}

function bootInstall(){if(installUnifiedSearchUI())return;window.addEventListener('webtv:ready',()=>installUnifiedSearchUI(),{once:true});setTimeout(()=>installUnifiedSearchUI(),1200);}

bootInstall();