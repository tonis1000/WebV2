import assert from 'node:assert/strict';
import {
  discoverCuratedRemoteFeeds,
  discoverGithubPublicPlaylists,
  discoverRecentWebSearch,
  discoverStrmSpecific,
  discoverOfficialProvider,
  discoverOfficialApi,
  CURATED_REMOTE_FEEDS_PROVIDER,
  GITHUB_PUBLIC_PLAYLISTS_PROVIDER,
  RECENT_WEB_SEARCH_PROVIDER,
  STRM_SPECIFIC_DISCOVERY_PROVIDER,
  OFFICIAL_PROVIDER_LANE,
  OFFICIAL_API_RESOLVER_PROVIDER,
  EXTERNAL_DISCOVERY_TIMEOUT_MS,
} from '../src/discovery/external-discovery-client.js';

assert.equal(CURATED_REMOTE_FEEDS_PROVIDER,'curated-remote-feeds');
assert.equal(GITHUB_PUBLIC_PLAYLISTS_PROVIDER,'github-public-playlists');
assert.equal(RECENT_WEB_SEARCH_PROVIDER,'recent-web-search');
assert.equal(STRM_SPECIFIC_DISCOVERY_PROVIDER,'strm-specific-discovery');
assert.equal(OFFICIAL_PROVIDER_LANE,'official-provider-lane');
assert.equal(OFFICIAL_API_RESOLVER_PROVIDER,'official-api-resolver');
assert.equal(EXTERNAL_DISCOVERY_TIMEOUT_MS,9000);

const seenBodies=[];
const fetchImpl=async(url,options)=>{
  assert.equal(url,'https://discovery.test/discover');assert.equal(options.method,'POST');
  const body=JSON.parse(options.body);seenBodies.push(body);
  const suffix=body.provider===GITHUB_PUBLIC_PLAYLISTS_PROVIDER?'github':body.provider===RECENT_WEB_SEARCH_PROVIDER?'web':body.provider===STRM_SPECIFIC_DISCOVERY_PROVIDER?'strm':body.provider===OFFICIAL_PROVIDER_LANE?'official':body.provider===OFFICIAL_API_RESOLVER_PROVIDER?'official-api':'curated';
  const serverVerified=body.provider===OFFICIAL_API_RESOLVER_PROVIDER;
  return new Response(JSON.stringify({provider:body.provider,recognized:true,available:true,freshnessRequested:body.freshness,freshnessApplied:[GITHUB_PUBLIC_PLAYLISTS_PROVIDER,RECENT_WEB_SEARCH_PROVIDER].includes(body.provider),candidates:[{channelName:'MEGA',sourceType:'hls',sourceUrl:`https://stream.test/${suffix}-mega.m3u8`,sourceOrigin:`fixture-${suffix}`,discoveryProvider:body.provider,freshness:[CURATED_REMOTE_FEEDS_PROVIDER,STRM_SPECIFIC_DISCOVERY_PROVIDER].includes(body.provider)?'live-feed-check':`${suffix}-window:${body.freshness}`,matchConfidence:body.provider===RECENT_WEB_SEARCH_PROVIDER?'MEDIUM':'HIGH',trustClass:serverVerified?'OFFICIAL':'',saveEligible:true,verified:true,verificationStatus:'VERIFIED'}],reports:[]}),{status:200,headers:{'content-type':'application/json'}});
};
const channel={id:'mega',originalId:'MEGA',name:'MEGA',tvgId:'mega.gr'};
const curated=await discoverCuratedRemoteFeeds(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'7d'});
const github=await discoverGithubPublicPlaylists(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'24h'});
const web=await discoverRecentWebSearch(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'30d'});
const strm=await discoverStrmSpecific(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'7d'});
const official=await discoverOfficialProvider(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'7d'});
const officialApi=await discoverOfficialApi(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'7d'});
assert.deepEqual(seenBodies[0],{provider:'curated-remote-feeds',freshness:'7d',channel});
assert.deepEqual(seenBodies[1],{provider:'github-public-playlists',freshness:'24h',channel});
assert.deepEqual(seenBodies[2],{provider:'recent-web-search',freshness:'30d',channel});
assert.deepEqual(seenBodies[3],{provider:'strm-specific-discovery',freshness:'7d',channel});
assert.deepEqual(seenBodies[4],{provider:'official-api-resolver',freshness:'7d',channel});
assert.deepEqual(seenBodies[5],{provider:'official-api-resolver',freshness:'7d',channel});
for(const result of [curated,github,web,strm]){assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].verificationStatus,'UNVERIFIED');assert.equal(result.candidates[0].verified,false);}
assert.equal(officialApi.candidates.length,1);
assert.equal(officialApi.candidates[0].verificationStatus,'VERIFIED');
assert.equal(officialApi.candidates[0].verified,true);
assert.equal(officialApi.candidates[0].trustClass,'OFFICIAL');
assert.equal(official.provider,OFFICIAL_PROVIDER_LANE);
assert.equal(official.selectedOfficialProvider,OFFICIAL_API_RESOLVER_PROVIDER);
assert.deepEqual(official.officialResolutionPath,[OFFICIAL_API_RESOLVER_PROVIDER]);
assert.equal(official.candidates.length,1);
assert.equal(official.candidates[0].verificationStatus,'VERIFIED');
assert.equal(official.candidates[0].verified,true);
assert.equal(official.candidates[0].discoveryProvider,OFFICIAL_PROVIDER_LANE);
assert.equal(curated.candidates[0].discoveryProvider,CURATED_REMOTE_FEEDS_PROVIDER);
assert.equal(github.candidates[0].discoveryProvider,GITHUB_PUBLIC_PLAYLISTS_PROVIDER);
assert.equal(web.candidates[0].discoveryProvider,RECENT_WEB_SEARCH_PROVIDER);
assert.equal(strm.candidates[0].discoveryProvider,STRM_SPECIFIC_DISCOVERY_PROVIDER);
assert.equal(officialApi.candidates[0].discoveryProvider,OFFICIAL_API_RESOLVER_PROVIDER);
assert.equal(web.candidates[0].matchConfidence,'MEDIUM');
assert.equal(github.freshnessApplied,true);assert.equal(web.freshnessApplied,true);assert.equal(strm.freshnessApplied,false);

const fallbackOrder=[];
const fallbackFetch=async(_url,options)=>{
  const body=JSON.parse(options.body);fallbackOrder.push(body.provider);
  if(body.provider===OFFICIAL_API_RESOLVER_PROVIDER)return new Response(JSON.stringify({provider:body.provider,recognized:true,available:true,candidates:[],reports:{reason:'verification failed',restriction:null}}),{status:200,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({provider:OFFICIAL_PROVIDER_LANE,recognized:true,available:true,candidates:[{channelName:'ERT1',sourceType:'direct',sourceUrl:'https://live.ertflix.gr/live/ert1',sourceOrigin:'official-registry:ERT',discoveryProvider:OFFICIAL_PROVIDER_LANE,candidateKind:'official-page',trustClass:'OFFICIAL',saveEligible:false,matchConfidence:'HIGH'}],reports:{pages:[]}}),{status:200,headers:{'content-type':'application/json'}});
};
const fallback=await discoverOfficialProvider({id:'ert1',name:'ERT1'},{endpoint:'https://discovery.test',fetchImpl:fallbackFetch,freshness:'7d'});
assert.deepEqual(fallbackOrder,[OFFICIAL_API_RESOLVER_PROVIDER,OFFICIAL_PROVIDER_LANE]);
assert.deepEqual(fallback.officialResolutionPath,[OFFICIAL_API_RESOLVER_PROVIDER,OFFICIAL_PROVIDER_LANE]);
assert.equal(fallback.selectedOfficialProvider,OFFICIAL_PROVIDER_LANE);
assert.equal(fallback.candidates.length,1);
assert.equal(fallback.candidates[0].candidateKind,'official-page');
assert.equal(fallback.candidates[0].saveEligible,false);
assert.equal(fallback.candidates[0].verificationStatus,'UNVERIFIED');

const restrictedOrder=[];
const restrictedFetch=async(_url,options)=>{
  const body=JSON.parse(options.body);restrictedOrder.push(body.provider);
  if(body.provider===OFFICIAL_API_RESOLVER_PROVIDER)return new Response(JSON.stringify({provider:body.provider,recognized:true,available:true,candidates:[],reports:{restriction:{type:'SERVER_REGION_RESTRICTED',scope:'ERT_LIVE_GREECE',channelKey:'ert1',upstreamStatus:401},reason:'Official live source is region-restricted from the server-side verifier environment'}}),{status:200,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({provider:OFFICIAL_PROVIDER_LANE,recognized:true,available:true,candidates:[{channelName:'ERT1',sourceType:'direct',sourceUrl:'https://live.ertflix.gr/live/ert1',sourceOrigin:'official-registry:ERT',discoveryProvider:OFFICIAL_PROVIDER_LANE,candidateKind:'official-page',trustClass:'OFFICIAL',saveEligible:false,matchConfidence:'HIGH'}],reports:{pages:[]}}),{status:200,headers:{'content-type':'application/json'}});
};
const restricted=await discoverOfficialProvider({id:'ert1',name:'ERT1'},{endpoint:'https://discovery.test',fetchImpl:restrictedFetch,freshness:'7d'});
assert.deepEqual(restrictedOrder,[OFFICIAL_API_RESOLVER_PROVIDER,OFFICIAL_PROVIDER_LANE]);
assert.deepEqual(restricted.officialResolutionPath,[OFFICIAL_API_RESOLVER_PROVIDER,OFFICIAL_PROVIDER_LANE]);
assert.equal(restricted.reports.stages[0].restrictionType,'SERVER_REGION_RESTRICTED');
assert.equal(restricted.selectedOfficialProvider,OFFICIAL_PROVIDER_LANE);
assert.equal(restricted.candidates.length,1);

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
