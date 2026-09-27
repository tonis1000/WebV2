import { createCandidate } from './candidate-model.js';

export const DISCOVERY_ENDPOINT='https://webtv-source-discovery.atonis.workers.dev';
export const CURATED_REMOTE_FEEDS_PROVIDER='curated-remote-feeds';
export const GITHUB_PUBLIC_PLAYLISTS_PROVIDER='github-public-playlists';
export const RECENT_WEB_SEARCH_PROVIDER='recent-web-search';
export const STRM_SPECIFIC_DISCOVERY_PROVIDER='strm-specific-discovery';
export const OFFICIAL_PROVIDER_LANE='official-provider-lane';
export const OFFICIAL_API_RESOLVER_PROVIDER='official-api-resolver';
export const BROWSER_RESOLVED_OFFICIAL_PROVIDER='browser-resolved-official';
export const EXTERNAL_DISCOVERY_TIMEOUT_MS=9000;
export const PROVIDER_FLAGS=Object.freeze({
  [CURATED_REMOTE_FEEDS_PROVIDER]:true,
  [GITHUB_PUBLIC_PLAYLISTS_PROVIDER]:true,
  [RECENT_WEB_SEARCH_PROVIDER]:true,
  [STRM_SPECIFIC_DISCOVERY_PROVIDER]:true,
  [OFFICIAL_PROVIDER_LANE]:true,
  [OFFICIAL_API_RESOLVER_PROVIDER]:true,
  [BROWSER_RESOLVED_OFFICIAL_PROVIDER]:true,
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
function normalizeCandidate(provider,item,channel){
  const trustedServerVerification=provider===OFFICIAL_API_RESOLVER_PROVIDER&&item?.trustClass==='OFFICIAL'&&item?.saveEligible===true&&item?.verificationStatus==='VERIFIED';
  return createCandidate({
    ...item,
    channelName:item.channelName||channel.name,
    verificationStatus:trustedServerVerification?'VERIFIED':'UNVERIFIED',
    verified:trustedServerVerification,
  });
}
function isAbort(error){return error?.name==='AbortError'||error?.name==='TimeoutError';}
function restrictionType(result){return String(result?.reports?.restriction?.type||'');}

async function discoverProvider(provider,channel,{freshness='7d',endpoint=DISCOVERY_ENDPOINT,fetchImpl=fetch,signal,timeoutMs=EXTERNAL_DISCOVERY_TIMEOUT_MS}={}){
  if(!PROVIDER_FLAGS[provider])return {provider,disabled:true,candidates:[],reports:[]};
  if(!channel?.name)throw new Error('A selected channel is required');
  const timed=timeoutSignal(signal,timeoutMs);
  try{
    const response=await fetchImpl(`${String(endpoint).replace(/\/$/,'')}/discover`,{
      method:'POST',headers:{'content-type':'application/json'},signal:timed.signal,
      body:JSON.stringify({provider,freshness,channel:{id:String(channel.id||''),originalId:String(channel.originalId||''),name:String(channel.name||''),tvgId:String(channel.tvgId||'')}}),
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload?.error||`Discovery HTTP ${response.status}`);
    const candidates=(payload?.candidates||[]).map(item=>normalizeCandidate(provider,item,channel));
    return {...payload,candidates};
  } finally {timed.clear();}
}
async function officialStage(provider,channel,options,stages){
  try{
    const timeoutMs=provider===BROWSER_RESOLVED_OFFICIAL_PROVIDER?(options.timeoutMs||15000):options.timeoutMs;
    const result=await discoverProvider(provider,channel,{...options,timeoutMs});
    stages.push({provider,ok:true,recognized:result.recognized!==false,available:result.available!==false,candidateCount:result.candidates?.length||0,restrictionType:restrictionType(result)});
    return result;
  }catch(error){
    if(isAbort(error))throw error;
    stages.push({provider,ok:false,recognized:false,available:false,candidateCount:0,error:String(error?.message||error).slice(0,160)});
    return {provider,recognized:false,available:false,candidates:[],reports:[],error:error?.message||String(error)};
  }
}
function aggregateOfficialResult(result,stages,channel){
  const candidates=(result?.candidates||[]).map(item=>createCandidate({...item,channelName:item.channelName||channel.name,discoveryProvider:OFFICIAL_PROVIDER_LANE}));
  return {
    ...result,
    provider:OFFICIAL_PROVIDER_LANE,
    candidates,
    officialResolutionPath:stages.map(stage=>stage.provider),
    selectedOfficialProvider:String(result?.provider||''),
    reports:{stages,selectedProvider:String(result?.provider||''),upstream:result?.reports??null},
  };
}

export function discoverCuratedRemoteFeeds(channel,options={}){return discoverProvider(CURATED_REMOTE_FEEDS_PROVIDER,channel,options);}
export function discoverGithubPublicPlaylists(channel,options={}){return discoverProvider(GITHUB_PUBLIC_PLAYLISTS_PROVIDER,channel,options);}
export function discoverRecentWebSearch(channel,options={}){return discoverProvider(RECENT_WEB_SEARCH_PROVIDER,channel,options);}
export function discoverStrmSpecific(channel,options={}){return discoverProvider(STRM_SPECIFIC_DISCOVERY_PROVIDER,channel,options);}
export function discoverOfficialApi(channel,options={}){return discoverProvider(OFFICIAL_API_RESOLVER_PROVIDER,channel,options);}
export function discoverBrowserResolvedOfficial(channel,options={}){return discoverProvider(BROWSER_RESOLVED_OFFICIAL_PROVIDER,channel,{...options,timeoutMs:options.timeoutMs||15000});}
export async function discoverOfficialProvider(channel,options={}){
  const stages=[];
  const api=await officialStage(OFFICIAL_API_RESOLVER_PROVIDER,channel,options,stages);
  if(api.candidates?.length)return aggregateOfficialResult(api,stages,channel);
  if(restrictionType(api)==='SERVER_REGION_RESTRICTED'){
    stages.push({provider:BROWSER_RESOLVED_OFFICIAL_PROVIDER,ok:true,recognized:true,available:true,candidateCount:0,skipped:true,skipReason:'SERVER_REGION_RESTRICTED'});
    const page=await officialStage(OFFICIAL_PROVIDER_LANE,channel,options,stages);
    return aggregateOfficialResult(page,stages,channel);
  }
  const browser=await officialStage(BROWSER_RESOLVED_OFFICIAL_PROVIDER,channel,options,stages);
  if(browser.candidates?.length)return aggregateOfficialResult(browser,stages,channel);
  const page=await officialStage(OFFICIAL_PROVIDER_LANE,channel,options,stages);
  return aggregateOfficialResult(page,stages,channel);
}

export { normalizeCandidate, aggregateOfficialResult, restrictionType };
