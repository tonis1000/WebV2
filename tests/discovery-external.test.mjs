import assert from 'node:assert/strict';
import { discoverCuratedRemoteFeeds, CURATED_REMOTE_FEEDS_PROVIDER, EXTERNAL_DISCOVERY_TIMEOUT_MS } from '../src/discovery/external-discovery-client.js';

assert.equal(CURATED_REMOTE_FEEDS_PROVIDER,'curated-remote-feeds');
assert.equal(EXTERNAL_DISCOVERY_TIMEOUT_MS,9000);

let seenBody=null;
const fetchImpl=async(url,options)=>{
  assert.equal(url,'https://discovery.test/discover');
  assert.equal(options.method,'POST');
  seenBody=JSON.parse(options.body);
  return new Response(JSON.stringify({
    provider:'curated-remote-feeds',freshnessRequested:'7d',freshnessApplied:false,
    candidates:[{channelName:'MEGA',sourceType:'hls',sourceUrl:'https://stream.test/mega.m3u8',sourceOrigin:'fixture-feed',discoveryProvider:'curated-remote-feeds',freshness:'live-feed-check',matchConfidence:'HIGH',verified:true,verificationStatus:'VERIFIED'}],
    reports:[{feed:'fixture-feed',status:200,count:1}]
  }),{status:200,headers:{'content-type':'application/json'}});
};
const result=await discoverCuratedRemoteFeeds({id:'mega',originalId:'MEGA',name:'MEGA',tvgId:'mega.gr'},{endpoint:'https://discovery.test',fetchImpl,freshness:'7d'});
assert.deepEqual(seenBody,{provider:'curated-remote-feeds',freshness:'7d',channel:{id:'mega',originalId:'MEGA',name:'MEGA',tvgId:'mega.gr'}});
assert.equal(result.candidates.length,1);
assert.equal(result.candidates[0].verificationStatus,'UNVERIFIED');
assert.equal(result.candidates[0].verified,false);
assert.equal(result.candidates[0].matchConfidence,'HIGH');
assert.equal(result.candidates[0].discoveryProvider,'curated-remote-feeds');

const aborter=new AbortController();
const slowFetch=async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason||new DOMException('aborted','AbortError')),{once:true}));
const pending=discoverCuratedRemoteFeeds({name:'MEGA'},{endpoint:'https://discovery.test',fetchImpl:slowFetch,signal:aborter.signal});
aborter.abort(new DOMException('cancelled','AbortError'));
await assert.rejects(pending,error=>error?.name==='AbortError');

console.log('external discovery client tests PASS');
