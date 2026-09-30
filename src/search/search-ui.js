import { runUnifiedSearch } from './search-orchestrator.js';
import { listUnifiedSearchLanes, getUnifiedSearchRuntimeAdapter } from './search-runtime.js';
import { verifySearchCandidates } from './search-verification.js';
import { UnifiedNowPlayingState } from './now-playing-state.js';
import { safePublicActionUrl } from './public-url-policy.js';
import { buildSearchContext } from './search-group-catalog.js';
import { groupCandidatesByChannel } from './result-grouper.js';
import { candidateForDisplay } from '../discovery/candidate-model.js';

const BUILD_ID='20260930-unified-search-ui-a';
const $=id=>document.getElementById(id);
const nowPlayingState=new UnifiedNowPlayingState();
let activeRun=null;
let latestUpdate=null;
let latestIntent=null;
let installed=false;

function ensureStylesheet(){
  if(document.querySelector('link[data-unified-search-style]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./unified-search.css?v=20260930-unified-search-a';
  link.dataset.unifiedSearchStyle='1';
  document.head.appendChild(link);
}

function sidebarNowPlayingName(){return String($('channel-name')?.textContent||'').trim()||'—';}
function displayNowPlayingName(){return nowPlayingState.value(sidebarNowPlayingName());}
function playlistChannels(){try{return window.WebTVPlaylistAPI?.getChannels?.()||[];}catch{return[];}}
function searchContext(){return buildSearchContext(playlistChannels());}

function createUi(){
  if($('unified-search-panel'))return $('unified-search-panel');
  const playerCard=document.querySelector('.player-card');
  if(!playerCard?.parentElement)return null;
  const panel=document.createElement('section');
  panel.id='unified-search-panel';
  panel.className='unified-search-panel panel';
  panel.setAttribute('aria-label','Unified source search');
  panel.innerHTML=`
    <div class="unified-search-head">
      <div class="unified-search-head-copy"><p class="eyebrow">SEARCH</p><h2>Find channels & sources</h2><p class="muted small">Search one channel, a group such as ERT / Nova / Cosmote, or any free text. Search never changes the player by itself.</p></div>
      <div class="unified-search-now"><span>Now Playing</span><strong id="unified-search-now-playing">${escapeHtml(displayNowPlayingName())}</strong></div>
    </div>
    <form id="unified-search-form" class="unified-search-form">
      <input id="unified-search-query" type="search" autocomplete="off" placeholder="ERT1, ERT, Nova, Cosmote Sport…" aria-label="Search channels or groups">
      <button class="button" type="submit">Search</button>
      <button id="unified-search-cancel" class="button ghost unified-search-cancel" type="button" hidden>Cancel</button>
    </form>
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

function renderProgress(snapshot={},summary={}){
  const root=$('unified-search-progress');if(!root)return;
  root.replaceChildren();
  const add=(text,tone='')=>{const chip=document.createElement('span');chip.className='unified-search-chip';if(tone)chip.dataset.tone=tone;chip.textContent=text;root.appendChild(chip);};
  const status=String(snapshot.status||'idle');
  add(status==='running'?'Searching…':status==='completed'?'Search complete':status==='cancelled'?'Search cancelled':'Ready',status==='completed'?'ok':status==='cancelled'?'warn':'');
  if(snapshot.intent?.type)add(`Intent: ${snapshot.intent.type}`);
  add(`Candidates: ${snapshot.candidates?.length||0}`,(snapshot.candidates?.length||0)>0?'ok':'');
  if(summary.timeouts)add(`Timeouts: ${summary.timeouts}`,'warn');
  if(summary.failed)add(`Errors: ${summary.failed}`,'error');
  const lanes=Object.values(snapshot.lanes||{});const done=lanes.filter(item=>item.status==='done').length;
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
  const safeOrigin=safePublicActionUrl(candidate.sourceOriginUrl);if(safeOrigin){const link=document.createElement('a');link.className='button ghost';link.href=safeOrigin;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open source ↗';actions.appendChild(link);}
  const copyUrl=safePublicActionUrl(raw.sourceUrl);if(copyUrl&&!raw.xtreamContext){const copy=document.createElement('button');copy.type='button';copy.className='button ghost';copy.textContent='Copy URL';copy.addEventListener('click',()=>navigator.clipboard?.writeText?.(copyUrl));actions.appendChild(copy);}
  row.append(main,actions);return row;
}

function renderResults(snapshot={}){
  const root=$('unified-search-results');if(!root)return;
  const grouped=groupCandidatesByChannel(snapshot.candidates||[],snapshot.intent||latestIntent||{});root.replaceChildren();
  if(!grouped.length){const empty=document.createElement('div');empty.className='unified-search-empty';empty.textContent=snapshot.status==='running'?'Searching sources… results will appear here as lanes finish.':snapshot.status==='completed'?'No candidates found for this search.':'Search for a channel or group.';root.appendChild(empty);return;}
  for(const group of grouped){const card=document.createElement('article');card.className='unified-channel-card';const head=document.createElement('div');head.className='unified-channel-head';const name=document.createElement('strong');name.textContent=group.channelName;const count=document.createElement('span');count.className='unified-channel-count';count.textContent=`${group.candidates.length} source${group.candidates.length===1?'':'s'}`;head.append(name,count);const list=document.createElement('div');list.className='unified-candidate-list';for(const candidate of group.candidates)list.appendChild(candidateRow(candidate,group.channelName));card.append(head,list);root.appendChild(card);}
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

async function playCandidate(candidate,channelName,button){
  const api=window.WebTVPlaybackAPI;if(!api?.testCandidate)return;button.disabled=true;const old=button.textContent;button.textContent='Connecting…';
  try{
    activeRun?.reporter?.emit?.({type:'playback.requested',severity:'INFO',candidateId:candidate.candidateId,channelName,stage:'playback'});
    const result=await api.testCandidate(playbackValue(candidate),{channel:{id:candidate.normalizedChannelName||channelName,name:channelName,originalId:channelName}});
    activeRun?.reporter?.emit?.({type:'playback.completed',severity:'OK',candidateId:candidate.candidateId,channelName,stage:'playback',durationMs:result?.startupMs||null,detail:{player:result?.player||'',route:result?.route||''}});
    nowPlayingState.setCandidate(channelName);button.textContent='Playing';const now=$('unified-search-now-playing');if(now)now.textContent=displayNowPlayingName();
  }catch(error){activeRun?.reporter?.emit?.({type:'playback.completed',severity:'ERROR',candidateId:candidate.candidateId,channelName,stage:'playback',message:error?.message||String(error)});button.textContent='Failed';button.classList.add('danger');}
  finally{setTimeout(()=>{button.disabled=!playableCandidate(candidate);button.textContent=old;button.classList.remove('danger');const report=activeRun?.reporter?.snapshot?.()||latestUpdate?.report||[];renderReport(report,activeRun?.reporter?.summary?.()||latestUpdate?.summary||{});},1200);}
}

function startSearch(event){event?.preventDefault?.();const query=$('unified-search-query')?.value.trim();if(!query)return;activeRun?.cancel?.('superseded');const context=searchContext();activeRun=runUnifiedSearch({query,context,sources:listUnifiedSearchLanes(),resolveAdapter:getUnifiedSearchRuntimeAdapter,verifyBatch:verifySearchCandidates,concurrency:3,laneTimeoutMs:10000,onUpdate:renderUpdate});latestIntent=null;activeRun.done.then(result=>renderUpdate({snapshot:result.snapshot,report:result.report,summary:result.summary})).catch(error=>{renderProgress({status:'cancelled',candidates:[],lanes:{}},{failed:1});console.error('[WebTV] Unified Search failed',error);});}

async function copyReport(){const text=activeRun?.reporter?.exportText?.()||'';if(!text)return;await navigator.clipboard?.writeText?.(text);}
function exportJson(){const json=activeRun?.reporter?.exportJson?.();if(!json)return;const blob=new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`webtv-search-report-${activeRun.searchId||'run'}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);}

function bind(){const form=$('unified-search-form');if(!form||form.dataset.bound==='1')return;form.dataset.bound='1';form.addEventListener('submit',startSearch);$('unified-search-cancel')?.addEventListener('click',()=>activeRun?.cancel?.('user'));$('unified-search-report-copy')?.addEventListener('click',()=>copyReport().catch(()=>{}));$('unified-search-report-json')?.addEventListener('click',exportJson);$('unified-search-report-source')?.addEventListener('change',()=>renderReport(activeRun?.reporter?.snapshot?.()||latestUpdate?.report||[],activeRun?.reporter?.summary?.()||latestUpdate?.summary||{}));}

export function installUnifiedSearchUI(){if(installed)return true;ensureStylesheet();const panel=createUi();if(!panel)return false;installed=true;bind();const name=$('channel-name');if(name)new MutationObserver(()=>{nowPlayingState.sidebarChanged();const now=$('unified-search-now-playing');if(now)now.textContent=displayNowPlayingName();}).observe(name,{childList:true,subtree:true,characterData:true});console.info(`[WebTV] Unified Search UI loaded · ${BUILD_ID}`);return true;}

function bootInstall(){if(installUnifiedSearchUI())return;window.addEventListener('webtv:ready',()=>installUnifiedSearchUI(),{once:true});setTimeout(()=>installUnifiedSearchUI(),1200);}

bootInstall();