import { discoverCuratedRemoteFeeds } from './discovery/external-discovery-client.js';

const BUILD_ID = '20260928-candidate-metadata-pipeline';
const FRESH_DAYS = 30;
const DEFAULT_WORKER = 'https://source-huntatonisworkersdev.atonis.workers.dev';
const $ = id => document.getElementById(id);

const channelNameEl = $('channel-name');
const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const diagLog = $('diagnostic-log');

function log(message){
  if(!diagLog) return;
  const stamp = new Date().toLocaleTimeString();
  diagLog.textContent = `[${stamp}] ${message}\n${diagLog.textContent}`.slice(0,18000);
}
function endpoint(){return (localStorage.getItem('webtv_hunt_web_endpoint') || DEFAULT_WORKER).trim().replace(/\/$/, '');}
function selectedChannel(name=''){return window.WebTVPlaylistAPI?.getSelectedChannel?.() || {id:name,originalId:name,name,tvgId:''};}
function ensureUi(){
  const auto = $('hunt-auto');
  if(!auto || $('hunt-external')) return;
  const wrap = document.createElement('div');
  wrap.id = 'hunt-external';
  wrap.className = 'hunt-auto';
  wrap.innerHTML = `
    <div class="hunt-auto-head"><div><strong>External Discovery</strong><span id="hunt-external-status">Ready · Curated feeds + Seeds + Fresh Web + Reddit / Forums + leads</span></div></div>
    <div class="hunt-auto-head"><div><strong>Fresh Curated Feeds</strong><span id="hunt-curated-count">Not scanned yet</span></div></div><div id="hunt-curated-results" class="hunt-results"></div>
    <div class="hunt-auto-head"><div><strong>Known M3U Seeds</strong><span id="hunt-seed-count">0 candidates</span></div></div><div id="hunt-seed-results" class="hunt-results"></div>
    <div class="hunt-auto-head"><div><strong>Fresh Web · 30d</strong><span id="hunt-web-count">0 candidates</span></div></div><div id="hunt-web-results" class="hunt-results"></div>
    <div class="hunt-auto-head"><div><strong>Web Leads</strong><span id="hunt-web-lead-count">0 leads</span></div></div><div id="hunt-web-leads" class="hunt-results"></div>
    <div class="hunt-auto-head"><div><strong>Forums / Reddit · 30d</strong><span id="hunt-forum-count">0 candidates</span></div></div><div id="hunt-forum-results" class="hunt-results"></div>
    <div class="hunt-auto-head"><div><strong>Forum / Reddit Leads</strong><span id="hunt-forum-lead-count">0 leads</span></div></div><div id="hunt-forum-leads" class="hunt-results"></div>
    <div class="candidate-tester"><label for="hunt-worker-url">Source Hunt Worker</label><div class="inline-form"><input id="hunt-worker-url" type="url" value="${DEFAULT_WORKER}"><button id="save-hunt-worker" class="button" type="button">Save override</button></div><p class="muted small">Default Worker is built in. Inspect accepts a playable result only when channel provenance is strong enough. If one is found, playback testing starts automatically.</p></div>`;
  auto.insertAdjacentElement('afterend', wrap);
  const input = $('hunt-worker-url'); if(input) input.value = endpoint();
  $('save-hunt-worker')?.addEventListener('click',()=>{const v=(input?.value||'').trim().replace(/\/$/,'');if(v&&v!==DEFAULT_WORKER)localStorage.setItem('webtv_hunt_web_endpoint',v);else localStorage.removeItem('webtv_hunt_web_endpoint');if(input)input.value=endpoint();$('hunt-external-status').textContent='Worker ready';});
}
function empty(box,text){const d=document.createElement('div');d.className='hunt-empty';d.textContent=text;box.appendChild(d);}
function safeHeaders(headers={}){
  if(!headers||typeof headers!=='object')return{};
  const out={};
  for(const [rawKey,rawValue] of Object.entries(headers)){
    const key=String(rawKey||'').trim().toLowerCase();
    const value=String(rawValue||'').trim();
    if(!value||/[\r\n\0]/.test(value))continue;
    if(key==='user-agent'||key==='user_agent'||key==='useragent')out['User-Agent']=value;
    else if(key==='referer'||key==='referrer')out.Referer=value;
    else if(key==='origin')out.Origin=value;
  }
  return out;
}
function candidateTestValue(item={}){
  const url=String(item.url||item.sourceUrl||'').trim();
  const headers=safeHeaders(item.requiredHeaders||{});
  const entries=Object.entries(headers);
  if(!url||!entries.length)return url;
  const params=new URLSearchParams();
  for(const [key,value] of entries)params.set(key,value);
  return `${url}|${params.toString()}`;
}
function metaText(item){
  const bits=[];
  if(item.title||item.source||item.snippet) bits.push(item.title||item.source||item.snippet);
  if(item.sourceType)bits.push(String(item.sourceType).toUpperCase());
  if(item.provenance) bits.push(`proof: ${item.provenance}`);
  if(item.leadStatus)bits.push(`status: ${item.leadStatus}`);
  const headers=Object.keys(safeHeaders(item.requiredHeaders||{}));
  if(headers.length)bits.push(`headers: ${headers.join(' + ')}`);
  if(item.resolvedFrom)bits.push(`resolved from ${item.resolvedFrom}`);
  if(item.verificationDetail)bits.push(item.verificationDetail);
  if(item.updatedAt){try{bits.push(new Date(item.updatedAt).toLocaleDateString('de-DE'));}catch{}}
  return bits.join(' · ');
}
function candidateCard(item,name,label){
  const card=document.createElement('div');card.className='hunt-result';
  const meta=document.createElement('div'),strong=document.createElement('strong'),detail=document.createElement('span'),code=document.createElement('code');
  const testValue=candidateTestValue(item);
  strong.textContent=item.origin||item.sourceOrigin||label;detail.textContent=metaText(item);code.textContent=testValue||item.url||item.sourceUrl||'';meta.append(strong,detail,code);
  const test=document.createElement('button');test.className='button';test.type='button';test.textContent='Test';test.addEventListener('click',()=>{if(candidateInput)candidateInput.value=testValue;candidateInput?.dispatchEvent(new Event('input',{bubbles:true}));testButton?.click();const headerNames=Object.keys(safeHeaders(item.requiredHeaders||{}));log(`HUNT external candidate selected · ${name} · ${label} · ${item.provenance||item.discoveryProvider||'unverified'} · ${item.sourceType||'stream'}${item.resolvedFrom?' · STRM resolved':''}${headerNames.length?` · headers ${headerNames.join('+')}`:''} · ${item.url||item.sourceUrl}`);});
  card.append(meta,test);return card;
}
function renderGroup(boxId,countId,items,name,label){
  const box=$(boxId),count=$(countId);if(!box)return;box.innerHTML='';const seen=new Set(),rows=(items||[]).filter(x=>x?.url&&!seen.has(x.url)&&seen.add(x.url)).slice(0,8);if(count)count.textContent=`${rows.length} candidate${rows.length===1?'':'s'}`;if(!rows.length){empty(box,`Δεν βρέθηκαν ${label} candidates για ${name}.`);return;}for(const item of rows)box.appendChild(candidateCard(item,name,label));
}
function renderCurated(result,name){
  const box=$('hunt-curated-results'),count=$('hunt-curated-count');if(!box)return;box.innerHTML='';
  const reports=Array.isArray(result?.reports)?result.reports:[];
  const candidates=Array.isArray(result?.candidates)?result.candidates:[];
  const strmReports=Array.isArray(result?.strmResolution?.reports)?result.strmResolution.reports:[];
  const matchedFeeds=reports.filter(report=>Number(report?.count||0)>0).length;
  const strmResolved=Number(result?.strmResolution?.resolved||0),strmRejected=Number(result?.strmResolution?.rejected||0);
  if(count)count.textContent=`${reports.length} feed${reports.length===1?'':'s'} scanned · ${matchedFeeds} matched · ${candidates.length} unique candidate${candidates.length===1?'':'s'}${strmReports.length?` · STRM ${strmResolved} resolved/${strmRejected} rejected`:''}`;
  if(!reports.length&&!candidates.length&&!strmReports.length){empty(box,`Δεν επέστρεψαν curated feed reports για ${name}.`);return;}
  for(const report of reports){
    const row=document.createElement('div');row.className='hunt-result';
    const meta=document.createElement('div'),strong=document.createElement('strong'),detail=document.createElement('span');
    strong.textContent=report.feed||'Curated feed';
    const status=Number(report.status||0);const bits=[report.tier||'primary',report.format||'m3u',status?`HTTP ${status}`:'fetch failed',`${Number(report.count||0)} match${Number(report.count||0)===1?'':'es'}`];
    if(Number.isFinite(report.elapsedMs))bits.push(`${report.elapsedMs} ms`);if(report.error)bits.push(report.error);
    detail.textContent=bits.join(' · ');meta.append(strong,detail);row.append(meta);box.appendChild(row);
  }
  for(const report of strmReports){
    const row=document.createElement('div');row.className='hunt-result';
    const meta=document.createElement('div'),strong=document.createElement('strong'),detail=document.createElement('span'),code=document.createElement('code');
    strong.textContent=report.resolved?'STRM resolved ✓':'STRM rejected';
    const bits=[];
    if(report.status)bits.push(`HTTP ${report.status}`);
    if(report.sourceType)bits.push(String(report.sourceType).toUpperCase());
    if(Array.isArray(report.requiredHeaders)&&report.requiredHeaders.length)bits.push(`headers: ${report.requiredHeaders.join(' + ')}`);
    if(report.chainLength)bits.push(`chain ${report.chainLength}`);
    if(report.drmDetected)bits.push('DRM');
    if(report.error)bits.push(report.error);
    detail.textContent=bits.join(' · ')||'STRM resolution report';
    code.textContent=report.resolvedUrl||report.reference||'';
    meta.append(strong,detail,code);row.append(meta);box.appendChild(row);
  }
  const seen=new Set();
  for(const item of candidates){
    const url=String(item?.sourceUrl||'').trim();if(!/^https?:\/\//i.test(url)||seen.has(url))continue;seen.add(url);
    box.appendChild(candidateCard({
      url,
      origin:item.sourceOrigin||'Curated feed',
      title:`Curated · ${item.sourceType||'stream'}`,
      sourceType:item.sourceType||'',
      provenance:item.discoveryProvider||'curated-remote-feeds',
      updatedAt:item.discoveredAt||null,
      requiredHeaders:item.requiredHeaders||{},
      resolvedFrom:item.resolvedFrom||'',
      verificationDetail:item.verificationDetail||'',
    },name,'Curated'));
  }
}
async function inspectLead(item,name,label,button){
  const original=button.textContent;button.disabled=true;button.textContent='Inspecting…';
  try{
    const url=`${endpoint()}/inspect?channel=${encodeURIComponent(name)}&url=${encodeURIComponent(item.url)}`;
    const r=await fetch(url,{cache:'no-store'});
    const j=await r.json();
    if(!r.ok)throw new Error(j?.error||`Worker ${r.status}`);
    const found=j.candidates||[];
    if(found.length){
      const best=found[0];
      const testValue=candidateTestValue(best);
      if(candidateInput)candidateInput.value=testValue;
      candidateInput?.dispatchEvent(new Event('input',{bubbles:true}));
      const headerNames=Object.keys(safeHeaders(best.requiredHeaders||{}));
      log(`LEAD INSPECT ${name} · ${label} · found ${found.length} · proof ${best.provenance||'unknown'}${headerNames.length?` · headers ${headerNames.join('+')}`:''} · ${best.url}`);
      button.textContent='Testing…';
      button.disabled=true;
      log(`LEAD AUTO-TEST ${name} · ${label} · ${best.url}`);
      testButton?.click();
      setTimeout(()=>{
        button.textContent='Test started';
        button.disabled=false;
        button.onclick=()=>{
          if(candidateInput)candidateInput.value=testValue;
          candidateInput?.dispatchEvent(new Event('input',{bubbles:true}));
          testButton?.click();
          log(`LEAD RE-TEST ${name} · ${label} · ${best.url}`);
        };
      },900);
      return;
    }
    const blocked=j?.blockedReason||j?.issueIntelligence?.rejection||'';
    log(`LEAD INSPECT ${name} · ${label} · no provenance-safe candidate${blocked?` · ${blocked}`:''} · ${item.url}`);
    button.textContent=blocked?`Rejected · ${blocked.replace(/^rejected-/,'')}`:'No stream';
  }catch(error){log(`LEAD INSPECT FAILED ${name} · ${error.message}`);button.textContent='Failed';}
  finally{if(button.textContent==='Inspecting…')button.textContent=original;if(button.textContent!=='Testing…')button.disabled=false;}
}
function renderLeads(boxId,countId,items,name,label){
  const box=$(boxId),count=$(countId);if(!box)return;box.innerHTML='';const seen=new Set();const rows=(items||[]).filter(x=>x?.url&&!seen.has(x.url)&&seen.add(x.url)).slice(0,8);if(count)count.textContent=`${rows.length} lead${rows.length===1?'':'s'}`;if(!rows.length){empty(box,`Δεν βρέθηκαν ${label} leads για ${name}.`);return;}
  for(const item of rows){const card=document.createElement('div');card.className='hunt-result';const meta=document.createElement('div'),strong=document.createElement('strong'),detail=document.createElement('span'),code=document.createElement('code');strong.textContent=item.origin||label;detail.textContent=metaText(item)||'Source page';code.textContent=item.url;meta.append(strong,detail,code);const inspect=document.createElement('button');inspect.className='button';inspect.type='button';inspect.textContent=item.autoTestEligible===false?'Inspect rejected':'Inspect';inspect.addEventListener('click',()=>inspectLead(item,name,label,inspect));card.append(meta,inspect);box.appendChild(card);}
}
async function huntWorker(name){
  const url=`${endpoint()}/hunt?channel=${encodeURIComponent(name)}&days=${FRESH_DAYS}`;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);try{const r=await fetch(url,{cache:'no-store',signal:controller.signal});if(!r.ok){let detail='';try{detail=(await r.json())?.error||'';}catch{}throw new Error(`Web Worker ${r.status}${detail?` · ${detail}`:''}`);}return await r.json();}finally{clearTimeout(timer);}
}
async function runExternal(){
  const name=channelNameEl?.textContent?.trim();if(!name||name==='Επίλεξε κανάλι')return;const status=$('hunt-external-status');if(status)status.textContent=`Searching Curated + Seeds + Web + Reddit / Forums for ${name}…`;log(`RUN EXTERNAL HUNT ${name} · curated feed visibility + candidate metadata · ${FRESH_DAYS}d`);
  try{
    const [workerResult,curatedResult]=await Promise.allSettled([
      huntWorker(name),
      discoverCuratedRemoteFeeds(selectedChannel(name),{freshness:'30d'}),
    ]);
    if(workerResult.status==='fulfilled'){
      const result=workerResult.value,groups=result.groups||{seed:[],web:[],forums:[],webLeads:[],forumLeads:[]};
      renderGroup('hunt-seed-results','hunt-seed-count',groups.seed,name,'Seed');renderGroup('hunt-web-results','hunt-web-count',groups.web,name,'Fresh Web');renderLeads('hunt-web-leads','hunt-web-lead-count',groups.webLeads,name,'Web');renderGroup('hunt-forum-results','hunt-forum-count',groups.forums,name,'Forum / Reddit');renderLeads('hunt-forum-leads','hunt-forum-lead-count',groups.forumLeads,name,'Forum / Reddit');
    }else{
      renderGroup('hunt-seed-results','hunt-seed-count',[],name,'Seed');renderGroup('hunt-web-results','hunt-web-count',[],name,'Fresh Web');renderLeads('hunt-web-leads','hunt-web-lead-count',[],name,'Web');renderGroup('hunt-forum-results','hunt-forum-count',[],name,'Forum / Reddit');renderLeads('hunt-forum-leads','hunt-forum-lead-count',[],name,'Forum / Reddit');
    }
    if(curatedResult.status==='fulfilled')renderCurated(curatedResult.value,name);else{renderCurated({reports:[],candidates:[]},name);const c=$('hunt-curated-count');if(c)c.textContent=`Curated failed · ${curatedResult.reason?.message||curatedResult.reason||'unknown error'}`;}
    const result=workerResult.status==='fulfilled'?workerResult.value:{},c=result.counts||{},cacheText=result.cached?'cache hit':'fresh scan',subreq=Number.isFinite(result.subrequestsUsed)?` · ${result.subrequestsUsed}/${result.subrequestBudget} subreq`:'',elapsed=Number.isFinite(result.elapsedMs)?` · ${result.elapsedMs} ms`:'';
    const curated=curatedResult.status==='fulfilled'?curatedResult.value:null;const strm=curated?.strmResolution;const feedText=curated?`Curated ${curated.reports?.length||0} feeds/${curated.candidates?.length||0} candidates${strm?.attempted?` · STRM ${strm.resolved||0}/${strm.attempted||0}`:''}`:'Curated failed';
    if(status)status.textContent=`${feedText} · Seeds ${c.seed||0} · Web ${c.web||0}+${c.webLeads||0} leads · Forums ${c.forums||0}+${c.forumLeads||0} leads · ${cacheText}${subreq}${elapsed}`;
    log(`EXTERNAL HUNT DONE ${name} · ${feedText} · Seeds ${c.seed||0} · Web ${c.web||0}/${c.webLeads||0} leads · Forums ${c.forums||0}/${c.forumLeads||0} leads · ${cacheText}${subreq}${elapsed}`);
  }catch(error){const msg=error?.name==='AbortError'?'Worker timeout after 30s':error.message;if(status)status.textContent=`Worker failed · ${msg}`;log(`EXTERNAL HUNT FAILED ${name} · ${msg}`);}
}
ensureUi();$('run-hunt')?.addEventListener('click',runExternal);log(`Source Hunt external UI loaded · build ${BUILD_ID} · headers + STRM provenance preserved into playback tests`);
