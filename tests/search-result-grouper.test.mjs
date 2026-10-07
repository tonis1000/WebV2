import assert from 'node:assert/strict';
import { groupCandidatesByChannel } from '../src/search/result-grouper.js';

const candidates=[
  {candidateId:'a1',channelName:'ERT1',normalizedChannelName:'ert1',sourceUrl:'https://stream.test/ert1.m3u8',sourceOriginLabel:'HansSettings Greece',sourceOriginUrl:'https://example.test/hans',discoveryProvider:'curated'},
  {candidateId:'a2',channelName:'ERT1 HD',normalizedChannelName:'ert1',sourceUrl:'https://stream.test/ert1.m3u8',sourceOriginLabel:'Another playlist',sourceOriginUrl:'https://example.test/list',discoveryProvider:'github'},
  {candidateId:'b1',channelName:'ERT2',normalizedChannelName:'ert2',sourceUrl:'https://stream.test/ert2.m3u8',sourceOriginLabel:'iptv-org Greece',sourceOriginUrl:'https://example.test/iptv-org',discoveryProvider:'curated'},
  {candidateId:'c1',channelName:'ERT3',normalizedChannelName:'ert3',sourceUrl:'https://stream.test/ert3.mpd',sourceOriginLabel:'Web source',sourceOriginUrl:'https://example.test/web',discoveryProvider:'recent-web-search'},
];

const grouped=groupCandidatesByChannel(candidates,{type:'group',query:'ERT',targets:[
  {id:'ert1',name:'ERT1'},
  {id:'ert2',name:'ERT2'},
  {id:'ert3',name:'ERT3'},
]});

assert.deepEqual(grouped.map(group=>group.channelKey),['ert1','ert2','ert3']);
assert.deepEqual(grouped.map(group=>group.channelName),['ERT1','ERT2','ERT3']);
assert.equal(grouped[0].candidates.length,1,'same playable source for same channel must dedupe');
assert.equal(grouped[0].candidates[0].provenanceSources.length,2,'dedupe must preserve both origins');
assert.deepEqual(grouped[0].candidates[0].provenanceSources.map(item=>item.label),['HansSettings Greece','Another playlist']);

const headers=groupCandidatesByChannel([
  {candidateId:'h1',channelName:'ERT1',sourceUrl:'https://stream.test/header.m3u8',requiredHeaders:{Referer:'https://a.test'}},
  {candidateId:'h2',channelName:'ERT1',sourceUrl:'https://stream.test/header.m3u8',requiredHeaders:{Referer:'https://b.test'}},
],{type:'channel',query:'ERT1',targets:[{id:'ert1',name:'ERT1'}]});
assert.equal(headers[0].candidates.length,2,'same URL with different playback headers is not the same playable identity');

const finalRoute=groupCandidatesByChannel([
  {candidateId:'r1',channelName:'ERT1',normalizedChannelName:'ert1',sourceUrl:'https://wrapper-a.test/start',sourceOriginLabel:'Wrapper A',sourceOriginUrl:'https://example.test/a',discoveryProvider:'github',verified:true,verificationStatus:'VERIFIED',finalRouteKey:'sha256:same-final-route'},
  {candidateId:'r2',channelName:'ERT1',normalizedChannelName:'ert1',sourceUrl:'https://wrapper-b.test/start',sourceOriginLabel:'Wrapper B',sourceOriginUrl:'https://example.test/b',discoveryProvider:'curated',verified:true,verificationStatus:'VERIFIED',finalRouteKey:'sha256:same-final-route'},
],{type:'channel',query:'ERT1',targets:[{id:'ert1',name:'ERT1'}]});
assert.equal(finalRoute[0].candidates.length,1,'verified candidates with the same final-route fingerprint must dedupe even when found URLs differ');
assert.equal(finalRoute[0].candidates[0].provenanceSources.length,2,'final-route dedupe must retain all source origins');
assert.deepEqual(finalRoute[0].candidates[0].observedSourceUrls,['https://wrapper-a.test/start','https://wrapper-b.test/start'],'final-route dedupe must retain every found route observation');

const distinctHeaderRoutes=groupCandidatesByChannel([
  {candidateId:'rh1',channelName:'ERT1',normalizedChannelName:'ert1',sourceUrl:'https://wrapper-a.test/start',verified:true,verificationStatus:'VERIFIED',finalRouteKey:'sha256:route-header-a'},
  {candidateId:'rh2',channelName:'ERT1',normalizedChannelName:'ert1',sourceUrl:'https://wrapper-b.test/start',verified:true,verificationStatus:'VERIFIED',finalRouteKey:'sha256:route-header-b'},
],{type:'channel',query:'ERT1',targets:[{id:'ert1',name:'ERT1'}]});
assert.equal(distinctHeaderRoutes[0].candidates.length,2,'different final-route fingerprints must stay distinct even if endpoints look related');

const free=groupCandidatesByChannel([
  {candidateId:'x1',channelName:'Unknown Sports HD',sourceUrl:'https://stream.test/x.m3u8'},
  {candidateId:'x2',channelName:'Unknown Sports',sourceUrl:'https://stream.test/y.m3u8'},
],{type:'free-text',query:'unknown sports',targets:[]});
assert.equal(free.length,2,'free-text fallback must stay conservative when identity is unknown');

const empty=groupCandidatesByChannel([], {type:'group',query:'ERT',targets:[]});
assert.deepEqual(empty,[]);

assert.throws(()=>{grouped[0].channelName='mutated';},TypeError,'group snapshots must be immutable');

console.log('unified search result grouping contract PASS');
