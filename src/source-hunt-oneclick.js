import { saveBestSourceToCurrent } from './source-save-policy.js';
import { officialFallbackFor } from './core/official-fallbacks.js';
import { channelMatchScore, canonicalGreekChannelName, makeSyntheticChannel } from './channel-identity-gr.js';
import { showSaveDestination } from './source-hunt-save-destination.js';

const BUILD_ID = '20260928-oneclick-all-discovery-lanes';
const $ = id => document.getElementById(id);
const panel = $('source-hunt');
const diagLog = $('diagnostic-log');
const MAX_PLAYBACK_TESTS = 16;
let queryDirty=false;

function log(message){if(!diagLog)return;const stamp=new Date().toLocaleTimeString();diagLog.textContent=`[${stamp}] ${message}\n${diagLog.textContent}`.slice(0,18000);}
function clean(value=''){return String(value||'').split('#')[0].trim();}
function selectedChannel(){return window.WebTVPlaylistAPI?.getSelectedChannel?.()||null;}
function playbackApi(){return window.WebTVPlaybackAPI||null;}
function huntQuery(){return clean($('hunt-query')?.value)||selectedChannel()?.name||'';}
function huntMode(){return $('hunt-match-mode')?.value||'exact';}
function selectedMatchesQuery(){const selected=selectedChannel();if(!selected)return false;return canonicalGreekChannelName(selected.name)===canonicalGreekChannelName(huntQuery());}
function currentOfficialFallback(){const selected=selectedChannel();return selected&&selectedMatchesQuery()?officialFallbackFor(selected):null;}
function directCandidateTester(){if(!panel)return null;return [...panel.children].find(node=>node.classList?.contains('candidate-tester'))||null;}
function compactFailure(value=''){const text=String(value||'').replace(/\s+/g,' ').trim();return text.length>150?`${text.slice(0,147)}…`:text;}
function safeHeaders(headers={}){const out={};if(!headers||typeof headers!=='object')return out;for(const [rawKey,rawValue] of Object.entries(headers)){const key=String(rawKey||'').trim().toLowerCase(),value=String(rawValue||'').trim();if(!value||/[\r\n\0]/.test(value))continue;if(key==='user-agent'||key==='user_agent'||key==='useragent')out['User-Agent']=value;else if(key==='referer'||key==='referrer')out.Referer=value;else if(key==='origin')out.Origin=value;}return out;}
function testValueFor(url,headers={}){const cleanUrl=String(url||'').trim();const entries=Object.entries(safeHeaders(headers));if(!cleanUrl||!entries.length)return cleanUrl;const params=new URLSearchParams();for(const [key,value] of entries)params.set(key,value);return `${cleanUrl}|${params.toString()}`;}

function ensureSearchUi(){
  if(!panel||$('hunt-search-box'))return;
  const heading=panel.querySelector('.section-heading');if(!heading)return;
  const wrap=document.createElement('div');wrap.id='hunt-search-box';wrap.className='hunt-oneclick-wrap';
  wrap.innerHTML=`<input id="hunt-query" type="search" placeholder="Search channel / provider e.g. ANT1 Comedy, Nova" autocomplete="off"><select id="hunt-match-mode" aria-label="Search mode"><option value="exact">Exact channel</option><option value="broad">Broad / family</option></select>`;
  heading.appendChild(wrap);
  const input=$('hunt-query');
  const selected=selectedChannel();if(selected)input.value=selected.name;
  input.addEventListener('input',()=>{queryDirty=true;});
  input.addEventListener('keydown',e=>{if(e.key==='Enter')$('hunt-oneclick')?.click();});
  const name=$('channel-name');if(name)new MutationObserver(()=>{if(queryDirty)return;const selected=selectedChannel();if(selected&&input)input.value=selected.name;}).observe(name,{childList:true,characterData:true,subtree:true});
}
function ensureAdvancedUi(){
  if(!panel)return;let details=$('hunt-advanced');if(!details){details=document.createElement('details');details.id='hunt-advanced';details.className='hunt-advanced';const summary=document.createElement('summary');summary.textContent='Advanced stream results';const hint=document.createElement('span');hint.className='muted small';hint.textContent='Detailed candidates and diagnostics from all Source Hunt lanes';details.append(summary,hint);const tester=directCandidateTester();if(tester&&tester.parentElement===panel)panel.insertBefore(details,tester);else panel.appendChild(details);}for(const id of ['hunt-auto','hunt-external']){const node=$(id);if(node&&node!==details&&node.parentElement!==details)details.appendChild(node);}}
function ensureUi(){
  const runHuntButton=$('run-hunt');if(!panel||!runHuntButton)return false;ensureSearchUi();if(!$('hunt-oneclick')){const heading=panel.querySelector('.section-heading');if(!heading)return false;const wrap=document.createElement('div');wrap.className='hunt-oneclick-wrap';wrap.innerHTML=`<button id="hunt-oneclick" class="button hunt-primary" type="button">Find & Test Best</button><span id="hunt-oneclick-status" class="hunt-oneclick-status">Ready · searches every available lane · real playback decides</span>`;heading.appendChild(wrap);}ensureAdvancedUi();const button=$('hunt-oneclick');if(button&&button.dataset.oneclickBound!=='1'){button.dataset.oneclickBound='1';button.addEventListener('click',runOneClick);}return true;
}
function candidateMatchesText(text,query,mode){if(!query)return true;return channelMatchScore(text||'',query,mode)>0;}
function candidateMatches(node,query,mode){const card=node?.closest?.('.hunt-result');return candidateMatchesText(card?.dataset?.channelName||card?.textContent||node?.textContent||'',query,mode);}
function collectLegacyCandidates(){
  const query=huntQuery(),mode=huntMode();const selectors=['#hunt-results code','#hunt-curated-results code','#hunt-seed-results code','#hunt-web-results code','#hunt-forum-results code'];const seen=new Set(),items=[];
  for(const selector of selectors)for(const node of document.querySelectorAll(selector)){const card=node.closest('.hunt-result');if(card?.querySelector('button')===null&&selector.includes('curated'))continue;const value=clean(node.textContent);const url=value.split('|')[0].trim();if(!/^https?:\/\//i.test(url)||seen.has(value))continue;if(!candidateMatches(node,query,mode)){card?.setAttribute('data-identity-rejected','1');continue;}seen.add(value);items.push({testValue:value,sourceUrl:url,sourceType:/\.mpd(?:[?#]|$)/i.test(url)?'dash':'hls',origin:'legacy-source-hunt',verificationStatus:'UNVERIFIED',verified:false});}return items;
}
function collectCandidateUrls(){return collectLegacyCandidates().map(item=>item.testValue);}
function waitForLegacyDiscovery({maxMs=32000,quietMs=1800,minMs=4500}={}){return new Promise(resolve=>{const roots=[$('hunt-auto'),$('hunt-external')].filter(Boolean);const startedAt=Date.now();let quietTimer=null,done=false;const finish=()=>{if(done)return;done=true;clearTimeout(quietTimer);clearTimeout(maxTimer);observer.disconnect();resolve(collectLegacyCandidates());};const schedule=()=>{clearTimeout(quietTimer);quietTimer=setTimeout(()=>{const elapsed=Date.now()-startedAt,items=collectLegacyCandidates();if(items.length&&elapsed>=minMs)finish();else if(items.length)quietTimer=setTimeout(finish,Math.max(0,minMs-elapsed));},quietMs);};const observer=new MutationObserver(schedule);roots.forEach(root=>observer.observe(root,{childList:true,subtree:true,characterData:true}));const maxTimer=setTimeout(finish,maxMs);schedule();});}
async function waitForDiscoveryApi(maxMs=6000){const started=Date.now();while(Date.now()-started<maxMs){if(window.WebTVDiscovery?.snapshot)return window.WebTVDiscovery;await new Promise(resolve=>setTimeout(resolve,80));}return null;}
function discoveryCandidateUsable(item={}){const type=String(item.sourceType||'').toLowerCase();const kind=String(item.candidateKind||'').toLowerCase();return /^https?:\/\//i.test(String(item.sourceUrl||''))&&!['rtsp','rtmp'].includes(type)&&!['official-page','official-embed'].includes(kind);}
function collectDiscoveryCandidates(api,query,mode){const snapshot=api?.snapshot?.();if(!snapshot)return[];const items=[];for(const item of snapshot.candidates||[]){if(!discoveryCandidateUsable(item))continue;const identity=String(item.channelName||snapshot.channel?.name||'');if(identity&&!candidateMatchesText(identity,query,mode))continue;items.push({...item,testValue:testValueFor(item.sourceUrl,item.requiredHeaders||{}),origin:item.discoveryProvider||item.sourceOrigin||'discovery'});}return items;}
function candidateRank(item={}){let score=0;if(item.verified===true||item.verificationStatus==='VERIFIED')score+=100;const type=String(item.sourceType||'').toLowerCase();if(type==='hls')score+=30;else if(type==='dash')score+=25;else if(type==='xtream'||type==='xtream-preview')score+=28;else score+=10;const origin=String(item.origin||item.discoveryProvider||'');if(/authorized-xtream|new-xtream-preview/.test(origin))score+=18;if(/official/.test(origin))score+=16;if(/curated/.test(origin))score+=12;if(/local|my-playlist|saved/.test(origin))score+=10;if(Object.keys(safeHeaders(item.requiredHeaders||{})).length)score+=4;if(['FAILED','TIMEOUT','HTTP 403','HTTP 404','DRM','UNRESOLVED'].includes(String(item.verificationStatus||'')))score-=12;return score;}
function mergeCandidates(...groups){const map=new Map();for(const item of groups.flat()){const key=String(item.testValue||testValueFor(item.sourceUrl,item.requiredHeaders||{})).trim();if(!key||!/^https?:\/\//i.test(key.split('|')[0]))continue;const current=map.get(key);const normalized={...item,testValue:key};if(!current||candidateRank(normalized)>candidateRank(current))map.set(key,normalized);}return [...map.values()].sort((a,b)=>candidateRank(b)-candidateRank(a));}
async function runDiscoveryLanes(api,status,canonical){if(!api)return[];const selected=selectedChannel();if(!selectedMatchesQuery()){log(`ONE-CLICK DISCOVERY ${canonical} · integrated lanes skipped for free search because Discovery is bound to selected channel ${selected?.name||'-'}`);return[];}api.open?.();const lanes=[['Local',api.scanLocal],['Curated',api.scanExternal],['GitHub',api.scanGithub],['Recent Web',api.scanRecentWeb],['STRM',api.scanStrm],['Official',api.scanOfficial],['Authorized Xtream',api.scanAuthorizedXtream]];for(let i=0;i<lanes.length;i++){const [label,run]=lanes[i];if(typeof run!=='function')continue;status.textContent=`Searching ${label} · ${i+1}/${lanes.length}`;log(`ONE-CLICK LANE START ${canonical} · ${label}`);try{await run();const snap=api.snapshot?.();log(`ONE-CLICK LANE DONE ${canonical} · ${label} · ${snap?.candidates?.length||0} accumulated candidate(s)`);}catch(error){log(`ONE-CLICK LANE FAILED ${canonical} · ${label} · ${compactFailure(error?.message||error)}`);}}
  status.textContent='Verifying discovered media candidates…';try{await api.verifyAll?.();}catch(error){log(`ONE-CLICK VERIFY ALL FAILED ${canonical} · ${compactFailure(error?.message||error)}`);}return collectDiscoveryCandidates(api,huntQuery(),huntMode());}
async function restoreSelectedPlayback(){const api=playbackApi();if(api?.replaySelected)return api.replaySelected();return null;}
function useOfficialFallback(status,channelName,reason){const fallback=currentOfficialFallback();if(!fallback)return false;status.textContent=`${reason} · ${fallback.label||'Official fallback'}`;log(`ONE-CLICK FALLBACK ${channelName} · ${reason} · ${fallback.route||'official-fallback'} · not saved to D1`);restoreSelectedPlayback().catch(error=>log(`ONE-CLICK FALLBACK restore failed · ${error.message}`));return true;}
function fireUnderlyingHunt(query){const button=$('run-hunt');const header=$('channel-name');if(!button)return;const original=header?.textContent||'';const selected=selectedChannel();const free=!!query&&(!selected||canonicalGreekChannelName(query)!==canonicalGreekChannelName(selected.name));if(free&&header)header.textContent=query;button.click();if(free&&header)setTimeout(()=>{header.textContent=original;},120);}

async function runOneClick(){
  const runHuntButton=$('run-hunt'),button=$('hunt-oneclick'),status=$('hunt-oneclick-status');const selected=selectedChannel();const query=huntQuery();const canonical=canonicalGreekChannelName(query);const freeSearch=!selectedMatchesQuery();const channel=freeSearch?makeSyntheticChannel(query):selected;const player=playbackApi();
  if(!button||!status||!runHuntButton)return;if(!query){status.textContent='Type a channel or select one first';return;}if(!player?.testCandidate){status.textContent='Playback API unavailable';return;}
  button.disabled=true;window.WebTVSourceHuntBusy=true;status.textContent=`Searching every lane for ${canonical}…`;log(`ONE-CLICK HUNT START ${canonical} · mode ${huntMode()} · ${freeSearch?'free search':'selected channel'} · all lanes`);
  try{
    document.getElementById('hunt-save-destination')?.remove();document.querySelectorAll('#hunt-results,#hunt-curated-results,#hunt-seed-results,#hunt-web-results,#hunt-forum-results').forEach(el=>{el.innerHTML='';});
    fireUnderlyingHunt(query);
    const discoveryApi=await waitForDiscoveryApi();
    const [legacyItems,discoveryItems]=await Promise.all([waitForLegacyDiscovery(),runDiscoveryLanes(discoveryApi,status,canonical)]);
    const candidates=mergeCandidates(discoveryItems,legacyItems);
    if(!candidates.length){if(!freeSearch&&useOfficialFallback(status,canonical,'No identity-matched stream candidate'))return;status.textContent=`No identity-matched stream candidates for ${canonical}`;log(`ONE-CLICK HUNT ${canonical} · no identity-matched candidates across all lanes`);return;}
    const limit=Math.min(candidates.length,MAX_PLAYBACK_TESTS);status.textContent=`${candidates.length} unique candidates · real playback testing best ${limit}…`;log(`ONE-CLICK MERGED ${canonical} · discovery ${discoveryItems.length} · legacy ${legacyItems.length} · unique ${candidates.length} · playback limit ${limit}`);let lastFailure='';
    for(let i=0;i<limit;i++){
      const item=candidates[i],value=item.testValue||item.sourceUrl,url=String(item.sourceUrl||value).split('|')[0];status.textContent=`Testing real playback ${i+1}/${limit} · ${item.origin||item.sourceType||'candidate'}`;log(`ONE-CLICK TEST ${canonical} · ${i+1}/${limit} · ${item.origin||'-'} · verifier ${item.verificationStatus||'unknown'} · ${url}`);let result=null;
      try{result=await player.testCandidate(value,{channel});}
      catch(error){lastFailure=compactFailure(error?.message||error);status.textContent=`Stream ${i+1}/${limit} failed · ${lastFailure}`;log(`ONE-CLICK TEST FAILED ${canonical} · ${url} · ${lastFailure}`);continue;}
      if(!result?.ok||result?.fallback){lastFailure=compactFailure(result?.error||result?.detail||result?.verificationDetail||'Candidate did not produce verified stream playback');status.textContent=`Stream ${i+1}/${limit} failed · ${lastFailure}`;log(`ONE-CLICK TEST REJECTED ${canonical} · ${url} · ${lastFailure}`);continue;}
      if(freeSearch){status.textContent=`Working stream ✓ ${result.startupMs||0} ms · choose where to save`;await showSaveDestination({channel:{...channel,name:canonical},url});log(`ONE-CLICK FREE RESULT ${canonical} · winner ${url} · origin ${item.origin||'-'} · waiting for save destination`);return;}
      if(String(item.sourceType||'')==='xtream-preview'){status.textContent=`Working Xtream preview ✓ ${result.startupMs||0} ms · use its explicit channel/account choice below`;log(`ONE-CLICK XTREAM PREVIEW WINNER ${canonical} · ${url} · explicit persistence choice required`);return;}
      status.textContent=`Working stream ✓ ${result.startupMs||0} ms · saving best…`;
      try{const saved=await saveBestSourceToCurrent(url,{maxSources:3});status.textContent=`Best stream saved ✓ · ${saved.kept.length}/3 kept`;log(`ONE-CLICK SUCCESS ${canonical} · winner ${url} · origin ${item.origin||'-'} · kept ${saved.kept.length}`);}catch(error){status.textContent=`Working stream ✓ ${result.startupMs||0} ms · save failed`;log(`ONE-CLICK SAVE FAILED ${canonical} · ${url} · ${error.message}`);}return;
    }
    const finalReason=lastFailure?` · last failure: ${lastFailure}`:'';
    if(!freeSearch&&useOfficialFallback(status,canonical,`No working stream in best ${limit}${finalReason}`))return;status.textContent=`No working identity-matched stream in best ${limit}${finalReason}`;if(!freeSearch)await restoreSelectedPlayback();
  }catch(error){if(!freeSearch&&useOfficialFallback(status,canonical,`Stream hunt failed: ${error.message}`))return;status.textContent=`Failed · ${error.message}`;log(`ONE-CLICK ERROR ${canonical} · ${error.message}`);if(!freeSearch)await restoreSelectedPlayback().catch(()=>{});}finally{window.WebTVSourceHuntBusy=false;button.disabled=false;}
}

if(!ensureUi()){const observer=new MutationObserver(()=>{if(ensureUi())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>{ensureUi();observer.disconnect();},5000);}window.addEventListener('webtv:ready',ensureUi);window.WebTVSourceHuntQuery={get:huntQuery,getMode:huntMode,resetToSelected(){queryDirty=false;const s=selectedChannel();if($('hunt-query'))$('hunt-query').value=s?.name||'';}};console.info(`[WebTV] One-click Source Hunt loaded · build ${BUILD_ID} · all discovery lanes + verifier signals + real playback winner`);
