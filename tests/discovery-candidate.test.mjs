import assert from 'node:assert/strict';
import { createCandidate, candidateForDisplay, detectCandidateType, normalizeChannelName } from '../src/discovery/candidate-model.js';
import { DiscoveryState, DEFAULT_FRESHNESS, FRESHNESS_OPTIONS } from '../src/discovery/discovery-state.js';

assert.equal(normalizeChannelName('  ΜΕΓΑ TV HD  '),'μεγα tv hd');
assert.equal(detectCandidateType('https://x.test/live.m3u8?token=1'),'hls');
assert.equal(detectCandidateType('https://x.test/live.mpd'),'dash');
assert.equal(detectCandidateType('https://x.test/a.strm'),'strm');
assert.equal(detectCandidateType('https://x.test/list.m3u'),'m3u');

const hls=createCandidate({channelName:'MEGA',sourceUrl:'https://x.test/live.m3u8',requiredHeaders:{'User-Agent':'UA','Cookie':'nope'},matchConfidence:'HIGH'});
assert.equal(hls.sourceType,'hls');
assert.equal(hls.verificationStatus,'UNVERIFIED');
assert.equal(hls.verified,false);
assert.deepEqual(hls.requiredHeaders,{'User-Agent':'UA'});

const xtream=createCandidate({channelName:'MEGA',sourceType:'xtream',sourceUrl:'https://provider.test/live/user/pass/42.ts',xtreamContext:{server:'https://provider.test',username:'user',password:'secret',streamId:'42',accountRef:'acct-1'},matchConfidence:'HIGH'});
assert.equal(xtream.sourceType,'xtream');
assert.equal(xtream.xtreamStreamId,'42');
assert.equal(xtream.xtreamContext.password,'secret');
const displayXtream=candidateForDisplay(xtream);
assert.equal(displayXtream.xtreamContext.password,'••••••••');
assert.equal(displayXtream.sourceUrl,'[redacted Xtream source]');
assert.equal(displayXtream.sourceUrl.includes('secret'),false);
assert.equal(displayXtream.sourceUrl.includes('/user/pass/'),false);

const state=new DiscoveryState();
assert.equal(state.snapshot().freshness,DEFAULT_FRESHNESS);
assert.deepEqual(FRESHNESS_OPTIONS.map(x=>x.id),['24h','7d','30d']);
state.setChannel({id:'mega',name:'MEGA',group:'General'});
assert.equal(state.snapshot().candidates.length,0);
assert.equal(state.snapshot().scanStatus,'idle');
state.setScanning();
assert.equal(state.snapshot().scanStatus,'loading');
state.setScanResult({candidates:[hls],lanes:{myPlaylist:1,total:1},message:'done'});
assert.equal(state.snapshot().candidates.length,1);
assert.equal(state.snapshot().lanes.myPlaylist,1);
assert.equal(state.snapshot().scanStatus,'done');
assert.equal(state.snapshot().scanMessage,'done');
assert.equal(Boolean(state.snapshot().lastScanAt),true);
assert.throws(()=>state.setFreshness('90d'));
state.setFreshness('24h');
assert.equal(state.snapshot().freshness,'24h');
console.log('discovery candidate/state tests PASS');
