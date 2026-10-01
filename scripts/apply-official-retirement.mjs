import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}
function replaceRequired(path,from,to){
  const text=read(path);
  if(!text.includes(from))throw new Error(`Required text not found in ${path}: ${from.slice(0,120)}`);
  write(path,text.replace(from,to));
}
function replaceRegexRequired(path,replacementRegex,to){
  const text=read(path);
  if(!replacementRegex.test(text))throw new Error(`Required pattern not found in ${path}: ${replacementRegex}`);
  replacementRegex.lastIndex=0;
  write(path,text.replace(replacementRegex,to));
}
function removeIfPresent(path){if(fs.existsSync(path))fs.rmSync(path);}

// Source Discovery Worker: remove Official provider imports, dispatch, status and exports.
replaceRegexRequired('workers/webtv-source-discovery.js',/^import \{ OFFICIAL_PROVIDER_LANE, discoverOfficialProvider \} from '\.\/source-discovery\/official-provider-lane\.js';\n/m,'');
replaceRegexRequired('workers/webtv-source-discovery.js',/^import \{ OFFICIAL_API_RESOLVER_PROVIDER, discoverOfficialApi \} from '\.\/source-discovery\/official-api-resolver\.js';\n/m,'');
replaceRegexRequired(
  'workers/webtv-source-discovery.js',
  /\n  if\(provider===OFFICIAL_PROVIDER_LANE\)\{[\s\S]*?\n  \}\n  if\(provider===OFFICIAL_API_RESOLVER_PROVIDER\)\{[\s\S]*?\n  \}\n  return json\(\{error:'Unsupported provider'\},400\);/,
  "\n  return json({error:'Unsupported provider'},400);"
);
replaceRegexRequired('workers/webtv-source-discovery.js',/^\s*\[OFFICIAL_PROVIDER_LANE\]:.*\n/m,'');
replaceRegexRequired('workers/webtv-source-discovery.js',/^\s*\[OFFICIAL_API_RESOLVER_PROVIDER\]:.*\n/m,'');
replaceRequired('workers/webtv-source-discovery.js',', OFFICIAL_PROVIDER_LANE, OFFICIAL_API_RESOLVER_PROVIDER, FETCH_TIMEOUT_MS',', FETCH_TIMEOUT_MS');

// Browser external discovery client: retained providers only. External payloads never arrive trusted/verified.
write('src/discovery/external-discovery-client.js',`import { createCandidate } from './candidate-model.js';

export const DISCOVERY_ENDPOINT='https://webtv-source-discovery.atonis.workers.dev';
export const CURATED_REMOTE_FEEDS_PROVIDER='curated-remote-feeds';
export const GITHUB_PUBLIC_PLAYLISTS_PROVIDER='github-public-playlists';
export const RECENT_WEB_SEARCH_PROVIDER='recent-web-search';
export const STRM_SPECIFIC_DISCOVERY_PROVIDER='strm-specific-discovery';
export const EXTERNAL_DISCOVERY_TIMEOUT_MS=9000;
export const PROVIDER_FLAGS=Object.freeze({
  [CURATED_REMOTE_FEEDS_PROVIDER]:true,
  [GITHUB_PUBLIC_PLAYLISTS_PROVIDER]:true,
  [RECENT_WEB_SEARCH_PROVIDER]:true,
  [STRM_SPECIFIC_DISCOVERY_PROVIDER]:true,
});

function timeoutSignal(parentSignal,timeoutMs=EXTERNAL_DISCOVERY_TIMEOUT_MS){
  const controller=new AbortController();
  let timer=null;
  const abort=reason=>{if(!controller.signal.aborted)controller.abort(reason);};
  if(parentSignal){
    if(parentSignal.aborted)abort(parentSignal.reason||new DOMException('aborted','AbortError'));
    else parentSignal.addEventListener('abort',()=>abort(parentSignal.reason||new DOMException('aborted','AbortError')),{once:true});
  }
  timer=setTimeout(()=>abort(new DOMException('External discovery timed out','TimeoutError')),timeoutMs);
  return {signal:controller.signal,clear:()=>clearTimeout(timer)};
}
function normalizeCandidate(_provider,item,channel){
  return createCandidate({
    ...item,
    channelName:item.channelName||channel.name,
    verificationStatus:'UNVERIFIED',
    verified:false,
  });
}
function publicChannelRequest(channel={}){
  const request={
    id:String(channel.id||''),
    originalId:String(channel.originalId||''),
    name:String(channel.name||''),
    tvgId:String(channel.tvgId||''),
  };
  if(channel.familyQuery===true){
    request.familyQuery=true;
    const aliases=Array.isArray(channel.familyAliases)?channel.familyAliases.map(value=>String(value||'').trim()).filter(Boolean).slice(0,12):[];
    if(aliases.length)request.familyAliases=aliases;
  }
  return request;
}
async function discoverProvider(provider,channel,{freshness='7d',endpoint=DISCOVERY_ENDPOINT,fetchImpl=fetch,signal,timeoutMs=EXTERNAL_DISCOVERY_TIMEOUT_MS}={}){
  if(!PROVIDER_FLAGS[provider])return {provider,disabled:true,candidates:[],reports:[]};
  if(!channel?.name)throw new Error('A selected channel is required');
  const timed=timeoutSignal(signal,timeoutMs);
  try{
    const response=await fetchImpl(\`${'${String(endpoint).replace(/\\/$/,\'\')}'}/discover\`,{
      method:'POST',headers:{'content-type':'application/json'},signal:timed.signal,
      body:JSON.stringify({provider,freshness,channel:publicChannelRequest(channel)}),
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload?.error||\`Discovery HTTP ${'${response.status}'}\`);
    const candidates=(payload?.candidates||[]).map(item=>normalizeCandidate(provider,item,channel));
    return {...payload,candidates};
  } finally {timed.clear();}
}

export function discoverCuratedRemoteFeeds(channel,options={}){return discoverProvider(CURATED_REMOTE_FEEDS_PROVIDER,channel,options);}
export function discoverGithubPublicPlaylists(channel,options={}){return discoverProvider(GITHUB_PUBLIC_PLAYLISTS_PROVIDER,channel,options);}
export function discoverRecentWebSearch(channel,options={}){return discoverProvider(RECENT_WEB_SEARCH_PROVIDER,channel,options);}
export function discoverStrmSpecific(channel,options={}){return discoverProvider(STRM_SPECIFIC_DISCOVERY_PROVIDER,channel,options);}

export { normalizeCandidate, publicChannelRequest };
`);

// Legacy Discovery state keeps only retained lanes.
write('src/discovery/discovery-state.js',`export const FRESHNESS_OPTIONS = Object.freeze([
  Object.freeze({ id:'24h', label:'24h', days:1 }),
  Object.freeze({ id:'7d', label:'7d', days:7 }),
  Object.freeze({ id:'30d', label:'30d', days:30 }),
]);
export const DEFAULT_FRESHNESS = '7d';

const EMPTY_LANES=Object.freeze({myPlaylist:0,savedPlaylists:0,xtream:0,curatedRemoteFeeds:0,githubPublicPlaylists:0,recentWebSearch:0,strmSpecific:0,authorizedXtream:0,newXtreamPreview:0,total:0});

function uniqueCandidates(items=[]){
  const seen=new Set();const out=[];
  for(const item of items||[]){
    const key=String(item?.sourceUrl||item?.candidateId||'').trim();
    if(!key||seen.has(key))continue;
    seen.add(key);out.push(item);
  }
  return out;
}
function isLocalCandidate(item){return String(item?.discoveryProvider||'').startsWith('local-');}

export class DiscoveryState {
  constructor() {
    this.open=false;this.channel=null;this.freshness=DEFAULT_FRESHNESS;this.candidates=[];this.lanes=EMPTY_LANES;
    this.scanStatus='idle';this.scanMessage='';this.lastScanAt=null;this.externalStatus='idle';this.externalMessage='';this.verifyStatus='idle';this.verifyMessage='';
  }
  setOpen(value){this.open=Boolean(value);return this.open;}
  setChannel(channel){
    this.channel=channel ? {id:String(channel.id||''),originalId:String(channel.originalId||''),name:String(channel.name||''),group:String(channel.group||''),tvgId:String(channel.tvgId||'')} : null;
    this.clearResults();return this.channel;
  }
  setFreshness(value){if (!FRESHNESS_OPTIONS.some(option=>option.id===value)) throw new Error(\`Unsupported freshness: ${'${value}'}\`);this.freshness=value;return this.freshness;}
  setScanning(message='Reading local sources…'){this.scanStatus='loading';this.scanMessage=String(message||'');}
  setScanResult({candidates=[],lanes=EMPTY_LANES,message=''}={}){
    const external=this.candidates.filter(item=>!isLocalCandidate(item));
    this.candidates=uniqueCandidates([...(candidates||[]),...external]);
    this.lanes=Object.freeze({...EMPTY_LANES,...this.lanes,...(lanes||{}),total:this.candidates.length});
    this.scanStatus='done';this.scanMessage=String(message||'');this.lastScanAt=new Date().toISOString();this.verifyStatus='idle';this.verifyMessage='';
  }
  setScanError(message='Local scan failed'){this.scanStatus='error';this.scanMessage=String(message||'Local scan failed');}
  setExternalScanning(message='Searching external providers…'){this.externalStatus='loading';this.externalMessage=String(message||'');}
  mergeExternalResult({provider='curated-remote-feeds',lane='curatedRemoteFeeds',candidates=[],count=null,message=''}={}){
    const retained=this.candidates.filter(item=>String(item?.discoveryProvider||'')!==provider);
    this.candidates=uniqueCandidates([...retained,...(candidates||[])]);
    const externalCount=count===null?(candidates||[]).length:Number(count)||0;
    this.lanes=Object.freeze({...EMPTY_LANES,...this.lanes,[lane]:externalCount,total:this.candidates.length});
    if(this.scanStatus==='idle')this.scanStatus='done';
    this.externalStatus='done';this.externalMessage=String(message||'');this.lastScanAt=new Date().toISOString();this.verifyStatus='idle';this.verifyMessage='';
  }
  setExternalError(message='External discovery failed'){this.externalStatus='error';this.externalMessage=String(message||'External discovery failed');}
  setExternalIdle(message=''){this.externalStatus='idle';this.externalMessage=String(message||'');}
  setVerificationRunning(message='Verifying candidates…'){this.verifyStatus='loading';this.verifyMessage=String(message||'');}
  setVerificationMessage(message='',status='done'){this.verifyStatus=status;this.verifyMessage=String(message||'');}
  replaceCandidate(candidate){const id=String(candidate?.candidateId||'');if(!id)return false;const index=this.candidates.findIndex(item=>String(item?.candidateId||'')===id);if(index<0)return false;this.candidates=[...this.candidates.slice(0,index),candidate,...this.candidates.slice(index+1)];return true;}
  clearResults(){this.candidates=[];this.lanes=EMPTY_LANES;this.scanStatus='idle';this.scanMessage='';this.lastScanAt=null;this.externalStatus='idle';this.externalMessage='';this.verifyStatus='idle';this.verifyMessage='';}
  snapshot(){return Object.freeze({open:this.open,channel:this.channel ? Object.freeze({...this.channel}) : null,freshness:this.freshness,candidates:Object.freeze([...this.candidates]),lanes:this.lanes,scanStatus:this.scanStatus,scanMessage:this.scanMessage,lastScanAt:this.lastScanAt,externalStatus:this.externalStatus,externalMessage:this.externalMessage,verifyStatus:this.verifyStatus,verifyMessage:this.verifyMessage});}
}
`);

// Legacy Discovery shell: remove the Official UI/provider path only.
replaceRequired('src/discovery/discovery-ui.js',
  "import { discoverCuratedRemoteFeeds, discoverGithubPublicPlaylists, discoverRecentWebSearch, discoverStrmSpecific, discoverOfficialProvider, CURATED_REMOTE_FEEDS_PROVIDER, GITHUB_PUBLIC_PLAYLISTS_PROVIDER, RECENT_WEB_SEARCH_PROVIDER, STRM_SPECIFIC_DISCOVERY_PROVIDER, OFFICIAL_PROVIDER_LANE } from './external-discovery-client.js';",
  "import { discoverCuratedRemoteFeeds, discoverGithubPublicPlaylists, discoverRecentWebSearch, discoverStrmSpecific, CURATED_REMOTE_FEEDS_PROVIDER, GITHUB_PUBLIC_PLAYLISTS_PROVIDER, RECENT_WEB_SEARCH_PROVIDER, STRM_SPECIFIC_DISCOVERY_PROVIDER } from './external-discovery-client.js';"
);
replaceRequired('src/discovery/discovery-ui.js',"const BUILD_ID='20260927-discovery-region-aware-official';","const BUILD_ID='20261001-discovery-official-retired';");
replaceRequired('src/discovery/discovery-ui.js','<button id="discovery-scan-official" class="button" type="button">Find Official Sources</button>','');
replaceRequired('src/discovery/discovery-ui.js','Curated, STRM, Official and Xtream lanes are live checks.','Curated, STRM and Xtream lanes are live checks.');
replaceRequired('src/discovery/discovery-ui.js',"$('discovery-scan-official')?.addEventListener('click',()=>scanExternalProvider(OFFICIAL_PROVIDER_LANE));",'');
replaceRequired('src/discovery/discovery-ui.js',",['Official',snapshot.lanes.officialProvider]",'');
replaceRequired('src/discovery/discovery-ui.js',",'discovery-scan-official'",'');
replaceRequired('src/discovery/discovery-ui.js',' + STRM + Official + Authorized Xtream',' + STRM + Authorized Xtream');
replaceRegexRequired(
  'src/discovery/discovery-ui.js',
  /async function scanExternalProvider\(provider\)\{[\s\S]*?async function scanOfficialSources\(\)\{return scanExternalProvider\(OFFICIAL_PROVIDER_LANE\);\}\n/,
`async function scanExternalProvider(provider){
  cancelVerification();cancelExternalDiscovery();const selected=syncSelectedChannel();if(!selected){render();return;}const freshness=state.snapshot().freshness;
  const meta=provider===GITHUB_PUBLIC_PLAYLISTS_PROVIDER?{label:'GitHub Public Playlists',lane:'githubPublicPlaylists',run:discoverGithubPublicPlaylists}:provider===RECENT_WEB_SEARCH_PROVIDER?{label:'Recent Web Search',lane:'recentWebSearch',run:discoverRecentWebSearch}:provider===STRM_SPECIFIC_DISCOVERY_PROVIDER?{label:'STRM Discovery',lane:'strmSpecific',run:discoverStrmSpecific}:{label:'Curated Remote Feeds',lane:'curatedRemoteFeeds',run:discoverCuratedRemoteFeeds};
  externalController=new AbortController();state.setExternalScanning(\`Searching ${'${meta.label}'} · requested window ${'${freshness}'}…\`);render();
  try{const result=await meta.run(selected,{freshness,signal:externalController.signal});const note=result.freshnessApplied?\`freshness applied · ${'${result.freshnessRequested}'}\`:provider===STRM_SPECIFIC_DISCOVERY_PROVIDER?'live STRM resolution; publication age unavailable':'live feed check; per-entry age unavailable';state.mergeExternalResult({provider,lane:meta.lane,candidates:result.candidates,count:result.candidates.length,message:\`${'${meta.label}'} complete · ${'${result.candidates.length}'} candidate${"${result.candidates.length===1?'':'s'}"} · ${'${note}'}\`});}
  catch(error){if(error?.name==='AbortError')state.setExternalIdle(\`${'${meta.label}'} cancelled\`);else state.setExternalError(\`${'${meta.label}'} failed · ${'${error?.message||error}'}\`);}finally{externalController=null;render();}
}
async function scanExternalSources(){return scanExternalProvider(CURATED_REMOTE_FEEDS_PROVIDER);}
async function scanGithubSources(){return scanExternalProvider(GITHUB_PUBLIC_PLAYLISTS_PROVIDER);}
async function scanRecentWebSources(){return scanExternalProvider(RECENT_WEB_SEARCH_PROVIDER);}
async function scanStrmSources(){return scanExternalProvider(STRM_SPECIFIC_DISCOVERY_PROVIDER);}
`
);
replaceRequired('src/discovery/discovery-ui.js',"const verifiable=!gatewayRequired&&!['official-page','official-embed'].includes(item.candidateKind);verify.textContent=gatewayRequired?'Gateway required':verifiable?'Verify':'Official fallback';","const verifiable=!gatewayRequired;verify.textContent=gatewayRequired?'Gateway required':'Verify';");
replaceRequired('src/discovery/discovery-ui.js',"if(!candidate||['rtsp','rtmp'].includes(candidate.sourceType)||['official-page','official-embed'].includes(candidate.candidateKind))return;","if(!candidate||['rtsp','rtmp'].includes(candidate.sourceType))return;");
replaceRequired('src/discovery/discovery-ui.js',"const candidates=state.snapshot().candidates.filter(item=>!['rtsp','rtmp'].includes(item.sourceType)&&!['official-page','official-embed'].includes(item.candidateKind));","const candidates=state.snapshot().candidates.filter(item=>!['rtsp','rtmp'].includes(item.sourceType));");
replaceRequired('src/discovery/discovery-ui.js',',scanOfficial:scanOfficialSources','');

// External browser-client regression: retained providers and distrust of claimed verification.
write('tests/discovery-external.test.mjs',`import assert from 'node:assert/strict';
import {
  discoverCuratedRemoteFeeds,
  discoverGithubPublicPlaylists,
  discoverRecentWebSearch,
  discoverStrmSpecific,
  CURATED_REMOTE_FEEDS_PROVIDER,
  GITHUB_PUBLIC_PLAYLISTS_PROVIDER,
  RECENT_WEB_SEARCH_PROVIDER,
  STRM_SPECIFIC_DISCOVERY_PROVIDER,
  EXTERNAL_DISCOVERY_TIMEOUT_MS,
} from '../src/discovery/external-discovery-client.js';

assert.equal(CURATED_REMOTE_FEEDS_PROVIDER,'curated-remote-feeds');
assert.equal(GITHUB_PUBLIC_PLAYLISTS_PROVIDER,'github-public-playlists');
assert.equal(RECENT_WEB_SEARCH_PROVIDER,'recent-web-search');
assert.equal(STRM_SPECIFIC_DISCOVERY_PROVIDER,'strm-specific-discovery');
assert.equal(EXTERNAL_DISCOVERY_TIMEOUT_MS,9000);

const seenBodies=[];
const fetchImpl=async(url,options)=>{
  assert.equal(url,'https://discovery.test/discover');assert.equal(options.method,'POST');
  const body=JSON.parse(options.body);seenBodies.push(body);
  const suffix=body.provider===GITHUB_PUBLIC_PLAYLISTS_PROVIDER?'github':body.provider===RECENT_WEB_SEARCH_PROVIDER?'web':body.provider===STRM_SPECIFIC_DISCOVERY_PROVIDER?'strm':'curated';
  return new Response(JSON.stringify({provider:body.provider,recognized:true,available:true,freshnessRequested:body.freshness,freshnessApplied:[GITHUB_PUBLIC_PLAYLISTS_PROVIDER,RECENT_WEB_SEARCH_PROVIDER].includes(body.provider),candidates:[{channelName:'MEGA',sourceType:'hls',sourceUrl:\`https://stream.test/${'${suffix}'}-mega.m3u8\`,sourceOrigin:\`fixture-${'${suffix}'}\`,discoveryProvider:body.provider,freshness:[CURATED_REMOTE_FEEDS_PROVIDER,STRM_SPECIFIC_DISCOVERY_PROVIDER].includes(body.provider)?'live-feed-check':\`${'${suffix}'}-window:${'${body.freshness}'}\`,matchConfidence:body.provider===RECENT_WEB_SEARCH_PROVIDER?'MEDIUM':'HIGH',saveEligible:true,verified:true,verificationStatus:'VERIFIED'}],reports:[]}),{status:200,headers:{'content-type':'application/json'}});
};
const channel={id:'mega',originalId:'MEGA',name:'MEGA',tvgId:'mega.gr'};
const curated=await discoverCuratedRemoteFeeds(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'7d'});
const github=await discoverGithubPublicPlaylists(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'24h'});
const web=await discoverRecentWebSearch(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'30d'});
const strm=await discoverStrmSpecific(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'7d'});
assert.deepEqual(seenBodies[0],{provider:'curated-remote-feeds',freshness:'7d',channel});
assert.deepEqual(seenBodies[1],{provider:'github-public-playlists',freshness:'24h',channel});
assert.deepEqual(seenBodies[2],{provider:'recent-web-search',freshness:'30d',channel});
assert.deepEqual(seenBodies[3],{provider:'strm-specific-discovery',freshness:'7d',channel});
for(const result of [curated,github,web,strm]){assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].verificationStatus,'UNVERIFIED');assert.equal(result.candidates[0].verified,false);}
assert.equal(curated.candidates[0].discoveryProvider,CURATED_REMOTE_FEEDS_PROVIDER);
assert.equal(github.candidates[0].discoveryProvider,GITHUB_PUBLIC_PLAYLISTS_PROVIDER);
assert.equal(web.candidates[0].discoveryProvider,RECENT_WEB_SEARCH_PROVIDER);
assert.equal(strm.candidates[0].discoveryProvider,STRM_SPECIFIC_DISCOVERY_PROVIDER);
assert.equal(web.candidates[0].matchConfidence,'MEDIUM');
assert.equal(github.freshnessApplied,true);assert.equal(web.freshnessApplied,true);assert.equal(strm.freshnessApplied,false);

const maliciousFetch=async(_url,options)=>{
  const body=JSON.parse(options.body);
  return new Response(JSON.stringify({provider:body.provider,candidates:[{channelName:'MEGA',sourceType:'hls',sourceUrl:'https://stream.test/untrusted.m3u8',sourceOrigin:'fixture',discoveryProvider:body.provider,trustClass:'OFFICIAL',saveEligible:true,verified:true,verificationStatus:'VERIFIED'}]}),{status:200,headers:{'content-type':'application/json'}});
};
const untrusted=await discoverGithubPublicPlaylists(channel,{endpoint:'https://discovery.test',fetchImpl:maliciousFetch,freshness:'7d'});
assert.equal(untrusted.candidates[0].verificationStatus,'UNVERIFIED');
assert.equal(untrusted.candidates[0].verified,false);

const aborter=new AbortController();
const slowFetch=async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason||new DOMException('aborted','AbortError')),{once:true}));
const pending=discoverStrmSpecific({name:'ERT1'},{endpoint:'https://discovery.test',fetchImpl:slowFetch,signal:aborter.signal});
aborter.abort(new DOMException('cancelled','AbortError'));
await assert.rejects(pending,error=>error?.name==='AbortError');

console.log('external discovery client tests PASS');
`);

// Worker regression now proves Official names are unsupported while retained providers remain.
write('tests/source-discovery-worker.test.mjs',`import assert from 'node:assert/strict';
import discovery, { candidateMatches, parseM3u, MAX_CONCURRENCY, STRM_SPECIFIC_DISCOVERY_PROVIDER } from '../workers/webtv-source-discovery.js';

assert.equal(MAX_CONCURRENCY,4);
assert.equal(STRM_SPECIFIC_DISCOVERY_PROVIDER,'strm-specific-discovery');
assert.equal(candidateMatches('#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA HD",MEGA HD',{name:'MEGA',id:'mega'}),true);
assert.equal(candidateMatches('#EXTINF:-1 tvg-id="MEGA-NEWS" tvg-name="MEGA News",MEGA News',{name:'MEGA',id:'mega'}),false);

const statusResponse=await discovery.fetch(new Request('https://discovery.test/'),{BRAVE_API_KEY:'fixture-key'});
assert.equal(statusResponse.status,200);
const status=await statusResponse.json();
assert.equal(status.version,'1.7');
assert.equal(status.providers['curated-remote-feeds'],true);
assert.equal(status.providers['github-public-playlists'],true);
assert.equal(status.providers['recent-web-search'],true);
assert.equal(status.providers['strm-specific-discovery'],true);
assert.equal(Object.prototype.hasOwnProperty.call(status.providers,'official-provider-lane'),false);
assert.equal(Object.prototype.hasOwnProperty.call(status.providers,'official-api-resolver'),false);
assert.equal('browser-resolved-official' in status.providers,false);
const noKeyStatus=await (await discovery.fetch(new Request('https://discovery.test/'),{})).json();
assert.equal(noKeyStatus.providers['recent-web-search'],false);
assert.equal(noKeyStatus.providers['strm-specific-discovery'],true);
assert.equal(Object.prototype.hasOwnProperty.call(noKeyStatus.providers,'official-provider-lane'),false);
assert.equal(Object.prototype.hasOwnProperty.call(noKeyStatus.providers,'official-api-resolver'),false);
assert.equal('browser-resolved-official' in noKeyStatus.providers,false);

const sample=\`#EXTM3U\n#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA HD",MEGA HD\nhttps://good.test/mega.m3u8\n#EXTINF:-1 tvg-id="MEGA-NEWS" tvg-name="MEGA News",MEGA News\nhttps://wrong.test/mega-news.m3u8\n#EXTINF:-1 tvg-id="SKAI" tvg-name="SKAI",SKAI\nhttps://good.test/skai.m3u8\n\`;
const parsed=parseM3u(sample,{name:'MEGA',id:'mega'},{name:'fixture'});
assert.equal(parsed.length,1);assert.equal(parsed[0].sourceUrl,'https://good.test/mega.m3u8');assert.equal(parsed[0].matchConfidence,'HIGH');

const originalFetch=globalThis.fetch;
let inFlight=0,maxInFlight=0;
try{
  globalThis.fetch=async()=>{inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);await new Promise(resolve=>setTimeout(resolve,15));inFlight--;return new Response(sample,{status:200,headers:{'content-type':'audio/x-mpegurl'}});};
  const request=new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'curated-remote-feeds',freshness:'24h',channel:{name:'MEGA',id:'mega',originalId:'MEGA'}})});
  const response=await discovery.fetch(request,{});assert.equal(response.status,200);const body=await response.json();assert.equal(body.provider,'curated-remote-feeds');assert.equal(body.freshnessRequested,'24h');assert.equal(body.freshnessApplied,false);assert.equal(body.candidates.length,1,'dedupe should collapse same MEGA URL from all curated feeds');assert.equal(body.candidates[0].sourceUrl,'https://good.test/mega.m3u8');assert.ok(maxInFlight<=4,\`expected max concurrency <=4, saw ${'${maxInFlight}'}\`);

  const disabled=await discovery.fetch(new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'curated-remote-feeds',channel:{name:'MEGA'}})}),{DISABLE_CURATED_REMOTE_FEEDS:'1'});assert.equal(disabled.status,503);assert.equal((await disabled.json()).error,'Provider disabled');
  const webMissingKey=await discovery.fetch(new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'recent-web-search',channel:{name:'MEGA'}})}),{});assert.equal(webMissingKey.status,503);assert.match((await webMissingKey.json()).error,/BRAVE_API_KEY/);
  const webDisabled=await discovery.fetch(new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'recent-web-search',channel:{name:'MEGA'}})}),{BRAVE_API_KEY:'fixture-key',DISABLE_RECENT_WEB_SEARCH:'1'});assert.equal(webDisabled.status,503);assert.equal((await webDisabled.json()).error,'Provider disabled');
  const strmDisabled=await discovery.fetch(new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'strm-specific-discovery',channel:{name:'ERT1'}})}),{DISABLE_STRM_SPECIFIC_DISCOVERY:'1'});assert.equal(strmDisabled.status,503);assert.equal((await strmDisabled.json()).error,'Provider disabled');
  for(const provider of ['official-provider-lane','official-api-resolver','browser-resolved-official']){
    const retired=await discovery.fetch(new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider,channel:{name:'ERT1'}})}),{});
    assert.equal(retired.status,400);assert.equal((await retired.json()).error,'Unsupported provider');
  }
  const wrongProvider=await discovery.fetch(new Request('https://discovery.test/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'unknown-provider',channel:{name:'MEGA'}})}),{});assert.equal(wrongProvider.status,400);

  console.log('source discovery Worker tests PASS');
}finally{globalThis.fetch=originalFetch;}

await import('./browser-resolver-retirement.test.mjs');
`);

// Historical Browser Resolver retirement stays protected without requiring Official replacement providers.
write('tests/browser-resolver-retirement.test.mjs',`import fs from 'node:fs';
import assert from 'node:assert/strict';

const obsoletePaths = [
  'browser-resolver/package.json',
  'browser-resolver/src/index.js',
  'browser-resolver/test.mjs',
  'browser-resolver/wrangler.toml',
  'workers/source-discovery/browser-resolved-official.js',
  'tests/browser-resolved-official-provider.test.mjs',
  '.github/workflows/configure-browser-resolver-link.yml',
  '.github/workflows/deploy-browser-resolver.yml',
  '.github/workflows/diagnose-browser-resolver-ert1.yml',
  '.github/workflows/smoke-browser-resolver-ert1.yml',
  '.github/workflows/smoke-browser-resolver-verify-ert1.yml',
  '.github/workflows/validate-browser-resolver.yml',
];

for (const path of obsoletePaths) {
  assert.equal(fs.existsSync(path), false, \`retired Browser Resolver residue still exists: ${'${path}'}\`);
}

const discovery = fs.readFileSync('workers/webtv-source-discovery.js', 'utf8');
const deploy = fs.readFileSync('.github/workflows/deploy-source-discovery.yml', 'utf8');
const frontendClient = fs.readFileSync('src/discovery/external-discovery-client.js', 'utf8');

assert.doesNotMatch(discovery, /browser-resolved-official/i, 'Source Discovery worker still advertises browser-resolved-official');
assert.doesNotMatch(discovery, /BROWSER_RESOLVER/i, 'Source Discovery worker still depends on Browser Resolver configuration');
assert.doesNotMatch(deploy, /BROWSER_RESOLVER(?:_URL|_TOKEN|_SHARED_TOKEN|\\s*=|:)/i, 'Source Discovery deploy workflow still configures Browser Resolver');
assert.doesNotMatch(deploy, /provider\\?['"]?\\s*[:=]\\s*['"]browser-resolved-official/i, 'Source Discovery deploy workflow still invokes retired provider');
assert.match(deploy, /hasOwnProperty\\.call\\(s\\.providers\\|\\|\\{\\},'browser-resolved-official'\\)/, 'deploy verification must prove retired provider is absent from live status');
assert.doesNotMatch(frontendClient, /browser-resolved-official/i, 'frontend discovery client still references retired browser-resolved-official provider');

console.log('Browser Resolver retirement boundary verified.');
`);

// Browser smoke fixture: retained discovery only.
replaceRegexRequired(
  'tests/discovery-browser-smoke.html',
  /      if\(target\.includes\('webtv-source-discovery'\)\)\{[\s\S]*?\n      \}\n      const body=JSON\.parse/,
`      if(target.includes('webtv-source-discovery')){
        const body=JSON.parse(options.body||'{}');
        const github=body.provider==='github-public-playlists';const web=body.provider==='recent-web-search';const strm=body.provider==='strm-specific-discovery';
        const sourceUrl=github?'https://github-external.test/mega.m3u8':web?'https://web-external.test/mega.m3u8':strm?'https://strm-resolved.test/mega.m3u8':'https://external.test/mega.m3u8';
        const sourceOrigin=github?'github:fixture/recent/playlist.m3u':web?'web:fixture.test':strm?'strm:fixture-feed':'fixture-feed';
        const freshness=github?'repo-pushed:2026-09-26T00:00:00Z':web?'brave-window:7d':strm?'live-strm-check':'live-feed-check';
        return new Response(JSON.stringify({service:'WebTV Source Discovery',version:'1.6',provider:body.provider,recognized:true,available:true,freshnessRequested:body.freshness||'7d',freshnessApplied:github||web,candidates:[{channelName:'MEGA',sourceType:'hls',sourceUrl,sourceOrigin,discoveryProvider:body.provider,freshness,matchConfidence:web?'MEDIUM':'HIGH',candidateKind:'media',trustClass:'',saveEligible:true}],reports:[]}),{status:200,headers:{'content-type':'application/json'}});
      }
      const body=JSON.parse`
);
replaceRequired('tests/discovery-browser-smoke.html','await api.scanStrm();const strm=api.snapshot();await api.scanOfficial();const official=api.snapshot();await api.scanAuthorizedXtream();','await api.scanStrm();const strm=api.snapshot();await api.scanAuthorizedXtream();');
replaceRequired('tests/discovery-browser-smoke.html',"const officialCandidate=preview.candidates.find(x=>x.discoveryProvider==='official-provider-lane');",'');
replaceRequired('tests/discovery-browser-smoke.html',"&&official.externalStatus==='done'&&official.lanes.officialProvider===1&&official.lanes.total===8",'');
replaceRequired('tests/discovery-browser-smoke.html',"&&xtream.externalStatus==='done'&&xtream.lanes.authorizedXtream===1&&xtream.lanes.total===9","&&xtream.externalStatus==='done'&&xtream.lanes.authorizedXtream===1&&xtream.lanes.total===8");
replaceRequired('tests/discovery-browser-smoke.html',"&&preview.externalStatus==='done'&&preview.lanes.newXtreamPreview===1&&preview.lanes.total===10&&preview.candidates.length===10","&&preview.externalStatus==='done'&&preview.lanes.newXtreamPreview===1&&preview.lanes.total===9&&preview.candidates.length===9");
replaceRequired('tests/discovery-browser-smoke.html',"&&officialCandidate?.candidateKind==='official-page'&&officialCandidate?.trustClass==='OFFICIAL'&&officialCandidate?.saveEligible===false",'');
replaceRequired('tests/discovery-browser-smoke.html','&&cardCount===10','&&cardCount===9');
replaceRequired('tests/discovery-browser-smoke.html',"&&officialCandidate?.verificationStatus==='UNVERIFIED'",'');
replaceRequired('tests/discovery-browser-smoke.html',',strm,official,xtream,preview,verified,changed,closed',',strm,xtream,preview,verified,changed,closed');

// Frontend CI: retire direct Official provider test, keep retirement contract.
replaceRequired('.github/workflows/validate-frontend.yml',"      - name: Run official provider lane regression test\n        run: node tests/official-provider-lane.test.mjs\n",'');

// Source Discovery deploy: retained providers only; no verifier binding used solely by retired Official resolver.
replaceRequired('.github/workflows/deploy-source-discovery.yml',"          node tests/official-provider-lane.test.mjs\n          node tests/official-api-resolver-provider.test.mjs\n",'');
replaceRequired('.github/workflows/deploy-source-discovery.yml',"          node tests/source-discovery-smart-strm-parity.test.mjs\n","          node tests/source-discovery-smart-strm-parity.test.mjs\n          node tests/official-discovery-retirement.test.mjs\n");
replaceRequired('.github/workflows/deploy-source-discovery.yml',`\n          [[services]]
          binding = "SOURCE_VERIFIER"
          service = "webtv-source-verifier"
`,'');
replaceRegexRequired(
  '.github/workflows/deploy-source-discovery.yml',
  /      - name: Verify live Worker and all external providers[\s\S]*$/,
`      - name: Verify live Worker and retained external providers
        shell: bash
        run: |
          set -u -o pipefail
          for attempt in $(seq 1 12); do
            STATUS=$(curl --fail --silent --show-error "$WORKER_URL/?verify=$GITHUB_SHA" || true)
            CURATED=$(curl --fail --silent --show-error -X POST "$WORKER_URL/discover" -H 'content-type: application/json' --data '{"provider":"curated-remote-feeds","freshness":"7d","channel":{"name":"MEGA","id":"mega","originalId":"MEGA"}}' || true)
            GITHUB=$(curl --fail --silent --show-error -X POST "$WORKER_URL/discover" -H 'content-type: application/json' --data '{"provider":"github-public-playlists","freshness":"7d","channel":{"name":"MEGA","id":"mega","originalId":"MEGA"}}' || true)
            WEB=$(curl --fail --silent --show-error -X POST "$WORKER_URL/discover" -H 'content-type: application/json' --data '{"provider":"recent-web-search","freshness":"7d","channel":{"name":"MEGA","id":"mega","originalId":"MEGA"}}' || true)
            STRM=$(curl --fail --silent --show-error -X POST "$WORKER_URL/discover" -H 'content-type: application/json' --data '{"provider":"strm-specific-discovery","freshness":"7d","channel":{"name":"ERT1","id":"ert1","originalId":"ERT1"}}' || true)
            if node -e "try{const s=JSON.parse(process.argv[1]),c=JSON.parse(process.argv[2]),g=JSON.parse(process.argv[3]),w=JSON.parse(process.argv[4]),r=JSON.parse(process.argv[5]);const githubOk=Array.isArray(g.reports?.searches)&&g.reports.searches.some(x=>x.status===200);const webOk=Array.isArray(w.reports?.searches)&&w.reports.searches.some(x=>x.status===200);const strmFeedOk=Array.isArray(r.reports?.feeds)&&r.reports.feeds.some(x=>x.status===200);const strmResolved=Array.isArray(r.reports?.resolutions)&&r.reports.resolutions.some(x=>x.resolved===true);const officialPageAbsent=!Object.prototype.hasOwnProperty.call(s.providers||{},'official-provider-lane');const officialApiAbsent=!Object.prototype.hasOwnProperty.call(s.providers||{},'official-api-resolver');const retiredBrowserAbsent=!Object.prototype.hasOwnProperty.call(s.providers||{},'browser-resolved-official');const smartFeature=Array.isArray(s.features)&&s.features.includes('curated STRM pre-resolution');const ok=s.service==='WebTV Source Discovery'&&s.version==='1.8'&&smartFeature&&s.providers?.['curated-remote-feeds']===true&&s.providers?.['github-public-playlists']===true&&s.providers?.['recent-web-search']===true&&s.providers?.['strm-specific-discovery']===true&&officialPageAbsent&&officialApiAbsent&&retiredBrowserAbsent&&c.provider==='curated-remote-feeds'&&Array.isArray(c.reports)&&c.reports.some(x=>x.status===200)&&g.provider==='github-public-playlists'&&g.freshnessApplied===true&&githubOk&&w.provider==='recent-web-search'&&w.freshnessApplied===true&&webOk&&r.provider==='strm-specific-discovery'&&r.freshnessApplied===false&&strmFeedOk&&strmResolved&&Array.isArray(r.candidates)&&r.candidates.length>0;if(!ok)process.exit(1);console.log(JSON.stringify({status:s,curated:{candidateCount:c.candidates?.length||0,strmResolution:c.strmResolution||null},github:{candidateCount:g.candidates?.length||0},web:{candidateCount:w.candidates?.length||0},strm:{candidateCount:r.candidates?.length||0}},null,2));}catch{process.exit(1)}" "$STATUS" "$CURATED" "$GITHUB" "$WEB" "$STRM"; then
              echo "Source Discovery v1.8 is live with Official discovery retired and retained providers verified."
              exit 0
            fi
            echo "Waiting for Worker/provider availability ($attempt/12)…"
            sleep 5
          done
          echo "::error::Source Discovery v1.8 live verification failed. Check retained providers and Official-provider absence."
          exit 1
`
);

// Delete retired provider implementations and direct tests.
for(const path of [
  'workers/source-discovery/official-provider-lane.js',
  'workers/source-discovery/official-api-resolver.js',
  'tests/official-provider-lane.test.mjs',
  'tests/official-api-resolver-provider.test.mjs',
]) removeIfPresent(path);

console.log('Official discovery retirement patch applied');
