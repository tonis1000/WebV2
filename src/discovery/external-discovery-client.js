import { createCandidate } from './candidate-model.js';

export const DISCOVERY_ENDPOINT='https://webtv-source-discovery.atonis.workers.dev';
export const CURATED_REMOTE_FEEDS_PROVIDER='curated-remote-feeds';
export const GITHUB_PUBLIC_PLAYLISTS_PROVIDER='github-public-playlists';
export const RECENT_WEB_SEARCH_PROVIDER='recent-web-search';
export const EXTERNAL_DISCOVERY_TIMEOUT_MS=9000;
export const PROVIDER_FLAGS=Object.freeze({
  [CURATED_REMOTE_FEEDS_PROVIDER]:true,
  [GITHUB_PUBLIC_PLAYLISTS_PROVIDER]:true,
  [RECENT_WEB_SEARCH_PROVIDER]:true,
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
    const candidates=(payload?.candidates||[]).map(item=>createCandidate({...item,channelName:item.channelName||channel.name,verificationStatus:'UNVERIFIED',verified:false}));
    return {...payload,candidates};
  } finally {timed.clear();}
}

export function discoverCuratedRemoteFeeds(channel,options={}){return discoverProvider(CURATED_REMOTE_FEEDS_PROVIDER,channel,options);}
export function discoverGithubPublicPlaylists(channel,options={}){return discoverProvider(GITHUB_PUBLIC_PLAYLISTS_PROVIDER,channel,options);}
export function discoverRecentWebSearch(channel,options={}){return discoverProvider(RECENT_WEB_SEARCH_PROVIDER,channel,options);}
