import assert from 'node:assert/strict';
import {
  discoverCuratedRemoteFeeds,
  discoverGithubPublicPlaylists,
  CURATED_REMOTE_FEEDS_PROVIDER,
  GITHUB_PUBLIC_PLAYLISTS_PROVIDER,
  EXTERNAL_DISCOVERY_TIMEOUT_MS,
} from '../src/discovery/external-discovery-client.js';

assert.equal(CURATED_REMOTE_FEEDS_PROVIDER,'curated-remote-feeds');
assert.equal(GITHUB_PUBLIC_PLAYLISTS_PROVIDER,'github-public-playlists');
assert.equal(EXTERNAL_DISCOVERY_TIMEOUT_MS,9000);

const seenBodies=[];
const fetchImpl=async(url,options)=>{
  assert.equal(url,'https://discovery.test/discover');
  assert.equal(options.method,'POST');
  const body=JSON.parse(options.body);seenBodies.push(body);
  const github=body.provider===GITHUB_PUBLIC_PLAYLISTS_PROVIDER;
  return new Response(JSON.stringify({
    provider:body.provider,freshnessRequested:body.freshness,freshnessApplied:github,
    candidates:[{channelName:'MEGA',sourceType:'hls',sourceUrl:github?'https://stream.test/github-mega.m3u8':'https://stream.test/curated-mega.m3u8',sourceOrigin:github?'github:fixture/repo/playlist.m3u':'fixture-feed',discoveryProvider:body.provider,freshness:github?'repo-pushed:2026-09-26T00:00:00Z':'live-feed-check',matchConfidence:'HIGH',verified:true,verificationStatus:'VERIFIED'}],
    reports:github?{searches:[{status:200}],repositories:[]}:[{feed:'fixture-feed',status:200,count:1}]
  }),{status:200,headers:{'content-type':'application/json'}});
};
const channel={id:'mega',originalId:'MEGA',name:'MEGA',tvgId:'mega.gr'};
const curated=await discoverCuratedRemoteFeeds(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'7d'});
const github=await discoverGithubPublicPlaylists(channel,{endpoint:'https://discovery.test',fetchImpl,freshness:'24h'});
assert.deepEqual(seenBodies[0],{provider:'curated-remote-feeds',freshness:'7d',channel});
assert.deepEqual(seenBodies[1],{provider:'github-public-playlists',freshness:'24h',channel});
for(const result of [curated,github]){
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].verificationStatus,'UNVERIFIED');
  assert.equal(result.candidates[0].verified,false);
  assert.equal(result.candidates[0].matchConfidence,'HIGH');
}
assert.equal(curated.candidates[0].discoveryProvider,CURATED_REMOTE_FEEDS_PROVIDER);
assert.equal(github.candidates[0].discoveryProvider,GITHUB_PUBLIC_PLAYLISTS_PROVIDER);
assert.equal(github.freshnessApplied,true);

const aborter=new AbortController();
const slowFetch=async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason||new DOMException('aborted','AbortError')),{once:true}));
const pending=discoverGithubPublicPlaylists({name:'MEGA'},{endpoint:'https://discovery.test',fetchImpl:slowFetch,signal:aborter.signal});
aborter.abort(new DOMException('cancelled','AbortError'));
await assert.rejects(pending,error=>error?.name==='AbortError');

console.log('external discovery client tests PASS');
