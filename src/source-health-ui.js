import { CONFIG } from './config.js?v=20260922-2115';
import { cleanUrl, isHls, workerUrl } from './core/utils.js?v=20260920-1021';

const BUILD_ID = '20260923-0715';
const $ = id => document.getElementById(id);

function loadHealthMap(){
  try{return JSON.parse(localStorage.getItem(CONFIG.healthStorageKey) || '{}');}
  catch{return{};}
}

function fmtWhen(ts){
  if(!ts) return '—';
  const diff = Date.now() - Number(ts);
  if(diff < 60_000) return 'now';
  if(diff < 3_600_000) return `${Math.max(1,Math.round(diff/60_000))}m ago`;
  if(diff < 86_400_000) return `${Math.max(1,Math.round(diff/3_600_000))}h ago`;
  return `${Math.max(1,Math.round(diff/86_400_000))}d ago`;
}

function pct(entry){
  const total = Number(entry?.success || 0) + Number(entry?.fail || 0);
  return total ? Math.round((Number(entry.success || 0) / total) * 100) : null;
}

function routeRows(channel){
  const map = loadHealthMap();
  const out = [];
  const seen = new Set();
  for(const raw of channel?.directUrls || []){
    const source = cleanUrl(raw);
    if(!source) continue;
    const candidates = [];
    if(/^https:\/\//i.test(source)) candidates.push({kind:'direct',playbackUrl:source});
    if(isHls(source) && CONFIG.workerForHls) candidates.push({kind:'worker',playbackUrl:workerUrl(source)});
    for(const route of candidates){
      if(seen.has(route.playbackUrl)) continue;
      seen.add(route.playbackUrl);
      const entry = map[cleanUrl(route.playbackUrl)] || null;
      out.push({source,...route,entry});
    }
  }
  return out;
}

function ensureUi(){
  const diagnostics = $('diagnostics');
  if(!diagnostics || $('source-health')) return;
  const section = document.createElement('section');
  section.id = 'source-health';
  section.className = 'source-health';
  section.innerHTML = `
    <div class="source-health-head">
      <div><p class="eyebrow">SOURCE INTELLIGENCE</p><h3>Route health</h3></div>
      <span id="source-health-summary" class="freshness-badge">No channel</span>
    </div>
    <div id="source-health-list" class="source-health-list"></div>`;
  const log = $('diagnostic-log');
  diagnostics.insertBefore(section, log || null);
}

function emptyMessage(list,text){
  list.innerHTML='';
  const empty=document.createElement('div');
  empty.className='source-health-empty';
  empty.textContent=text;
  list.appendChild(empty);
}

function metric(text){
  const span=document.createElement('span');
  span.textContent=text;
  return span;
}

function render(){
  const summary = $('source-health-summary');
  const list = $('source-health-list');
  if(!summary || !list) return;
  const channel = window.WebTVPlaylistAPI?.getSelectedChannel?.();
  if(!channel){
    summary.textContent = 'No channel';
    emptyMessage(list,'Select a channel to inspect its curated D1 routes.');
    return;
  }

  const rows = routeRows(channel);
  const tested = rows.filter(r => r.entry && (Number(r.entry.success||0)+Number(r.entry.fail||0)) > 0);
  const cooling = rows.filter(r => Number(r.entry?.cooldownUntil || 0) > Date.now());
  const speeds = tested.map(r => Number(r.entry?.avgStartupMs || 0)).filter(Boolean);
  const avg = speeds.length ? Math.round(speeds.reduce((a,b)=>a+b,0)/speeds.length) : 0;
  summary.textContent = `${tested.length}/${rows.length} tested${cooling.length?` · ${cooling.length} cooling`:''}${avg?` · ${avg} ms avg`:''}`;
  list.innerHTML = '';

  if(!rows.length){
    emptyMessage(list,'No curated D1 source routes for this channel.');
    return;
  }

  for(const row of rows){
    const entry = row.entry || {};
    const attempts = Number(entry.success||0)+Number(entry.fail||0);
    const successPct = pct(entry);
    const coolingNow = Number(entry.cooldownUntil||0) > Date.now();
    const status = !attempts ? 'Untested' : coolingNow ? 'Cooldown' : successPct >= 80 ? 'Strong' : successPct >= 50 ? 'Mixed' : 'Weak';

    const item = document.createElement('div');
    item.className = `source-health-row${coolingNow?' cooling':''}`;

    const main=document.createElement('div');
    main.className='source-health-main';
    const title=document.createElement('strong');
    title.textContent=`${row.kind.toUpperCase()} · ${status}`;
    const code=document.createElement('code');
    code.textContent=row.source;
    code.title=row.source;
    main.append(title,code);

    const metrics=document.createElement('div');
    metrics.className='source-health-metrics';
    metrics.append(
      metric(`${successPct === null ? '—' : `${successPct}%`} success`),
      metric(`${attempts} tries`),
      metric(`${entry.avgStartupMs ? `${entry.avgStartupMs} ms` : '—'} startup`),
      metric(`last OK ${fmtWhen(entry.lastSuccess)}`)
    );

    item.append(main,metrics);
    list.appendChild(item);
  }
}

ensureUi();
window.addEventListener('webtv:ready', render);
const channelName = $('channel-name');
if(channelName) new MutationObserver(render).observe(channelName,{childList:true,characterData:true,subtree:true});
const diagPlayer = $('diag-player');
if(diagPlayer) new MutationObserver(render).observe(diagPlayer,{childList:true,characterData:true,subtree:true});
setInterval(render, 5000);
render();
console.info(`[WebTV] Source health UI loaded · build ${BUILD_ID}`);
