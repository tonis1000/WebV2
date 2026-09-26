import assert from 'node:assert/strict';
import {
  discoverCuratedRemoteFeeds,
  discoverGithubPublicPlaylists,
  discoverRecentWebSearch,
  CURATED_REMOTE_FEEDS_PROVIDER,
  GITHUB_PUBLIC_PLAYLISTS_PROVIDER,
  RECENT_WEB_SEARCH_PROVIDER,
  EXTERNAL_DISCOVERY_TIMEOUT_MS,
} from '../src/discovery/external-discovery-client.js';

assert.equal(CURATED_REMOTE_FEEDS_PROVIDER,'curated-remote-feeds');
assert.equal(GITHUB_PUBLIC_PLAYLISTS_PROVIDER,'github-public-playlists');
assert.equal(RECENT_WEB_SEARCH_PROVIDER,'recent-web-search');
assert.equal(EXTERNAL_DISCOVERY_TIMEOUT_MS,9000);

const seenBodies=[];
const fetchImpl=async(url,options)=>{
  assert.equal(url,'https://discovery.test/discover');assert.equal(options.method,'POST');
  const body=JSON.parse(options.body);seenBodies.push(body);
  const suffix=body.provider===GITHUB_PUBLIC_PLAYLISTS_PROVIDER?'github':body.provider===RECENT_WEB_SEARCH_PROVIDER?'web':'curated';
  return new Response(JSON.stringify({provider:body.provider,freshnessRequested:body.freshness,freshnessApplied:body.provider!==CURATED_REMOTE_FEEDS_PROVIDER,candidates:[{channelName:'MEGA',sourceType:'hls',sourceUrl:`https://stream.test/${suffix}-mega.m3u8`,sourceOrigin:`fixture-${suffix}`,discoveryProvider:body.provider,freshness:body.provider===CURATED_REMOTE_FEEDS_PROVIDER?'live-feed-check':`${suffix}-window:${body.freshness}`,matchConfidence:body.provider===RECENT_WEB_SEARCH_PROVIDER?'MEDIUM':'HIGH',verified:true,verificationStatus:'VERIFIED'}],reports:[]}),{status:200,headers:{'content-type':'application/json'}});
};
const channel={id:'mega',originalId:'MEGA',name:'MEGA',tvgId:'mega.gr'};
const curated=await discoverCuratedRemoteFeeds(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'7d'});
const github=await discoverGithubPublicPlaylists(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'24h'});
const web=await discoverRecentWebSearch(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'30d'});
assert.deepEqual(seenBodies[0],{provider:'curated-remote-feeds',freshness:'7d',channel});
assert.deepEqual(seenBodies[1],{provider:'github-public-playlists',freshness:'24h',channel});
assert.deepEqual(seenBodies[2],{provider:'recent-web-search',freshness:'30d',channel});
for(const result of [curated,github,web]){assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].verificationStatus,'UNVERIFIED');assert.equal(result.candidates[0].verified,false);}
assert.equal(curated.candidates[0].discoveryProvider,CURATED_REMOTE_FEEDS_PROVIDER);
assert.equal(github.candidates[0].discoveryProvider,GITHUB_PUBLIC_PLAYLISTS_PROVIDER);
assert.equal(web.candidates[0].discoveryProvider,RECENT_WEB_SEARCH_PROVIDER);
assert.equal(web.candidates[0].matchConfidence,'MEDIUM');
assert.equal(github.freshnessApplied,true);assert.equal(web.freshnessApplied,true);

const aborter=new AbortController();
const slowFetch=async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason||new DOMException('aborted','AbortError')),{once:true}));
const pending=discoverRecentWebSearch({name:'MEGA'},{endpoint:'https://discovery.test',fetchImpl:slowFetch,signal:aborter.signal});
aborter.abort(new DOMException('cancelled','AbortError'));
await assert.rejects(pending,error=>error?.name==='AbortError');

console.log('external discovery client tests PASS');
