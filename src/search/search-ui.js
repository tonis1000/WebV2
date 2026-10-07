import { runUnifiedSearch } from './search-orchestrator.js';
import { listUnifiedSearchLanes, getUnifiedSearchRuntimeAdapter } from './search-runtime.js';
import { verifySearchCandidates } from './search-verification.js';
import { UnifiedNowPlayingState } from './now-playing-state.js';
import { safePublicActionUrl } from './public-url-policy.js';
import { buildSearchContext } from './search-group-catalog.js';
import { groupCandidatesByChannel } from './result-grouper.js';
import { candidateForDisplay } from '../discovery/candidate-model.js';
import { normalizedSelectedChannelKeys, saveSourceEligibility, bestSourceSaveEligibility } from './save-source-policy.js';
import { rankBestSources, selectBestSource } from './best-source.js';
import { normalizeChannelName } from '../discovery/candidate-model.js';
import { workerUrl } from '../core/utils.js';

const BUILD_ID='20261007-source-intelligence-a';
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
  link.href='./unified-search.css?v=20261005-best-source-a';
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
      <div class="unified-search-head-copy"><p class="eyebrow">SEARCH</p><h2>Find channels & sources</h2><p class="muted small">Free sources run first. Paid Brave search is used only when you explicitly choose the Deep web fallback. Search never changes the player by itself.</p></div>
      <div class="unified-search-head-actions"><div class="unified-search-now"><span>Now Playing</span><strong id="unified-search-now-playing">${escapeHtml(displayNowPlayingName())}</strong></div><button id="unified-search-close" class="button ghost" type="button">Close</button></div>
    </div>
    <form id="unified-search-form" class="unified-search-form">
      <input id="unified-search-query" type="search" autocomplete="off" placeholder="ERT1, ERT, Nova, Cosmote Sport…" aria-label="Search channels or groups">
      <button id="unified-search-submit" class="button" type="submit">Search</button>
      <button id="unified-search-paid-fallback" class="button ghost" type="button" title="Explicit last-resort search using paid Brave API">Deep web fallback (Brave)</button>
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
function selectedChannel(){try{return window.WebTVPlaylistAPI?.getSelectedChannel?.()||null;}catch{return null;}}
function candidateHealthScore(candidate={}){
  const store=window.WebTVHealthStore;
  try{store?.refresh?.();}catch{}
  const values=[candidate.sourceUrl];
  try{
    if(String(candidate.sourceType||'').toLowerCase()==='hls')values.push(workerUrl(candidate.sourceUrl,candidate.requiredHeaders||{}));
  }catch{}
  const known=values.filter(value=>value&&store?.get?.(value)).map(value=>Number(store?.score?.(value)||0));
  return known.length?Math.max(...known):0;
}
function bestSourceOptions(){
  return {playbackConfirmedIds:playbackConfirmedCandidates,scoreHealth:candidateHealthScore,pageProtocol:location.protocol};
}
function playlistHasChannel(group={}){
  const wanted=new Set([group.channelKey,group.channelName].map(normalizeChannelName).filter(Boolean));
  return playlistChannels().some(channel=>[channel.id,channel.originalId,channel.name].map(normalizeChannelName).some(key=>wanted.has(key)));
}
function saveCandidateState(candidate={},channelName=''){
  normalizedSelectedChannelKeys(selectedChannel());
  return saveSourceEligibility({
    candidate,
    channelName,
    selectedChannel:selectedChannel(),
    playbackConfirmed:playbackConfirmedCandidates.has(candidate.candidateId),
    alreadySaved:savedCandidateIds.has(candidate.candidateId),
  });
}

function renderProgress(snapshot={},summary={}){
  const root=$('unified-search-progress');if(!root)return;
  root.replaceChildren();
  const add=(text,tone='')=>{const chip=document.createElement('span');chip.className='unified-search-chip';if(tone)chip.dataset.tone=tone;chip.textContent=text;root.appendChild(chip);};
  const status=String(snapshot.status||'idle');
  const lanes=Object.values(snapshot.lanes||{});const done=lanes.filter(item=>item.status==='done').length;
  const candidateCount=snapshot.candidates?.length||0;
  const banner=$('unified-search-status-banner'),title=$('unified-search-status-title'),detail=$('unified-search-status-detail'),submit=$('unified-search-submit'),paidFallback=$('unified-search-paid-fallback');
  const running=status==='running';
  if(submit){submit.disabled=running;submit.textContent=running?'Searching…':'Search';}
  if(paidFallback)paidFallback.disabled=running;
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

function candidateRow(raw,channelName,{best=false,channelKey=''}={}){
  const candidate=candidateForDisplay(raw);const row=document.createElement('div');row.className='unified-candidate-row';
  const main=document.createElement('div');main.className='unified-candidate-main';
  const title=document.createElement('div');title.className='unified-candidate-title';
  const source=document.createElement('span');source.textContent=candidate.sourceOriginLabel||candidate.sourceOrigin||candidate.discoveryProvider||'Source';
  const capability=document.createElement('span');capability.className=candidate.browserPlayable?'unified-playable':'unified-unplayable';capability.textContent=candidate.browserPlayable?'Playable':'Not browser-playable';
  title.append(source,capability);
  if(best){const badge=document.createElement('span');badge.className='unified-best-source-badge';badge.textContent='Best Source';title.appendChild(badge);row.classList.add('best-source');}
  const meta=document.createElement('div');meta.className='unified-candidate-meta';
  for(const text of [`${candidate.inputFormatId||candidate.sourceType||'unknown'} → ${candidate.resolvedMediaFormatId||'unknown'}`,`Verifier: ${candidate.verificationStatus||'UNVERIFIED'}`,`Via: ${candidate.discoveryProvider||'unknown'}`]){const span=document.createElement('span');span.textContent=text;meta.appendChild(span);}
  const url=document.createElement('code');url.className='unified-candidate-url';url.textContent=formatSource(raw.sourceUrl);
  const details=document.createElement('details');details.className='unified-details';
  const detailSummary=document.createElement('summary');detailSummary.textContent='Details';
  const grid=document.createElement('div');grid.className='unified-detail-grid';
  const facts=[['Input format',candidate.inputFormatId||candidate.sourceType||'unknown'],['Resolved media',candidate.resolvedMediaFormatId||'unknown'],['Browser playback',candidate.browserPlayable?'yes':'no'],['Verification',candidate.verificationStatus||'UNVERIFIED'],['HTTP',candidate.lastHttpStatus||'—'],['Candidate ID',candidate.candidateId||'—']];
  const headerNames=Object.keys(candidate.requiredHeaders||{});if(headerNames.length)facts.push(['Required headers',headerNames.join(', ')]);
  const intelligence=candidate.sourceIntelligence||{};if(intelligence.provider){const parts=[intelligence.provider==='iptv-nexus'?'IPTV Nexus':intelligence.provider,intelligence.healthStatus||'',Number.isFinite(Number(intelligence.healthScore))?`score ${Number(intelligence.healthScore).toFixed(0)}`:'',Number.isFinite(Number(intelligence.uptime))?`uptime ${Number(intelligence.uptime).toFixed(0)}%`:'',Number.isFinite(Number(intelligence.latencyMs))?`${Number(intelligence.latencyMs)} ms`:'',intelligence.quality||''].filter(Boolean);facts.push(['Source intelligence',parts.join(' · ')]);}
  for(const [label,value] of facts){const cell=document.createElement('div');const l=document.createElement('span');l.textContent=label;const v=document.createElement('code');v.textContent=String(value);cell.append(l,v);grid.appendChild(cell);}
  const external=document.createElement('div');external.className='unified-external-health';external.dataset.state='idle';external.textContent='External health: open Details to check Channel Signal';
  details.append(detailSummary,grid,external,sourceLinks(raw));
  details.addEventListener('toggle',async()=>{
    if(!details.open||external.dataset.state!=='idle')return;
    if(raw.xtreamContext||String(raw.sourceType||'').toLowerCase()==='xtream'){external.dataset.state='skipped';external.textContent='External health: not applicable to Xtream';return;}
    external.dataset.state='loading';external.textContent='External health: checking Channel Signal…';
    const result=await fetchExternalHealth(raw.sourceUrl);
    external.dataset.state=String(result.state||'unavailable');
    const when=result.checkedAt||String(result.lastSwept||'').slice(0,10);
    const scope=[result.state||'unavailable',result.channel,result.list,when].filter(Boolean).join(' · ');
    external.textContent=`External health: Channel Signal · ${scope}${result.state==='not-found'?' · exact URL not tracked':''}`;
    external.title=result.detail||'Advisory exact-URL external health evidence; does not override WebV2 verification.';
  });
  const candidateEvents=candidateReportEvents(candidate.candidateId);if(candidateEvents.length){const pre=document.createElement('div');pre.className='unified-report-timeline';for(const event of candidateEvents.slice(-30))pre.appendChild(reportEventRow(event));details.appendChild(pre);}
  main.append(title,meta,url,details);
  const actions=document.createElement('div');actions.className='unified-candidate-actions';
  const play=document.createElement('button');play.type='button';play.className='button';play.textContent='Play';play.disabled=!playableCandidate(raw);play.title=play.disabled?'This resolved format is not playable by the current browser Player':'Play this candidate';
  play.addEventListener('click',()=>playCandidate(raw,channelName,play));actions.appendChild(play);
  const saveState=saveCandidateState(raw,channelName);const save=document.createElement('button');save.type='button';save.className='button playlists';save.textContent=saveState.label;save.disabled=!saveState.enabled;save.title=saveState.title;
  save.addEventListener('click',()=>saveCandidateSource(raw,channelName,save));actions.appendChild(save);
  if(best){
    const bestState=bestSourceSaveEligibility({candidate:raw,playbackConfirmed:playbackConfirmedCandidates.has(raw.candidateId)});
    const bestButton=document.createElement('button');bestButton.type='button';bestButton.className='button best-source-action';bestButton.textContent=bestState.enabled?(playlistHasChannel({channelKey,channelName})?'Use Best Source':'Add Best to My Playlist'):bestState.label;bestButton.disabled=!bestState.enabled;bestButton.title=bestState.title;
    bestButton.addEventListener('click',()=>saveBestSource(raw,{channelKey,channelName},bestButton));actions.appendChild(bestButton);
  }
  const safeOrigin=safePublicActionUrl(candidate.sourceOriginUrl);if(safeOrigin){const link=document.createElement('a');link.className='button ghost';link.href=safeOrigin;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open source ↗';actions.appendChild(link);}
  const copyUrl=safePublicActionUrl(raw.sourceUrl);if(copyUrl&&!raw.xtreamContext){const copy=document.createElement('button');copy.type='button';copy.className='button ghost';copy.textContent='Copy URL';copy.addEventListener('click',()=>navigator.clipboard?.writeText?.(copyUrl));actions.appendChild(copy);}
  row.append(main,actions);return row;
}

async function saveBestSource(candidate,group={},button){
  const state=bestSourceSaveEligibility({candidate,playbackConfirmed:playbackConfirmedCandidates.has(candidate.candidateId)});
  if(!state.enabled){button.disabled=true;button.textContent=state.label;button.title=state.title;return;}
  const api=window.WebTVMyPlaylistAPI;if(typeof api?.saveVerifiedSearchSource!=='function')return;
  button.disabled=true;button.textContent='Saving Best…';
  const channel={id:group.channelKey||candidate.normalizedChannelName||group.channelName,originalId:group.channelKey||candidate.channelName||group.channelName,name:group.channelName||candidate.channelName||'Channel',group:'Other',logo:''};
  try{
    await api.saveVerifiedSearchSource(channel,{url:playbackValue(candidate),origin:candidate.sourceOrigin||candidate.discoveryProvider||'best-source',provider:candidate.discoveryProvider||'',discoveryProvider:candidate.discoveryProvider||'',sourceFamilyId:candidate.sourceFamilyId||'',sourceObservations:Array.isArray(candidate.sourceObservations)?candidate.sourceObservations:[],sourceType:candidate.sourceType||'',browserPlayable:candidate.browserPlayable===true,drmDetected:Boolean(candidate.drmDetected)},{
      reason:'unified-search-best-source-save',
      verified:candidate.verified===true&&String(candidate.verificationStatus||'').toUpperCase()==='VERIFIED',
      streamKind:String(candidate.streamKind||'unknown').toLowerCase(),
      playbackConfirmed:playbackConfirmedCandidates.has(candidate.candidateId),
    });
    savedCandidateIds.add(candidate.candidateId);
    activeRun?.reporter?.emit?.({type:'best-source.saved',severity:'OK',candidateId:candidate.candidateId,channelName:group.channelName||candidate.channelName||'',stage:'save',message:'Best Source saved through Playlist Manager'});
    button.textContent='Best Source saved ✓';button.title='My Playlist updated through Playlist Manager';
  }catch(error){
    activeRun?.reporter?.emit?.({type:'best-source.save-failed',severity:'ERROR',candidateId:candidate.candidateId,channelName:group.channelName||candidate.channelName||'',stage:'save',message:error?.message||String(error)});
    button.textContent='Best save failed';button.classList.add('danger');button.title=error?.message||String(error);
    setTimeout(()=>{button.classList.remove('danger');renderResults(latestUpdate?.snapshot||{});},1500);
  }
  const report=activeRun?.reporter?.snapshot?.()||latestUpdate?.report||[];renderReport(report,activeRun?.reporter?.summary?.()||latestUpdate?.summary||{});
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
  for(const group of grouped){const card=document.createElement('article');card.className='unified-channel-card';const head=document.createElement('div');head.className='unified-channel-head';const name=document.createElement('strong');name.textContent=group.channelName;const ranked=rankBestSources(group.candidates,bestSourceOptions());const best=selectBestSource(group.candidates,bestSourceOptions());const count=document.createElement('span');count.className='unified-channel-count';count.textContent=`${group.candidates.length} source${group.candidates.length===1?'':'s'}${best?' · Best Source ready':''}`;head.append(name,count);const list=document.createElement('div');list.className='unified-candidate-list';const rankedIds=new Set(ranked.map(item=>item.candidate.candidateId));const ordered=[...ranked.map(item=>item.candidate),...group.candidates.filter(candidate=>!rankedIds.has(candidate.candidateId))];for(const candidate of ordered)list.appendChild(candidateRow(candidate,group.channelName,{best:Boolean(best&&candidate.candidateId===best.candidateId),channelKey:group.channelKey}));card.append(head,list);root.appendChild(card);}
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
    await api.addSourceToCurrent(playbackValue(candidate),{provider:candidate.discoveryProvider||'',discoveryProvider:candidate.discoveryProvider||'',sourceFamilyId:candidate.sourceFamilyId||'',sourceObservations:Array.isArray(candidate.sourceObservations)?candidate.sourceObservations:[]});
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

function launchSearch(query,sources){
  playbackConfirmedCandidates.clear();savedCandidateIds.clear();activeRun?.cancel?.('superseded');const context=searchContext();
  const run=runUnifiedSearch({query,context,sources,resolveAdapter:getUnifiedSearchRuntimeAdapter,verifyBatch:verifySearchCandidates,concurrency:3,laneTimeoutMs:10000,onUpdate:update=>{if(activeRun===run)renderUpdate(update);}});
  activeRun=run;latestIntent=null;
  run.done.then(result=>{if(activeRun!==run)return;renderUpdate({snapshot:result.snapshot,report:result.report,summary:result.summary});}).catch(error=>{if(activeRun!==run)return;renderProgress({status:'cancelled',candidates:[],lanes:{}},{failed:1});console.error('[WebTV] Unified Search failed',error);});
}
function startSearch(event){
  event?.preventDefault?.();const query=$('unified-search-query')?.value.trim();if(!query)return;
  launchSearch(query,listUnifiedSearchLanes());
}
function startPaidFallback(){
  const query=$('unified-search-query')?.value.trim();if(!query)return;
  launchSearch(query,listUnifiedSearchLanes({includePaidFallback:true}));
}

async function copyReport(){const text=activeRun?.reporter?.exportText?.()||'';if(!text)return;await navigator.clipboard?.writeText?.(text);}
function exportJson(){const json=activeRun?.reporter?.exportJson?.();if(!json)return;const blob=new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`webtv-search-report-${activeRun.searchId||'run'}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);}

function bind(){const form=$('unified-search-form');if(!form||form.dataset.bound==='1')return;form.dataset.bound='1';form.addEventListener('submit',startSearch);$('unified-search-paid-fallback')?.addEventListener('click',startPaidFallback);$('unified-search-close')?.addEventListener('click',()=>{const panel=$('unified-search-panel');if(panel)panel.hidden=true;$('unified-search-toggle')?.setAttribute('aria-expanded','false');});$('unified-search-cancel')?.addEventListener('click',()=>activeRun?.cancel?.('user'));$('unified-search-report-copy')?.addEventListener('click',()=>copyReport().catch(()=>{}));$('unified-search-report-json')?.addEventListener('click',exportJson);$('unified-search-report-source')?.addEventListener('change',()=>renderReport(activeRun?.reporter?.snapshot?.()||latestUpdate?.report||[],activeRun?.reporter?.summary?.()||latestUpdate?.summary||{}));}

export function installUnifiedSearchUI(){if(installed)return true;ensureStylesheet();const panel=createUi();if(!panel)return false;ensureSearchToggle();installed=true;bind();syncSearchQueryToSidebarSelection();window.addEventListener('webtv:channel-selected',()=>{nowPlayingState.sidebarChanged();syncSearchQueryToSidebarSelection();const now=$('unified-search-now-playing');if(now)now.textContent=displayNowPlayingName();});console.info(`[WebTV] Unified Search UI loaded · ${BUILD_ID}`);return true;}

function bootInstall(){if(installUnifiedSearchUI())return;window.addEventListener('webtv:ready',()=>installUnifiedSearchUI(),{once:true});setTimeout(()=>installUnifiedSearchUI(),1200);}

bootInstall();